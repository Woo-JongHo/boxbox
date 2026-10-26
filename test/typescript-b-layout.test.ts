import      { afterEach, describe, expect, test                } from "bun:test"                           ;
import      { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"                            ;
import      { tmpdir                                           } from "node:os"                            ;
import      { join, relative, resolve                          } from "node:path"                          ;

import type { ResultEnvelope, ResultGroup                      } from "@/common/result-json.ts"            ;
import      { displayWidth                                     } from "@/common/display-width.ts"          ;
import      { alignRows                                        } from "@/typescript/align.ts"              ;
import type { DetectedRow                                      } from "@/typescript/grid-kinds.ts"         ;
import      { loadSourceFile                                   } from "@/typescript/load-source-file.ts"   ;
import      { preservesTokensWithBreaks                        } from "@/typescript/token-preservation.ts" ;

const ROOT                  = resolve(import.meta.dir, "..")                                ;
const SCRIPT                = resolve(ROOT, "product/engine/typescript/06_align-tables.ts") ;
const workspaces : string[] = []                                                            ;

interface Aligned {
	readonly before : string                 ;
	readonly text   : string                 ;
	readonly groups : readonly ResultGroup[] ;
	readonly passes : number                 ;
}

afterEach(() => {
	for (const workspace of workspaces.splice(0)) rmSync(workspace, { recursive: true, force: true });
});

function run(source: string): Aligned {
	const workspace = mkdtempSync(join(tmpdir(), "boxbox-b-layout-")) ;
	const file      = join       (workspace, "sample.ts"            ) ;
	workspaces.push(workspace);
	writeFileSync(file, source);

	const first = Bun.spawnSync(["bun", SCRIPT, "--file", "sample.ts", "--write", "--json"], { cwd: workspace, stderr: "pipe", stdout: "pipe" });
	if (first.exitCode !== 0) throw new Error(first.stderr.toString());
	expect(first.exitCode).toBe(0);
	const text   = readFileSync (file, "utf8"                                                                                        ) ;
	const second = Bun.spawnSync(["bun", SCRIPT, "--file", "sample.ts", "--json"], { cwd: workspace, stderr: "pipe", stdout: "pipe" }) ;
	if (second.exitCode !== 0) throw new Error(second.stdout.toString() || second.stderr.toString());
	expect(second.exitCode).toBe(0);
	const report      = JSON.parse(second.stdout.toString()) as ResultEnvelope ;
	const firstReport = JSON.parse(first.stdout.toString()) as ResultEnvelope  ;
	return {
		before : source                                                                                          ,
		text                                                                                                     ,
		groups : report.results[0]!.groups                                                                       ,
		passes : firstReport.results[0]!.parse.status === "ok" ? (firstReport.results[0]!.parse.passes ?? 0) : 0 ,
	};
}

function group(result: Aligned, kind: string): ResultGroup {
	const match = result.groups.find(candidate => candidate.kind === kind);
	expect(match).toBeDefined();
	return match!;
}

function axisNames(value: ResultGroup): readonly string[] {
	return value.axes.map(axis => axis.replace(/=.*/u, ""));
}

describe("TypeScript B-layout regions", () => {
	test("aligns extended object headers without inventing shorthand or multiline punctuation", () => {
		const result = run([
			"const formatters = [];",
			"const value = {",
			"\tstatus: 'error',",
			"\t상태:true,", // cjk-test-data
			"\tnoGroups:false,",
			"\tunsupported : [],",
			"\tdetail:",
			"\t\t`긴 상세 값`,", // cjk-test-data
			"\tfingerprint: sourceFingerprint,",
			"\tlayers: names,",
			"\tformatters,",
			"\tlanguages: names,",
			"\tmetadata",
			"};",
			"",
		].join("\n"));
		const object  = group(result, "object-properties")                    ;
		const lines   = result.text.split("\n")                               ;
		const headers = lines.slice(2, 13).filter(line => line.includes(":")) ;

		expect(object.rows                                                                 ).toBe        (10                                                                                          ) ;
		expect(result.groups.some(candidate => candidate.kind === "registration")          ).toBe        (false                                                                                       ) ;
		expect(axisNames(object)                                                           ).toEqual     (["property-colon", "property-colon2", "property-comma2", "property-value", "property-comma"]) ;
		expect(new Set(headers.map(line => displayWidth(line.slice(0, line.indexOf(":")))))).toHaveLength(1                                                                                           ) ;
		expect(result.text                                                                 ).toContain   ("\tdetail      :\n\t\t`긴 상세 값`,"                                                        ) ; // cjk-test-data
		expect(result.text                                          )    .toContain("\tformatters"         ) ;
		expect(result.text                                          ).not.toContain("formatters :"         ) ;
		expect(result.text                                          )    .toContain("\tlanguages   : names") ;
		expect(result.text                                          )    .toContain("\tmetadata"           ) ;
		expect(result.text                                          ).not.toContain("metadata,"            ) ;
		expect(preservesTokensWithBreaks(result.before, result.text))    .toBe     (true                   ) ;
	}, 60_000);

	test("keeps legacy ordinary-property minima inside one extended object region", () => {
		const result = run([
			"const shorthand = false;",
			"const value = {",
			"\talpha:1,",
			"\tbeta:22,",
			"\tgamma:333,",
			"\tshorthand,",
			"\tformatterExecuted:'a much wider terminal',",
			"\tformatMode:'standalone',",
			"\tmetadata",
			"};",
			"",
		].join("\n"));
		const object = group            (result, "object-properties") ;
		const lines  = result.text.split("\n"                       ) ;

		expect(result.groups.some(candidate => candidate.kind === "registration")).toBe(false);
		expect(axisNames(object)).toEqual([
			"property-colon",
			"property-value",
			"property-comma",
			"property-colon2",
			"property-comma2",
		]);
		expect(lines.slice(2, 5)).toEqual([
			"\talpha : 1   ,",
			"\tbeta  : 22  ,",
			"\tgamma : 333 ,",
		]);
		expect(displayWidth(lines[5]!.slice(0, lines[5]!.indexOf(","))))    .toBe     (displayWidth(lines[6]!.slice(0, lines[6]!.indexOf(",")))) ;
		expect(result.text                                             ).not.toContain("shorthand :"                                           ) ;
		expect(preservesTokensWithBreaks(result.before, result.text)   )    .toBe     (true                                                    ) ;
	}, 60_000);

	test("aligns homogeneous leading logical slots and keeps equality operators indivisible", () => {
		const result = run([
			"function changed(checked: any, file: any, language: any, ready: any) {",
			"\tif (",
			"\t\tchecked.file !== file",
			"\t || checked.language != language",
			"\t\t|| !ready",
			"\t) return true;",
			"\treturn false;",
			"}",
			"",
		].join("\n"));
		const logical = group(result, "logical-chains")     ;
		const lines   = result.text.split("\n").slice(2, 5) ;

		expect(logical.rows                                         )    .toBe     (3                                                                                                      ) ;
		expect(axisNames(logical)                                   )    .toEqual  (["logical-operator", "logical-not", "logical-operand", "comparison-operator1-1", "comparison-right1-1"]) ;
		expect(lines[0]                                             )    .toContain("!=="                                                                                                  ) ;
		expect(lines[1]                                             )    .toContain("!="                                                                                                   ) ;
		expect(lines[2]                                             )    .toContain("!ready"                                                                                               ) ;
		expect(lines[2]                                             ).not.toContain("! ready"                                                                                              ) ;
		expect(preservesTokensWithBreaks(result.before, result.text))    .toBe     (true                                                                                                   ) ;
	}, 60_000);

	test("aligns leading && chains whose first operand stays on a return or declaration line", () => {
		const result = run([
			"function enabled(first: boolean, second: boolean, third: boolean) {",
			"\tconst local = first",
			"\t\t&& second",
			"\t && !third;",
			"\treturn first",
			"\t\t&& !second",
			"\t && third;",
			"}",
			"function literal(name: string) {",
			"\treturn name === 'a'",
			"\t\t|| name === 'bb'",
			"\t || name === 'ccc';",
			"}",
			"",
		].join("\n"));
		const logical = result.groups.filter(candidate => candidate.kind === "logical-chains") ;
		const lines   = result.text  .split ("\n"                                            ) ;

		expect(logical                                                                                      )    .toHaveLength   (3              ) ;
		expect(logical.every(candidate => candidate.axes.some(axis => axis.startsWith("logical-operator="))))    .toBe           (true           ) ;
		expect(result.text                                                                                  )    .toContain      ("&& !third"    ) ;
		expect(result.text                                                                                  )    .toContain      ("&& !second"   ) ;
		expect(result.text                                                                                  ).not.toContain      ("! third"      ) ;
		expect(result.text                                                                                  ).not.toContain      ("! second"     ) ;
		expect(result.text                                                                                  )    .toContain      ("return   name") ;
		expect(result.text                                                                                  ).not.toContain      ("returnname"   ) ;
		expect([lines[2], lines[3], lines[5], lines[6]].every(line => line?.startsWith("\t"))               )    .toBe           (true           ) ;
	}, 60_000);

	test("keeps first-row and continuation unary-not slots in one logical axis order", () => {
		const result = run([
			"function enabled(first: boolean, second: boolean, third: boolean) {",
			"\treturn !first",
			"\t\t&& second",
			"\t && !third;",
			"}",
			"function guarded(first: boolean, second: boolean, third: boolean) {",
			"\tif (",
			"\t\t!first",
			"\t\t&& second",
			"\t && !third",
			"\t) return true;",
			"\treturn false;",
			"}",
			"",
		].join("\r\n"));
		const logical = result.groups.filter(candidate => candidate.kind === "logical-chains") ;
		const lines   = result.text  .split ("\r\n"                                          ) ;

		expect(logical                                              )    .toHaveLength(2                                                          ) ;
		expect(logical.map(axisNames)                               )    .toEqual  ([
			["logical-operator", "logical-not", "logical-operand"],
			["logical-operator", "logical-not", "logical-operand"],
		]) ;
		expect(result.text                                                                             )    .toContain("return   !first"                                          ) ;
		expect(result.text                                                                             )    .toContain("&& !third"                                                ) ;
		expect(result.text                                                                             ).not.toContain("! first"                                                  ) ;
		expect(result.text                                                                             ).not.toContain("! third"                                                  ) ;
		expect([lines[2], lines[3], lines[7], lines[8], lines[9]].every(line => line?.startsWith("\t")))    .toBe     (true                                                       ) ;
		expect(result.text.replaceAll("\r\n", "")                                                      ).not.toContain("\n"                                                       ) ;
		expect(preservesTokensWithBreaks(result.before, result.text)                                   )    .toBe     (true                                                       ) ;
	}, 60_000);

	test("keeps mixed, grouped and double-negated logical expressions opaque", () => {
		const source = [
			"function mixed(a: any, b: any, c: any) {",
			"\tif (",
			"\t\ta",
			"\t\t|| b",
			"\t\t&& c",
			"\t) return;",
			"\tif (",
			"\t\ta",
			"\t\t|| (b || c)",
			"\t\t|| !!c",
			"\t) return;",
			"}",
			"",
		].join("\n");
		const result = run(source);

		expect(result.text).toBe(source);
		expect(result.groups.some(candidate => candidate.kind === "logical-chains")).toBe(false);
	}, 60_000);

	test("requires three ordinary rows and does not read operators from strings or comments", () => {
		const source = [
			"const detail = {",
			"\tshort: '||',",
			"\tshorthand,",
			"};",
			"function two(a: any, b: any) {",
			"\tif (",
			"\t\ta === '||'",
			"\t\t|| b === '&&'",
			"\t) return;",
			"\tif (",
			"\t\ta",
			"\t\t|| !!b",
			"\t\t|| a",
			"\t) return;",
			"}",
			"",
		].join("\n");
		const result = run(source);

		expect(result.text                                                            ).toBe(source) ;
		expect(result.groups.some(candidate => candidate.kind === "object-properties")).toBe(false ) ;
		expect(result.groups.some(candidate => candidate.kind === "logical-chains")   ).toBe(false ) ;
	}, 60_000);

	test("aligns braced and immediate-return if-header families separately", () => {
		const result = run([
			"function check(a: any, longer: any, c: any) {",
			"\tif (a) {",
			"\t\twork();",
			"\t}",
			"\tif (longer) {",
			"\t\tother();",
			"\t}",
			"\tif (c) {",
			"\t\tlast();",
			"\t}",
			"\tif (a) return false;",
			"\tif (longer) return false;",
			"\tif (c) return false;",
			"\treturn true;",
			"}",
			"",
		].join("\n"));
		const braced   = group(result, "if-headers-braced") ;
		const returned = group(result, "if-headers-return") ;

		expect(axisNames(braced)                                                  ).toEqual(["if-close-paren", "if-open-brace"]) ;
		expect(axisNames(returned)                                                ).toEqual(["if-close-paren", "if-return"]    ) ;
		expect(result.groups.some(candidate => candidate.kind === "return-guards")).toBe   (false                              ) ;
	}, 60_000);

	test("lets a two-row guard prefix inherit a mixed braced-header family", () => {
		const result = run([
			"function parse(argument: string, allow: boolean) {",
			"\twhile (true) {",
			"\t\tif (argument === '--json') { useJson(); continue; }",
			"\t\tif (argument === '--dry-run' && allow) { useDryRun(); continue; }",
			"\t\tif (argument === '--authoring' && allow) {",
			"\t\t\tuseAuthoring();",
			"\t\t}",
			"\t\tif (argument === '--expect-axis' && allow) {",
			"\t\t\tuseAxis();",
			"\t\t}",
			"\t\tif (argument === '--file' || argument === '--language') {",
			"\t\t\tuseFile();",
			"\t\t}",
			"\t}",
			"}",
			"function scan(value: string) {",
			"\twhile (true) {",
			"\t\tif (value === 'a') { first(); continue; }",
			"\t\tif (value === 'bb') { second(); continue; }",
			"\t\tif (value === 'ccc') { third(); continue; }",
			"\t}",
			"}",
			"",
		].join("\n"));
		const braced = group(result, "if-headers-braced")                                                                                                                   ;
		const guards = group(result, "guard-statements")                                                                                                                    ;
		const braces = result.text.split("\n").slice(2, 13).filter(line => line.trimStart().startsWith("if (")).map(line => displayWidth(line.slice(0, line.indexOf("{")))) ;

		expect(braced.rows                                          ).toBe        (5                                                      ) ;
		expect(axisNames(braced)                                    ).toEqual     (["if-close-paren", "if-open-brace"]                    ) ;
		expect(new Set(braces)                                      ).toHaveLength(1                                                      ) ;
		expect(guards.rows                                          ).toBe        (3                                                      ) ;
		expect(axisNames(guards)                                    ).toEqual     (["guard-close-paren", "guard-semi1", "guard-continue"] ) ;
		expect(preservesTokensWithBreaks(result.before, result.text)).toBe        (true                                                   ) ;
	}, 60_000);

	test("blank lines and interstitial comments split if-header families", () => {
		const source = [
			"function split(a: any, longer: any, c: any, d: any) {",
			"\tif (a) {",
			"\t\tfirst();",
			"\t}",
			"\tif (longer) {",
			"\t\tsecond();",
			"\t}",
			"",
			"\tif (c) {",
			"\t\tthird();",
			"\t}",
			"\t// separate family",
			"\tif (d) {",
			"\t\tfourth();",
			"\t}",
			"}",
			"",
		].join("\n");
		const result = run(source);

		expect(result.text).toBe(source);
		expect(result.groups.some(candidate => candidate.kind === "if-headers-braced")).toBe(false);
	}, 60_000);

	test("aligns existing vertical-call commas and preserves an absent last comma with CRLF", () => {
		const result = run([
			"consumeString(",
			"\tsource,",
			"\tmasked,",
			"\tindex,",
			"\tindex + openToken.length,",
			"\tspec0.close,",
			"\tspec0.escape",
			");",
			"",
		].join("\r\n"));
		const call  = group(result, "vertical-call-arguments") ;
		const lines = result.text.split("\r\n").slice(1, 7)    ;

		expect(axisNames(call)                                           )    .toEqual     (["vertical-call-comma"]) ;
		expect(new Set(lines.slice(0, -1).map(line => line.indexOf(","))))    .toHaveLength(1                      ) ;
		expect(lines.at(-1)                                              ).not.toContain   (","                    ) ;
		expect(result.text                                               )    .toContain   ("\r\n"                 ) ;
		expect(result.text.replaceAll("\r\n", "")                        ).not.toContain   ("\n"                   ) ;
	}, 60_000);

	test("aligns recursive comparison and conditional axes in a two-row declaration table", () => {
		const result = run([
			"const folder=join(root, host === 'codex' ? '.codex' : '.claude');",
			"const path=join(folder, host === 'codex' ? 'hooks.json' : 'settings.json');",
			"",
		].join("\n"));
		const declarations = group(result, "declaration-call-expressions");

		expect(declarations.rows).toBe(2);
		expect(axisNames(declarations)).toEqual([
			"equals",
			"call-open-paren",
			"call-comma1",
			"call-arg2",
			"comparison-operator2-1",
			"comparison-right2-1",
			"conditional-question2-1",
			"conditional-true2-1",
			"conditional-colon2-1",
			"conditional-false2-1",
			"call-close-paren",
			"semicolon",
		]);
		expect(result.passes).toBeGreaterThan(0);
		expect(preservesTokensWithBreaks(result.before, result.text)).toBe(true);
	}, 60_000);

	test("inherits a two-row call-expression subgroup inside a heterogeneous declaration table", () => {
		const result = run([
			"function install(args: readonly string[]) {",
			"\tconst root=rootOf(args.slice(2));",
			"\tconst host=args[1];",
			"\tconst folder=join(root,host === 'codex' ? '.codex' : '.claude');",
			"\tconst path=join(folder,host === 'codex' ? 'hooks.json' : 'settings.json');",
			"\tconst document=existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};",
			"\tconst quote=(value: string) => value;",
			"\tconst entry=process.argv[1]!;",
			"\tconst prefix=`${entry}`;",
			"\treturn { root, host, folder, path, document, quote, entry, prefix };",
			"}",
			"",
		].join("\n"));
		const outer = group(result, "declaration-equals")           ;
		const inner = group(result, "declaration-call-expressions") ;
		const lines = result.text.split("\n").slice(3, 5)           ;

		expect(outer.rows      ).toBe   (8                       ) ;
		expect(axisNames(outer)).toEqual(["equals", "semicolon"] ) ;
		expect(inner.rows      ).toBe   (2                       ) ;
		expect(axisNames(inner)).toEqual([
			"call-open-paren",
			"call-comma1",
			"call-arg2",
			"comparison-operator2-1",
			"comparison-right2-1",
			"conditional-question2-1",
			"conditional-true2-1",
			"conditional-colon2-1",
			"conditional-false2-1",
			"call-close-paren",
		]);
		expect(lines.map(line => displayWidth(line.slice(0, line.indexOf("==="))))).toEqual([40, 40]) ;
		expect(lines.map(line => displayWidth(line.slice(0, line.indexOf("?"))))  ).toEqual([52, 52]) ;
		expect(preservesTokensWithBreaks(result.before, result.text)              ).toBe   (true    ) ;
	}, 60_000);

	test("does not admit a non-declaration pair into declaration call-expression subgroups", () => {
		const source = [
			"function invoke(root: string, folder: string, host: string) {",
			"\tjoin(root, host === 'codex' ? '.codex' : '.claude');",
			"\tjoin(folder, host === 'codex' ? 'hooks.json' : 'settings.json');",
			"}",
			"",
		].join("\n");
		const result = run(source);

		expect(result.groups.some(candidate => candidate.kind === "declaration-call-expressions")).toBe(false);
		expect(result.text).toBe(source);
	}, 60_000);
});

describe("physical-line alignment conflicts", () => {
	test("refuses cyclic axis dependencies and overlapping whitespace ownership", async () => {
		const workspace = mkdtempSync(join(ROOT, "test", "boxbox-b-solver-")) ;
		const target    = join       (workspace, "sample.ts"                ) ;
		workspaces.push(workspace);
		writeFileSync(target, "a   b\nc   d\n");
		const loaded = await loadSourceFile(ROOT, relative(ROOT, target))                             ;
		const node   = loaded.source                                                                  ;
		const row    = (boundaries: DetectedRow["boundaries"]): DetectedRow => ({ node, boundaries }) ;
		const cycle = alignRows(loaded.source, [
			row([{ axis: "a", from: 1, at: 4 }, { axis: "b", from: 5, at: 5, insert: true }]),
			row([{ axis: "b", from: 7, at: 10 }, { axis: "a", from: 11, at: 11, insert: true }]),
		]);
		const overlap = alignRows(loaded.source, [
			row([{ axis: "a", from: 1, at: 4 }, { axis: "b", from: 1, at: 4 }]),
			row([{ axis: "a", from: 7, at: 10 }, { axis: "b", from: 7, at: 10 }]),
		]);

		expect(cycle.conflict              ).toContain("cycle"         ) ;
		expect(cycle.edits                 ).toEqual  ([]              ) ;
		expect(overlap.conflict            ).toContain("overlap"       ) ;
		expect(overlap.edits               ).toEqual  ([]              ) ;
		expect(readFileSync(target, "utf8")).toBe     ("a   b\nc   d\n") ;
	}, 60_000);
});
