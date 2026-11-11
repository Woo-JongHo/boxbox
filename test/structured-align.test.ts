import      { describe, expect, test  } from "bun:test"                 ;
import      { readFileSync            } from "node:fs"                  ;

import      {
              analyzeStructured     ,
              preservesStructured   ,
              structuredDiagnostics ,
                                      } from "@/structured/00_index.ts" ;

const fixture = (name: string): string => readFileSync(new URL(`fixtures/${name}`, import.meta.url), "utf8");

describe("structured alignment", () => {
	test.each(["json", "yaml"] as const)("aligns %s fixtures exactly and idempotently", language => {
		const before   = fixture          (`${language}/tables.${language === "json" ? "json" : "yaml"}`        ) ;
		const expected = fixture          (`${language}/tables.aligned.${language === "json" ? "json" : "yaml"}`) ;
		const analyzed = analyzeStructured(before, language, `tables.${language}`                               ) ;
		expect(analyzed.output                                       ).toBe   (expected                                                                                               ) ;
		expect(analyzed.result.groups                                ).toEqual([expect.objectContaining({ kind: "mapping", rows: 3, axes: ["key-colon", "value"], state: "FIXABLE" })]) ;
		expect(analyzeStructured(analyzed.output, language).output   ).toBe   (analyzed.output                                                                                        ) ;
		expect(preservesStructured(before, analyzed.output, language)).toBe   (true                                                                                                   ) ;
	});

	test("keeps an existing YAML `key : value` house style and reports its own axes", () => {
		const aligned  = "schema_version  : 1\nkind            : config\ndefault_profile : operation\n"                      ;
		const ragged   = "schema_version : 1\nkind : config\ndefault_profile : operation\nadded: x\n"                        ;
		const expected = "schema_version  : 1\nkind            : config\ndefault_profile : operation\nadded           : x\n" ;
		const fixed    = analyzeStructured(ragged, "yaml")                                                                   ;

		expect(analyzeStructured(aligned, "yaml").result.groups ).toEqual([expect.objectContaining({ axes: ["key", "colon", "value"], state: "PASS" })]) ;
		expect(fixed.output                                     ).toBe   (expected                                                                     ) ;
		expect(analyzeStructured(fixed.output, "yaml").output   ).toBe   (fixed.output                                                                 ) ;
		expect(preservesStructured(ragged, fixed.output, "yaml")).toBe   (true                                                                         ) ;
	});

	test("aligns trailing YAML comments around the median and leaves outliers attached", () => {
		const source = [
			"col_code: 2 # code column",
			"alert_timeout: 3.0 # alert wait",
			"last_column: O",
			"tie_tolerance: 1.0e-09 # tie",
			"code_pattern: '^[A-Z]{2}[0-9]{12}(?:abcdefghijklmnopqrstuvwxyz)+' # long",
			"usd_pattern: '^[0-9]{1,3}(?:,[0-9]{3})*(?:[.][0-9]+)?(?:abcdefgh)+' # long too",
		].join("\n");
		const expected = [
			"col_code     : 2       # code column",
			"alert_timeout: 3.0     # alert wait",
			"last_column  : O",
			"tie_tolerance: 1.0e-09 # tie",
			"code_pattern : '^[A-Z]{2}[0-9]{12}(?:abcdefghijklmnopqrstuvwxyz)+' # long",
			"usd_pattern  : '^[0-9]{1,3}(?:,[0-9]{3})*(?:[.][0-9]+)?(?:abcdefgh)+' # long too",
		].join("\n");
		const analyzed = analyzeStructured(source, "yaml");

		expect(analyzed.output                                     ).toBe   (expected                                                              ) ;
		expect(analyzed.result.groups                              ).toEqual([expect.objectContaining({ axes: ["key-colon", "value", "comment"] })]) ;
		expect(analyzeStructured(analyzed.output, "yaml").output   ).toBe   (analyzed.output                                                       ) ;
		expect(preservesStructured(source, analyzed.output, "yaml")).toBe   (true                                                                  ) ;
	});

	test("comment columns after wide values follow the wide-character policy", () => {
		const source = [
			"origin_file: 기초자료.xlsx # origin", // cjk-test-data
			"sheet: items # sheet",
			"limit: 3 # limit",
		].join("\n");
		const refused = [
			"origin_file: 기초자료.xlsx # origin", // cjk-test-data
			"sheet      : items # sheet",
			"limit      : 3 # limit",
		].join("\n");
		const aligned = [
			"origin_file: 기초자료.xlsx # origin", // cjk-test-data
			"sheet      : items         # sheet",
			"limit      : 3             # limit",
		].join("\n");
		const east = analyzeStructured(source, "yaml", "input", { wideCharacters: "east-asian-width" });

		expect(analyzeStructured(source, "yaml").output                                                      ).toBe(refused    ) ;
		expect(east.output                                                                                   ).toBe(aligned    ) ;
		expect(analyzeStructured(east.output, "yaml", "input", { wideCharacters: "east-asian-width" }).output).toBe(east.output) ;
	});

	test("block-mapping runs split by a nested collection share the parent's widest key", () => {
		const source   = "alpha: 1\nbeta: 2\ngamma: 3\nnested:\n  - x\nlongest_key: 4\nd: 5\ne: 6\n"                                        ;
		const expected = "alpha      : 1\nbeta       : 2\ngamma      : 3\nnested:\n  - x\nlongest_key: 4\nd          : 5\ne          : 6\n" ;

		expect(analyzeStructured(source, "yaml").output).toBe(expected) ;
	});

	test("preserves JSON escapes, colons in strings, duplicate keys, CRLF, and nested ownership", () => {
		const source = "{\r\n  \"outer\": {\r\n    \"a\":\"x:y\",\r\n    \"long\\\"key\" : 2,\r\n    \"a\"  :3\r\n  },\r\n  \"a\":1,\r\n  \"bb\":2,\r\n  \"ccc\":3\r\n}\r\n";
		const { output, result } = analyzeStructured(source, "json");
		expect(result.groups                )    .toHaveLength(2                            ) ;
		expect(output                       )    .toContain   ('    "a"        : "x:y",\r\n') ;
		expect(output                       )    .toContain   ('  "a"  : 1,\r\n'            ) ;
		expect(output.replaceAll("\r\n", "")).not.toContain   ("\n"                         ) ;
	});

	test("comments and unsupported YAML constructs break groups without changing their bytes", () => {
		const source = "a: 1\nbb: 2\nccc: 3\n# boundary\nd: 4\nee: 5\nfff: 6\nblock: |\n  keep:  exact\nanchor: &id value\nalias: *id\nflow: { a: 1 }\n\"quoted\": value\n";
		const { output, refusals, result } = analyzeStructured(source, "yaml");
		expect(result.groups                               ).toHaveLength(2                           ) ;
		expect(output                                      ).toContain   ("# boundary\n"              ) ;
		expect(output                                      ).toContain   ("block: |\n  keep:  exact\n") ;
		expect(refusals.map(item => item.reason).join("\n")).toContain   ("block scalars"             ) ;
		expect(refusals.map(item => item.reason).join("\n")).toContain   ("anchors, aliases, and tags") ;
		expect(refusals.map(item => item.reason).join("\n")).toContain   ("plain-scalar YAML keys"    ) ;
		expect(structuredDiagnostics(source, "yaml")       ).toEqual     ([]                          ) ;
	});

	test("uses YAML scalar ranges and preserves quoted punctuation and comments", () => {
		const source   = "short: \"*& text\"  # keep  exact\nlonger: 'a: b'\nthird: plain\nmulti: \"first\n  second\"\nplainmulti: first\n  second\nfolded: >-2\n    keep\nliteral: |2\n    exact\n" ;
		const analyzed = analyzeStructured(source, "yaml")                                                                                                                                           ;
		expect(analyzed.result.groups                                                 ).toHaveLength(1                                                                             ) ;
		expect(analyzed.output                                                        ).toContain   ('short : \"*& text\"  # keep  exact\n'                                        ) ;
		expect(analyzed.output                                                        ).toContain   ('multi: \"first\n  second\"\n'                                                ) ;
		expect(analyzed.output                                                        ).toContain   ("plainmulti: first\n  second\nfolded: >-2\n    keep\nliteral: |2\n    exact\n") ;
		expect(analyzed.refusals.filter(item => item.reason.includes("single-line"))  ).toHaveLength(2                                                                             ) ;
		expect(analyzed.refusals.filter(item => item.reason.includes("block scalars"))).toHaveLength(2                                                                             ) ;
		expect(structuredDiagnostics(source, "yaml")                                  ).toEqual     ([]                                                                            ) ;
	});

	test("rejects duplicate YAML keys and non-1.2 directives while preserving JSON duplicates", () => {
		expect(structuredDiagnostics("a: one\na: two\n"        , "yaml")).not.toHaveLength(0                                           ) ;
		expect(structuredDiagnostics("%YAML 1.1\n---\na: yes\n", "yaml"))    .toEqual     (["only the YAML 1.2 directive is supported"]) ;
		expect(structuredDiagnostics('{"a":1,"a":2}'           , "json"))    .toEqual     ([]                                          ) ;
	});

	test("refuses ambiguous tagged, anchored, and multiline YAML flow maps without rewriting", () => {
		for (const source of [
			"a: &x {k: 1}\nbb: 2\nccc: 3\n",
			"a: !!map {k: 1}\nbb: 2\nccc: 3\n",
			"a: {\n  one: 1,\n  two: 2,\n  three: 3\n}\n",
			"a: &x {\n  one: 1,\n  two: 2,\n  three: 3\n}\n",
			"a: !!map {\n  one: 1,\n  two: 2,\n  three: 3\n}\n",
			"{\n  one: 1,\n  two: 2,\n  three: 3\n}\n",
		]) {
			const analyzed = analyzeStructured(source, "yaml");
			expect(analyzed.output       )    .toBe        (source) ;
			expect(analyzed.result.groups)    .toHaveLength(0     ) ;
			expect(analyzed.refusals     ).not.toHaveLength(0     ) ;
		}
	});

	test("rejects unresolved YAML aliases as syntax errors", () => {
		expect(structuredDiagnostics("x: *nope\n", "yaml").join("\n")                         ).toContain("Unresolved alias") ;
		expect(analyzeStructured("x: *nope\n", "yaml").result.summary.refused                 ).toBe     (1                 ) ;
		expect(structuredDiagnostics("copy: *later\nlater: &later value\n", "yaml").join("\n")).toContain("Unresolved alias") ;
	});

	test("accepts existing and cyclic aliases without expanding their graphs", () => {
		for (const source of ["base: &base value\ncopy: *base\n", "cycle: &cycle [*cycle]\n"]) {
			expect(structuredDiagnostics(source, "yaml")).toEqual([]);
			expect(analyzeStructured(source, "yaml").output).toBe(source);
		}
	});

	test("invalid documents are refused and stay byte-identical", () => {
		for (const [language, source] of [["json", '{"a": 1,}'], ["yaml", "a: [\n"]] as const) {
			const analyzed = analyzeStructured(source, language);
			expect(analyzed.output                        )    .toBe        (source) ;
			expect(analyzed.result.summary.refused        )    .toBe        (1     ) ;
			expect(structuredDiagnostics(source, language)).not.toHaveLength(0     ) ;
		}
	});

	test("preservation rejects content, indentation, and unverified whitespace changes", () => {
		const source = "{\n  \"a\": 1,\n  \"bb\": 2,\n  \"ccc\": 3\n}\n";
		expect(preservesStructured(source, source.replace("1", "9")         , "json")).toBe(false) ;
		expect(preservesStructured(source, source.replace('  "a"', '   "a"'), "json")).toBe(false) ;
		expect(preservesStructured(source, source.replace("\n}", " \n}")    , "json")).toBe(false) ;
		const yaml = "a : 1\nbb: 2\nccc: 3\n";
		expect(preservesStructured(yaml, yaml.replace("a :", "a x:"), "yaml")).toBe(false);
		const spaced  = "{\r\n  \"a\": 1,  \r\n  \"bb\": 2,\t\r\n  \"ccc\": 3   \r\n}\r\n" ;
		const aligned = analyzeStructured(spaced, "json").output                           ;
		expect(aligned                                                                ).toContain("1,  \r\n") ;
		expect(aligned                                                                ).toContain("2,\t\r\n") ;
		expect(aligned                                                                ).toContain("3   \r\n") ;
		expect(preservesStructured(spaced, aligned.replace("1,  \r", "1, \r"), "json")).toBe     (false     ) ;
		expect(preservesStructured(spaced, aligned.replaceAll("\r\n", "\n"), "json")  ).toBe     (false     ) ;
	});
});
