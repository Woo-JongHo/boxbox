# Write, Refactor, Align and Check

BoxBox helps an agent compose code as comparable rows and columns, then checks the result. Choose a workflow by the
change you want to permit. The public engine checks and has alignment implementations for TypeScript, Python, strict
JSON and YAML 1.2. Write authorization remains rule-specific; the default preset still contains only two approved
TypeScript/Python rules.

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

When writing new code the agent also designs the rows first: for each group of three or more same-role values it names
the shared columns and writes every value as one row of them (for example one reader shape for several options, one field
per row, or `.map` rows over comparable lists), instead of aligning an arbitrary shape afterwards. This is guidance,
not approval, and it carries limits: no wrappers added only to fill a column, other roles stay outside the table,
behavior is preserved, and hot paths are measured. See [grid-first authoring](../../product/rules/references/readability-contract.md#grid-first-authoring).

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

### Structured JSON and YAML

For `.json`, `.yaml` and `.yml`, Check validates syntax and considers only runs of at least three adjacent,
same-level, single-line scalar mapping entries. Align can adjust horizontal whitespace around their key/colon/value
columns through the same approval, parser, preservation, fixed-point and atomic-write pipeline. A valid file may still
report unsupported rows; those bytes remain unchanged while eligible supported groups are processed. A `REFUSE` group
or invalid syntax prevents the file from being written.

JSON uses strict `JSON.parse` syntax. YAML uses the YAML 1.2 core schema. YAML block scalars, anchors, aliases, tags,
complex keys, flow collections, sequence entries, directives and document markers are reported as unsupported for
alignment. Multiline mapping values and non-scalar mapping values are also unsupported. These boundaries describe
engine coverage, not default permission: the recommended preset has no approved JSON or YAML rule, so ordinary
structured Align remains ineligible until a complete applicable approval proof is supplied.

## Understand verification

| Result | What it establishes | What it does not establish |
|---|---|---|
| Authoring guidance | Approved rules and examples are available for the target language/scope | Every proposed row is approved or safe to write |
| Check | Syntax status plus findings for groups the engine detected | Complete style coverage, behavior or performance |
| Successful Align | The engine's approval and write-safety checks passed for the transformation | The program is functionally correct or fast |
| Write/Refactor verification | The specific syntax, type, test or performance checks actually run | Guarantees beyond those checks |

`formatReadiness` in a check report is eligibility, not completed write verification. Zero misalignment or zero detected
groups is not a whole-file style certificate. The agent reports refused and unsupported regions, relevant tests and any
checks not run. Structural changes require behavior verification and performance evidence when the changed work warrants it.

Plugin hooks perform read-only checks after edits and at session boundaries; they never automatically fix code. For
installation, see [the main README](../../README.md).
