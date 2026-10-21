# Native authenticated verification handoff

Prepared 2026-10-22 KST. This handoff is bound to the existing disposable installation and does not authorize changes to live profiles, credential extraction, or automatic hook trust.

## Bound candidate and verified paths

Candidate:

```text
/Users/jonghoPro/woo/00_project/98_BoxBox/dist/installer/boxbox-plugin-0.2.4.tgz
SHA-256 c18a7da980cfcbd42bd4cfef4c1676b13a9c12759a3d4c9fc2689b0d7af0fb84
```

Disposable root and installed paths:

```text
/tmp/boxbox-native-fixed.Shl97G
/tmp/boxbox-native-fixed.Shl97G/project
/tmp/boxbox-native-fixed.Shl97G/home/.local/bin/boxbox-codex
/tmp/boxbox-native-fixed.Shl97G/home/data/boxbox/codex/0.2.4/plugin
/tmp/boxbox-native-fixed.Shl97G/home/data/boxbox/claude/0.2.4/plugin
/tmp/boxbox-native-fixed.Shl97G/claude/settings.json
```

All paths above existed when this handoff was written. The launcher was executable; Claude settings were mode 0600. `codex`, `claude`, `tmux`, and Node 22.22.3 were present. The exact candidate digest was recomputed and matched.

`/tmp` is temporary. A reboot, cleanup service, or manual deletion may remove this installation. Recheck every path and the archive digest immediately before continuing. If any path is absent, stop; do not silently substitute another installation or archive.

## Per-command disposable environment

Do not export `HOME`, `CODEX_HOME`, or host configuration variables into a long-lived shell. Define only task-specific path variables and pass the host environment to each subprocess:

```sh
BOXBOX_NATIVE_ROOT='/tmp/boxbox-native-fixed.Shl97G'
BOXBOX_CANDIDATE='/Users/jonghoPro/woo/00_project/98_BoxBox/dist/installer/boxbox-plugin-0.2.4.tgz'
BOXBOX_SHA256='c18a7da980cfcbd42bd4cfef4c1676b13a9c12759a3d4c9fc2689b0d7af0fb84'
BOXBOX_HOME="$BOXBOX_NATIVE_ROOT/home"
BOXBOX_CODEX_HOME="$BOXBOX_NATIVE_ROOT/codex"
BOXBOX_CLAUDE_CONFIG="$BOXBOX_NATIVE_ROOT/claude"

test -d "$BOXBOX_NATIVE_ROOT/project"
test -x "$BOXBOX_HOME/.local/bin/boxbox-codex"
test -d "$BOXBOX_HOME/data/boxbox/codex/0.2.4/plugin"
test -d "$BOXBOX_HOME/data/boxbox/claude/0.2.4/plugin"
test "$(shasum -a 256 "$BOXBOX_CANDIDATE" | awk '{print $1}')" = "$BOXBOX_SHA256"
```

Use this exact subprocess prefix for host commands:

```sh
env HOME="$BOXBOX_HOME" XDG_DATA_HOME="$BOXBOX_HOME/data" \
  XDG_CONFIG_HOME="$BOXBOX_HOME/config" CODEX_HOME="$BOXBOX_CODEX_HOME" \
  CLAUDE_CONFIG_DIR="$BOXBOX_CLAUDE_CONFIG" npm_config_cache="$BOXBOX_NATIVE_ROOT/npm-cache" \
  command arguments...
```

Do not copy credentials from a live profile. A previous test copied only `~/.codex/auth.json` into the disposable profile at mode 0600, but Codex still presented sign-in; that temporary copy was removed.

## Interactive authentication

These steps require the user to complete provider authentication. Do not automate browser approval, device codes, API-key entry, or credential storage.

### Codex

Launch the actual installed HUD wrapper:

```sh
env HOME="$BOXBOX_HOME" XDG_DATA_HOME="$BOXBOX_HOME/data" \
  XDG_CONFIG_HOME="$BOXBOX_HOME/config" CODEX_HOME="$BOXBOX_CODEX_HOME" \
  CLAUDE_CONFIG_DIR="$BOXBOX_CLAUDE_CONFIG" npm_config_cache="$BOXBOX_NATIVE_ROOT/npm-cache" \
  "$BOXBOX_HOME/.local/bin/boxbox-codex" -C "$BOXBOX_NATIVE_ROOT/project"
```

Codex 0.163.0 previously opened inside the owned tmux upper pane and displayed its sign-in menu. The user must choose a sign-in method and finish it interactively. Successful authentication must result in the ordinary Codex prompt while the lower BoxBox pane remains visible. While it runs, capture the exact launcher PID and its unique `-L boxbox-hud-<pid>-<suffix>` socket token from `ps -axo pid,ppid,command`, and save the full matching process lines. After Ctrl-C, query that exact PID and exact socket token. Cleanup passes only when neither exact identity remains. A broad `boxbox-hud-` grep can match another session and is not evidence.

### Claude Code

In another newly initialized shell with the same environment:

```sh
cd "$BOXBOX_NATIVE_ROOT/project"
env HOME="$BOXBOX_HOME" XDG_DATA_HOME="$BOXBOX_HOME/data" \
  XDG_CONFIG_HOME="$BOXBOX_HOME/config" CODEX_HOME="$BOXBOX_CODEX_HOME" \
  CLAUDE_CONFIG_DIR="$BOXBOX_CLAUDE_CONFIG" npm_config_cache="$BOXBOX_NATIVE_ROOT/npm-cache" \
  claude
```

Claude Code 2.1.286 previously reached theme selection and then its login-method screen. The user must finish login interactively. Acceptance requires the normal Claude prompt and the installed official two-line status line. Do not use a live `CLAUDE_CONFIG_DIR` as a shortcut.

## HUD ready, error, and recovery scenarios

Perform these only after the corresponding host is authenticated and showing the installed HUD/status line. Use a second shell with the task-specific path variables above.

1. Record the initial ready display. It must distinguish engine readiness from file and host evidence. Missing receipts must remain unknown; no unqualified session PASS is acceptable.
2. Require the disposable configuration path to be absent. If it exists, stop and inspect it; do not overwrite it:

```sh
BOXBOX_TEST_CONFIG="$BOXBOX_NATIVE_ROOT/project/.boxbox/config.json"
test ! -e "$BOXBOX_TEST_CONFIG" || { echo 'STOP: disposable config already exists'; return 1 2>/dev/null || exit 1; }
mkdir -p "$BOXBOX_NATIVE_ROOT/project/.boxbox"
printf '{ invalid\n' > "$BOXBOX_TEST_CONFIG"
```

3. Wait for the Codex companion pane refresh or trigger a normal Claude status-line refresh. Record the engine/configuration error.
4. Recover:

```sh
unlink "$BOXBOX_TEST_CONFIG"
```

5. Record the restored ready display. Confirm the same project is shown and receipt/file/host qualifiers remain honest.
6. For Claude, run `/clear` and confirm a new session does not borrow the previous session's receipt. Unknown or session mismatch is expected until that exact session receives a hook.

The prior unauthenticated Codex PTY run already proved layout and cleanup. These scenarios close authenticated host rendering and state transitions; they do not alone prove hook-output acceptance.

## Guide and Align baseline

This scenario verifies only Guide, Check, and the approved Align path for the existing TypeScript top-level single-call declaration convention. It is not evidence for a genuine Write workflow that creates requested behavior or a Refactor workflow that structurally changes working code. Those agent behaviors remain pending separate scenarios with explicit behavior assertions.

Create only this disposable file:

```sh
cat > "$BOXBOX_NATIVE_ROOT/project/authoring.ts" <<'TS'
const short = make(1);
const muchLonger = make(22);
const middle = make(333);
TS
cp "$BOXBOX_NATIVE_ROOT/project/authoring.ts" '/tmp/boxbox-readiness/authoring.before.ts'
```

In the authenticated Codex session, explicitly invoke the installed BoxBox skill and request this bounded workflow:

```text
Use the BoxBox skill on only authoring.ts. First run guide --file authoring.ts --authoring --json and explain the approved top-level TypeScript single-call declaration guidance. Then run Check, preview alignment with align --dry-run, apply the approved alignment, and run Check again. Preserve declaration order and the exact argument values 1, 22, and 333. Do not edit any other file.
```

Independently verify in the second shell using the installed runtime:

```sh
BOXBOX_CLI="$BOXBOX_HOME/data/boxbox/codex/0.2.4/runtime/node_modules/.bin/boxbox"
env HOME="$BOXBOX_HOME" XDG_DATA_HOME="$BOXBOX_HOME/data" XDG_CONFIG_HOME="$BOXBOX_HOME/config" \
  "$BOXBOX_CLI" check --file "$BOXBOX_NATIVE_ROOT/project/authoring.ts" --json
python3 - <<'PY'
import re
from pathlib import Path
p = Path('/tmp/boxbox-native-fixed.Shl97G/project/authoring.ts')
s = p.read_text()
assert re.findall(r'make\((\d+)\s*\)', s) == ['1', '22', '333']
assert [line.split()[1] for line in s.splitlines() if line.strip()] == ['short', 'muchLonger', 'middle']
print('PASS: exact values and declaration order preserved')
PY
```

Acceptance requires final `misaligned: 0`, valid syntax, exact value/order preservation, and no other changed project file. Preserve the host transcript separately from CLI JSON so agent behavior and engine behavior are not conflated.

### Genuine Write and Refactor remain pending

Do not relabel this Align baseline as Write or Refactor. A future authenticated test must define two distinct behavior contracts before execution:

- Write: request a new source file with observable behavior, then independently assert outputs, error cases, and created-file scope.
- Refactor: start from a working fixture, request a structural change with preserved behavior, run the same behavior before and after, and independently compare outputs plus the requested structural property.

Passing alignment, preserving three literal values, or receiving hook output does not close either workflow.

## Native hook acceptance

This is a separate scenario. It needs the user to review and explicitly trust the installed hooks through the host's normal UI/policy. Do not edit trust files, bypass policy, or infer acceptance from receipt files.

For each authenticated host:

1. Review the installed plugin and hook definition under the disposable installation.
2. Use the host's normal trust prompt or supported settings UI. The user must decide whether to trust it.
3. Start a fresh session in exactly `$BOXBOX_NATIVE_ROOT/project` with the subprocess-scoped environment above.
4. Require visible SessionStart context from BoxBox in the host conversation.
5. Make one controlled still-misaligned edit to a disposable TypeScript file and require visible PostToolUse FAIL feedback.
6. Require exactly one Stop continuation, then repair the file through the normal agent workflow.
7. Require visible recovery PASS after an independent final check.
8. Save the host transcript, effective turn/sandbox context, changed file bytes, and receipt paths.

Acceptance requires the host to visibly consume the hook output and the file bytes to prove the requested transition. A receipt existing on disk, a hook command exiting zero, or the HUD rendering a receipt is insufficient by itself. If the host never offers trust, managed policy suppresses hooks, authentication expires, or the sandbox is read-only, record that external prerequisite and stop without claiming PASS.

## Evidence destinations and cleanup boundary

Write new captures under a new directory such as:

```sh
export BOXBOX_AUTH_EVIDENCE='/tmp/boxbox-readiness/native-authenticated-evidence'
mkdir -p "$BOXBOX_AUTH_EVIDENCE"
```

Never copy credential files into evidence. Record versions, candidate SHA, commands, sanitized host output, HUD/status text, and independent file assertions.

After evidence is complete, disable each HUD through its own installed plugin before deleting the temporary root:

```sh
env HOME="$BOXBOX_HOME" CLAUDE_CONFIG_DIR="$BOXBOX_CLAUDE_CONFIG" \
  node "$BOXBOX_HOME/data/boxbox/claude/0.2.4/plugin/scripts/hud/setup.mjs" claude "$BOXBOX_HOME/data/boxbox/claude/0.2.4/plugin" --disable
env HOME="$BOXBOX_HOME" BOXBOX_BIN_HOME="$BOXBOX_HOME/.local/bin" \
  node "$BOXBOX_HOME/data/boxbox/codex/0.2.4/plugin/scripts/hud/setup.mjs" codex "$BOXBOX_HOME/data/boxbox/codex/0.2.4/plugin" --disable
```

Deletion of the disposable root is a separate cleanup action. Do not delete it until all required evidence has been copied and reviewed.
