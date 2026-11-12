# Write, Refactor, Align and Check

BoxBox helps an agent compose code as comparable rows and columns, then checks the result. Choose a workflow by the
change you want to permit. The public engine checks and has alignment implementations for TypeScript, Python, strict
JSON and YAML 1.2. Automatic engine writes remain rule-specific; the default preset contains only a few approved
TypeScript and Python rules.

| Workflow | Use it for | Who changes the file? |
|---|---|---|
| Write | Implementing requested behavior using BoxBox readability | The host agent |
| Refactor | Improving existing structure while preserving required behavior | The host agent |
| Align | Aligning approved tables without changing structure | The engine |
| Check | Inspecting original-source syntax and readability with `check --source` | Nobody |

Write and Refactor are skill workflows, not CLI generation commands. Their names do not grant permission to change
unrelated files or add abstractions just to fill columns. Agent authoring proceeds one file at a time. Engine `check`
and `format` also accept repeated `--file` arguments or a bounded recursive `--directory` selection; `align` and
`guide` retain a single-file scope.

## Ask the agent

- "Use BoxBox to write this TypeScript function. Keep the requested behavior and compare same-role rows."
- "Use BoxBox Refactor on this Python file. Preserve its API and behavior, and verify the changed paths."
- "Use BoxBox Align on this file. Change only horizontal layout whitespace."
- "Use BoxBox Check and report supported, misaligned and unverified regions. Do not modify the file."

Add "preview only" to request a proposed diff without changing the target. For Write and Refactor, the agent prepares
the proposal; for Align, the engine supports `--dry-run`. A preview is not evidence that the target file was changed or
that tests passed. An ambiguous "fix this" request starts with inspection; the agent clarifies the change scope when needed.

## Authorized authoring and automatic alignment

An explicit request to bring existing code into BoxBox's row-and-column form selects Refactor within that request's
scope. A prior Align refusal does not cancel this later authoring request. It also does not grant permission to
silently broaden an Align-only task. The host agent authors local structure and measured layout, then verifies it;
the automatic engine still requires exact human-approved conventions.

Missing automatic-write approval is not itself an authoring blocker. Source Check may pass with zero misalignment
and zero refusals while `formatReadiness.approvalEligible` remains false. This says that the current detected layout
passes inspection, not that an automatic rewrite is approved. Do not manufacture approval records or use an alternate
aligner to rewrite unapproved engine groups.

For an authorized authoring task, inspect the comparison purpose and syntax-defined axes before editing each file.
Keep execution order, meaningful differences and public contracts; do not add work or wrappers just to fill columns.
A parser coverage refusal requires an engine diagnosis and regression, not a change to correct application expressions
solely to hide the coverage defect. Invalid syntax, actual preservation failures and unavailable parsers remain blockers.

For a requested full-change result, enumerate staged, unstaged and relevant untracked files. Run source Check on every
supported selected file, account for requested and undetected axes, and explicitly review documents, generated records,
vendor material and unsupported files. Freeze the same candidate for project checks and authorized publication.
A session-hook receipt is evidence for its observed scope, not a whole-commit certificate.

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

For TypeScript the same response lists `columnSets` (each registered row kind with its ordered columns, marking the
kinds an approved rule covers), their exact `approvedKeys`, and `axisNotes` (what each column means). The kind-level
`approved` flag means that an approved variant exists; it does not approve every column or context in that vocabulary.
Python guidance lists representative variants
with their exact legacy approval axes. Its `semanticKind` and `sourceContext` describe detected rows; they do not
replace the `table`/`pair` kind or change approval keys. These fields are row-design vocabulary, not approval. After
writing, `boxbox check --source --file <file> --expect-axis <axis> --json` reports which of the axes you meant are carried by a
detected group (`covered`), which are not (`missing`) and which are not axis names (`unknown`); it does not change the
exit status.

The agent identifies a comparison purpose before choosing axes. Function signatures, bodies and calls are separate
regions. Necessary differences remain visible. A long expression can justify inspecting responsibility and data flow,
but does not automatically justify extraction, parameter changes or new wrappers.

## Align an existing file

```bash
boxbox check --source --file src/example.ts --json
boxbox guide --file src/example.ts --json
boxbox align --file src/example.ts --dry-run --json
boxbox align --file src/example.ts --json
boxbox check --source --file src/example.ts --json
```

The `--source` flag keeps preflight and after-alignment checks on original source, even in a formatter project. It
reads syntax, detected groups and approval facts without executing the formatter or staging a formatting working copy.
The same flag works with repeated files or a directory selection; it does not approve writes.

Align preserves physical line structure, indentation and non-layout content. It does not reorder statements, rename
symbols, extract functions, wrap lines or execute an external formatter. If an engine proposal requires one of those
changes, alignment is refused. Refusal does not authorize a broader workflow or bypass the approval gate.

The engine requires applicable human-approved rules, parser availability, preservation and fixed-point checks before
replacing the file atomically. A dry-run also verifies the proposal but leaves the target untouched. Python alignment
requires a runnable `python3`.

TypeScript preservation uses the actual parser's regular-expression and division roles when source context is
available. This distinguishes division after a call from a regex statement after a control header, and a unary
negated regex from a TypeScript non-null expression. Exact regex/template/comment bytes remain protected.
The context-free scanner keeps its conservative refusal for ambiguous slashes; parser unavailability is not
permission to guess. Source inspection, the public write pipeline and its final token/AST preservation checks
must use the same parser context rather than accepting a source check while refusing the identical write later.

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

## Formatter projects and multiple files

A formatter such as Prettier, Black or Ruff can remove BoxBox padding. Configure one formatter for the language, then
have your editor, pre-commit hook and CI call BoxBox instead of invoking that formatter directly:

```bash
boxbox check --file src/first.ts --file src/second.ts --json
boxbox check --directory src --json
boxbox format --directory src --dry-run --json
boxbox format --directory src --json
```

With a configured formatter, default `check` without `--source` verifies `boxbox(formatter(file))` on working copies through the same approval,
parser, preservation and two-cycle fixed-point gates as `format`, preserving the source. It reports the original
source's `results`, `syntax` and `formatReadiness`, plus `canonical` verification. Exit `0` means the final canonical
bytes equal the original, `1` means they differ, and `2` means an error or refusal. A formatter may remove padding and
BoxBox restore it, so the intermediate change flags alone do not decide the result. Without a configured formatter,
Check keeps its existing source-inspection behavior and exit codes. Read the effective formatter command and arguments
before running either canonical Check or `format --dry-run`; both execute that configured program and need working-copy
write permission. Use `check --source` for original-source readability inspection in a read-only environment.
Canonical Check also takes the same exclusive per-file writer lock. Concurrent requests for that target can fail;
after a killed process, inspect and remove only its stale `.<filename>.boxbox-write.lock` before retrying. Source-only Check
does not create the working copy or writer lock.

Directory selection skips `.git`, `.boxbox`, `node_modules` and `dist`, uses bounded recursive traversal, and rejects
symbolic links, duplicate targets and paths outside the root. It is path-based rather than a Git-ignore filter; select
the intended source directories. Supplied POSIX paths containing a literal backslash are refused because they cannot be
represented consistently by every approval and runtime adapter. Directory preselection validates entries before
language filtering, so an unsupported non-source name can also stop the batch. A hook inspection error leaves that
event without a success receipt. Batch formats are atomic **per file**. Results retain successful earlier writes if
another file fails; the batch is not a project-wide transaction. Every file keeps the whole-file approval gate:
per-group selective writes remain deferred, and a positive approved-group count does not guarantee a write.

## Session modes and updates

The plugin defaults to `check`. Its session modes control hooks separately from the Write/Refactor/Align/Check
workflow you ask the agent to perform:

| Mode | Hook behavior |
|---|---|
| `off` | Skip inspection |
| `check` | Inspect and report without changing source |
| `align` | After a matched tool call, attempt approved horizontal-only alignment and inspect again; Stop remains read-only |
| `refactor` | Inspect and report; structural edits remain the agent's work |

```bash
boxbox mode
boxbox mode align
boxbox mode check --global
boxbox update --check
boxbox update --source /absolute/path/to/boxbox --host codex
boxbox statusline --install-shim
```

Project mode overrides the global default; a valid `BOXBOX_MODE` overrides both for that process. Choosing `align`
explicitly enables the bounded PostToolUse write path; it does not approve a new rule or let hooks run a structural
refactor. Automatic plugin inspection still covers session changes, rather than replacing your project's explicit
formatter/CI command. A failing PostToolUse report names up to three affected files and suppresses later matched-tool
feedback while the observed source snapshot is unchanged; a new source change is inspected normally. Stop still
rechecks and can request at most one continuation; it never writes source.

In a Git working tree, automatic lifecycle snapshots exclude untracked files and directories ignored by Git,
including generated runtime state. Ignore rules do not remove tracked files from the existing snapshot scope, and
visible source changes during inspection still fail the check. Outside Git, snapshots retain the existing recursive source
scan. This exclusion applies only to automatic lifecycle hooks; explicit checks and guarded runs keep their scope.

SessionStart checks GitHub release tags when its cached update check is at least 24 hours old. This sends no source
content. Set `BOXBOX_UPDATE_CHECK=0` in the host environment to disable the automatic network probe. Its update cache
and explicitly selected modes live under `$XDG_CONFIG_HOME/boxbox/state` (default `~/.config/boxbox/state`);
hook baselines and receipts remain in host plugin data.

An update notice does not install anything. Run an update only when requested; before registry publication it needs
an absolute BoxBox checkout with its build prerequisites. Public releases use `npx boxbox-plugin`; `--source` is a
development-only override, and a standalone source update must select its host explicitly. The updater verifies the selected host's installed engine
version before reporting success, then requests a host restart. `statusline` is an optional one-row Claude segment;
`--install-shim` prints a version-independent command for the host setting. `NO_COLOR` or `BOXBOX_COLOR=0` disables
update/status-line color. These commands do not establish native acceptance on every host or operating system.

## Inspect session usage

Ask for `/boxbox -monitor` to generate an on-demand report before continuing source work, or run from the target
repository with the host's plugin-data environment:

```bash
boxbox monitor --project --host codex --json
boxbox monitor --session <session-id> --host claude --no-paths --json
```

Every invocation, including `--json`, writes one self-contained `monitor-<host>.html` page under host plugin data and
returns its path with headline numbers. `--html <absolute-path>` replaces the default destination with a `.html` file
inside that same data folder and outside its reserved `hooks` namespace;
relative paths and destinations inside the project or outside plugin data are refused. The command requires the
host's absolute `CLAUDE_PLUGIN_DATA` or `PLUGIN_DATA`; a missing or relative value produces setup guidance rather than choosing another
folder. `--project` defaults to the current project and cannot be combined with `--session`.

`--host auto` is the default: a Codex thread/session environment selects Codex, otherwise it selects Claude. Use an
explicit host in standalone sessions. Reports contain allowed token counters, hook states and per-file byte/line
changes, without transcript text, commands or source content. They make no model call and show no dollar cost.
`--no-paths` hides relative source filenames, while the resulting HTML destination remains visible. Old baselines
report unavailable footprints; malformed fingerprints remain unknown. Codex exact step attribution is unavailable;
estimates and lower bounds stay labeled. Growth measurements do not establish semantic or alignment correctness.

## Understand verification

| Result | What it establishes | What it does not establish |
|---|---|---|
| Authoring guidance | Approved rules and examples are available for the target language/scope | Every proposed row is approved or safe to write |
| `check --source` | Original-source syntax, detected groups and approval facts | Formatter canonical output, complete style coverage, behavior or performance |
| Default Check with a configured formatter | Final formatter-then-BoxBox difference and guarded canonical verification | A target write, complete style coverage, behavior or performance |
| Successful Align | The engine's approval and write-safety checks passed for the transformation | The program is functionally correct or fast |
| Write/Refactor verification | The specific syntax, type, test or performance checks actually run | Guarantees beyond those checks |

`formatReadiness` in a check report is eligibility, not completed write verification. Zero misalignment or zero detected
groups is not a whole-file style certificate. The agent reports refused and unsupported regions, relevant tests and any
checks not run. Structural changes require behavior verification and performance evidence when the changed work warrants it.

Plugin hooks inspect session changes after matched tool calls and at session boundaries. Their default is read-only;
only an explicit `align` session mode enables the approved PostToolUse alignment path described above. For installation,
see [the main README](../../README.md).
