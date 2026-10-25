---
name: boxbox
description: Use when structurally simplifying long exceptional elements and then inspecting, fixing and verifying TypeScript, Python, JSON, and YAML files one at a time against tabular readability rules.
---

# BoxBox Code Readability

Let the reader follow the execution flow top to bottom and compare same-role rows vertically. Treat code like spreadsheet data — rows, columns and cells — but first give every same-role row **the same minimal composition**, then pin the remaining syntax boundaries into minimum-width columns. Do not impose a general formatter's taste; apply only project rules confirmed by user feedback.

In command examples, replace `<SKILL>` with the path of the folder containing this SKILL.md. Run scripts from the root of the repository being inspected.

## Simplify structure first

- The top goal is not alignment but **uniformity: same role, same shape**.
- A file the user has already accepted as canonical is a reference sample, not a target. Apply its `import`, `:`, `=>` and `case` axes to other files; never redesign the reference file without an explicit request.
- Uniformity does not mean stretching every row to the longest one. It means removing unnecessary differences so same-role rows share the same minimal composition.
- First find the minimal common form of the repeated rows. The structure shared by normal rows that differ only by name is the table's base form.
- Before aligning, find the exceptional elements that make repeated rows long.
- Separate base elements from exceptional elements. If one exceptional element widens the whole table, first reconsider whether that element is a necessary structure.
- Classify exceptional elements as `required domain information`, `boundary-only information`, `implementation detail`, or `duplicate expression`.
- Check up to the call sites whether the element is a required domain contract or an implementation detail leaking into an outer interface.
- Information the interface does not need — such as a parameter passed as the same constant at every call — should first be considered for binding inside the adapter.
- Structures that increase both display width and cognitive cost — duplicate wrappers, external parameters that accept a single value, absent-value conversions between layers — are candidates for removal, binding or normalization.
- Keep boundary-only information near the boundary. Move implementation details inward so they never define the width of a public interface or a repeated table.
- Use a type alias only to create an independent meaning or a reusable contract. Never hide an existing type behind a short name to shrink table width.
- Accept a length as real data and align columns only when the structure cannot be reduced while preserving meaning.
- Therefore report `structural simplification` and `presentation alignment` separately. Never cover up a reducible difference with whitespace alignment.

Decide in this order:

1. Record the common skeleton of the repeated rows as the base elements.
2. Mark elements longer than or different from the common skeleton as exceptional.
3. Read definitions, callers and tests to decide whether an exception is a public contract or an implementation detail.
4. For an implementation detail, consider in turn: removal, internal binding, default-value normalization, splitting into a separate table.
5. After the structural change, confirm the base form became shorter and more uniform, and that behavior, type safety and role boundaries were preserved.
6. For a public contract, keep it and recompute column widths from the actual longest data only.

## Type clarity

- Inspect `?`, `null`, `undefined`, `!` and `as` together as uncertainty markers.
- Extract the syntax markers of the target file first with `bun <SKILL>/engine/typescript/02_audit-type-uncertainty.ts --file <target file>`. The auditor separates, via the AST, only optional declarations, `null`, `undefined`, non-null assertions, definite assignments, `as` and angle-bracket assertions — not logical `!` or the conditional `?`.
- Keep `?` when omission is a real input contract, and narrow to a concrete type as early as possible after entering the function.
- When `exactOptionalPropertyTypes` is off, `property?: T` also accepts an explicit `property: undefined`. Inspect omitted properties and explicit `undefined` at call sites separately; when they mean the same thing, unify on omitting the property.
- When the meaning of omission for a `?` kept on a public or boundary interface is not obvious from the name, place a short `/** JSDoc */` right before the property and verify it with a property hover.
- Do not switch the same absent state between `null` and `undefined` across layers. Default to `null` for an intentional cancel and `?` for an omittable object property.
- Do not alias primitives that are already short and clear, such as `void`, `string` or `boolean`.
- Give a long composite type a short, specific name only when it has an independent meaning, and explain its original structure and absence semantics with `/** JSDoc */`.
- String literals and trailing `//` comments are not type hover documentation. Verify the editor hover contract with TypeScript LSP responses.
- Several consecutive private local type aliases may form a `type / name / = / actual type / ; / // note` table. That trailing note is for source navigation and is not a hover contract.
- Declarations whose consumers need hover documentation — exported types, public optional properties — keep using `/** JSDoc */` right before the declaration.

## Spreadsheet-style code grid

- Even during feature work, decide and measure the `column anchors` from the [readability contract](rules/references/readability-contract.md) for every repeated block you change. Do not postpone this to a final cleanup, and do not report the whole file as done after checking only object arrays.
- One repeated construct is one table.
- Compose new code grid-first: before writing three or more same-role values, name their shared column set and write each as one row (one reader shape, one field per row, `.map` rows over comparable lists, a branch picked in one row). See [grid-first authoring](rules/references/readability-contract.md#grid-first-authoring) for the limits — no padding wrappers, other roles stay outside the table, behavior preserved, hot paths measured.
- When role sections are split — `// Run`, `// List`, `// Select`, `// Write` — each section is an independent table and does not share its longest value with the others as a width basis.
- Each same-role declaration or execution is one row.
- Identifiers, separators, keywords, types, statements and notes are comparable columns and cells.
- When `( )`, `{ }` or `< >` contain another repeated structure, build a sub-table inside that cell.
- Apply tabular alignment when three or more comparable same-role rows are contiguous. Exceptions confirmed by the user: `=` declaration tables and imports align from two rows. Other two-row groups are reported as pairs and never fixed automatically; `--min-rows` cannot go below 3 for fixes.
- A contract mixing JSDoc, optional capabilities and different lifecycle responsibilities — such as a public Port — is not one table. Rows split by JSDoc or blank lines are separate semantic units; do not insert inner spaces to align the closing `>` of return types.
- Column 120 is a signal to consider structural splitting when creating a new alignment, not a ceiling for dismantling a canonical grid. Preserve the syntax axes of an existing grid the user accepted, regardless of width.
- Left-align feature/function names and execution cells. Recompute the inner width of `( )` in a repeated function table from the actual longest argument, and center only the short arguments within that minimum width.
- Write empty `()` and array markers `[]` attached.
- Compute column width from the table's actual data and place leftover spaces according to the chosen alignment.
- Align trailing `//` notes into one column within the same declaration table, using the outer space after the statement terminator instead of widening the preceding type cell.
- Align the last function call of a production row only up to its start column. Regardless of call length, put exactly one space after the terminating `;` and close with `}`; add no spaces to align the closing brace.
- When an object array is used like a column definition, treat each object as one row and measure `{`, property name, `:`, value, `,` and `}` as columns. When optional properties omitted for a same-meaning default change the row structure, normalize to the explicit default first, then align.
- Column specifications and data generation are different tables. Do not nest them in one object; split them into named locals such as `columns` and `rows`, and pass them in shorthand at the point of use.

## Roles

- The inspector investigates one product file read-only. Delegate to the `readability-inspector` subagent in Claude Code and ZCode (defined in this repository's `development/agents/readability-inspector.md`; Write/Edit/NotebookEdit disallowed), and to this repository's `development/codex/readability-inspector.toml` in Codex (`sandbox_mode = "read-only"`, linked into `~/.codex/agents/` on install). Both definitions use this SKILL.md as their manual, so rule changes happen only in this file.
- The main agent reviews the findings and authors and verifies exactly one product file.
- Never let the inspecting agent approve its own output or modify product code.

## Entry

1. Check location and existing changes with `pwd` and `git status --short --branch`.
2. When touching module, path or dependency boundaries, read the target repository's architecture boundary document (for example a root `LAYERS.md`).
3. Read all confirmed rules and discarded rules in the [readability contract](rules/references/readability-contract.md).
   When working on role-specific TypeScript tables, also read the [TypeScript grid template](rules/references/typescript-grid-template.md).
4. Narrowly look up the target file's callers, tests and dynamic imports to establish a behavioral baseline.
5. Following the contract's `column alignment check steps`, pin the outermost syntax boundaries first, then align repeated inner constructs.

## One-file alternating flow

1. Write a candidate diff for the current target file only.
2. Run the narrowest type check, behavioral tests and architecture checks.
3. Show the user the actual code and measured columns, then wait for feedback.
4. While waiting, one next candidate file may be investigated read-only by the `readability-inspector` subagent.
5. Modify the next file only after the current file's rules are accepted. Never author two product files at the same time.
6. Revert rejected experiments immediately and record them in the contract's discarded rules.

## Automated checks

Scripts are split by language. `engine/common/` holds the language-agnostic engine (string/comment masking, table detection and minimum-width alignment, display width), and `engine/typescript/` holds the TypeScript AST/LSP tools numbered in order (00→08). `engine/python/` is a line profiler on the common engine (01_group-regions, 06_align-tables) that locks repeated rows — dictionaries, assignments, import blocks, assigned calls and their bundle arguments — into tables, and `engine/structured/` aligns JSON and YAML scalar mappings. String and comment contents are masked to prevent structural misreads, and rows that fail lossless decomposition or are uncertain are refused — refusal is the safe direction.

```bash
bun <SKILL>/engine/python/06_align-tables.ts --file <target file> [--write] [--min-rows 3]
bun <SKILL>/engine/python/01_group-regions.ts --file <target file>
```

**STEP0 — Normalize import declarations.** Select the path before changing imports. B-layout import authoring uses `--layout-only`: it may move an existing brace import between compact and vertical forms, but preserves tokens, comments, structural AST and whether the final named specifier already has a trailing comma. It refuses an inline `type` specifier that the full normalizer would split, because splitting it into `import` and `import type` declarations is a token-changing Write/Refactor operation. Use the default full normalizer only inside that separately authorized structural workflow.

A single named specifier stays compact. Two or more become vertical when (A) the completed compact line exceeds 120 display columns, (B) its names are at least 20 columns wider than the section's second widest names, or (C) the aligned table still exceeds 120 columns, taking the widest names first. These import thresholds and the lone-brace-import exception are unchanged. All brace imports in a section share the `import`/`import type`, `{ }`, `from`, module and optional `;` columns. Imports without braces and imports with attributes stay as written without breaking the table.

```bash
bun <SKILL>/engine/typescript/00_normalize-imports.ts src/**/*.ts test/**/*.ts
bun <SKILL>/engine/typescript/00_normalize-imports.ts --write <target file>...
bun <SKILL>/engine/typescript/00_normalize-imports.ts --layout-only <target file>...
bun <SKILL>/engine/typescript/00_normalize-imports.ts --write --layout-only <target file>...
```

Check mode fails and lists files when any file needs changes. `--layout-only` reports `layout-only refuses token-changing import normalization` and leaves the file unchanged when full normalization would split mixed type/value imports. After any authorized `--write`, run TypeScript, architecture and behavior verification.

**STEP6 — Align boundaries per table kind.** For each table kind detected by the [kind registry](engine/typescript/grid-kinds.ts), align its registered axes to the actual longest value. Ordinary groups need three contiguous same-role rows; declarations with `=` and their compatible nested call-expression layer use the existing two-row floor. Gap axes keep at least one space; insert axes preserve attached-token conventions and only align the column.

The B-layout kinds add these bounded shapes: `object-properties` keeps property header `:` and one-line commas while shorthand rows omit absent punctuation; `logical-chains` aligns already-leading homogeneous `&&`/`||` chains, with an optional single `!` slot and opaque `!!`; `if-headers-braced` aligns `)`/`{`, while `if-headers-return` aligns `)`/`return`; `vertical-call-arguments` aligns commas in calls that are already multiline; and `declaration-call-expressions` aligns compatible comparison/conditional expressions at the same argument position in same-callee, same-arity declarations. `!=` and `!==` remain indivisible. Blank lines, interstitial comments and incompatible shapes split or drop these layers. A new kind suppresses its overlapping legacy region instead of borrowing an older approval identity.

The raw authoring aligner retains the 20-column call-argument outlier transform: it may take that declaration row vertical, then applies token/comment and structural-AST checks. Public Align refuses that newline-changing candidate and accepts only horizontal edits that preserve leading indentation and physical lines. Interface members compressed onto one physical line are likewise reported and not expanded. Conditional expressions outside the supported nested declaration-call shape, `for` headers, empty statements, other one-line execution blocks, rows split by JSDoc, and unsupported logical shapes remain excluded. The per-role shapes live in the [TypeScript grid template](rules/references/typescript-grid-template.md).

```bash
bun <SKILL>/engine/typescript/06_align-tables.ts --file <target file> [--write] [--min-rows 3] [--explain <line>]
```

The first command reports table kinds, axes and mismatch counts, and fails on any mismatch. Horizontal edits preserve non-whitespace tokens, comments, identifiers and order, leading indentation, physical lines and structural AST; a table that would change more is refused, never written, and counted as `refused=`. With `--write`, the output is also re-parsed by the language's official parser (TypeScript 7, python3); if its diagnostics differ from the source, nothing is written (`parse=changed`). If the parser is missing or fails to run, it exits non-zero before writing. `BOXBOX_REQUIRE_PARSERS=0` does not bypass this. An optional parser skip in tests does not mean product writes are allowed. Every aligner accepts `--json` and prints one versioned result (`schemaVersion`, per-file `summary`, per-group `state` PASS / FIXABLE / SUGGEST / REFUSE, `parse`) — agents and CI should read that instead of the text report. TypeScript `--write` confirms alignment, re-parsing and convergence in a temporary working copy for up to 5 passes, then replaces the original once (`passes=`). The shared line engine also replaces only a verified working copy and refuses when an external edit is detected right before commit. A failed working copy never reaches the original. Use `--write` only after reading the file and confirming the table rows share a role, then rerun to prove `misaligned=0`. When something does not work: ① classify the kind with `--explain <line>`, ② identify missing or excess axes, ③ register the kind and axes in `grid-kinds.ts` and pin it with `test/fixtures/table-kinds.ts` and `test/typescript-align.test.ts`.

**STEP7 — Author condition chains.** This authoring-only tool gives a homogeneous `&&` or `||` chain with at least
four operands a leading-operator multiline form. It moves existing trailing operators to the following lines and reserves
a virtual three-column operator prefix on the first operand, plus one optional `!` slot when needed. It does not add
parentheses, functions or wrappers, and it preserves operand tokens, comments and evaluation order. Existing multiline
homogeneous chains may be normalized; mixed operators, table/arrow contexts, multiline operands and comments that cannot
move safely are refused. Before writing, the tool verifies exact token/comment preservation, unchanged TypeScript 7
diagnostics and recursive AST structure. Public Align is separate and never invokes this newline-changing authoring path.

```bash
bun <SKILL>/engine/typescript/07_wrap-conditions.ts --file <target file> [--write] [--min-conditions 4]
```

The contract threshold is four operands. The CLI accepts an explicit experimental threshold no lower than three; using
that override does not change public approval or the documented authoring convention.

**STEP8 — Check the function map.** Check drift between the function map at the top of a feature implementation file (`GROUP | FUNCTION | INPUT | RETURN | CALLS | ROLE`) and the actual declarations: FUNCTION 1:1, INPUT count match, CALLS existence. `--scaffold` generates a skeleton from the declarations. The map format follows the [TypeScript grid template](rules/references/typescript-grid-template.md).

```bash
bun <SKILL>/engine/typescript/08_function-map.ts --file <target file> [--scaffold]
```

**STEP1 — Confirm groups.** Before claiming any alignment, use the AST to find "contiguous rows that can form one table". Ordinary tables group sibling nodes with a shared role; registered nested detectors may expose compatible rows inside one call, logical chain or multiline property region. Group by AST role and nesting rather than text position, so a ternary `:` and a property/object-literal `:` remain different axes.

```bash
bun <SKILL>/engine/typescript/01_group-regions.ts --file <target file> [--min-rows 2]
```

Each output line is `line-range container SyntaxKind rows=count table|pair axes=boundary-axes`. `rows>=3` is `table`; `rows==2` is `pair` (promoted to a table only when the user confirmed the comparison is useful) — both are still **candidates**. Sharing a SyntaxKind is all that was confirmed; rows that look very different, such as `declare const x: boolean;` and a multi-line `export const y = { ... };`, can land in the same SyntaxKind by accident. Decide whether a candidate is a real table by reading its content per the contract's "record the base form" and "judge exceptional elements" steps. `axes` lists the boundary axes actually present in the group (`type-annotation-colon`, `object-literal-colon`, `ternary-colon`, `call-arg-comma`, `array-comma`, `object-comma`, `statement-semicolon`).

**STEP2 — Type uncertainty.** Extract the list of type-uncertainty syntax with the TypeScript 7 AST.

```bash
bun <SKILL>/engine/typescript/02_audit-type-uncertainty.ts --file <target file>
```

The output is not an automatic removal list. Judge each item as `keep / normalize at boundary / remove` from its definition, callers and tests.

**STEP3 — Optional gate.** Check readiness to tighten optional contracts repository-wide with this auditor.

```bash
bun <SKILL>/engine/typescript/03_audit-optional-types.ts
bun <SKILL>/engine/typescript/03_audit-optional-types.ts --max-errors <current baseline> --file <target file>
```

The default run is the final gate and fails on any error. During migration, pass `--max-errors <current baseline>` so the run fails when errors increase and passes when they decrease or stay the same. `--file` does not change the global verdict; it additionally shows line, column, error code and diagnostic message for the given file. Use this to clean up explicit `undefined` arguments in the current product file first. Enable it as a permanent `tsconfig.json` gate only after the total error count is 0 and related behavior tests pass. Never add `| undefined` to every optional type just to silence errors.

**STEP4 — Measure columns.** Within a group confirmed by 01, measure the actual screen columns, including tabs and CJK display width. `04_measure-columns.ts` (automatic measurement from 01's group output) is not implemented yet; until then keep using `measure-layout.ts` with manual flags.

```bash
bun <SKILL>/engine/measure-layout.ts src/cli.ts \
  --lines 3,5-20 \
  --tokens 'from|//#1|:#1|=>' \
  --left-anchor '{#1|(#1|<#1'
```

Passing expected columns such as `--expect 'from=41|//=146'` fails on mismatch. When a token appears several times, select the occurrence as in `:#2`.
Use `--left-anchor` only to check the start column of an execution cell whose contract is left alignment. For a second boundary, such as in destructuring, use `{#2`.
`--center-cell '(#1|<#1'` computes the minimum inner width from the actual longest value in the selected line range and checks that each non-empty cell's left and right padding differ by at most one space. Run different role sections separately by splitting the line range.
`--compact-before '}#2'` checks that there is exactly one space between the last statement's `;` and the closing `}`. It fails when padding to match the length of a production row's last function value remains.

**STEP5 — Verify hovers.** Check the hover documentation of named types and public optional properties with the TypeScript 7 LSP. This is a conditional final step that runs only when a name or JSDoc was newly added.

```bash
node <SKILL>/engine/typescript/05_inspect-hover.mjs \
  test/fixtures/hover-contract.ts \
  CompactResult HoverOptions StoredOptions
```

`05_inspect-hover.mjs` finds the actual declaration from the TypeScript LSP document symbols, then requests a hover. It can check JSDoc on properties such as `resumeThreadId`, not just types. When two or more declarations share a name, an ambiguous request fails, so select by source order as in `resumeThreadId#1`. Without JSDoc the check fails even when a function signature was shown.

## Done criteria

- Report intended changes to behavior and to public type contracts separately.
- Tokens with the same role have matching measured columns.
- No removable type assertions or duplicate absence expressions remain, and hover documentation is verified for named types and optional properties that need documentation.
- When omission and explicit `undefined` mean the same state, call sites are unified on omitting the property, and the total `exactOptionalPropertyTypes` error count does not grow without justification.
- Do not spread new tables with fewer than two comparison rows, or excessive whitespace absent from the canonical form.
- Every changed TypeScript file passes the selected import lock (`00_normalize-imports.ts --layout-only` for B-layout;
  the default full check for an authorized Write/Refactor) and `06_align-tables.ts --file` (`misaligned=0`;
  `compressed` is 0 or has a manual expansion plan). Write code per the
  [authoring axis contract](rules/references/readability-contract.md) at authoring time; the checks prove it.
- `bun run check`, the target behavior tests, and `git diff --check` pass.
- Manually check changed files for `TODO`, `test.skip` and `test.only`.


## Explicit runs and invocation evidence

Wrap shell commands that author code with the installed public CLI: `boxbox run --root <absolute-project> -- <command> [args...]`.
At the start and end of work, check `boxbox status --root <absolute-project> --json` and report the run ID, checked targets and verdict.
If the engine is missing, report the invocation as not run and resolve the CLI install path. Never present installation or skill discovery as a check run.
`run` is a read-only check of changed supported files; structural simplification and automatic fixes are separate authoring steps of this skill.
NO_CHANGES, NOT_INVOKED, UNSUPPORTED, TOOL_ERROR and STALE are not PASS. On a FAIL verdict, fix the cause and check again with a wrapped command.
When an edit tool outside the shell runner is used, report that the change has no wrapped-run evidence and run `boxbox check --file` explicitly per file.
Native hook registration, trust and host acceptance are verified separately. The runner contract and scope follow "Run scope and persistent state" in the CLI package README.
