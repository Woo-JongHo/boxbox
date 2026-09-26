import { describe, expect, test } from "bun:test";
import { maskSource, type CodeSyntax } from "../skills/woo-code-readability/scripts/common/code-text.ts";
import { alignSource, type LineProfiler, type RowProfile } from "../skills/woo-code-readability/scripts/common/table-engine.ts";

const SYNTAX: CodeSyntax = {
	lineComments : ["//"],
	blockComments : [{ open: "/*", close: "*/" }],
	strings       : [{ open: '"', close: '"', escape: true }],
	cppRaw        : false,
};

/** `이름 : 값 ;` 형태만 인정하는 최소 프로파일러 — 구조는 마스크로, 텍스트는 원본에서 자른다. */
const TEST_ALIGNER: LineProfiler = {
	language      : "test",
	syntax        : SYNTAX,
	columnAxes    : ["name", "value"],
	canonicalGaps : { colon: " ", value: " ", semicolon: " " },
	profile(code: string, masked: string): RowProfile | null {
		const match = /^([ \t]*)([A-Za-z_][A-Za-z0-9_]*)(\s*):(\s*)(.+?)(\s*);$/du.exec(masked);
		const indices = match?.indices;
		if (!match || !indices) return null;
		const at = (group: number): string => {
			const range = indices[group];
			return range ? code.slice(range[0], range[1]) : "";
		};
		return {
			indent : at(1),
			slots  : [
				{ axis: "name",      text: at(2), gapBefore: ""     },
				{ axis: "colon",     text: ":",     gapBefore: at(3) },
				{ axis: "value",     text: at(5), gapBefore: at(4) },
				{ axis: "semicolon", text: ";",     gapBefore: at(6) },
			],
		};
	},
};

describe("maskSource", () => {
	test("기하를 보존하고 문자열 내부만 가린다", () => {
		const source = `let a = "x:y=z;"; // tail: 1\nlet b = 2;`;
		const mask = maskSource(source, SYNTAX);
		expect(mask.text.length).toBe(source.length);
		expect(mask.text).toBe(`let a = "      "; // tail: 1\nlet b = 2;`);
		expect(mask.commentStarts).toEqual([18, -1]);
	});

	test("블록 주석 내부 줄은 opensInBlock로 표시한다", () => {
		const source = `a : 1 ;\n/* begin\n   span */\nb : 2 ;`;
		const mask = maskSource(source, SYNTAX);
		expect(mask.opensInBlock).toEqual([false, false, true, false]);
		expect(mask.text.split("\n")[2]).toBe("          ");
	});

	test("주석 안의 따옴표는 문자열로 열리지 않는다", () => {
		const source = `a : 1 ; // don't "open\nb : 2 ;`;
		const mask = maskSource(source, SYNTAX);
		expect(mask.commentStarts[0]).toBe(8);
		expect(mask.text.split("\n")[1]).toBe("b : 2 ;");
	});

	test("Rust 수명 'a는 문자열로 오판하지 않는다", () => {
		const rust: CodeSyntax = { lineComments: ["//"], blockComments: [], strings: [{ open: '"', close: '"', escape: true }], rustChars: true, cppRaw: false };
		const source = `let s: &'a str = "v";`;
		const mask = maskSource(source, rust);
		expect(mask.text).toBe(`let s: &'a str = " ";`);
	});

	test("C++ 원본 문자열 R\"( )\"를 통째로 가린다", () => {
		const cpp: CodeSyntax = { lineComments: ["//"], blockComments: [{ open: "/*", close: "*/" }], strings: [{ open: '"', close: '"', escape: true }], cppRaw: true };
		const source = `const char* p = R"x(a:b=c;)x";`;
		const mask = maskSource(source, cpp);
		expect(mask.text).toBe(`const char* p = R"x(      )x";`);
	});
});

describe("alignSource", () => {
	const SOURCE = [
		"short : 1 ;",
		"longername : 22 ;",
		"m : 333 ;",
		"",
		"breaks : region ;",
		"a : 1 ;",
		"b : 2 ;",
		"// 별도 구획 주석",
		"xx : 1 ;",
		"yy : 2 ;",
	].join("\n");

	test("열을 실제 최장 셀의 최소 폭에 맞춘다", () => {
		const result = alignSource(SOURCE, TEST_ALIGNER, { minRows: 3, apply: true });
		const outputLines = result.output.split("\n");
		expect(outputLines[0]).toBe("short      : 1   ;");
		expect(outputLines[1]).toBe("longername : 22  ;");
		expect(outputLines[2]).toBe("m          : 333 ;");
		expect(result.tables).toBe(2);
		expect(result.misaligned).toBe(5);
	});

	test("빈 줄과 주석은 구획을 끊는다 — 뒤 구획이 앞 구획 폭을 공유하지 않는다", () => {
		const result = alignSource(SOURCE, TEST_ALIGNER, { minRows: 3, apply: true });
		const outputLines = result.output.split("\n");
		expect(outputLines[4]).toBe("breaks : region ;");
		expect(outputLines[5]).toBe("a      : 1      ;");
		expect(result.details.map(table => table.startLine)).toEqual([1, 5]);
	});

	test("2행 연속은 pair로 보고만 하고 정렬하지 않는다", () => {
		const result = alignSource(SOURCE, TEST_ALIGNER, { minRows: 3, apply: true });
		expect(result.pairs).toEqual([{ startLine: 9, endLine: 10, rows: 2, signature: "|name>colon>value>semicolon" }]);
		expect(result.output.split("\n")[8]).toBe("xx : 1 ;");
	});

	test("정렬은 내용을 보존하고 멱등하다", () => {
		const once = alignSource(SOURCE, TEST_ALIGNER, { minRows: 3, apply: true });
		expect(once.output.replace(/\s+/gu, "")).toBe(SOURCE.replace(/\s+/gu, ""));
		const twice = alignSource(once.output, TEST_ALIGNER, { minRows: 3, apply: true });
		expect(twice.output).toBe(once.output);
		expect(twice.misaligned).toBe(0);
	});

	test("문자열 내부의 구분자는 표로 오인하지 않는다", () => {
		const source = `name : "a:b=c;" ;\nother : 2 ;\nthird : 3 ;`;
		const result = alignSource(source, TEST_ALIGNER, { minRows: 3, apply: true });
		const outputLines = result.output.split("\n");
		expect(outputLines[0]).toBe(`name  : "a:b=c;" ;`);
		expect(outputLines[1]).toBe(`other : 2        ;`);
	});

	test("주석 꼬리는 표 안에서 한 열로 맞춘다", () => {
		const source = `alpha : 1 ; // first\nbeta : 22 ; // second\ngamma : 333 ;`;
		const result = alignSource(source, TEST_ALIGNER, { minRows: 3, apply: true });
		const outputLines = result.output.split("\n");
		expect(outputLines[0]).toBe("alpha : 1   ; // first");
		expect(outputLines[1]).toBe("beta  : 22  ; // second");
		expect(outputLines[2]).toBe("gamma : 333 ;");
	});

	test("무손실 분해에 실패한 프로파일 행은 거부한다", () => {
		const lossy: LineProfiler = {
			...TEST_ALIGNER,
			profile(code: string, masked: string): RowProfile | null {
				const base = TEST_ALIGNER.profile(code, masked);
				if (!base) return null;
				// 간격을 원본과 다르게 보고하면 엔진이 거부해야 한다.
				return { ...base, slots: base.slots.map(slot => slot.axis === "colon" ? { ...slot, gapBefore: "" } : slot) };
			},
		};
		const result = alignSource("a : 1 ;\nb : 2 ;\nc : 3 ;", lossy, { minRows: 3, apply: true });
		expect(result.misaligned).toBe(0);
		expect(result.tables).toBe(0);
	});

	test("apply=false는 보고만 하고 원본을 되돌린다", () => {
		const result = alignSource("a : 1 ;\nb : 22 ;\nc : 333 ;", TEST_ALIGNER, { minRows: 3, apply: false });
		expect(result.output).toBe("a : 1 ;\nb : 22 ;\nc : 333 ;");
		expect(result.misaligned).toBe(2);
		expect(result.edits).toBe(0);
	});
});
