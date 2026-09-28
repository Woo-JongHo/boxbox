import { describe, expect, test } from "bun:test";
import { C_ALIGNER }              from "../skills/xxx/scripts/c/profile.ts";
import { alignSource }            from "../skills/xxx/scripts/common/table-engine.ts";
import { defineLanguageSuite }    from "./lang-harness.ts";

defineLanguageSuite({
	aligner     : C_ALIGNER,
	fixturesDir : new URL("../skills/xxx/fixtures/c/", import.meta.url).pathname,
	tableFile   : "tables.c",
	alignedFile : "tables.aligned.c",
	trickyFile  : "tricky.c",
});

describe("C profiler specific properties", () => {
	test("designated initializers align the dotfield column to the actual longest cell", () => {
		const source = [
			"struct config defaults = {",
			`    .name = "x",`,
			"    .retries = 3,",
			"    .timeout_ms = 1500,",
			"};",
		].join("\n");
		const result = alignSource(source, C_ALIGNER, { minRows: 3, apply: true });
		const lines = result.output.split("\n");
		expect(lines[1]         ).toBe(`    .name       = "x" ,`) ;
		expect(lines[2]         ).toBe("    .retries    = 3   ,") ;
		expect(lines[3]         ).toBe("    .timeout_ms = 1500,") ;
		expect(result.misaligned).toBe(2                        ) ;
	});

	test("function-like macros NAME(args) are not table rows", () => {
		const source = [
			"#define SQUARE(x) ((x) * (x))",
			"#define MAX(a, b) ((a) > (b) ? (a) : (b))",
			"#define MIN(a, b) ((a) < (b) ? (a) : (b))",
		].join("\n");
		const result = alignSource(source, C_ALIGNER, { minRows: 3, apply: true });
		expect(result.tables    ).toBe(0     ) ;
		expect(result.misaligned).toBe(0     ) ;
		expect(result.output    ).toBe(source) ;
	});

	test("pointer stars attach to the name cell and type/name columns align", () => {
		const source = [
			"struct link {",
			"    char *name;",
			"    struct link *next;",
			"    struct link *prev;",
			"};",
		].join("\n");
		const result = alignSource(source, C_ALIGNER, { minRows: 3, apply: true });
		const lines = result.output.split("\n");
		expect(lines[1]).toBe("    char        *name;") ;
		expect(lines[2]).toBe("    struct link *next;") ;
		expect(lines[3]).toBe("    struct link *prev;") ;
	});

	test("macro tables align only the name column and never pad the replacement list", () => {
		const source = [
			"#define PORT 80",
			"#define BACKLOG 128",
			"#define GREETING \"hi = ;\"",
		].join("\n");
		const result = alignSource(source, C_ALIGNER, { minRows: 3, apply: true });
		const lines = result.output.split("\n");
		expect(lines[0]).toBe("#define PORT     80"      ) ;
		expect(lines[1]).toBe("#define BACKLOG  128"     ) ;
		expect(lines[2]).toBe(`#define GREETING "hi = ;"`) ;
	});

	test("bundle rows align inner cell columns to each longest cell", () => {
		const source = [
			"static const Table table[] = {",
			`    {1, "alpha", 0x10},`,
			`    {22, "b", 0x201},`,
			`    {333, "ccc", 3},`,
			"};",
		].join("\n");
		const result = alignSource(source, C_ALIGNER, { minRows: 3, apply: true });
		const lines = result.output.split("\n");
		expect(lines[1]         ).toBe(`    {1  , "alpha", 0x10 },`) ;
		expect(lines[2]         ).toBe(`    {22 , "b"    , 0x201},`) ;
		expect(lines[3]         ).toBe(`    {333, "ccc"  , 3    },`) ;
		expect(result.misaligned).toBe(3                           ) ;
	});

	test("refuses bundle rows with nesting, assignment or calls, and single-cell rows", () => {
		const nested = [
			"static const Nest nests[] = {",
			"    {1, {2, 3}, 4},",
			"    {5, {6, 7}, 8},",
			"    {9, {10, 11}, 12},",
			"};",
		].join("\n");
		const assigned = [
			"static const Assign assigns[] = {",
			"    {1, x = 2, 3},",
			"    {4, y = 5, 6},",
			"    {7, z = 8, 9},",
			"};",
		].join("\n");
		const called = [
			"static const Call calls[] = {",
			"    {foo(1), 2},",
			"    {bar(3), 4},",
			"    {baz(5), 6},",
			"};",
		].join("\n");
		const single = [
			"static const Solo solos[] = {",
			"    {only},",
			"    {single},",
			"    {loner},",
			"};",
		].join("\n");
		for (const source of [nested, assigned, called, single]) {
			const result = alignSource(source, C_ALIGNER, { minRows: 3, apply: true });
			expect(result.tables    ).toBe(0     ) ;
			expect(result.misaligned).toBe(0     ) ;
			expect(result.output    ).toBe(source) ;
		}
	});

	test("refuses return statements and backslash-continued macros", () => {
		const source = [
			"#define WIDE 1 + \\",
			"    2 + \\",
			"    3",
			"return value;",
			"return other;",
			"return third;",
		].join("\n");
		const result = alignSource(source, C_ALIGNER, { minRows: 3, apply: true });
		expect(result.tables).toBe(0);
		expect(result.output).toBe(source);
	});
});
