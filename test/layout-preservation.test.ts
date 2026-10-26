import      { afterEach, describe, expect, test               } from "bun:test"                            ;
import      { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"                             ;
import      { join                                            } from "node:path"                           ;

import      { compareTypeScriptLayout                         } from "@/typescript/layout-preservation.ts" ;

const workspaces: string[] = [];

function target(): { readonly root: string; readonly file: string } {
	const root = mkdtempSync(join(import.meta.dir, "boxbox-layout-preservation-")) ;
	const file = join       (root, "sample.ts"                                   ) ;
	workspaces.push(root);
	writeFileSync(file, "export {};\n");
	return { root, file };
}

afterEach(() => {
	for (const root of workspaces.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("TypeScript layout preservation", () => {
	test("accepts line-break-only edits that preserve tokens, comments and AST structure", async () => {
		const path   = target()                                                                  ;
		const before = "const value = first && /* keep */ second && third && fourth;\n"          ;
		const after  = "const value = first\n\t&& /* keep */ second\n\t&& third\n\t&& fourth;\n" ;

		expect(await compareTypeScriptLayout(path.root, path.file, before, after)).toEqual({
			status : "preserved"                                                ,
			reason : "tokens, comments, diagnostics and AST structure preserved" ,
		});
		expect(readdirSync(path.root).sort()).toEqual(["sample.ts"]);
	}, 30_000);

	test("rejects changed token or comment bytes before parsing", async () => {
		const path = target();

		expect((await compareTypeScriptLayout(path.root, path.file, "const value = 1;\n", "const value = 2;\n")).status).toBe("tokens-changed");
	});

	test("rejects an ASI-sensitive line break even when the token sequence is unchanged", async () => {
		const path   = target()                                 ;
		const before = "function value() { return result; }\n"  ;
		const after  = "function value() { return\nresult; }\n" ;

		expect((await compareTypeScriptLayout(path.root, path.file, before, after)).status).toBe("structure-changed");
	}, 30_000);
});
