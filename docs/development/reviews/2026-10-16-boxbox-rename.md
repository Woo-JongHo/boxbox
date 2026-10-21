# BoxBox local naming and Codex test preparation — 2026-10-16

The user selected **BoxBox**. `product.json` remains the naming source. Core CLI, private engine, skill and plugin IDs are `boxbox`, display names are `BoxBox`, environment prefixes are `BOXBOX`, and the repository directory is `98_BoxBox`. The public installer npm name was later selected as `box-box`, as recorded below. Version remains 0.2.0.

The canonical identity synchronizer updated 145 files, moved source/release skill and launcher paths and project state, renamed the workspace, and retargeted four direct local links. The owned corpus cache moved to `~/.cache/boxbox`. Existing uncommitted work was preserved. Historical raw evidence and the two 2026-10-12 naming records retain their recorded content.

## Current measured evidence

- Full `bun run check`: 432 pass, 5 existing parser skips, 0 fail; TypeScript and installer shell checks passed. The first run lacked the npm TypeScript cache; the dependency was populated by an isolated online install before the successful rerun.
- Plugin guard: no sync drift, strict Claude plugin/marketplace validation, 13 contract/hook tests, isolated Claude Code 2.1.286 discovery (one skill, one read-only agent, three hooks), and Codex 0.162.1 installed/enabled listing passed.
- Public CLI tarball: `dist/boxbox-0.2.0.tgz`, 40,629 compressed bytes, 163,240 unpacked bytes, six files. No package was published.
- All 71 TypeScript files mechanically changed by the rename passed the read-only alignment check.
- npm `boxbox` is occupied by an unrelated existing package; version 0.2.0 was absent when checked. Neither ownership nor publication access is established. The standard shim was changed to require an explicit local engine and has no registry fallback.

## Codex test milestone

The user then directed that the immediate deliverable be a Codex plugin for another PC today. CODEX1 in `docs/plan.md` owns that work. The user explicitly rejected ZIP transfer and clarified the required entry point: `npx boxbox` must install the Codex plugin. The npm installer must carry the local engine tarball and use permanent installed paths, with no registry fallback for that nested engine. Destination installation, hook trust and a real Codex session are separate acceptance steps; they are not claimed from manifest validation.

Consumer repair evidence records HarnessAI's 11 passing plugin tests and successful layout gate, www's focused connection/preview checks, and collision-free state migration with matching content hashes. The broad www UI suite retains six pre-existing failures (seven before repairing one stale source-path fixture); no new failure was introduced.

Claude Sonnet 5 performed an independent read-only naming review and flagged the registry fallback and stale naming/pack claims. The registry fallback was removed, its refusal behavior is covered by a new test, and the current naming dates/registry status were corrected. A few reported paths/pack figures had already changed during the review; current files and fresh evidence supersede those observations. The 14 updated plugin contract/hook tests pass. The ZIP-scope Opus audit was stopped without a verdict when the user rejected ZIP transfer. Final independent review must cover the actual npm installer instead. This record does not claim a public release or full-product audit.

Full local outputs and pre-rename file snapshots: `.boxbox/cache/rename-20261016/scratchpad/`.

## Final user steering and registry identity

The user confirmed they do not own npm `boxbox` and authorized an available alternative, specifically allowing consideration of `box-box`. All three queried alternatives (`box-box`, `boxbox-plugin`, `boxbox-cli`) returned E404 on 2026-10-16. The selected public installer name is `box-box`; availability is not reservation or verified publication access. `product.json` npmName owns that registry name; private engine and plugin IDs stay `boxbox`.

The requested initial product targets are both Codex and Claude Code plugins, with Windows Codex testing today as the priority. The installer auto-detects both CLIs and offers explicit host flags. The outer candidate is prepared with UNLICENSED metadata for a test preview; it is unpublished. The current machine's `npm whoami` returned ENEEDAUTH.

The single-host npm stage passed all 437 tests with five existing parser skips, and a real npx local-tarball invocation installed into an isolated Codex home. After deleting npm cache and the staging tarball, doctor succeeded and the sample read-only check returned the expected FIXABLE result (exit 1), without project writes. Sonnet 5's read-only base installer review passed with improvements for smart quotes, failed-repair restoration, fence conversion and nested-artifact path scanning; those improvements are part of the dual-host pass. This stage does not prove the final dual-host artifact, public registry installation or native Windows execution.

## Dual-host candidate verification

- `bun run check`: **438 pass, 5 existing parser skips, 0 fail**, 1,972 assertions; TypeScript and install-shell checks passed.
- Installer suite: **5 pass, 183 assertions**. Real npx auto-selects bin `boxbox` from package `box-box` using a raw `file:` package spec. Bare absolute filenames and percent-encoded file URLs hit different npm 10 behavior; failed measurements are retained.
- Actual isolated hosts: Codex **0.162.1** installed/enabled; Claude Code **2.1.286** discovered one skill, one read-only inspector and three hooks. Initial installation and same-version repair both exited 0. Claude strict validation passed.
- Removing the npx cache and staging tarball left both permanent engines operational. Doctor passed; each sample check returned the expected FIXABLE result without project writes. The Codex host-cached launcher also passed doctor.
- Candidate `dist/installer/box-box-0.2.0.tgz`: **112,917 B, 32 files**, SHA-256 **`62cfda19a9ae0567b5c01755aa0df43949e41f81401e6641bf4e1f0f7c88e444`**. npm publish dry run passed without publishing. New installer files contain no TODOs, focused/skipped tests or unimplemented branches.

Full local outputs: `dual-host-check-final.log`, `dual-host-plugin-guard.log`, `dual-host-real-results.json`,
`dual-host-codex-cached-launcher.json`, `npm-publish-dry-run.json` and `npm-installer-worker/final-dual-host/RESULT.md`
under the scratchpad above. Native Windows execution, interactive hook trust/acceptance, npm authentication and actual public publication remain unmeasured or pending. Final Opus audit is recorded separately when complete.

## Registry-name correction

The `box-box` candidate above was superseded before publication. npm's current [package-name guidance](https://docs.npmjs.com/package-name-guidelines/)
prohibits unscoped names similar to existing packages; the [npm website issue](https://github.com/npm/www/issues/312) records that punctuation variants can return E404 while publication rejects them.
Because `box-box` normalizes to the occupied `boxbox`, the selected authorized alternative is **`boxbox-plugin`**.
Both `boxbox-plugin` and `boxboxplugin` returned E404 on 2026-10-16. Publication remains the final registry acceptance check.
Only the public installer identity and maintained text change; core IDs, engine and host behavior stay the same.
The earlier tarball and evidence remain under `box-box-superseded/`; final candidate evidence is recorded separately.

## Final boxbox-plugin candidate

The final candidate is `boxbox-plugin@0.2.0`, 113,430 B / 32 files, SHA-256 `86b16fdca7f517c5869c51fda96d15c72af2ed0646725cebb4bea87486f0be36`. The public name and core engine ID are separate. npm authentication completed as `woojongho`; the candidate remains unpublished pending the separate publication decision.

The first Opus audit passed with non-blocking follow-ups. The implementation now preserves literal JavaScript replacement sequences in paths, reports retained backup paths if repair recovery fails, uses a shell-compatible fixed Node bridge for Windows Claude commands, and names the host accurately in missing-data errors. The bridge decodes only JSON path data and never evaluates decoded code. The focused final Opus audit passed these changes and the selected npm identity. Its remaining full-check condition was subsequently resolved: `bun run check` exited 0 with **440 pass, 5 existing parser skips, 0 fail, 2,008 assertions**; the TypeScript and shell checks also exited 0.

The focused author suite passed **7 tests / 219 assertions**. New regression scenarios execute the generated Windows-Claude command through real Bash with special-character/CJK paths and spaced arguments, and preserve recovery data under five injected filesystem faults. Both actual host installations and same-version repairs were repeated against the final tarball; doctor and checks survived cache/origin removal and preserved project files. Native Windows, interactive hook acceptance, cross-version upgrades and behavior after a pinned Node installation is removed remain unmeasured.

Final evidence: `final-npm/final/readiness.json`, `check.log`, `opus-review.json`, `dual-host-real-results.json` and `publish-dry-run.json` under the scratchpad. Author correction evidence is `npm-installer-worker/final-npm/RESULT.md`. The final audit is limited to this installer candidate, not full-product release approval.
