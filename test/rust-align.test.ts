import { expect, test }        from "bun:test";
import { defineLanguageSuite } from "./lang-harness.ts";
import { alignSource }         from "../skills/woo-code-readability/scripts/common/table-engine.ts";
import { RUST_ALIGNER }        from "../skills/woo-code-readability/scripts/rust/profile.ts";

defineLanguageSuite({
	aligner     : RUST_ALIGNER,
	fixturesDir : new URL("../skills/woo-code-readability/fixtures/rust/", import.meta.url).pathname,
	tableFile   : "tables.rs",
	alignedFile : "tables.aligned.rs",
	trickyFile  : "tricky.rs",
});

test("rust: match 갈래 pattern·action 열을 최소 폭으로 맞춘다", () => {
	const source = [
		"match frame {",
		"    Read(n) => n,",
		"    Write(n)  => n * 2,",
		"    Move(x, y) => x + y,",
		"}",
	].join("\n");
	const result = alignSource(source, RUST_ALIGNER, { minRows: 3, apply: true });
	expect(result.tables).toBe(1);
	expect(result.details[0].axes).toEqual(["pattern", "arrow", "action", "comma"]);
	const lines = result.output.split("\n");
	expect(lines[1]).toBe("    Read(n)    => n    ,");
	expect(lines[2]).toBe("    Write(n)   => n * 2,");
	expect(lines[3]).toBe("    Move(x, y) => x + y,");
});

test("rust: 수명이 포함된 타입 셀을 그대로 보존한다", () => {
	const source = [
		`let a: &'static str = "x:y";`,
		`let b: &'a str = "y";`,
		`let c: &str = "z";`,
	].join("\n");
	const result = alignSource(source, RUST_ALIGNER, { minRows: 3, apply: true });
	const lines = result.output.split("\n");
	expect(lines[0]).toBe(`let a: &'static str = "x:y";`);
	expect(lines[1]).toBe(`let b: &'a str      = "y"  ;`);
	expect(lines[2]).toBe(`let c: &str         = "z"  ;`);
	expect(result.misaligned).toBe(2);
});

test("rust: enum 변형의 닫힌 소괄호 한 쌍을 하나의 셀로 삼는다", () => {
	const profile = RUST_ALIGNER.profile("    Move(i64, i64),", "    Move(i64, i64),");
	expect(profile?.slots.map(slot => slot.axis)).toEqual(["name", "paren", "comma"]);
	expect(profile?.slots[1].text).toBe("(i64, i64)");
});

test("rust: let mut 행은 keyword 축으로 name·value 열과 함께 정렬된다", () => {
	const profile = RUST_ALIGNER.profile("    let mut total: u64 = 0;", "    let mut total: u64 = 0;");
	expect(profile?.slots[0]).toEqual({ axis: "keyword", text: "let mut", gapBefore: "" });
	const source = [
		"let mut base = 10;",
		"let mut step  = 2;",
		"let mut total   = base + step;",
	].join("\n");
	const result = alignSource(source, RUST_ALIGNER, { minRows: 3, apply: true });
	const lines = result.output.split("\n");
	expect(lines[0]).toBe("let mut base  = 10         ;");
	expect(lines[1]).toBe("let mut step  = 2          ;");
	expect(lines[2]).toBe("let mut total = base + step;");
});

test("rust: 선언·속성·여는 괄호·수명 라벨 행은 프로파일을 거부한다", () => {
	const rejects = [
		"struct S {",
		"impl Display for S {",
		"enum Color {",
		"mod tests {",
		"fn main() {",
		"#[derive(Debug, Clone)]",
		"#![allow(dead_code)]",
		"macro_rules! vec_of {",
		"match value {",
		"let xs = vec![",
		"'a: loop {",
		"}",
	];
	for (const code of rejects) {
		expect(RUST_ALIGNER.profile(code, code)).toBeNull();
	}
});
