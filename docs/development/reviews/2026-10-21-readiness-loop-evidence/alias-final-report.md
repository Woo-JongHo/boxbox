# Final engine source-alias migration report

Date: 2026-10-21

## Applied migration

The frozen engine was snapshotted byte-for-byte under `final-before/`. The TypeScript 7 AST inventory was regenerated from that frozen tree; no prior mirror was reused.

Final pre-application inventory:

- engine files scanned: 77;
- relative static/dynamic module specifiers: 170;
- engine-internal module specifiers converted to `@/`: 169;
- retained static module exception: 1;
- runtime `new URL(..., import.meta.url)` paths retained: 3.

The only retained static module import is:

```text
product/engine/typescript/layout-policy.ts
../../rules/base/typescript-layout.json
target: product/rules/base/typescript-layout.json
```

The retained runtime URL paths are:

```text
product/engine/hook.ts       ./report.ts
product/engine/report.ts     ./${language}/06_align-tables.ts
product/engine/rule-data.ts  ../rules/${path}
```

The generated patch changed module-specifier string interiors only. It covered 57 files and was applied only after `git apply --check` passed.

## Normalization and alignment

All 57 files containing migrated aliases were passed individually through:

```text
bun product/engine/typescript/00_normalize-imports.ts --write <file>
bun product/engine/typescript/06_align-tables.ts --file <file> --write
```

Import normalization changed 39 files and reported zero errors. The aligner processed 57 files, found 59 misaligned groups and applied 227 whitespace edits.

Three pre-existing structural groups were refused because the proposed aligner edit would change more than whitespace between tokens:

- `product/engine/kotlin/profile.ts:40-43`;
- `product/engine/rust/profile.ts:82-86`;
- `product/engine/swift/profile.ts:43-46`.

They were left unchanged, as required. There were no compressed-body findings. The `TODO` scaffold string in `product/engine/typescript/08_function-map.ts:103` also predates the migration, is emitted intentionally by the function-map scaffold command, and was not introduced or altered.

## Enforced boundary

`development/tools/check-layout.ts` now rejects every relative AST module import from `product/engine` unless it is the exact `typescript/layout-policy.ts` rules-data exception above. It distinguishes engine-internal imports that must use `@/` from imports that escape the engine alias root. Runtime URL strings are outside the module-import scanner and retain their file semantics.

Tests cover:

- mapped aliases;
- an engine-internal relative import;
- a relative module escaping the engine root;
- the exact rules JSON exception;
- missing static and dynamic aliases;
- lexical escape and symbolic target rejection.

## Post-migration inventory

The AST migration inventory was rerun against the resulting tree:

```text
files=77
relative module specifiers=1
convertible engine-internal relatives=0
retained static exceptions=1
runtime URL paths=3
```

Full machine record: `final-leftovers.json`.

## Verification

```text
bun development/tools/check-layout.ts
product dependencies: PASS

bun test test/layout.test.ts test/alias-portability.test.ts --timeout 60000
11 pass / 0 fail / 69 expect calls

bunx tsc --noEmit
PASS

git diff --check -- product/engine development/tools/check-layout.ts test/layout.test.ts test/alias-portability.test.ts
PASS
```

A newly copied development skill was installed into a temporary home. From an unrelated temporary project, its migrated engine ran checks for all three first-release source families:

- TypeScript: syntax valid via TypeScript, one expected misaligned group;
- JSON: syntax valid via `JSON.parse`;
- YAML: syntax valid via `yaml@2.9.1`.

The full transcript is `final-copy-execution.log`. The repository was not renamed, and no official artifact builder was run; the parent integration pass owns full builds after packaging is ready.

## Evidence files

- `final-inventory.json` — frozen pre-application AST inventory;
- `final-before/` — source snapshot before migration;
- `final-apply.patch` — exact applied string-literal patch;
- `changed-files.txt` — 57 migrated files;
- `import-normalizer.log` — per-file normalization;
- `align-files.log` — per-file alignment and explicit refusals;
- `final-leftovers.json` — post-migration AST inventory;
- `final-copy-install.log`, `final-copy-execution.log` — isolated copied-skill evidence;
- `final-verification.log` — layout, targeted tests, tsc and diff check.

## Windows containment follow-up

The final review found that native `path.relative()` may return backslash-separated escape paths on Windows. The layout checker now routes every lexical, physical and product-destination relative result through one segment-aware classifier that normalizes `\\` to `/`, rejects traversal above the root, and accepts an explicit native absolute-path signal for cross-drive results. Alias ancestor traversal also stops and refuses when `dirname(cursor) === cursor`, so it cannot loop at a filesystem root.

Focused coverage verifies a normal Windows relative path, a `..\\` escape, an embedded traversal that crosses the root, and a cross-drive absolute result. Final follow-up verification:

```text
bun test test/layout.test.ts --timeout 60000
6 pass / 0 fail / 43 expect calls

bun development/tools/check-layout.ts
product dependencies: PASS

bunx tsc --noEmit
PASS

git diff --check -- development/tools/check-layout.ts test/layout.test.ts
PASS
```

Evidence: `windows-path-verification.log`, `windows-align-checker.log`, and `windows-align-test.log`.
