Confirmed. Here is the review.

---

## Review: BoxBox product/development/test layout refactor

**Scope reviewed:** `docs/development/layout.md`, `implementation.diff`, `mapping-check.json`, `test/layout.test.ts`, `development/tools/check-layout.ts`, `development/tools/sync-plugin.ts`, `development/tools/sync-product.ts`, `development/tools/build-cli-artifact.ts`/`build-node-artifact.ts`/`build-installer-artifact.ts`, `product/engine/rule-data.ts`, `product/packages/*/package.json`, `development/install.sh`, `test/public-artifact.test.ts`, `test/installer-artifact.test.ts`, `test/plugin-contract.test.ts`, plus a full-repo grep for leftover old-layout path strings.

### Necessary fixes

**1. `development/tools/sync-plugin.ts:34-42` and `:74-91` — the generator can silently rewrite `product/plugin/` source templates, not just `plugin/` output.**

`expectedPluginFiles()` builds one `expected` map entry pair per `PLUGIN_FILES` item:

```ts
expected.set(source, text);          // source = `product/plugin/${path}`
expected.set(`plugin/${path}`, text);
```

`text` is the *version-stamped, re-serialized* form of whatever `product/plugin/<path>` currently contains (for `*.json` it's `JSON.parse` → `manifest.version = version` → `JSON.stringify(..., null, "\t") + "\n"`). `pluginDrift()` treats a mismatch between this computed `text` and the file actually on disk as drift for **either** key, and `syncPlugin()` writes `expected.get(path)` back to whichever path is in `drift` — including the `product/plugin/...` key.

Concretely: if a future contributor bumps `package.json`'s version without also hand-editing `product/plugin/.claude-plugin/plugin.json` / `.codex-plugin/plugin.json`'s `version` field (the normal, expected sequence — nothing documents that these two files must be bumped together), the next `bun run sync:plugin` (or `bun run pack:installer`, which calls `sync:plugin` unconditionally at `development/tools/build-installer-artifact.ts:30`) will overwrite the **committed source templates in `product/plugin/`**, not just regenerate `plugin/`. This directly contradicts `docs/development/layout.md:23` ("Run `bun run sync:plugin` to recreate every file in `plugin/`") and the stated "product is source of truth, development only reads it" principle. It currently doesn't manifest because `product/plugin/.claude-plugin/plugin.json`'s version (`0.2.0`) happens to already match `package.json`, and no test (`test/layout.test.ts`, `test/plugin-contract.test.ts`) exercises a version bump against these two manifest files — the only drift scenario the new `layout.test.ts` test exercises is `README.md`, whose text happens to contain no `boxbox@X.Y.Z` pattern, so it never hits this path. This is a real regeneration-safety gap, not a hypothetical: it is reachable from the normal release flow with a one-line version bump.

**2. Stale `<SKILL>/scripts/...` placeholder paths in shipped, user/agent-facing text — should be `<SKILL>/engine/...`.**

- `product/engine/report.ts:10` — the CLI's own `Usage:` banner: `bun <SKILL>/scripts/report.ts --file ...`.
- `product/engine/common/hook.ts:85` — text actually injected into the agent's post-edit hook message at runtime: `` `- … and ${fresh.length - limit} more (bun <SKILL>/scripts/report.ts --file ${report.file})` ``.
- `product/rules/references/typescript-grid-template.md:191` (and its generated copy `plugin/skills/boxbox/references/typescript-grid-template.md:191`): `bun <SKILL>/scripts/measure-layout.ts ...`.

`development/skills/boxbox/` only contains an `engine` symlink (→ `product/engine`) and a `rules` symlink (→ `product/rules`); there is no `scripts` entry, confirmed by every other usage line in `development/skills/boxbox/SKILL.md` consistently using `<SKILL>/engine/...` (e.g. line 100, 119, 164 use `<SKILL>/engine/python/06_align-tables.ts`, `<SKILL>/engine/measure-layout.ts`, etc.). These three leftovers are mechanical-rename misses: under the old layout `<SKILL>` meant `skills/boxbox`, whose `scripts/` subfolder really did contain `report.ts`/`measure-layout.ts`; after the move they live at `product/engine/...`, reachable from an installed skill only via `<SKILL>/engine/...`. Copy-pasting the hook's own suggested command, or the usage banner, now points at a path that doesn't exist. Low functional severity (it's advisory text the agent/user could run and get "file not found"), but concrete and user-visible.

**3. `product/engine/common/hook.ts:3` — broken doc-comment reference.**

```ts
* and builds the text returned to the agent. It never touches files or processes — that is `development/tools/hook.ts`'s job.
```

`development/tools/hook.ts` does not exist (confirmed by glob). This sentence used to read `scripts/hook.ts`, meaning the sibling file now at `product/engine/hook.ts` (the one that actually touches files/processes, per `AGENTS.md`'s own module map). A find/replace of `scripts/` → `development/tools/` fired on this comment even though the referent was the engine's own `hook.ts`, not a dev tool. Comment-only, but it's exactly the kind of fidelity break the review asked about, and it's misleading to a future reader.

### Optional observations (not blocking)

- `tsconfig.json`'s `include` (`product/engine/**/*.ts`, `test/**/*.ts`, `development/harness/**/*.ts`, `development/tools/**/*.ts`) still omits `product/packages/**/*.ts` (`entry.ts`) and `product/installer/**/*.mjs`, so `bunx tsc --noEmit` (part of `bun run check`) never type-checks the npm CLI entry point or the installer platform/launcher modules. This is not a regression — the old `include` (`skills/**/*.ts`, `test/**/*.ts`, `harness/**/*.ts`) excluded `packaging/` the same way — but since `product/` is now explicitly billed as the single canonical source tree, it would be worth closing this gap rather than carrying it forward unchanged.
- `docs/development/agent-portability.md:19` still documents the retired convention ("`<SKILL>/scripts/...`") as current guidance, inconsistent with the `<SKILL>/engine/...` form actually used everywhere else post-refactor (including this same file's neighbors). Worth a follow-up pass since it isn't on the `HISTORY` exemption list in `sync-product.ts`.
- A stray, gitignored `packaging/.DS_Store` is left on disk after the directory move (harmless, not tracked, but the otherwise-empty `packaging/` directory could be deleted locally).

### What checks out (verified, not just asserted)

- **No orphaned old trees.** Globbed `skills/`, `scripts/`, `harness/`, `corpus/`, `install.sh` at repo root: all empty/absent except the gitignored `.DS_Store`; `mapping-check.json`'s `"missing": []` is consistent with what's on disk — this was a real move, not a copy that left duplicates.
- **`ruleData()` resolution is correct for both source and bundled code** (`product/engine/rule-data.ts`): `../rules/<path>` relative to `import.meta.url` resolves to `product/rules/...` when run from source, and to `<npm-package-root>/rules/...` once bundled into `dist/cli.js` and installed (matching `product/packages/cli/package.json`'s `files` allowlist `rules/presets/recommended/...` sitting beside `dist/cli.js`). This relies on Bun's bundler leaving `import.meta.url` as a runtime reference rather than constant-folding it, which is Bun's documented bundling behavior; I did not execute the build to confirm at runtime.
- **The Node "internal-runner" artifact correctly excludes rule data.** `product/packages/node/package.json`'s `files` list has no `rules/`, which is correct because `internal-runner.ts`'s dependency chain (`align-cli.ts` → `table-engine.ts`) never reaches `common/surface.ts`/`common/report.ts` (the only `ruleData()` consumers besides `cli.ts`/`hook.ts`/`conventions.ts`) — verified by tracing imports, not by running the bundler's own forbidden-reference check.
- **`development/tools/check-layout.ts` is a real static-import/alias boundary check**, not a placeholder: it flags both `@/` repository-alias usage and relative imports that resolve outside `product/`, matches `docs/development/layout.md`'s claim about static imports/re-exports/dynamic import/require (Bun's `Transpiler.scanImports` documents `require-call` detection), and `test/layout.test.ts` exercises both violation kinds plus the full plugin regeneration/drift/refusal lifecycle (missing `plugin/`, source edit propagation, manual output-edit detection, unexpected-file refusal without deletion). I did not execute `bun test`/`bun run check:layout`; this is based on reading the implementation and manually grepping for real escapes (found none).
- **`development/skills/boxbox/engine` and `.../rules` are live symlinks into `product/engine`/`product/rules`**, confirmed by reading through them (not by trusting the doc). `development/install.sh --copy` uses `cp -RL` (changed from plain `cp -R` in this diff), which correctly dereferences those two symlinks into a self-contained copy without pulling in `test/fixtures` or `docs/development`, matching the documented contract.
- **Package allowlist tests genuinely validate installed artifacts, not just string lists.** `test/public-artifact.test.ts` runs `bun run build:cli`, `npm pack`, `npm install --offline` into a real temp project, then exercises the installed `boxbox` bin end-to-end (init/doctor/run/status/db/check/format) against the real installed file tree and asserts the bundle contains no forbidden runtime references. `test/installer-artifact.test.ts` similarly builds the real installer tarball, extracts it with `tar`, and asserts on the actual extracted file list and behavior (including a nested `npm pack`/`tar -tzf` check on the embedded engine tarball). These are real artifact assertions, not mocks.

### Verdict

**FAIL** — not for structural/directional defects (the product/development/test split, the dependency-direction check, and the symlink dev-install story are sound and verified), but because of one concrete regeneration-safety defect (sync-plugin can overwrite its own source templates on an ordinary version bump, reachable from the documented release pipeline) and three concrete shipped-text path breaks (`<SKILL>/scripts/...` in the CLI usage banner, the live hook message, and the TypeScript grid template reference) that are clean, mechanical fixes but are not yet made. Once #1–#3 above are addressed, I'd expect this to pass.
