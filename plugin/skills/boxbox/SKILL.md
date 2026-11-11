---
name: boxbox
description: Write or refactor TypeScript/Python, or align or check TypeScript, Python, JSON or YAML when the user requests BoxBox or spreadsheet-style readability, comparing same-role rows in minimum-width columns. Also handles on-demand BoxBox session usage reports.
---

# BoxBox Code Readability

Let the reader follow execution top to bottom and compare same-role rows vertically. Rows share a comparison purpose;
columns are corresponding syntax boundaries, and cells hold their content. A comma in a nested call is not the same
axis as an outer argument separator. Use minimum-width columns without inventing work, wrappers or parameters to fill a grid.

Resolve `<PLUGIN_ROOT>` from this skill location (`../..`). Run the bundled launcher from the target repository root.

## Monitor request

When the user supplies `-monitor` (for example `/boxbox -monitor`), run the bundled launcher from the target repository:

```bash
"<PLUGIN_ROOT>/scripts/boxbox" monitor --project --host auto --json
```

Complete this branch by reporting the returned HTML path, headline usage/change numbers and explicit unavailable or
estimated fields; keep the HTML body out of the conversation. The command always writes a self-contained host page
under the host's plugin data, including with `--json`. It requires absolute `CLAUDE_PLUGIN_DATA` or `PLUGIN_DATA`; if absent or relative,
relay the setup error and use the host launcher/environment rather than choosing an arbitrary directory. An optional
`--html <absolute-path>` replaces the default destination and must stay inside that same data folder. Use the user's explicit `--session`, `--host` or
`--no-paths` selection when supplied; `--session` replaces `--project`. Auto host selects Codex when a Codex
thread/session environment is present, otherwise Claude; choose explicitly for standalone sessions.

The report contains no transcript text, commands or source content, makes no model call and shows no dollar cost.
Old baselines can lack footprints, invalid fingerprints remain unknown and Codex exact step attribution is unavailable.
A monitor request is not an instruction to align or refactor source. Continue source work only when it is also requested.

## Choose the workflow

| Request | Workflow | Allowed change |
|---|---|---|
| Write new code using BoxBox readability | **Write** | The agent implements the requested behavior using applicable guidance. |
| Restructure existing code for BoxBox readability | **Refactor** | The agent improves structure within the authorized scope while preserving required behavior. |
| Align existing code without structural changes | **Align** | The engine changes approved horizontal whitespace only. |
| Inspect or review readability | **Check** | Report original-source syntax and readability without changing source. |

Write and Refactor are agent workflows, not CLI generation commands. Follow an explicit mode choice. For an ambiguous
"fix" request, check first and clarify when the choice between structural changes and alignment affects the result.
Preview is an execution option for every workflow: present a proposed diff without modifying the target file.
Author one file at a time within the user's authorized scope; continue across authorized files without requiring fresh feedback for each file.
For engine Check or Format, use repeated `--file` or `--directory` for an authorized multi-file selection; Align and Guide remain single-file commands.

## Running the engine

Every check and fix goes through the bundled launcher. The standard shim requires `BOXBOX_CLI` to point to a locally installed engine; the BoxBox npm installer configures its own launcher during installation. Never fetch `boxbox` from npm: that registry name is owned by an unrelated package.

```bash
"<PLUGIN_ROOT>/scripts/boxbox" doctor                      # runtime, parser, config and approval data status
"<PLUGIN_ROOT>/scripts/boxbox" check --source --file <file> --json  # source syntax/readability; no formatter or working copy
"<PLUGIN_ROOT>/scripts/boxbox" guide  --file <file> --json  # approved rules and examples that apply to this file
"<PLUGIN_ROOT>/scripts/boxbox" guide  --file <file> --authoring --json
"<PLUGIN_ROOT>/scripts/boxbox" align  --file <file> --dry-run --json
"<PLUGIN_ROOT>/scripts/boxbox" align  --file <file> --json
"<PLUGIN_ROOT>/scripts/boxbox" format --file <file> --dry-run --json
"<PLUGIN_ROOT>/scripts/boxbox" format --file <file> --json
```

- Use `check --source` for readability preflight, selected Check workflows and checks after Write/Refactor/Align. It
  reads source syntax, detected groups and approval facts without a formatter, formatting working copy or write attempt.
  For an authorized formatter/editor/CI canonical check, use `check` without `--source`; the default still verifies the
  configured formatter-then-BoxBox output and requires working-copy write permission.
- If `doctor`, `align` or `format` reports a formatter warning, relay it to the user with its conditions intact: a warning saying a formatter "may be in use" does not establish that it runs.
- The public commands support TypeScript, Python, strict JSON and YAML 1.2. Check and Format accept repeated `--file`
  or bounded recursive `--directory`; each batch format is atomic per file and reports earlier writes if another file
  fails. Align and Guide accept one file. Python inspection and formatting require a runnable `python3`.
- Structured Check accepts `.json`, `.yaml` and `.yml`. It considers only runs of at least three adjacent,
  same-level, single-line scalar mapping entries for alignment. YAML multiline values, block scalars, anchors,
  aliases, tags, complex keys, flow collections, sequences, directives and document markers are unsupported.
  Report those rows and keep their bytes unchanged. YAML runs of one block mapping share its widest key, keep an
  existing `key : value` style (`key | colon | value` axes) and align trailing `#` comments (`comment` axis),
  leaving comments after outlier-wide values attached.
- Engine support is separate from write authorization. The recommended preset contains five approved
  TypeScript/Python conventions. JSON/YAML Align must refuse until a complete applicable approval proof exists.
- `guide --authoring` reads approved guidance for the target language and scope, including a new or empty file.
  Its examples guide composition; they do not prove that a proposed file is approved or safe to write.
- `align` runs without an external formatter and changes horizontal layout only. It preserves non-whitespace tokens,
  comments, identifiers and order, leading indentation, physical lines and structural AST. If the engine needs wrapping,
  operator movement or another structural change, report the refusal; stay within the selected mode.
- A newly detected shape or axis set has its own approval identity and suppresses an overlapping legacy group. Existing
  approvals do not expand to it. A public whole-file write is denied when any candidate `PASS`/`FIXABLE` group lacks
  approval, including an unchanged group. Per-group selective writes remain deferred.
- `format` retains the formatter pipeline for explicit requests to use it. If a formatter is configured for the language, it runs first.
  Canonical Check and `format --dry-run` also execute a configured formatter twice on working copies; inspect its command
  and arguments in the effective config before running them. Use existing authorization; ask only when executing that
  command is outside the authorized work. Canonical Check preserves the target and reports `canonical` verification separately
  from the original source results; exit 0/1 compares final canonical bytes with the source, while an error/refusal exits 2.
  Human approval proof, re-parsing, preservation and a two-run fixed point must pass; report any refusal reason to the user.
- Do not look for or run other alignment scripts or bypass options.

## Write and Refactor

1. Run `guide --authoring --json` for the intended file before composing a change. For TypeScript it also returns
   `columnSets` (every registered kind with its ordered columns; `approved` marks kinds an approved rule covers; `{i}`
   is a per-position column) and `axisNotes` (what each column means). Python returns source-free representative variants
   with exact legacy approval axes; `semanticKind`/`sourceContext` are descriptive labels, not new approval identities.
   Use the returned sets as the vocabulary for naming cells instead of reading the whole readability contract; open the contract sections cited below only for a judgment the
   vocabulary cannot settle. They are vocabulary, not approval. For an existing file, also run
   `check --source --json` and read its definitions, callers and relevant tests before changing its structure.
2. Design the rows before writing. For every group of three or more same-role values you are about to write, name the
   column set they share and compose each value as one row of it, instead of writing a convenient shape and aligning
   afterwards: readers with one argument shape, one field per row, `.map` rows over comparable lists, a branch chosen
   in one row. Follow [grid-first authoring](references/readability-contract.md#grid-first-authoring), including its
   limits: no padding wrappers, keep other roles outside the table, preserve behavior, and measure hot paths.
   Then build a boundary inventory for the requested rows: name each cell, its syntax boundary and its comparison region.
   For a member call, inspect `receiver | final . | method | ( | arguments | )`; for a guard, inspect `condition | return | value`.
   Match roles and nesting depth before matching punctuation. Function signatures, bodies and call sites have separate
   regions. Per-field JSDoc alone does not change the role of ordinary data properties: same-role fields
   share one name/colon/type table. The bounded `documented-data-members` kind handles required properties in data-only
   interfaces; documented Port methods and optional capabilities retain their separate boundaries. Read the rule's
   actual scope and a counterexample before applying an exception. For member calls, early returns or nested type members, read
   [column-sharing regions](references/readability-contract.md#column-sharing-regions) before choosing widths or moving rows.
3. Author the requested implementation or structural improvement. Preserve execution order, public contracts and meaningful
   differences. An overlong exception is a reason to inspect responsibility and data flow, not permission to add abstractions
   just to shorten a column. Structural guidance is advisory; report unsupported patterns instead of inventing approval data.
   An explicit user request for a local layout change can guide this authoring pass; it does not create reusable preset
   approval or bypass the deterministic Align procedure.
   When authoring or normalizing internal imports, follow the target project's import conventions and package
   boundaries; retain relative imports where its current contract requires them. Otherwise use its configured alias
   (such as `@/`) where equivalent resolution is verified. Read its effective compiler configuration, including inherited mappings, and
   runtime/build/test resolvers first. An alias is project-relative, not a machine-absolute path. Preserve external
   package and `node:` specifiers, module evaluation order and unresolved dynamic paths. Path changes belong to
   Write/Refactor, not Align. Report unsupported alias resolution; change resolver configuration only within the
   authorized scope. Verify type checking and affected build, runtime or isolated installation paths before claiming
   migration complete.
4. For preview, show the proposed diff and distinguish checks run on a proposal from checks run on the target. For an
   authorized application, inspect the diff, run relevant syntax/type and behavior checks, and assess performance-sensitive
   changes with appropriate evidence. Alignment cannot prove behavioral equivalence or performance.
5. Where approved and requested, use Align below for final whitespace. Then run the final `check --source --json`, passing each
   boundary you named in step 2 as `--expect-axis <axis>` (repeatable). The engine returns `axisExpectation`: `covered`
   (axis, group count, start lines), `missing` (no group carries it) and `unknown` (not an axis name; fix the spelling).
   It never changes the exit status and shows only that a group carries the axis, not that its columns are right.
   Account for every `missing` axis, including unsupported or single-row boundaries. Inspect their actual columns and
   record manual verification or an unresolved coverage gap. Completion requires
   each requested boundary to be verified or explicitly reported unresolved, alongside remaining findings and checks not run.
   When the user or project instructions require issue-history records, use that schema within the authorized scope to
   retain the reproduction, cause, decision and verification evidence, including failed attempts and unresolved work.

## Check and Align

When using the read-only `readability-inspector`, give it one target file and a report path owned by the calling agent
or controller. Capture its full report from the host result channel and save it at that path using the caller's existing
authorized permissions. Keep the inspector read-only. Return only a 3–5 line verdict and the saved path in the main
conversation.

1. Run `check --source --json`. Read `syntax.status` (`valid`, `invalid` or parser `error`), `formatReadiness` (approval
   eligibility; write verification is still `not-run`), `unsupported`, `groups` and their `PASS`, `FIXABLE`,
   `REFUSE` states. This source-only report does not verify a formatter canonical result or authorize a write. A refused
   group stays unchanged by alignment.
2. Read `guide --json` for applicable approved rules. With no approved rule, report the candidate and missing evidence;
   do not align it by hand, auto-approve it or use a raw writer.
3. For Check, report findings. For Align preview, run `align --dry-run --json`. For authorized application, inspect the
   dry-run result and then run `align --json`; report refusal reasons without falling back to `format` or Refactor.
4. After application, rerun `check --source --json`, reconcile user-requested boundaries with the final returned axes, and report
   missing coverage alongside the remaining `misaligned` count. Zero detected groups
   or zero misalignment does not prove that unsupported code follows the requested style. Report only validations actually run.

## Rule documents

Read the documents in this folder when a judgment is needed.

- `references/charter.md` — principles and safety invariants
- `references/grammar.md` — grammar units, patterns, roles, paragraphs (split with a blank line when the property differs)
- `references/readability-contract.md` — confirmed rules, grid-first authoring, discarded rules, column-check order
- `references/typescript-grid-template.md` — per-role TypeScript table templates

## Authoring hooks

The plugin defaults to `check` mode: inspect session changes and report without writing source. `refactor` mode also
keeps hooks read-only; the agent owns structural edits. `off` skips hook inspection. Only the user's explicit
`boxbox mode align` choice enables PostToolUse alignment, through the approved horizontal-whitespace pipeline and
after-write recheck. A refusal leaves that file unchanged. Stop always inspects without writing and can request at
most one continuation. Project mode overrides the global default; a valid `BOXBOX_MODE` overrides both for the process.
Do not select `align` mode merely because a user requested a Check or Refactor workflow.

The npm-installed launcher requires the host's plugin data folder and writes versioned receipts there. Direct CLI
hooks installed with `hooks install` can fall back to `.boxbox/hooks` when the host provides no data folder. Receipts
record observed mode, coverage and successful alignment; they never approve rules. A failing PostToolUse report names
up to three affected files and suppresses duplicate matched-tool feedback until the observed source snapshot changes;
Stop still performs its read-only completion check. Automatic hooks cover session changes; editor/pre-commit/CI
canonical checks use the default variant in Running the engine.

An update notice is informational. For a user-requested public update, relay `npx boxbox-plugin`; use
`boxbox update --source <checkout>` only as an explicit development override. Its installed-version check must succeed
for the selected host, and the host must restart. An optional `statusline` is one row, separate from monitoring.
