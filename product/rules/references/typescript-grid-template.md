# TypeScript Grid Template

Examples have the same form as `06_align-tables.ts --write` output. When this document and the checker output differ, **the checker wins**; the gap/insert distinction per axis follows the [authoring axis contract in the readability contract](readability-contract.md). Each role section is an independent table and does not borrow another section's longest value.

## Private local types

The terminating `;` is also a column (rule 35). Align `=` and `;` to the actual longest value and attach a `//` note column.

```ts
type AppOptions      = RunOptions             ; // application run input
type SessionList     = RecentSessionSummary[] ; // sessions to display
type ThreadSelection = string | null          ; // null means the user cancelled
```

Align the `//` column so local type notes read alongside their declarations. Exported types and public optional properties do not use this form; they keep the hover contract with JSDoc before the declaration.

## Method signature table

Align `(` after the name width and `)` after the maximum parameter width. Empty parameter lists stay attached as `()` with padding outside the parentheses. The return-type `:` stays attached to `)` and only its column is aligned.

```ts
export interface MethodContract {
	runFirst (first: string                ): Promise<void>;
	runSecond(second: number, extra: string): void;
	listAll  ()                             : Promise<string[]>;
}
```

## Declaration table (declaration-equals)

`:`, `=` and the terminating `;` are each one column. Declarations without a type align only `=` and `;`.

```ts
const alpha : string  = "a"  ;
const beta  : number  = 22   ;
const gamma : boolean = true ;
```

**Call layer.** When every row's value is the same call (same callee text, same argument count, nothing after the `)`), the call is a nested table: each top-level `,` sits right after the widest argument, the next argument starts one space later, and `)` sits right after the widest last argument. The same applies to the call inside a call statement's subject. Rows with different callees or arities keep one layer, and so does a table where one argument is 20 or more columns wider than the second widest in its column (the import outlier rule B); such a row is a candidate for the vertical form instead.

```ts
const left  = diagnostics(toolchain, before) ;
const right = diagnostics(toolchain, after ) ;

expect(preservesTokens(text        , text.replace("c  d", "c d"))).toBe(false) ;
expect(preservesTokens("let x = 1;", "letx = 1;"                )).toBe(false) ;
```

**Outer call envelope.** Different simple callees or arities can share outer parentheses in a declaration table.
The whole argument list is one cell; inner commas keep their original layout. One trailing `!` stays attached.
Empty calls keep `()` and share only the opening column. Optional, computed, awaited, constructor and generic calls,
call-produced receivers, trailing commas and comments on the editable boundaries are outside this form.
The new `declaration-call-envelope` kind uses its own lookup key, so existing same-call preset approval is not reused.

```ts
const decision = registry.decisions.get(convention.id                 )! ;
const document = resolveDocument       (decision.ref, convention.layer)  ;
```

**List layer.** A literal list inside the table is a nested table of its own: the declaration value itself (`const STATES = [...] ;`), an argument of the layered call, or a matcher argument (`expect(x).toEqual([...])`). `[` / `{` keep one column, each item `,` sits right after the widest item in its column, the next item starts one space later, and `]` / `}` sits right after the widest last item. A slot is kept only when every row has the same list shape there (same arity, or the same object property names) and every item is a string, number or boolean literal; lists with identifiers or calls (argv-like), lists with a trailing comma or a multi-line form, and lists where one item is 20 or more columns wider than the second widest in its column stay compact. Dropping the call layer drops the list slots inside its arguments.

```ts
const STATES = new Set(["PASS", "FIXABLE", "SUGGEST", "REFUSE" ]) ;
const PARSES = new Set(["ok"  , "changed", "skipped", "not-run"]) ;

expect(states(key)).toEqual(["PASS", "FIXABLE"]) ;
expect(states(key)).toEqual(["ok"  , "changed"]) ;
```

**Vertical form.** When one row's call argument is 20 or more columns wider than the second widest in its column (the import outlier rule B), that row takes the vertical form instead of dragging the table wide: the row goes to its own multi-line statement — arguments one per line under the opening `(`, each non-last argument comma right after the widest argument (the horizontal call-layer rule), and the closing `);` on the statement's indentation — while the remaining rows keep the call layer. The vertical row keeps the table's `=` column. The render only inserts line breaks and padding; a row left vertical leaves the table on the next run and is never touched again.

```ts
const open  = charTokenAt(
	source                                           ,
	skipTrivia(source.text, node.expression.getEnd()),
);
const close = charTokenAt(source, node.getEnd() - 1);
```

**Subscript cells.** When a declaration's value is a subscript read (`chars[index]!`, `chars[index + 1]` — a leading `!` is fine), the closing `]` sits right after the widest index in the column. The slot is kept only when every row has the subscript on the same object and no index is an outlier (import rule B).

```ts
const value = chars[index    ]! ;
const next  = chars[index + 1]  ;
```

**Guard rows.** Consecutive one-line `if (…) { …; continue; }` statements whose block ends in `continue` and has no `else` form a table: the condition's closing `)` hugs the widest condition, the first statement's `;` hugs the widest first statement, and the trailing `continue` shares one column. The statements in between stay as written.

```ts
if (value === "/" && next === "/") { state = "line"    ; chars[index] = chars[index + 1] = " "; index += 1; continue; }
if (value === "`"                ) { state = "template"; chars[index] = " ";                                continue; }
```

**Member calls.** The final property separator is its own column: `receiver | . | method | ( | arguments | )`.
Nested receiver expressions stay in the receiver cell. Bare function calls have no member separator; punctuation
inside argument expressions has its own role and is not part of this dot column.

```ts
const rows = Array.from  (items    ) ;
const over = rows .filter(isVisible) ;
```

**Return guards.** `return-guards` aligns the start of `return`, leaving the condition's spelling unchanged.
Three or more supported guards in one immediate block form a scoped comparison region; see
[column-sharing regions](readability-contract.md#column-sharing-regions) for region boundaries. Intervening
statements stay in place, and a final unconditional return keeps its own role. This is a column boundary,
not an instruction to insert blank lines or move guards above the values they inspect.

```ts
function read(value: unknown) {
	if (!value)                        return undefined;
	const declared = value;

	if (declared === undefined)        return undefined;
	const unwrapped = declared;
	if (typeof unwrapped !== 'string') return undefined;
	return unwrapped;
}
```

## Registration objects · enum members · case rows

```ts
const rails = {
	dashboard : new DashboardRail(get, synthetic),
	workflow  : new WorkflowRail(get, synthetic),
	context   : new ContextRail(get, synthetic),
};

enum Level {
	Low    = 1   ,
	Middle = 22  ,
	High   = 333 ,
}
```

```ts
	switch (input) {
		case "a"  : return "first";
		case "bb" : return "second";
		case "ccc": return "third";
		default: return "rest";
	}
```

## Dependency interface

```ts
export interface ExampleDependencies {
	// Run — `string` is the widest Promise content in this section.
	runFirst  : ( value : FirstInput  ) => Promise< void >;       // first run
	runSecond : ( value : SecondInput ) => Promise<string>;       // second run

	// List — `SessionList` is the widest value in this section.
	listSessions : () => Promise<SessionList>;                    // list sessions
	listThreads  : () => Promise<ThreadList >;                    // list threads

	// Select — a single row, so its own actual value is the minimum width.
	selectThread : ( thread : ThreadList ) => Promise<ThreadSelection>; // select a thread
}
```

`Promise< >` width is computed per role section, but trailing `//` notes share one column across the same interface declaration table, using only the outer space after `;` without widening the type cell.

## Execution dependencies

If the longest argument is `threads`, the inner width of `( )` is 7. Only `args` and `value` are centered within it. Empty arguments stay attached as `()`, with the padding up to `=>` outside the parentheses.

```ts
runApp             : async (options) => action(options),
runAuth            : async ( args  ) => action(args),
listSessions       : async ()        => action(),
selectNativeThread : async (threads) => action(threads),
writeOut           :       ( value ) => action(value),
```

When a one-line body ends with a call, align only the call's start column and do not pad after the value.

```ts
runShort : async (value) => { const { run } = await import("module"); return run(value); },
runLong  : async (value) => { const { run } = await import("module"); return run(value, "extra"); },
```

## Object-array column specification

Do not let omitted presentational defaults give rows different cell counts. Keep the column specification and data rows separate.

```ts
const columns = [
	{ heading : "SOURCE"      , minWidth : 7, weight : 0, align : "left"  },
	{ heading : "DISTRIBUTION", minWidth : 4, weight : 1, align : "left"  },
	{ heading : "SIZE"        , minWidth : 6, weight : 0, align : "right" },
	{ heading : "SHARE"       , minWidth : 6, weight : 0, align : "right" },
] as const;
const rows = sources.map(source => [
	source.code,
	source.distribution,
	source.size,
	source.share,
]);

return renderTable({ columns, rows }, width);
```

In this table `{`, the four `:`, the three property-separating `,` and `}` must each share a column. If omitting a property is a real contract difference, do not fill in the default; move that row to a separate table.

## Registration objects and local computations

```ts
const rails = {
    dashboard : new DashboardRail(get, synthetic),
    workflow  : new WorkflowRail (get, synthetic),
    context   : new ContextRail  (get, synthetic),
};

const widths = columnWidths(width);
const left   = (widths[0] ?? width) - 2;
const middle = (widths[1] ?? width) - 2;
const right  = (widths[2] ?? width) - 2;
```

For registration objects measure `:`, `new` and the argument start; for declaration blocks measure `=` and the expression start. Keep different required constructor arguments, and do not cram several registration entries into one row.

## Verification

Do not mix role sections in one run; check each line range separately.
The following measurement command is for the development skill, where `<SKILL>/engine` contains the source helpers.
Public plugin checks and fixes use the bundled launcher described in its SKILL.md.

```bash
bun <SKILL>/engine/measure-layout.ts src/cli.ts \
  --lines 52-62 \
  --tokens ':#1|(#1|)#1|=>' \
  --center-cell '(#1' \
  --compact-before '}#2'
```

If the result is not `center(()=ok`, existing spaces were reused as width or the value is not centered within the minimum cell.

## Function map

Put a reading map of the file's functions at the top of a feature implementation file. `08_function-map.ts` checks drift between the map and the declarations.

```ts
// GROUP | FUNCTION        | INPUT              | RETURN  | CALLS             | ROLE
// RUN   | runCli           | args, dependencies | Promise | runBuildCommand   | command dispatch
// BUILD | runBuildCommand  | args, dependencies | Promise | writeSessions     | build run
```

GROUP is the role section in the file (RUN, LIST, STATE, ...), INPUT lists parameter names, and CALLS lists call targets in the file. Check drift with `08_function-map.ts --file <target file>`, and generate a skeleton with `--scaffold`.
