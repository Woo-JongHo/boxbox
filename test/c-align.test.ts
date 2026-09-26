import { describe, expect, test } from "bun:test";
import { C_ALIGNER }              from "../skills/woo-code-readability/scripts/c/profile.ts";
import { alignSource }            from "../skills/woo-code-readability/scripts/common/table-engine.ts";
import { defineLanguageSuite }    from "./lang-harness.ts";

defineLanguageSuite({
	aligner     : C_ALIGNER,
	fixturesDir : new URL("../skills/woo-code-readability/fixtures/c/", import.meta.url).pathname,
	tableFile   : "tables.c",
	alignedFile : "tables.aligned.c",
	trickyFile  : "tricky.c",
});

describe("C 프로파일러 고유 성질", () => {
	test("지정 초기화는 dotfield 열을 실제 최장 셀 폭으로 맞춘다", () => {
		const source = [
			"struct config defaults = {",
			`    .name = "x",`,
			"    .retries = 3,",
			"    .timeout_ms = 1500,",
			"};",
		].join("\n");
		const result = alignSource(source, C_ALIGNER, { minRows: 3, apply: true });
		const lines = result.output.split("\n");
		expect(lines[1]).toBe(`    .name       = "x" ,`);
		expect(lines[2]).toBe("    .retries    = 3   ,");
		expect(lines[3]).toBe("    .timeout_ms = 1500,");
		expect(result.misaligned).toBe(2);
	});

	test("함수형 매크로 NAME(args)는 표 행으로 인정하지 않는다", () => {
		const source = [
			"#define SQUARE(x) ((x) * (x))",
			"#define MAX(a, b) ((a) > (b) ? (a) : (b))",
			"#define MIN(a, b) ((a) < (b) ? (a) : (b))",
		].join("\n");
		const result = alignSource(source, C_ALIGNER, { minRows: 3, apply: true });
		expect(result.tables).toBe(0);
		expect(result.misaligned).toBe(0);
		expect(result.output).toBe(source);
	});

	test("포인터 별표는 이름 셀에 붙고 type·name 열이 맞춰진다", () => {
		const source = [
			"struct link {",
			"    char *name;",
			"    struct link *next;",
			"    struct link *prev;",
			"};",
		].join("\n");
		const result = alignSource(source, C_ALIGNER, { minRows: 3, apply: true });
		const lines = result.output.split("\n");
		expect(lines[1]).toBe("    char        *name;");
		expect(lines[2]).toBe("    struct link *next;");
		expect(lines[3]).toBe("    struct link *prev;");
	});

	test("매크로 표는 이름 열만 맞추고 치환 목록은 패딩하지 않는다", () => {
		const source = [
			"#define PORT 80",
			"#define BACKLOG 128",
			"#define GREETING \"hi = ;\"",
		].join("\n");
		const result = alignSource(source, C_ALIGNER, { minRows: 3, apply: true });
		const lines = result.output.split("\n");
		expect(lines[0]).toBe("#define PORT     80");
		expect(lines[1]).toBe("#define BACKLOG  128");
		expect(lines[2]).toBe(`#define GREETING "hi = ;"`);
	});

	test("return 문과 역슬래시 줄 연결 매크로는 거부한다", () => {
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
