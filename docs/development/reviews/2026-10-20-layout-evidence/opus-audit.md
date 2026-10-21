# Final Opus audit: BoxBox product/development/distribution separation

**Verdict: FAIL**, on one narrow, fixable safety gap in `sync-plugin`. The relocation itself is sound: runtime and data references, product→development direction, artifact contents and the dev-skill links all check out. Fix the gap below, re-run `bun run check` and the plugin guard on the current tree, and I'd expect PASS.

**Scope:** I read the current source and tests, the layout contract, the before/after delta and the evidence files. Edits by Root Codex were still landing during the review, so findings refer to the source as it stood at the end. That includes the `@BOXBOX_VERSION@` template change, the new version-bump layout test, and the fixes for the Sonnet findings.

## Sonnet review
`sonnet-review.json` arrived during the audit. All three of its "necessary fixes" are resolved in current source:
1. `sync-plugin` no longer writes `product/` templates. It only writes `plugin/*` and the root `.claude-plugin/marketplace.json`. Templates carry `@BOXBOX_VERSION@`, and `test/layout.test.ts:29-41` covers a version bump.
2. The `<SKILL>/scripts/` paths are now `<SKILL>/engine/...` at `product/engine/report.ts:10`, `product/engine/common/hook.ts:85` and `product/rules/references/typescript-grid-template.md:189-193`.
3. The comment at `product/engine/common/hook.ts:3` now names `product/engine/hook.ts`.

## Actionable defects introduced by this refactor

**1. `sync-plugin` writes through dangling symlinks, despite the contract (Low, development tooling).**
`docs/development/layout.md:24-25` says the generator refuses "symbolic output paths rather than … writing through links". `development/tools/sync-plugin.ts` checks existence with `existsSync`, which follows links and returns false for a broken one:
- **`:64`** – the lstat symlink test is never reached for a dangling link, so it is reported as ordinary drift.
- **`:82`** – the symlink guard is skipped for the same reason.
- **`:84`** – `writeFileSync` then creates the link's target, which can be outside `plugin/`. For `plugin/scripts/boxbox`, `:86` also sets the target to mode 0755.
- **`:52`** – if `plugin` itself is a dangling link, `pluginFiles` returns `[]`. The link is not reported as unexpected, and the parent guard at `:79` is skipped.

`pack:installer` runs this sync unconditionally (`build-installer-artifact.ts:30`). It takes a pre-planted link to trigger, so the practical risk is low, but it breaks the stated guarantee. The new code already rejects live symlinks; the old code had no protection at all.
- **Fix:** use `lstatSync(p, { throwIfNoEntry: false })` for existence at `:52`, `:64`, `:79` and `:82`.
- **Test:** add a layout case with a dangling link at `plugin/README.md` and one at `plugin/`. `test/layout.test.ts` has no symlink cases today, so "rejects symlink writes" is currently untested.

**2. Stale moved paths in docs, including shipped reference documents (Low, documentation only).**
These are code spans, so the markdown-link check didn't catch them:
- `product/rules/references/charter.md:65` → `docs/design.md`, and `:69` → `docs/plan.md`.
- `product/rules/references/grammar.md:4` → `docs/reviews/…`, and `:132` → `corpus/manifest.json`.
- The charter and grammar copies ship in `plugin/skills/boxbox/references/` and in both installer payloads.
- `development/harness/README.md:59` still says `packaging/`.
- `product/engine/typescript/grid-kinds.ts:5` and `development/skills/boxbox/SKILL.md:122` say `fixtures/table-kinds.ts`; it is now `test/fixtures/table-kinds.ts`.

No approval record binds these documents (only a synthetic test ref), so editing them won't invalidate any approvals.

## Evidence status
`check-final.log` predates the current tree. It shows 455 tests and only two layout tests; the current `test/layout.test.ts` has three. The template-placeholder change and the Sonnet fixes came after that run. Re-run the full `bun run check` and the plugin guard before relying on it.

## Verified sound
- **Rule-data resolution:** `rule-data.ts` resolves `../rules/` relative to its own location. That works from source, through the dev-skill link, from a `--copy` install, and from the bundled `<pkg>/dist/cli.js`.
  - A wrong preset path is a hard failure: `approval-gate.ts:87` calls `realpathSync`, and the public-artifact test exercises it through `guide` and `format` on the installed bin.
  - The public CLI never imports `common/report.ts` or `surface.ts`, so not shipping `rules/base` has no effect on it.
- **Direction check:** `check-layout` catches relative escapes and `@/` imports, type-only imports included. No product file imports development code; installer modules import only `node:` modules and siblings that are actually shipped.
- **No leakage:** the installer outer and nested tarballs are pinned to exact file lists. They are checked for the absolute repo path, and the shipped READMEs contain no development paths.
- **Generated output:** `plugin/` regenerates from an empty folder, detects manual edits and refuses unknown files. Version stamping leaves templates untouched.
- **Dev install:** `--copy` uses `cp -RL` and leaves no links behind. Your existing link at `~/.codex/skills/boxbox/engine` resolves to the new engine.

## Optional improvements (not blocking)
- Fail when `product/plugin/` contains a file not in `PLUGIN_FILES` (`sync-plugin.ts:14-22`); today a new template would be silently left out.
- Widen `check-layout`: `.js`, `.cjs`, `.mts` and `.cts` files, `new URL()` path literals, and Windows `..\` separators.
- `CLI_VERSION` is hard-coded at `cli.ts:25` (this predates the refactor). It is a second version source next to `package.json`.
- The `ruleData` import sits above the module doc comment in `surface.ts`, `conventions.ts` and `hook.ts`, outside the aligned import table.
- `tsconfig.json` doesn't type-check `product/packages` or `product/installer` (this also predates the refactor).

## Not measured
- With Read/Glob/Grep I couldn't read the link targets of `development/skills/boxbox/{engine,rules}`. Run `readlink` to confirm they are relative. Absolute targets would break on a fresh clone, in CI, and after a `sync-product` root rename.
- Windows clones without symlink support would break the dev-skill links.
- The dev tools assume `/` separators (`sync-plugin.ts:55` uses `join` but compares against `/` keys).
- Native Windows and interactive host sessions remain separate checks, as the contract states.

**FAIL**
