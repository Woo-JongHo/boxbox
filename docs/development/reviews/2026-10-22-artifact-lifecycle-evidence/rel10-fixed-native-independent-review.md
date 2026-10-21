# Independent review — fixed 1f native lifecycle evidence

Date: 2026-10-22
Mode: read-only evidence review; no harness, host, profile, source, or documentation mutation

## Verdict

**PASS with two evidence-quality advisories and no mandatory finding.**

The six reports support the bounded claim made in `rel10-fixed-native-report.md`: four real-host core lifecycle cells passed for the exact unpublished local `1f1343e9…` archive, and two Linux/WSL HUD configuration-ownership cells passed. They do not support and do not claim UI rendering, model/authentication, hook delivery/trust, Windows HUD, CI provenance, publication, or release completion.

## Identity and evidence integrity

- All 12 compact lifecycle/summary files match `rel10-fixed-compact-hashes.txt`.
- Current archive identity is consistently 263,448 bytes and SHA-256 `1f1343e91d2799998884ed5d75e1a26d7858226d2f9f51f07621bfeedaf6ecd3`.
- WSL `sha256sum` and native PowerShell `Get-FileHash` records independently report those same bytes and digest.
- The previous fixture remains `f07df7…` version 0.2.3. Every core lifecycle binds current and previous digests before execution and again through transition/final artifact checks.
- All four core JSON files self-record harness SHA-256 `292b730c…`, matching the frozen repository verifier. The native Windows launch scripts additionally hash the verifier and both archives before starting.
- The WSL HUD runner invokes the staged `release-hud-lifecycle-73da.mjs`; the current repository HUD verifier hashes to `73da0018…`. Each HUD report binds both archive digests and both installed setup-script digests.

The reports correctly label `1f1343e9…` as a dirty-worktree, local, unpublished candidate. None transfers the old `bec626…` CI identity or claims that this archive was CI-produced.

## Core lifecycle results

The platform separation is accurate:

- WSL cells record `platform: linux`, x64, Ubuntu/WSL host paths and Codex 0.163.0 or Claude 2.1.280.
- Native Windows cells record `platform: win32`, Windows paths and Codex 0.157.1 or Claude 2.1.280.
- The report does not relabel WSL as native Windows.

All core reports have `ok: true`, no command outside `passed` or expected `observed`, the expected command totals, and the frozen core harness digest:

| Cell | Commands | Passed | Expected observed | Preservation checkpoints | Preserved files |
|---|---:|---:|---:|---:|---:|
| WSL Codex | 110 | 107 | 3 | 21 | 9 |
| WSL Claude | 93 | 91 | 2 | 18 | 9 |
| Windows Codex | 110 | 107 | 3 | 21 | 9 |
| Windows Claude | 93 | 91 | 2 | 18 | 9 |

The command records substantiate:

- fresh 0.2.3 registration and installed engine doctor/check/format/recheck/fixed-point behavior;
- expected cold-cache 0.2.4 offline failure with the old registration and engine still usable;
- warm-cache same-version repair;
- Codex direct upgrade/rollback collision, retained prior state, then explicit host removal and documented install;
- Claude direct 0.2.4 acceptance, including the 51.644-second WSL command followed by separate plugin/marketplace/engine identity checks;
- Claude rollback through the explicit `--manual-rollback` remove/reinstall path, rather than a claim that the immutable 0.2.3 installer supports the repaired direct transition;
- final plugin and marketplace absence in every cell;
- version roots retained and inventoried rather than described as product filesystem uninstall.

Every preservation checkpoint reports host settings preserved. The preserved set covers project config, the retained approved fixture, unrelated project data, and version-local user sentinels. Both version roots remain present in each residue inventory, matching the report's removal limitation.

## HUD configuration results

Both HUD reports have `ok: true`, exact current/previous archive bindings, exact installed setup-script bindings, and no unexpected command state.

- WSL Codex: 10 commands, four expected exit-1 ownership refusals, final launcher absent, unrelated bin/config/data preserved.
- WSL Claude: eight commands, four expected exit-1 ownership refusals, owned state removed, unrelated settings preserved, backup retained.

Inventory deltas are restricted to the declared launcher or Claude settings/HUD data roots. Refusal commands record empty inventory deltas. The reports explicitly limit this to configuration ownership and exclude host/UI/tmux/model/hooks/trust acceptance and Windows HUD.

## Advisories

1. Five WSL core command entries have negative `durationMs` values (one Codex, four Claude), consistent with wall-clock adjustment during the run. The ISO start/finish interval and the report's total durations remain ordered, and no acceptance decision depends on those individual negative timing values. Do not use the affected per-command duration fields as performance evidence.
2. The HUD lifecycle schema does not self-record the HUD verifier digest. The staged filename, WSL runner, local frozen verifier hash, archive bindings, setup-script bindings, and exact output sequence provide a coherent chain for this run, but future durable evidence would be stronger if the HUD JSON recorded its own verifier SHA-256 as the core schema does.

Neither advisory changes the lifecycle, identity, preservation, refusal, removal, or scope verdict.

## Files reviewed

- `/tmp/boxbox-readiness/rel10-fixed-native-report.md`
- `/tmp/boxbox-readiness/rel10-fixed-compact-hashes.txt`
- four compact `lifecycle.json` files and their command stdout/stderr logs
- two compact `hud-lifecycle.json` files and their command stdout/stderr logs
- all six compact `summary.json` files and console logs
- WSL/native Windows archive hash records
- WSL core/HUD runners and native Windows launch scripts
- frozen local core and HUD verifier byte hashes
