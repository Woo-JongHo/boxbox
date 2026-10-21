# READINESS1 R2 TypeScript layout-policy experiment

## Scope and result

Moved the complete existing descriptive `KIND_AXES` mapping and the declaration row-kind's executable
`gap: "blank"` plus conditional two-row floor into versioned, validated data at
`product/rules/base/typescript-layout.json`.

Added `product/engine/typescript/layout-policy.ts`, which statically imports that JSON, rejects incompatible schema
versions and languages, missing or unknown fields, malformed/duplicate/overlapping axis classes, unknown gap or
row-floor operations, row floors below 2, and axes without a normalized `AXIS_NOTES` contract. The only executable
condition remains the bounded `every-row-has-axis` operation. The validator requires the exact implemented kind
registry and rejects invented or missing kinds. Candidate extraction, `RowBoundary.from`/`at`/`insert` generation,
and parser interpretation remain code-owned.

Execution extent is deliberately narrow: the data controls declaration run separation through `RowKind.gap` and
the declaration run floor through `RowKind.minRows`. `KIND_AXES` remains exported descriptive metadata used by
authoring/contracts; it does not generate detector boundaries or alignment edits. Therefore this slice does not
claim that all TypeScript column behavior is data-driven.

Updated `product/engine/typescript/grid-kinds.ts` to consume the validated data. The moved inline `KIND_AXES`, shared
declaration-axis constant, declaration gap literal, and declaration row-floor predicate were removed. No approval,
scope, lookup-key, CLI, approval-gate, or candidate-grouping behavior was added.

Added `test/typescript-layout-policy.test.ts` covering the complete visible kind set, exact declaration-equals axes,
normalized axis-note coverage, the actual `ROW_KINDS` declaration gap/minRows wiring and fallback, schema/unknown
field/unknown kind/unknown operation/unknown axis, duplicate and overlap failures, and isolated source-copy
resolution.

Before-edit snapshots are under `/tmp/boxbox-readiness/policy-before/`.

## Verification

```text
bun test --timeout 60000 \
  test/typescript-layout-policy.test.ts test/surface.test.ts test/plugin-contract.test.ts \
  test/typescript-align.test.ts test/typescript-matrix-boundaries.test.ts
59 pass, 0 fail, 435 expect calls

Closure review after tightening the implemented-kind registry and execution-wiring evidence:
bun test --timeout 60000 test/typescript-layout-policy.test.ts \
  test/typescript-align.test.ts test/typescript-matrix-boundaries.test.ts
42 pass, 0 fail, 193 expect calls

bun test --timeout 60000 test/typescript-layout-policy.test.ts
4 pass, 0 fail, 18 expect calls (final post-alignment rerun)

bunx tsc --noEmit
exit 0

bun build product/engine/typescript/layout-policy.ts --target=node --format=esm --outdir <temp>
Bundled 2 modules; the generated module embeds the JSON object and contains no readFile/node:fs/Bun.file runtime read.

Isolated-copy test:
copy product/engine -> <temp>/engine and product/rules -> <temp>/rules, then import
<temp>/engine/typescript/layout-policy.ts
exit 0; output `1 typescript`

Pre/post fixture report:
bun product/engine/typescript/06_align-tables.ts --file test/fixtures/table-kinds.ts --json
`cmp` of the complete pre-change and post-change JSON reports: byte-identical, exit 0.

For each changed TypeScript file:
00_normalize-imports.ts check: changed=0, errors=0
06_align-tables.ts check: misaligned=0, edits=0, refused=0

git diff --check on owned files: exit 0
placeholder scan: no TODO, skip/only, or not-implemented branch
```

The existing matrix regression `preserves the approved same-call key and output while new envelopes have distinct
keys` passed, so this slice did not widen or rename an approved lookup key. Full build/suite was intentionally not
run while other R2 work is concurrent.
