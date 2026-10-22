# READINESS1 R1 alias portability infrastructure report

Date: 2026-10-21

## Scope

Owned and changed only:

- `development/install.sh`
- `development/tools/check-layout.ts`
- `development/skills/boxbox/tsconfig.json` (new)
- `test/layout.test.ts`
- `test/alias-portability.test.ts` (new)

No product engine import was migrated. No package builder or user profile was changed. Pre-edit copies of existing target files are under `/tmp/boxbox-readiness/pre-alias/`.

## Implemented design

1. The development skill now owns a local `tsconfig.json` mapping `@/*` to `./engine/*`. Bun therefore resolves source aliases from the installed skill location without the repository root tsconfig or a machine-specific path.
2. `development/install.sh --copy` materializes `typescript@7.0.2` and the installed `@typescript/typescript-<platform>` package under the copied skill's own `node_modules`. A copy with `--skip-deps` fails explicitly if either package is absent. Link installs retain their existing behavior.
3. Dependency copying occurs only after `place` actually created the managed skill directory. A skipped user-owned directory is not populated even if a stale marker exists.
4. The product layout checker accepts `@/x` only when it maps to an existing regular file below `product/engine`. Lexical escapes, missing files, symbolic path components/targets and physical escapes are invalid. Existing relative-import escape behavior was retained without adding blanket missing-relative-target checks.
5. The existing Node artifact builders already reject a literal `@/` in generated bundles. No builder edit was required in this phase; actual migrated bundles remain an R4 integration check.

## Verification

Passed:

```text
bun test test/layout.test.ts test/alias-portability.test.ts test/install-lifecycle.test.ts --timeout 60000
11 pass / 0 fail / 71 expect calls

bash -n development/install.sh
PASS

bun development/tools/check-layout.ts
product dependencies: PASS

bunx tsc --noEmit -p development/skills/boxbox/tsconfig.json
PASS

git diff --check -- <owned paths>
PASS

placeholder scan for TODO and test/describe/it skip/only in changed files
no matches
```

The isolated-copy test installs to a temporary home, executes an injected `@/common/display-width.ts` import from outside the repository, resolves the copied TypeScript version, and runs the copied `engine/typescript/01_group-regions.ts` against a separate temporary project.

The first representative engine run exposed that TypeScript 7's main package alone is insufficient: the async AST server requires `@typescript/typescript-<platform>`. The installer was corrected to copy the installed platform package, after which the isolated engine run passed.

An initial direct typecheck of the new skill tsconfig failed because it did not name Bun's ambient types. Adding `types: ["bun-types"]` fixed the configuration; the repeated typecheck passed.

## Integration notes

- R4 may migrate product engine imports to `@/` after concurrent engine edits settle.
- After migration, run both Node artifact builders and their artifact suites. Their existing forbidden-reference checks must continue to prove no unresolved `@/` survives bundling.
- Full repository checks were intentionally not run while concurrent engine and packaging changes were active.
