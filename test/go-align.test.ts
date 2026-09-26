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

test("go: 구조체 필드 type 열을 최장 타입 셀에 맞춘다", () => {
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
	expect(lines[3]).toBe("Key   KeyType    ");
	expect(lines[4]).toBe("Value Value      ");
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
