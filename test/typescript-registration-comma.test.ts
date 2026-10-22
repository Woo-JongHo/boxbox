import      { afterEach, describe, expect, test                } from "bun:test"                           ;
import      { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"                            ;
import      { tmpdir                                           } from "node:os"                            ;
import      { join, resolve                                    } from "node:path"                          ;
import      { preservesTokens                                  } from "@/typescript/token-preservation.ts" ;
import type { ResultEnvelope                                   } from "@/common/result-json.ts"            ;

const script               = resolve(import.meta.dir, "../product/engine/typescript/06_align-tables.ts") ;
const workspaces: string[] = []                                                                          ;

afterEach(() => {
	for (const workspace of workspaces.splice(0)) rmSync(workspace, { recursive: true, force: true });
});

function run(source: string, flags: readonly string[]): { readonly text: string; readonly report: ResultEnvelope; readonly exitCode: number } {
	const root = mkdtempSync(join(tmpdir(), "boxbox-registration-")) ;
	const file = join       (root, "sample.ts"                     ) ;

	workspaces.push(root);
	writeFileSync(file, source);

	const result = Bun.spawnSync(["bun", script, "--file", "sample.ts", "--json", ...flags], { cwd: root });

	return { text: readFileSync(file, "utf8"), report: JSON.parse(result.stdout.toString()) as ResultEnvelope, exitCode: result.exitCode };
}

describe("registration rows align their trailing comma", () => {
	const ragged  = ["const config = {", "\talpha : 1,", "\tbeta  : \"two\",", "\tgamma : [1, 2, 3],", "\tdelta : { nested: true },", "};", ""].join("\n")                                      ;
	const aligned = ["const config = {", "\talpha : 1                ,", "\tbeta  : \"two\"            ,", "\tgamma : [1, 2, 3]        ,", "\tdelta : { nested: true } ,", "};", ""].join("\n") ;

	test("a comma-attached object is reported as misaligned on the comma axis", () => {
		const { report, exitCode } = run(ragged, []);
		const group                = report.results[0]!.groups.find(candidate => candidate.kind === "registration")!;

		expect(exitCode                                  ).toBe   (1                              ) ;
		expect(group.state                               ).toBe   ("FIXABLE"                      ) ;
		expect(group.axes.map(axis => axis.split("=")[0])).toEqual(["colon", "value", "comma"]    ) ;
	});

	test("write puts the commas in one column without changing tokens, and a second run is a fixed point", () => {
		const { text, exitCode } = run(ragged, ["--write"]);

		expect(exitCode                     ).toBe(0       ) ;
		expect(text                         ).toBe(aligned ) ;
		expect(preservesTokens(ragged, text)).toBe(true    ) ;
		expect(run(text, []).exitCode       ).toBe(0       ) ;
	});

	test("a last property without a comma stays out of the comma column, which the other rows still share", () => {
		const source   = ["const config = {", "\talpha : 1,", "\tbeta  : \"two\",", "\tgamma : [1, 2, 3]", "};", ""].join("\n");
		const { text } = run(source, ["--write"]);
		const lines    = text.split("\n");

		expect(lines[1]).toBe("\talpha : 1     ,"  ) ;
		expect(lines[2]).toBe("\tbeta  : \"two\" ,") ;
		expect(lines[3]).toBe("\tgamma : [1, 2, 3]") ;
	});
});
