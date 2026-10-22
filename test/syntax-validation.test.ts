import      { expect, test                 } from "bun:test"                      ;
import      { mkdtempSync, rmSync, writeFileSync } from "node:fs"                ;
import      { tmpdir                       } from "node:os"                       ;
import      { join                         } from "node:path"                     ;

import      { validateSyntax               } from "@/common/syntax-validation.ts" ;

test("TypeScript parser failures are errors rather than invalid syntax", async () => {
	const root = mkdtempSync(join(tmpdir(), "boxbox-syntax-"));
	try {
		writeFileSync(join(root, "valid.ts"), "export {};\n");
		const result = await validateSyntax({ root, file: "valid.ts", language: "typescript" }, {
			typeScriptDiagnostics: async () => { throw new Error("synthetic parser failure"); },
		});
		expect(result).toEqual({ status: "error", tool: "typescript", diagnostics: ["synthetic parser failure"] });
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
