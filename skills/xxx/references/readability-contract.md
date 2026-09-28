# Readability Contract

## Goal

Compare code as rows, columns and cells, where uniformity means **giving the same role the same minimal composition**. First remove, bind or normalize structures that became long because of exceptions. Apply tabular alignment when three or more comparable same-role rows are contiguous. Make a table from two rows only when the user confirmed the comparison is useful. Column 120 is a signal to consider splitting a new structure, not a ceiling for dismantling an already accepted canonical grid. Alignment is not the goal in itself: covering a reducible structure with whitespace, or letting whitespace push semantic units apart, is a failure.

Uniformity priorities:

1. Give the same role the same structure and reading order.
2. Check whether a foreign element mixed into the base form is a required contract or a structural leak.
3. Simplify the structure by removal, internal binding, normalization or table splitting while preserving meaning and type safety.
4. Accept only irreducible, real information as cell data and align it at minimum width.

`The same minimal composition` does not mean abbreviating until meaning is lost. Remove only foreign elements that can go while preserving behavior, type safety and domain responsibility; keep necessary differences as explicit contracts.

Therefore the longest code is not always the alignment basis. First decide whether that length is domain information, boundary information, an implementation detail or a duplicate expression, then use only the preserved longest data as the basis.

## Top-to-bottom role structure

- A feature implementation file puts the public features consumers look for first, then individual processing, then response conversion and validation. The reference order for a lookup adapter is `public feature → individual lookup → response conversion`. Do not add functions or sections just to fill a missing role.
- Functions with the same role use the same reading order and naming scheme. Before reordering declarations, check initialization and registration order dependencies, and preserve execution order.
- Rename abbreviations whose role must be decoded — `opts`, `res`, `d` — to role-revealing names such as `options`, `response`, `document`. Collections reveal their content and lookup key, as in `placesById`; do not mechanically lengthen idiomatic indices.
- Apply reuse only to implementations with confirmed identical responsibility, input/output and failure contract. Do not merge lookups or conversions that merely look alike and thereby hide the call flow, and do not add wrappers that only forward names.
- When applying these structural principles to other languages such as Kotlin, first check that project's declaration and lifecycle rules. Do not port the TypeScript column alignment and check commands verbatim.

## Grid model

- **Table**: a contiguous code block with the same syntax structure and comparison purpose.
- **Row**: one declaration, property, import or execution flow.
- **Column**: a repeated syntax boundary such as `:`, `( )`, `{ }`, `< >`, `=>`, `from`, `= await`, `//`.
- **Cell**: the actual identifier, type, value, statement or note between columns.
- **Sub-table**: an inner grid re-decomposed into name, separator and type when a repeated structure such as `:` appears again inside a cell.
- **Alignment policy**: align contiguous repeated blocks of three or more comparable rows at minimum width. User-confirmed exceptions: `=` declaration tables and imports align from two rows. Other two-row groups are reported as pairs and never fixed automatically. Methods of a public Port split by JSDoc or different lifecycle responsibilities are not merged into one table. Preserve the `import`, `:`, `=>` and `case` axes of a reference file accepted by the user. The inner width of `( )` in a repeated function table is set by the actual longest argument, not by existing spaces; only short values are centered within that minimum width.

## Confirmed rules

1. Modify only one product file at a time.
   Files the user designated as close to canonical are excluded from modification and read only as a comparison basis.
2. Imports separate runtime and type roles, and paths inside `src` use the `@/` alias. Do not mix values and `type` specifiers in one named import; split into separate `import` and `import type` declarations. A single named specifier always stays on one line; two or more fold onto one line when the completed line's display width is 120 or less. Only above 120 do they break into one item per line, with the closing `}` and `from` on the same line. All brace imports of an import section (groups separated only by blank lines) form one table: the head cell always reserves the `import type` width, so `{` sits in one column; the fixed-width `{ }` cell (names left-aligned one space after `{`), `from`, the module specifier and the terminating `;` share columns across every group. An import goes vertical — one name per line on the names column, aligned commas, a trailing comma, and the closing `}` on the table's `}` column — when (A) its one-line form exceeds 120 columns, (B) its names are 20+ columns wider than the second-widest names, or (C) the aligned table still exceeds 120 columns, taking the widest names first. Imports without braces (default only, namespace, `defer`, side-effect, `import x = require`) and imports with attributes stay as written without breaking the table; a lone brace import stays compact. Files without semicolons get no `;` column. When applying the alias to a new boundary, also verify the architecture import graph.
3. Split a table block into cells by syntax units: identifier, `:`, `( )`, `=>`, `{ }`, `< >`, `= await`, `from`, trailing `//`.
4. Unify each cell at the minimum width required by the longest actual content in the same block. Left-align feature/function identifiers and execution cells. Never create an arbitrary column farther than the actual longest row.
5. Parentheses, braces and angle brackets are each independent outer boundaries. In the same comparison block, align both opening and closing symbols. The inner width is set by the longest actual single-line content; short and empty values sit inside that fixed width.
6. When type parameters push a line past column 120, break one parameter per line.
7. Repeated syntax inside an outer cell is also aligned as a sub-table when there are two or more comparable rows. Recompute the width of a function-argument cell from the actual longest value. Center short values within that width; write empty arguments attached as `()` and put the leftover width outside the parentheses. Do not reuse existing unnecessary inner spaces as a width basis.
8. Keep the `{ }` of production destructuring as a fixed-width cell. The imported callable identifiers are function names, so left-align them one space after `{` with leftover width on the right. Align the closing `}` and the following `= await` column on every row.
9. The body `{ }` of a one-line arrow function is an execution block, not a value cell. Align the opening `{` and the start column of the last statement, but end the last call at its actual length. Put exactly one space after the terminating `;` and close with `}`; add no trailing spaces to align the closing brace column.
10. Group production dependencies by role — run, list, select, write. Do not arbitrarily break the accepted `const { } = await import(...)` and execution-cell axes of the reference file into multiple lines.
11. A trailing note is the last open cell. Align the `//` start column across role sections in the same declaration table. Keep the minimum width of preceding cells such as `Promise< >` and move `//` only with the outer space after the statement terminator. Left-align the note one space after `//`; add no right padding to equalize note lengths.
12. Repeated implementations are one line by default. Break into two lines at a semantic boundary only when a line becomes excessively long; do not expand short rows wholesale.
13. Keep a dependency interface as one interface and split roles with `// Run`, `// List`, `// Select`, `// Write` section comments. Do not split the type into per-role interfaces.
    Each role section is an independent table. The widths of `( )`, `Promise< >`, `;` and `//` are computed only from the actual longest value inside the section; do not borrow a long type from another section as a width basis.
14. Do not extract function signatures into named local types just to reduce table width. In the same comparison block, use the longest actual signature as the width basis as is. Split out a type only when it has an independent domain meaning or reuse contract.
15. Before repeating an inline object type, find and reuse an existing Domain or Port type that owns the same meaning. The purpose of naming a type is to reveal an existing contract's meaning, not to shorten rows.
16. Column header comments above a table use only ASCII labels such as `NAME`, `PARAMETERS`, `RETURN TYPE`. CJK display width varies across terminals and editors, so it is not used as reference data for column positions. The header's syntax boundaries and sub-cell start columns must match the actual code rows.
17. When a long exceptional element is found, check its definition, callers and tests before aligning. Information consumers do not choose — such as a parameter passed as the same constant at every call — should be considered for removal from the interface and binding inside the implementation adapter.
18. Structural simplification must preserve meaning and type safety. Removing required inputs, merging different contracts, or adding a type alias just to look shorter is not simplification.
19. Uniformity does not force the longest exception's width onto every row. When an element that differs from the base rows widens the whole table, first consider moving it to a separate row, a separate table or the internal implementation; include it in the common width only when it cannot be separated semantically.
20. `?` does not mark something for removal; it means omission of the value is part of the contract. Keep it only where omission is really possible at the input boundary, and narrow to a concrete type as early as possible inside, via condition checks, defaults and normalization. On a public or boundary interface where the meaning of omission is not obvious from the name, a short `/** JSDoc */` right before the property owns that meaning, and its exposure is verified with an actual property hover.
21. Do not mix `null` and `undefined` for the same absent state. Express explicit results such as a user cancel with `null`, and a missing object property with `?`. When code appears to convert between the two across layers, revisit the boundary contract.
22. For `!` on array indices and `as` on wide values, first check whether a local variable and a conditional branch can remove them. An assertion that silences the checker without runtime evidence is not simplification.
23. Do not alias primitives that are already short and clear, such as `void`, `string`, `boolean`. Give a short, specific name to a long, repeated composite type only when it has an independent domain meaning.
24. Supplementary documentation of named types and public optional properties is owned by a `/** JSDoc */` right before the declaration. String literals and trailing `//` are not hover documentation; find the actual declaration with the TypeScript LSP `textDocument/documentSymbol`, then confirm the documentation appears in the `textDocument/hover` response. Specify same-name declarations as `name#occurrence`, and fail ambiguous requests or requests without JSDoc.
    However, consecutive local type aliases that are not exported are grouped into a `type / name / = / actual type / ; / // note` table. That note is for in-file navigation and does not replace the public hover contract.
25. Record the minimal common form of the repeated rows first. When a type modifier, extra parameter, wrapper, absence expression or conversion code absent from the base form appears, do not adopt it as the width basis immediately; classify it as a foreign element.
26. Judge each foreign element as one of `required domain information`, `boundary-only information`, `implementation detail`, `duplicate expression`. Keep boundary information near the boundary, implementation details inside, and remove duplicate expressions.
27. Do not accept a structural change just because it looks shorter. Accept it as simplification only when the base form actually became more uniform and behavior, type safety and layer responsibility were preserved.
28. With `exactOptionalPropertyTypes` off, `property?: T` also accepts an explicit `property: undefined`. Inspect property omission and explicit `undefined` at call sites separately, and unify on omission when they mean the same absence. Keep `| undefined` as an explicit contract only when a different meaning is confirmed.
29. For optional tightening, first run `audit-optional-types.ts` as a read-only migration gate. The default run requires zero errors, and `--max-errors <current baseline>` fails on any increase. `--file <target file>` keeps the global verdict while separately reporting line, column, error code and diagnostic message for that file. Enable it in `tsconfig.json` only after confirming zero total errors and passing related behavior tests; never pass the gate by appending `| undefined` wholesale.
30. The population for the uncertainty audit is extracted from the TypeScript AST by `audit-type-uncertainty.ts --file <target file>`. It reports optional properties, parameters, methods, tuples and types, `null`, `undefined`, non-null assertions, definite assignments, `as` and angle-bracket assertions as distinct kinds. Logical negation and the conditional operator are not listed; the output is not an automatic removal list, and each item is judged from definitions, callers and tests.
31. A feature implementation file may carry a function map at the top (`GROUP | FUNCTION | INPUT | RETURN | CALLS | ROLE`). FUNCTION maps 1:1 to declarations in the file, the INPUT count must match the parameters, and names listed in CALLS must exist in the file. Drift between map and code is locked by the `08_function-map.ts` check. GROUP and ROLE follow the sections and roles of the reading flow. The repository-wide flow summary is still owned by audit documents under `docs/`.
32. Public Port and Domain contracts default to compact TypeScript notation. Do not add role comments to a method list that mixes JSDoc, optional capabilities and lifecycle responsibilities to create a fake table, and do not pad type internals to align the closing `>` of `Promise< >`.
33. In a same-role object array, each object is one row. When omitting an optional property is merely a presentational default, normalize every row to the same property cells and align `{`, each `:`, each `,` and `}` to the actual longest value. When the omission itself carries domain meaning, do not overwrite it with an explicit value; split it into a separate table.
34. An object-based column specification and the generation of data rows for those columns are independent tables. Do not nest the two tables inside complex call arguments; split each into a named local value and keep the call site minimal, as in `{ columns, rows }`.
35. The terminating `;` is no longer attached as an exception. Within a table, align its column to the actual longest value like any other column. One-line execution blocks where `}` immediately follows `;` (rule 9) remain a separate case and are not overridden by this rule.
36. A standalone statement with no rows to compare against (fewer than three same-role repetitions, so no table forms) is not split vertically for alignment. Short flows originally read as one line, such as `if (condition) run() return`, prefer the compressed one-line form.
37. In interface and class member declarations, one member owns one physical row. Do not chain several property or method declarations on the same row with `;`, hiding the table's row boundaries. Short public contracts are no exception.
38. When a guard or validation line has more than three conditions or exceeds column 120, split it into a multi-line `if` block with early returns, with operators (`||`, `&&`) at line start. Extract repeated check bundles into named predicates (`isInScope`, `isAuthorized`) to keep the call site in reading order.
39. Do not inline feature slots (approvalPreview, reconciliation, execute, ...) inside anonymous ternaries or conditional spreads. Extract each slot into one named local function so it reads top to bottom, and leave the assembly point in the minimal form `...(write ? { approvalPreview, reconciliation } : {})`.

## Column anchors

Before writing a repeated block, decide the cells and syntax axes to compare. Besides object arrays, registration objects and local computation declarations are in scope.

- **Registration objects**: one entry is one row. Split into `property name | : | expression` and align `:` and the expression start column. Inside repeated `new` or `scroll(new …)`, compare constructor names and argument parentheses as sub-cells. Do not force a lone exceptional wrapper onto other rows as a width basis.
- **Consecutive declarations**: in `const | name | = | expression` of the same computation step, align `=` and the expression start column. A multi-line array initialization is a separate table and does not share axes with local declarations inside callbacks or with other computation steps.
- **Check scope**: identify every such block in the change diff and pass each block's line range, tokens and expected columns to the measurer. Passing some blocks is not passing the file. Leave unchecked blocks marked as unchecked.

## Column alignment check steps

Proceed to the next step only after the current one passes. Do not adjust a later step's whitespace first and blur an earlier step's boundaries.

1. **Confirm comparison blocks**: group only contiguous rows with the same role and syntax structure into one table.
2. **Record the base form**: record the minimal structure and reading order shared by the most common normal rows as the table's base form.
3. **Judge exceptional elements**: check definitions and callers to decide whether the longest row's type, parameters and return value are a required contract or an implementation detail reducible by binding into the adapter or removing duplication.
4. **Simplify structure**: classify foreign elements as required domain information, boundary information, implementation detail or duplicate expression, and consider removal, internal binding, default normalization and table splitting in that order.
5. **Judge type uncertainty**: find `?`, `null`, `undefined`, `!` and `as`, and classify them as real absence contracts, duplicate expressions or removable assertions. Give names and JSDoc only to meaningful composite types.
   With `exactOptionalPropertyTypes` off, count optional-property omission and explicit `undefined` arguments separately, and normalize same-meaning arguments in the current file to omission.
6. **Align outermost boundaries**: fix the columns of `:` after identifiers, outer `( )`, `=>`, the outer `{ }` of function bodies, statement-ending `;` and trailing `//`, left to right.
7. **Compute widths**: compute each cell's width only from the minimum required by the actual content preserved after simplification. Split multiple parameters per line first, and use the longest line as the basis. Close an empty parameter list as `()` and align the column up to the next syntax boundary with outer padding.
8. **Align inner constructs**: once outer boundaries are fixed, align the start columns of repeated inner constructs such as `import`, `from`, `const`, `= await`, and the final `await`/`return`.
9. **Place content**: left-align feature/function names and execution cells. Write empty `()` and array markers `[]` without inner spaces. Measure an object array as one outer row from the opening `{` to the closing `}`, and confirm that every preserved property's `:` and separating `,` share a column.
10. **Handle overlong rows**: consider splitting a new row over column 120 at a semantic boundary. Do not change an accepted grid in a reference file without user confirmation.
11. **Verify by measurement**: confirm the selected short repeated blocks and JSDoc exposure with the display-width and hover measurers. Confirm with execution, type checking and target tests that behavior did not change.

## Authoring axis contract — the single basis for prompts and checks

Code is written **from the moment of authoring** with the axis columns below already aligned. Before completion, the checker applies a second lock. This table maps 1:1 to the `KIND_AXES` registry in `grid-kinds.ts`; when document examples and checker output differ, **the checker wins**.

- **Gap axis** — leave at least one space before the token. Within a table, pad with spaces up to the actual longest value to align the column.
- **Insert axis** — preserve existing TypeScript conventions. Do not pry apart attached tokens (`)`, `):`, `":`); padding goes outside.
- A table exists only for three or more contiguous same-role rows. Blank lines, comments and JSDoc break a table. Conditional-type `:`, `for` header `;`, empty statements and one-line execution blocks are not alignment targets.
- Axis names use the checker registry identifiers verbatim: `colon` (`:` after a name), `equals` (`=`), `semicolon` (`;`), `comma` (`,`), `comment` (trailing `//`), `open-paren` (`(`), `close-paren` (`)`), `case-colon` (case label `:`), `call-paren` (first call `(` in a case row), `subject-close-paren` (call-statement subject `)`), `matcher-dot` (right-hand matcher `.`), `matcher-open-paren` / `matcher-close-paren` (matcher argument cell), `return-tail` (start of a bare `return;`), `value` (expression start), `open-brace` / `close-brace` (object row `{ }`).

| Kind | Gap axes | Insert axes |
|---|---|---|
| declaration | `:` , `;` | `//` |
| declaration-equals (declaration table with `=`) | `:` , `=` , `;` | `//` |
| type-alias | `=` , `;` | `//` |
| method-signature · class-method | — | `(` , `)` , return `:` , `//` |
| interface-members · class-members · type-members (`type X = { ... }`) | `:` , `=` , `;` | `//` |
| enum-member | `=` , `,` | `//` |
| case-clause | — | case `:` |
| object-rows (`{i}` per property position) | property start `{i}` , `:{i}` , `value{i}` start , `,{i}` , `}` | `{` , tail `tail` (`,` `;` `)` `as const`) |
| registration | `:` , expression start | — |
| assignments (`this.x = y;` assignment table) | `=` , `;` | `//` |
| call-statements (`expect(…).toBe(…);` call-statement table) | `;` | subject `)` , matcher `.` , matcher `(` , matcher `)` , `//` |

Authoring examples — all identical to the checker's `--write` output:

```ts
const alpha : string  = "a"  ;
const beta  : number  = 22   ;
const gamma : boolean = true ;

type AppOptions      = RunOptions             ;
type SessionList     = RecentSessionSummary[] ;
type ThreadSelection = string | null          ;
```

```ts
	runFirst (first: string                ): Promise<void>;
	runSecond(second: number, extra: string): void;
	listAll  ()                             : Promise<string[]>;

	dashboard : new DashboardRail(get, synthetic),
	workflow  : new WorkflowRail(get, synthetic),
	context   : new ContextRail(get, synthetic),

	Low    = 1   ,
	Middle = 22  ,
	High   = 333 ,

	case "a"  : return "first";
	case "bb" : return "second";
	case "ccc": return "third";
```

Insert-axis conventions — things the checker never reverts, however the code is written:

- Empty parameter lists stay attached as `()`, are excluded from `)` alignment, and keep their padding outside the parentheses.
- Return types attach to `)` as in `): Promise<void>`. The `:` of `case "a":` also attaches to the label.
- Between rows with long and short parameter lists, the `)` column is aligned only by widening the inner space right after `(` and right before `)`.

Two-point lock:

1. **Authoring time (prompt)** — when an LLM or a person writes code, they write it in the form of the table and examples above. Agent definitions use SKILL.md as their manual, so this section is the prompt.
2. **Completion time (check)** — every changed file passes `00_normalize-imports.ts` (check mode) and `06_align-tables.ts --file` (misaligned=0). If you want a form that cannot pass both checks, change this contract first.

## Discarded rules

- Do not place `=>` or comments in an arbitrary column farther than the longest row.
- Do not force statements with different meanings into one column across the file just because they share a token.
- Unrelated blocks do not share one maximum width. Cell widths are computed only within the current block being compared.
- Do not change the whole repository at once like an automatic formatter.
- Do not create center alignment with no comparison value, or arbitrary widths wider than the actual longest data.

## Interface split criteria

Dependencies that one consumer receives all at once, such as `CliDependencies`, stay as a single interface.

- `Run`: starts execution or delegates a command.
- `List`: looks up multiple items.
- `Select`: receives a user selection.
- `Write`: outputs to the user.

Expose each role with a section comment such as `// Run`. Inside a section use execution-flow order; do not reorder alphabetically. Do not create empty sections such as `Read` to fill a role that does not exist.
