# REL10 fixed local candidate — remote native lifecycle report

Date: 2026-10-22 KST  
Verdict: **PASS for all four remote real-host core cells and both supported WSL HUD configuration cells.**

## Candidate identity and limit

- Archive: `boxbox-plugin-0.2.4.tgz`, 263,448 bytes.
- SHA-256: `1f1343e91d2799998884ed5d75e1a26d7858226d2f9f51f07621bfeedaf6ecd3`.
- Manifest source head: `a4e14a9e3636e8103c4282ca835488ba0fac134a`.
- Provenance: local unpublished installer-fix candidate built from a dirty, independently reviewed worktree; **not CI-produced, published, or a release artifact**.
- Previous fixture remains exact 0.2.3 SHA `f07df7ada9aa234c2935ed500b4fe15b1a5d53f7b7a6de7d8ec107f53c8f572c`, itself an unpublished historical candidate.

The candidate was staged under new owned WSL and Windows subdirectories without overwriting the retained CI `bec626…` candidate. WSL `sha256sum` and native PowerShell `Get-FileHash` both verified the exact `1f1343…` bytes before execution.

Core harness SHA-256: `292b730c122612479e39d0745623d8095ea066b1c2129c71d30e0a1f8bfa5d30`. HUD harness SHA-256: `73da0018b1761b18c271fe50cc18ab87b2daf8bd086d1c6e606794968a5059e0`.

## Core matrix

| Platform / host | Result | Duration | Commands | Preservation | Residue |
|---|---:|---:|---:|---:|---|
| Ubuntu 24.04.4 WSL2 / Codex 0.163.0 | PASS | 31.806 s | 110: 107 passed, 3 observed | 21 checks, 9 files | both versions present |
| Ubuntu 24.04.4 WSL2 / Claude 2.1.280 | PASS | 280.375 s | 93: 91 passed, 2 observed | 18 checks, 9 files | both versions present |
| Native Windows 11 / Codex 0.157.1 | PASS | 54.264 s | 110: 107 passed, 3 observed | 21 checks, 9 files | both versions present |
| Native Windows 11 / Claude 2.1.280 | PASS | 52.311 s | 93: 91 passed, 2 observed | 18 checks, 9 files | both versions present |

Every cell used a fresh unique harness output and isolated HOME/host/XDG/AppData/npm locations. No live profile, authentication, model request, hook trust, or HUD/UI state was used.

All cells proved fresh exact 0.2.3 registration and engine behavior, expected cold-cache current-version `ENOTCACHED` failure with old state preserved, warm same-version repair, exact current-version transition, current warm repair, rollback, final host registration absence, preserved project/user data, and retained version directories.

Codex retained the existing documented marketplace-collision transition behavior on both OSes: direct transition preserved prior registration/engine, followed by exact documented removal and install. Claude accepted the fixed direct 0.2.4 transition on both OSes. The immutable 0.2.3 installer does not contain the new transition logic, so Claude rollback used the independently reviewed harness's explicit `--manual-rollback` path: verify current registration, exact unregister, exact 0.2.3 install, then final removal. No host state was patched directly.

WSL Claude's direct upgrade command took 51.644 seconds and exited 0; the cell continued and passed actual identity checks. This was bounded host/network update latency, not a timeout or inferred success. Native Windows Claude's corresponding command took 5.704 seconds.

The first detached start attempt for WSL Codex (`wsl-fixed-codex-01`) created no lifecycle output or state and executed no harness action due to SSH background detachment. The actual unique cell used `wsl-fixed-codex-02` with verified creation. No product action was retried from the empty launch.

## WSL HUD configuration matrix

| Host | Result | Duration | Commands | Expected refusals | Final state |
|---|---:|---:|---:|---:|---|
| Codex | PASS | 0.621 s | 10 | 4 | launcher absent; unrelated bin/config/data preserved |
| Claude | PASS | 0.576 s | 8 | 4 | owned state removed; unrelated settings preserved; backup retained |

Both HUD cells explicitly bound the current archive to `1f1343…` and the installed setup scripts to their frozen setup digests. They verified old/current ownership handoff, rollback configuration, user-edit refusal, foreign-owner refusal, exact inventory deltas, version-root preservation, and cleanup of harness-owned final state.

HUD evidence is configuration ownership only. It does not claim actual host UI/tmux rendering, model/authentication, hook delivery/trust, or Windows HUD support. Windows HUD remains excluded.

## Compact evidence

Core evidence directories:

- `/tmp/boxbox-readiness/rel10-fixed-wsl-codex/`
- `/tmp/boxbox-readiness/rel10-fixed-wsl-claude/`
- `/tmp/boxbox-readiness/rel10-fixed-windows-codex/`
- `/tmp/boxbox-readiness/rel10-fixed-windows-claude/`

HUD evidence directories:

- `/tmp/boxbox-readiness/rel10-fixed-wsl-hud-codex/`
- `/tmp/boxbox-readiness/rel10-fixed-wsl-hud-claude/`

Each directory contains the full lifecycle JSON, compact summary, and bounded top-level command logs, without copying the large installed workspaces/node_modules. Exact evidence hashes are recorded in `/tmp/boxbox-readiness/rel10-fixed-compact-hashes.txt`.

Remote originals remain under:

- `/tmp/boxbox-rel10-linux.VfqJoi/wsl-fixed-codex-02/`
- `/tmp/boxbox-rel10-linux.VfqJoi/wsl-fixed-claude-01/`
- `/tmp/boxbox-rel10-linux.VfqJoi/wsl-fixed-hud-codex-01/`
- `/tmp/boxbox-rel10-linux.VfqJoi/wsl-fixed-hud-claude-01/`
- `C:\Users\woo\AppData\Local\Temp\BoxBox-rel10-7b25a75cbb5446069c3e3bfa5b464a4c\win-fixed-codex-01\`
- `C:\Users\woo\AppData\Local\Temp\BoxBox-rel10-7b25a75cbb5446069c3e3bfa5b464a4c\win-fixed-claude-01\`

Transport/hash proof:

- `/tmp/boxbox-readiness/rel10-fixed-remote-wsl-hashes.raw`
- `/tmp/boxbox-readiness/rel10-fixed-windows-hash.raw`

This report is local-candidate evidence. A future clean CI archive has a distinct identity and must be transported, hashed, and verified separately rather than inheriting these exact-archive claims.
