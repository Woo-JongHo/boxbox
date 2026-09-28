---
name: xxx
description: Use when structurally simplifying long exceptional elements and then inspecting, fixing and verifying TypeScript, Python, Java, Go, Rust, JavaScript, C, C++, Swift, and Kotlin files one at a time against tabular readability rules.
---

# XXX Code Readability

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
- Extract the syntax markers of the target file first with `bun <SKILL>/scripts/typescript/02_audit-type-uncertainty.ts --file <target file>`. The auditor separates, via the AST, only optional declarations, `null`, `undefined`, non-null assertions, definite assignments, `as` and angle-bracket assertions — not logical `!` or the conditional `?`.
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

- Even during feature work, decide and measure the `column anchors` from the [readability contract](references/readability-contract.md) for every repeated block you change. Do not postpone this to a final cleanup, and do not report the whole file as done after checking only object arrays.
- One repeated construct is one table.
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

- The inspector investigates one product file read-only. Delegate to the `readability-inspector` subagent in Claude Code and ZCode (defined in this plugin's `agents/readability-inspector.md`; Write/Edit/NotebookEdit disallowed), and to this plugin's `codex/readability-inspector.toml` in Codex (`sandbox_mode = "read-only"`, linked into `~/.codex/agents/` on install). Both definitions use this SKILL.md as their manual, so rule changes happen only in this file.
- The main agent reviews the findings and authors and verifies exactly one product file.
- Never let the inspecting agent approve its own output or modify product code.

## Entry

1. Check location and existing changes with `pwd` and `git status --short --branch`.
2. When touching module, path or dependency boundaries, read the target repository's architecture boundary document (for example a root `LAYERS.md`).
3. Read all confirmed rules and discarded rules in the [readability contract](references/readability-contract.md).
   When working on role-specific TypeScript tables, also read the [TypeScript grid template](references/typescript-grid-template.md).
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

Scripts are split by language. `scripts/common/` holds the language-agnostic engine (string/comment masking, table detection and minimum-width alignment, display width), and `scripts/typescript/` holds the TypeScript AST/LSP tools numbered in order (00→08). `scripts/<python|java|go|rust|javascript|c|cpp|swift|kotlin>/` are line profilers on the common engine (01_group-regions, 06_align-tables) that lock repeated rows — struct fields, objects, dictionaries, enum constants, import blocks, assigned calls and their bundle arguments — into tables. String and comment contents are masked to prevent structural misreads, and rows that fail lossless decomposition or are uncertain are refused — refusal is the safe direction.

```bash
bun <SKILL>/scripts/python/06_align-tables.ts --file <target file> [--write] [--min-rows 3]
bun <SKILL>/scripts/go/06_align-tables.ts --file <target file> [--write --enable-go]   # Go reports only unless --enable-go
bun <SKILL>/scripts/python/01_group-regions.ts --file <target file>
bun <SKILL>/scripts/swift/06_align-tables.ts --file <target file> [--write] [--min-rows 3]
bun <SKILL>/scripts/kotlin/06_align-tables.ts --file <target file> [--write] [--min-rows 3]
```

**STEP0 — Normalize import declarations.** Unify the declaration section before checking tables in the body of a product file. When values and types are mixed in one named import, split it into a value declaration and an `import type` declaration. A single named specifier always stays on one line; two or more fold onto one line when the completed line's display width is 120 or less. Only above 120 do they break into one item per line, with the closing `}` and `from` on the same line. All brace imports of an import section (groups separated only by blank lines) form one table: the head cell always reserves the `import type` width, so `{` sits in one column; the fixed-width `{ }` cell (names left-aligned one space after `{`), `from`, the module specifier and the terminating `;` share columns across every group. An import goes vertical — one name per line on the names column, aligned commas, a trailing comma, and the closing `}` on the table's `}` column — when (A) its one-line form exceeds 120 columns, (B) its names are 20+ columns wider than the second-widest names, or (C) the aligned table still exceeds 120 columns, taking the widest names first. Imports without braces (default only, namespace, `defer`, side-effect, `import x = require`) and imports with attributes stay as written without breaking the table; a lone brace import stays compact. Files without semicolons get no `;` column. Type-only imports are not runtime dependencies, so do not mix their structure with value imports.

```bash
bun <SKILL>/scripts/typescript/00_normalize-imports.ts src/**/*.ts test/**/*.ts
bun <SKILL>/scripts/typescript/00_normalize-imports.ts --write <target file>...
```

The first command fails and lists files when any file needs changes. `--write` mechanically normalizes only the import section; always run TypeScript, architecture and behavior verification afterwards.

**STEP6 — Align boundaries per table kind.** For each table kind detected by the [kind registry](scripts/typescript/grid-kinds.ts) (declaration, declaration-equals, type-alias, method-signature, interface-members, class-members, class-method, enum-member, case-clause, assignments, call-statements, guard-statements, object-rows, registration), align the axis columns of three or more contiguous rows to the actual longest value. Gap axes (`name : type`, `= value`, `value ;`, `,`, `}`) keep at least one space; insert axes (`(`/`)`, `):`, `case "x":`, trailing `//`) keep existing conventions and only align the column. Rows whose values are the same call align the nested call cell (`(`, argument `,`, `)`), literal lists inside the value, call arguments or matcher arguments align their item `,` and closing `]` / `}` column, subscript reads align the `]` after the widest index, and consecutive one-line `if (…) { …; continue; }` guards align the condition `)`, the first statement's `;` and the `continue` column. A row whose call argument is 20+ columns wider than the second widest in its column takes the vertical form instead — arguments one per line under the `(`; only line breaks are inserted. Empty parameter lists stay attached as `()`, are excluded from `)` alignment, and keep their padding outside the parentheses. Interface members compressed onto one physical line are reported as `compressed=` and are not fixed even with `--write` — expanding rows is a structural change. Conditional expressions, `for` headers, empty statements, other one-line execution blocks, and rows split by JSDoc or blank lines are excluded. The per-role shapes live in the [TypeScript grid template](references/typescript-grid-template.md).

```bash
bun <SKILL>/scripts/typescript/06_align-tables.ts --file <target file> [--write] [--min-rows 3] [--explain <line>]
```

The first command reports table kinds, axes and mismatch counts, and fails on any mismatch. Every table's edits must change nothing but whitespace between tokens (checked with the language's token stream: strings, comments, indentation and token boundaries stay byte-identical); a table that would change more is refused, never written, and counted as `refused=`. With `--write`, the output is also re-parsed by the language's official parser (TypeScript 7, python3, gofmt, node, clang, javac, rustfmt); if its diagnostics differ from the source, nothing is written (`parse=changed`). A missing parser reports `parse=skipped`, which is not a pass. Every aligner accepts `--json` and prints one versioned result (`schemaVersion`, per-file `summary`, per-group `state` PASS / FIXABLE / SUGGEST / REFUSE, `parse`) — agents and CI should read that instead of the text report. TypeScript `--write` repeats until nothing moves (mid-line tabs change width with position, so one pass can shift a later column) and fails if it does not converge within 5 passes (`passes=`). Use `--write` only after reading the file and confirming the table rows share a role, then rerun to prove `misaligned=0`. When something does not work: ① classify the kind with `--explain <line>`, ② identify missing or excess axes, ③ register the kind and axes in `grid-kinds.ts` and pin it with `fixtures/table-kinds.ts` and `test/typescript-align.test.ts`.

**STEP7 — Wrap condition chains.** Wrap `&&`/`||` chains listing four or more conditions on one physical line into the multi-line form of rule 38 (operators at line start). Only line breaks are inserted, so parentheses and evaluation order are preserved. Mixed-operator groups and chains inside table rows (registration-object arrows, for example) are excluded from automation — they are manual restructuring targets under rule 38.

```bash
bun <SKILL>/scripts/typescript/07_wrap-conditions.ts --file <target file> [--write] [--min-conditions 4]
```

**STEP8 — Check the function map.** Check drift between the function map at the top of a feature implementation file (`GROUP | FUNCTION | INPUT | RETURN | CALLS | ROLE`) and the actual declarations: FUNCTION 1:1, INPUT count match, CALLS existence. `--scaffold` generates a skeleton from the declarations. The map format follows the [TypeScript grid template](references/typescript-grid-template.md).

```bash
bun <SKILL>/scripts/typescript/08_function-map.ts --file <target file> [--scaffold]
```

**STEP1 — Confirm groups.** Before claiming any alignment, use the AST to find "contiguous rows that can form one table". Only sibling nodes of the same SyntaxKind are grouped — not text positions — so tokens that look alike but play different roles, such as the ternary `:` and the property/object-literal `:`, land in different groups from the start.

```bash
bun <SKILL>/scripts/typescript/01_group-regions.ts --file <target file> [--min-rows 2]
```

Each output line is `line-range container SyntaxKind rows=count table|pair axes=boundary-axes`. `rows>=3` is `table`; `rows==2` is `pair` (promoted to a table only when the user confirmed the comparison is useful) — both are still **candidates**. Sharing a SyntaxKind is all that was confirmed; rows that look very different, such as `declare const x: boolean;` and a multi-line `export const y = { ... };`, can land in the same SyntaxKind by accident. Decide whether a candidate is a real table by reading its content per the contract's "record the base form" and "judge exceptional elements" steps. `axes` lists the boundary axes actually present in the group (`type-annotation-colon`, `object-literal-colon`, `ternary-colon`, `call-arg-comma`, `array-comma`, `object-comma`, `statement-semicolon`).

**STEP2 — Type uncertainty.** Extract the list of type-uncertainty syntax with the TypeScript 7 AST.

```bash
bun <SKILL>/scripts/typescript/02_audit-type-uncertainty.ts --file <target file>
```

The output is not an automatic removal list. Judge each item as `keep / normalize at boundary / remove` from its definition, callers and tests.

**STEP3 — Optional gate.** Check readiness to tighten optional contracts repository-wide with this auditor.

```bash
bun <SKILL>/scripts/typescript/03_audit-optional-types.ts
bun <SKILL>/scripts/typescript/03_audit-optional-types.ts --max-errors <current baseline> --file <target file>
```

The default run is the final gate and fails on any error. During migration, pass `--max-errors <current baseline>` so the run fails when errors increase and passes when they decrease or stay the same. `--file` does not change the global verdict; it additionally shows line, column, error code and diagnostic message for the given file. Use this to clean up explicit `undefined` arguments in the current product file first. Enable it as a permanent `tsconfig.json` gate only after the total error count is 0 and related behavior tests pass. Never add `| undefined` to every optional type just to silence errors.

**STEP4 — Measure columns.** Within a group confirmed by 01, measure the actual screen columns, including tabs and CJK display width. `04_measure-columns.ts` (automatic measurement from 01's group output) is not implemented yet; until then keep using `measure-layout.ts` with manual flags.

```bash
bun <SKILL>/scripts/measure-layout.ts src/cli.ts \
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
node <SKILL>/scripts/typescript/05_inspect-hover.mjs \
  <SKILL>/fixtures/hover-contract.ts \
  CompactResult HoverOptions StoredOptions
```

`05_inspect-hover.mjs` finds the actual declaration from the TypeScript LSP document symbols, then requests a hover. It can check JSDoc on properties such as `resumeThreadId`, not just types. When two or more declarations share a name, an ambiguous request fails, so select by source order as in `resumeThreadId#1`. Without JSDoc the check fails even when a function signature was shown.

## Done criteria

- Report intended changes to behavior and to public type contracts separately.
- Tokens with the same role have matching measured columns.
- No removable type assertions or duplicate absence expressions remain, and hover documentation is verified for named types and optional properties that need documentation.
- When omission and explicit `undefined` mean the same state, call sites are unified on omitting the property, and the total `exactOptionalPropertyTypes` error count does not grow without justification.
- Do not spread new tables with fewer than two comparison rows, or excessive whitespace absent from the canonical form.
- Every changed TypeScript file passes the second lock: `00_normalize-imports.ts` check mode (changed=0) and `06_align-tables.ts --file` (misaligned=0; compressed is 0 or has a manual expansion plan). Write code per the [authoring axis contract](references/readability-contract.md) at authoring time; the checks prove it.
- `bun run check`, the target behavior tests, `test/architecture.test.ts` where applicable, and `git diff --check` pass.
- Manually check changed files for `TODO`, `test.skip` and `test.only`.
