# Terminal HUD implementation and native verification

Date: 2026-10-21. Source baseline: `07f568ccec77e70dd57da9aba63f8dc7ef7fcc5a` plus the uncommitted HUD changes.
Prior documentation/localization changes were preserved. The candidate is **0.2.3**, unpublished.

## Verdict

Implementation, packaged installation and native macOS terminal rendering are verified. **Independent acceptance is
blocked:** both Sonnet and fixed Opus attempts returned the provider session-limit message (reset reported as 16:20
Asia/Seoul). Neither performed a review; no lower model was substituted. HUD2 remains active pending those passes.
No public publication, tag or commit/push is claimed by this record.

## Delivered behavior

- Shared installed-runtime collector: version, engine readiness, approved record count, exact receipt scope and age.
- Claude official `statusLine`, two lines, opt-in settings merge with backup and owned-key removal.
- `boxbox-codex`: actual Codex above a four-row companion pane on a dedicated tmux server. Ordinary `codex` is unchanged.
  It preserves argv, approval/sandbox settings and the main exit code, cleans its server, and pins the startup project.
- Optional `--hud` installer flag; permanent launchers and runtime, no checkout dependency. Marketplace-only thin plugins
  do not configure this surface. Windows/desktop HUDs are unsupported by this adapter.
- Locator metadata goes to the host installation's sibling `hud/` directory. Receipts stay in host plugin data.
  This does not introduce SQLite or change approved rules, parser behavior or automatic formatting.

Sources are in `product/hud/` and `product/installer/`; [the architecture contract](../hud.md) and
[user instructions](../../user/hud.md) describe maintenance and removal. Root READMEs contain matching EN/KO/ZH commands.

## Verification

| Check | Measured result | Evidence |
| --- | --- | --- |
| Full final `bun run check` | **512 pass / 5 existing Rust/Kotlin skips / 0 fail**; TypeScript and shell syntax completed, exit 0 | [final log](2026-10-21-terminal-hud-evidence/check-final.log) |
| Initial full check | Two hard-coded version expectations failed after the engine bump; corrected to root manifest version and rerun | [initial log](2026-10-21-terminal-hud-evidence/check.log) |
| Installer artifact | Initial dedicated 7 tests / 230 assertions passed; final full suite also checks installed engine version against package version | [dedicated log](2026-10-21-terminal-hud-evidence/installer-test.log) |
| Plugin guard | Drift, strict validators, contract/hooks tests and isolated Codex/Claude registrations passed | [guard log](2026-10-21-terminal-hud-evidence/plugin-guard.log) |
| Local install and repair | Both hosts use permanent 0.2.3 plugins, matching HUD/launcher source bytes and engine 0.2.3 | [installed verification](2026-10-21-terminal-hud-evidence/installed-verification.json) |
| Native Codex 0.163.0 | Actual input UI plus BoxBox pane; ready → not-ready → ready; exit 0 and owned server removed | [ready panes](2026-10-21-terminal-hud-evidence/native-codex-ready.json), [invalid config](2026-10-21-terminal-hud-evidence/native-codex-invalid-config.json), [recovery](2026-10-21-terminal-hud-evidence/native-codex-recovered.json) |
| Native Claude 2.1.286 | Actual own statusLine; ready → not-ready → ready across `/clear` events | [initial screen](2026-10-21-terminal-hud-evidence/native-claude-screen.txt), [invalid config](2026-10-21-terminal-hud-evidence/native-claude-invalid-config.txt), [recovery](2026-10-21-terminal-hud-evidence/native-claude-recovered.txt) |
| Static checks | Node syntax, no new placeholder branches/tests, matching translated README code blocks/link targets | [static checks](2026-10-21-terminal-hud-evidence/static-checks.json) |
| Sonnet independent review | **Unexecuted — provider session limit** | [response](2026-10-21-terminal-hud-evidence/sonnet.json) |
| Fixed Opus final audit | **Unexecuted — provider session limit** | [response](2026-10-21-terminal-hud-evidence/opus.json) |

The native test used an empty disposable Git project under `/tmp/boxbox-hud-20261021/native-project` and accepted
workspace trust only for that project. Codex's new/changed hook prompt was skipped without trusting hooks. The
`not-ready` test temporarily wrote malformed `.boxbox/config.json` in that disposable project and then removed it.
No model request or source-formatting request was needed. Claude `/clear` changed its session ID; the HUD safely
reported `session-mismatch` instead of borrowing a previous session's result. Both hosts recovered engine readiness.
These captures prove presentation acceptance, not all native hook event delivery or per-file correctness.

The 0.2.3 bump exposed a separately hard-coded engine `CLI_VERSION`; it was updated together with the root package.
Tests now compare the public CLI and installed launcher version to the root manifest. `sync:plugin` now synchronizes that constant from the root manifest, with the existing version-bump layout test
covering engine and plugin stamps. Supplemental layout/contract tests and type checking passed after this safeguard.

## Reference investigation and limits

Ponytail 5.3.2 commit `09c434ab73ca43761c5d8b0c5d341926c2fba710` uses a Claude AbovePrompt Band. Installed Claude terminal
2.1.286 is below its required version, so this implementation uses the official status line. No Ponytail code is copied.
Codex 0.163.0 source and real strict-config probes expose only fixed status-line item IDs, not arbitrary plugin callbacks.
The Codex companion therefore has explicit launch and root/session limitations. Full investigations:
[Codex](2026-10-21-terminal-hud-evidence/boxbox-codex-hud-surface-20261021.md),
[Claude](2026-10-21-terminal-hud-evidence/boxbox-claude-hud-surface-20261021.md).

Review remains required for the final implementation. This is not a full-product release audit. Existing native Windows
editing restrictions, public registry publication and earlier parser/schema follow-ups remain open.

## Candidate delivery

Archive: `boxbox-plugin-0.2.3.tgz`, **137,322 bytes**, SHA-256
`f07df7ada9aa234c2935ed500b4fe15b1a5d53f7b7a6de7d8ec107f53c8f572c`.
The [candidate metadata](2026-10-21-terminal-hud-evidence/candidate.json) explicitly records uncommitted source and
unexecuted independent reviews. The archive, metadata and warning README were transferred through SSH `chacada` to
`C:\Users\woo\Downloads\BoxBox\0.2.3\hud-preview-20261021` (WSL-mounted Windows path). Remote installation was not changed.
The [remote checksum](2026-10-21-terminal-hud-evidence/remote-sha256.txt) must match the archive above.
