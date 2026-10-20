# Product naming completion — 2026-10-12

## User decision and resulting identities

- Product, CLI binary, skill and deployable plugin: `boxbox`.
- npm distribution package: `box-box`.
- Display and environment-variable prefix: `BOXBOX`.
- Project state: `.boxbox`; canonical source: `skills/boxbox`.
- Repository directory: `98_Plugin` (unchanged).

The unscoped npm package `boxbox` is occupied by an unrelated AI-agent runtime bridge. npm `box-box` returned E404 during this work. That response does not establish registration or publication permission. Package and plugin publication were not performed.

## Change scope

Updated the engine, package/build metadata, binary mapping, skills, manifests, marketplaces, hooks, installer, environment variables, tests and maintained documentation. Updated the 24_HarnessAI and 99_www links, adapters and settings plus the global Codex skill link. Existing local state and corpus cache were moved by filesystem rename. No user config directory existed. Historical raw execution evidence was preserved.

This is a development identity change. Existing installations elsewhere must migrate their owned links and state explicitly; automatic backward-compatible migration is not claimed. Both distribution artifacts remain private development metadata version 0.2.0.

## Verification

- Source `bun run check`: 429 pass, 5 existing Rust/Kotlin parser skips, 0 fail; TypeScript and installer shell syntax checks pass.
- Scoped-candidate and final-package installation behavior is covered by the source artifact tests. The final tarball is `dist/box-box-0.2.0.tgz` (40,633 bytes).
- 24_HarnessAI style integration: 11 pass.
- 99_www readability integration: 2 pass.
- TypeScript alignment/import checks: 72 files, 0 misaligned groups, 0 normalization errors.
- Plugin sync drift: none; both skills validate; Claude manifest/marketplace validation passes.
- 24_HarnessAI layout: PASS. Changed-file diff whitespace check: PASS.
- Broad www UI suite has 13 failures. Reverting only the skill name in a temporary test reproduced exactly the same 13 failure names (85 pass/13 fail), separating these failures from this rename. The temporary test file was removed.
- Independent Claude Opus review: initial FAIL; unsafe document commands, stale naming TODO and migration evidence were addressed; follow-up PASS for the rename. The reviewer had only Read, Glob and Grep. This is not release approval or new native-hook acceptance.

## Evidence

Full CLI/review output and compact verification artifacts are preserved in `../24_HarnessAI/scratchpad/boxbox-rename-20261012/` (machine-local) and `.boxbox/cache/rename-20261012/` in this repository. The migration script's original and preserved copies have matching SHA-256 digests in `script-hashes.json`.

Guarded execution examples:

- `3b8f5eba-5c40-48ec-a8d9-2f361245c777`: PASS, 2 changed TypeScript files checked after the final package-name selection.
- `edd76884-e0b0-477c-8c1c-1a025039c2f8`: PASS, 1 TypeScript file checked after audit corrections.

These individual receipts do not claim full-project style approval; the separate 72-file artifact records that check. Earlier TOOL_ERROR, CHILD_FAILED, FAIL, UNSUPPORTED and NO_CHANGES receipts remain historical and are not relabeled PASS. Native hook verification is not claimed.

## Remaining boundaries

No commit, push or publish was performed. Existing CLI/internal tarball filename collision and the missing language-policy test were outside this naming change. Registration of the npm name and actual release-host acceptance remain separate release work.
