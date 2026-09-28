import      { describe, expect, test } from "bun:test"                                     ;
import      { alignSource            } from "../skills/xxx/scripts/common/table-engine.ts" ;
import      { maskSource             } from "../skills/xxx/scripts/common/code-text.ts"    ;
import      { SWIFT_ALIGNER          } from "../skills/xxx/scripts/swift/profile.ts"       ;
import      { defineLanguageSuite    } from "./lang-harness.ts"                            ;

defineLanguageSuite({
	aligner     : SWIFT_ALIGNER,
	fixturesDir : new URL("../skills/xxx/fixtures/swift/", import.meta.url).pathname,
	tableFile   : "tables.swift",
	alignedFile : "tables.aligned.swift",
	trickyFile  : "tricky.swift",
});

describe("swift profile specific properties", () => {
	const align = (source: string): ReturnType<typeof alignSource> => alignSource(source, SWIFT_ALIGNER, { minRows: 3, apply: true });

	test("let rows with and without types form separate tables and align keyword, name, type and value", () => {
		const source = [
			"let limit: Int = 30",
			`let label: String = "cache"`,
			"let enabled: Bool = true",
		].join("\n")                                                             ;
		const lines = align(source).output.split("\n")                           ;
		expect(lines[0]).toBe("let limit  : Int    = 30"     ) ;
		expect(lines[1]).toBe(`let label  : String = "cache"`) ;
		expect(lines[2]).toBe("let enabled: Bool   = true"   ) ;
	});

	test("nested block comments hide look-alike rows even across inner opens", () => {
		const source = [
			"let a1 = 1",
			"/* outer /* inner */ let faked = 2 */",
			"let b22 = 22",
			"let c333 = 333",
			"let d4444 = 4444",
		].join("\n")                                                             ;
		const result = align(source)                                             ;
		expect(result.tables   ).toBe(1)                                         ; // only the three real rows after the comment
		expect(result.output.split("\n")).toEqual([
			"let a1 = 1",
			"/* outer /* inner */ let faked = 2 */",
			"let b22   = 22",
			"let c333  = 333",
			"let d4444 = 4444",
		])                                                                       ;
	});

	test("raw strings and interpolation are masked, so their punctuation is invisible", () => {
		const code   = `let label = #"raw \(value) #tag"#`       ;
		const masked = maskSource(code, SWIFT_ALIGNER.syntax)    ;
		const row    = SWIFT_ALIGNER.profile(code, masked.text)! ;
		expect(row).not.toBeNull()                                               ;
		expect(row.slots.map(slot => slot.axis).join("|")).toBe("keyword|name|equal|value")  ;
		expect(row.slots[3]!.text).toBe(`#"raw \(value) #tag"#`)                 ;
	});

	test("declaration and control-flow rows are refused", () => {
		const maskedOf = (code: string): string => maskSource(code, SWIFT_ALIGNER.syntax).text    ;
		for (const code of [
			"func render(_ values: [String: Any]) -> String {",
			"if value == 3 {",
			"let shape = make(shape)",
			"let list = [1, 2, 3]",
		])                                                                                       {
			expect(SWIFT_ALIGNER.profile(code, maskedOf(code))).toBeNull()                       ;
		}
	});
});
