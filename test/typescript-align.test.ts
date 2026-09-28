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
			"const value     = chars[index]!    ;",
			"const nextValue = chars[index + 1] ;",
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

	test("keeps one layer when one argument is 20 columns wider than the second widest", () => {
		expect(alignLines([
			'const open = charTokenAt(source, skipTrivia(source.text, node.expression.getEnd()));',
			'const close = charTokenAt(source, node.getEnd() - 1);',
		])).toEqual([
			'const open  = charTokenAt(source, skipTrivia(source.text, node.expression.getEnd())) ;',
			'const close = charTokenAt(source, node.getEnd() - 1)                                 ;',
		]);
	});
});
