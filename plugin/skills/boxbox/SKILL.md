---
name: boxbox
description: Write or refactor TypeScript/Python, or align or check TypeScript, Python, JSON or YAML when the user requests BoxBox or spreadsheet-style readability, comparing same-role rows in minimum-width columns.
---

# BoxBox Code Readability

Let the reader follow execution top to bottom and compare same-role rows vertically. Rows share a comparison purpose;
columns are corresponding syntax boundaries, and cells hold their content. A comma in a nested call is not the same
axis as an outer argument separator. Use minimum-width columns without inventing work, wrappers or parameters to fill a grid.

## Choose the workflow

| Request | Workflow | Allowed change |
|---|---|---|
| Write new code using BoxBox readability | **Write** | The agent implements the requested behavior using applicable guidance. |
| Restructure existing code for BoxBox readability | **Refactor** | The agent improves structure within the authorized scope while preserving required behavior. |
| Align existing code without structural changes | **Align** | The engine changes approved horizontal whitespace only. |
| Inspect or review readability | **Check** | Report findings without changing source. |

Write and Refactor are agent workflows, not CLI generation commands. Follow an explicit mode choice. For an ambiguous
"fix" request, check first and clarify when the choice between structural changes and alignment affects the result.
Preview is an execution option for every workflow: present a proposed diff without modifying the target file.
Work one file at a time within the user's authorized scope; continue across authorized files without requiring fresh feedback for each file.

## Running the engine

Every check and fix goes through the bundled launcher. Resolve `<PLUGIN_ROOT>` from this skill location (`../..`) and run it from the root of the target repository. The standard shim requires `BOXBOX_CLI` to point to a locally installed engine; the BoxBox npm installer configures its own launcher during installation. Never fetch `boxbox` from npm: that registry name is owned by an unrelated package.

```bash
"<PLUGIN_ROOT>/scripts/boxbox" doctor                      # runtime, parser, config and approval data status
"<PLUGIN_ROOT>/scripts/boxbox" check  --file <file> --json  # read-only check
"<PLUGIN_ROOT>/scripts/boxbox" guide  --file <file> --json  # approved rules and examples that apply to this file
"<PLUGIN_ROOT>/scripts/boxbox" guide  --file <file> --authoring --json
"<PLUGIN_ROOT>/scripts/boxbox" align  --file <file> --dry-run --json
"<PLUGIN_ROOT>/scripts/boxbox" align  --file <file> --json
"<PLUGIN_ROOT>/scripts/boxbox" format --file <file> --dry-run --json
"<PLUGIN_ROOT>/scripts/boxbox" format --file <file> --json
```

- The implemented public commands accept TypeScript, Python, strict JSON and YAML 1.2 files **one at a time**. Fixing Python requires a runnable `python3`.
- Structured Check accepts `.json`, `.yaml` and `.yml`. It considers only runs of at least three adjacent,
  same-level, single-line scalar mapping entries for alignment. YAML multiline values, block scalars, anchors,
  aliases, tags, complex keys, flow collections, sequences, directives and document markers are unsupported.
  Report those rows and keep their bytes unchanged.
- Engine support is separate from write authorization. The recommended preset still approves only two
  TypeScript/Python rules. JSON/YAML Align must refuse until a complete applicable approval proof exists.
- `guide --authoring` reads approved guidance for the target language and scope, including a new or empty file.
  Its examples guide composition; they do not prove that a proposed file is approved or safe to write.
- `align` runs without an external formatter and preserves line structure, indentation and non-layout content.
  If the engine needs wrapping or another structural change, report the refusal; stay within the selected mode.
- `format` retains the formatter pipeline for explicit requests to use it. If a formatter is configured for the language, it runs first.
  `format --dry-run` also executes a configured formatter twice; inspect its command and arguments in the effective config
  before running it. Use existing authorization; ask only when executing that command is outside the authorized work.
  Human approval proof, re-parsing, preservation and a two-run fixed point must pass; report any refusal reason to the user.
- Do not look for or run other alignment scripts or bypass options.

## Write and Refactor

1. Run `guide --authoring --json` for the intended file before composing a change. For an existing file, also run
   `check --json` and read its definitions, callers and relevant tests before changing its structure.
2. Build a boundary inventory for the requested rows: name each cell, its syntax boundary and its comparison region.
   For a member call, inspect `receiver | final . | method | ( | arguments | )`; for a guard, inspect `condition | return | value`.
   Match roles and nesting depth before matching punctuation. Function signatures, bodies and call sites have separate
   regions. For member calls, early returns or nested type members, read
   [column-sharing regions](references/readability-contract.md#column-sharing-regions) before choosing widths or moving rows.
3. Author the requested implementation or structural improvement. Preserve execution order, public contracts and meaningful
   differences. An overlong exception is a reason to inspect responsibility and data flow, not permission to add abstractions
   just to shorten a column. Structural guidance is advisory; report unsupported patterns instead of inventing approval data.
   An explicit user request for a local layout change can guide this authoring pass; it does not create reusable preset
   approval or bypass the deterministic Align procedure.
   When authoring or normalizing internal imports, follow the target project's import conventions and package
   boundaries; retain relative imports where its current contract requires them. Otherwise use its configured alias
   (such as `@/`) where equivalent resolution is verified. Read its effective compiler configuration, including inherited mappings, and
   runtime/build/test resolvers first. An alias is project-relative, not a machine-absolute path. Preserve external
   package and `node:` specifiers, module evaluation order and unresolved dynamic paths. Path changes belong to
   Write/Refactor, not Align. Report unsupported alias resolution; change resolver configuration only within the
   authorized scope. Verify type checking and affected build, runtime or isolated installation paths before claiming
   migration complete.
4. For preview, show the proposed diff and distinguish checks run on a proposal from checks run on the target. For an
   authorized application, inspect the diff, run relevant syntax/type and behavior checks, and assess performance-sensitive
   changes with appropriate evidence. Alignment cannot prove behavioral equivalence or performance.
5. Where approved and requested, use Align below for final whitespace. Then run the final `check --json` and reconcile
   every requested boundary with its returned group axes. Account for missing axes, including unsupported or single-row
   boundaries. Inspect their actual columns and record manual verification or an unresolved coverage gap. Completion requires
   each requested boundary to be verified or explicitly reported unresolved, alongside remaining findings and checks not run.
   When the user or project instructions require issue-history records, use that schema within the authorized scope to
   retain the reproduction, cause, decision and verification evidence, including failed attempts and unresolved work.

## Check and Align

1. Run `check --json`. Read `syntax.status` (`valid`, `invalid` or parser `error`), `formatReadiness` (approval
   eligibility; write verification is still `not-run`), `unsupported`, `groups` and their `PASS`, `FIXABLE`,
   `REFUSE` states. A refused group stays unchanged by alignment.
2. Read `guide --json` for applicable approved rules. With no approved rule, report the candidate and missing evidence;
   do not align it by hand, auto-approve it or use a raw writer.
3. For Check, report findings. For Align preview, run `align --dry-run --json`. For authorized application, inspect the
   dry-run result and then run `align --json`; report refusal reasons without falling back to `format` or Refactor.
4. After application, rerun `check --json`, reconcile user-requested boundaries with the final returned axes, and report
   missing coverage alongside the remaining `misaligned` count. Zero detected groups
   or zero misalignment does not prove that unsupported code follows the requested style. Report only validations actually run.

## Rule documents

Read the documents in this folder when a judgment is needed.

- `references/charter.md` — principles and safety invariants
- `references/grammar.md` — grammar units, patterns, roles, paragraphs (split with a blank line when the property differs)
- `references/readability-contract.md` — confirmed rules, discarded rules, column-check order
- `references/typescript-grid-template.md` — per-role TypeScript table templates

## Authoring hooks

The plugin hooks check TypeScript, Python, JSON and YAML files changed during the session, read-only, and report the result. They never fix anything automatically.
The npm-installed launcher requires the host's plugin data folder and writes receipts there. Direct CLI hooks installed
with `hooks install` can fall back to `.boxbox/hooks` when the host provides no data folder. Source files stay read-only.
