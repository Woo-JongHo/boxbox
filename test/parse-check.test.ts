import      { describe, expect, test        } from "bun:test"                                             ;
import      { resolve                       } from "node:path"                                            ;
import      { compareParse, parserAvailable } from "../skills/xxx/scripts/common/parse-check.ts"          ;
import      { syntacticDiagnostics          } from "../skills/xxx/scripts/typescript/load-source-file.ts" ;

/** A valid snippet and a whitespace-free break of it, per language. */
const CASES: Readonly<Record<string, readonly [string, string]>> = {
	python     : ["a = 1\nb = 2\n"                , "a = 1\nb = = 2\n"               ],
	go         : ["package p\n\nvar a = 1\n"      , "package p\n\nvar a = = 1\n"     ],
	javascript : ["const a = 1;\n"                , "const a = = 1;\n"               ],
	c          : ["int a = 1;\n"                  , "int a = = 1;\n"                 ],
	cpp        : ["int a = 1;\n"                  , "int a = = 1;\n"                 ],
	java       : ["class A { int a = 1; }\n"      , "class A { int a = = 1; }\n"     ],
	rust       : ["fn main() { let a = 1; }\n"    , "fn main() { let a = = 1; }\n"   ],
};

describe("compareParse", () => {
	for (const [language, [valid, broken]] of Object.entries(CASES)) {
		test.skipIf(!parserAvailable(language))(`${language}: a parse-changing edit is detected and a whitespace edit is not`, () => {
			expect(compareParse(language, valid, broken).status               ).toBe("changed") ;
			expect(compareParse(language, valid, valid.replace(" = ", "   = ")).status).toBe("ok"     ) ;
		});
	}
});

describe("syntacticDiagnostics (TypeScript)", () => {
	test("reports parse errors by line and code, and none for valid code", async () => {
		const root = resolve(import.meta.dir, "..")                      ;
		const file = resolve(root, "skills/xxx/fixtures/table-kinds.ts") ;
		expect(await syntacticDiagnostics(root, file, await Bun.file(file).text())).toEqual([]);
	});
});
