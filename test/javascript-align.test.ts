import { describe, expect, test } from "bun:test";
import { maskSource } from "../skills/woo-code-readability/scripts/common/code-text.ts";
import { alignSource } from "../skills/woo-code-readability/scripts/common/table-engine.ts";
import { defineLanguageSuite } from "./lang-harness.ts";
import { JAVASCRIPT_ALIGNER, JAVASCRIPT_SYNTAX } from "../skills/woo-code-readability/scripts/javascript/profile.ts";

defineLanguageSuite({
	aligner     : JAVASCRIPT_ALIGNER,
	fixturesDir : new URL("../skills/woo-code-readability/fixtures/javascript/", import.meta.url).pathname,
	tableFile   : "tables.js",
	alignedFile : "tables.aligned.js",
	trickyFile  : "tricky.js",
});

describe("javascript 프로파일 고유 성질", () => {
	const align = (source: string): ReturnType<typeof alignSource> => alignSource(source, JAVASCRIPT_ALIGNER, { minRows: 3, apply: true });

	test("객체 리터럴 행과 const 대입 행은 맞닿아 있어도 별개 표로 폭을 나눠 갖는다", () => {
		const source = [
			"const a = 1;",
			"const bb = 22;",
			"const ccc = 333;",
			"key: value,",
			"longerKey: 2,",
			"mid: 3,",
		].join("\n");
		const result = align(source);
		expect(result.tables).toBe(2);
		expect(result.details[0]?.axes).toEqual(["keyword", "name", "equal", "value", "semicolon"]);
		expect(result.details[0]?.widths).toEqual([5, 3, 1, 3, 1]);
		expect(result.details[1]?.axes).toEqual(["key", "colon", "value", "comma"]);
		expect(result.details[1]?.widths).toEqual([9, 1, 5, 1]);
		const lines = result.output.split("\n");
		expect(lines[0]).toBe("const a   = 1   ;");
		expect(lines[3]).toBe("key      : value,");
	});

	test("문자열 내부의 : = ; 는 구조로 오인하지 않고 값 셀을 온전히 보존한다", () => {
		const source = [
			'mid: "a:b=c;d",',
			'wideKey: "e=f",',
			"tiny: 1,",
		].join("\n");
		const result = align(source);
		const lines = result.output.split("\n");
		expect(lines[0]).toBe('mid    : "a:b=c;d",');
		expect(lines[1]).toBe('wideKey: "e=f"    ,');
		expect(lines[2]).toBe("tiny   : 1        ,");
	});

	test("화살표 함수·비교 연산·제어문·다중 선언·확신 없는 행은 표 행으로 인정하지 않는다", () => {
		const rejected = [
			"const f = () => 1;",
			"total <= limit;",
			"if (ready) state = 1;",
			"for (const item of items) use(item);",
			"const partial = mix(one,",
			"const both = 1, other = 2;",
			"case kind:",
			"key: value",
		];
		for (const line of rejected) {
			// 이 행들에는 문자열이 없어 마스크가 원본과 같다 — 구조·텍스트 좌표가 일치한다.
			expect(JAVASCRIPT_ALIGNER.profile(line, line)).toBeNull();
		}
	});

	test("템플릿 리터럴과 따옴표 키를 하나의 셀로 자른다", () => {
		const template = "tiny: `sum:${1 + 2} = 3`,";
		const quoted   = '"open:key": v,';
		for (const [line, axis, expected] of [
			[template, "value", "`sum:${1 + 2} = 3`"],
			[quoted, "key", '"open:key"'],
		] as const) {
			const mask   = maskSource(line, JAVASCRIPT_SYNTAX);
			const masked = mask.text.split("\n")[0] ?? "";
			const profile = JAVASCRIPT_ALIGNER.profile(line, masked);
			expect(profile?.slots.find(slot => slot.axis === axis)?.text).toBe(expected);
		}
	});
});
