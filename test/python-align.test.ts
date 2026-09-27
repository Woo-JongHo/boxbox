import { describe, expect, test } from "bun:test";
import { alignSource }            from "../skills/woo-code-readability/scripts/common/table-engine.ts";
import { PYTHON_ALIGNER }         from "../skills/woo-code-readability/scripts/python/profile.ts";
import { defineLanguageSuite }    from "./lang-harness.ts";

defineLanguageSuite({
	aligner     : PYTHON_ALIGNER,
	fixturesDir : new URL("../skills/woo-code-readability/fixtures/python/", import.meta.url).pathname,
	tableFile   : "tables.py",
	alignedFile : "tables.aligned.py",
	trickyFile  : "tricky.py",
});

describe("python 프로파일 고유 성질", () => {
	const align = (source: string): ReturnType<typeof alignSource> => alignSource(source, PYTHON_ALIGNER, { minRows: 3, apply: true });

	test("딕셔너리 행은 key·colon·value·comma 축으로 분해되어 colon 열이 맞춰진다", () => {
		const source = [
			"defaults = {",
			`    "host": "localhost:8080",`,
			`    "port": 8080,`,
			`    "debug": True,`,
			"}",
		].join("\n");
		const result = align(source);
		const lines = result.output.split("\n");
		expect(lines[1]).toBe(`    "host" : "localhost:8080",`);
		expect(lines[2]).toBe(`    "port" : 8080            ,`);
		expect(lines[3]).toBe(`    "debug": True            ,`);
		expect(result.tables).toBe(1);
	});

	test("어노테이션 대입은 name·type 열을 맞추고 행 끝 value는 패딩하지 않는다", () => {
		const source = [
			"@dataclass",
			"class Config:",
			"    retries: int = 3",
			`    label: str = "x"`,
			"    verbose: bool = True",
		].join("\n");
		const result = align(source);
		const lines = result.output.split("\n");
		expect(lines[2]).toBe("    retries: int  = 3");
		expect(lines[3]).toBe(`    label  : str  = "x"`);
		expect(lines[4]).toBe("    verbose: bool = True");
		expect(result.misaligned).toBe(2);
	});

	test("붙여 쓴 대입도 표로 묶여 관습 간격(colon 뒤 없음·equal 양쪽 공백)으로 고쳐진다", () => {
		const source = [
			"ratio:float=0.5",
			"level:int=3",
			"name:str='x'",
		].join("\n");
		const result = align(source);
		const lines = result.output.split("\n");
		expect(lines[0]).toBe("ratio: float = 0.5");
		expect(lines[1]).toBe("level: int   = 3");
		expect(lines[2]).toBe("name : str   = 'x'");
	});

	test("제어문·괄호 호출·줄 연속 문자 행은 프로파일이 거부해 표로 묶지 않는다", () => {
		const source = [
			"if flag == other:",
			"    total = compute(a, b) + \\",
			"        extra",
			"    done = True",
		].join("\n");
		const result = align(source);
		expect(result.tables).toBe(0);
		expect(result.misaligned).toBe(0);
		expect(result.output).toBe(source);
	});

	test("값 안의 == 비교는 그대로 두고 == 로 시작하는 값은 거부한다", () => {
		const comparable = align([
			"flag = a == b",
			"other = b == c",
			"third = c == d",
		].join("\n"));
		expect(comparable.output.split("\n")[0]).toBe("flag  = a == b");
		expect(comparable.misaligned).toBe(1);

		const bareComparison = align([
			"alpha = 1",
			"beta = 22",
			"gamma = 333",
			"flag == other",
		].join("\n"));
		expect(bareComparison.tables).toBe(1);
		expect(bareComparison.misaligned).toBe(1);
		expect(bareComparison.output.split("\n")[0]).toBe("alpha = 1");
		expect(bareComparison.output.split("\n")[3]).toBe("flag == other");
	});
});
