import      { describe, expect, test } from "bun:test"                          ;
import      { straySemicolonPadding  } from "@/common/report.ts"                ;
import      { stripSemicolonPadding  } from "../scripts/strip-stray-padding.ts" ;

const at = (text: string, line: number): number | undefined => straySemicolonPadding(text.split("\n"), line - 1);

describe("표 밖 정렬 공백 (A12)", () => {
	test("다른 정렬 공백 없이 끝 `;` 앞에만 공백이 있는 문장 줄은 대상이다", () => {
		expect(at("\tif (stale) throw new Error(\"x\")      ;", 1)).toBe(6) ;
		expect(at("\treturn data ;"                          , 1)).toBe(1) ;
	});

	test("이웃 줄과 `;` 열을 이루거나, 여러 열을 손으로 맞춘 줄은 건드리지 않는다", () => {
		const pair = ["\treadonly alternatives? : readonly Pattern[]    ;", "\treadonly note?         : string                ;"].join("\n") ;

		expect(at(pair, 1)).toBeUndefined() ;
		expect(at(pair, 2)).toBeUndefined() ;
		expect(at("\tconst a   = 1   ;", 1)).toBeUndefined() ;
	});

	test("주석과 import 줄은 대상이 아니다", () => {
		expect(at("\t// note ;"                                 , 1)).toBeUndefined() ;
		expect(at("import { a } from \"m\" ;"                   , 1)).toBeUndefined() ;
		expect(at("                } from \"node:fs\"        ;", 1)).toBeUndefined() ;
	});

	test("정리는 대상 줄만 바꾸고, 판단은 원래 본문 기준이다", () => {
		const before = ["\tconst data = value as T       ;", "\tif (x) throw new Error(\"y\")   ;", "", "\treturn data  ;"].join("\n") ;

		expect(stripSemicolonPadding(before)).toBe(["\tconst data = value as T       ;", "\tif (x) throw new Error(\"y\")   ;", "", "\treturn data;"].join("\n")) ;
	});
});
