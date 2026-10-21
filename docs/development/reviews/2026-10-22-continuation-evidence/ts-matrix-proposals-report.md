# TypeScript matrix rule proposal report

## Owned artifact

Added only `docs/development/proposals/2026-10-22-typescript-matrix-rules.md` in the repository. No runtime, preset,
test, skill, catalog, or approval record was edited.

## Exact proposed scope

- Return guards: `v1|typescript|Block|return-guards|guard-return`, `**/*.ts`, at least three supported guards in one
  bounded block region. Supported guards may be nonconsecutive across ordinary processing while barriers and nested
  blocks split ownership.
- Final member-call envelope: `v1|typescript|SourceFile|declaration-call-envelope|equals>call-member-dot>call-envelope-open>call-envelope-close>semicolon`,
  `**/*.ts`, at least two adjacent declarations when every row has `equals`. It aligns the final receiver/method dot and outer envelope while
  arguments remain opaque.

The user's exact two-line `Array.from(items)` / `rows.filter(isVisible)` case produces this same key, so a third candidate
would falsely imply a distinction absent from runtime identity. The declaration row policy and `withCallEnvelope` both
permit the two-row group. Different arities also share the key when every row is a nonempty
member call. Zero-argument calls omit the close axis; direct nonmember calls omit the member-dot axis; block-local rows
change context. Those shapes are outside this proposal.

## Execution

`/tmp/boxbox-readiness/run-ts-matrix-proposals.ts` executed four exact synthetic snippets through the raw development
aligner. It asserted exact output, exact target group count, exact lookup key, token preservation and second-write
idempotence. All assertions passed.

| Scenario | Target groups | Result |
| --- | ---: | --- |
| Return guards positive | 1, rows 2/5/7 | exact aligned output, preserved, fixed point |
| Return guards counterexample | 0 | comment made two sub-floor regions; unchanged |
| Member-call positive | 1, 2 rows | exact user scenario and five-axis key, preserved, fixed point |
| Member-call counterexample | 0 | comment/optional/computed forms excluded; unchanged |

For each positive example, the current public `format` command exited 2 with `FORMAT_NOT_ELIGIBLE` and `approval denied:
no matching convention`; both source files remained byte-identical. The raw development aligner demonstrates mechanics,
while the public result demonstrates that the recommended preset still grants no authority for either key.

Complete machine-readable evidence is in [complete machine-readable evidence](ts-matrix-proposals-evidence.json).

## Approval and license boundary

Both rules remain candidates and the four new synthetic snippets remain UNLICENSED pending an explicit user license
decision. No public preset mutation or implied family-wide approval was made.
