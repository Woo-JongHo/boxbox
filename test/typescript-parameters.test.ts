import      { afterEach, describe, expect, test                } from "bun:test"                              ;
import      { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"                               ;
import      { tmpdir                                           } from "node:os"                               ;
import      { join, resolve                                    } from "node:path"                             ;

import type { ResultEnvelope, ResultGroup                      } from "@/common/24_result-json.ts"            ;
import      { patternOf                                        } from "@/common/03_surface.ts"                ;
import type { Node                                             } from "typescript/unstable/ast"               ;
import      { loadSourceFile                                   } from "@/typescript/15_load-source-file.ts"   ;

import      { preservesTokens                                  } from "@/typescript/16_token-preservation.ts" ;

const ROOT                  = resolve(import.meta.dir, "..")                              ;
const SCRIPT                = join(ROOT, "product/engine/typescript/07_align-tables.ts")  ;
const CLI                   = join(ROOT, "product/packages/cli/entry.ts")                 ;
const FIXTURE               = join(ROOT, "test/fixtures/vertical-function-parameters.ts") ;
const workspaces : string[] = []                                                          ;

afterEach(() => {
	for (const workspace of workspaces.splice(0)) rmSync(workspace, { recursive: true, force: true });
});

function workspace(source: string): string {
	const root = mkdtempSync(join(tmpdir(), "boxbox-parameters-"));
	workspaces.push(root);
	writeFileSync(join(root, "sample.ts"), source);
	return root;
}

function align(root: string): { readonly text: string; readonly groups: readonly ResultGroup[] } {
	const result = Bun.spawnSync(["bun", SCRIPT, "--file", "sample.ts", "--write", "--json"], { cwd: root, stderr: "pipe", stdout: "pipe" }) ;
	const report = JSON.parse(result.stdout.toString()) as ResultEnvelope                                                                    ;
	expect(result.exitCode, result.stderr.toString() || result.stdout.toString()).toBe(report.results[0]!.summary.refused > 0 ? 1 : 0);
	return { text: readFileSync(join(root, "sample.ts"), "utf8"), groups: report.results[0]!.groups };
}

const parameters = (groups: readonly ResultGroup[]): readonly ResultGroup[] => groups.filter(group => group.kind === "vertical-function-parameters");

function astShape(node: Node): readonly unknown[] {
	const children: (readonly unknown[])[] = [];
	node.forEachChild(child => { children.push(astShape(child)); return undefined; });
	return children.length === 0 ? [node.kind, node.getText()] : [node.kind, ...children];
}

describe("vertical TypeScript function parameters", () => {
	test("aligns typed and defaulted rows and only their existing commas", () => {
		const source = readFileSync(FIXTURE, "utf8") ;
		const root   = workspace(source)             ;
		const result = align(root)                   ;
		const group  = parameters(result.groups)[0]  ;
		expect(group).toBeDefined();
		expect(group!.rows                                        ).toBe   (5                                                         ) ;
		expect(patternOf("typescript", group!)                    ).toEqual({ pattern: "DESCRIBE", alternatives: [] }                 ) ;
		expect(group!.axes.map(axis => axis.replace(/=\d+$/u, ""))).toEqual(["parameter-colon", "parameter-equals", "parameter-comma"]) ;
		expect(result.text).toBe([
			"function configure(",
			"\targs        : readonly string[] ,",
			"\tallowDryRun : boolean           ,",
			"\troot        : string            ,",
			"\tallowAuthoring = false          ,",
			"\tallowExpect    = false",
			"): void {}",
			"",
		].join("\n"));
		expect(preservesTokens(source, result.text)).toBe(true);
		expect(align(root).text).toBe(result.text);
	}, 60_000);

	test("preserves the parser AST and physical lines for the reported parameter shape", async () => {
		const source = "/** Configure the command. */\n" + readFileSync(FIXTURE, "utf8") ;
		const root   = workspace(source)                                                 ;
		const before = astShape((await loadSourceFile(root, "sample.ts")).source)        ;
		const result = align(root)                                                       ;
		const after  = astShape((await loadSourceFile(root, "sample.ts")).source)        ;
		expect(after                                                    ).toEqual(before                   ) ;
		expect(result.text.split("\n").length                           ).toBe   (source.split("\n").length) ;
		expect(result.text.startsWith("/** Configure the command. */\n")).toBe   (true                     ) ;
	}, 60_000);

	test("keeps CRLF, indentation and an existing final comma", () => {
		const source = "function values(\r\n  a:number,\r\n  longer:string,\r\n  middle:boolean,\r\n): void {}\r\n" ;
		const result = align(workspace(source))                                                                     ;
		expect(parameters(result.groups)           ).toHaveLength(1                                                                                                        ) ;
		expect(result.text                         ).toBe        ("function values(\r\n  a      :number  ,\r\n  longer :string  ,\r\n  middle :boolean ,\r\n): void {}\r\n") ;
		expect(preservesTokens(source, result.text)).toBe        (true                                                                                                     ) ;
	}, 60_000);

	test("supports a type and default on the same row and keeps comment-like strings opaque", () => {
		const source = 'function values(\n\ta:string="//",\n\tlonger:string="/* */",\n\tmiddle:string="x,y"\n): void {}\n' ;
		const root   = workspace(source)                                                                                   ;
		const result = align(root)                                                                                         ;
		expect(parameters(result.groups)                                                 ).toHaveLength(1                                                         ) ;
		expect(parameters(result.groups)[0]!.axes.map(axis => axis.replace(/=\d+$/u, ""))).toEqual     (["parameter-colon", "parameter-equals", "parameter-comma"]) ;
		expect(preservesTokens(source, result.text)                                      ).toBe        (true                                                      ) ;
		expect(align(root).text                                                          ).toBe        (result.text                                               ) ;
	}, 60_000);

	test("keeps unsupported lists intact instead of aligning a supported subset", () => {
		const cases = [
			"const amount = 4;\nfunction values(\n\tfirst = amount! / 2 /* keep */ + 3,\n\tsecond = 12,\n\tthird = 100\n): void {}\n",
			"function values(\n\ta = `${1 /* keep */}`,\n\tlonger = false,\n\tmiddle = true\n): void {}\n",
			"function values(\n\n\ta:number,\n\tlonger:string,\n\tmiddle:boolean\n): void {}\n",
			"function values(\n\ta:number,\n\tlonger:string,\n\tmiddle:boolean\n\n): void {}\n",
			"function values(\n\ta:number,\n\n\tlonger:string,\n\tmiddle:boolean,\n\tlast:number\n): void {}\n",
			"function values(\n\ta:number,\n\tlonger:string\n): void {}\n",
			"function values(a:number, longer:string, middle:boolean): void {}\n",
			"function values(a:number,\n\tlonger:string,\n\tmiddle:boolean\n): void {}\n",
			"function values(\n\ta:number,\n\tlonger:string,\n\tmiddle:boolean): void {}\n",
			"function values(\n\ta:number,\n\t{x}: {x:number},\n\tlonger:string,\n\tmiddle:boolean\n): void {}\n",
			"function values(\n\ta:number,\n\tlonger:string,\n\tmiddle:boolean,\n\t...rest:string[]\n): void {}\n",
			"function values(\n\ta:number, // keep\n\tlonger:string,\n\tmiddle:boolean,\n\tlast:number\n): void {}\n",
			"function values(\n\t/* keep */ a:number,\n\tlonger:string,\n\tmiddle:boolean,\n\tlast:number\n): void {}\n",
			"function values(\n\ta: /* keep */ number,\n\tlonger:string,\n\tmiddle:boolean,\n\tlast:number\n): void {}\n",
			"function values(\n\ta:number,\n\tlonger:string,\n\tmiddle:boolean /* keep */\n): void {}\n",
			"function values(\n\ta:number,\n\tlonger:\n\t\tstring,\n\tmiddle:boolean,\n\tlast:number\n): void {}\n",
			"function values(\n\ta:number,\n\tlonger =\n\t\tfalse,\n\tmiddle:boolean,\n\tlast:number\n): void {}\n",
			"const values = (\n\ta:number,\n\tlonger:string,\n\tmiddle:boolean\n): void => {};\n",
			"class Example {\nvalues(\n\ta:number,\n\tlonger:string,\n\tmiddle:boolean\n): void {}\n}\n",
		];
		for (const source of cases) {
			const result = align(workspace(source));
			expect(parameters(result.groups).filter(group => group.state !== "REFUSE"), source).toHaveLength(0);
			expect(result.text, source).toBe(source);
		}
	}, 60_000);

	test("reports unsupported vertical lists without warning on smaller or other function shapes", () => {
		const cases = [
			["comments", "function values(\n\ta:number, // keep\n\tlonger:string,\n\tmiddle:boolean\n): void {}\n", 1],
			["rest", "function values(\n\ta:number,\n\tlonger:string,\n\t...middle:boolean[]\n): void {}\n", 1],
			["multiline type", "function values(\n\ta:number,\n\tlonger:\n\t\tstring,\n\tmiddle:boolean\n): void {}\n", 1],
			["two rows", "function values(\n\ta:number,\n\tlonger:string\n): void {}\n", 0],
			["one physical line", "function values(a:number, longer:string, middle:boolean): void {}\n", 0],
			["arrow", "const values = (\n\ta:number,\n\tlonger:string,\n\tmiddle:boolean\n): void => {};\n", 0],
		] as const;
		for (const [name, source, count] of cases) {
			const root    = workspace(source)                                                                                                    ;
			const run     = Bun.spawnSync(["bun", SCRIPT, "--file", "sample.ts", "--json"], { cwd: root, stderr: "pipe", stdout: "pipe" })       ;
			const report  = JSON.parse(run.stdout.toString()) as ResultEnvelope                                                                  ;
			const refused = report.results[0]!.groups.filter(group => group.kind === "vertical-function-parameters" && group.state === "REFUSE") ;
			expect(refused, name).toHaveLength(count);
			if (count > 0) {
				expect(run.exitCode, name).toBe(1);
				expect(refused[0]!.startLine, name).toBe(2);
				expect(refused[0]!.endLine, name).toBe(source.includes("longer:\n") ? 5 : 4);
				expect(refused[0]!.rows, name).toBe(3);
				expect(refused[0]!.reason, name).toContain("unsupported");
			}
			expect(readFileSync(join(root, "sample.ts"), "utf8"), name).toBe(source);
		}
	}, 60_000);

	test("keeps comment-like regex literals opaque", () => {
		const source = "function values(\n\ta = /[//]/,\n\tlonger = /[/*]/,\n\tmiddle = /x,y/\n): void {}\n" ;
		const root   = workspace(source)                                                                     ;
		const result = align(root)                                                                           ;
		expect(parameters(result.groups)           ).toHaveLength(1          ) ;
		expect(preservesTokens(source, result.text)).toBe        (true       ) ;
		expect(align(root).text                    ).toBe        (result.text) ;
	}, 60_000);

	test("keeps template literal text opaque while inspecting interpolation comments", () => {
		const source = "function values(\n\ta = `// ${1} /* text */`,\n\tlonger = `/* ${2} // text`,\n\tmiddle = `// ${3}`\n): void {}\n" ;
		const root   = workspace(source)                                                                                                  ;
		const result = align(root)                                                                                                        ;
		expect(parameters(result.groups)           ).toHaveLength(1          ) ;
		expect(preservesTokens(source, result.text)).toBe        (true       ) ;
		expect(align(root).text                    ).toBe        (result.text) ;
	}, 60_000);

	test("supports generic declarations and optional names without sharing widths between functions", () => {
		const source = "function wide<T>(\n\ta:T,\n\tlongParameterName:T,\n\tlast?:T\n): void {}\n\nfunction small(\n\tx:number,\n\ty:string,\n\tz?:boolean\n): void {}\n" ;
		const root   = workspace(source)                                                                                                                                   ;
		const result = align(root)                                                                                                                                         ;
		const groups = parameters(result.groups)                                                                                                                           ;
		expect(groups                              ).toHaveLength(2                   ) ;
		expect(groups[0]!.axes                     ).toContain   ("parameter-colon=22") ;
		expect(groups[1]!.axes                     ).toContain   ("parameter-colon=7" ) ;
		expect(preservesTokens(source, result.text)).toBe        (true                ) ;
		expect(align(root).text                    ).toBe        (result.text         ) ;
	}, 60_000);

	test("reports the new kind without granting public write approval", () => {
		const source = readFileSync (FIXTURE, "utf8"                                                                                      ) ;
		const root   = workspace    (source                                                                                               ) ;
		const check  = Bun.spawnSync(["bun", CLI, "check", "--file", "sample.ts", "--json"], { cwd: root, stderr: "pipe", stdout: "pipe" }) ;
		expect(check.exitCode).toBe(1);
		const report = JSON.parse(check.stdout.toString());
		expect(parameters(report.results[0].groups)   ).toHaveLength(1                                                                                             ) ;
		expect(report.formatReadiness.approvalEligible).toBe        (false                                                                                         ) ;
		expect(report.formatReadiness.approvalFacts   ).toEqual     (expect.arrayContaining([expect.objectContaining({ status: "unknown", proofComplete: false })])) ;

		const write = Bun.spawnSync(["bun", CLI, "align", "--file", "sample.ts", "--json"], { cwd: root, stderr: "pipe", stdout: "pipe" });
		expect(write.exitCode                                ).toBe(2                   ) ;
		expect(JSON.parse(write.stdout.toString()).error.code).toBe("ALIGN_NOT_ELIGIBLE") ;
		expect(readFileSync(join(root, "sample.ts"), "utf8") ).toBe(source              ) ;
	}, 60_000);
});
