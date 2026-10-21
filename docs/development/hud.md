# BoxBox HUD architecture

## Scope

The 0.2.3 installer candidate adds a read-only terminal HUD: Claude official `statusLine`, and an explicit
`boxbox-codex` tmux companion. The shared collector uses only an installed engine. Setup is opt-in via `--hud`.
See [user setup and boundaries](../user/hud.md). Native rendering evidence and independent review belong to the
[HUD implementation record](reviews/2026-10-21-terminal-hud.md).

## Contract

`product/hud/status.mjs` exports `collectStatus` and `renderStatus`. It reads the installed host manifest and
`runtime.json`, then invokes the configured Node/CLI `doctor --json` with a five-second timeout and 256 KiB output cap.
No checkout fallback or formatter execution is allowed. Plugin presence does not imply enabled/trusted state.
The JSON result keeps configuration readiness, file verification (`not-run`) and native acceptance (`unverified`) separate.

`--claude-statusline` reads bounded host JSON stdin, uses `cwd` and exact `session_id`, and emits two lines.
`--watch` polls every two seconds; in the four-row tmux pane it emits three lines without a trailing newline.
The Codex pane displays the pinned root and latest-project history, because it has no native session ID.
Text controls are sanitized. Receipt files, directories, timestamps, events, states and project/session hashes are
validated; scanning is bounded to 256 directory entries and 256 KiB per JSON file. Old records are historical.

## Data and adapters

- `product/hud/record.mjs`: best-effort locator writer called after an installed native hook. The launcher forwards
  bounded stdin bytes and engine stdout/stderr unchanged. It does not add protocol output or trap a session for HUD failure.
- `runtime.hudData`: host-specific sibling `hud/` directory outside the version folder. A project SHA-256 prefix names
  the locator; it contains the absolute root, hashed session ID, exact receipt directory and observation timestamp.
  Receipts remain in host plugin data. This metadata is not an approval DB or SQLite store.
- `product/hud/setup.mjs`: explicit setup and disable. Atomic file replacement, Claude settings backup, ownership checks,
  and compare-before-write for settings. Other status-line owners and symlink files are refused. No trust policy changes.
- `product/hud/codex.mjs`: dedicated tmux server, native Codex upper pane, four-row HUD lower pane. No shell interpolation
  of Codex arguments. Cleanup preserves the main exit code. Existing tmux, remote/worktree and resume/fork startup are refused.
- `product/installer/` and the artifact builder copy these modules into each host payload's `plugin/scripts/hud/`.
  Direct thin-marketplace installation alone does not configure this installer-only surface.

## Verification

Focused tests are `test/product-hud.test.ts`, `test/codex-hud-launcher.test.ts`, `test/hud-installation.test.ts` and
`test/installer-artifact.test.ts`. Real native terminal captures are required in addition to unit tests and registration.
Test failures must stay visible as unknown/error; a mocked receipt or renderer stdout is not native acceptance evidence.

## Extension pattern

Keep one collector and add presentation adapters. A newer Claude AbovePrompt mod could reuse it after verifying the
installed host's generated declarations and actual UI. Ponytail's Band is a design reference, not a dependency:
[version-pinned renderer](https://github.com/DietrichGebert/ponytail/blob/09c434ab73ca43761c5d8b0c5d341926c2fba710/hooks/band/register.tsx).
Installed Claude terminal 2.1.286 is below the documented mods floor; its official status line is used instead.
Desktop and Windows HUD behavior require separate adapters and native evidence. Do not infer them from terminal success.

## Development conversation panel

The older `development/tools/hud.mjs`, `bun run hud`, and development `$boxbox-status` skill remain available for an
on-request Codex conversation report. That development collector discovers installed/enabled state through Codex's
plugin list; it is excluded from release artifacts. It is separate from the new installed persistent terminal adapters.
Its `--plugin-data` option accepts a project/session receipt location. Do not borrow another session's data to make a
report green. Prior native-hook evidence is in [the host audit](reviews/2026-10-21-codex-native-hooks.md).
