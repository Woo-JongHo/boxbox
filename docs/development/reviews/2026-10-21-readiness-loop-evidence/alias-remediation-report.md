# READINESS1 R1 independent-review remediation

Date: 2026-10-21
Review source: `/tmp/boxbox-readiness/r1-review.json`

## Verdict addressed

The Sonnet review was BLOCKED by an uninstall data-loss path: a stale sibling `.boxbox-managed` file authorized recursive removal of a user-owned directory. The installer no longer trusts marker existence alone.

## Changes

- Managed copied directories receive a random identity in both the directory's `.boxbox-managed` file and its sibling marker. Replacement and uninstall require an exact match and the `directory:` marker kind.
- Managed copied files record a `file:<sha256>` sibling marker. Replacement and uninstall require the current file hash to match, so user-edited copies survive.
- Installer-created symlinks are replaceable/removable only when `readlink` still equals the exact source used for that target. Foreign and dangling symlinks are skipped.
- Valid managed copies refresh safely. Stale markers and replaced user directories are skipped during both install and uninstall.
- Copy-mode dependency validation runs before any destination is placed. Missing or version-mismatched dependencies leave no target or marker.
- All pinned root runtime dependencies are verified against `package.json` and copied. This currently includes `typescript@7.0.2` and `yaml@2.9.1`; the installed TypeScript platform package is also copied.
- The isolated copy test imports both TypeScript and YAML, compares their installed versions with root `package.json`, resolves an `@/` import and runs the TypeScript AST engine outside repository ancestry.
- The invalid-alias fixture now includes a missing dynamic import.

## Regression coverage

- stale sibling marker plus user-owned directory: install and uninstall both preserve `owner.txt`;
- missing pinned dependencies: exit 1 before target or marker creation;
- foreign symlink: link install and uninstall preserve its target;
- valid managed directory: a second copy refresh removes a sentinel and creates a new matched identity;
- edited managed file: refresh and uninstall preserve the edited file;
- installed TypeScript and YAML versions derive from `package.json`, with no hardcoded assertion;
- invalid static and dynamic aliases, lexical escape and symlink target remain rejected.

## Verification

```text
bun test test/alias-portability.test.ts test/install-lifecycle.test.ts test/layout.test.ts --timeout 60000
14 pass / 0 fail / 90 expect calls

bash -n development/install.sh
PASS

bun development/tools/check-layout.ts
product dependencies: PASS

bunx tsc --noEmit -p development/skills/boxbox/tsconfig.json
PASS

git diff --check -- <owned paths>
PASS

placeholder scan in changed files
no matches
```

Raw logs:

- `/tmp/boxbox-readiness/alias-remediation-tests.log`
- `/tmp/boxbox-readiness/alias-remediation-layout.log`

No engine import migration, package builder edit, user-profile mutation or full repository build was performed.
