import      { describe, expect, test        } from "bun:test"                         ;
import      { resolve                       } from "node:path"                        ;
import      { compareParse, parserAvailable, syntaxDiagnostics } from "@/common/parse-check.ts" ;
import      { syntacticDiagnostics          } from "@/typescript/load-source-file.ts" ;

/** A valid snippet and a whitespace-free break of it, per language. */
const CASES: Readonly<Record<string, readonly [string, string]>> = {
	python     : ["a = 1\nb = 2\n"                , "a = 1\nb = = 2\n"               ] ,
};

describe("compareParse", () => {
	for (const [language, [valid, broken]] of Object.entries(CASES)) {
		test.skipIf(!parserAvailable(language))(`${language}: a parse-changing edit is detected and a whitespace edit is not`, () => {
			expect(compareParse(language, valid, broken).status               ).toBe("changed") ;
			expect(compareParse(language, valid, valid.replace(" = ", "   = ")).status).toBe("ok"     ) ;
		});
	}
});

describe("syntaxDiagnostics", () => {
	test("parses one input even when no comparison edit exists", () => {
		expect(syntaxDiagnostics("python", "pass\n").diagnostics).toEqual([]);
		expect(syntaxDiagnostics("python", "if:\n").diagnostics.length).toBeGreaterThan(0);
	});
});

describe("syntacticDiagnostics (TypeScript)", () => {
	test("reports parse errors by line and code, and none for valid code", async () => {
		const root = resolve(import.meta.dir, "..");
		const file = resolve(
			root                                ,
			"test/fixtures/table-kinds.ts"
		);
		expect(await syntacticDiagnostics(root, file, await Bun.file(file).text())).toEqual([]);
	});
});
