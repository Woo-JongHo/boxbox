# Alignment-only pipeline implementation

## Ownership and changes

Only these repository files were edited by this worker:

- `product/engine/common/format-pipeline.ts`
- `product/engine/common/alignment-only.ts` (new)
- `test/alignment-only.test.ts` (new)

No CLI, existing test, approval record, plugin installation, commit, push or deployment was changed by this worker.

`FormatPipelineOptions.alignmentOnly?: boolean` rejects a supplied external formatter immediately, before target resolution or any formatter side effect. The normal format path remains the default.

The existing parser, approval, working-copy, fixed-point, provenance, external-edit and atomic replacement safeguards remain in use. Inside the working-copy callback, the first complete candidate is compared to the original before preview restoration or commit. The second cycle must still be byte-identical to that checked candidate.

The new guard requires valid losslessly decoded UTF-8, exact line-delimiter sequences (including CRLF, CR and Unicode line separators), identical per-line non-space/tab characters, identical indentation (including indentation after a BOM), and identical trailing space/tab runs. TypeScript then uses `preservesTokens`; Python uses `changedLines` with `PYTHON_SYNTAX` to protect tokens, strings and comments. Existing raw TypeScript vertical expansion is refused by Align, not silently rewritten or accepted.

Alignment-only dry-run results additionally return `alignmentEdits?: readonly { line: number; before: string; after: string }[]`, with 1-based physical line numbers. Edits are captured only from a validated candidate. Applying these edits to original lines reconstructs the real applied output in the integration test. Legacy format and non-preview Align omit this property.

## Verification

- `bun test test/alignment-only.test.ts test/format-pipeline.test.ts --timeout 60000`: **48 passed, 0 failed, 143 assertions**, 29.96 seconds. Full output `/tmp/boxbox-align-final-tests.log`.
- `bunx tsc --noEmit`: passed before final test-only refactoring, `/tmp/boxbox-align-tsc-v3.log` (empty, exit 0). Final invocation `/tmp/boxbox-align-final-tsc.log` saw only concurrent parent-suite transient `test/boxbox-ts-write-*/sample.ts` undefined fixture names. Parent informed to serialize final typecheck after tests. No owned-file type diagnostics.
- TypeScript alignment checks on all three owned files exited 0 after applying the repository aligner. Results `/tmp/boxbox-align-guard-style-check.json`, `/tmp/boxbox-align-pipeline-style-check.json`, `/tmp/boxbox-align-test-style-check.json`.
- `git diff --check -- product/engine/common/format-pipeline.ts` passed. Owned files contain no TODO/FIXME or test.skip/test.only/describe.skip/describe.only markers.

Tests cover changed line count, EOL conversion, final newline, BOM, indentation, trailing spaces, blank lines, changed values, non-horizontal whitespace, strings/comments/regex/templates, invalid UTF-8, real TS/Python approved writes and fixed points, exact previews, formatter no-side-effects, denied approval, parser failure and commit-time provenance changes. The real vertical candidate is refused in both preview and apply, the original and staging files remain safe, and ordinary format still previews/applies that vertical result.

## Test development findings and limits

Initial tests created temporary TS projects under `test/`, so concurrent typechecks correctly reported unresolved names inside those transient fixtures. The new suite now uses OS temporary directories and cleans them with `afterEach`.

An initial 3-row vertical fixture left fewer than the minimum 3 eligible rows after conversion, so a subsequent normal-format cycle correctly refused missing approval coverage. The final fixture has four rows with the long row last; its three remaining rows retain an approved group.

Repeated TypeScript API workflows in one Bun test process intermittently stalled (one vertical scenario timed out; the same isolated scenario passed in <1 second). Final vertical integration invokes the real pipeline in fresh Bun child processes with a 20-second timeout, like separate CLI executions. This does not replace or mock the writer. The unchanged format-pipeline suite also had one TS scenario take 19.4 seconds in the final passing run. No product workaround or lower safety threshold was introduced.

Independent review remains the parent's separate pass; this is implementation evidence, not self-approval.
