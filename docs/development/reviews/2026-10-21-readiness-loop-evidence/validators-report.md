# READINESS1 R1 runtime record validation report

## Scope

Owned implementation:

- `product/engine/common/runtime-record-validation.ts` (new shared shape helpers)
- `product/engine/common/conventions.ts`
- `product/engine/common/examples.ts`
- `test/runtime-record-validation.test.ts` (new focused regression suite)

Existing target snapshots were saved before editing under `/tmp/boxbox-readiness/validators-before/`.
`product/engine/common/examples.ts` already contained unrelated in-progress interface formatting and `sectionText`
changes; they were preserved. No plan/status, approval-gate semantics, publication policy, or other modules were edited.

## Behavior implemented

- All three record validators now start from `unknown` and reject null, arrays, and primitives with a located error.
- Convention records validate every required field plus optional `examples` and `evidence`; versions/evidence are
  object maps with non-empty keys and finite numeric values.
- Example records validate every required field, status/verdict/regime/pattern enums, unique grammar IDs and rule
  references, nested versions, source kind/license/optional strings, and nested assertion arrays/booleans.
- Decision records validate every required field, kind/layer enums, reference/hash shape, unique example IDs, and
  receipt string types.
- JSONL parsing now reports malformed/truncated JSON with file and line context. Existing per-file/layer duplicate
  record-ID checks remain active; duplicate reference IDs are rejected in arrays where duplicates have no meaning.
- Generic local records retain unknown fields and arbitrary local license/scope strings. `approvedBy` and `date`
  remain required string fields but may be empty, preserving candidate creation and the existing approval gate's
  responsibility for human-receipt semantics. No approvals or current-version claims are invented.

## Verification

Passed:

```text
bun test --timeout 60000 test/runtime-record-validation.test.ts test/conventions.test.ts test/examples.test.ts
27 pass, 0 fail, 108 expect calls

bun test --timeout 60000 test/approval-gate.test.ts test/recommended-preset.test.ts
26 pass, 0 fail, 134 expect calls

bunx tsc --noEmit
exit 0

For each changed TypeScript file:
bun product/engine/typescript/00_normalize-imports.ts <file>
changed=0, errors=0
bun product/engine/typescript/06_align-tables.ts --file <file> --json
misaligned=0, edits=0, refused=0

git diff --check -- <owned files>
exit 0
```

The changed-file placeholder scan found no TODO, `test.skip`, `test.only`, `describe.skip`, `describe.only`, or
not-implemented branches. The full suite, builds, installers, and packaging were intentionally not run because the
parent requested isolated R1 validation without concurrent integration work.

## Hook note

PostToolUse emitted FAIL while applying patches because it checked the whole already-dirty worktree and reported a
pre-existing fixable group in `development/tools/check-layout.ts`, outside this ownership. Direct checks of every
owned changed TypeScript file subsequently passed with `misaligned=0` and normalized imports.
