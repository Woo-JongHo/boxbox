# TypeScript pipeline step audit (2026-10-27)

Read-through of the TypeScript steps for leaks (a row detected and then lost without a report) and duplicates (one row
claimed by two kinds). Base: `origin/main` at `ca10c9e` (0.2.6 + literal-array rows). Fixes are limited to confirmed defects
with a failing test first; everything else is recorded for a later decision.

## Steps and their paths

| Step | File | Reached by (verified by imports) |
| --- | --- | --- |
| 00 normalize imports | `00_normalize-imports.ts` | standalone step script and its tests; not imported by the public CLI |
| 00 expand interface members | `00_expand-interface-members.ts` | standalone step script |
| 01 group regions | `01_group-regions.ts` | `grid-tokens.ts`, `align-cli.ts` (line engine) |
| 02 / 03 type audits | `02_audit-type-uncertainty.ts`, `03_audit-optional-types.ts` | standalone step scripts |
| 05 hover inspection | `05_inspect-hover.mjs` | standalone step script |
| 06 align tables | `06_align-tables.ts` -> `align.ts` | **the only step behind `check`, `align`, `format` and the hooks** (`cli.ts`, `format-pipeline.ts`) |
| 07 wrap conditions | `07_wrap-conditions.ts` | standalone step script, `test/wrap-conditions.test.ts` |
| 08 function map | `08_function-map.ts` | standalone step script |
| 09 observe shapes | `09_observe-shapes.ts` | harness (`development/harness/db.ts`) and tests |

So the public product is one step deep: steps 00, 02–05 and 07–09 are development tools run by hand or by the
harness. "Reads well step by step" therefore means 06 for users; the numbered steps are the agent's manual toolkit.

`check`, `align` and `format` reach the same detector (`collect` over `ROW_KINDS`) and the same refusal rules: the check
path reports conflicts, overlaps and token-gate failures as `REFUSE`; the write path (`safeGroups`) drops the same groups
before writing. No path divergence found.

## Findings

| # | Kind | Where | Status |
| --- | --- | --- | --- |
| 1 | **Leak** | `align.ts` `collect`: `object-rows` added every array element to `seen` before knowing whether a run formed a table | **Fixed** |
| 2 | Duplicate | Statement-level kinds share `node.statements` (declaration, assignments, call-statements, if-headers, guards) | Measured: negligible |
| 3 | Silent drop | `alignRows`: an axis with fewer than two entries is skipped without appearing in `skipped` | Recorded |
| 4 | Silent drop | Runs shorter than `minRows` are discarded without a candidate report | By design; recorded |
| 5 | Coupling | `return-guards` depends on `if-headers-return` running first (it filters `seen`), only documented by array order | Recorded |
| 6 | Efficiency | `collect` calls each kind's `containers` twice per node (container test, then the kind loop) | Recorded |

### 1. object-rows leak (fixed)

An array whose elements are all object literals made `object-rows` mark every element as claimed. Multi-line objects are
not `object-rows` rows, so no table formed, and `registration` then skipped those objects. Three multi-line objects in an
array produced **0 groups**; the same object outside the array produced its `registration` table.
Fix: claim only the rows of runs that became `object-rows` tables. Test: `test/ts-step-audit.test.ts`.

### 2. Duplicate detection (measured)

Census over 166 repository TypeScript files (`censusGroups`, min rows 3): 1822 groups, **1** pair of different kinds at the
same depth sharing two or more lines (`declaration-call-expressions` x `declaration-equals`), **0** overlapping edits.
The kind order and `seen` claims keep kinds disjoint in practice; no change.

### 3–6 (recorded, not changed)

- 3 hides why a boundary did not become a column; reporting it as `skipped` with a reason would help `--expect-axis`.
- 4 is the minimum-rows contract; a candidate list would only be useful for authoring guidance.
- 5 should become an explicit rule (for example a `claims` field on the kind) before more statement kinds are added.
- 6 matters only for very large files; measure before changing.

## Verification

- `bun test test/ts-step-audit.test.ts`: failed before the fix (0 groups / missing registration), passes after.
- Full suite compared with the clean `origin/main` baseline; see the branch notes.
