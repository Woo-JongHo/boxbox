/**
 * C++ 프로파일러 스위트. 언어 공통 성질(보존·멱등·골든·함정·2행 미정렬)은 하네스가 검사하고,
 * 이 파일은 C++ 고유 성질 — 템플릿 타입 셀 보존, 원본 문자열 행 거부, 함수 포인터·함수형 매크로
 * 거부, 문자열 내부 = ; 의 구조 비오판 — 을 더해 검사한다.
 */
import { readFileSync }           from "node:fs";
import { describe, expect, test } from "bun:test";
import { alignSource }            from "../skills/woo-code-readability/scripts/common/table-engine.ts";
import { CPP_ALIGNER }            from "../skills/woo-code-readability/scripts/cpp/profile.ts";
import { defineLanguageSuite }    from "./lang-harness.ts";

defineLanguageSuite({
	aligner     : CPP_ALIGNER,
	fixturesDir : new URL("../skills/woo-code-readability/fixtures/cpp/", import.meta.url).pathname,
	tableFile   : "tables.cpp",
	alignedFile : "tables.aligned.cpp",
	trickyFile  : "tricky.cpp",
});

describe("cpp 프로파일 고유 성질", () => {
	const align = (source: string): ReturnType<typeof alignSource> => alignSource(source, CPP_ALIGNER, { minRows: 3, apply: true });

	test("std::vector<int> 타입 셀을 보존하고 name 열을 최소 폭으로 맞춘다", () => {
		const source = [
			"std::vector<int> items;",
			"int count;",
			"const std::string& label;",
		].join("\n");
		const output = align(source).output.split("\n");
		expect(output[0]).toBe("std::vector<int>   items;");
		expect(output[1]).toBe("int                count;");
		expect(output[2]).toBe("const std::string& label;");
	});

	test("R\"( 원본 문자열이 열려 있는 줄과 그 내부는 표로 인정하지 않는다", () => {
		const source = [
			"const char* doc = R\"(mode = fast;",
			"count = 4;",
			")\";",
		].join("\n");
		const result = align(source);
		expect(result.tables).toBe(0);
		expect(result.misaligned).toBe(0);
		expect(result.output).toBe(source);
	});

	test("type 셀의 소괄호(함수 포인터)와 함수형 매크로는 거부하고 객체형 매크로는 인정한다", () => {
		expect(CPP_ALIGNER.profile("void (*callback)(int);", "void (*callback)(int);")).toBeNull();
		expect(CPP_ALIGNER.profile("using Handler = void (*)(int);", "using Handler = void (*)(int);")).toBeNull();
		expect(CPP_ALIGNER.profile("#define MAX(a, b) ((a) > (b))", "#define MAX(a, b) ((a) > (b))")).toBeNull();
		const define = CPP_ALIGNER.profile("#define LIMIT 90", "#define LIMIT 90");
		expect(define?.slots.map(slot => slot.axis)).toEqual(["directive", "name", "value"]);
	});

	test("문자열 내부의 = ; 를 구조로 오판하지 않고 값 셀에 그대로 보존한다", () => {
		const source = [
			"const char* one = \"x = 1;\";",
			"const char* two = \"yy = 22;\";",
			"const char* three = \"zzz = 333;\";",
		].join("\n");
		const output = align(source).output.split("\n");
		expect(output[0]).toBe("const char* one   = \"x = 1;\"    ;");
		expect(output[1]).toBe("const char* two   = \"yy = 22;\"  ;");
		expect(output[2]).toBe("const char* three = \"zzz = 333;\";");
	});

	test("tables.cpp에는 정확히 하나의 2행 그룹(pair)이 있다", () => {
		const source = readFileSync(new URL("../skills/woo-code-readability/fixtures/cpp/tables.cpp", import.meta.url), "utf8");
		const result = align(source);
		expect(result.pairs.length).toBe(1);
		expect(result.pairs[0].signature).toBe("    |type>name>equal>value>semicolon");
	});
});
