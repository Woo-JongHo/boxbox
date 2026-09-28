import { describe, expect, test } from "bun:test";
import { alignSource }            from "../skills/xxx/scripts/common/table-engine.ts";
import { maskSource }             from "../skills/xxx/scripts/common/code-text.ts";
import { PYTHON_ALIGNER }         from "../skills/xxx/scripts/python/profile.ts";
import { defineLanguageSuite }    from "./lang-harness.ts";

defineLanguageSuite({
	aligner     : PYTHON_ALIGNER,
	fixturesDir : new URL("../skills/xxx/fixtures/python/", import.meta.url).pathname,
	tableFile   : "tables.py",
	alignedFile : "tables.aligned.py",
	trickyFile  : "tricky.py",
});

describe("python profile specific properties", () => {
	const align = (source: string): ReturnType<typeof alignSource> => alignSource(source, PYTHON_ALIGNER, { minRows: 3, apply: true });

	test("dictionary rows decompose into key, colon, value, comma axes and align the colon column", () => {
		const source = [
			"defaults = {",
			`    "host": "localhost:8080",`,
			`    "port": 8080,`,
			`    "debug": True,`,
			"}",
		].join("\n");
		const result = align(source);
		const lines = result.output.split("\n");
		expect(lines[1]     ).toBe(`    "host" : "localhost:8080",`) ;
		expect(lines[2]     ).toBe(`    "port" : 8080            ,`) ;
		expect(lines[3]     ).toBe(`    "debug": True            ,`) ;
		expect(result.tables).toBe(1                               ) ;
	});

	test("annotated assignments align name and type columns and never pad the trailing value", () => {
		const source = [
			"@dataclass",
			"class Config:",
			"    retries: int = 3",
			`    label: str = "x"`,
			"    verbose: bool = True",
		].join("\n");
		const result = align(source);
		const lines = result.output.split("\n");
		expect(lines[2]         ).toBe("    retries: int  = 3"   ) ;
		expect(lines[3]         ).toBe(`    label  : str  = "x"` ) ;
		expect(lines[4]         ).toBe("    verbose: bool = True") ;
		expect(result.misaligned).toBe(2                         ) ;
	});

	test("tightly written assignments also form a table and are fixed to conventional gaps (none after colon, spaces around equal)", () => {
		const source = [
			"ratio:float=0.5",
			"level:int=3",
			"name:str='x'",
		].join("\n");
		const result = align(source);
		const lines = result.output.split("\n");
		expect(lines[0]).toBe("ratio: float = 0.5") ;
		expect(lines[1]).toBe("level: int   = 3"  ) ;
		expect(lines[2]).toBe("name : str   = 'x'") ;
	});

	test("the profile refuses control-flow, call and line-continuation rows so they never form tables", () => {
		const source = [
			"if flag == other:",
			"    total = compute(a, b) + \\",
			"        extra",
			"    done = True",
		].join("\n");
		const result = align(source);
		expect(result.tables    ).toBe(0     ) ;
		expect(result.misaligned).toBe(0     ) ;
		expect(result.output    ).toBe(source) ;
	});

	test("bundle rows align inner cell columns, and rows with different bracket pairs split tables", () => {
		const source = [
			"GRID = [",
			`    ["alpha", 1,   "x"],`,
			`    ["b",     22,  "yy"],`,
			`    ["ccc",   333, "zzz"],`,
			`    ("delta", 4, "w"),`,
			"]",
		].join("\n");
		const result = align(source);
		const lines = result.output.split("\n");
		expect(lines[1]).toBe(`    ["alpha", 1  , "x"  ],`) ;
		expect(lines[2]).toBe(`    ["b"    , 22 , "yy" ],`) ;
		expect(lines[3]).toBe(`    ["ccc"  , 333, "zzz"],`) ;
		// `[` rows and `(` rows have different axis sequences and never share a table — a lone tuple row stays as is.
		expect(lines[4]).toBe(`    ("delta", 4, "w"),`);
		expect(result.tables).toBe(1);
	});

	test("the profile refuses bundle rows with nesting, indexing, assignment, empty cells or f-strings", () => {
		const maskedOf = (code: string): string => maskSource(code, PYTHON_ALIGNER.syntax).text;
		for (const code of [
			`["a", ["b", "c"]],`, // nested bundle
			"[rows[0], total],",  // indexing/slicing
			"[alpha, beta = 1],", // inner assignment
			"[solo],",            // single cell
			"[alpha, ],",         // trailing empty cell
			"[alpha,, beta],",    // empty cell from double comma
			`[f"alpha", 1],`,     // f-string prefixed cell
			"[alpha, beta),",     // mismatched bracket pair
			"{alpha, 1},",        // brace bundles are not Python table rows
		]) {
			expect(PYTHON_ALIGNER.profile(code, maskedOf(code))).toBeNull();
		}
	});

	test("keeps == comparisons inside values and refuses values starting with ==", () => {
		const comparable = align([
			"flag = a == b",
			"other = b == c",
			"third = c == d",
		].join("\n"));
		expect(comparable.output.split("\n")[0]).toBe("flag  = a == b");
		expect(comparable.misaligned).toBe(1);

		const bareComparison = align([
			"alpha = 1",
			"beta = 22",
			"gamma = 333",
			"flag == other",
		].join("\n"));
		expect(bareComparison.tables               ).toBe(1              ) ;
		expect(bareComparison.misaligned           ).toBe(1              ) ;
		expect(bareComparison.output.split("\n")[0]).toBe("alpha = 1"    ) ;
		expect(bareComparison.output.split("\n")[3]).toBe("flag == other") ;
	});
});
