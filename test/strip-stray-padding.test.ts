import      { describe, expect, test   } from "bun:test"                                    ;
import      {
              straySemicolonPadding  ,
              straySemicolonPaddings
                                       } from "@/common/23_report.ts"                       ;
import      { stripSemicolonPadding    } from "../development/tools/strip-stray-padding.ts" ;

const at = (text: string, line: number): number | undefined => straySemicolonPadding(text.split("\n"), line - 1);

describe("out-of-table padding (A12)", () => {
	test("a statement line with spaces only before the trailing `;` and no other alignment spaces is a target", () => {
		expect(at("\tif (stale) throw new Error(\"x\")      ;", 1)).toBe(6) ;
		expect(at("\treturn data ;"                          , 1)).toBe(1) ;
	});

	test("lines that form a `;` column with a neighbor, or are aligned by hand into several columns, are left alone", () => {
		const pair = ["\treadonly alternatives? : readonly Pattern[]    ;", "\treadonly note?         : string                ;"].join("\n") ;

		expect(at(pair, 1)).toBeUndefined() ;
		expect(at(pair, 2)).toBeUndefined() ;
		expect(at("\tconst a   = 1   ;", 1)).toBeUndefined() ;
	});

	test("comments and import lines are not targets", () => {
		expect(at("\t// note ;"                                 , 1)).toBeUndefined() ;
		expect(at("import { a } from \"m\" ;"                   , 1)).toBeUndefined() ;
		expect(at("                } from \"node:fs\"        ;", 1)).toBeUndefined() ;
	});

	test("inline comments and multiline comment or template content are never cleanup targets", () => {
		const source = ['const a = 1; // note ;', '/*', 'body ;', '*/', 'const value = `', 'literal ;', '`;', '', 'return value  ;'].join("\n");

		for (const line of [1, 3, 6]) expect(at(source, line)).toBeUndefined();
		expect(at(source, 9)).toBe(2);
		expect(stripSemicolonPadding(source)).toBe(source.replace('return value  ;', 'return value;'));
	});

	test("batch scanner decisions match independent token-preservation checks in mixed source", () => {
		const lines = ['const name = "😀";', 'const a = 1; // note ;', 'const pattern = /a ;/;', '/*', 'body ;', '*/', 'const value = `', 'literal ;', '`;', '', 'return value  ;', '', 'throw error   ;'].map(line => `${line}\r`) ;
		const batch = straySemicolonPaddings(lines)                                                                                                                                                                                ;
		for (const [index] of lines.entries()) expect(batch.get(index)).toBe(straySemicolonPadding(lines, index));
		expect([...batch.keys()]).toEqual([10, 12]);
	});

	test("cleanup changes only target lines, judged against the original body", () => {
		const before = ["\tconst data = value as T       ;", "\tif (x) throw new Error(\"y\")   ;", "", "\treturn data  ;"].join("\n") ;

		expect(stripSemicolonPadding(before)).toBe(["\tconst data = value as T       ;", "\tif (x) throw new Error(\"y\")   ;", "", "\treturn data;"].join("\n")) ;
	});
});
