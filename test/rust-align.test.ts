import      { expect, test        } from "bun:test"                                     ;
import      { defineLanguageSuite } from "./lang-harness.ts"                            ;
import      { maskSource          } from "../skills/xxx/scripts/common/code-text.ts"    ;
import      { alignSource         } from "../skills/xxx/scripts/common/table-engine.ts" ;
import      { RUST_ALIGNER        } from "../skills/xxx/scripts/rust/profile.ts"        ;

defineLanguageSuite({
	aligner     : RUST_ALIGNER,
	fixturesDir : new URL("../skills/xxx/fixtures/rust/", import.meta.url).pathname,
	tableFile   : "tables.rs",
	alignedFile : "tables.aligned.rs",
	trickyFile  : "tricky.rs",
});

test("rust: aligns match arm pattern and action columns at minimum width", () => {
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
	expect(lines[1]).toBe("    Read(n)    => n    ,") ;
	expect(lines[2]).toBe("    Write(n)   => n * 2,") ;
	expect(lines[3]).toBe("    Move(x, y) => x + y,") ;
});

test("rust: preserves type cells containing lifetimes", () => {
	const source = [
		`let a: &'static str = "x:y";`,
		`let b: &'a str = "y";`,
		`let c: &str = "z";`,
	].join("\n");
	const result = alignSource(source, RUST_ALIGNER, { minRows: 3, apply: true });
	const lines = result.output.split("\n");
	expect(lines[0]         ).toBe(`let a: &'static str = "x:y";`) ;
	expect(lines[1]         ).toBe(`let b: &'a str      = "y"  ;`) ;
	expect(lines[2]         ).toBe(`let c: &str         = "z"  ;`) ;
	expect(result.misaligned).toBe(2                             ) ;
});

test("rust: treats an enum variant's closed parenthesis pair as one cell", () => {
	const profile = RUST_ALIGNER.profile("    Move(i64, i64),", "    Move(i64, i64),");
	expect(profile?.slots.map(slot => slot.axis)).toEqual(["name", "paren", "comma"]);
	expect(profile?.slots[1].text).toBe("(i64, i64)");
});

test("rust: let mut rows align on the keyword axis together with name and value columns", () => {
	const profile = RUST_ALIGNER.profile("    let mut total: u64 = 0;", "    let mut total: u64 = 0;");
	expect(profile?.slots[0]).toEqual({ axis: "keyword", text: "let mut", gapBefore: "" });
	const source = [
		"let mut base = 10;",
		"let mut step  = 2;",
		"let mut total   = base + step;",
	].join("\n");
	const result = alignSource(source, RUST_ALIGNER, { minRows: 3, apply: true });
	const lines = result.output.split("\n");
	expect(lines[0]).toBe("let mut base  = 10         ;") ;
	expect(lines[1]).toBe("let mut step  = 2          ;") ;
	expect(lines[2]).toBe("let mut total = base + step;") ;
});

test("rust: the profile refuses declaration, attribute, opening-bracket and lifetime-label rows", () => {
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

test("rust: bundle rows align inner cell columns and the closing bracket shares the cell width", () => {
	const tuples = [
		"const TABLE: &[(&str, i32, &str)] = &[",
		`    ("alpha", 1, "x"),`,
		`    ("b", 333, "yy"),`,
		`    ("gamma", 22, "z"),`,
		"];",
	].join("\n");
	const tupleResult = alignSource(tuples, RUST_ALIGNER, { minRows: 3, apply: true });
	expect(tupleResult.tables).toBe(1);
	expect(tupleResult.details[0].axes).toEqual(["parenOpen", "cell", "comma", "arg", "comma", "arg", "parenClose"]);
	const tupleLines = tupleResult.output.split("\n");
	expect(tupleLines[1]).toBe(`    ("alpha", 1  , "x" ),`) ;
	expect(tupleLines[2]).toBe(`    ("b"    , 333, "yy"),`) ;
	expect(tupleLines[3]).toBe(`    ("gamma", 22 , "z" ),`) ;

	const grids = [
		"const GRID: [[u8; 3]; 3] = [",
		"    [1, 22],",
		"    [333, 4],",
		"    [55, 6666],",
		"];",
	].join("\n");
	const gridResult = alignSource(grids, RUST_ALIGNER, { minRows: 3, apply: true });
	expect(gridResult.tables).toBe(1);
	expect(gridResult.details[0].axes).toEqual(["bracketOpen", "cell", "comma", "arg", "bracketClose"]);
	const gridLines = gridResult.output.split("\n");
	expect(gridLines[1]).toBe("    [1  , 22  ],") ;
	expect(gridLines[2]).toBe("    [333, 4   ],") ;
	expect(gridLines[3]).toBe("    [55 , 6666],") ;
});

test("rust: the profile refuses nested or assigning bundle rows and path, lifetime or type-name cells", () => {
	const maskedOf = (code: string): string => maskSource(code, RUST_ALIGNER.syntax).text;
	for (const code of [
		`("a", ("b", 1)),`, // nested parentheses
		`("a", [1, 2]),`,   // nested brackets / slice type
		"(x = 1, y),",     // assignment
		"(a),",            // single cell
		"(a, ),",          // empty cell
		"('a, 1),",        // lifetime cell
		"(std::fmt, 1),",  // path cell
		"(u32, 1),",       // type-name cell
		"(&str, 1),",      // reference-type cell
		"[a, b),",         // mismatched bracket pair
	]) {
		expect(RUST_ALIGNER.profile(code, maskedOf(code))).toBeNull();
	}
});
