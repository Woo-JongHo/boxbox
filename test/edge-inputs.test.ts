import      { describe, expect, test } from "bun:test"                                     ;
import      { alignSource            } from "../skills/xxx/scripts/common/table-engine.ts" ;
import      { PYTHON_ALIGNER         } from "../skills/xxx/scripts/python/profile.ts"      ;

const align = (source: string): ReturnType<typeof alignSource> => alignSource(source, PYTHON_ALIGNER, { minRows: 3, apply: true });

describe("edge inputs", () => {
	test("CRLF python files align and keep their line endings", () => {
		const source = "DEFAULT = 3\r\nLONG_TIMEOUT = 90\r\nDEBUG = False\r\n" ;
		const result = align(source)                                           ;
		expect(result.misaligned).toBe(2)                                                 ; // LONG_TIMEOUT is already the widest name
		expect(result.output.split("\n")).toEqual([
			"DEFAULT      = 3\r",
			"LONG_TIMEOUT = 90\r",
			"DEBUG        = False\r",
			"",
		])                                                                                ;
	});

	test("CRLF dict rows are no longer refused by the trailing \r", () => {
		const source = "defaults = {\r\n    \"host\": \"localhost:8080\",\r\n    \"port\": 8080,\r\n    \"debug\": True,\r\n}\r\n" ;
		const result = align(source)                                                                                               ;
		expect(result.tables ).toBe     (1                                 ) ;
		expect(result.refused).toEqual  ([]                                ) ;
		expect(result.output ).toContain("\"host\" : \"localhost:8080\",\r") ;
	});

	test("a BOM is preserved and only the first line is excluded", () => {
		const source = "\uFEFFDEFAULT = 3\nLONG_TIMEOUT = 90\nDEBUG = False\n" ;
		const result = align(source)                                           ;
		expect(result.output.startsWith("\uFEFFDEFAULT = 3\n")).toBe(true)                ; // BOM + refused first row stay untouched
		expect(result.output.split("\n").slice(1, 3)).toEqual(["LONG_TIMEOUT = 90", "DEBUG = False"]) ;
	});

	test("a multi-thousand-line file aligns within the time budget", () => {
		const rows: string[] = []                                                         ;
		for (let index = 0; index < 3000; index += 1) rows.push(`setting${index} = ${index}`) ;
		const source  = rows.join("\n") + "\n" ;
		const started = Date.now()             ;
		const result  = align(source)          ;
		const elapsed = Date.now() - started   ;
		expect(result.tables   ).toBe(1)                                                  ;
		// rows whose name is already the widest (setting1000…setting2999) need no edit
		expect(result.misaligned).toBe(1000)                                              ;
		expect(elapsed           ).toBeLessThan(30_000)                                   ;
	});
});
