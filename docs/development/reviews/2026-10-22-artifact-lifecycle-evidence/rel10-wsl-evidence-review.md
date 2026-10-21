# Independent evidence review — REL10 WSL lifecycle cells

Date: 2026-10-22  
Mode: read-only static review of copied evidence. No remote command, install, mutation, cleanup, or repository edit was performed.

Reviewed:

- `/tmp/boxbox-readiness/rel10-wsl-codex-pass/lifecycle.json`, `summary.json`, console and 110 stdout/stderr pairs
- `/tmp/boxbox-readiness/rel10-wsl-claude-failure/lifecycle.json`, `summary.json`, console and 45 stdout/stderr pairs
- `/tmp/boxbox-readiness/rel10-remote-lifecycle-report.md`
- the frozen harness binding recorded in both lifecycle reports and the previously reviewed harness contract

## Verdict

**PASS for evidence classification and report accuracy — mandatory findings: 0.**

The copied records support a bounded Ubuntu 24.04.4 WSL2/Linux x64 Codex 0.163.0 core-lifecycle PASS and a distinct Claude 2.1.280 terminal FAIL at post-transition plugin identity. The remote report does not promote the Claude failure, Windows incomplete cell, launch history, or either WSL result beyond its measured scope.

## Local evidence integrity

- Both lifecycle files parse and all referenced stdout/stderr files are present.
- Local copied digests match the remote report:
  - Codex lifecycle `bc41f98bcd87a18942c1ede1264f5ef4ceabbdc193dc882d057b44fe350b8eae`;
  - Codex summary `1eb1805cff5b0bcb8cb21f9a97b4deb46139741560996dcf71d0c6ea22d7903c`;
  - Claude lifecycle `e3a542d06ac19aa7aa30cc7c684cc4a862d9f4cd907c2b7e4acbb1b55affd087`;
  - Claude summary `a85c786db7b095b0148cdc8543346f9c887ebd90779272a64069cf37701f9a28`.
- Both reports bind harness SHA-256 `1b8a197be252133fb5792194d74f80e43a227c8feb747dc8a69998afb0a4ef49`, the same frozen harness reviewed before execution.
- Embedded artifact gates consistently bind historical fixture 0.2.3 `f07df7ad…` and unpublished CI candidate 0.2.4 `bec62643…` at each applicable stage.
- The remote WSL archive files and final workspace contents were not copied locally, so this review did not independently rehash those remote files live. It verifies the copied lifecycle's repeated digest records, command logs, source binding and report consistency. It does not turn embedded remote hashes into a fresh local archive rehash.

## WSL Codex cell

The Codex lifecycle is terminal `ok: true`: Linux x64, Node 22.22.3, npm 10.9.8, real `codex-cli 0.163.0`, 110 commands, 107 passed and three intentionally observed failures.

Raw logs support:

1. initially empty isolated plugin and marketplace listings;
2. fresh 0.2.3 enabled registration at the exact isolated 0.2.3 plugin/root;
3. doctor and repeated approved TypeScript check → dry-run → apply → recheck → idempotent apply journeys;
4. fresh-cache `npm_config_offline=true` failure with `ENOTCACHED` for TypeScript, followed by unchanged 0.2.3 registration and usable engine;
5. warm-cache offline 0.2.3 repair;
6. exact Codex marketplace collision on direct 0.2.3 → 0.2.4, unchanged prior registration/engine, documented exact plugin/marketplace removal, then 0.2.4 registration/root/version and engine;
7. warm-cache offline 0.2.4 repair;
8. symmetric collision and preserved 0.2.4 state on rollback, documented removal and exact 0.2.3 reinstall;
9. final exact plugin/marketplace removal with empty JSON listings.

The report records 12 artifact checks, 21 preservation checks, nine retained user/project files, and both version directories as residue (605/606 inventory entries). This is host unregistration plus honest manual-cleanup residue, not filesystem uninstall.

The PASS is scoped to a Linux process under Ubuntu WSL2. It is not hosted CI, native Windows, HUD/hook/auth/model acceptance, or publication evidence.

## WSL Claude cell

The Claude lifecycle is correctly terminal `ok: false`: Linux x64, Node 22.22.3, npm 10.9.8, real Claude Code 2.1.280, 45 commands, 43 passed and two observed commands. The enclosing semantic assertion failed with:

`Host retained the wrong plugin version: '0.2.3' !== '0.2.4'`.

Raw evidence supports only the completed prefix:

- fresh 0.2.3 registration/root and engine journey passed;
- cold dependency-cache failure retained the prior registration and engine;
- warm-cache 0.2.3 repair passed;
- the direct 0.2.4 installer returned zero;
- plugin JSON still reported version/cache 0.2.3 while marketplace JSON pointed at permanent root 0.2.4;
- the harness stopped at that first identity mismatch.

It did not unregister, run `plugin update`, patch host data, retry, rollback, finish removal, or establish a current-version engine journey. Both version directories were retained and the report records eight preserved files. Therefore this is a reproducible Claude transition failure, not a partial lifecycle PASS and not evidence that old code necessarily executed.

The WSL result is consistent with the separately measured macOS Claude mismatch, but it remains its own Claude 2.1.280/Linux observation.

## Launch history and other cells

The report says the first Codex launcher attempt exited before creating an output directory, console, status file or descendants, and the actual product cell used a new output directory after changing the background-launch mechanism. No corresponding failed lifecycle report or product command stream exists in the copied packet. Treating this as launch history rather than a BoxBox product failure is correct.

That absence claim itself was not independently reconstructed from the remote filesystem in this static review. It cannot add positive product evidence, and it does not weaken the completed `wsl-codex-02` record.

The native Windows Codex incomplete cell and Windows Claude not-started state were not audited as WSL results. The remote report keeps them separate and does not claim lifecycle success for either.

## Claim boundaries

Acceptable current statements are:

- “The exact archived inputs completed the bounded core lifecycle with real Codex 0.163.0 in Ubuntu WSL2/Linux.”
- “Claude 2.1.280 in Ubuntu WSL2 reproduced the stale plugin-version/cache record after the marketplace moved to the new root; the lifecycle stopped and failed.”
- “The first Codex launch attempt was orchestration history with no recorded product execution.”

Do not state that these records prove native Windows, hosted CI lifecycle, Claude update success, HUD/hooks/trust/authentication, filesystem uninstall, release approval, or that the historical 0.2.3 fixture was a release.
