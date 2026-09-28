import      { describe, expect, test } from "bun:test"                                               ;
import type { CodeSyntax             } from "../skills/xxx/scripts/common/code-text.ts"              ;
import      { changedLines           } from "../skills/xxx/scripts/common/preservation.ts"           ;
import      { alignSource            } from "../skills/xxx/scripts/common/table-engine.ts"           ;
import      { preservesTokens        } from "../skills/xxx/scripts/typescript/token-preservation.ts" ;
import type { LineProfiler           } from "../skills/xxx/scripts/common/table-engine.ts"           ;

const SYNTAX: CodeSyntax = {
	lineComments  : ["//"],
	blockComments : [{ open: "/*", close: "*/" }],
	strings       : [{ open: '"', close: '"', escape: true }],
	cppRaw        : false,
};

describe("changedLines", () => {
	test("accepts whitespace added or removed between tokens", () => {
		expect(changedLines("a:b;\nlet x = 1; // note", "a : b ;\nlet x   = 1 ;   // note", SYNTAX)).toEqual([]);
	});

	test("flags whitespace that joins or splits tokens", () => {
		expect(changedLines("let x = 1;", "letx = 1;", SYNTAX)).toEqual([0]);
		expect(changedLines("a == b;"   , "a = = b;" , SYNTAX)).toEqual([0]);
	});

	test("flags any change inside strings and comments", () => {
		expect(changedLines('a = "p q";'    , 'a = "p   q";' , SYNTAX)).toEqual([0]) ;
		expect(changedLines("a = 1; // x  y", "a = 1; // x y", SYNTAX)).toEqual([0]) ;
		expect(changedLines("/* a  b */\nc;", "/* a b */\nc;", SYNTAX)).toEqual([0]) ;
	});

	test("whitespace at the end of a line comment may go; at the end of a continuing string it may not", () => {
		expect(changedLines("a = 1; // note  "  , "a = 1; // note"  , SYNTAX)).toEqual([] ) ;
		expect(changedLines('a = "x  \nb";'    , 'a = "x\nb";'    , SYNTAX)).toEqual([0]) ;
	});

	test("flags indentation changes and line count changes", () => {
		expect(changedLines("  a = 1;"   , "    a = 1;", SYNTAX)).toEqual([0]);
		expect(changedLines("a;\nb;"     , "a; b;"     , SYNTAX)).toEqual([0, 1]);
	});
});

/** Deliberately wrong profiler: it splits the value at whitespace without looking at the mask, so a gap can fall inside a string. */
const NAIVE: LineProfiler = {
	language      : "naive",
	syntax        : SYNTAX,
	columnAxes    : ["name", "head"],
	canonicalGaps : { colon: " ", head: " ", tail: " ", semicolon: " " },
	profile(code: string): ReturnType<LineProfiler["profile"]> {
		const match   = /^(\w+)(\s*):(\s*)(\S+)(\s+)(\S+)(\s*);$/du.exec(code) ;
		const indices = match?.indices                                         ;
		if (!match || !indices) return null;
		const at = (group: number): string => code.slice(indices[group]![0], indices[group]![1]);
		return {
			indent : "",
			slots  : [
				{ axis : "name"      , text : at(1) , gapBefore : ""    },
				{ axis : "colon"     , text : ":"   , gapBefore : at(2) },
				{ axis : "head"      , text : at(4) , gapBefore : at(3) },
				{ axis : "tail"      , text : at(6) , gapBefore : at(5) },
				{ axis : "semicolon" , text : ";"   , gapBefore : at(7) },
			],
		};
	},
};

describe("engine refusal", () => {
	test("a table whose alignment would change a string is refused, not applied", () => {
		const source = 'a : "p q" ;\nbb : "pp qq" ;\nccc : "ppp qqqq" ;'       ;
		const result = alignSource(source, NAIVE, { minRows: 3, apply: true }) ;
		expect(result.output        ).toBe(source) ;
		expect(result.refused.length).toBe(1     ) ;
		expect(result.tables        ).toBe(0     ) ;
		expect(result.misaligned    ).toBe(0     ) ;
	});
});

describe("preservesTokens (TypeScript scanner)", () => {
	test("accepts whitespace between tokens", () => {
		expect(preservesTokens("const a: number = 1;", "const a    : number   = 1   ;")).toBe(true);
	});

	test("flags changes inside templates, regular expressions and comments, and joined tokens", () => {
		const text = "const a = `x ${ {k: b} } y  z`; // c  d\nlet q = /a b/g; const r = n / 2 / m;";
		expect(preservesTokens(text        , text.replace("y  z", "y z")    )).toBe(false) ;
		expect(preservesTokens(text        , text.replace("/a b/", "/a  b/"))).toBe(false) ;
		expect(preservesTokens(text        , text.replace("c  d", "c d")    )).toBe(false) ;
		expect(preservesTokens("let x = 1;", "letx = 1;"                    )).toBe(false) ;
		expect(preservesTokens("a == b;"   , "a = = b;"                     )).toBe(false) ;
	});
});
