# Matrix boundary engine implementation

## Ownership and change

- Updated `product/engine/typescript/grid-kinds.ts`; preserved all pre-existing edits (baseline is `grid-kinds.before.ts`).
- Updated `product/engine/typescript/align.ts` header only to document the new noncontiguous-guard exception.
- Added `test/typescript-matrix-boundaries.test.ts` (10 tests); updated only directly affected different-callee/arity/list-call expectations in `test/typescript-align.test.ts`.

## Contract

`return-guards` uses a new `guard-return` gap axis, with the default minimum of 3 guards. Rows must be unbraced one-line `if (...) return ...` statements without `else` in the same immediate `Block`. Blank lines and ordinary statements (including while/for loops, nested blocks and multiline variables) can bridge guards. Only immediate sibling guards enter the outer width calculation; inner-block guards form independent tables. Comments between siblings, incompatible `if` forms/else, standalone return/throw/break/continue, and function/class declarations terminate the region. A comment between the condition and `return` prevents that row from detection. Only horizontal whitespace immediately before `return` changes; statements and declarations never move.

`declaration-call-envelope` uses distinct `call-envelope-open` and `call-envelope-close` axes and inherits the existing 2-row declaration floor. Direct calls through simple identifier/property callees can have different names/arities and one trailing non-null assertion. Their arguments remain opaque. Empty calls keep `()`, with no closing-axis padding. `await`, `new`, optional chains, type arguments, computed access, call-produced receivers, trailing commas and comments directly on edited boundaries are excluded. Direct same-call/arity rows retain the old layer and exact approved lookup key. No preset or approval data was changed.

## Integration correction

The initial variable-only bridge could not satisfy the actual `subjectCall` and `callLayer` examples because their guards surround while/for statements. The parent identified that integration gap before completion. The final implementation bridges ordinary statements in the same immediate block and includes exact-shaped while/for regressions, including independent inner and outer columns. Negative coverage now pins explicit section barriers rather than all execution statements. `expanded-final-new-suite.log` verifies the final new suite after formatting.

## Evidence

- `targeted-expanded.log`: 35 passes, 0 failures, 151 assertions across the new suite and all existing TypeScript alignment tests.
- `typecheck.log`: `bunx tsc --noEmit` exit 0.
- `diff-check.log`: `git diff --check` exit 0.
- `placeholders.log`: no TODO/test.skip/test.only/describe.skip/describe.only matches in new production/test work.
- `self-format-grid.json`, `self-format-test.json`: source engine edit proposals applied only to new helper-function ranges and the wholly new test file; combined token preservation checked.
- `self-format-*-fixedpoint.json`: second pass proposes 0 edits in owned ranges.
- `self-test-check.json`: source engine finds no remaining misalignment in the new test file.
- Each positive/negative test checks full token preservation, unchanged indentation/line counts and a fresh no-write check returning exit 0 after the real development writer; the writer itself performs fresh syntax diagnostics and atomic staged writes.

These are engine implementation tests, not proof that public `align` has human approval for these new keys. Independent review and whole-session integration are the parent's responsibility.
