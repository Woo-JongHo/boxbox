import      { describe, expect, test                  } from "bun:test"                 ;
import      { alignSource                             } from "@/common/table-engine.ts" ;
import      { PYTHON_ALIGNER                          } from "@/python/profile.ts"      ;
import      { indentDepth, normalizeAxis, signatureOf } from "@/common/signature.ts"    ;

describe("pattern signature", () => {
	test("axis ids lose their column, fold digit runs and generalize callees", () => {
		expect(normalizeAxis("equals=17"          )).toBe("equals"              ) ;
		expect(normalizeAxis("call-comma3=41"     )).toBe("call-comma{i}"       ) ;
		expect(normalizeAxis("list-arg2-comma1=30")).toBe("list-arg{i}-comma{i}") ;
		expect(normalizeAxis("property4=101"      )).toBe("property{i}"         ) ;
		expect(normalizeAxis("call:frozenset"     )).toBe("call:*"              ) ;
		expect(normalizeAxis("case-colon"         )).toBe("case-colon"          ) ;
	});

	test("the identity key is language, context, kind, ordered axes and depth — never the result state", () => {
		expect(signatureOf("typescript", "SourceFile", "declaration-equals", ["equals=17", "semicolon=64"], 0))
			.toBe("typescript|SourceFile|declaration-equals|equals>semicolon|d0") ;
		expect(signatureOf("python", "", "table", ["name", "equal", "call:set", "open(", "close)"], 1))
			.toBe("python||table|name>equal>call:*>open(>close)|d1") ;
	});

	test("a table keeps its key before and after it is aligned", () => {
		const key = (source: string): readonly string[] =>
			alignSource(source, PYTHON_ALIGNER, { minRows: 3, apply: false }).details.map(table =>
				signatureOf("python", "", "table", table.axes, indentDepth(table.indent))) ;
		const loose   = ["ALPHA = first(1, 22)", "BETA = first(2, 33)", "GAMMA = first(3, 44)"].join("\n") ;
		const aligned = alignSource(loose, PYTHON_ALIGNER, { minRows: 3, apply: true }).output             ;
		expect(aligned     ).not.toBe        (loose        ) ;
		expect(key(aligned))    .toEqual     (key(loose)   ) ;
		expect(key(loose)  )    .toHaveLength(1            ) ;
	});

	test("depth counts four columns per level and a tab as four columns", () => {
		expect(indentDepth(""        )).toBe(0) ;
		expect(indentDepth("\t"      )).toBe(1) ;
		expect(indentDepth("        ")).toBe(2) ;
	});

	test("two python assignment tables of the same shape collapse into one type, depth apart", () => {
		const align = (source: string): readonly string[] =>
			alignSource(source, PYTHON_ALIGNER, { minRows: 3, apply: false }).details.map(table =>
				signatureOf("python", "", "table", table.axes, indentDepth(table.indent))) ;
		const flat = [
			"ALPHA = first(1, 22)",
			"BETA  = first(2, 33)",
			"GAMMA = first(3, 44)",
		].join("\n")                                                                                              ;
		const nested = [
			"def run():",
			"\tALPHA = first(1, 22)",
			"\tBETA  = first(2, 33)",
			"\tGAMMA = first(3, 44)",
		].join("\n")                                                                                              ;
		expect(align(flat).length  ).toBe     (1                                         ) ;
		expect(align(nested).length).toBe     (1                                         ) ;
		expect(align(flat)[0]      ).toBe     (align(nested)[0].replace(/\|d1$/u, "|d0") ) ;
		expect(align(nested)[0]    ).toMatch  (/\|d1$/u                                  ) ;
	});

	test("different callees and arities are different types even when the row text looks alike", () => {
		const align = (source: string): readonly string[] =>
			alignSource(source, PYTHON_ALIGNER, { minRows: 3, apply: false }).details.map(table =>
				signatureOf("python", "", "table", table.axes, 0)) ;
		const callees = [
			"ALPHA = first(1, 22)",
			"BETA  = second(2, 33)",
			"GAMMA = third(3, 44)",
		].join("\n") ;
		const arities = [
			"ALPHA = first(1, 22)",
			"BETA  = first(2, 33)",
			"GAMMA = first(3, 44)",
			"DELTA = first(4, 66, 77)",
			"EPSI  = first(5, 88, 99)",
			"ZETA  = first(6, 12, 23)",
		].join("\n") ;
		expect(align(callees).length).toBe(0) ; // rows calling a different callee never group, so nothing is detected
		expect(new Set(align(arities)).size).toBe(2) ; // the arity-2 and arity-3 tables are two types
	});
});
