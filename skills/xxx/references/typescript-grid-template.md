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

```bash
bun <SKILL>/scripts/measure-layout.ts src/cli.ts \
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
