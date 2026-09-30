/**
 * C++ profiler suite. The harness checks the shared properties (preservation, idempotence, golden, traps,
 * no alignment of 2-row groups); this file adds C++-specific ones — template type cells preserved, raw string rows
 * refused, function pointers and function-like macros refused, = ; inside strings not read as structure, bundle-row
 * inner cell alignment, and refusal of nesting and assignment.
 */
import      { readFileSync           } from "node:fs"                  ;
import      { describe, expect, test } from "bun:test"                 ;
import      { alignSource            } from "@/common/table-engine.ts" ;
import      { CPP_ALIGNER            } from "@/cpp/profile.ts"         ;
import      { defineLanguageSuite    } from "./lang-harness.ts"        ;

defineLanguageSuite({
	aligner     : CPP_ALIGNER,
	fixturesDir : new URL("../skills/xxx/fixtures/cpp/", import.meta.url).pathname,
	tableFile   : "tables.cpp",
	alignedFile : "tables.aligned.cpp",
	trickyFile  : "tricky.cpp",
});

describe("cpp profile specific properties", () => {
	const align = (source: string): ReturnType<typeof alignSource> => alignSource(source, CPP_ALIGNER, { minRows: 3, apply: true });

	test("preserves the std::vector<int> type cell and aligns the name column at minimum width", () => {
		const source = [
			"std::vector<int> items;",
			"int count;",
			"const std::string& label;",
		].join("\n");
		const output = align(source).output.split("\n");
		expect(output[0]).toBe("std::vector<int>   items;") ;
		expect(output[1]).toBe("int                count;") ;
		expect(output[2]).toBe("const std::string& label;") ;
	});

	test("lines with an open R\"( raw string and their contents are not tables", () => {
		const source = [
			"const char* doc = R\"(mode = fast;",
			"count = 4;",
			")\";",
		].join("\n");
		const result = align(source);
		expect(result.tables    ).toBe(0     ) ;
		expect(result.misaligned).toBe(0     ) ;
		expect(result.output    ).toBe(source) ;
	});

	test("refuses parentheses in type cells (function pointers) and function-like macros, accepts object-like macros", () => {
		expect(CPP_ALIGNER.profile("void (*callback)(int);", "void (*callback)(int);")).toBeNull();
		expect(CPP_ALIGNER.profile("using Handler = void (*)(int);", "using Handler = void (*)(int);")).toBeNull();
		expect(CPP_ALIGNER.profile("#define MAX(a, b) ((a) > (b))", "#define MAX(a, b) ((a) > (b))")).toBeNull();
		const define = CPP_ALIGNER.profile("#define LIMIT 90", "#define LIMIT 90");
		expect(define?.slots.map(slot => slot.axis)).toEqual(["directive", "name", "value"]);
	});

	test("does not read = ; inside strings as structure and keeps them in the value cell", () => {
		const source = [
			"const char* one = \"x = 1;\";",
			"const char* two = \"yy = 22;\";",
			"const char* three = \"zzz = 333;\";",
		].join("\n");
		const output = align(source).output.split("\n");
		expect(output[0]).toBe("const char* one   = \"x = 1;\"    ;") ;
		expect(output[1]).toBe("const char* two   = \"yy = 22;\"  ;") ;
		expect(output[2]).toBe("const char* three = \"zzz = 333;\";") ;
	});

	test("aligns bundle-row inner cell columns at minimum width", () => {
		const source = [
			"static const Entry rows[] = {",
			`    {"alpha", 1, 0x10},`,
			`    {"b, c", 22, 2},`,
			`    {"ccc", 333, 0x201},`,
			"};",
		].join("\n");
		const output = align(source).output.split("\n");
		expect(output[1]).toBe(`    {"alpha", 1,   0x10},` ) ;
		expect(output[2]).toBe(`    {"b, c",  22,  2},`    ) ;
		expect(output[3]).toBe(`    {"ccc",   333, 0x201},`) ;
	});

	test("refuses bundle rows with nesting, assignment or indexing, and single or empty cells", () => {
		expect(CPP_ALIGNER.profile(`    {{"alpha", 1}, 2},`, `    {{"alpha", 1}, 2},`)).toBeNull();
		expect(CPP_ALIGNER.profile(`    {"alpha", n = 1, 2},`, `    {"alpha", n = 1, 2},`)).toBeNull();
		expect(CPP_ALIGNER.profile(`    {"alpha", v[0], 2},`, `    {"alpha", v[0], 2},`)).toBeNull();
		expect(CPP_ALIGNER.profile(`    {"alpha"},`, `    {"alpha"},`)).toBeNull();
		expect(CPP_ALIGNER.profile(`    {"alpha", , 2},`, `    {"alpha", , 2},`)).toBeNull();
		const nested = [
			`    {{"a", 1}, 2},`,
			`    {{"b", 2}, 3},`,
			`    {{"c", 3}, 4},`,
		].join("\n");
		expect(align(nested).misaligned).toBe(0);
		const bundle = CPP_ALIGNER.profile(`    {"alpha", 1},`, `    {"alpha", 1},`);
		expect(bundle?.slots.map(slot => slot.axis)).toEqual(["open", "item0", "item"]);
		expect(bundle?.slots.map(slot => slot.text)).toEqual(["{", `"alpha",`, `1},`]);
	});

	test("the 2-row groups in tables.cpp are a field-table pair and a bundle-row pair", () => {
		const source = readFileSync(new URL("../skills/xxx/fixtures/cpp/tables.cpp", import.meta.url), "utf8") ;
		const result = align(source)                                                                           ;
		expect(result.pairs.length).toBe(2);
		expect(result.pairs.map(pair => pair.signature)).toEqual([
			"    |type>name>equal>value>semicolon",
			"    |open>item0>item>item>item",
		]);
	});
});
