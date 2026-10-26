import      { afterEach, describe, expect, test                } from "bun:test"  ;
import      { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"   ;
import      { join, relative, resolve                          } from "node:path" ;

const root                 = resolve(import.meta.dir, "..")                                   ;
const script               = resolve(root, "product/engine/typescript/07_wrap-conditions.ts") ;
const workspaces: string[] = []                                                               ;

function target(text: string, name = "sample.ts"): string {
	const directory = mkdtempSync(join(import.meta.dir, "boxbox-wrap-")) ;
	const file      = join       (directory, name                      ) ;
	workspaces.push(directory);
	writeFileSync(file, text);
	return file;
}

function wrap(file: string, ...options: string[]): ReturnType<typeof Bun.spawnSync> {
	return Bun.spawnSync(["bun", script, "--file", relative(root, file), "--write", ...options], { cwd: root, stderr: "pipe", stdout: "pipe" });
}

function execute(file: string): string {
	const result = Bun.spawnSync(["bun", file], { cwd: root, stderr: "pipe", stdout: "pipe" });
	expect(result.exitCode).toBe(0);
	return result.stdout.toString();
}

function whitespaceOnlyLines(text: string): readonly number[] {
	return text.split(/\r?\n/u).flatMap((line, index) => /^[ \t]+$/u.test(line) ? [index + 1] : []);
}

afterEach(() => {
	for (const directory of workspaces.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("condition authoring preservation", () => {
	test("preserves short-circuit order and early stop", () => {
		const file = target([
			"const calls: string[] = [];",
			"const probe = (name: string, value: boolean): boolean => { calls.push(name); return value; };",
			"if (probe(\"a\", true) && probe(\"b\", false) && probe(\"c\", true) && probe(\"d\", true)) calls.push(\"body\");",
			"console.log(calls.join(\",\"));",
		].join("\n") + "\n");
		const before = execute(file);

		const result = wrap(file);

		expect(result.exitCode           ).toBe     (0       ) ;
		expect(execute(file)             ).toBe     (before  ) ;
		expect(before                    ).toBe     ("a,b\n" ) ;
		expect(readFileSync(file, "utf8")).toContain("if (\n") ;
	}, 30_000);

	test("keeps existing parenthesized operands and adds no brackets around return or variable expressions", () => {
		const file = target([
			"declare const a: boolean, b: boolean, c: boolean, d: boolean, e: boolean;",
			"const value = (a || b) && c && d && e;",
			"function check(): boolean { return (a || b) && c && d && e; }",
		].join("\n") + "\n");

		expect(wrap(file).exitCode).toBe(0);
		const output = readFileSync(file, "utf8");
		expect(output)    .toContain("const value =    (a || b)\n") ;
		expect(output)    .toContain("return    (a || b)\n"       ) ;
		expect(output).not.toContain("const value = (\n"          ) ;
		expect(output).not.toContain("return (\n"                 ) ;
	});

	test("keeps return continuation ASI-safe without adding grouping parentheses", () => {
		const file = target([
			"const calls: string[] = [];",
			"const probe = (name: string, value: boolean): boolean => { calls.push(name); return value; };",
			"function check(): boolean { return probe(\"a\", true) && probe(\"b\", false) && probe(\"c\", true) && probe(\"d\", true); }",
			"console.log(check(), calls.join(\",\"));",
		].join("\n") + "\n");

		expect(wrap(file).exitCode       )    .toBe     (0                ) ;
		expect(readFileSync(file, "utf8"))    .toContain("return    probe") ;
		expect(readFileSync(file, "utf8")).not.toContain("return (\n"     ) ;
		expect(execute(file)             )    .toBe     ("false a,b\n"    ) ;
	}, 30_000);

	test("refuses ungrouped mixed operators and table-row arrows without changing the original bytes", () => {
		for (const source of [
			"const value = a && b || c && d;\n",
			"const rows = [{ value: () => a && b && c && d }];\n",
		]) {
			const file   = target(source) ;
			const result = wrap  (file  ) ;
			expect(result.exitCode           ).toBe     (1       ) ;
			expect(result.stdout?.toString() ).toContain("refuse") ;
			expect(readFileSync(file, "utf8")).toBe     (source  ) ;
		}
	});

	test("preserves block and trailing line comments byte-for-byte", () => {
		const source = "if (a /* one */ && b && /* two */ c && d) run(); // trailing note\n" ;
		const file   = target(source)                                                        ;

		expect(wrap(file).exitCode).toBe(0);
		const output = readFileSync(file, "utf8");
		expect(output).toContain("a /* one */\n"   ) ;
		expect(output).toContain("&& /* two */ c"  ) ;
		expect(output).toContain("// trailing note") ;
	});

	test("reuses multiline if trivia when moving trailing operators to the leading form", () => {
		const source = [
			"declare const alpha: boolean;",
			"declare const beta: boolean;",
			"declare const gamma: boolean;",
			"declare const delta: boolean;",
			"",
			"if (",
			"\talpha &&",
			"\tbeta &&",
			"\tgamma &&",
			"\tdelta",
			") run();",
		].join("\n") + "\n";
		const file = target(source);

		expect(wrap(file).exitCode).toBe(0);
		const once = readFileSync(file);
		expect(once.toString()                     ).toContain("if (\n\t   alpha\n\t&& beta\n\t&& gamma\n\t&& delta\n) run();") ;
		expect(whitespaceOnlyLines(once.toString())).toEqual  ([]                                                             ) ;
		expect(wrap(file).exitCode                 ).toBe     (0                                                              ) ;
		expect(readFileSync(file).equals(once)     ).toBe     (true                                                           ) ;
	});

	test("keeps an already-leading multiline if byte-identical", () => {
		const source = "if (\n\t   alpha\n\t|| beta\n\t|| gamma\n\t|| delta\n) run();\n" ;
		const file   = target(source)                                                    ;

		expect(wrap(file).exitCode        ).toBe   (0     ) ;
		expect(readFileSync(file, "utf8") ).toBe   (source) ;
		expect(whitespaceOnlyLines(source)).toEqual([]    ) ;
	});

	test("reuses CRLF and tab-indented multiline if trivia without blank padding", () => {
		const source = "function run(): void {\r\n\tif (\r\n\t\talpha ||\r\n\t\tbeta ||\r\n\t\tgamma ||\r\n\t\tdelta\r\n\t) call();\r\n}\r\n" ;
		const file   = target(source)                                                                                                         ;

		expect(wrap(file).exitCode).toBe(0);
		const once = readFileSync(file);
		expect(once.toString()                       )    .toContain("\tif (\r\n\t\t   alpha\r\n\t\t|| beta\r\n\t\t|| gamma\r\n\t\t|| delta\r\n\t) call();") ;
		expect(once.toString().replaceAll("\r\n", "")).not.toContain("\n"                                                                                  ) ;
		expect(whitespaceOnlyLines(once.toString())  )    .toEqual  ([]                                                                                    ) ;
		expect(wrap(file).exitCode                   )    .toBe     (0                                                                                     ) ;
		expect(readFileSync(file).equals(once)       )    .toBe     (true                                                                                  ) ;
	});

	test("refuses a line comment between an operator and its operand without changing bytes", () => {
		const source = "const value = a && // keep attachment\n              b && c && d;\n" ;
		const file   = target(source)                                                        ;

		expect(wrap(file).exitCode).toBe(1);
		expect(readFileSync(file, "utf8")).toBe(source);
	});

	test("keeps comparison operators indivisible, aligns one unary slot and leaves double negation opaque", () => {
		const file = target("const value = a !== b && !c && !!d && e != f;\n");

		expect(wrap(file).exitCode).toBe(0);
		const output = readFileSync(file, "utf8");
		expect(output).toContain("a !== b") ;
		expect(output).toContain("&& !c"  ) ;
		expect(output).toContain("&&  !!d") ;
		expect(output).toContain("e != f" ) ;
	});

	test("preserves tabs, CJK source text and CRLF newlines", () => {
		const source = "function check(): boolean {\r\n\tconst 결과 = 첫째 && 둘째 && 셋째 && 넷째;\r\n\treturn 결과;\r\n}\r\n" ; // cjk-test-data
		const file   = target(source)                                                                                           ;

		expect(wrap(file).exitCode).toBe(0);
		const output = readFileSync(file, "utf8");
		expect(output                       )    .toContain("결과"                      ) ; // cjk-test-data
		expect(output.replaceAll("\r\n", "")).not.toContain("\n"                        ) ;
		expect(output                       )    .toContain("\tconst 결과 =    첫째\r\n") ; // cjk-test-data
	});

	test("canonicalizes trailing operators once and then reaches a byte-identical fixed point", () => {
		const file = target("const value = a &&\n              b &&\n              c &&\n              d;\n");

		expect(wrap(file).exitCode).toBe(0);
		const once = readFileSync(file);
		expect(once.toString()                ).toContain("const value =    a\n              && b\n") ;
		expect(wrap(file).exitCode            ).toBe     (0                                         ) ;
		expect(readFileSync(file).equals(once)).toBe     (true                                      ) ;
	});

	test("supports the documented minimum of three conditions", () => {
		const file = target("const value = a && b && c;\n");

		expect(wrap(file, "--min-conditions", "3").exitCode).toBe(0);
		expect(readFileSync(file, "utf8")).toContain("&& c");
	});
});
