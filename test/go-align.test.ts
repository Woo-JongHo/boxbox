import { expect, test }        from "bun:test";
import { defineLanguageSuite } from "./lang-harness.ts";
import { maskSource }          from "../skills/xxx/scripts/common/code-text.ts";
import { alignSource }         from "../skills/xxx/scripts/common/table-engine.ts";
import { GO_ALIGNER }          from "../skills/xxx/scripts/go/profile.ts";

defineLanguageSuite({
	aligner     : GO_ALIGNER,
	fixturesDir : new URL("../skills/xxx/fixtures/go/", import.meta.url).pathname,
	tableFile   : "tables.go",
	alignedFile : "tables.aligned.go",
	trickyFile  : "tricky.go",
});

test("go: a struct field type column is not padded when it is the row's last cell", () => {
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
	expect(lines[3]).toBe("Key   KeyType"    ) ;
	expect(lines[4]).toBe("Value Value"      ) ;
	expect(lines[5]).toBe("Label LongerLabel") ;
});

test("go: the tag column aligns to the longest tag value including backticks", () => {
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
	expect(new Set(tagStarts).size                ).toBe(1                                      ) ;
	expect(tagStarts[0]                           ).toBe(4 + 4 + 1 + 6 + 1                      ) ;
	expect(lines[4].slice(tagStarts[1]!).trimEnd()).toBe("`json:\"name\" validate:\"required\"`") ;
});

test("go: map rows attach the colon with zero gap and do not read string key contents as structure", () => {
	const source = [
		"var widths = map[string]int{",
		`\t"small" :  1,`,
		`\t"medium": 33,`,
		`\t"large"   : 555,`,
		"}",
	].join("\n");
	const result = alignSource(source, GO_ALIGNER, { minRows: 3, apply: true });
	const lines = result.output.split("\n");
	expect(lines[1]).toBe(`\t"small" : 1  ,`) ;
	expect(lines[2]).toBe(`\t"medium": 33 ,`) ;
	expect(lines[3]).toBe(`\t"large" : 555,`) ;
});

test("go: bundle rows align inner cell columns and the closing brace shares the cell width", () => {
	const source = [
		"var table = []Entry{",
		`    {Kind, 22,  "x"},`,
		`    {Other, 333, "yy"},`,
		`    {Third, 4, "zzz"},`,
		"}",
	].join("\n");
	const result = alignSource(source, GO_ALIGNER, { minRows: 3, apply: true });
	const lines = result.output.split("\n");
	expect(lines[1]).toBe(`    {Kind , 22 , "x"  },`) ;
	expect(lines[2]).toBe(`    {Other, 333, "yy" },`) ;
	expect(lines[3]).toBe(`    {Third, 4  , "zzz"},`) ;
});

test("go: the profile refuses bundle rows with keys, nesting, calls, a single cell or func", () => {
	const maskedOf = (code: string): string => maskSource(code, GO_ALIGNER.syntax).text;
	for (const code of [
		`{Name: "alpha", Size: 1},`, // keyed row
		"{a, {b, c}},",              // nested bundle
		"{f(x), y},",                // function call
		"{a},",                      // single cell
		"{a, },",                    // empty cell
		"{a := b, c},",              // assignment
		"{a => b, c},",              // arrow
		"{&a, b},",                  // address-of
		"{a, func},",                // func cell
		"{a, b} x",                  // leftover in the trailer position
	]) {
		expect(GO_ALIGNER.profile(code, maskedOf(code))).toBeNull();
	}
});

test("go: the profile refuses declaration, control-flow, opening-bracket and := rows", () => {
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
