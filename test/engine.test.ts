import      { describe, expect, test   } from "bun:test"                 ;
import      { maskSource               } from "@/common/code-text.ts"    ;
import type { CodeSyntax               } from "@/common/code-text.ts"    ;
import      { alignSource              } from "@/common/table-engine.ts" ;
import type { LineProfiler, RowProfile } from "@/common/table-engine.ts" ;

const SYNTAX: CodeSyntax = {
	lineComments  : ["//"]                                    ,
	blockComments : [{ open: "/*", close: "*/" }]             ,
	strings       : [{ open: '"', close: '"', escape: true }] ,
	cppRaw        : false                                     ,
};

/** Minimal profiler accepting only `name : value ;` — structure from the mask, text sliced from the source. */
const TEST_ALIGNER: LineProfiler = {
	language      : "test"                                     ,
	syntax        : SYNTAX                                     ,
	columnAxes    : ["name", "value"]                          ,
	canonicalGaps : { colon: " ", value: " ", semicolon: " " } ,
	profile(code: string, masked: string): RowProfile | null {
		const match   = /^([ \t]*)([A-Za-z_][A-Za-z0-9_]*)(\s*):(\s*)(.+?)(\s*);$/du.exec(masked) ;
		const indices = match?.indices                                                            ;
		if (!match || !indices) return null;
		const at = (group: number): string => {
			const range = indices[group];
			return range ? code.slice(range[0], range[1]) : "";
		};
		return {
			indent : at(1),
			slots  : [
				{ axis : "name"      , text : at(2) , gapBefore : ""    },
				{ axis : "colon"     , text : ":"   , gapBefore : at(3) },
				{ axis : "value"     , text : at(5) , gapBefore : at(4) },
				{ axis : "semicolon" , text : ";"   , gapBefore : at(6) },
			],
		};
	},
};

describe("maskSource", () => {
	test("preserves geometry and masks only string contents", () => {
		const source = `let a = "x:y=z;"; // tail: 1\nlet b = 2;` ;
		const mask   = maskSource(source, SYNTAX)                 ;
		expect(mask.text.length  ).toBe   (source.length                             ) ;
		expect(mask.text         ).toBe   (`let a = "      "; // tail: 1\nlet b = 2;`) ;
		expect(mask.commentStarts).toEqual([18, -1]                                  ) ;
	});

	test("marks lines inside block comments with opensInBlock", () => {
		const source = `a : 1 ;\n/* begin\n   span */\nb : 2 ;` ;
		const mask   = maskSource(source, SYNTAX)               ;
		expect(mask.opensInBlock).toEqual([false, false, true, false]);
		expect(mask.text.split("\n")[2]).toBe("          ");
	});

	test("quotes inside comments do not open strings", () => {
		const source = `a : 1 ; // don't "open\nb : 2 ;` ;
		const mask   = maskSource(source, SYNTAX)        ;
		expect(mask.commentStarts[0]).toBe(8);
		expect(mask.text.split("\n")[1]).toBe("b : 2 ;");
	});

	test("does not mistake the Rust lifetime 'a for a string", () => {
		const rust: CodeSyntax = { lineComments: ["//"], blockComments: [], strings: [{ open: '"', close: '"', escape: true }], rustChars: true, cppRaw: false } ;
		const source           = `let s: &'a str = "v";`                                                                                                         ;
		const mask             = maskSource(source, rust)                                                                                                        ;
		expect(mask.text).toBe(`let s: &'a str = " ";`);
	});

	test("masks the whole C++ raw string R\"( )\"", () => {
		const cpp: CodeSyntax = { lineComments: ["//"], blockComments: [{ open: "/*", close: "*/" }], strings: [{ open: '"', close: '"', escape: true }], cppRaw: true } ;
		const source          = `const char* p = R"x(a:b=c;)x";`                                                                                                         ;
		const mask            = maskSource(source, cpp)                                                                                                                  ;
		expect(mask.text).toBe(`const char* p = R"x(      )x";`);
	});
});

describe("alignSource", () => {
	const SOURCE = [
		"short : 1 ;",
		"longername : 22 ;",
		"m : 333 ;",
		"",
		"breaks : region ;",
		"a : 1 ;",
		"b : 2 ;",
		"// separate section comment",
		"xx : 1 ;",
		"yy : 2 ;",
	].join("\n");

	test("aligns columns at the minimum width of the actual longest cell", () => {
		const result      = alignSource        (SOURCE, TEST_ALIGNER, { minRows: 3, apply: true }) ;
		const outputLines = result.output.split("\n"                                             ) ;
		expect(outputLines[0]   ).toBe("short      : 1   ;") ;
		expect(outputLines[1]   ).toBe("longername : 22  ;") ;
		expect(outputLines[2]   ).toBe("m          : 333 ;") ;
		expect(result.tables    ).toBe(2                   ) ;
		expect(result.misaligned).toBe(5                   ) ;
	});

	test("blank lines and comments break sections — a later section never shares an earlier section's width", () => {
		const result      = alignSource        (SOURCE, TEST_ALIGNER, { minRows: 3, apply: true }) ;
		const outputLines = result.output.split("\n"                                             ) ;
		expect(outputLines[4]                              ).toBe   ("breaks : region ;") ;
		expect(outputLines[5]                              ).toBe   ("a      : 1      ;") ;
		expect(result.details.map(table => table.startLine)).toEqual([1, 5]             ) ;
	});

	test("a 2-row run is reported as a pair and not aligned", () => {
		const result = alignSource(SOURCE, TEST_ALIGNER, { minRows: 3, apply: true });
		expect(result.pairs).toEqual([{ startLine: 9, endLine: 10, rows: 2, signature: "|name>colon>value>semicolon" }]);
		expect(result.output.split("\n")[8]).toBe("xx : 1 ;");
	});

	test("minRows below 3 is raised to 3: a 2-row run stays unaligned even when asked", () => {
		const result = alignSource(SOURCE, TEST_ALIGNER, { minRows: 2, apply: true });
		expect(result.pairs.map(pair => pair.rows)).toEqual([2]);
		expect(result.output.split("\n")[8]).toBe("xx : 1 ;");
	});

	test("alignment preserves content and is idempotent", () => {
		const once = alignSource(SOURCE, TEST_ALIGNER, { minRows: 3, apply: true });
		expect(once.output.replace(/\s+/gu, "")).toBe(SOURCE.replace(/\s+/gu, ""));
		const twice = alignSource(once.output, TEST_ALIGNER, { minRows: 3, apply: true });
		expect(twice.output).toBe(once.output);
		expect(twice.misaligned).toBe(0);
	});

	test("separators inside strings are not mistaken for tables", () => {
		const source      = `name : "a:b=c;" ;\nother : 2 ;\nthird : 3 ;`                  ;
		const result      = alignSource(source, TEST_ALIGNER, { minRows: 3, apply: true }) ;
		const outputLines = result.output.split("\n")                                      ;
		expect(outputLines[0]).toBe(`name  : "a:b=c;" ;`);
		expect(outputLines[1]).toBe(`other : 2        ;`);
	});

	test("trailing comments align into one column within a table", () => {
		const source      = `alpha : 1 ; // first\nbeta : 22 ; // second\ngamma : 333 ;`   ;
		const result      = alignSource(source, TEST_ALIGNER, { minRows: 3, apply: true }) ;
		const outputLines = result.output.split("\n")                                      ;
		expect(outputLines[0]).toBe("alpha : 1   ; // first" ) ;
		expect(outputLines[1]).toBe("beta  : 22  ; // second") ;
		expect(outputLines[2]).toBe("gamma : 333 ;"          ) ;
	});

	test("refuses profile rows that fail lossless decomposition", () => {
		const lossy: LineProfiler = {
			...TEST_ALIGNER,
			profile(code: string, masked: string): RowProfile | null {
				const base = TEST_ALIGNER.profile(code, masked);
				if (!base) return null;
				// If the profiler reports a gap different from the source, the engine must refuse.
				return { ...base, slots: base.slots.map(slot => slot.axis === "colon" ? { ...slot, gapBefore: "" } : slot) };
			},
		};
		const result = alignSource("a : 1 ;\nb : 2 ;\nc : 3 ;", lossy, { minRows: 3, apply: true });
		expect(result.misaligned).toBe(0);
		expect(result.tables).toBe(0);
	});

	test("apply=false only reports and returns the original", () => {
		const result = alignSource("a : 1 ;\nb : 22 ;\nc : 333 ;", TEST_ALIGNER, { minRows: 3, apply: false });
		expect(result.output    ).toBe("a : 1 ;\nb : 22 ;\nc : 333 ;") ;
		expect(result.misaligned).toBe(2                             ) ;
		expect(result.edits     ).toBe(0                             ) ;
	});
});
