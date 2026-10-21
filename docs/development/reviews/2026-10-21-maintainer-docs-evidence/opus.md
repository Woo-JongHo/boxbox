**Verdict: NEEDS_FIX.** One correction is required, in one file. Everything else passes. I used only the supplied text and no tools. Link existence relies on `documentation-check.json`.

## Required correction

| # | Location | Problem | Source evidence | Minimal correction |
| --- | --- | --- | --- | --- |
| 1 | `inspection-process.md`, Interface paragraph: "it requires an applicable approved group and can refuse a valid but unsupported file." The same imprecision appears in Process step 5: "verify approval proof for applicable `PASS`/`FIXABLE` groups". | The text implies that one approved group is enough to format a file. In fact the file needs at least one candidate, and every candidate must be approved. A file with one approved table and one unapproved `PASS` table is refused entirely. A maintainer using this document to predict refusals would get it wrong. | `format-pipeline.ts` `approvedGroups`: any `REFUSE` throws, then zero `PASS`/`FIXABLE` candidates throws, then any denied candidate throws. `cli.ts` `formatReadiness` aggregates reasons from all candidates in the same way. | Interface: "it requires at least one `PASS`/`FIXABLE` group and verified approval for every such group, so it can refuse a valid file." Step 5: "…verify approval proof for **every** `PASS`/`FIXABLE` group; refuse if any group is `REFUSE`, none is a candidate, or any candidate lacks verified approval." |

## Sonnet findings — closure

| # | Status | Basis |
| --- | --- | --- |
| 1 `check` script | Closed | The current `package.json` `check` runs `sync-product --check` (product identity), `check:layout`, `bun test`, `tsc --noEmit` and `bash -n`. `architecture.md` now cites `package.json` and matches it. |
| 2 Go opt-in | Closed | In `go/06_align-tables.ts`, `--write` is stripped unless `--enable-go` is passed. Without the flag it is report-only and exits 0. The matrix row links to the wrapper. |
| 3 Invalid-input scope | Closed | The claim is scoped to the Python probe, and TypeScript is stated as not probed. `parse.status: not-run` for Python matches the probe log; for TypeScript it is supported by the process audit. |
| 4 Review placeholder | Closed | The section records the executed Sonnet verdict and its resolutions. Per your instruction, the pending Opus line is not flagged. |
| Optional items | Closed | The text now says "Report-mode loader", HUD is described as "implemented", and the README says older documents adopt the pattern "when substantially revised". |

## Verified as accurate (spot-checked against supplied source)

- **Format pipeline:** the nine stages match `runFormatPipeline`. This includes formatter timeout, exit and fingerprint drift checks; the parse-acceptance check (Python compares against `"pass\n"`, TypeScript requires zero syntactic diagnostics); two full cycles with a byte-equality check; provenance checked before the dry-run restore and again in `beforeCommit`; and a single replacement.
- **`compareParse`:** the availability probe runs before the identical-input early return, and the probe timeout is `Math.min(timeoutMs, 5_000)`. The matrix tools match `TOOLCHAINS`, and the `-w` flags are omitted with a pointer to `parse-check.ts`.
- **Validator gaps:** all three gaps match `conventions.ts` and `examples.ts`. "No bypass" holds. A missing `versions` makes `versionsMatch` throw, and missing `approvedBy` makes `.trim()` throw. Both produce generic exceptions, and the CLI turns them into refusals.
- **Loader difference:** `lookup` conflicts only when statuses differ. `resolveConvention` conflicts whenever there is more than one winner, and also reads the user layer. The docs describe this correctly.
- **Result contract gap:** `result-json.test.ts` `LINE_ENGINE` has seven entries with no Swift or Kotlin, and `STATES` has exactly four states.
- **CLI surface:** there is no approval editor, import/export or SQLite command, consistent with `HELP`. Check, guide and format are TypeScript/Python only.
- **Test counts** match the log tails: 59/1/0 with 196 assertions, 23/0 with 168, 61/0, and 18/0. The skipped test is the Rust `compareParse` case, and the double-counting warning is present.
- **HUD claims** match `hud.json`: 0.2.2 enabled, ready, two approved records, standalone, `location-unknown`, `unverified`.
- **SQLite text** is correct: one writer per file, `foreign_keys` enabled per connection, and `integrity_check` does not cover foreign keys. Everything is framed as proposal only.

## Optional (not required for PASS)

- **`inspection-process.md`:** you could add that `SUGGEST` groups are neither approval-evaluated nor blocking for format.
- **`storage.md`:** "nonempty line counts" for `db status` depends on `userDatabaseStatus`, which was not supplied. The storage audit says only "counts lines/bytes", so confirm "nonempty" or drop it. Also, "The approval loader evaluates…" would be more precise as "The approval gate (`loadApprovalRegistry` + `evaluateApproval`) evaluates…".
- **Review verification table:** add the 175 and 85 assertion counts for rows 3 and 4, to match rows 1 and 2.
- **`docs/development/README.md`:** "Implementation facts below" could read "Implementation facts in these documents", since the README itself states few of them.
- **`AGENTS.md` (separate follow-up):** its Commands `check` line is stale against `package.json`. That staleness caused Sonnet finding 1, and fixing it prevents a repeat. It is out of scope for this change.
- **Unverifiable from the packet:**
  - whether the `learn.chatgpt.com` URLs in `hud.md` were introduced by this diff;
  - the `UNCERTAIN` claim against `design.md`;
  - the root `README.md` changes.

  Check these with `git diff` if they are new.
- **After this verdict:** update the "pending" lines in the review section and in `status.md` together.

Once correction 1 is applied, I would call this **PASS**.

---

요약: 필수 수정 1건 — `inspection-process.md`에서 format이 "승인된 그룹 하나"면 된다고 읽히는 표현을 "PASS/FIXABLE 그룹이 최소 하나 있고 그 전부가 검증된 승인을 가져야 함"으로 고치면 PASS입니다. Sonnet 지적 4건은 모두 해소됐습니다.
