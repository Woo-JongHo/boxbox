# BoxBox

An agent plugin for writing and refactoring TypeScript/Python code, and for aligning and checking TypeScript, Python,
strict JSON and YAML 1.2 against a "spreadsheet-style" readability contract. Same-role rows share a comparison purpose
and their syntax boundaries form
minimum-width columns. The agent owns new code and structural changes; the engine applies only human-approved alignment
rules. JSON/YAML Check and alignment-engine support is limited to runs of at least three adjacent, same-level,
single-line scalar mapping entries. The default preset still authorizes writes only for two TypeScript/Python rules.

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
for an arbitrary file. Authorized multi-file work proceeds one file at a time.

## Install for Codex and Claude Code

The intended entry point is the npm installer: `npx boxbox-plugin`. It installs this plugin and its included engine into a permanent user directory.
The npm `boxbox-plugin` candidate was unregistered when checked; this is not a reservation. npm authentication is complete; publication remains pending.

For a manually configured local engine, set `BOXBOX_CLI` to the installed BoxBox `dist/cli.js` before invoking the standard shim.
The npm installer configures its own local Node launcher, including native Windows hooks.
Requirements: Node.js 22.22.3 or later, npm and the chosen host CLI (Codex or Claude Code). Python fixes additionally need a runnable `python3`.

## What this plugin runs and writes

- **Engine:** the standard launcher requires an explicit local `BOXBOX_CLI` and refuses to run when it is missing. It never resolves the occupied registry package. The npm installer installs its included engine tarball and downloads the pinned `typescript@7.0.2` dependency and its platform package from npm.
- **Hooks:** at session start, after edits and when a response ends, they check TypeScript, Python, JSON and YAML files changed
  during the session, read-only. They never fix anything automatically. Records are written only to the host's plugin
  data folder (`CLAUDE_PLUGIN_DATA`) and are deleted with the plugin. No files are created in the target project.
- **Engine fixes:** `align` and `format` replace one target atomically only after approval, re-parsing, preservation and fixed-point checks pass. `align` limits changes to horizontal layout whitespace. `format` retains the optional external formatter pipeline, including during dry-run; it is a separate, broader operation.
- **Agent edits:** Write and Refactor use the host agent's editing tools within the user's request. They are not covered by the engine's atomic-write guarantee. The agent reports relevant tests, alignment coverage and unverified behavior or performance separately.
- **Inspector:** a read-only Claude Code subagent that never writes files.

## Uninstall

```bash
claude plugin uninstall boxbox@boxbox-plugins
codex plugin remove boxbox@boxbox-plugins
```
