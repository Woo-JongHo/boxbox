# Author-reported focused results

These are bounded results transcribed from the author reports for the candidate snapshots they describe. This documentation pass did not rerun these tests. They are not a full repository check, final 50-file self-audit, hosted matrix, or final independent approval. Later cross-review repros exposed follow-up cases listed in `review-repro-triage.md`.

| Finding | Requested model from work ledger | Focused command and author-reported result |
| --- | --- | --- |
| Tab-aware shared width | `gpt-6.1-sol`, high | `bun test --timeout 60000 test/engine.test.ts test/python-align.test.ts test/python-assignment-envelope.test.ts test/preservation.test.ts test/structured-align.test.ts` — 79 passed, 0 failed, 478 assertions, 5 suites. The report also records 28 engine tests and 6 tab-focused regressions passing after a bounded width-allocation refinement; these were scoped runs, not a complete candidate check. |
| TypeScript insert-axis minimum width | Requested implementation model not surfaced in the work ledger | `bun test --timeout 60000 test/typescript-registration-comma.test.ts test/typescript-write-safety.test.ts test/b-layout-public.test.ts test/typescript-align.test.ts test/typescript-b-layout.test.ts test/typescript-matrix-boundaries.test.ts` — 74 passed, 0 failed, 384 assertions, 6 suites. The author reported zero misaligned/refused on the two changed files and import-layout `changed=0 errors=0`. |
| Python formatted-string preservation | `gpt-6.1-sol`, high | `bun test --timeout 60000 test/engine.test.ts test/preservation.test.ts test/python-align.test.ts test/python-assignment-envelope.test.ts test/alignment-only.test.ts test/line-write-safety.test.ts test/format-pipeline.test.ts test/parse-check.test.ts test/parser-fault.test.ts` — 153 passed, 0 failed, 712 assertions, 9 suites. The author also reported `bunx tsc --noEmit` passing and Node 22.22.3 plus Python 3.9.6 probes; these are not host-matrix evidence. |
| A12 inline-comment handling | `gpt-6.1-terra`, medium | `bun test test/report.test.ts test/strip-stray-padding.test.ts test/hook.test.ts` — 39 passed, 0 failed, 116 expectations. The author reported no independent review at that stage. |

## Baseline and candidate identity

The first self-use capture covered 49 manifest paths, including the `.mjs` development helper: raw aligner exit 0 on 39 files and exit 1 on 10. This is a discovery snapshot, not a final candidate count or pass rate. The new `product/engine/python/string-ranges.ts` raises the current source scope to 50; the live tree then continued to change. At that capture point the reusable/frozen audit remained pending; the later frozen candidate results are recorded in final-candidate-closure.md.

Requested model roles in the task ledger were `gpt-6-luna` for collection, `gpt-6.1-terra` for investigation and the follow-up correction pass, and `gpt-6.1-sol` for design/implementation. Actual Codex model metadata for those authoring sessions was not surfaced; no actual Codex model is inferred here. The cross-provider reviews surfaced Claude Sonnet 5.5 as the actual model; see their metadata files. The first fixed-model Opus audit returned FINDINGS; see opus-initial-review.md and opus-initial-review-metadata.json. The v2 fix-only PASS and final verification are recorded in opus-fix-only-review.md and final-candidate-verification.json.

## Follow-up corrections after Sonnet findings

The author report in `sonnet-fixes/report.md` records warning, uppercase-prefix, CRLF marker and invalid-source response-shape corrections; it also reports A12 restricted to TypeScript/Python, batched candidate classification, YAML/JSON regressions, and a separate Python AST guard. The fix-only Sonnet residual was addressed on the write path. The first Opus review found an additional raw no-write invalid-source path, a mutation-classification gap, and hidden Python A12 helper errors. Candidate v2 corrected all three; the fix-only Opus review later returned PASS.

- The reported single-run benchmark on 5,000 lines/500 candidates changed from 3,338 ms to 10.5 ms for the report and 7.4 ms for cleanup. It is a local measurement, not a CI assertion or general performance guarantee.
- Focused tests before final test-only alignment: 112 passed, 0 failed (529 expectations). The post-alignment run reported 104 passed and 8 failures from transient `ENOSPC`; the affected format-pipeline suite was rerun separately with 15 passed, 0 failed. The author reports other suites passed in the post-alignment run and a subsequent typecheck passed. Preserve the ENOSPC failure; do not present the rerun as a clean full-suite result.
- No full repository check, host matrix, final self-use audit, or final independent closure review was run.

The fix-only Sonnet residual was a write-path invalid-source response gap and has a correction report. Opus subsequently found a separate raw align-only/check-mode error path for malformed files with f/t-prefix candidates. The initial and follow-up Sonnet reviews remain FINDINGS, and Opus returned FINDINGS; all are preserved as review history, not PASS.


## Later frozen-candidate closure

The pending states in this author-history summary refer to the snapshots and review point described above; they are not current candidate status. Candidate `7af5b42b29c34e48` subsequently passed the 75-file parser-required full check and the 50-file source self-use audit. See [final candidate closure](final-candidate-closure.md), [per-file hashes/results](final-self-use-files.json), and [verification summary](final-candidate-verification.json). The first Opus verdict was FINDINGS for candidate v1. Candidate v2 added the corrections and evidence; its fix-only Opus verdict is PASS and records 022–025 are resolved. The earlier full-check failure, ENOSPC run, and Sonnet FINDINGS are retained as history.
