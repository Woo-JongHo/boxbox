# Python calculation rule proposal report

## Owned repository artifact

Added only `docs/development/proposals/2026-10-22-python-calculation-rule.md`. No source, preset, test, skill, catalog,
approval or release file was edited by this task.

## Candidate

- Exact key: `v1|python|-|table|name>equal>assignment-value`
- Scope: `**/*.py`
- Minimum: three consecutive eligible rows at identical indentation
- Ownership: complete detailed tables reserve rows before the outer projection; no overlapping owners
- Examples: one actual subtotal/max/total positive and one keyword-argument/continuation counterexample
- Authority: candidate only; both new example records are UNLICENSED and unapproved

## Direct execution

`/tmp/boxbox-readiness/run-python-rule-proposal.ts` ran both exact examples through the frozen current raw aligner.
Machine-readable evidence is `/tmp/boxbox-readiness/python-rule-proposal-evidence.json`.

Positive result:

- one 3-row table, axes `name`, `equal`, `assignment-value`;
- exact expected output with two horizontal edits;
- alignment-only preservation passed;
- second pass produced zero edits.

Counterexample result:

- explicit backslash continuation plus keyword arguments yielded no projected table;
- zero groups and zero edits;
- output remained byte-identical at the fixed point.

## Public preset behavior

Against the shipped preset and exact positive example:

- Check exited 1, exposed the exact axes, and reported the key unknown / approval ineligible.
- Guide exited 1 with no approved guides or conventions.
- Align dry-run and apply both exited 2 with `ALIGN_NOT_ELIGIBLE`.
- Every public command left the source byte-identical.

These assertions all passed. The proposal does not call raw detector support an approved default write capability.

## Evidence basis

The text is linked to `test/python-assignment-envelope.test.ts`, the frozen implementation report at
`/tmp/boxbox-readiness/python-assignment-envelope-implementation.md`, and the current Python projection/shared ownership
sources. It distinguishes implementation evidence, synthetic test-only approval, public preset authority and example
licensing.
