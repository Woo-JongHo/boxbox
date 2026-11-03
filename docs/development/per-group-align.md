# Per-group `align`: design and recommendation

2026-11-03 · Phase 3 of [#35](https://github.com/Woo-JongHo/boxbox/issues/35). Design only: nothing here is implemented or prototyped.

## Recommendation

**Do not implement this next.** First give formatter projects a way to keep a result.

- It adds at most 14 candidate files out of 179, on top of the 3 that write today. Real write success for those 14 is unverified.
- 13 of the 14 are in `click`, `typer` and `requests`. All three run `ruff format` in pre-commit, and `ruff format` reverts this alignment, as does `black`.
- It adds 1 TypeScript candidate out of 111 files.
- The approved surface is the larger limit: 30 of 1,091 fixable groups are approved, and 91 files contain fixable groups with none approved.

The design draft already decided this: BoxBox runs after the formatter and overrides it, and hooks and CI call BoxBox instead of the formatter directly ([design section 3.5](design.md#35-formatter-coexistence--boxbox-runs-last)). Most of that is not built. See [Formatter decision and gaps](#formatter-decision-and-gaps).

## Evidence

Measured 2026-11-03 at `7409d47` with the source CLI, from each repository root, with an empty `XDG_CONFIG_HOME` and no project configuration.

File selection: walk the listed directory, excluding `node_modules`, `.git`, `dist`, `build`, `__pycache__`, `tests`, `__tests__`, `test`, `.d.ts` and `.test.` files. Sort the paths, shuffle with Python's `random.Random(7)`, and take the first 40.

| Repository | Commit | Directory | Files | Writes today | Per-group candidates | Only unapproved fixable | No groups | Nothing to fix |
|---|---|---|---:|---:|---:|---:|---:|---:|
| `sindresorhus/ky` | `3541888` | `source` | 31 | 0 | 0 | 14 | 17 | 0 |
| `honojs/hono` | `c91b60a` | `src` | 40 | 0 | 0 | 13 | 27 | 0 |
| `colinhacks/zod` | `2554b70` | `packages/zod/src` | 40 | 0 | 1 | 28 | 11 | 0 |
| `pallets/click` | `2247b35` | `src` | 17 | 0 | 4 | 10 | 2 | 1 |
| `tiangolo/typer` | `a5882de` | `typer` | 32 | 1 | 6 | 18 | 6 | 1 |
| `psf/requests` | `3c7baaa` | `src` | 19 | 2 | 3 | 8 | 4 | 2 |
| **Total** | | | **179** | **3** | **14** | **91** | **67** | **4** |

The columns classify each file from `check --json`, comparing group keys with `formatReadiness.approvalFacts`. "Writes today" was confirmed by running `align --dry-run` on all 179 files: exactly 3 changed (`typer/colors.py`, `src/requests/compat.py`, `src/requests/__version__.py`). "Per-group candidates" holds at least one approved `FIXABLE` group and at least one unapproved group; it is not an engine result.

The 14 candidates:

- `zod`: `packages/zod/src/v4/core/memoizer.ts`
- `click`: `src/click/_textwrap.py`, `src/click/testing.py`, `src/click/_winconsole.py`, `src/click/core.py`
- `typer`: `typer/rich_utils.py`, `typer/_click/core.py`, `typer/_click/_winconsole.py`, `typer/main.py`, `typer/_completion_shared.py`, `typer/testing.py`
- `requests`: `src/requests/help.py`, `src/requests/sessions.py`, `src/requests/adapters.py`

Formatter evidence: `click` and `requests` use the `ruff-format` pre-commit hook. `typer` has a local `ruff format` hook and `ruff format --check` in `scripts/lint.sh`. An aligned three-row Python assignment was changed back by both `ruff format` and `black`.

Across the 14 candidates:

- **No file is blocked only by an unapproved `PASS` group.** Each has an unapproved `FIXABLE` group too.
- **No approved fixable group's line range overlaps another detected group.** Ranges overstate overlap for non-contiguous kinds, so this count is conservative. It describes the input only; see below for overlaps that appear after alignment.

No `REFUSE` group appears in any of the 179 files. The sample is small and chosen for popularity. Treat these numbers as direction, not rates.

## Today's behavior

- `approvedGroups` in `product/engine/common/format-pipeline.ts` rejects a file if any `PASS` or `FIXABLE` group lacks approval, then `write` rewrites the file.
- The pipeline checks approval once per `cycle`, and each writer then applies every eligible edit it finds.
- The TypeScript writer (`runStagedPasses` in `product/engine/typescript/align.ts`) re-detects groups on up to five internal passes with no approval check.
- `check.formatReadiness` and `guide` in `product/engine/cli.ts` evaluate approval separately.

A byte fixed point does not prove that only approved edits were applied. Two reproduced cases:

```ts
// The key changes after alignment, and commas are then aligned under the new key.
const a = obj .make(1, 22);
const bb = obj.make(333, 4);

// One group becomes two: after alignment, rows 1-2 also form a new declaration-call-expressions group.
const a = obj .make(x===y);
const bb = obj.make(longer===q);
const ccc = obj.other(0);
```

## Design

Scope: `align` for Python and TypeScript. JSON, YAML and `format` keep the whole-file gate. Project approvals can exist for JSON and YAML, so they would still need their own selective writer later.

### Operation

Add a selective operation, `alignApproved`, on a working copy:

1. Detect groups. If any group is `REFUSE`, stop the file, as today.
2. **Freeze the selection:** groups that are `FIXABLE`, have a writable approval for their current key, have no vertical rows, and share no row line with another detected group. If the selection is empty, write nothing.
3. Apply only the selected groups' edits through the existing token, layout and parser gates.
4. Detect again and check [selection stability](#selection-stability). Repeat from step 3 until selected groups have no edits, bounded by the existing pass limit.
5. Run steps 1 to 4 again on the result, starting from a newly frozen selection. It must change no bytes.
6. Run the existing `assertAlignmentOnly`, then check the [preservation contract](#preservation-contract).

The frozen selection is the design's core. A group that was not selected at the start can never be added later, so a group that turns approved after alignment is simply not edited.

### Selection stability

After every pass, including the verification run, **abandon the whole file and write nothing** if any of these holds:

- A selected group disappeared, merged, split, or changed its row lines or key.
- A newly detected group shares a row line with a selected group.
- Any group is `REFUSE`.

Both reproduced cases above are therefore refused if they ever start under an approved key. Abandoning is cheap because all work is on a working copy.

### Row ownership

Overlap and preservation use the rows a group actually owns, not its line range: `rowLines` where the group has them, as `return-guards` does, and otherwise the row nodes known inside the writer. Non-contiguous kinds do not own the lines between their rows.

### Preservation contract

The baseline is the original file, because `align` never runs a formatter:

- Only lines owned by selected groups may change, and only in their horizontal whitespace.
- Every other line, every line separator byte and the final newline state are byte-identical. This covers CRLF and mixed line endings.

`assertAlignmentOnly` already enforces UTF-8 identity and line separators. Add a direct check of the allowed line set.

### Reporting

- Keep two lists: all detected groups, and groups selected to apply. `align` reports excluded groups with a reason: `unapproved`, `overlap`, `vertical`, or `unstable`.
- `check.formatReadiness` adds `selectableGroups`, computed by the same selection function as the writer. `approvalEligible` keeps its meaning for `format`, and `approvedFixableGroups` still counts approval only.
- `selectableGroups` describes the current input. Only `align` can prove a write, because later passes can abandon the file.
- TypeScript's JSON report does not carry vertical row counts or actual row lines today, so the selection function must run where they are known, or the report must add them.
- `guide` is unchanged: guidance is not write approval.
- `check` keeps its exit codes.

### Writers

| Language | Change | Note |
|---|---|---|
| Python | In `alignSource`, build the candidate from selected tables only, and run the safety checks on that candidate | `refuseUnsafeTables` currently validates all tables together, so that result does not vouch for a subset. Do not shrink `details`, or the report loses excluded groups |
| TypeScript | Filter `pending` to the frozen selection in each `runStagedPasses` pass, plus selection stability | |

### Policy text

`CONTRIBUTING.md` says "Every fix passes the full gate or nothing is written". The rule survives, with the gate applying to the selection. Update it and the README in the same change.

### Required tests

- A file mixing approved and unapproved groups: approved aligned, all other lines byte-identical, per language.
- Both reproduced cases, under a project approval of their first key: nothing written.
- A group that turns approved after alignment: never edited.
- Adjacent groups that merge or split after alignment.
- An unapproved `PASS` group that becomes `FIXABLE` after a neighbor moves.
- A second run with nothing to apply: no write, same bytes.
- `REFUSE` anywhere: nothing written.
- An approved group sharing a row with an unapproved one: excluded as `overlap`. A non-contiguous group with independent lines between its rows: not excluded.
- CRLF, mixed line endings and a missing final newline.
- `check` and `align` agree on the selection for the same input.

## Formatter decision and gaps

Design section 3.5 (status: draft) says BoxBox overrides the formatter, that format-on-save, hooks and CI call `boxbox format` and `boxbox check` instead of the formatter, and that the README and `boxbox init` must state this up front. Checked at `7409d47`:

| Decision in section 3.5 | Today |
|---|---|
| A configured formatter runs before BoxBox in `format` | Built. `align` never runs it |
| `check` computes `boxbox(formatter(file))` | Not built. `check` inspects the file as it is |
| `init` and `doctor` detect formatter configs and print hook and CI changes | Not built. In `click`, which runs `ruff format`, `doctor` reports "no external formatter required", and `init` writes a config with no formatter or guidance |
| The README states this up front | Not done |
| Hooks and CI can check a project | Not practical. The CLI accepts one file at a time |

So a formatter project today gets a result that its next format run reverts, with no warning.

Alternatives, if the maintainer does not want to keep this decision:

- **Target projects without a formatter.** Say so plainly and keep the engine as it is.
- **Read-only reporting for formatter projects.** `check` and agent guidance only.

Users can also exempt code with Prettier and Ruff ignore comments or file exclusion settings, without BoxBox doing anything. BoxBox inserting such comments itself would add non-whitespace text, which conflicts with the whitespace-only guarantee.

Whichever is chosen, stating the behavior in the README and having `doctor` detect a formatter is the cheapest honest first step.

If per-group proceeds after that, build Python first, and decide draft PR #34 first. It changes 236 files, including engine modules, and currently conflicts with `main`, so work on those modules could need redoing.

Rule expansion is a separate lever. Before approving more rules, count the files they would reach using `lookupKeyOf` from `product/engine/common/signature.ts` and the selection above, and check whether those files run a formatter.

## Not verified

- `alignApproved` has not been built or run, so the 14 candidates are not proven writable.
- Whether selection stability refuses so often in real files that the gain shrinks further.
- The cost of rebasing on PR #34.
- Windows and native host behavior.
