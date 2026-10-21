# BoxBox terminal HUD

The optional installer HUD shows BoxBox version, local engine readiness, approved convention count and the last
observed check. It is read-only. It does not format files, grant hook trust or establish native acceptance.

## Enable

Build or obtain the unpublished local installer candidate, then use its exact archive path:

```sh
npm exec --yes --package '/absolute/path/to/boxbox-plugin-<version>.tgz' -- boxbox --codex --claude --hud
```

Select only installed hosts if necessary. Before upgrading a Codex HUD, disable it with the old permanent plugin
directory as described below. Then remove the previous Codex marketplace registration if required and run the new
installer with `--hud`; see the [installer guide](../../product/installer/README.md#updating-a-local-codex-candidate-from-an-earlier-version).
This explicit handoff keeps a launcher changed by the user or another tool from being mistaken for BoxBox-owned content.
The public registry command is still pending publication. Windows plugin installation works without `--hud`; this
terminal HUD adapter requires macOS/Linux. Desktop apps have not been verified and are outside this adapter's support.

### Claude Code

Restart `claude` in a terminal. The official `statusLine` setting draws two lines. A trusted workspace is required;
managed policy or higher-priority settings may suppress it. Setup uses `CLAUDE_CONFIG_DIR/settings.json` or
`~/.claude/settings.json`, preserves other keys, and refuses to replace another status line. It saves the initial
settings bytes in the installation host's sibling `hud/claude-settings.before-hud.json`.

The status-line stdin carries `cwd` and `session_id`. Only that exact session's receipt can appear; a locator for
another session reports unknown. Claude invokes its status command at startup and session events; idle polling is not
configured. This uses the [official status-line contract](https://code.claude.com/docs/en/statusline), not a mod.

### Codex

Install tmux, then run from a regular terminal outside an existing tmux session:

```sh
~/.local/bin/boxbox-codex
~/.local/bin/boxbox-codex --cd /absolute/project
```

If `~/.local/bin` is on PATH, `boxbox-codex` is sufficient. `BOXBOX_BIN_HOME` selects another directory at setup time.
The normal `codex` command is untouched. The launcher opens actual Codex in the upper pane and a periodically refreshed
BoxBox HUD below it. It owns an isolated tmux server and leaves existing servers/configuration alone. Closing Codex
ends that server and returns Codex's exit status. Detaching also closes this owned session, so do not use detach as a
background-session workflow.

The HUD pins the startup project, shown in the pane. Relaunch after switching projects or sessions inside Codex. It
shows **project history, not current-session proof**, because this companion does not receive a native Codex session ID.
Remote/worktree/resume/fork startup and noninteractive subcommands are refused; use ordinary `codex` for those modes.
The fixed Codex footer has no verified arbitrary plugin command surface in 0.163.0; this is a companion terminal pane.

## Read the result

- `engine ready` means the installed engine's `doctor` succeeded. File parsing and write approval are still per-file.
- `approved 2` counts loaded approved convention records; it does not approve arbitrary patterns.
- `PASS`, `FAIL`, `UNSUPPORTED` and `NO_CHANGES` come from exact stored hook receipts. Age is shown. Records older than
  five minutes are labeled historical. Unknown, mismatched, malformed or oversized data does not become PASS.
- A missing locator is expected until the installed plugin receives a native hook in that project. Review hook trust
  in the host separately. Rendering a receipt is not evidence that the host accepted that receipt's output.

## Disable

Use the permanent plugin directory printed by installation, separately for each host:

```sh
node '/absolute/installed/plugin/scripts/hud/setup.mjs' claude '/absolute/installed/plugin' --disable
node '/absolute/installed/plugin/scripts/hud/setup.mjs' codex '/absolute/installed/plugin' --disable
```

Only the still-owned Claude status-line key or `boxbox-codex` launcher is removed. Later user edits are preserved and
reported as a conflict. Disable before deleting the permanent installation. Restart Claude after disabling its HUD.

## Troubleshoot

Run the installed collector directly to inspect unknown states:

```sh
node '/absolute/installed/plugin/scripts/hud/status.mjs' --plugin-root '/absolute/installed/plugin' --host codex --root /absolute/project --json
```

Use `--host claude` for that adapter's installation. Repair missing runtime files with the same installer archive.
If Claude has an existing status line, keep it or remove that setting yourself before opting into BoxBox; setup never
composes unknown shell commands. No default profile, sandbox or hook-trust bypass is required for this HUD.
