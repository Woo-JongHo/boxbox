import { expect, test }        from "bun:test";
import { defineLanguageSuite } from "./lang-harness.ts";
import { maskSource }          from "../skills/woo-code-readability/scripts/common/code-text.ts";
import { alignSource }         from "../skills/woo-code-readability/scripts/common/table-engine.ts";
import { GO_ALIGNER }          from "../skills/woo-code-readability/scripts/go/profile.ts";

defineLanguageSuite({
	aligner     : GO_ALIGNER,
	fixturesDir : new URL("../skills/woo-code-readability/fixtures/go/", import.meta.url).pathname,
	tableFile   : "tables.go",
	alignedFile : "tables.aligned.go",
	trickyFile  : "tricky.go",
});

test("go: 구조체 필드 type 열은 행의 마지막 셀이면 패딩하지 않는다", () => {
	const source = [
		"package layout",
		"",
		"type Pair struct {",
		"Key    KeyType",
		"Value Value",
		"Label   LongerLabel",
		"}",
	].join("\n");
	const result = alignSource(source, GO_ALIGNER, { minRows: 3, apply: true });
	const lines = result.output.split("\n");
	expect(lines[3]).toBe("Key   KeyType");
	expect(lines[4]).toBe("Value Value");
	expect(lines[5]).toBe("Label LongerLabel");
});

test("go: 태그 열은 백틱 포함 최장 태그 값에 맞춘다", () => {
	const source = [
		"package layout",
		"",
		"type Item struct {",
		`    ID   string \`json:"id"\``,
		`    Name string      \`json:"name" validate:"required"\``,
		`    Qty  int    \`json:"qty"\``,
		"}",
	].join("\n");
	const result    = alignSource(source, GO_ALIGNER, { minRows: 3, apply: true }) ;
	const lines     = result.output.split("\n")                                    ;
	const tagStarts = lines.slice(3, 6).map(line => line.indexOf("`"))             ;
	expect(new Set(tagStarts).size).toBe(1);
	expect(tagStarts[0]).toBe(4 + 4 + 1 + 6 + 1);
	expect(lines[4].slice(tagStarts[1]!).trimEnd()).toBe("`json:\"name\" validate:\"required\"`");
});

test("go: 맵 행은 colon 간격 0으로 붙이고 문자열 키 내부는 구조로 보지 않는다", () => {
	const source = [
		"var widths = map[string]int{",
		`\t"small" :  1,`,
		`\t"medium": 33,`,
		`\t"large"   : 555,`,
		"}",
	].join("\n");
	const result = alignSource(source, GO_ALIGNER, { minRows: 3, apply: true });
	const lines = result.output.split("\n");
	expect(lines[1]).toBe(`\t"small" : 1  ,`);
	expect(lines[2]).toBe(`\t"medium": 33 ,`);
	expect(lines[3]).toBe(`\t"large" : 555,`);
});

test("go: 묶음 행은 내부 셀 열을 맞추고 닫는 중괄호도 cell 폭을 공유한다", () => {
	const source = [
		"var table = []Entry{",
		`    {Kind, 22,  "x"},`,
		`    {Other, 333, "yy"},`,
		`    {Third, 4, "zzz"},`,
		"}",
	].join("\n");
	const result = alignSource(source, GO_ALIGNER, { minRows: 3, apply: true });
	const lines = result.output.split("\n");
	expect(lines[1]).toBe(`    {Kind , 22 , "x"  },`);
	expect(lines[2]).toBe(`    {Other, 333, "yy" },`);
	expect(lines[3]).toBe(`    {Third, 4  , "zzz"},`);
});

test("go: 키·중첩·호출·단일 셀·func 묶음 행은 프로파일을 거부한다", () => {
	const maskedOf = (code: string): string => maskSource(code, GO_ALIGNER.syntax).text;
	for (const code of [
		`{Name: "alpha", Size: 1},`, // 키 있는 행
		"{a, {b, c}},",              // 중첩 묶음
		"{f(x), y},",                // 함수 호출
		"{a},",                      // 셀 1개
		"{a, },",                    // 빈 셀
		"{a := b, c},",              // 대입
		"{a => b, c},",              // 화살표
		"{&a, b},",                  // 주소 연산
		"{a, func},",                // func 셀
		"{a, b} x",                  // trailer 자리에 잔류
	]) {
		expect(GO_ALIGNER.profile(code, maskedOf(code))).toBeNull();
	}
});

test("go: 선언·제어·여는 괄호·:= 행은 프로파일을 거부한다", () => {
	const maskedOf = (code: string): string => maskSource(code, GO_ALIGNER.syntax).text;
	for (const code of [
		"func demo(ok bool) {",
		"type Pair struct {",
		"var table = map[string]int{",
		"if ok == true {",
		"for index := 0; index < 3; index += 1 {",
		"go func() {",
		"defer file.Close()",
		`sizes := map[string]int{"s": 1}`,
		"case Field:",
		"package layout",
		`import "fmt"`,
	]) {
		expect(GO_ALIGNER.profile(code, maskedOf(code))).toBeNull();
	}
});
