import      { describe, expect, test     } from "bun:test"                                     ;
import      { alignSource                } from "../skills/xxx/scripts/common/table-engine.ts" ;
import      { PYTHON_ALIGNER             } from "../skills/xxx/scripts/python/profile.ts"      ;
import      { normalizeAxis, signatureOf } from "../scripts/corpus-signatures.ts"              ;

describe("corpus signature typing", () => {
	test("axis ids lose their column, fold digit runs and generalize callees", () => {
		expect(normalizeAxis("equals=17"          )).toBe("equals"              ) ;
		expect(normalizeAxis("call-comma3=41"     )).toBe("call-comma{i}"       ) ;
		expect(normalizeAxis("list-arg2-comma1=30")).toBe("list-arg{i}-comma{i}") ;
		expect(normalizeAxis("property4=101"      )).toBe("property{i}"         ) ;
		expect(normalizeAxis("call:frozenset"     )).toBe("call:*"              ) ;
		expect(normalizeAxis("case-colon"         )).toBe("case-colon"          ) ;
	});

	test("the signature tuple is language, context, kind, ordered axes, depth and state", () => {
		expect(signatureOf("typescript", "SourceFile", "declaration-equals", ["equals=17", "semicolon=64"], 0, "FIXABLE"))
			.toBe("typescript|SourceFile|declaration-equals|equals>semicolon|d0|FIXABLE") ;
		expect(signatureOf("python", "", "table", ["name", "equal", "call:set", "open(", "close)"], 1, "PASS"))
			.toBe("python||table|name>equal>call:*>open(>close)|d1|PASS") ;
	});

	test("two python assignment tables of the same shape collapse into one type, depth apart", () => {
		const align = (source: string): readonly string[] =>
			alignSource(source, PYTHON_ALIGNER, { minRows: 3, apply: false }).details.map(table =>
				signatureOf("python", "", "table", table.axes, Math.floor(table.indent.replaceAll("\t", "    ").length / 4), table.edits.length > 0 ? "FIXABLE" : "PASS")) ;
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
		expect(align(flat).length  ).toBe     (1                                       ) ;
		expect(align(nested).length).toBe     (1                                       ) ;
		expect(align(flat)[0]      ).toBe     (align(nested)[0].replace("|d1|", "|d0|")) ;
		expect(align(nested)[0]    ).toContain("|d1|"                                  ) ;
	});

	test("different callees and arities are different types even when the row text looks alike", () => {
		const align = (source: string): readonly string[] =>
			alignSource(source, PYTHON_ALIGNER, { minRows: 3, apply: false }).details.map(table =>
				signatureOf("python", "", "table", table.axes, 0, table.edits.length > 0 ? "FIXABLE" : "PASS")) ;
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
