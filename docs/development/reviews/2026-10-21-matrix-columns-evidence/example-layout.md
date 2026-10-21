# Example interface matrix layout

## Scope and authorization

Only `product/engine/common/examples.ts`, the `Example` interface, was edited. The user explicitly requested moving exceptional type shapes below the regular column-sharing rows. This was a local Refactor edit; it does not create an approval receipt or public preset. The pre-edit snapshot includes earlier `sectionText` / `sectionHash` changes and preserves them byte for byte. Text outside `Example` was checked byte-identical before/after.

## Change

The 16 scalar/list/reference members stay in their original relative order and share minimum-width colon/semicolon columns. The nested object-valued type members `asserts` and `source` move to the bottom, each in a separate paragraph. Their nested properties are expanded onto separate lines with their own columns. Every public field name, optional marker, readonly modifier, string union, and referenced type is preserved. No type aliases, runtime declaration movement, functions, imports, rules, or presets were added.

For `Example` alone, maximum display width falls from **168 to 71 columns** with a four-column tab stop; physical lines increase from 20 to 30. The compact main table ends at column 63 (one-based); the longest nested source row ends at column 71. See `layout-metrics.json` and `change.diff`.

## Product workflow evidence

Before authoring, the real isolated installed 0.2.4 launcher ran `guide --authoring --json` and `check --json` on the actual repository file. Guidance contains the existing source-file call-declaration preset, not an interface rule. The prior check reported 8 groups / 0 misaligned despite the excessively wide interface. This is concrete evidence that alignment alone does not evaluate structural readability.

After the requested structural edit, the same installed launcher reports **9 groups / 0 misaligned**. The scalar main table and four-member nested `source` table are detected. The two-member nested `asserts` table is below the current type-member minimum row count and is not covered by that check; its layout was inspected directly. CLI `parse.status` remains `not-run` and no interface write approval is claimed. No raw writer or automatic Align command was used.

## Verification

- Before: `bun test test/examples.test.ts test/approval-gate.test.ts` — 22 pass, 0 fail, 56 assertions.
- After: same command — 22 pass, 0 fail, 56 assertions.
- `bunx tsc --noEmit` — exit 0, no diagnostics.
- Type-erased JavaScript from `Bun.Transpiler({ loader: "ts" })` is byte-identical before/after (`runtime-equivalence.json`). This change has no runtime or performance effect.
- `git diff --check -- product/engine/common/examples.ts` — exit 0.
- No TODO, `test.skip`, `test.only`, `describe.skip`, or `describe.only` markers were found in the edited file.

Independent review and the full repository suite are owned by the parent task and are not claimed here. Evidence files are snapshots, guide/check JSON, test logs, the type-check log, runtime equivalence, metrics, and the exact worker diff in this directory.
