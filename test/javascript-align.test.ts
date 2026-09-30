import      { describe, expect, test                } from "bun:test"                 ;
import      { maskSource                            } from "@/common/code-text.ts"    ;
import      { alignSource                           } from "@/common/table-engine.ts" ;
import      { defineLanguageSuite                   } from "./lang-harness.ts"        ;
import      { JAVASCRIPT_ALIGNER, JAVASCRIPT_SYNTAX } from "@/javascript/profile.ts"  ;

defineLanguageSuite({
	aligner     : JAVASCRIPT_ALIGNER,
	fixturesDir : new URL("../skills/xxx/fixtures/javascript/", import.meta.url).pathname,
	tableFile   : "tables.js",
	alignedFile : "tables.aligned.js",
	trickyFile  : "tricky.js",
});

describe("javascript profile specific properties", () => {
	const align = (source: string): ReturnType<typeof alignSource> => alignSource(source, JAVASCRIPT_ALIGNER, { minRows: 3, apply: true });

	test("object-literal rows and const assignment rows keep separate tables and widths even when adjacent", () => {
		const source = [
			"const a = 1;",
			"const bb = 22;",
			"const ccc = 333;",
			"key: value,",
			"longerKey: 2,",
			"mid: 3,",
		].join("\n");
		const result = align(source);
		expect(result.tables            ).toBe   (2                                                 ) ;
		expect(result.details[0]?.axes  ).toEqual(["keyword", "name", "equal", "value", "semicolon"]) ;
		expect(result.details[0]?.widths).toEqual([5, 3, 1, 3, 1]                                   ) ;
		expect(result.details[1]?.axes  ).toEqual(["key", "colon", "value", "comma"]                ) ;
		expect(result.details[1]?.widths).toEqual([9, 1, 5, 1]                                      ) ;
		const lines = result.output.split("\n");
		expect(lines[0]).toBe("const a   = 1   ;");
		expect(lines[3]).toBe("key      : value,");
	});

	test("does not mistake : = ; inside strings for structure and keeps the value cell intact", () => {
		const source = [
			'mid: "a:b=c;d",',
			'wideKey: "e=f",',
			"tiny: 1,",
		].join("\n");
		const result = align(source)             ;
		const lines  = result.output.split("\n") ;
		expect(lines[0]).toBe('mid    : "a:b=c;d",') ;
		expect(lines[1]).toBe('wideKey: "e=f"    ,') ;
		expect(lines[2]).toBe("tiny   : 1        ,") ;
	});

	test("arrow functions, comparisons, control flow, multiple declarations and uncertain rows are not table rows", () => {
		const rejected = [
			"const f = () => 1;",
			"total <= limit;",
			"if (ready) state = 1;",
			"for (const item of items) use(item);",
			"const partial = mix(one,",
			"const both = 1, other = 2;",
			"case kind:",
			"key: value",
		];
		for (const line of rejected) {
			// These rows contain no strings, so the mask equals the source — structure and text coordinates match.
			expect(JAVASCRIPT_ALIGNER.profile(line, line)).toBeNull();
		}
	});

	test("cuts template literals and quoted keys as single cells", () => {
		const template = "tiny: `sum:${1 + 2} = 3`," ;
		const quoted   = '"open:key": v,'            ;
		for (const [line, axis, expected] of [
			[template, "value", "`sum:${1 + 2} = 3`"],
			[quoted, "key", '"open:key"'],
		] as const) {
			const mask    = maskSource(line, JAVASCRIPT_SYNTAX)      ;
			const masked  = mask.text.split("\n")[0] ?? ""           ;
			const profile = JAVASCRIPT_ALIGNER.profile(line, masked) ;
			expect(profile?.slots.find(slot => slot.axis === axis)?.text).toBe(expected);
		}
	});

	test("bundle rows attach the first cell to the opening bracket and align cell and closing-bracket columns at minimum width", () => {
		const source = [
			"const table = [",
			'  ["alpha", 1, "x"],',
			'  ["b", 22, "yy"],',
			'  ["ccc", 333, "z"],',
			"];",
		].join("\n");
		const result = align(source);
		expect(result.tables            ).toBe   (1                                                        ) ;
		expect(result.details[0]?.axes  ).toEqual(["open", "cell", "comma", "arg", "comma", "arg", "close"]) ;
		expect(result.details[0]?.widths).toEqual([1, 7, 1, 3, 1, 4, 2]                                    ) ;
		const lines = result.output.split("\n");
		expect(lines[1]).toBe('  ["alpha", 1  , "x" ],') ;
		expect(lines[2]).toBe('  ["b"    , 22 , "yy"],') ;
		expect(lines[3]).toBe('  ["ccc"  , 333, "z" ],') ;
	});

	test("bundle rows with nesting, assignment or calls, and single-cell or empty-cell rows are not table rows", () => {
		const rejected = [
			"[[a, b], [c, d]],",
			"[a, [b, c]],",
			"[x = 1, y],",
			"[f(x), y],",
			"[{ a: 1 }, y],",
			"[only],",
			"[a, , b],",
			"[a, b,],",
			"[a, b] = pair,",
			"[pos, /re, x/],",
		];
		for (const line of rejected) {
			// These rows contain no strings, so the mask equals the source — structure and text coordinates match.
			expect(JAVASCRIPT_ALIGNER.profile(line, line)).toBeNull();
		}
	});
});
