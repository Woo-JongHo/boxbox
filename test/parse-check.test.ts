import      { describe, expect, test                        } from "bun:test"                            ;
import      { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"                             ;
import      { tmpdir                                        } from "node:os"                             ;
import      { join, resolve                                 } from "node:path"                           ;
import      {
              compareParse                                ,
              comparePythonStructure                      ,
              parserAvailable                             ,
              syntaxDiagnostics
                                                            } from "@/common/08_parse-check.ts"          ;
import      { syntacticDiagnostics                          } from "@/typescript/15_load-source-file.ts" ;
import      { pythonStringRanges, PythonSourceSyntaxError   } from "@/python/07_string-ranges.ts"        ;

/** A valid snippet and a whitespace-free break of it, per language. */
const CASES: Readonly<Record<string, readonly [string, string]>> = {
	python     : ["a = 1\nb = 2\n"                , "a = 1\nb = = 2\n"               ] ,
};

describe("compareParse", () => {
	for (const [language, [valid, broken]] of Object.entries(CASES)) {
		test.skipIf(!parserAvailable(language))(`${language}: a parse-changing edit is detected and a whitespace edit is not`, () => {
			expect(compareParse(language, valid, broken).status               ).toBe("changed") ;
			expect(compareParse(language, valid, valid.replace(" = ", "   = ")).status).toBe("ok"     ) ;
		});
	}
});

describe("syntaxDiagnostics", () => {
	test("parses one input even when no comparison edit exists", () => {
		expect(syntaxDiagnostics("python", "pass\n").diagnostics).toEqual([]);
		expect(syntaxDiagnostics("python", "if:\n").diagnostics.length).toBeGreaterThan(0);
	});
});

test("invalid formatted-string input reports a classified syntax error rather than guessed ranges", () => {
	expect(() => pythonStringRanges('text=f"{1}"\nif:\n')).toThrow(PythonSourceSyntaxError);
});

describe("syntacticDiagnostics (TypeScript)", () => {
	test("reports parse errors by line and code, and none for valid code", async () => {
		const root = resolve(import.meta.dir, "..");
		const file = resolve(
			root                                ,
			"test/fixtures/table-kinds.ts"
		);
		expect(await syntacticDiagnostics(root, file, await Bun.file(file).text())).toEqual([]);
	});
});


describe("independent Python structure comparison", () => {
	test("detects valid string-content corruption while retaining the formatter syntax contract", () => {
		const source    = 'text = """\na = 1\nlonger = 2\nthird = 3\n"""\n' ;
		const corrupted = source.replace("a = 1", "a      = 1")             ;

		expect(syntaxDiagnostics("python", source).diagnostics   ).toEqual([]                       ) ;
		expect(syntaxDiagnostics("python", corrupted).diagnostics).toEqual([]                       ) ;
		expect(compareParse("python", source, corrupted).status  ).toBe   ("ok"                     ) ;
		expect(comparePythonStructure(source, corrupted).status  ).toBe   ("changed"                ) ;
		expect(comparePythonStructure("a=1\n", "a  = 1\n").status).toBe   ("ok"                     ) ;
		expect(compareParse("python", "pass\n", "a=1\n").status  ).toBe   ("ok"                     ) ;
		expect(comparePythonStructure("if:\n", "if:\n").status   ).toBe   ("changed"                ) ;
	});

	test("nested formatted strings receive the actual interpreter's syntax result", () => {
		const source      = 'text = f"""{ """\na = 1\nlonger = 2\nthird = 3\n""" }"""\n' ;
		const corrupted   = source.replace("a = 1", "a      = 1")                        ;
		const diagnostics = syntaxDiagnostics("python", source).diagnostics              ;
		const result      = comparePythonStructure(source, corrupted)                    ;
		expect(result.status).toBe("changed");
		expect(result.delta).toEqual([diagnostics.length === 0 ? "Python AST differs" : "Python source is invalid"]);
	});

	test("valid escape warnings do not reject structure or formatted-string ranges", () => {
		const source = 'PAT = "\\d+"\ntext = f"{1}"\n';
		expect(comparePythonStructure(source, source.replace("PAT =", "PAT  =")).status).toBe("ok");
		expect(pythonStringRanges(source)).toHaveLength(1);
	});
});

test("structure markers accept CRLF without accepting unrelated output", () => {
	const root = mkdtempSync(join(tmpdir(), "boxbox-crlf-parser-"));
	try {
		const executable = join(root, "python3");
		writeFileSync(executable, `#!${process.execPath}\nif (!process.argv.includes("--version")) process.stdout.write("BOXBOX_AST_EQUAL\\r\\n");\n`);
		chmodSync(executable, 0o755);
		const module  = join(import.meta.dir, "../product/engine/common/08_parse-check.ts")                                                             ;
		const program = `import { comparePythonStructure } from ${JSON.stringify(module)}; console.log(comparePythonStructure("a=1", "a = 1").status);` ;
		const result  = Bun.spawnSync([process.execPath, "-e", program], { env: { ...process.env, PATH: root }, stdout: "pipe", stderr: "pipe" })       ;
		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString().trim()).toBe("ok");
	} finally { rmSync(root, { recursive: true, force: true }); }
});

test("Python warning overrides do not turn helper parsing into syntax errors", () => {
	const parseModule = join(import.meta.dir, "../product/engine/common/08_parse-check.ts")                                                                                                                                                                                                                                                ;
	const rangeModule = join(import.meta.dir, "../product/engine/python/07_string-ranges.ts")                                                                                                                                                                                                                                              ;
	const program     = `import { comparePythonStructure } from ${JSON.stringify(parseModule)}; import { pythonStringRanges } from ${JSON.stringify(rangeModule)}; const s = ${JSON.stringify('PAT = "\\d+"\ntext = f"{1}"\n')}; if (comparePythonStructure(s, s).status !== "ok" || pythonStringRanges(s).length !== 1) process.exit(7);` ;
	const result      = Bun.spawnSync([process.execPath, "-e", program], { env: { ...process.env, PYTHONWARNINGS: "error" }, stdout: "pipe", stderr: "pipe" })                                                                                                                                                                             ;
	expect(result.exitCode).toBe(0);
});

test("the available Python interpreter protects formatted-string prefixes", () => {
	const python = Bun.which("python3");
	expect(python).not.toBeNull();
	const root = mkdtempSync(join(tmpdir(), "boxbox-python39-"));
	try {
		const { symlinkSync } = require("node:fs");
		symlinkSync(python!, join(root, "python3"));
		const module  = join(import.meta.dir, "../product/engine/python/07_string-ranges.ts")                                                                                                                        ;
		const program = `import { pythonStringRanges } from ${JSON.stringify(module)}; for (const p of ["F", "FR", "RF", "rF", "Fr"]) if (pythonStringRanges('x = ' + p + '\"{1}\"').length !== 1) process.exit(7);` ;
		const result  = Bun.spawnSync([process.execPath, "-e", program], { env: { ...process.env, PATH: root }, stdout: "pipe", stderr: "pipe" })                                                                    ;
		expect(result.exitCode).toBe(0);
	} finally { rmSync(root, { recursive: true, force: true }); }
});


for (const [mode, body] of [
	["empty", "process.exit(0);"],
	["failure", "process.exit(9);"],
	["signal", 'process.kill(process.pid, "SIGTERM");'],
	["timeout", "setInterval(() => {}, 1000);"],
	["output", 'process.stdout.write("x".repeat(2_000_000));'],
] as const) test(`Python token and structure parsers close on ${mode}`, () => {
	const root = mkdtempSync(join(tmpdir(), "boxbox-string-parser-fault-"));
	try {
		const executable = join(root, "python3");
		writeFileSync(executable, `#!${process.execPath}\nif (process.argv.includes("--version")) process.exit(0);\n${body}\n`);
		chmodSync(executable, 0o755);
		for (const [module, call] of [
			["../product/engine/python/07_string-ranges.ts", String.raw`pythonStringRanges('text = f"{1}"\n', 500)`],
			["../product/engine/common/08_parse-check.ts", 'comparePythonStructure("a=1\\n", "a = 1\\n", { timeoutMs: 500 })'],
		]) {
			const name    = module.includes("string-ranges") ? "pythonStringRanges" : "comparePythonStructure"                                                                           ;
			const program = `import { ${name} } from ${JSON.stringify(join(import.meta.dir, module))}; try { ${call}; } catch(error) { console.error(error.message); process.exit(7); }` ;
			const result = Bun.spawnSync([process.execPath, "-e", program], {
				env: { ...process.env, PATH: root }, stdout: "pipe", stderr: "pipe", timeout: 5_000,
			});

			expect(result.exitCode).toBe(7);
			expect(result.stderr.toString()).toMatch(/Python (?:source analysis|structure parser)/u);
		}
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("ordinary Python masking never requires a tokenizer process for identifier suffixes", () => {
	const module  = join(import.meta.dir, "../product/engine/python/07_string-ranges.ts")                                                             ;
	const program = `import { pythonStringRanges } from ${JSON.stringify(module)}; console.log(JSON.stringify(pythonStringRanges("flag='off'\\n")));` ;
	const result  = Bun.spawnSync([process.execPath, "-e", program], { env: { ...process.env, PATH: "" }, stdout: "pipe", stderr: "pipe" })           ;

	expect(result.exitCode).toBe(0);
	expect(result.stdout.toString().trim()).toBe("[]");
});

test("Python NUL input is a syntax diagnostic and an invalid AST", () => {
	const source = "a=1\n\u0000\n";
	expect(syntaxDiagnostics("python", source).diagnostics.join("\n")).toContain("error:");
	expect(comparePythonStructure(source, "a=1\n").status).toBe("changed");
});

test("a non-NUL AST failure stays a tool error even if the other source contains NUL", () => {
	const root = mkdtempSync(join(tmpdir(), "boxbox-ast-value-error-"));
	try {
		const executable = join     (root, "python3") ;
		const python     = Bun.which("python3"      ) ;
		expect(python).not.toBeNull();
		const wrapper = `#!${process.execPath}\nimport { readFileSync } from "node:fs";\nconst args=process.argv.slice(2).map(arg => arg.replace("left=normalized(before)", "raise ValueError('synthetic-non-nul')"));\nconst child=Bun.spawnSync([${JSON.stringify(python)},...args],{stdin:readFileSync(0),stdout:"pipe",stderr:"pipe"}); process.stdout.write(child.stdout); process.stderr.write(child.stderr); process.exit(child.exitCode);\n`;
		writeFileSync(executable, wrapper);
		chmodSync(executable, 0o755);
		const module  = join(import.meta.dir, "../product/engine/common/08_parse-check.ts")                                                                                                                                                 ;
		const program = `import { comparePythonStructure } from ${JSON.stringify(module)}; try { comparePythonStructure("a=1\\n", "a=1\\n\\u0000\\n"); process.exit(5); } catch (error) { console.error(error.message); process.exit(7); }` ;
		const result  = Bun.spawnSync([process.execPath, "-e", program], { env: { ...process.env, PATH: root }, stdout: "pipe", stderr: "pipe" })                                                                                           ;
		expect(result.exitCode).toBe(7);
		expect(result.stderr.toString()).toContain("synthetic-non-nul");
	} finally { rmSync(root, { recursive: true, force: true }); }
});
