import      { afterEach, describe, expect, test                        } from "bun:test"                    ;
import      { mkdtempSync, readFileSync, rmSync, writeFileSync         } from "node:fs"                     ;
import      { tmpdir                                                   } from "node:os"                     ;
import      { join, resolve                                            } from "node:path"                   ;

import      { assertAlignmentOnly                                      } from "@/common/alignment-only.ts"  ;
import      { documentResolver, evaluateApproval, loadApprovalRegistry } from "@/common/approval-gate.ts"   ;
import      { runFormatPipeline                                        } from "@/common/format-pipeline.ts" ;
import      { lookupKeyOf                                              } from "@/common/signature.ts"       ;
import type { ResultEnvelope, ResultGroup                              } from "@/common/result-json.ts"     ;
import      { runTypeScriptAlign                                       } from "@/typescript/align.ts"       ;

const root                  = resolve(import.meta.dir, "..")                                ;
const preset                = join(root, "product/rules/presets/recommended")               ;
const wrapScript            = join(root, "product/engine/typescript/07_wrap-conditions.ts") ;
const workspaces : string[] = []                                                            ;

afterEach(() => {
	for (const workspace of workspaces.splice(0)) rmSync(workspace, { recursive: true, force: true });
});

function workspace(file: string, source: string): { readonly root: string; readonly file: string; readonly target: string } {
	const directory = mkdtempSync(join(tmpdir(), "boxbox-b-public-")) ;
	const target    = join       (directory, file                   ) ;
	workspaces.push(directory);
	writeFileSync(target, source);
	return { root: directory, file, target };
}

const approval = () => ({
	registry        : loadApprovalRegistry([{ root: preset, layer: "preset" }]),
	resolveDocument : documentResolver({ preset }),
});

async function inspect(path: { readonly root: string; readonly file: string }): Promise<readonly ResultGroup[]> {
	let report = "";
	await runTypeScriptAlign(["--file", path.file, "--json"], { root: path.root, emit: value => { report = value; } });
	return (JSON.parse(report) as ResultEnvelope).results[0]!.groups;
}

describe("public B-layout boundaries", () => {
	test("keeps the legacy approved TypeScript declaration key writable", async () => {
		const source = [
			"const first=load(1);",
			"const second=load(22);",
			"const third=load(333);",
			"",
		].join("\n");
		const path   = workspace("legacy.ts", source)                                                                   ;
		const result = await runFormatPipeline({ ...path, language: "typescript", alignmentOnly: true, ...approval() }) ;

		expect(result.written                   )    .toBe   (true                               ) ;
		expect(result.approvals                 )    .toEqual(["ts-sourcefile-call-declarations"]) ;
		expect(readFileSync(path.target, "utf8")).not.toBe   (source                             ) ;
	}, 60_000);

	test("denies a newly detected kind without borrowing the legacy approval key", async () => {
		const source = [
			"const detail = 'value';",
			"const options = {",
			"\tstatus:'error',",
			"\tnoGroups:false,",
			"\tunsupported : [],",
			"\tdetail,",
			"\tlanguages: names",
			"};",
			"",
		].join("\n");
		const path   = workspace("extended.ts", source)                                 ;
		const groups = await inspect(path)                                              ;
		const group  = groups.find(candidate => candidate.kind === "object-properties") ;

		expect(group).toBeDefined();
		expect(groups.some(candidate => candidate.kind === "registration")).toBe(false);
		expect(group!.axes).toEqual(expect.arrayContaining([
			expect.stringMatching(/^property-colon=/u),
			expect.stringMatching(/^property-comma=/u),
		]));
		const key = lookupKeyOf("typescript", group!.context, group!.kind, group!.axes);
		expect(key).toContain("|object-properties|");
		expect(key).not.toBe("v1|typescript|SourceFile|declaration-equals|equals>call-open-paren>call-close-paren>semicolon");

		await expect(runFormatPipeline({ ...path, language: "typescript", alignmentOnly: true, ...approval() })).rejects.toThrow("approval denied");
		expect(readFileSync(path.target, "utf8")).toBe(source);
	}, 60_000);

	test("keeps a heterogeneous declaration key stable while denying its nested join subgroup", async () => {
		const source = [
			"function install(args: string[]) {",
			"\tconst root = rootOf(args);",
			"\tconst host = args[1];",
			"\tconst folder = join(root,host==='codex'?'.codex':'.claude');",
			"\tconst path = join(folder, host === 'codex' ? 'hooks.json' : 'settings.json');",
			"\tconst document = existsSync(path) ? read(path) : {};",
			"\tconst quote = (value: string) => value;",
			"\tconst entry = process.argv[1]!;",
			"\tconst prefix = `${quote(entry)}`;",
			"\treturn { document, prefix };",
			"}",
			"",
		].join("\n");
		const path     = workspace("nested.ts", source)                                              ;
		const groups   = await inspect(path)                                                         ;
		const outer    = groups.find(candidate => candidate.kind === "declaration-equals")           ;
		const internal = groups.find(candidate => candidate.kind === "declaration-call-expressions") ;

		expect(outer   ).toBeDefined();
		expect(internal).toBeDefined();
		const outerKey    = lookupKeyOf     ("typescript", outer!.context, outer!.kind, outer!.axes                              ) ;
		const internalKey = lookupKeyOf     ("typescript", internal!.context, internal!.kind, internal!.axes                     ) ;
		const approvals   = approval        ()                                                                                     ;
		const decision    = evaluateApproval(approvals.registry, { key: internalKey, file: path.file }, approvals.resolveDocument) ;

		expect(outerKey   )    .toBe         ("v1|typescript|Block|declaration-equals|equals>semicolon") ;
		expect(internalKey)    .toContain    ("|declaration-call-expressions|"                         ) ;
		expect(internalKey).not.toBe         (outerKey                                                 ) ;
		expect(decision   )    .toMatchObject({ status: "unknown", writable: false }                   ) ;

		await expect(runFormatPipeline({ ...path, language: "typescript", alignmentOnly: true, ...approvals })).rejects.toThrow("approval denied");
		expect(readFileSync(path.target, "utf8")).toBe(source);
	}, 60_000);

	test("keeps authoring line breaks outside the public horizontal safety boundary", () => {
		const source = [
			"function accepts(a: boolean, b: boolean, c: boolean, d: boolean) {",
			"\tif (a && b && c && d) return true;",
			"\treturn false;",
			"}",
			"",
		].join("\n");
		const path = workspace("conditions.ts", source);
		const run  = Bun.spawnSync([process.execPath, wrapScript, "--file", path.file, "--write"], {
			cwd     : path.root ,
			stderr  : "pipe"    ,
			stdout  : "pipe"    ,
			timeout : 60_000    ,
		});

		expect(run.exitCode).toBe(0);
		const candidate = readFileSync(path.target, "utf8");
		expect(candidate.split("\n").length).toBeGreaterThan(source.split("\n").length);
		expect(() => assertAlignmentOnly(Buffer.from(source), Buffer.from(candidate), "typescript")).toThrow("alignment-only refusal");
	}, 60_000);
});
