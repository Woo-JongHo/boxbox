# Python heterogeneous calculation assignments: bounded outer projection

Status: **implementation plan; rule unapproved**. Source investigation was read-only; implementation was subsequently authorized within READINESS1 R2. The main agent reviewed the design before handing the bounded source/test scope to the implementation worker. This is not a public rule approval.

## Reproduction and cause

The actual calculation is meaningful and must stay unchanged:

```python
def calculate(unit_price, quantity, discount, shipping):
    subtotal = unit_price * quantity
    discounted = max(0, subtotal - discount)
    total = discounted + shipping
    return total
```

The [recorded baseline](../reviews/2026-10-22-continuation-evidence/python-assignment-baseline.json) confirms **groups=0, tables=0, misaligned=0**. The arithmetic assignments have `name > equal > value` profiles, while the middle call has no accepted profile.

Source causes:

- [`python/profile.ts:130`](../../../product/engine/python/profile.ts) `cellsIn` admits scalar call arguments only; `subtotal - discount` is not a scalar.
- `assignedCallProfile`, same file lines 141–196, embeds the callee into an axis and arity into the slot sequence. Different callees/arity therefore cannot share its inner table.
- `profilePython`, lines 198–208, tries that detailed profile, then `isUnsafe` rejects remaining parentheses.
- [`common/table-engine.ts:142`](../../../product/engine/common/table-engine.ts) drops an unprofiled line; grouping at lines 158–164 requires adjacent physical indexes and equal full slot signatures. This is correct for detailed columns, but leaves no outer assignment comparison.

Expected calculation matrix (same operations, dependencies and execution order):

```python
def calculate(unit_price, quantity, discount, shipping):
    subtotal   = unit_price * quantity
    discounted = max(0, subtotal - discount)
    total      = discounted + shipping
    return total
```

The columns are `name | = | opaque calculation`. This proposal does **not** align the inner `max` commas against arithmetic operators or manufacture extra function calls.

## Recommended interface and seam

Keep `profile(code, masked)` and its current output unchanged. Add one optional file-level projection method to the existing `LineProfiler` interface:

```ts
project?(source: string): ReadonlyMap<number, RowProfile>;
```

Map keys are zero-based physical line indexes. Its implementation may return only independently bounded, complete outer rows. Every returned profile must pass the engine's existing byte-for-byte lossless reconstruction check against that line's comment-stripped code. Missing entries are explicit non-candidates, never guessed from another row.

Only `PYTHON_ALIGNER` supplies this method, delegated to a small `product/engine/python/assignment-envelope.ts` module. The implementation uses one pure O(n) source-context scan: the shared mask does not expose multiline quote state, so the originally proposed unused mask argument was removed. Avoid rescanning the preceding file for every line and avoid mutable state on the shared exported profiler object. No new parser subprocess is needed per row. An absent callback follows the existing grouping path exactly.

This is a narrow seam inside the existing module: the shared engine owns selection, widths, preservation and one-writer-per-line; the Python adapter owns Python assignment eligibility. Do not teach the shared engine Python operators or make every language acquire this behavior.

## Initial bounded syntax contract

Support plain **simple-name** assignments with a nonempty, complete, one-physical-line calculation RHS. Targets are ASCII identifiers as in the existing profile. Initial new projection supports numeric/name/property operands, arithmetic `+ - * / // % **`, parentheses and positional calls, including nested calls and arithmetic arguments. This fully covers the real subtotal/discount/shipping example, heterogeneous callee names and arities.

Keep the RHS slice verbatim in the final slot. Do not split, normalize, pad or reorder anything inside it. Only the name-to-equals gap and the equals-to-value gap are reassembled. The final cell receives no right-padding.

For a deliberately small first implementation, reject these new projections (existing detailed profilers retain their old independent behavior):

- Attribute/subscript/destructuring/annotated/chained targets, compound assignments, comparisons mistaken for the assignment delimiter, walrus expressions.
- RHS keyword arguments, lambda, await, yield, conditional expressions and comprehensions; strings/prefixed/f-strings/triple quotes and container literals/indexing remain outside this new calculation projection. The existing scalar/string and bundle tables remain supported through their old profiles.
- Semicolons or multiple statements on a physical line; empty RHS; trailing whitespace; explicit backslash continuation.
- Unbalanced/mismatched delimiters or a row that begins/ends inside a bracket continuation. Track bracket nesting from the full mask, including `[]` and `{}` even though the new projection does not accept them, so assignment-looking text in an enclosing multiline expression cannot join.
- A row continued from the previous physical line via `\\`, even if its own local text looks complete. Carry this context once across the full source. Masked string/comment contents must not contribute punctuation.
- Prefixed strings and mismatched delimiters conservatively disable new projections for the remainder of the file. Ordinary complete multiline strings are skipped. Unknown operators/tokens or ambiguous source slices. The adapter is a bounded structural detector, not a substitute Python grammar; real public `syntax.status` and pre-write `ast.parse` remain mandatory.

The implemented shape is a private scanner over source with quote/comment state that marks line indexes outside continuations, plus a strict anchored assignment extractor on eligible original/masked line pairs. Its own source extraction follows the existing CRLF/comment-cut convention at `table-engine.ts:128–147`. Return no candidate if exact reconstruction fails. Raw line-engine non-candidates are currently absent rather than a `REFUSE` JSON table; do not claim that absence means readable or syntax-valid. Public invalid/error syntax still blocks writes.

## Deterministic ownership and priority

1. Build and validate all existing detailed profiles/runs exactly as today.
2. Reserve every physical row owned by an existing detailed run meeting the effective `minRows` floor (at least 3). A later preservation refusal must **not** release those rows to a broader fallback; refusal stays refusal.
3. Validate the adapter's outer candidates with the same lossless check. Remove reserved indexes.
4. Group remaining outer candidates only when their physical indexes are consecutive, indentation bytes match, and projected slot signatures match. Blank/comment/refused lines, indentation changes and already-owned detailed rows split the run.
5. Outer runs meeting the floor become tables. Existing two-row detailed pairs do not reserve rows ahead of an actual 3+ outer table; omit any pair intersecting a selected outer table. Otherwise retain existing pair reporting, and report an outer pair only when it would not overlap an existing pair. Every selected table/pair must have unique row ownership.
6. Reuse the existing width/reassembly/preservation/refusal pipeline unchanged. Merge selected tables in source order. Count selected runs, not both original and replaced candidates.

This preserves existing complete same-call/bundle tables and approved simple assignment tables byte-for-byte. Heterogeneous calculation runs left uncovered gain one outer table. It intentionally does not try to overlay a broad outer table over an already-owned detailed subgroup; that would require coordinated multi-layer edits and separate policy provenance. Document this limit rather than introducing overlapping owners or two approval keys for the same edits.

## New exact identity; no approval inheritance

Use projected slots:

```text
name > equal > assignment-value
```

The final slot's text is the untouched RHS; `name` already participates in `columnAxes`, and the new last slot uses the existing default one-space gap. No language-independent `canonicalGaps` behavior needs changing.

The emitted group remains `kind: "table"`, with the exact new lookup key:

```text
v1|python|-|table|name>equal>assignment-value
```

This differs from the shipped approved `v1|python|-|table|name>equal>value` in `product/rules/presets/recommended/conventions.jsonl:2`. Do not change the approved row, its examples, hashes or decision. `common/signature.ts:33` already preserves this different axis, `common/align-cli.ts:80–85` already emits table axes, and `common/format-pipeline.ts:145–148` already checks approval before writing. They should need **tests, not behavior edits**.

`product/rules/base/python.json` already classifies the prefix `["name", "equal"]` as DEFINE/CHANGE; retain its ambiguity. No claim that a line-engine simple assignment identifies new binding versus mutation. A catalog/support entry may describe this candidate key, but it is not a human approval. Public Align must refuse this new group under the existing preset, including preview; Check must detect it and expose the missing approval. Parent owns any later human decision request.

## Exact proposed source ownership

| Path | Necessary change |
| --- | --- |
| `product/engine/common/table-engine.ts` | Optional projection callback, reuse/extract lossless row validation, deterministic nonoverlapping primary/fallback selection. Existing width/preservation functions stay unchanged. |
| `product/engine/python/assignment-envelope.ts` (new) | Pure source-linked Python projection and continuation eligibility; imports via the current `@/` convention. |
| `product/engine/python/profile.ts` | Register the optional callback and update narrow support comments; keep existing detailed profile implementation unchanged. |
| `test/python-assignment-envelope.test.ts` (new) | Real calculation, selection ownership, syntax/preservation/behavior, negative contexts and approval/key regressions. |
| `test/python-align.test.ts:108` | Update only the old blanket assertion that differing callees/arity/nested positional calculations never form *any* table; assert their new outer axes and unchanged RHS. Keep keyword/unsupported cases refused. |
| `docs/development/pattern-management.md` / current catalog source (parent-owned) | Explicit proposed/tested coverage and limits after implementation; no unapproved preset changes. |

Do not edit TypeScript grid/align/report metadata, JSON/YAML adapters, installer or plugin payload for this engine feature. No changes to `align-cli.ts`, `format-pipeline.ts`, `signature.ts`, public approved preset, other language profiles or result schema are presently required.

## Meaningful verification and acceptance

1. **Real calculation:** the exact function above yields one 3-row table with the new axes; expected `=` column is identical and minimum width. Execute original/aligned functions in Python on a matrix of prices, quantities, discounts (including greater than subtotal), and shipping values; results/exceptions and call order agree. Do not rewrite the function to fit an old rule.
2. **Opaque RHS:** heterogeneous positional calls, nested calls and arithmetic arguments keep every character inside each RHS exactly. Exact LF/CRLF, indentation and physical line count preserved; `changedLines` is empty; Python AST accepted and `align(align(source)) === align(source)`.
3. **Legacy stability:** existing approved simple assignment output/key stays exact; existing same-call scalar/bundle and list-row goldens stay byte-identical. Missing callback on the other eight line adapters retains their full suite goldens and refusal behavior.
4. **Single owner:** three compatible detailed call rows next to a mixed calculation region retain the detailed table and only a nonoverlapping new outer table. A detailed pair inside a larger heterogeneous outer run is replaced by exactly one outer table, without duplicate pair alarms. Refused primary ownership never falls through to fallback edits.
5. **Barriers and floors:** 1 row absent, 2 rows suggestion/no write; comments/blank lines/different indent/same-looking assignment inside multiline parentheses/explicit prior-line continuation all split. Exercise mixed tabs/spaces without normalizing them.
6. **Negative syntax:** annotated/attribute/chained/compound/tuple targets, keyword args, walrus, semicolon, string prefixes/quotes, container/comprehension/await/yield/lambda, unbalanced/mismatched delimiters and unsupported tokens remain outside this new projection. Public Check reports actual invalid syntax separately; missing/failing Python parser never authorizes a write.
7. **Approval boundary:** public Check detects the new key; Guide lookup is unknown; shipped preset permits the old simple table but Align/preview refuses the new key and leaves bytes unchanged. A temporary test-only complete approval proof, clearly synthetic, may verify actual pipeline preview/apply/fixedpoint for this candidate without adding product approval data.
8. Run targeted Python, line-write-safety, preservation, report/surface and public CLI/pipeline tests; then full language fixtures/mutation suite plus `bun run check`. Rerun real native authoring with the calculation, record detected axes and unapproved status, and obtain independent read-only review.

## Why this remains bounded

The shared engine extension is opt-in and language-neutral; Python-specific eligibility stays in one module. Default detailed runs and all non-Python adapters retain their old path. The new key cannot inherit the old policy, detailed ownership prevents overlapping writes, and no change to RHS code/evaluation order is needed. Correctness still depends on actually implementing and testing the scanner/selection contracts above; this document alone is not an implementation or completion claim.
