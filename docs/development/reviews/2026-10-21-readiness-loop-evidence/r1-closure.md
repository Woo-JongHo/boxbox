**PASS.** I found no mandatory findings in the scoped files. This is from reading the code only. I can't run tests, and the `/tmp/boxbox-readiness/*` reports are outside my read sandbox, so I haven't seen the earlier test logs.

## Earlier mandatory findings

**Stale marker could delete a user-owned directory (`install.sh:65-77`, `83-130`): closed.**
- A directory copy now counts as managed only if three things hold. It must be a real directory and not a symlink. It must contain `.boxbox-managed`. And that file's content must exactly equal the sibling marker's `directory:<128-bit random>` identity.
- File copies need a `file:<sha256>` marker that matches the current content.
- A stale marker next to a user directory, or a user-edited copied file, fails this check. Install and uninstall then both skip the entry.
- Both outcomes are covered by `alias-portability.test.ts:66-84` and `:117-134`.

**Foreign symlink ownership (`install.sh:79-81`): closed.**
- `owned_link` requires an exact `readlink` match against the expected source.
- `alias-portability.test.ts:86-100` checks that the foreign link survives both install and uninstall.

**Copy dependency preflight (`install.sh:34-59`, `151-152`): closed.**
- In copy mode, preflight runs before any target is touched.
- It checks each `package.json` dependency's installed version against the pin, and checks that a `@typescript/typescript-*` platform package exists.
- `alias-portability.test.ts:49-64` checks that nothing is left behind when dependencies are missing. The version assertions at `:20,39-40` come from `package.json`, so they aren't hard-coded.
- With a nonempty `TARGETS`, `set -u` is safe, and `DEPENDENCY_NAMES` is only read in copy mode.

**Alias path validation (`check-layout.ts:20-37`): closed.**
- The check rejects lexical escapes, missing targets, directories, any symlink between the target and `engine`, and realpath escapes.
- `layout.test.ts:75-90` covers missing targets, escapes, dynamic imports and a symlinked target.

**Catalog supported claims lacked case evidence: closed.**
- Every one of the 45 cases has `"verification": "design-only"` and its own nonempty `evidence`.
- The validator (`pattern-catalog.ts:93-94`) requires exactly `design-only` plus evidence.
- Each of the 14 distinct evidence paths in the catalog exists.
- The five test names quoted in expectations exist in the cited test files.
- `catalog.json` has no preset-approval claims. Every approval mention says approval is still required or gated.

**Evidence path validation and wrong-owner tests: closed.**
- `readPatternCatalog` (`:107-125`) rejects absolute paths, `..`, backslashes, missing files, any symlink component up to the root, a realpath escape, and non-files.
- Tests cover absolute, missing, backslash and symlink-file evidence (`pattern-catalog.test.ts:156-167`, `:105-111`).
- `buildPatternIndex` (`:128-168`) uses `lstat`, so symlinks and dangling symlinks are rejected before any open.
- It opens an existing output read-only and requires `owner = boxbox-pattern-index`. A text file, an empty file, a wrong-owner database and a database with no metadata table all throw and are preserved (`:132-154`, `:88-103`).
- It builds into a unique temporary file, runs integrity and foreign-key checks, then renames. Failed builds leave the old index intact, and the temporary file is removed.
- The index is development-only. Nothing else in the repository reads `patterns.sqlite` or imports `bun:sqlite`, so it has no reverse authority.

## New regressions

None blocking. Nothing in the changes I read can overwrite or delete an entry the installer doesn't own.

## Non-mandatory notes

1. **Platform package version.** `install.sh:55` checks that some `typescript-*` platform package exists but not its version. Copy mode also copies every platform package present. The runtime test covers the current host only.
2. **Partial copy.** If `cp -RL` fails mid-copy after the marker is written (for example on a dangling symlink in the source), `set -e` exits and leaves a partial managed directory. That directory is still safely owned and removable. Preflight covers the dependency case.
3. **Unchecked symlinks in the index path.** `readPatternCatalog` doesn't `lstat` `catalog.json` itself. `buildPatternIndex` runs `mkdirSync(dirname(output))` before the ownership check and follows a symlinked `.boxbox/cache`. The output file itself is still protected, and this is development-only.
4. **Untested branch.** The symlinked-parent-directory branch of evidence validation (`pattern-catalog.ts:116-120`) exists but has no test. Only a symlinked evidence file is tested.
5. **Case count.** No test asserts the 45-case total. Per-family kind coverage is enforced, and I counted 45 `design-only` entries.
6. **Symlink path difference.** `PLUGIN_ROOT` uses logical `pwd`. Installing the same repository through a different path (for example `/tmp` vs `/private/tmp`) makes an earlier symlink look foreign. It is skipped with a message, which is safe but may confuse.
7. **Import style.** `pattern-catalog.ts` and its test each import from `node:fs` twice, which is style only.

The pending public-integration wording in the catalog is a dated transient state, so I didn't count it.
