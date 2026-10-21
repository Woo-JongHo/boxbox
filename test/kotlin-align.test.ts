import      { describe, expect, test } from "bun:test"                 ;
import      { alignSource            } from "@/common/table-engine.ts" ;
import      { maskSource             } from "@/common/code-text.ts"    ;
import      { KOTLIN_ALIGNER         } from "@/kotlin/profile.ts"      ;
import      { defineLanguageSuite    } from "./lang-harness.ts"        ;

defineLanguageSuite({
	aligner     : KOTLIN_ALIGNER,
	fixturesDir : new URL("../test/fixtures/kotlin/", import.meta.url).pathname,
	tableFile   : "tables.kt",
	alignedFile : "tables.aligned.kt",
	trickyFile  : "tricky.kt",
});

describe("kotlin profile specific properties", () => {
	const align = (source: string): ReturnType<typeof alignSource> => alignSource(source, KOTLIN_ALIGNER, { minRows: 3, apply: true });

	test("val rows with and without types form separate tables and align keyword, name, type and value", () => {
		const source = [
			"val limit: Int = 30",
			`val label: String = "cache"`,
			"val enabled: Bool = true",
		].join("\n")                                                             ;
		const lines = align(source).output.split("\n")                           ;
		expect(lines[0]).toBe("val limit  : Int    = 30"     ) ;
		expect(lines[1]).toBe(`val label  : String = "cache"`) ;
		expect(lines[2]).toBe("val enabled: Bool   = true"   ) ;
	});

	test("nested block comments hide look-alike rows even across inner opens", () => {
		const source = [
			"val a1 = 1",
			"/* outer /* inner */ val faked = 2 */",
			"val b22 = 22",
			"val c333 = 333",
			"val d4444 = 4444",
		].join("\n")                                                             ;
		const result = align(source)                                             ;
		expect(result.tables   ).toBe(1)                                         ; // only the three real rows after the comment
		expect(result.output.split("\n")).toEqual([
			"val a1 = 1",
			"/* outer /* inner */ val faked = 2 */",
			"val b22   = 22",
			"val c333  = 333",
			"val d4444 = 4444",
		]);
	});

	test("string templates are masked, so their dollar punctuation is invisible", () => {
		const code   = `val label = "count: \${value} of \${total}"` ;
		const masked = maskSource(code, KOTLIN_ALIGNER.syntax)       ;
		const row    = KOTLIN_ALIGNER.profile(code, masked.text)!    ;
		expect(row).not.toBeNull();
		expect(row.slots.map(slot => slot.axis).join("|")).toBe("keyword|name|equal|value");
		expect(row.slots[3]!.text).toBe(`"count: \${value} of \${total}"`);
	});

	test("declaration and control-flow rows are refused", () => {
		const maskedOf = (code: string): string => maskSource(code, KOTLIN_ALIGNER.syntax).text;
		for (const code of [
			"fun render(values: Map<String, Any>): String {",
			"if (value == 3) {",
			"val shape = make(shape)",
			"val list = listOf(1, 2, 3)",
		])                                                                                       {
			expect(KOTLIN_ALIGNER.profile(code, maskedOf(code))).toBeNull();
		}
	});
});
