**Verdict: BLOCKED.** I found one mandatory finding. It is a data-loss path in `development/install.sh`. The record validation and the plan section are sound. I only read files, so nothing below was run.

## Mandatory finding

**M1. `--uninstall` deletes user-owned directories when a stale `.boxbox-managed` marker exists** (`development/install.sh:43-46`).
- The uninstall branch runs `elif [ -e "$marker" ]; then rm -rf "$link"`. It never checks that `$link` is a real, plugin-created copy.
- The marker is an empty sibling file with no identity or content check.
- `test/alias-portability.test.ts:59-75` builds exactly this case: a user directory holding `owner.txt` plus a stale marker. It only runs install, where `place()` correctly skips the directory.
- Running `--uninstall` against the same layout would `rm -rf` the user's directory. The "user-owned installs preserved" requirement therefore holds for install and fails for uninstall.
- To close it:
  - Write an identifying token into the marker, for example the absolute source path and a fixed string, and verify it before `rm -rf`.
  - Fall back to skipping when the check fails.
  - Add an uninstall test with the stale-marker fixture asserting `owner.txt` survives.

## Non-blocking issues, worth fixing in R1

- **Partial copy on dependency failure** (`install.sh:79-81`, `64-75`). `place()` copies the skill and writes the marker before `copy_skill_dependencies` checks that TypeScript is installed. If the check fails, the script exits 1 and leaves a half-built copy. A rerun then skips it as "not a symlink", so the user is stuck until they uninstall. Run the TypeScript check before `place`. The test at `alias-portability.test.ts:45-57` asserts only the exit code and message, not that nothing was left behind.
- **Managed copies can't be refreshed.** A directory with a valid marker is still skipped on the next `--copy` or link install (`install.sh:52`). Treat "marker present and valid" as replaceable.
- **Symlinks are replaced or removed regardless of target** (`install.sh:40-42`, `58-59`). A user symlink pointing at their own checkout is silently removed or overwritten. I believe this behavior predates this change, but it sits under the same "user-owned installs preserved" requirement.
- **Brittle test assertion.** `alias-portability.test.ts:36` hard-codes `"7.0.2:3"`, so a dependency bump breaks it without any real regression. Assert the version matches `node_modules/typescript/package.json` instead.
- **Dynamic imports with a bad alias are untested.** `test/layout.test.ts:69` only checks that a valid dynamic `@/` import passes. Add `import("@/missing.ts")` to the negative fixture.

## Checked and sound

**1. Record validation**
- `runtime-record-validation.ts` helpers are correct: records must be objects and not arrays, strings can be non-empty or empty, string arrays reject duplicates, and number records require finite values and non-empty keys.
- Both `validate*` functions return the original object, so unknown local fields survive. The tests use identity (`=== value`) to prove it.
- Candidate/local-extension compatibility holds. `approvedBy` and `date` accept `""`, `source.license` is free-form, and `examples` and `evidence` are optional. Nothing here checks approval or publication.
- All required fields are enforced and the `parseRecords`/`parseConventions` line-numbered errors are intact. The preset records and the candidate fixture in `test/cli.test.ts:229` carry every required field.
- `validateAlarmAssert` accepts an empty `{}`, which satisfies "asserts required". The `docHash` check accepts a bare `sha256:` prefix. Neither is a defect against the stated scope.

**2. Alias and layout**
- `tsconfig.json` in the development skill maps `@/*` to `./engine/*`. The repo root maps it to `./product/engine/*`. Both are engine-root.
- `engine` and `rules` in the skill directory are symlinks, and `rule-data.ts` resolves `../rules` relative to the engine. `cp -RL` dereferences both, so the copy is self-contained.
- The engine's only non-`node:` runtime import is `typescript`, which the install copies along with the platform package.
- The probe runs from a temp home with no repo ancestry, so it really does test isolation.
- `aliasDestination` in `check-layout.ts` correctly rejects:
  - lexical escapes such as `@/../x` and `@//abs`;
  - missing targets;
  - directories, because it requires a file;
  - symlinked path segments, via the `lstat` walk;
  - physical escapes via `realpath`.
- Relative imports that leave `product/` are still flagged, including type-only imports and `export … from`.
- No product file uses `@/` yet (grep shows 0), so there is no source-wide migration.

**3. `plan.md` READINESS1 section** (`docs/development/plan.md:7-62`)
- It names owned and excluded paths per subtask.
- It sets nine-family thresholds: each family needs comparable, different-role and unsupported examples, with nested and separation scenarios identified.
- It tracks `proposed`/`implemented`/`tested`/`reviewed` separately from `candidate`/`approved`/`rejected`.
- The three-attempt rule says to reassess or get an independent review. It does not declare a blocker automatically, and it reserves blockers for a named external prerequisite.
- The commit/push/SSH scope is preserved, and public publication, new destinations and persistent host trust still need explicit authorization.

Fix M1 and add the uninstall test. Then R1 items 1 to 3 pass on code inspection, subject to re-running the targeted tests.
