# BoxBox

An agent plugin for writing and refactoring TypeScript/Python code, and for aligning and checking TypeScript, Python,
strict JSON and YAML 1.2 against a "spreadsheet-style" readability contract. Same-role rows share a comparison purpose
and their syntax boundaries form
minimum-width columns. The agent owns new code and structural changes; the engine applies only human-approved alignment
rules. JSON/YAML Check and alignment-engine support is limited to runs of at least three adjacent, same-level,
single-line scalar mapping entries. The default preset still authorizes writes only for its TypeScript and Python rules.

## Choose the change scope

- **Write:** ask the agent to implement a feature with BoxBox readability. It reads approved authoring guidance before composing code.
- **Refactor:** ask the agent to improve existing structure. It examines behavior and tests, then verifies its changes; alignment alone proves neither behavior nor performance.
- **Align:** ask for whitespace alignment only. The `align` command preserves line structure, indentation and non-layout content and never runs an external formatter. Unsupported changes are refused.
- **Check:** ask for a read-only report. Missing or unsupported groups are not proof that a file follows the style.

For `.json`, `.yaml` and `.yml`, Check reports syntax as valid, invalid or parser error and lists unsupported rows.
YAML multiline values, block scalars, anchors, aliases, tags, complex keys, flow collections, sequences, directives
and document markers are outside structured alignment. Align uses the same approval and guarded write pipeline as
the code engines; without a complete applicable JSON/YAML approval proof it refuses to write.

Request a preview to see a proposal without changing the target. Write and Refactor are agent workflows, not engine
generation commands. `guide --authoring` can supply approved guidance before a file exists; examples are not write approval
for an arbitrary file. Agent authoring and Align proceed one file at a time. Engine Check and Format can select
multiple files using repeated `--file` or bounded recursive `--directory`; a batch format is atomic per file and
reports completed writes when another file fails. Whole-file approval remains required for each file.

## On-demand usage report

`/boxbox -monitor` runs the content-free session report and returns its HTML path and headline usage/change numbers.
The CLI form is `monitor --project --host auto --json`; every invocation writes `monitor-<host>.html` under the
host-provided absolute `CLAUDE_PLUGIN_DATA` or `PLUGIN_DATA`. An explicit `--html <absolute-path>` replaces the default in that same
folder. Missing plugin data is an error; the report never writes into the project. `--session <id>` replaces the
project selector, and `--no-paths` hides relative source filenames. Auto host selects Codex when a Codex thread/session
environment is present, otherwise Claude; use `--host` explicitly for standalone execution.

The report emits no transcript text, commands or source content, makes no model call and shows no dollar cost.
Legacy baselines can lack footprints, malformed fingerprints stay unknown, and exact Codex step attribution is
unavailable. Estimates and lower bounds remain labeled. The report is separate from the optional one-row status line.

## Install for Codex and Claude Code

The public entry point is `npx boxbox-plugin`. Published `boxbox-plugin@0.2.8` installs this plugin and its included
engine into a permanent user directory. Codex and Claude receive separate runtimes so either host can be repaired or
removed independently.

A marketplace install contains only this plugin, not the engine. Until the engine is configured, checks do not run: commands stop with a setup message, hooks exit without blocking the host, and only the session hook prints that message. Build and run the installer as described in the [root README](https://github.com/Woo-JongHo/boxbox#install-the-plugin). If you added this repository as a marketplace first, remove that registration before running the installer.

Formatters such as Prettier, Black and Ruff revert BoxBox alignment in the files they rewrite. `doctor`, `init`, `align` and `format` warn when a project-root configuration shows one.

For a manually configured local engine, set `BOXBOX_CLI` to the installed BoxBox `dist/cli.js` before invoking the standard shim.
The npm installer configures its own local Node launcher, including native Windows hooks.
Requirements: Node.js 22.22.3 or later, npm and the chosen host CLI (Codex or Claude Code). Python inspection and formatting additionally need a runnable `python3`.

## What this plugin runs and writes

- **Engine:** the standard launcher requires an explicit local `BOXBOX_CLI`. When it is missing, commands exit 2 with a setup message, and hooks exit 0 so they do not block the host; the session hook prints that message. It never resolves the occupied registry package. The npm installer installs its included engine tarball and downloads the pinned `typescript@7.0.2` dependency and its platform package from npm.
- **Hooks:** `check` is the default mode; it and `refactor` inspect session changes without writing source. `off` skips
  inspection. An explicit `boxbox mode align` enables approved horizontal-only alignment after matched tool calls and
  a recheck. Stop remains read-only and can request at most one continuation. Project mode overrides the global
  default; a valid `BOXBOX_MODE` overrides both. Receipts stay in host plugin data (`CLAUDE_PLUGIN_DATA`), separately
  recording mode, coverage and successful writes; they never approve rules.
- **Engine fixes:** `align` and `format` replace each target atomically only after approval, re-parsing, preservation and
  fixed-point checks pass. `align` limits changes to horizontal layout whitespace. `format` retains the optional
  external formatter pipeline, including during dry-run; it is a separate, broader operation. With a configured
  formatter, Check executes that pipeline on working copies and compares final canonical bytes without replacing the
  source; it keeps source findings separate from canonical verification.
- **Agent edits:** Write and Refactor use the host agent's editing tools within the user's request. They are not covered by the engine's atomic-write guarantee. The agent reports relevant tests, alignment coverage and unverified behavior or performance separately.
- **Inspector:** a read-only Claude Code subagent that never writes files.
- **Updates:** a session notice does not install anything. User-requested `update` verifies the installed engine version
  for the chosen host and requests a restart. The optional Claude `statusline` is a single row; update/status-line
  color honors `NO_COLOR` and `BOXBOX_COLOR=0`.

## Uninstall

```bash
claude plugin uninstall boxbox@boxbox-plugins
codex plugin remove boxbox@boxbox-plugins
```
