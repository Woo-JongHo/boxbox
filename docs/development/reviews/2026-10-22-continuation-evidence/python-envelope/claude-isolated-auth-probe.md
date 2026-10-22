# Claude isolated candidate authentication probe

Date: 2026-10-22
CLI: Claude Code 2.1.286
Mode: read-only authentication-status query; no model call, login, auth copy, hook execution or live-profile change.

## Isolated environment

The query used the existing candidate-only environment:

- `CLAUDE_CONFIG_DIR=/tmp/boxbox-python-native.TflF0A/claude`
- `HOME=/tmp/boxbox-python-native.TflF0A/home`

Command: `claude auth status --json`

The command's raw JSON was parsed in memory. Only the allowed authentication categories and process exit status were emitted; account, email, organization, subscription and identifier fields were neither printed nor retained.

## Filtered result

```json
{
  "exitCode": 1,
  "loggedIn": false,
  "authMethod": "none",
  "providerPresent": false
}
```

The CLI returned valid JSON but a nonzero exit because this isolated candidate profile is not authenticated. The status command did not report a provider. This direct measurement supports the earlier statement that the existing isolated Claude candidate profile is unauthenticated. It also shows that macOS keychain availability did not make this specific isolated invocation authenticated.

This result says nothing about the live Claude profile, and it does not test whether a different isolated configuration could address a keychain credential. No login or credential transfer was attempted. Provider/model availability and the prior Sonnet limit are separate from authentication status and were not tested here.

## CLI settings relevant to a later isolated native-hook test

The installed CLI help confirms these supported controls:

- `--plugin-dir <path>` loads a plugin for one invocation.
- `--settings <file-or-json>` supplies explicit settings.
- `--setting-sources <sources>` limits user/project/local setting sources.
- `--include-hook-events` emits hook lifecycle events with print-mode stream JSON.
- `--no-session-persistence` avoids saving a print-mode session.
- `--permission-mode <mode>` and `--permission-prompts <target>` constrain tool permissions and prompts.
- `--tools <tools...>` narrows built-in tools.
- `--strict-mcp-config` ignores other MCP configurations when an explicit MCP config is supplied.

`--bare` is unsuitable for native-hook acceptance because its documented behavior skips hooks and keychain reads. `--safe-mode` is also unsuitable because it disables installed plugins and hooks. These are help-surface observations only; no Claude session or hook was started.

## Scope

The measured conclusion is limited to authentication state of the existing isolated candidate environment at probe time. Repository files were not modified.
