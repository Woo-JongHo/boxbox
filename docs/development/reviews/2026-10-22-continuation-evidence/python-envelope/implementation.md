# Python assignment envelope implementation

Status: source frozen for parent integration and independent review; no commit, full-suite claim, build/install claim, or new public approval.

## Outcome and scope

The real native subtotal/discount/shipping function now forms one three-row outer assignment matrix without changing its calculation, dependencies, execution order, indentation or physical lines. Arithmetic values and `max(0, subtotal - discount)` remain byte-for-byte opaque RHS cells. Axes are `name > equal > assignment-value`; the exact new identity is `v1|python|-|table|name>equal>assignment-value`. The shipped `name>equal>value` identity and all five preset files remain byte-identical.

Only five owned files changed:

- `product/engine/common/table-engine.ts`: optional projection method, shared lossless reconstruction validation, deterministic primary/fallback ownership. No projection method means the existing grouping path. Complete primary tables reserve their rows even when later preservation rejects them; pairs cannot double-own selected table rows.
- `product/engine/python/assignment-envelope.ts`: pure whole-source continuation/quote scanner and bounded arithmetic/positional-call eligibility. No parser subprocess and no changes inside RHS cells.
- `product/engine/python/profile.ts`: register projection; detailed profiler unchanged.
- `test/python-assignment-envelope.test.ts`: 15 meaningful tests, including actual Python behavior, public command validation and approval isolation.
- `test/python-align.test.ts`: replace only the former blanket heterogeneous-call rejection with the new outer-envelope expectation; keyword-call rejection remains.

The implemented callback is `project?(source: string)`, omitting the draft's unused `mask` argument: the shared mask does not expose the multiline quote context needed here, so Python owns one source scan. Existing repository aliases follow the current READINESS1 alias migration. No pipeline, signature, base rules, presets, installer or documentation edited by this worker.

## Safety and bounded exclusions

Minimum automatic table size remains three. Only consecutive physical rows at identical indentation are projected. Names, numeric/property operands, arithmetic, grouping and positional/nested calls qualify. Attribute/destructured/chained/annotated targets, strings/containers/indexing, keyword arguments, comparisons, lambda/await/yield, conditional/comprehension forms, semicolons, trailing whitespace, damaged delimiters and continuations do not qualify for the new projection. Recursion is bounded at 64.

Parenthesized keyword arguments and explicit prior-line backslash continuation cannot masquerade as independent assignments. Plain multiline strings are skipped. Prefixed strings or mismatched delimiters conservatively disable new projections for the remainder of the file. Existing detailed profiles keep their previous behavior. Complete detailed tables retain ownership and can partition a larger outer run; no overlapping multilayer editing was introduced.

The bounded grammar is not a replacement for Python syntax validation. Public Check validates actual syntax; invalid syntax returns exit 2. Under the shipped preset, the new identity remains unknown and not approval eligible. Public Guide emits no approved guide. Pipeline preview/apply refuse without changing the file. A complete synthetic approval exists only in an isolated temporary test registry to verify the approved write path; no fabricated authority entered the product.

## Verification and failure history

1. The initial real-fixture regression failed as expected: table count was 0 instead of 1. Evidence: `python-envelope-red.log`.
2. First implementation uncovered the old explicit blanket assertion that differing call names/arity/nesting can never form any table. Its expected 0 became 1; updated only that assertion to the new outer signature and RHS preservation. Evidence: `python-envelope-first-green.log`.
3. Expanded CLI test initially expected an unknown item in Guide; actual Guide deliberately returns only approved guides, thus an empty list. Corrected the test to assert `ok:false`, empty guides/conventions, with Check carrying the unknown approval fact. Evidence: `python-envelope-targeted.log`.
4. A subsequent malformed-source assertion incorrectly reused the valid-but-unapproved Check exit 1. Observed exit 2 for syntax-invalid input; corrected the helper's expected exit for that case. The original focused log was overwritten by the final run, so the historical failure is recorded here rather than claimed as a retained log. No product behavior was changed to satisfy either incorrect test assumption.

Commands and final results:

```sh
bun test test/python-assignment-envelope.test.ts test/python-align.test.ts test/line-write-safety.test.ts test/preservation.test.ts test/recommended-preset.test.ts test/format-pipeline.test.ts test/surface.test.ts
# 81 pass, 0 fail, 454 assertions, 28.36s

bun test test/python-assignment-envelope.test.ts test/python-align.test.ts test/java-align.test.ts test/go-align.test.ts test/rust-align.test.ts test/javascript-align.test.ts test/c-align.test.ts test/cpp-align.test.ts test/swift-align.test.ts test/kotlin-align.test.ts
# 138 pass, 2 skip, 0 fail, 568 assertions, 5.44s

bunx tsc --noEmit
# exit 0, final log empty

git diff --check
# exit 0
```

The second run followed the final source cleanup (replacing the very long keyword string initialization with an equivalent multiline array). Its two pre-existing optional native parser cases skipped because Rust/Kotlin parsers are not installed. They are explicitly not claimed as passed. No owned test contains skip/only or a placeholder. Other language alignment fixture behavior passed; no non-Python adapter supplies the new callback.

Tests prove exact output columns, unchanged RHS bytes, CRLF/indentation/line count, whitespace preservation, idempotence, independent complete-table ownership, no refused-table fallback, pair deduplication, rejection of lossy projections, boundary/unsupported contexts, real Python AST validity, 54 original/aligned numeric cases and identical nested-call evaluation trace. Public CLI Check/Guide use isolated user configuration. Actual parser-invalid and unapproved-write paths preserve input bytes.

Final logs: `python-envelope-focused.log`, `python-envelope-final-tests.log`, `python-envelope-typecheck-final.log`. Prebytes: `python-envelope-before/`.

## Self-formatting and frozen hashes

Used current source `censusGroups` proposals only on changed ranges (whole new files), rejecting any group failing `groupPreserved`, then verifying combined `preservesTokens` before applying proposals. Import normalization evidence is `python-envelope-imports.log`. The five `python-envelope-format-*-fixedpoint.json` receipts each show zero edits on a read-only second pass. No whole unrelated file was reformatted.

`python-envelope-placeholders.log` is empty after direct TODO/FIXME/test.skip/test.only/describe.skip/describe.only/it.skip/it.only search of all five owned files. `python-envelope-final-hashes.json` records all source and preset SHA-256 values and successful preset equality against prebytes.

| Source | Frozen SHA-256 |
| --- | --- |
| common/table-engine.ts | b7dc0ad9750cbcfb8af3a7de8cc89360040644d9ffa0334e420e93663f11b1cb |
| python/assignment-envelope.ts | 38e212df561fb035fdcb5e33142ff149d28ea2b21d0a59177d5c7e4e89c56653 |
| python/profile.ts | 4a76139ca42aeb38e2abef0a03a6a30ab7ef886c571bdbb68a5985f699e4493b |
| test/python-assignment-envelope.test.ts | bd5a922c0a1415c3fee957e233ca863bf4d0811e788760021e5aa64a1628fa2c |
| test/python-align.test.ts | e2055746f2a5489d2ff8810a7ea278cb41a9b139319973041a862392c9a0654d |

Parent owns final full check, independent Sonnet/GLM audit, catalog updates and artifact refresh. No processes remain running from this worker and no hang/retry occurred.
