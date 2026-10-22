# Exact row membership for noncontiguous guard reports

## Defect and correction

The parent independent Sonnet review found that return-guard regions span preparation statements and nested blocks, while the report treated every line between `startLine` and `endLine` as a table row. That inflated A1/A2/A3/A7 width/padding alarms, let the outer table claim nested rows, and hid A12 on preparation statements.

Added optional `ResultGroup.rowLines` containing exact 1-based physical row membership. The TypeScript aligner supplies it only for `return-guards`, including normal and refused JSON groups. All other emitted groups omit the property; schema version remains 1 and lookup keys are unchanged. Report ownership, hard/soft widths, outlier selection and padding ratios use exact rows when present, with the existing inclusive-span behavior for legacy groups.

## Changed files

- `product/engine/common/result-json.ts`: optional documented metadata.
- `product/engine/typescript/align.ts`: build and emit row membership, without changing edit behavior.
- `product/engine/common/report.ts`: exact membership in group lookup and row calculations.
- `test/report.test.ts`: three substantive regressions covering excluded preparation lines, nested ownership, and actual emitted CLI JSON.

No grid detector, call-envelope behavior, approval/preset data or unrelated existing changes were edited. Baselines and metadata-only patches are beside this report.

## Verification

- `metadata-tests.log`: `bun test test/report.test.ts test/result-json.test.ts test/typescript-matrix-boundaries.test.ts` — **44 pass, 0 fail, 187 assertions** after formatting.
- `metadata-typecheck.log`: `bunx tsc --noEmit` passed.
- `metadata-diff-check.log`: `git diff --check` passed.
- `metadata-placeholders.log`: no TODO or focused/skipped-test markers in changed files.
- `metadata-format-*.json`: current source-engine proposals applied only to groups intersecting changed ranges; group and combined token preservation verified before writes.
- `metadata-format-*-fixedpoint.json`: each owned changed range has zero remaining formatting edits.
- CLI regression verifies exact outer `[2,8,11]` versus nested `[4,5,6]` row membership, while ordinary declaration results have no `rowLines` field.
- Report regression proves a 200-space intervening preparation line produces its own A1 and A12, without false guard A2/A3/A7. Nested outlier is attributed once to its own group.

Independent review and full-session checks remain the parent's responsibility.
