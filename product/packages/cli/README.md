# BoxBox CLI development candidate

This private package is a Node-only CLI development candidate that checks TypeScript, Python, strict JSON and YAML 1.2 projects and runs
initial setup and environment diagnostics. `format` aligns approved tables directly. An external formatter is optional;
when configured, it runs before BoxBox in both format and dry-run, and failures stop the operation. Exact human approval proof, parsing, preservation
and a two-run byte fixed point must all pass before the original file is replaced.

For horizontal whitespace only, use `align --file path.py --dry-run --json` to inspect line-by-line edits, then
`align --file path.py --json` to apply them. Align never runs an external formatter and preserves newlines,
indentation and non-layout content. `guide --file new/path.py --authoring --json` returns scoped approved guidance
without creating a file; `verification: "not-run"` and `writeAuthorized: false` distinguish advice from verification.
Write and Refactor are agent skill workflows, not CLI generation commands. Structured Check recognizes `.json`,
`.yaml` and `.yml`; its alignment engine handles only runs of at least three adjacent, same-level, single-line scalar
mapping entries. YAML multiline values, block scalars, anchors, aliases, tags, complex keys, flow collections,
sequences, directives and document markers are unsupported for alignment and stay unchanged.

The recommended preset still includes only two narrowly approved rules: top-level TypeScript single-call variable declarations
(two or more rows, `.ts`) and Python simple name assignments (three or more rows at the same indentation). Other patterns
require their own approval. JSON/YAML Check and alignment-engine support do not authorize writes; structured Align
requires its own complete applicable approval proof. `check --json` reports `syntax.status`, unsupported regions and
`formatReadiness.approvalEligible`; `verification=not-run` means that
`format --dry-run` must still verify the actual write pipeline. `doctor` reports runtime and configuration readiness
separately from release acceptance. Neither command promises that an arbitrary file is writable.

Users can keep a personal DB separate from the plugin preset. Run these commands with the downloaded CLI.

```bash
boxbox db init
boxbox db status
```

The DB is stored in `$XDG_CONFIG_HOME/boxbox/` or `~/.config/boxbox/`. `init` creates only missing JSONL files and
keeps existing data. `status` shows only the line count, size and path per file and never prints DB contents.
The user DB stays local and is never sent to the plugin preset automatically.

## Run scope and persistent state

```bash
boxbox run --root /absolute/project --json -- python3 edit_source.py
boxbox status --root /absolute/project --json
```

`run` uses the same public check engine. After confirming doctor's runtimeUsable, it stores the code SHAs,
runs the child command in that root, and checks only the TypeScript, Python, JSON and YAML files that changed. It never fixes anything automatically.
Command arguments, environment variables and stdout/stderr are not stored as evidence. A normal run passes the terminal straight to the child. With `--json` the child's output goes to stderr, so
stdout under `--json` carries only the final result object.

RUNNING and the end state are stored atomically in `.boxbox/runs/<runId>.json`. `status` reports recent runs and
code changes since a run (STALE). If a forced kill leaves no end record, RUNNING remains and is not treated
as completed. These records are local observations, not a security audit ledger that prevents tampering by a malicious child process.

- PASS: the changed supported files passed the check. It does not mean the whole research code is correct or that structural simplification is done.
- FAIL: a table alignment or preservation refusal was found (exit 1).
- TOOL_ERROR: preflight, run start, snapshot or check error (exit 2).
- CHILD_FAILED: the child exited with failure (exit 2); the check verdict is kept separately in validation.
- NO_CHANGES: no supported code changes to check (exit 0). Deletions alone also get this state, with the deleted list.
- UNSUPPORTED: the changed code includes a language the public check does not support (exit 2).
- NOT_INVOKED: no run evidence for this root. Installed or discovered does not mean run.

The scope is below the root, excluding `.git`, `.boxbox`, `node_modules`, `.venv`, `venv`, `__pycache__`, `dist` and `build`.
Runtime and scratchpad folders are not excluded. Directory symlinks are not followed. For file symlinks the
target hash is observed, but a changed symlink is never approved. Only `.ts/.tsx/.mts/.cts/.py/.json/.yaml/.yml` are supported by the public check;
changes to JS, Java, Go, Rust, C/C++, Swift, Kotlin or shell are recorded as UNSUPPORTED.
Documents, binaries and files with other extensions are not code-check targets.

This runner is an **explicit invocation path**. The host's native hook registration, trust and output acceptance, and the agent's skill invocation,
must be verified separately. Results state `nativeHookVerified=false` and `automaticFixPerformed=false`.
It does not block changes made outside the runner; `status` detects them later by SHA comparison. So it is never described
as always triggering just by being installed. Structural simplification is the agent's skill work, and format keeps its separate approval contract.
