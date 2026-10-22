# REL10 remote real-host lifecycle execution

Date: 2026-10-22 KST  
Harness SHA-256: `1b8a197be252133fb5792194d74f80e43a227c8feb747dc8a69998afb0a4ef49`  
Artifacts: 0.2.3 `f07df7ada9aa234c2935ed500b4fe15b1a5d53f7b7a6de7d8ec107f53c8f572c`; CI 0.2.4 `bec626435e525c2d7324d156f85d2c114427d875725abcecb42fed561b2b92be`.

## Results

| Platform / host | Result | Commands | Key boundary |
|---|---:|---:|---|
| Ubuntu 24.04.4 WSL2 / Codex 0.163.0 | **PASS** | 110 | Full exact-artifact lifecycle completed; final host registration absent and both version directories retained. |
| Ubuntu 24.04.4 WSL2 / Claude 2.1.280 | **FAIL, retained** | 45 | Direct upgrade installer returned zero, but host JSON still reported plugin version 0.2.3; harness stopped without update/recovery. |
| Native Windows 11 / Codex 0.157.1 | **INCOMPLETE, retained** | 8th command | `plugin remove --help` did not return; harness's intended 180-second child timeout did not unwind the WSL interop bridge. No retry or cleanup performed. |
| Native Windows 11 / Claude 2.1.280 | **NOT STARTED** | — | Windows Codex pending process state and known Claude metadata issue were kept separate; no additional native cell was started. |

No live profile, authentication, model, hook, trust, or HUD state was used. Each started lifecycle used its own harness-created isolated workspace and host profile.

## WSL Codex PASS

Remote output:

```text
/tmp/boxbox-rel10-linux.VfqJoi/wsl-codex-02/lifecycle.json
```

The first launch attempt named `wsl-codex-01` did not execute the harness: the background launcher PID exited immediately and created no console, output directory, status file, or descendant. The launch mechanism was changed from `nohup` to `setsid bash`, and the actual cell used the new unique output `wsl-codex-02`. This is launch history, not a lifecycle failure or retry of product actions.

Measured result:

- `ok: true`, exit 0.
- Platform `linux`, x64, Node `v22.22.3`.
- Host `codex-cli 0.163.0`; npm `10.9.8`.
- Duration 31,677 ms.
- 110 commands: 107 passed, 3 expected/observed transition or cold-cache commands, 0 failed.
- 12 archive digest gates.
- 21 preservation checks; 9 retained user/project files.
- Previous residue present with 605 inventory entries; current residue present with 606.

The lifecycle proved:

1. initial real-host absence;
2. fresh exact 0.2.3 install, registration identity/root/version, init, doctor, approved TypeScript check/dry-run/apply/recheck/idempotence;
3. exact 0.2.4 cold-cache offline failure as `ENOTCACHED` for TypeScript, with no current partial root and prior registration/engine preserved;
4. warm offline 0.2.3 repair;
5. direct upgrade collision with prior registration and engine retained, then documented exact plugin/marketplace removal and exact 0.2.4 install;
6. warm offline 0.2.4 repair;
7. direct rollback collision with current registration and engine retained, then documented removal and exact 0.2.3 reinstall;
8. final exact plugin/marketplace removal while both permanent version directories and preserved data remain.

Compact local evidence:

```text
/tmp/boxbox-readiness/rel10-wsl-codex-pass/
```

It contains `lifecycle.json`, a reduced `summary.json`, 110 bounded stdout/stderr pairs, and console output. Hashes:

- full lifecycle JSON: `bc41f98bcd87a18942c1ede1264f5ef4ceabbdc193dc882d057b44fe350b8eae`;
- compact summary: `1eb1805cff5b0bcb8cb21f9a97b4deb46139741560996dcf71d0c6ea22d7903c`.

No remote workspace/node_modules payload was copied locally.

## WSL Claude retained failure

Remote output:

```text
/tmp/boxbox-rel10-linux.VfqJoi/wsl-claude-01/lifecycle.json
```

Measured result:

- `ok: false`, process exit 1.
- Host `2.1.280 (Claude Code)`; npm `10.9.8`.
- Duration 94,863 ms.
- 45 commands: 43 passed, 2 observed, none marked command-failed; the enclosing identity assertion failed.
- 6 archive digest gates.
- 7 preservation checks; 8 retained files.
- Both previous and current version directories are present (606 inventory entries each).
- Exact error: `AssertionError [ERR_ASSERTION]: Host retained the wrong plugin version`.

Fresh 0.2.3, cold-cache offline preservation, and warm same-version repair passed. The direct 0.2.4 installer attempt exited zero and the marketplace listing command passed, but subsequent host state still identified the installed plugin as 0.2.3. The harness stopped at this first semantic failure. It did not unregister, update, manually patch host state, retry, or clean the workspace.

A separate read-only isolated prerequisite command confirmed Claude 2.1.280 provides `plugin update --help` with `--scope`, `--json`, `-y`, and `--accept-command`; no update command was executed.

Compact local evidence:

```text
/tmp/boxbox-readiness/rel10-wsl-claude-failure/
```

Hashes:

- full lifecycle JSON: `e3a542d06ac19aa7aa30cc7c684cc4a862d9f4cd907c2b7e4acbb1b55affd087`;
- compact summary: `a85c786db7b095b0148cdc8543346f9c887ebd90779272a64069cf37701f9a28`.

This independently reproduces the same stale plugin-version record seen on macOS Claude 2.1.286, while remaining a distinct Claude 2.1.280/WSL observation.

## Native Windows Codex retained incomplete cell

Output root:

```text
C:\Users\woo\AppData\Local\Temp\BoxBox-rel10-7b25a75cbb5446069c3e3bfa5b464a4c\win-codex-01
```

The cell measured Node `v24.12.0`, npm `11.6.2`, and `codex-cli 0.157.1`, then reached command 8, real `codex plugin remove --help`. The command record remains `state: running`; no stdout/stderr file exists because the synchronous child never returned to the harness writer. More than 180 seconds elapsed despite the harness timeout setting.

Owned-process inspection before any cleanup found:

- WSL interop bridge PID 22226, `/init ... cmd.exe /d /c ...\run-codex.cmd`, sleeping;
- no WSL child PID under 22226;
- no native Windows `node.exe`, `codex.exe`, or `cmd.exe` command line containing the owned `win-codex-01` or harness path;
- no cell exit file;
- the console file is empty.

The WSL bridge remained sleeping after the apparent native child disappeared, so neither timeout completion nor product behavior can be claimed. No signal, process cleanup, retry, manual help probe, install, or configuration recovery was performed. The partial lifecycle JSON was copied to:

```text
/tmp/boxbox-readiness/rel10-windows-codex-partial-lifecycle.json
```

SHA-256: `eb7ffbaa13e813dd78b208dba2fb14061d4c290504d1abe4a55193344db7045b`.

Owned process evidence: `/tmp/boxbox-readiness/rel10-windows-codex-owned-process-state.raw`. A broader native process-name inspection was used only to confirm no owned harness command line remained; it is retained locally and should not be published because it includes unrelated process command lines.

## Next review decisions

1. The WSL Codex result is ready for independent evidence review.
2. Claude's real lifecycle needs a reviewed transition design that accounts for host metadata/cache refresh, likely an explicit documented `plugin update`, while preserving the original failed runs. No harness weakening or manual configuration edit is supported by this evidence.
3. The native Windows Codex launch/timeout behavior needs diagnosis before another unique cell is authorized. The retained bridge should be handled explicitly; do not blindly retry while its state is unresolved.
4. Windows Claude should wait for the Claude transition decision rather than repeating a known stale-record path without a measurement purpose.

## Windows transport closure and native schema finding

After the incomplete cell was preserved, the owned WSL bridge was rechecked immediately before disposal. PID 22226 still had the exact `run-codex.cmd` command line, had no child PIDs, and had no matching native Windows harness process. SIGTERM ended it within one second; SIGKILL was not needed. Evidence: `/tmp/boxbox-readiness/rel10-windows-bridge-disposal.raw`.

One new isolated read-only native PowerShell `Start-Process` probe invoked the exact Codex Node entry with `plugin remove --help`. It completed in approximately 83 ms, emitted the full expected help, and wrote zero stderr bytes. This separates the prior hang from Codex help behavior and supports a cmd/WSL interop transport failure. Evidence: `/tmp/boxbox-readiness/rel10-windows-native-help-probe.raw`.

A new unique cell, `win-codex-02`, then used native PowerShell `Start-Process node.exe` directly. It passed host preflight and performed the real fresh exact-0.2.3 install. The cell stopped after 14 commands at the first schema assertion:

```text
AssertionError [ERR_ASSERTION]: Host JSON lacks an expected source path
```

The actual Codex 0.157.1 Windows JSON is internally consistent for the installed plugin:

- plugin `boxbox@boxbox-plugins`, version `0.2.3`, installed/enabled;
- plugin source path points to the exact isolated 0.2.3 plugin root;
- plugin marketplace source is local and points to the exact isolated 0.2.3 installation root;
- marketplace record is `{ "name": "boxbox-plugins", "root": "C:\\...\\0.2.3" }`.

The harness had already validated `marketplace.root` but additionally required `marketplace.marketplaceSource.source`, which this real Windows CLI schema omits. Therefore this cell is a **harness schema compatibility failure**, not evidence of an incorrect BoxBox path. No harness change, retry, removal, or configuration edit was performed. The isolated old installation/registration remains retained; the current version root is absent.

Compact evidence:

```text
/tmp/boxbox-readiness/rel10-windows-codex-schema-failure/
```

- lifecycle JSON SHA-256: `72dde19f6f8455f575ee8d6113230e0d87aef27c4748145271a5c8b932f35f16`;
- compact summary SHA-256: `0f8684d70b3dc418c2c41ba89090bb87a3b8d18af41463b56d1cd81df80161a5`;
- raw listing outputs: `/tmp/boxbox-readiness/rel10-windows-codex-02-013.stdout.log` and `014.stdout.log`.

The report table's earlier Windows Codex entry describes the preserved first transport attempt. The second native transport attempt replaces the platform readiness conclusion: native process transport works, while the lifecycle remains open on a concrete reviewed-schema mismatch.
