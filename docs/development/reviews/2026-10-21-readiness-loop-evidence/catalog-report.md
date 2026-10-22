# READINESS1 R1 pattern catalog report

## Scope

- Authored only `product/rules/patterns/catalog.json` in the repository.
- The catalog is advisory design inventory. It is not an approval registry, executable fixture set, license record, or claim of universal language support.
- Every `source` sample is synthetic and contains no user or corpus source. Its presence does not promote it into the public recommended preset.

## Schema written

The root object has `schemaVersion: 1` and `families`. The families appear in the required exact order:

1. `imports`
2. `declarations`
3. `function-signatures`
4. `calls-and-chains`
5. `branches-and-exits`
6. `object-and-type-members`
7. `arrays-and-records`
8. `operators-and-expressions`
9. `structured-documents`

Every family has exactly the requested fields: `id`, `title`, `languages`, `row`, `columns`, `grouping`, `nesting`, `separation`, `exclusions`, `evidence`, and `cases`. Each family has five cases, one for each required kind: `comparable`, `different-role`, `unsupported`, `nested`, and `separation`. Case objects contain `id`, `kind`, `language`, `source`, and `expectation`.

## Repository inspections

- `docs/development/pattern-management.md`: confirmed the nine-family inventory, the row/group/column/nesting/separation decision dimensions, advisory-versus-approval boundary, contextual blank-line rule, nested-axis ownership, and JSON/YAML first-release target status.
- `docs/development/plan.md` READINESS1 R0/R1: confirmed exact family count, required case categories, real evidence links, proposal labeling, and independent catalog ownership.
- `product/engine/typescript/grid-kinds.ts`: inspected the registered declaration, type/member, method, assignment, call-statement, return-guard, guard, enum, case, object-row, and registration kinds; axis notes; nested call/list ownership; ordinary contiguous runs; and specialized return-guard regions.
- `test/typescript-matrix-boundaries.test.ts`: inspected direct call envelopes, opaque heterogeneous arguments, unsupported optional/computed/type-argument calls, return columns across intervening work, nested-scope barriers, and comment barriers.
- `test/typescript-align.test.ts` and `test/fixtures/table-kinds.ts`: used as bounded evidence for existing TypeScript row kinds and counterexamples.
- `product/engine/python/profile.ts`: confirmed the six bounded line forms and explicit refusal of imports, definitions, control flow, uncertain calls/containers, continuation rows, and unsafe nested bundles.
- `test/python-align.test.ts`: confirmed annotated assignments, dictionary rows, flat bundles, assigned calls, and negative coverage for different callees/arity, nesting, keyword arguments, control flow, indexing, and malformed bundles.
- `product/engine/cli.ts` and `test/authoring-modes.test.ts`: confirmed current CLI language admission is TypeScript/Python only and `.json`/`.yaml` authoring targets are rejected today.

## Catalog decisions

- Import alignment remains needs-review/unsupported. Alias changes are identified as agent-owned Refactor work, never layout approval.
- Statement and element order is explicitly preserved across declarations, calls, branches, arrays, and expressions.
- Blank lines are contextual: ordinary declaration/member runs stop at them, while TypeScript return-region handling can span some gaps under its own bounded rules.
- Nested calls, lists, objects, types, and documents retain independent axis ownership.
- TypeScript and Python support statements are bounded to observed registry/profile and test behavior. Unsupported shapes are stated directly.
- JSON and YAML are labeled target-only/currently unsupported because dedicated adapters do not yet exist.
- No approval identity, reviewer, license, provenance assignment, or public-preset promotion was invented.

## Validation

The local Bun validation parses the JSON and checks:

- `schemaVersion === 1`;
- exact ordered family IDs;
- exact requested family fields;
- at least one case of every required kind per family;
- every expectation contains an explicit supported, unsupported, or review scope label;
- every evidence path exists in the repository.

Final result: 9 families and 45 cases validated. A placeholder scan found no `TODO`, skipped/focused test marker, absolute user path, or private-source marker in the catalog.

The BoxBox PostToolUse hook reported FAIL after the first add because it checked unrelated pre-existing/concurrent modified TypeScript and Python files across the dirty worktree. Its receipt did not identify the new JSON catalog as a checked failure. Later patch calls also reported `Source changed during check`, consistent with concurrent repository work; JSON parsing and the catalog-specific validation remained the authoritative checks for this owned file.
