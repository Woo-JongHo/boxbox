# Approved recommended preset implementation report

## Ownership

Changed only `product/rules/presets/recommended/**` and new `test/recommended-preset.test.ts`. Other changes in the shared checkout belong to the root/formatter worker and were not reverted. No commit was created.

## Human decisions

- The user explicitly answered **both rules approved** to the concrete approval packet covering the TypeScript source-file call-declaration rule and Python simple-name assignment rule, including their row-count boundaries, on 2026-10-21.
- The actual approving user is Woo-JongHo. Public records deliberately use `approvedBy: maintainer`, as required by the pre-existing public-preset privacy/security allowlist. The root confirmed this representation.
- The user separately and explicitly approved **CC0 for the four examples only** on 2026-10-21. `source.license: CC0-1.0` applies only to those four newly authored synthetic examples. This does not choose the repository/product license.
- No private/development approval-document paths or source-repository snippets are included in shipped records.

## Implemented data

Exactly two conventions, four examples and two decisions are included. Conventions and proof records use `APPROVAL_VERSIONS`, exact lookup keys, English public decision sections and dated human receipts. Examples use `contentHashOf`; decision document sections use `sectionHash`.

1. `ts-sourcefile-call-declarations`: `**/*.ts`, SourceFile, DEFINE, two or more consecutive const/let/var declarations initialized by a single direct call expression. Single rows and other initializer/container/axis structures remain excluded.
2. `py-simple-assignments`: `**/*.py`, DEFINE, three or more consecutive simple-name assignments sharing their existing indentation at any depth. Two-row runs, compound assignments, mixed indentation and attribute targets remain excluded.

The pre-existing proposed counters had verdict `taste`, which cannot satisfy the approval gate. The public counterexamples encode the **excluded automatic rewrite** as verdict `bad`: padded single TypeScript declaration and aligned two-row Python assignment pair. The public sections explain that `bad` denotes violation of the approved minimum, not a blanket style preference. The actual engine is tested to leave each counterexample's before form unchanged. No extra style rule was approved.

## Public build projection

`preparePublicPreset` emits exactly:

- `conventions.jsonl`
- `examples.jsonl`
- `decisions.jsonl`
- `docs/public/decisions/ts-sourcefile-call-declarations.md`
- `docs/public/decisions/py-simple-assignments.md`

The two public sections are already at their final packaged paths. The builder does not put hashes in these paths; document hashes live in decisions.jsonl.

## Validation performed

- `bun test test/recommended-preset.test.ts test/public-preset.test.ts --timeout 60000`: **17 passed, 0 failed, 74 assertions**. Full output: `recommended-preset-tests.log` in this scratch directory.
- `bunx tsc --noEmit`: passed before the last public-document clarification (which does not change TypeScript).
- The TypeScript aligner safely aligned the new test file with parse gate success, 2 passes. Raw alignment result: `recommended-preset-alignment.json`.
- Real standalone pipeline tests cover the exact approved TypeScript transformation, the explicit two-row let/var exception, the approved indented Python transformation, parser/token/indent preservation, actual writes, and idempotent reruns.
- Public preparation and rehydrated registry proofs pass. Tampered decision text is refused with a stale document hash. Scope, language, container and axes mismatches remain non-writable.
- Existing Python profile also used the same name-axis key for dotted targets. Root separated attribute axes; the new test confirms dotted-target groups do not inherit simple-name approval.

## Additional boundary audit

Actual AST probes found `using`, `await using`, `new Make(...)` and `await make(...)` collide with the approved TypeScript call key. These forms are outside the human-approved const/let/var direct-call scope. Root is correcting their engine representation. Full 11-case result: `ts-approved-key-probes.json`; probe source: `probe-ts-approved-key.ts`.

Type arguments, annotated declarations, optional calls, parenthesized initializers and `as` initializers already use other keys. Property-call expressions such as `thing.make(...)` share the call key and remain direct CallExpression initializers within the stated scope.

Final boundary regression verification will be appended after the root's TS fix. This report does not claim those collisions were fixed by preset data alone.

## Final validation and boundary resolution

Root changed TypeScript extended declarations to the distinct kind `declaration-extended-equals`, keeping them outside the direct-call approval key without changing their raw alignment bytes. The final preset regression explicitly covers all four excluded forms and confirms exact-key non-approval plus the actual public CLI result: exit 2, `FORMAT_NOT_ELIGIBLE`, an approval-denied diagnostic, and an unchanged original.

The negative cases initially reused direct internal AST checks and pipeline calls in one Bun test process. A minimal diagnostic showed a using pipeline alone takes about 77 ms, but the same pipeline after a direct internal check in the Bun test context could take about 13 seconds. Four grouped cases exceeded 60 seconds; that earlier failed run was preserved in scratch logs. The precise Bun/TypeScript API interaction has not been established. Tests now run the inspection and public CLI refusals through isolated child processes, matching the real command surface. Each excluded form is a separately named test with its own temporary workspace. These changes reduce the four-case verification to under one second without relaxing safety or increasing timeouts. The positive real pipeline tests remain direct and pass.

Final commands on the settled files:

- `bun test test/recommended-preset.test.ts test/public-preset.test.ts test/examples.test.ts --timeout 60000`: **30 passed, 0 failed, 116 assertions, 3.83 seconds**. Full output: `recommended-preset-tests.log`.
- `bunx tsc --noEmit`: passed.
- `git diff --check -- product/rules/presets/recommended test/recommended-preset.test.ts`: passed.
- TypeScript aligner recheck of the new test: no pending edits, no refusals. Full result: `recommended-preset-alignment-check.json`.
- Direct scan of changed owned files found no TODO placeholders, skipped/only tests or unimplemented marker text.

The root also corrected `development/tools/examples-check.ts` to resolve public decision references relative to the preset root. Its existing shipped-example/hash verification is included in the final 30 passing tests. No pending work remains in this worker's owned preset/test scope; whole-project, host, release and independent reviews remain root responsibilities.
