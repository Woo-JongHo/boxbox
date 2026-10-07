# XXX

An agent plugin that checks TypeScript and Python files, one at a time, against a "spreadsheet-style" readability
contract. It gives same-role rows the same structure and aligns syntax boundaries into minimum-width columns. Only
human-approved rules are applied automatically, and rows that cannot be split losslessly are never rewritten.

## Install

Claude Code:

```bash
claude plugin marketplace add <owner>/<repo>
claude plugin install xxx@xxx-plugins
```

Codex:

```bash
codex plugin marketplace add <owner>/<repo>
codex plugin add xxx@xxx-plugins
```

Requirements: Node.js 22.22.3 or later and npm. A runnable `python3` to fix Python files.

## What this plugin runs and writes

- **Engine:** the skill, hooks and inspector run the npm engine package at an exact version with `npx --yes xxx@0.2.0`.
  On first run it downloads this package and its dependency `typescript@7.0.2` from the npm registry. There is no other network traffic.
- **Hooks:** at session start, after edits and when a response ends, they check TypeScript and Python files changed
  during the session, read-only. They never fix anything automatically. Records are written only to the host's plugin
  data folder (`CLAUDE_PLUGIN_DATA`) and are deleted with the plugin. No files are created in the target project.
- **Fixes:** a single target file is replaced atomically only when the user runs `format` and the explicit formatter,
  human-approved rules, re-parsing and fixed-point checks all pass.
- **Inspector:** a read-only Claude Code subagent that never writes files.

## Uninstall

```bash
claude plugin uninstall xxx@xxx-plugins
codex plugin remove xxx@xxx-plugins
```
