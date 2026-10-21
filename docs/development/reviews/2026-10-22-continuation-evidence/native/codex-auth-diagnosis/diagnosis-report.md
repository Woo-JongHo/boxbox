# Codex interactive authentication diagnosis

Date: 2026-10-22 KST. Scope: existing installed `c18a7da...` disposable candidate only. No new `dist` archive was installed or delivered. No browser/device login, hook trust, approval bypass, live-profile edit, or credential output occurred.

## Question

Why did authenticated candidate `codex exec` succeed while the Codex upper pane launched by `boxbox-codex` still showed sign-in?

## Launcher path and environment forwarding

The installed candidate HUD launcher and current source were byte-identical:

```text
SHA-256 86625a2b74288ac0851b6e3518d7e8727846522381e24d1030f0f57ec3685fc6
```

The launcher passes its `env` to the owned tmux server. The pane process reads its small state file, waits for the launcher gate, and starts Codex with `spawn(state.codex, state.args, { cwd: state.cwd, env: process.env, ... })`.

A bounded PTY run temporarily copied only the existing real `auth.json` into the absent candidate `CODEX_HOME/auth.json` at mode 0600. The source auth file hash was recorded without printing contents.

Selected environment values were extracted from the live pane helper, Node Codex wrapper, and native Codex child without retaining or printing the rest of their environments:

```text
pane helper  HOME=/tmp/boxbox-native-fixed.Shl97G/home
             CODEX_HOME=/tmp/boxbox-native-fixed.Shl97G/codex
             XDG_CONFIG_HOME=/tmp/boxbox-native-fixed.Shl97G/home/config
Node wrapper same three values
native child same three values
```

The candidate auth file existed, had mode 0600, and had positive size. `CODEX_HOME=/tmp/boxbox-native-fixed.Shl97G/codex codex login status` returned `Logged in using ChatGPT`. Therefore the upper process received the intended paths; this is not a launcher environment-forwarding bug.

Evidence: `codex-interactive-auth-diagnosis/selected-process-env.txt`, `process-tree.txt`, `temp-auth-mode.txt`, `direct-login-status.txt`, and installed launcher snapshot.

## Managed daemon finding

A candidate-owned managed app-server process was already running before this diagnostic session:

```text
PID 69528
start Wed Oct 21 23:57:41 2026
CODEX_HOME /private/tmp/boxbox-native-fixed.Shl97G/codex
Codex 0.163.0 managed daemon
```

That daemon predated the temporary auth copy and prior authenticated direct probes. During the first PTY run, the upper pane showed the sign-in menu even though its child environment and on-disk auth path were correct.

Using the official candidate-scoped command:

```sh
CODEX_HOME=/tmp/boxbox-native-fixed.Shl97G/codex codex app-server daemon stop
```

stopped only that disposable managed daemon. No live-profile daemon was addressed.

A second ordinary `boxbox-codex` PTY launch with the same three environment paths and same temporary auth copy no longer showed sign-in. Its upper pane reached the normal authenticated folder-access prompt for the generated disposable repository. The prompt was captured in `authenticated-upper-pane.txt`. This proves authentication was recognized after the stale candidate daemon was replaced.

No folder or hook trust was intentionally granted in this diagnostic. The session was exited, and the newly started candidate daemon was stopped with the same official candidate-scoped command.

## Conclusion

The observed direct-exec/TUI difference was caused by candidate-owned managed app-server authentication state that had been established before the temporary auth file existed. Direct `codex exec` authenticated from the current candidate home, while the TUI path reused the older managed daemon state. After stopping the stale candidate daemon, the same HUD launcher and environment advanced from sign-in to the authenticated folder-trust prompt.

This diagnosis rules out loss of `HOME`, `CODEX_HOME`, or `XDG_CONFIG_HOME` across the launcher/tmux/pane chain. It does not establish that Codex should hot-reload credentials into a long-running daemon; that is host behavior outside BoxBox.

## Cleanup

- The second owned HUD tmux session exited.
- Both observed candidate managed daemons were stopped through the official candidate-scoped command.
- The temporary candidate auth copy was removed and absence asserted.
- The real source auth SHA-256 matched before and after.
- Two trust entries created by the earlier disposable Write/Refactor runs were removed from the candidate-only `config.toml`; the marketplace/plugin configuration remains. No live Codex config was edited.
- The current disposable HUD project did not retain a trust block.

Scratch evidence directory: `/tmp/boxbox-readiness/codex-interactive-auth-diagnosis/`.
