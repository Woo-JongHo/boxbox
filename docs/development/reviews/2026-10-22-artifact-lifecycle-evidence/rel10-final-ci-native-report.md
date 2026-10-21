# REL10 final clean-CI native remote verification

## Verdict

PASS for the authorized remote scope. The exact clean-CI installer archive from workflow `39646320662`, attempt 1, was independently hashed and exercised in four fresh lifecycle cells on WSL Linux and native Windows. Both successful WSL core cells were then exercised by the configuration-ownership HUD harness. No repository files, live host profiles, authentication, trust settings, model sessions, hooks, or native Windows HUD were used.

## Candidate identity and delivery

- Source commit: `66eb97821d6b8bd81323175e071a107b2aa3f215`
- Archive: `boxbox-plugin-0.2.4.tgz`
- SHA-256: `ebfe6a7796d9d85e9cf3088c955df4fb5477e60513e8ebda97d517746d93c665`
- Size: 263896 bytes
- Candidate metadata: workflow `39646320662`, attempt 1; source reported clean.
- WSL staging: `/tmp/boxbox-rel10-linux.VfqJoi/artifacts/ci-ebfe6a77/boxbox-plugin-0.2.4.tgz`
- Windows task staging: `C:\Users\woo\AppData\Local\Temp\BoxBox-rel10-7b25a75cbb5446069c3e3bfa5b464a4c\ci-ebfe6a77\boxbox-plugin-0.2.4.tgz`
- Durable development-candidate delivery: `C:\Users\woo\Downloads\BoxBox\0.2.4\ci-39646320662-1-ebfe6a77`
- The delivery directory also contains the exact `candidate.json`, `SHA256SUMS.txt`, and `PROVENANCE.txt`.
- WSL `sha256sum` matched the expected digest at all three remote locations. Native PowerShell `Get-FileHash` independently returned the same digest and 263896-byte size for the Downloads copy.

This remains an unpublished development candidate. The workflow smoke matrix was still underway when remote verification began, so this report does not assert a terminal workflow result.

## Core lifecycle cells

| Platform | Host | Native host version | Node | Commands | Result |
|---|---|---:|---:|---:|---|
| WSL2 Linux | Codex | 0.163.0 | 22.22.3 | 110 | PASS |
| WSL2 Linux | Claude Code | 2.1.280 | 22.22.3 | 93 | PASS |
| Native Windows | Codex | 0.157.1 | 24.12.0 | 110 | PASS |
| Native Windows | Claude Code | 2.1.280 | 24.12.0 | 93 | PASS |

All cells bound the previous artifact to `f07df7ada9aa234c2935ed500b4fe15b1a5d53f7b7a6de7d8ec107f53c8f572c`, the current artifact to `ebfe6a…`, and the core verifier to `292b730c122612479e39d0745623d8095ea066b1c2129c71d30e0a1f8bfa5d30`. Codex measured the documented marketplace-collision/remove/install path for upgrade and rollback. Claude measured direct upgrade and the explicitly requested manual rollback. Fresh install, expected cold-cache dependency failure with prior state preserved, warm-cache repair, current repair, rollback, final unregistration, engine behavior, unrelated-file preservation, and host-setting preservation all passed within each isolated profile.

The core verifier’s “historical uncommitted candidate fixture” limitation applies to the previous `0.2.3` fixture (`f07df7…`) used to exercise transitions. The current input is the clean CI candidate `ebfe6a…`; its identity is established by `candidate.json`, source commit `66eb978…`, and repeated pre-execution, stage, and final digest checks in every lifecycle JSON.

## WSL HUD configuration lifecycle

| Host | Commands | Result |
|---|---:|---|
| Codex | 10 | PASS |
| Claude Code | 8 | PASS |

Both cells used HUD verifier SHA `73da0018b1761b18c271fe50cc18ab87b2daf8bd086d1c6e606794968a5059e0` and explicit current digest `ebfe6a…`. They verified owned configuration creation/update/removal, preservation of unrelated or foreign configuration, and clean final ownership state. This is configuration ownership only; it does not claim host UI, model, hook, trust, tmux, authentication, or Windows HUD acceptance.

## Evidence

- Compact local evidence directory: `/tmp/boxbox-readiness/rel10-final-ci-native-ebfe6a77/`
- Machine summary: `/tmp/boxbox-readiness/rel10-final-ci-native-ebfe6a77/compact-summary.json`
- Full lifecycle JSONs: six `*lifecycle.json` files in that directory.
- Transfer/hash proof: `remote-wsl-hashes.txt`, `remote-native-powershell-hash.txt`, `SHA256SUMS.txt`, `candidate.json`, and `PROVENANCE.txt` in that directory.
- Remote raw command logs and isolated workspaces remain under the fresh cell directories named `wsl-ci-ebfe-*` and `win-ci-ebfe-*`; large caches and workspaces were not copied locally.
