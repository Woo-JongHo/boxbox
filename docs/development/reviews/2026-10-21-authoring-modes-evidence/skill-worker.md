# BoxBox mode skill implementation

## Scope and ownership

Changed only the four product plugin template files listed below and added docs/user/modes.md. No engine, generated plugin, root README, approval proof, or rule reference files were changed by this worker. No commit, push, install, or public release action was performed.

## Behavior

- Write and Refactor are agent-owned workflows; they request approved authoring guidance before composition and explicitly distinguish alignment results from behavior/performance verification.
- Align uses the new standalone align command and its dry-run; it does not invoke configured formatters or silently escalate to structural edits.
- Check stays read-only. Zero detected groups and zero misalignment do not establish complete style coverage.
- Routing respects explicit requests. Ambiguous fixes start with inspection and clarify only a consequential difference in change scope.
- Authorized multiple files are processed one at a time without artificial per-file feedback stops. Preview does not modify target source.
- Guidance examples do not constitute write proof, and missing rules cannot be auto-approved or bypassed through raw writers.
- Discovery descriptions target BoxBox/spreadsheet readability rather than all coding. TypeScript and Python remain the implemented scope; JSON/YAML remain planned.
- Existing launcher projection line and exact quoted launcher placeholder are preserved. No packaged supporting files were added.

## Verification

- python3 /Users/jonghoPro/.codex/skills/.system/skill-creator/scripts/quick_validate.py product/plugin/skills/boxbox: exit 0, Skill is valid!
- JSON.parse of both template manifests: passed.
- Exact projectDocument placeholder substitution and forbidden-launcher regex replicated against the edited skill: passed.
- Required /^Every check and fix goes through.*$/mu line: present.
- git diff --check for owned tracked files: passed.
- Scan owned prose for TODO/FIXME/test.skip/.only/PLACEHOLDER: no matches.
- New user document links were resolved against repository paths: README.md and docs/user/hud.md exist.

## Limits and integration handoff

Parent owns engine APIs, generated sync, complete tests and independent review. Commands in these documents require that integration before shipping. No behavioral forward-test with a real host agent was run by this worker. Parent should include new/empty-file writing, preview-only refactoring, alignment refusal without fallback, and unsupported-language/nonactivation scenarios in independent verification.

PostToolUse FAIL notifications after prose writes identified concurrent TypeScript engine changes (alignment-only.ts and format-pipeline.ts); prose edits themselves were applied and validated. This worker did not alter those files.

The canonical workspace AGENTS.md was read. Its sibling LAYERS.md was absent; no replacement was inferred. Project-local English prose policy applied.

## Owned diff

```diff
diff --git a/product/plugin/.claude-plugin/plugin.json b/product/plugin/.claude-plugin/plugin.json
index 9fc9b51..2a4e61f 100644
--- a/product/plugin/.claude-plugin/plugin.json
+++ b/product/plugin/.claude-plugin/plugin.json
@@ -2,7 +2,7 @@
 	"name": "boxbox",
 	"displayName": "BoxBox",
 	"version": "@BOXBOX_VERSION@",
-	"description": "Inspects TypeScript and Python files one at a time against tabular readability rules and formats only through human-approved rules, plus a read-only inspector.",
+	"description": "Guides writing and refactoring TypeScript and Python code for tabular readability, with read-only checks, human-approved whitespace alignment and a read-only inspector.",
 	"author": {
 		"name": "Woo-JongHo"
 	},
diff --git a/product/plugin/.codex-plugin/plugin.json b/product/plugin/.codex-plugin/plugin.json
index 7609c92..f7f64da 100644
--- a/product/plugin/.codex-plugin/plugin.json
+++ b/product/plugin/.codex-plugin/plugin.json
@@ -1,7 +1,7 @@
 {
 	"name": "boxbox",
 	"version": "@BOXBOX_VERSION@",
-	"description": "Inspects TypeScript and Python files one at a time against tabular readability rules and formats only through human-approved rules.",
+	"description": "Guides writing and refactoring TypeScript and Python code for tabular readability, with read-only checks and human-approved whitespace alignment.",
 	"author": {
 		"name": "Woo-JongHo"
 	},
@@ -15,8 +15,8 @@
 	"skills": "./skills/",
 	"interface": {
 		"displayName": "BoxBox",
-		"shortDescription": "Tabular readability checks for TypeScript and Python",
-		"longDescription": "Checks one TypeScript or Python file at a time against a spreadsheet-style readability contract and formats only through human-approved rules.",
+		"shortDescription": "Write, refactor and align code for tabular readability",
+		"longDescription": "Guides agent-owned writing and refactoring of TypeScript and Python code, then checks detected tables and aligns approved whitespace one file at a time. Structural changes require separate behavior verification.",
 		"developerName": "Woo-JongHo",
 		"category": "Coding",
 		"capabilities": [
diff --git a/product/plugin/README.md b/product/plugin/README.md
index d87df0e..ab87335 100644
--- a/product/plugin/README.md
+++ b/product/plugin/README.md
@@ -1,8 +1,20 @@
 # BoxBox
 
-An agent plugin that checks TypeScript and Python files, one at a time, against a "spreadsheet-style" readability
-contract. It gives same-role rows the same structure and aligns syntax boundaries into minimum-width columns. Only
-human-approved rules are applied automatically, and rows that cannot be split losslessly are never rewritten.
+An agent plugin for writing, refactoring, aligning and checking TypeScript and Python code against a
+"spreadsheet-style" readability contract. Same-role rows share a comparison purpose and their syntax boundaries form
+minimum-width columns. The agent owns new code and structural changes; the engine applies only human-approved alignment
+rules. JSON and YAML are planned and are not accepted by the public commands yet.
+
+## Choose the change scope
+
+- **Write:** ask the agent to implement a feature with BoxBox readability. It reads approved authoring guidance before composing code.
+- **Refactor:** ask the agent to improve existing structure. It examines behavior and tests, then verifies its changes; alignment alone proves neither behavior nor performance.
+- **Align:** ask for whitespace alignment only. The `align` command preserves line structure, indentation and non-layout content and never runs an external formatter. Unsupported changes are refused.
+- **Check:** ask for a read-only report. Missing or unsupported groups are not proof that a file follows the style.
+
+Request a preview to see a proposal without changing the target. Write and Refactor are agent workflows, not engine
+generation commands. `guide --authoring` can supply approved guidance before a file exists; examples are not write approval
+for an arbitrary file. Authorized multi-file work proceeds one file at a time.
 
 ## Install for Codex and Claude Code
 
@@ -11,7 +23,7 @@ The npm `boxbox-plugin` candidate was unregistered when checked; this is not a r
 
 For a manually configured local engine, set `BOXBOX_CLI` to the installed BoxBox `dist/cli.js` before invoking the standard shim.
 The npm installer configures its own local Node launcher, including native Windows hooks.
-Requirements: Node.js 22.22.3 or later, npm and Codex CLI. Python fixes additionally need a runnable `python3`.
+Requirements: Node.js 22.22.3 or later, npm and the chosen host CLI (Codex or Claude Code). Python fixes additionally need a runnable `python3`.
 
 ## What this plugin runs and writes
 
@@ -19,8 +31,8 @@ Requirements: Node.js 22.22.3 or later, npm and Codex CLI. Python fixes addition
 - **Hooks:** at session start, after edits and when a response ends, they check TypeScript and Python files changed
   during the session, read-only. They never fix anything automatically. Records are written only to the host's plugin
   data folder (`CLAUDE_PLUGIN_DATA`) and are deleted with the plugin. No files are created in the target project.
-- **Fixes:** a single target file is replaced atomically only when the user runs `format` and human-approved rules,
-  re-parsing, preservation and fixed-point checks all pass. No external formatter is required; a configured formatter runs first, including during dry-run.
+- **Engine fixes:** `align` and `format` replace one target atomically only after approval, re-parsing, preservation and fixed-point checks pass. `align` limits changes to horizontal layout whitespace. `format` retains the optional external formatter pipeline, including during dry-run; it is a separate, broader operation.
+- **Agent edits:** Write and Refactor use the host agent's editing tools within the user's request. They are not covered by the engine's atomic-write guarantee. The agent reports relevant tests, alignment coverage and unverified behavior or performance separately.
 - **Inspector:** a read-only Claude Code subagent that never writes files.
 
 ## Uninstall
diff --git a/product/plugin/skills/boxbox/SKILL.md b/product/plugin/skills/boxbox/SKILL.md
index 212bfdd..6c2c7c8 100644
--- a/product/plugin/skills/boxbox/SKILL.md
+++ b/product/plugin/skills/boxbox/SKILL.md
@@ -1,14 +1,27 @@
 ---
 name: boxbox
-description: Use when inspecting, fixing and verifying TypeScript and Python files one at a time against tabular readability rules, where same-role rows share one structure and their syntax boundaries are aligned into minimum-width columns.
+description: Write, refactor, align or check TypeScript and Python code when the user requests BoxBox or spreadsheet-style readability, comparing same-role rows in minimum-width columns.
 ---
 
 # BoxBox Code Readability
 
-Let the reader follow the execution flow from top to bottom and compare same-role rows vertically.
-Treat code like spreadsheet data — rows, columns and cells — but first give every same-role row **the same minimal
-composition**, then pin the remaining syntax boundaries into minimum-width columns. Do not impose a general formatter's
-taste; apply automatically only rules a human has approved.
+Let the reader follow execution top to bottom and compare same-role rows vertically. Rows share a comparison purpose;
+columns are corresponding syntax boundaries, and cells hold their content. A comma in a nested call is not the same
+axis as an outer argument separator. Use minimum-width columns without inventing work, wrappers or parameters to fill a grid.
+
+## Choose the workflow
+
+| Request | Workflow | Allowed change |
+|---|---|---|
+| Write new code using BoxBox readability | **Write** | The agent implements the requested behavior using applicable guidance. |
+| Restructure existing code for BoxBox readability | **Refactor** | The agent improves structure within the authorized scope while preserving required behavior. |
+| Align existing code without structural changes | **Align** | The engine changes approved horizontal whitespace only. |
+| Inspect or review readability | **Check** | Report findings without changing source. |
+
+Write and Refactor are agent workflows, not CLI generation commands. Follow an explicit mode choice. For an ambiguous
+"fix" request, check first and clarify when the choice between structural changes and alignment affects the result.
+Preview is an execution option for every workflow: present a proposed diff without modifying the target file.
+Work one file at a time within the user's authorized scope; continue across authorized files without requiring fresh feedback for each file.
 
 ## Running the engine
 
@@ -18,26 +31,49 @@ Every check and fix goes through the bundled launcher. Resolve `<PLUGIN_ROOT>` f
 "<PLUGIN_ROOT>/scripts/boxbox" doctor                      # runtime, parser, config and approval data status
 "<PLUGIN_ROOT>/scripts/boxbox" check  --file <file> --json  # read-only check
 "<PLUGIN_ROOT>/scripts/boxbox" guide  --file <file> --json  # approved rules and examples that apply to this file
+"<PLUGIN_ROOT>/scripts/boxbox" guide  --file <file> --authoring --json
+"<PLUGIN_ROOT>/scripts/boxbox" align  --file <file> --dry-run --json
+"<PLUGIN_ROOT>/scripts/boxbox" align  --file <file> --json
 "<PLUGIN_ROOT>/scripts/boxbox" format --file <file> --dry-run --json
 "<PLUGIN_ROOT>/scripts/boxbox" format --file <file> --json
 ```
 
-- The first public stage accepts TypeScript and Python files **one at a time**. Fixing Python requires a runnable `python3`.
-- `format` aligns approved tables directly without an external formatter. If one is configured for the language, it runs first.
+- The implemented public commands accept TypeScript and Python files **one at a time**. JSON/YAML are planned, not supported. Fixing Python requires a runnable `python3`.
+- `guide --authoring` reads approved guidance for the target language and scope, including a new or empty file.
+  Its examples guide composition; they do not prove that a proposed file is approved or safe to write.
+- `align` runs without an external formatter and preserves line structure, indentation and non-layout content.
+  If the engine needs wrapping or another structural change, report the refusal; stay within the selected mode.
+- `format` retains the formatter pipeline for explicit requests to use it. If a formatter is configured for the language, it runs first.
   `format --dry-run` also executes a configured formatter twice; inspect its command and arguments in the effective config
   before running it. Use existing authorization; ask only when executing that command is outside the authorized work.
   Human approval proof, re-parsing, preservation and a two-run fixed point must pass; report any refusal reason to the user.
 - Do not look for or run other alignment scripts or bypass options.
 
-## Workflow
+## Write and Refactor
+
+1. Run `guide --authoring --json` for the intended file before composing a change. For an existing file, also run
+   `check --json` and read its definitions, callers and relevant tests before changing its structure.
+2. Identify same-role rows, corresponding cells and syntax axes. Keep necessary differences visible. Function signatures,
+   function bodies and call sites are separate comparison regions; unrelated functions need not share a shape.
+3. Author the requested implementation or structural improvement. Preserve execution order, public contracts and meaningful
+   differences. An overlong exception is a reason to inspect responsibility and data flow, not permission to add abstractions
+   just to shorten a column. Structural guidance is advisory; report unsupported patterns instead of inventing approval data.
+4. For preview, show the proposed diff and distinguish checks run on a proposal from checks run on the target. For an
+   authorized application, inspect the diff, run relevant syntax/type and behavior checks, and assess performance-sensitive
+   changes with appropriate evidence. Alignment cannot prove behavioral equivalence or performance.
+5. Run `check --json` on the resulting file. Where approved and requested, use the Align procedure below for final whitespace.
+   Report checked groups, remaining findings, unsupported regions and any verification not run.
+
+## Check and Align
 
-1. Handle only the one file the user named. Wait for the user's feedback before moving to the next file.
-2. Read `formatReadiness` (approval eligibility; write verification is still `not-run`), the groups (`groups`) and states (`PASS`, `FIXABLE`, `REFUSE`) from `check --json`. `REFUSE` means the structure
-   cannot be split losslessly, so do not fix those rows.
-3. Check the approved rules with `guide --json`. For an explicit fix/format request, apply approved rules with
-   `format --dry-run` → `format`. For a check/review request, report the findings.
-4. If there are no approved rules, do not align by hand; report the candidate groups and the evidence to the user.
-5. After a fix, rerun `check --json` to confirm `misaligned=0`, and never claim a verification passed that you did not run.
+1. Run `check --json`. Read `formatReadiness` (approval eligibility; write verification is still `not-run`), `groups`
+   and their `PASS`, `FIXABLE`, `REFUSE` states. A refused group stays unchanged by alignment.
+2. Read `guide --json` for applicable approved rules. With no approved rule, report the candidate and missing evidence;
+   do not align it by hand, auto-approve it or use a raw writer.
+3. For Check, report findings. For Align preview, run `align --dry-run --json`. For authorized application, inspect the
+   dry-run result and then run `align --json`; report refusal reasons without falling back to `format` or Refactor.
+4. After application, rerun `check --json` and report the remaining `misaligned` count and coverage. Zero detected groups
+   or zero misalignment does not prove that unsupported code follows the requested style. Report only validations actually run.
 
 ## Rule documents
 

```

## Added user document

# Write, Refactor, Align and Check

BoxBox helps an agent compose code as comparable rows and columns, then checks the result. Choose a workflow by the
change you want to permit. The public engine currently accepts TypeScript and Python; JSON and YAML remain planned.

| Workflow | Use it for | Who changes the file? |
|---|---|---|
| Write | Implementing requested behavior using BoxBox readability | The host agent |
| Refactor | Improving existing structure while preserving required behavior | The host agent |
| Align | Aligning approved tables without changing structure | The engine |
| Check | Inspecting existing code without source changes | Nobody |

Write and Refactor are skill workflows, not CLI generation commands. Their names do not grant permission to change
unrelated files or add abstractions just to fill columns. Files in an authorized multi-file task are handled one at a time.

## Ask the agent

- "Use BoxBox to write this TypeScript function. Keep the requested behavior and compare same-role rows."
- "Use BoxBox Refactor on this Python file. Preserve its API and behavior, and verify the changed paths."
- "Use BoxBox Align on this file. Change only horizontal layout whitespace."
- "Use BoxBox Check and report supported, misaligned and unverified regions. Do not modify the file."

Add "preview only" to request a proposed diff without changing the target. For Write and Refactor, the agent prepares
the proposal; for Align, the engine supports `--dry-run`. A preview is not evidence that the target file was changed or
that tests passed. An ambiguous "fix this" request starts with inspection; the agent clarifies the change scope when needed.

## Guidance before writing

From the target repository root, using your installed BoxBox CLI or the plugin's configured launcher:

```bash
boxbox guide --file src/example.ts --authoring --json
```

This read-only request returns approved guidance for the file's language and scope even when the file is empty or does
not exist yet. The examples are composition guidance, not approval to rewrite arbitrary code. Ordinary `guide --file`
remains based on groups found in an existing file. Missing guidance is reported; it is not replaced with invented approval.

The agent identifies a comparison purpose before choosing axes. Function signatures, bodies and calls are separate
regions. Necessary differences remain visible. A long expression can justify inspecting responsibility and data flow,
but does not automatically justify extraction, parameter changes or new wrappers.

## Align an existing file

```bash
boxbox check --file src/example.ts --json
boxbox guide --file src/example.ts --json
boxbox align --file src/example.ts --dry-run --json
boxbox align --file src/example.ts --json
boxbox check --file src/example.ts --json
```

Align preserves physical line structure, indentation and non-layout content. It does not reorder statements, rename
symbols, extract functions, wrap lines or execute an external formatter. If an engine proposal requires one of those
changes, alignment is refused. Refusal does not authorize a broader workflow or bypass the approval gate.

The engine requires applicable human-approved rules, parser availability, preservation and fixed-point checks before
replacing the file atomically. A dry-run also verifies the proposal but leaves the target untouched. Python alignment
requires a runnable `python3`.

The existing `format` command is retained separately. A configured external formatter runs before alignment, including
during `format --dry-run`. Use it when that broader pipeline is intended; use Align for whitespace-only work.

## Understand verification

| Result | What it establishes | What it does not establish |
|---|---|---|
| Authoring guidance | Approved rules and examples are available for the target language/scope | Every proposed row is approved or safe to write |
| Check | Findings for groups the engine detected | Full syntax validity, complete style coverage, behavior or performance |
| Successful Align | The engine's approval and write-safety checks passed for the transformation | The program is functionally correct or fast |
| Write/Refactor verification | The specific syntax, type, test or performance checks actually run | Guarantees beyond those checks |

`formatReadiness` in a check report is eligibility, not completed write verification. Zero misalignment or zero detected
groups is not a whole-file style certificate. The agent reports refused and unsupported regions, relevant tests and any
checks not run. Structural changes require behavior verification and performance evidence when the changed work warrants it.

Plugin hooks perform read-only checks after edits and at session boundaries; they never automatically fix code. For
installation and host-specific status display, see [the main README](../../README.md) and [HUD](hud.md).
