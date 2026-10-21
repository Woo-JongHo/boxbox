# Windows isolated Codex authentication prerequisite probe

Date: 2026-10-22
Host: existing `chacada` Windows native verification host
Mode: read-only prerequisite probe against the retained successful `2b43` isolated root

## Scope and environment

The probe reused the successful native root recorded by `windows-2b43-native-report.md`:

`C:\Users\woo\AppData\Local\Temp\boxbox-python-2b43-75af872a09694305813e176575458e51`

Only process-scoped environment variables were set to the root's existing isolated profile: `USERPROFILE`, `HOME`, `LOCALAPPDATA`, `APPDATA`, and `CODEX_HOME`. The probe ran native `codex.cmd` version/help/login-status commands. It did not run a model, execute hooks, log in, copy authentication, change trust/security/profile settings, or edit repository files.

The raw login-status text was classified in memory and discarded. The retained evidence contains only exit status, authenticated/unauthenticated state, generalized method/provider values, help-surface booleans, and isolated-context presence booleans. No credential, email, account, organization or token value was retained.

## Sanitized result

Native CLI: `codex-cli 0.157.1` (`--version` exit 0).

```json
{
  "auth": {
    "exitCode": 1,
    "loggedIn": false,
    "authMethod": "none",
    "provider": "none",
    "rawOutputRetained": false
  },
  "isolatedContext": {
    "codexHomeExists": true,
    "configExists": true,
    "marketplaceConfigured": true,
    "pluginEnabled": true,
    "authFilePresent": false
  }
}
```

The native documented `codex login status` command exited 1 and classified the retained isolated `CODEX_HOME` as unauthenticated. No isolated `auth.json` exists. This measures the isolated candidate context only and makes no claim about the Windows user's live Codex profile or operating-system credential stores.

## Hook-acceptance journey feasibility

The installed native CLI help returned exit 0 and documents all command controls needed for the previously designed bounded journey:

- `codex exec` JSON events;
- `--sandbox workspace-write`;
- a working-directory flag;
- the one-invocation hook-trust bypass flag.

The isolated config exists and still contains a configured marketplace and enabled plugin. Thus the native CLI and isolated candidate wiring expose the required execution surface. However, the existing isolated context is unauthenticated, so a model-backed Windows hook-acceptance journey is **not runnable from this retained context as-is**. Per the task boundary, probing stopped at this prerequisite; no model or hook invocation was attempted.

## Evidence

- Sanitized machine-readable result: `/tmp/boxbox-readiness/windows-codex-auth-probe.json`
- This report: `/tmp/boxbox-readiness/windows-codex-auth-probe.md`

An initial read-only attempt stopped before status collection because PowerShell promoted Codex's temporary PATH-helper warning to a terminating error. The successful retry suppressed only the warning stream and retained the same isolated environment and read-only commands. Neither attempt changed profile or security settings.
