import      { describe, expect, test        } from "bun:test"                    ;
import      { maskSource                    } from "@/common/00_code-text.ts"    ;
import type { CodeSyntax                    } from "@/common/00_code-text.ts"    ;
import      { alignSource                   } from "@/common/06_table-engine.ts" ;
import type { LineProfiler, RowProfile      } from "@/common/06_table-engine.ts" ;
import      { PYTHON_ALIGNER, PYTHON_SYNTAX } from "@/python/03_profile.ts"      ;

const SYNTAX: CodeSyntax = {
	lineComments  : ["//"]                                    ,
	blockComments : [{ open: "/*", close: "*/" }]             ,
	strings       : [{ open: '"', close: '"', escape: true }] ,
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

	test("a string spanning lines keeps every later line's comment position on that line", () => {
		const source = 'x = """a\nb\n"""\n# note\ny = 1 # tail' ;
		const mask   = maskSource(source, PYTHON_SYNTAX)        ;
		expect(mask.commentStarts).toEqual([-1, -1, -1, 0, 6]                ) ;
		expect(mask.opensInBlock ).toEqual([false, false, false, false, false]) ;
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

/** Expand ASCII fixture tabs as a terminal would, independently of the engine width utility. */
function fixtureColumn(line: string, marker: string): number {
	let expanded = line;
	while (expanded.includes("\t")) {
		const index = expanded.indexOf("\t");
		expanded = expanded.slice(0, index) + " ".repeat(4 - index % 4) + expanded.slice(index + 1);
	}
	return expanded.indexOf(marker);
}

describe("tab-bearing lossless cells", () => {
	const cases = [
		{
			name: "middle annotation cells",
			source: "a: X\t| Y = 1\nbb: Z | Y = 2\nccc: X | Y = 3",
			columns: [[":", 4], ["=", 12]],
		},
		{
			name: "first cells after mixed indentation",
			source: '\t "a\tb": 1,\n\t "cc": 22,\n\t "ddd": 333,',
			columns: [[":", 11], [",", 16]],
		},
		{
			name: "last cells before comments",
			source: 'a = "x\ty" # one\nbb = "z" # two\nccc = "w" # three',
			columns: [["=", 4], ["#", 15]],
		},
		{
			name: "prefix rows with optional defaults",
			source: " a: Long\t| Y\n bb: X\t| Y = 2\n ccc: Z | Y = 3",
			columns: [[":", 5], ["=", 16]],
		},
		{
			name: "prefix terminal rows with tab-bearing bodies and comments",
			source: ' a: Z | Y, # one\n bb: X\t| Y = "u\tv", # two\n ccc: Z | Y = "z", # three',
			columns: [[":", 5], ["=", 16], [",", 26], ["#", 28]],
		},
	] as const;

	test.each([...cases])("aligns $name at actual minimum display columns", ({ source, columns }) => {
		const prefix   = source.startsWith('\t') ? "data = {\n" : source.startsWith(' ') ? (source.includes(',') ? "def f(\n" : "class C:\n") : "" ;
		const suffix   = prefix.startsWith("data") ? "\n}" : prefix.startsWith("def") ? "\n):\n pass" : ""                                         ;
		const document = prefix + source + suffix                                                                                                  ;
		const once     = alignSource(document, PYTHON_ALIGNER, { minRows: 3, apply: true })                                                        ;
		const lines    = once.output.split("\n").slice(prefix ? 1 : 0, (prefix ? 1 : 0) + source.split("\n").length)                               ;

		expect(once.tables).toBe(1);
		expect(once.refused).toEqual([]);
		for (const [marker, column] of columns) {
			expect(lines.filter(line => line.includes(marker)).map(line => fixtureColumn(line, marker))).toEqual(
				lines.filter(line => line.includes(marker)).map(() => column),
			);
		}
		for (const [index, line] of source.split("\n").entries()) {
			expect(lines[index]!.match(/^[ \t]*/u)?.[0]).toBe(line.match(/^[ \t]*/u)?.[0]);
			const masked  = maskSource(line, PYTHON_SYNTAX)                                 ;
			const comment = masked.commentStarts[0]!                                        ;
			const code    = (comment >= 0 ? line.slice(0, comment) : line).trimEnd()        ;
			const profile = PYTHON_ALIGNER.profile(code, masked.text.slice(0, code.length)) ;
			for (const slot of profile!.slots) expect(lines[index]).toContain(slot.text);
			if (comment >= 0) expect(lines[index]).toContain(line.slice(comment));
			expect(lines[index]).not.toMatch(/[ \t]+$/u);
		}

		const twice   = alignSource(once.output, PYTHON_ALIGNER, { minRows: 3, apply: true }) ;
		const preview = alignSource(document   , PYTHON_ALIGNER, { minRows: 3, apply: false}) ;

		expect(twice.output    ).toBe   (once.output ) ;
		expect(twice.misaligned).toBe   (0           ) ;
		expect(twice.edits     ).toBe   (0           ) ;
		expect(preview.output  ).toBe   (document    ) ;
		expect(preview.edits   ).toBe   (0           ) ;
		expect(preview.details ).toEqual(once.details) ;
	});
});

describe("Python formatted-string boundaries", () => {
	const nested = 'text = f"""{ """\na = 1\nlonger = 2\nthird = 3\n""" }"""\n' ;
	const table  = "alpha=1\nlonger=2\nthird=3\n"                               ;
	const variants = [
		nested,
		nested.replace('f"""', 'rf"""'),
		nested.replace('f"""', 'Fr"""'),
		nested.replace('{ """', '{ # a quote " stays inside this replacement field\n """'),
		'text = f"{"x"}"\n',
		'text = f"{f"{1}"}"\n',
		'text = f"""{1:{len("ab")}}"""\n',
		'label = "\u{1f600}"; ' + nested,
		nested.replaceAll("\n", "\r\n"),
	];

	test.each(variants)("protects completed formatted strings and resumes normal tables: %j", (prefix) => {
		const source = prefix + table                                                   ;
		const result = alignSource(source, PYTHON_ALIGNER, { minRows: 3, apply: true }) ;
		const mask   = maskSource(source, PYTHON_SYNTAX)                                ;

		expect(result.output.slice(0, prefix.length)                                             ).toBe   (prefix                                ) ;
		expect(result.tables                                                                     ).toBe   (1                                     ) ;
		expect(result.details[0]!.startLine                                                      ).toBe   (prefix.split("\n").length             ) ;
		expect(result.output.slice(prefix.length)                                                ).toBe   ("alpha  = 1\nlonger = 2\nthird  = 3\n") ;
		expect(mask.text.length                                                                  ).toBe   (source.length                         ) ;
		expect(mask.text.match(/\r?\n/gu)                                                        ).toEqual(source.match(/\r?\n/gu)               ) ;
		expect(alignSource(result.output, PYTHON_ALIGNER, { minRows: 3, apply: true }).misaligned).toBe   (0                                     ) ;
	});
});


test("tab-bearing cells retain minimum columns after a long prefix without a full-width synthetic prefix", () => {
	const source = `${"a".repeat(50_000)} : "x\ty" ;\nb : "z" ;\nc : "w" ;`       ;
	const result = alignSource(source, TEST_ALIGNER, { minRows: 3, apply: true }) ;

	expect(result.tables                                                                   ).toBe     (1                       ) ;
	expect(result.output.split("\n").map(line => fixtureColumn(line, ";"))                 ).toEqual  ([50_011, 50_011, 50_011]) ;
	expect(result.output                                                                   ).toContain('"x\ty"'                ) ;
	expect(alignSource(result.output, TEST_ALIGNER, { minRows: 3, apply: true }).misaligned).toBe     (0                       ) ;
});
