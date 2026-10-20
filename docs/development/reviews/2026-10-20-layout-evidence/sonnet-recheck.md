Reviewed the three necessary findings from `sonnet-review.md` against current source (read-only, no commands executed):

**#1 (sync-plugin overwrites product templates on version bump)** — Closed. `development/tools/sync-plugin.ts:34` keeps `source` only as a read path; `expected.set(source, text)` is gone — the map now has only `plugin/${path}` keys, the four `references/*` keys, and the root `.claude-plugin/marketplace.json` key. No path under `product/plugin/` is ever written by `syncPlugin`. `test/layout.test.ts:29-41` exercises exactly this scenario (bumps to `9.8.7`, runs `syncPlugin`, asserts the two `product/plugin/*/plugin.json` templates and the two `product/packages/*/package.json` templates are byte-identical to their originals while the generated `plugin/.claude-plugin/plugin.json` / `plugin/.codex-plugin/plugin.json` show `9.8.7` and `pluginDrift` is empty). The templates themselves now hold `"version": "@BOXBOX_VERSION@"` (both plugin.json files, both package.json files), and `build-cli-artifact.ts:16-18` / `build-node-artifact.ts:17-19` independently stamp their generated `dist/*/package.json` from root `package.json`'s version — consistent with the fix description.

**#2 (`<SKILL>/scripts/...` leftovers)** — Closed. `product/engine/report.ts:10` and `product/engine/common/hook.ts:85` now read `<SKILL>/engine/report.ts`; `product/rules/references/typescript-grid-template.md:189-193` now reads `<SKILL>/engine/measure-layout.ts` with an added note that this command is development-skill-only. A repo-wide grep for `<SKILL>...scripts` and for the specific `scripts/{report,measure-layout,hook}.ts` strings finds matches only in archival/history docs (`docs/development/reviews/2026-10-07-*`, old plan docs, the `sonnet-review.md` itself) — none in shipped/current text.

**#3 (hook.ts doc-comment referencing nonexistent `development/tools/hook.ts`)** — Closed. `product/engine/common/hook.ts:3` now correctly says "that is `product/engine/hook.ts`'s job," and `development/tools/hook.ts` does not exist (confirmed).

Agent-portability doc (`docs/development/agent-portability.md:19`) now also says `<SKILL>/engine/...`, matching the rest of the doc.

No new defects introduced by these fixes within the reviewed scope. Packaging type-check omission and hardcoded CLI_VERSION are confirmed still out of scope as stated, untouched.

**PASS** on the three necessary findings — all three are substantively and correctly closed, with a real regression test (not executed by me) covering the regenerate-on-version-bump case.
