import      { afterEach, describe, expect, test } from "bun:test"                                               ;
import      {
              mkdtempSync                     ,
              readFileSync                    ,
              rmSync                          ,
              writeFileSync                   ,
                                                } from "node:fs"                                                ;
import      { join, relative, resolve           } from "node:path"                                              ;
import      { preservesTokens                   } from "../skills/xxx/scripts/typescript/token-preservation.ts" ;

const root                 = resolve(import.meta.dir, "..")                                    ;
const script               = resolve(root, "skills/xxx/scripts/typescript/06_align-tables.ts") ;
const workspaces: string[] = []                                                                ;

afterEach(() => {
	for (const workspace of workspaces.splice(0)) rmSync(workspace, { recursive: true, force: true });
});

describe("typescript call statement alignment", () => {
	test("aligns subject/matcher parentheses, dots and semicolons of consecutive call statements", () => {
		const workspace = mkdtempSync(join(import.meta.dir, "typescript-align-")) ;
		const target    = join(workspace, "calls.ts")                             ;
		workspaces.push(workspace);
		writeFileSync(target, [
			'expect(lstatSync(skill).isDirectory()).toBe(true);',
			'expect(lstatSync(skill).isSymbolicLink()).toBe(false);',
			'expect(realpathSync(skill)).not.toBe(realpathSync(pluginSkill));',
		].join("\n") + "\n");

		const file   = relative(root, target)                                                                                   ;
		const result = Bun.spawnSync(["bun", script, "--file", file, "--write"], { cwd: root, stderr: "pipe", stdout: "pipe" }) ;
		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("call-statements");
		expect(readFileSync(target, "utf8")).toBe([
			'expect(lstatSync(skill).isDirectory()   )    .toBe(true                     ) ;',
			'expect(lstatSync(skill).isSymbolicLink())    .toBe(false                    ) ;',
			'expect(realpathSync(skill)              ).not.toBe(realpathSync(pluginSkill)) ;',
		].join("\n") + "\n");
	});
});

describe("typescript object row alignment", () => {
	test("aligns braces, properties, colons, values and commas of object rows", () => {
		const workspace = mkdtempSync(join(import.meta.dir, "typescript-align-")) ;
		const target    = join(workspace, "objects.ts")                           ;
		workspaces.push(workspace);
		writeFileSync(target, [
			"const boundaries: RowBoundary[] = [",
			'  {axis:"subject-close-paren",from:subjectClose,at:subjectClose,insert:true,},',
			'    { axis: "matcher-dot", from: matcherDot, at: matcherDot, insert: true, },',
			'   {axis : "matcher-open-paren",from : matcherOpen,at : matcherOpen,insert : true,},',
			'  { axis : "matcher-close-paren", from : matcherClose, at : matcherClose, insert : true, },',
			'    {axis:"semicolon",from:expression.getEnd(),at:semicolon,insert:false,},',
			"] ;",
		].join("\n") + "\n");

		const file   = relative(root, target)                                                                                   ;
		const result = Bun.spawnSync(["bun", script, "--file", file, "--write"], { cwd: root, stderr: "pipe", stdout: "pipe" }) ;
		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("object-rows");
		expect(readFileSync(target, "utf8")).toBe([
			"const boundaries: RowBoundary[] = [",
			'    { axis : "subject-close-paren" , from : subjectClose        , at : subjectClose , insert : true  , },',
			'    { axis : "matcher-dot"         , from : matcherDot          , at : matcherDot   , insert : true  , },',
			'    { axis : "matcher-open-paren"  , from : matcherOpen         , at : matcherOpen  , insert : true  , },',
			'    { axis : "matcher-close-paren" , from : matcherClose        , at : matcherClose , insert : true  , },',
			'    { axis : "semicolon"           , from : expression.getEnd() , at : semicolon    , insert : false , },',
			"] ;",
		].join("\n") + "\n");
	});
});

describe("typescript whitespace-only guarantee", () => {
	test("the fixture aligns with an identical token stream and no refused table", () => {
		const workspace = mkdtempSync(join(import.meta.dir, "typescript-align-"))                   ;
		const target    = join(workspace, "table-kinds.ts")                                         ;
		const before    = readFileSync(resolve(root, "skills/xxx/fixtures/table-kinds.ts"), "utf8") ;
		workspaces.push(workspace);
		writeFileSync(target, before);

		const result = Bun.spawnSync(["bun", script, "--file", relative(root, target), "--write"], { cwd: root, stderr: "pipe", stdout: "pipe" });
		expect(result.exitCode                                      ).toBe     (0          ) ;
		expect(result.stdout.toString()                             ).toContain("refused=0") ;
		expect(result.stdout.toString()                             ).toContain("parse=ok" ) ;
		expect(preservesTokens(before, readFileSync(target, "utf8"))).toBe     (true       ) ;
	});
});

describe("typescript row floors", () => {
	test("a 2-row = declaration table is aligned; a 2-row group of another kind is not", () => {
		const workspace = mkdtempSync(join(import.meta.dir, "typescript-align-")) ;
		const target    = join(workspace, "floors.ts")                            ;
		workspaces.push(workspace);
		writeFileSync(target, [
			"const value = chars[index]!;",
			"const nextValue = chars[index + 1];",
			"",
			"interface Pair {",
			"\ta: string;",
			"\tlonger: number;",
			"}",
		].join("\n") + "\n");

		const result = Bun.spawnSync(["bun", script, "--file", relative(root, target), "--write"], { cwd: root, stderr: "pipe", stdout: "pipe" });
		expect(result.exitCode).toBe(0);
		expect(readFileSync(target, "utf8")).toBe([
			"const value     = chars[index    ]! ;",
			"const nextValue = chars[index + 1]  ;",
			"",
			"interface Pair {",
			"\ta: string;",
			"\tlonger: number;",
			"}",
		].join("\n") + "\n");
	});
});

/** Writes `lines` to a temporary file, runs the aligner with --write, and returns the file's lines. */
function alignLines(lines: readonly string[]): readonly string[] {
	const workspace = mkdtempSync(join(import.meta.dir, "typescript-align-")) ;
	const target    = join(workspace, "layer.ts")                             ;
	workspaces.push(workspace);
	writeFileSync(target, `${lines.join("\n")}\n`);
	const result = Bun.spawnSync(["bun", script, "--file", relative(root, target), "--write"], { cwd: root, stderr: "pipe", stdout: "pipe" });
	expect(result.exitCode).toBe(0);
	return readFileSync(target, "utf8").split("\n").slice(0, -1);
}

describe("typescript call layer", () => {
	test("aligns the commas and closing paren of the same call in declaration values", () => {
		expect(alignLines([
			'const left = diagnostics(toolchain, before);',
			'const right = diagnostics(toolchain, after);',
		])).toEqual([
			'const left  = diagnostics(toolchain, before) ;',
			'const right = diagnostics(toolchain, after ) ;',
		]);
	});

	test("aligns the call inside call-statement subjects", () => {
		expect(alignLines([
			'expect(preservesTokens(text, text.replace("c  d", "c d"))).toBe(false);',
			'expect(preservesTokens("let x = 1;", "letx = 1;")).toBe(false);',
			'expect(preservesTokens("a == b;", "a = = b;")).toBe(false);',
		])).toEqual([
			'expect(preservesTokens(text        , text.replace("c  d", "c d"))).toBe(false) ;',
			'expect(preservesTokens("let x = 1;", "letx = 1;"                )).toBe(false) ;',
			'expect(preservesTokens("a == b;"   , "a = = b;"                 )).toBe(false) ;',
		]);
	});

	test("keeps one layer when the callee or the arity differs", () => {
		expect(alignLines([
			'const a = first(x, y);',
			'const bb = second(x, y);',
		])).toEqual([
			'const a  = first(x, y)  ;',
			'const bb = second(x, y) ;',
		]);
		expect(alignLines([
			'const a = pick(x, yy);',
			'const bb = pick(x);',
		])).toEqual([
			'const a  = pick(x, yy) ;',
			'const bb = pick(x)     ;',
		]);
	});
});

describe("typescript declaration vertical form", () => {
	test("takes the outlier row vertical when one argument is 20 columns wider than the second widest", () => {
		expect(alignLines([
			'const open = charTokenAt(source, skipTrivia(source.text, node.expression.getEnd()));',
			'const close = charTokenAt(source, node.getEnd() - 1);',
		])).toEqual([
			'const open  = charTokenAt(',
			'\tsource                                           ,',
			'\tskipTrivia(source.text, node.expression.getEnd())',
			');',
			'const close = charTokenAt(source, node.getEnd() - 1);',
		]);
	});

	test("keeps the call layer on the remaining rows when one row goes vertical", () => {
		expect(alignLines([
			'const a = pair(alpha, tiny, gamma);',
			'const bb = pair(alpha, a-much-longer-second-argument, gamma);',
			'const cc = pair(alpha, small, gamma);',
		])).toEqual([
			'const a  = pair(alpha, tiny , gamma) ;',
			'const bb = pair(',
			'\talpha                        ,',
			'\ta-much-longer-second-argument,',
			'\tgamma',
			');',
			'const cc = pair(alpha, small, gamma) ;',
		]);
	});

	test("takes every row vertical when each is the outlier of its own column", () => {
		expect(alignLines([
			'const left = pair(veryLongFirstArgumentHere, x);',
			'const right = pair(y, veryLongSecondArgumentHere);',
		])).toEqual([
			'const left  = pair(',
			'\tveryLongFirstArgumentHere,',
			'\tx',
			');',
			'const right = pair(',
			'\ty                         ,',
			'\tveryLongSecondArgumentHere',
			');',
		]);
	});

	test("keeps a single-argument call flat; a vertical row leaves the table on the next run", () => {
		expect(alignLines([
			'const wide = lone(greatlyWiderSingleArgumentText);',
			'const slim = lone(short);',
		])).toEqual([
			'const wide = lone(greatlyWiderSingleArgumentText) ;',
			'const slim = lone(short)                          ;',
		]);
		const once = alignLines([
			'const open = charTokenAt(source, skipTrivia(source.text, node.expression.getEnd()));',
			'const close = charTokenAt(source, node.getEnd() - 1);',
		]);
		expect(alignLines(once)).toEqual(once);
	});

	test("call statements keep one flat layer instead of going vertical", () => {
		expect(alignLines([
			'expect(handle(wideArgumentExpression)).toBe(true);',
			'expect(handle(x)).toBe(false);',
			'expect(handle(y)).toBe(true);',
		])).toEqual([
			'expect(handle(wideArgumentExpression)).toBe(true ) ;',
			'expect(handle(x)                     ).toBe(false) ;',
			'expect(handle(y)                     ).toBe(true ) ;',
		]);
	});
});

describe("typescript hand-made samples", () => {
	test("aligns the closing bracket of subscript declaration values", () => {
		expect(alignLines([
			'const value = chars[index]!;',
			'const next = chars[index + 1];',
		])).toEqual([
			'const value = chars[index    ]! ;',
			'const next  = chars[index + 1]  ;',
		]);
	});

	test("keeps subscript values flat when the objects differ or a row has none", () => {
		expect(alignLines([
			'const value = chars[index]!;',
			'const next = other[index];',
		])).toEqual([
			'const value = chars[index]! ;',
			'const next  = other[index]  ;',
		]);
		expect(alignLines([
			'const value = chars[index]!;',
			'const next = tokens.next;',
		])).toEqual([
			'const value = chars[index]! ;',
			'const next  = tokens.next   ;',
		]);
	});

	test("aligns ragged guard rows onto the hand-made form", () => {
		expect(alignLines([
			'if (value === "/" && next === "/") { state = "line"; chars[index] = " "; index += 1; continue; }',
			'if (value === "/" && next === "*") { state = "block"; chars[index] = " "; index += 1; continue; }',
			'if (value === "`") { state = "template"; chars[index] = " "; continue; }',
		])).toEqual([
			'if (value === "/" && next === "/") { state = "line"    ; chars[index] = " "; index += 1; continue; }',
			'if (value === "/" && next === "*") { state = "block"   ; chars[index] = " "; index += 1; continue; }',
			'if (value === "`"                ) { state = "template"; chars[index] = " ";             continue; }',
		]);
	});

	test("keeps the hand-aligned guard sample of 00_normalize-imports unchanged", () => {
		const sample = [
			'\t\t\tif (value === "/" && next === "/") { state = "line"    ; chars[index] = chars[index + 1] = " "; index += 1; continue; }',
			'\t\t\tif (value === "/" && next === "*") { state = "block"   ; chars[index] = chars[index + 1] = " "; index += 1; continue; }',
			'\t\t\tif (value === "`"                ) { state = "template"; chars[index] = " ";                                continue; }',
			'\t\t\tif (value === "\'"                ) { state = "single"  ;                                                    continue; }',
			'\t\t\tif (value === \'"\'                ) { state = "double"  ;                                                    continue; }',
		];
		expect(alignLines(sample)).toEqual(sample);
	});

	test("blocks that do not end in continue and two-row groups stay as written", () => {
		expect(alignLines([
			'if (value === "/") { state = "line"; index += 1; }',
			'if (value === "*") { state = "block"; index += 1; }',
		])).toEqual([
			'if (value === "/") { state = "line"; index += 1; }',
			'if (value === "*") { state = "block"; index += 1; }',
		]);
	});
});

describe("typescript list layer", () => {
	test("aligns the elements, commas and closing bracket of the same literal list in a call", () => {
		expect(alignLines([
			'const STATES = new Set(["PASS", "FIXABLE", "SUGGEST", "REFUSE"]);',
			'const PARSES = new Set(["ok", "changed", "skipped", "not-run"]);',
		])).toEqual([
			'const STATES = new Set(["PASS", "FIXABLE", "SUGGEST", "REFUSE" ]) ;',
			'const PARSES = new Set(["ok"  , "changed", "skipped", "not-run"]) ;',
		]);
	});

	test("aligns the literal list of a matcher argument", () => {
		expect(alignLines([
			'expect(states(key)).toEqual(["PASS", "FIXABLE"]);',
			'expect(states(key)).toEqual(["ok", "changed"]);',
			'expect(states(key)).toEqual(["no", "off"]);',
		])).toEqual([
			'expect(states(key)).toEqual(["PASS", "FIXABLE"]) ;',
			'expect(states(key)).toEqual(["ok"  , "changed"]) ;',
			'expect(states(key)).toEqual(["no"  , "off"    ]) ;',
		]);
	});

	test("aligns a declaration value that is itself a literal list", () => {
		expect(alignLines([
			'const short = ["a", "bb"];',
			'const longer = ["c", "dd"];',
			'',
			'const limits = { low: 1, high: 10 };',
			'const bounds = { low: 2, high: 300 };',
		])).toEqual([
			'const short  = ["a", "bb"] ;',
			'const longer = ["c", "dd"] ;',
			'',
			'const limits = { low: 1, high: 10 } ;',
			'const bounds = { low: 2, high: 300} ;',
		]);
	});

	test("keeps a list with identifiers compact and aligns only the row layer", () => {
		expect(alignLines([
			'const argv = ["bun", "run", script];',
			'const args = ["bun", "run", other];',
		])).toEqual([
			'const argv = ["bun", "run", script] ;',
			'const args = ["bun", "run", other]  ;',
		]);
	});

	test("keeps the call layer but drops the list slot when the arity differs", () => {
		expect(alignLines([
			'const a = pick(["x"], "tail");',
			'const b = pick(["x", "yy"], "tail");',
		])).toEqual([
			'const a = pick(["x"]      , "tail") ;',
			'const b = pick(["x", "yy"], "tail") ;',
		]);
	});

	test("drops the call layer and the lists inside its arguments when the callee differs", () => {
		expect(alignLines([
			'const a = first(["x"], y);',
			'const bb = pick(["zz"], y);',
		])).toEqual([
			'const a  = first(["x"], y) ;',
			'const bb = pick(["zz"], y) ;',
		]);
	});

	test("drops a list whose item is 20 columns wider than the second widest", () => {
		expect(alignLines([
			'const widths = ["tiny", "a-very-much-longer-element-string"];',
			'const others = ["ok", "fine"];',
		])).toEqual([
			'const widths = ["tiny", "a-very-much-longer-element-string"] ;',
			'const others = ["ok", "fine"]                                ;',
		]);
	});

	test("drops a list with a trailing comma or a multi-line form", () => {
		expect(alignLines([
			'const trail = ["a", "bb",];',
			'const other = ["c", "dd", "e"];',
		])).toEqual([
			'const trail = ["a", "bb",]     ;',
			'const other = ["c", "dd", "e"] ;',
		]);
		expect(alignLines([
			'const multi = [',
			'\t"a",',
			'\t"bb",',
			'];',
			'const single = ["c", "dd"];',
		])).toEqual([
			'const multi = [',
			'\t"a",',
			'\t"bb",',
			'];',
			'const single = ["c", "dd"];',
		]);
	});
});
