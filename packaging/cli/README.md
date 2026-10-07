# XXX CLI development candidate

This private package is a Node-only CLI development candidate that checks TypeScript and Python projects and runs
initial setup and environment diagnostics. `format` changes a file only when the project names a formatter and an
exactly matching human approval proof, the safety checks and the formatter fixed point are all confirmed for the target file.

Users can keep a personal DB separate from the plugin preset. Run these commands with the downloaded CLI.

```bash
xxx db init
xxx db status
```

The DB is stored in `$XDG_CONFIG_HOME/xxx/` or `~/.config/xxx/`. `init` creates only missing JSONL files and
keeps existing data. `status` shows only the line count, size and path per file and never prints DB contents.
The user DB stays local and is never sent to the plugin preset automatically.

## Run scope and persistent state

```bash
xxx run --root /absolute/project --json -- python3 edit_source.py
xxx status --root /absolute/project --json
```

`run` uses the same public check engine. After confirming doctor's runtimeUsable, it stores the code SHAs,
runs the child command in that root, and checks only the TypeScript/Python files that changed. It never fixes anything automatically.
Command arguments, environment variables and stdout/stderr are not stored as evidence. A normal run passes the terminal straight to the child. With `--json` the child's output goes to stderr, so
stdout under `--json` carries only the final result object.

RUNNING and the end state are stored atomically in `.xxx/runs/<runId>.json`. `status` reports recent runs and
code changes since a run (STALE). If a forced kill leaves no end record, RUNNING remains and is not treated
as completed. These records are local observations, not a security audit ledger that prevents tampering by a malicious child process.

- PASS: the changed supported files passed the check. It does not mean the whole research code is correct or that structural simplification is done.
- FAIL: a table alignment or preservation refusal was found (exit 1).
- TOOL_ERROR: preflight, run start, snapshot or check error (exit 2).
- CHILD_FAILED: the child exited with failure (exit 2); the check verdict is kept separately in validation.
- NO_CHANGES: no supported code changes to check (exit 0). Deletions alone also get this state, with the deleted list.
- UNSUPPORTED: the changed code includes a language the public check does not support (exit 2).
- NOT_INVOKED: no run evidence for this root. Installed or discovered does not mean run.

The scope is below the root, excluding `.git`, `.xxx`, `node_modules`, `.venv`, `venv`, `__pycache__`, `dist` and `build`.
Runtime and scratchpad folders are not excluded. Directory symlinks are not followed. For file symlinks the
target hash is observed, but a changed symlink is never approved. Only `.ts/.tsx/.mts/.cts/.py` are supported by the public check;
changes to JS, Java, Go, Rust, C/C++, Swift, Kotlin, YAML or shell are recorded as UNSUPPORTED.
Documents, binaries and files with other extensions are not code-check targets.

This runner is an **explicit invocation path**. The host's native hook registration, trust and output acceptance, and the agent's skill invocation,
must be verified separately. Results state `nativeHookVerified=false` and `automaticFixPerformed=false`.
It does not block changes made outside the runner; `status` detects them later by SHA comparison. So it is never described
as always triggering just by being installed. Structural simplification is the agent's skill work, and format keeps its separate approval contract.
