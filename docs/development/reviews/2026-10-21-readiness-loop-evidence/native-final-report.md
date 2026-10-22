# BoxBox 0.2.4 current-candidate native verification

Date: 2026-10-21/22 KST

## Candidate identity

- Local candidate: `/Users/jonghoPro/woo/00_project/98_BoxBox/dist/installer/boxbox-plugin-0.2.4.tgz`
- SHA-256: `c18a7da980cfcbd42bd4cfef4c1676b13a9c12759a3d4c9fc2689b0d7af0fb84`
- Size: 257070 bytes
- Classification: locally rebuilt final candidate, not a CI-produced archive.
- This supersedes the preserved pre-fix local candidate SHA `13e099e00f160f95481a38afeb7ed717bf44afe9aa04ad11e347bcf5e9fc0177` for current-candidate verification. The earlier bytes and native failure evidence were not overwritten.

## macOS disposable installation and HUD

Fresh root: `/tmp/boxbox-native-fixed.Shl97G`. Evidence: `/tmp/boxbox-readiness/native-fixed-evidence.49pTP2`.

PASS:

- Exact candidate installed Codex and Claude payloads at version 0.2.4 into an isolated HOME/XDG/CODEX_HOME/CLAUDE_CONFIG_DIR.
- The Codex `boxbox-codex` launcher was created and executable.
- Claude `settings.json` received the owned official `statusLine` command.
- Both installed `status.mjs` entry points executed through `/tmp` while their canonical paths were under `/private/tmp`; the previous silent alias failure did not recur.
- Codex JSON status reported engine ready, 2 approved records, `fileVerification: not-run`, and `hostAcceptance: unverified`.
- Claude compact output was explicitly qualified: `session receipt: unknown (unknown) | file not run | host unverified`.
- An actual PTY launch created an isolated tmux server, rendered Codex 0.163.0 in the upper pane and the four-row BoxBox HUD in the lower pane. Captured HUD text says `project history (not current session) receipt: unknown ... | file not run...`. Ctrl-C returned exit 0 and left no owned tmux/HUD process.

LIMITATION / BLOCKER:

- The isolated Codex profile presented the native sign-in screen. Copying only the existing `~/.codex/auth.json` at mode 0600 did not authenticate this isolated profile; the copy was removed after the attempt without printing it.
- Claude with the isolated config completed theme selection but presented its login-method screen; the existing keychain did not authenticate that disposable config.
- Therefore authenticated ready/malformed-config/recovery transitions and native hook-output acceptance were not exercised on macOS. The actual HUD host rendering is verified; session/hook acceptance is still unverified and no receipt-only claim is made.

Key files:

- `install.log`
- `hud-installed.txt`
- `codex-status-initial.json`
- `claude-status-initial.txt`
- `codex-native-pane.txt`, `codex-hud-pane.txt`
- `codex-cleanup-processes.txt`

## Cross-version HUD ownership

Raw probe: `/tmp/boxbox-readiness/native-final-evidence/hud-upgrade-probe.jsonl`.

- Codex correctly refuses a new plugin root while the exact old-root launcher remains. Running old-root `setup.mjs ... --disable`, then enabling the new root, succeeds. A later user edit remains refused and preserved.
- Claude recognizes its ownership state in the stable shared HUD data directory and updates the old status line to the new root in place. A foreign status line remains refused.
- Documentation now states the Codex handoff. Focused regression: 6 pass, 0 fail, 31 assertions (`hud-upgrade-regression.log`).

## chacada Windows / WSL delivery and engine journey

Remote directory: `C:\Users\woo\Downloads\BoxBox\0.2.4\native-final-fixed-20261021T2357KST`.

PASS:

- WSL `sha256sum` and native PowerShell `Get-FileHash` both matched the approved SHA exactly.
- Native Windows isolated install succeeded with Node 24.12.0 and Codex 0.157.1. The recurring Codex warning about refusing PATH helper aliases under the temporary CODEX_HOME was nonfatal; no persistent profile was changed.
- Packaged `boxbox.cmd doctor --json` returned `ok=true`, `runtimeUsable=true`, configured standalone alignment, and 2 approved convention records.
- A disposable three-row TypeScript fixture exercised the packaged engine: initial check `misaligned=1`; alignment dry-run; alignment apply; final check `misaligned=0`.
- Independent assertion over the final bytes verified values `1, 22, 333` and declaration order `short, muchLonger, middle` were preserved.

LIMITATION:

- This is a native Windows packaged-engine journey, not native Codex hook delivery. The disposable profile has no authenticated host turn and no hook trust was granted. SessionStart/PostToolUse/Stop host acceptance remains unverified.
- Persistent HUD is intentionally unsupported on native Windows.

Local evidence mirror: `/tmp/boxbox-readiness/native-fixed-evidence.49pTP2/windows/`, including `doctor.json`, before/dry-run/apply/after JSON, final fixture bytes and `independent-assert.txt`.

## Verdict

The fixed local candidate closes the concrete `/tmp`↔`/private/tmp` direct-entry regression: both HUD setup/render entry points now work from the installed archive, and the real Codex terminal layout launches and cleans up. The exact same archive installs and performs the approved check/align journey on native Windows. Authenticated native host hook acceptance and both-host ready/error/recovery UI remain pending because disposable profiles reached provider login flows; they are not represented as PASS.
