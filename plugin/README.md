# BoxBox

An agent plugin that checks TypeScript and Python files, one at a time, against a "spreadsheet-style" readability
contract. It gives same-role rows the same structure and aligns syntax boundaries into minimum-width columns. Only
human-approved rules are applied automatically, and rows that cannot be split losslessly are never rewritten.

## Install for Codex and Claude Code

The intended entry point is the npm installer: `npx boxbox-plugin`. It installs this plugin and its included engine into a permanent user directory.
The npm `boxbox-plugin` candidate was unregistered when checked; this is not a reservation. npm authentication is complete; publication remains pending.

For a manually configured local engine, set `BOXBOX_CLI` to the installed BoxBox `dist/cli.js` before invoking the standard shim.
The npm installer configures its own local Node launcher, including native Windows hooks.
Requirements: Node.js 22.22.3 or later, npm and Codex CLI. Python fixes additionally need a runnable `python3`.

## What this plugin runs and writes

- **Engine:** the standard launcher requires an explicit local `BOXBOX_CLI` and refuses to run when it is missing. It never resolves the occupied registry package. The npm installer installs its included engine tarball and downloads the pinned `typescript@7.0.2` dependency and its platform package from npm.
- **Hooks:** at session start, after edits and when a response ends, they check TypeScript and Python files changed
  during the session, read-only. They never fix anything automatically. Records are written only to the host's plugin
  data folder (`CLAUDE_PLUGIN_DATA`) and are deleted with the plugin. No files are created in the target project.
- **Fixes:** a single target file is replaced atomically only when the user runs `format` and the explicit formatter,
  human-approved rules, re-parsing and fixed-point checks all pass.
- **Inspector:** a read-only Claude Code subagent that never writes files.

## Uninstall

```bash
claude plugin uninstall boxbox@boxbox-plugins
codex plugin remove boxbox@boxbox-plugins
```
