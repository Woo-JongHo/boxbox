# EggBox naming implementation — 2026-10-12

## Confirmed naming

The user selected **EggBox** as the final display name. npm package, CLI binary, skill, plugin, paths and configuration directories use lowercase `eggbox`; environment variables retain the uppercase `EGGBOX_` prefix. Version remains 0.2.0. The existing uncommitted implementation was retained.

## Scope

Renamed canonical source to `skills/eggbox`, release skill to `plugin/skills/eggbox`, launcher to `plugin/scripts/eggbox`, and project state to `.eggbox`. Updated code, tests, import aliases, package/lock metadata, manifests, marketplaces, hooks, installer and maintained documents. The owned global Codex skill link and corpus cache were relocated. Updated direct 24_HarnessAI and 99_www adapters, discovery links and project state. Historical raw evidence and the earlier [boxbox migration record](2026-10-12-boxbox-rename.md) retain their recorded names.

Local distribution artifacts: `dist/eggbox-0.2.0.tgz` and `dist/eggbox-plugin-0.2.0.tar.gz`. The package remains private development metadata. No commit, push, registry publish or public release was performed.

## Verification

- `bun run check`: 429 pass, 5 existing Rust/Kotlin parser skips, 0 fail; TypeScript and installer shell syntax checks passed.
- Plugin guard: sync drift absent; Claude strict manifest and marketplace validation passed; 13 contract/hook tests passed; isolated Claude installation discovered one skill, one read-only agent and three hooks; isolated Codex installation reported `eggbox@eggbox-plugins` installed and enabled.
- Final display metadata was validated again after the user chose EggBox capitalization; final contract/hook rerun: 13 pass; isolated Node/public CLI artifact rerun: 2 pass.
- npm `eggbox` returned E404; this does not establish name reservation or publication access.
- 24_HarnessAI integration: 11 pass; layout check passed. 99_www targeted integration: 2 pass.
- A broad read-only TypeScript alignment scan covered 139 files. Two rename-induced artifact-test width differences were fixed. One existing mismatch in `skills/eggbox/scripts/python/profile.ts` is outside this content change and was left intact. Historical 72-file verification is not reused as current proof.
- The 69 TypeScript files whose content changed pass alignment and import normalization (0 changed imports, 0 import errors). The initial import-check invocation used an unsupported `--file` flag; the corrected positional-file invocation is recorded in `imports.log`.
- Checked TODO and skipped-test occurrences: existing function-map scaffolding and parser-dependent skips remain; no new placeholder implementation or test skip was added.

## Review and release boundaries

Independent Claude Opus final audit was attempted with Read, Glob and Grep only. It did not run: session limit, resetting at 14:00 Asia/Seoul. No lower model replaced it. **Final independent audit is an unexecuted blocker**, not a PASS.

The existing internal Node artifact and public CLI templates share a package name and can collide if packed into the same destination; only the public CLI was packed here. Publishing, release-host execution through the published npm shim, license/channel decisions and the proposed management/deployment infrastructure remain separate work. Host installation acceptance above does not prove a real model session invoked every hook or a registry-backed shim.

## Evidence

Full machine and review output: `.eggbox/cache/rename-20261012/`. These ignored local files contain the full check, package, plugin guard, integration and attempted Opus review logs.
