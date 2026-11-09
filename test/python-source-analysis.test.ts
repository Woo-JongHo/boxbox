import      { describe, expect, test  } from "bun:test"                    ;
import      {
              chmodSync             ,
              mkdtempSync           ,
              readFileSync          ,
              rmSync                ,
              writeFileSync
                                      } from "node:fs"                     ;
import      { tmpdir                  } from "node:os"                     ;
import      { join, resolve           } from "node:path"                   ;
import      { alignSource             } from "@/common/table-engine.ts"    ;
import      { PYTHON_ALIGNER          } from "@/python/profile.ts"         ;
import      { analyzePython           } from "@/python/analysis.ts"        ;
import      { PYTHON_ANALYSIS_SCRIPT  } from "@/python/analysis-script.ts" ;
import      { PythonSourceSyntaxError } from "@/python/string-ranges.ts"   ;

const align = (source: string) => alignSource(source, PYTHON_ALIGNER, { minRows: 3, apply: true });

describe("Python source analysis", () => {
	test("default-only parameters retain their real parameter owner", () => {
		const result = align("def f(\n a=1,\n longer=2,\n mid=3,\n):\n pass\n");
		expect(result.tables).toBe(1);
		expect(result.output).toContain(" a      = 1,\n longer = 2,\n mid    = 3,");
	});

	test("does not inspect AST rows inside opaque multiline formatted replacements", () => {
		const source   = 'data = {}\nmessage = f"""\n header\n {json.dumps(data, indent=2)}"""\n' ;
		const analysis = analyzePython(source)                                                    ;
		expect(analysis.rows.every(row => row.kind !== "keyword")).toBe(true);
	});
	test("rejects invalid files even without a candidate and keeps format errors distinct", () => {
		expect(() => align("if:\n")        ).toThrow(PythonSourceSyntaxError) ;
		expect(() => align("a = 1\rb = 2") ).toThrow("line endings"         ) ;
		expect(() => align("\uFEFFa = 1\n")).toThrow("encoding"             ) ;
	});

	test("recognizes only a real parameter or keyword container", () => {
		const source = "def first(\n a: int,\n b: int,\n c: int,\n):\n pass\ndef second(\n d: int,\n e: int,\n f: int,\n):\n pass\n" ;
		const result = align(source)                                                                                                 ;
		expect(result.details.map(table => [table.startLine, table.endLine])).toEqual([[2, 4], [8, 10]]);
	});

	test("keeps positional and keyword-only rows together through their own markers", () => {
		const source = "def f(\n a: int,\n /,\n bb: str,\n *,\n ccc: int,\n):\n pass\n";
		expect(align(source).details.map(table => [table.startLine, table.endLine, table.rows])).toEqual([[2, 6, 3]]);
	});

	test("protects original formatted text and rejects a changed token or removed comment", () => {
		const source  = 'x = f"{{{value}}}" # comment\r\n' ;
		const context = analyzePython(source)              ;
		expect(context.unsafeEditLines([{ index: 0, after: 'x  = f"{{{value}}}" # comment\r' }])).toEqual([] ) ;
		expect(context.unsafeEditLines([{ index: 0, after: 'x  = f"{{{other}}}" # comment\r' }])).toEqual([0]) ;
		expect(context.unsafeEditLines([{ index: 0, after: 'x  = f"{{{value}}}"\r' }]          )).toEqual([0]) ;
	});

	test("preserves Python comment bytes while legacy profiles retain their existing behavior", () => {
		const source   = "a=1 # one  \nlonger=2 # two  \nthird=3 # three  \n"                                              ;
		const prepared = align(source)                                                                                     ;
		const legacy   = alignSource(source, { ...PYTHON_ALIGNER, prepareSource: undefined }, { minRows: 3, apply: true }) ;
		expect(prepared.tables             ).toBe     (1                                                               ) ;
		expect(prepared.refused            ).toEqual  ([]                                                              ) ;
		expect(prepared.output             ).toBe     ("a      = 1 # one  \nlonger = 2 # two  \nthird  = 3 # three  \n") ;
		expect(legacy.output.split("\n")[0]).toEndWith("# one"                                                         ) ;
	});

	test("starts one analysis process for multiple tables", () => {
		const root = mkdtempSync(join(tmpdir(), "boxbox-analyzer-count-"));
		try {
			const count      = join(root, "count")                                                                                                                                                                                                                                                                                                                                                                            ;
			const executable = join(root, "python3")                                                                                                                                                                                                                                                                                                                                                                          ;
			const python     = Bun.which("python3")!                                                                                                                                                                                                                                                                                                                                                                          ;
			const script     = `#!${process.execPath}\nimport { appendFileSync, readFileSync } from "node:fs";\nappendFileSync(${JSON.stringify(count)}, "x");\nconst result = Bun.spawnSync([${JSON.stringify(python)}, ...process.argv.slice(2)], { stdin: readFileSync(0), stdout: "pipe", stderr: "pipe" });\nprocess.stdout.write(result.stdout); process.stderr.write(result.stderr); process.exit(result.exitCode);\n` ;
			writeFileSync(executable, script);
			chmodSync(executable, 0o755);
			const module  = resolve("product/engine/python/profile.ts")                                                                                                                                                                                                                                                  ;
			const engine  = resolve("product/engine/common/table-engine.ts")                                                                                                                                                                                                                                             ;
			const program = `import { PYTHON_ALIGNER } from ${JSON.stringify(module)}; import { alignSource } from ${JSON.stringify(engine)}; const result = alignSource("a=1\\nlonger=2\\nthird=3\\n\\nx=1\\nyy=2\\nzzz=3\\n", PYTHON_ALIGNER, { minRows: 3, apply: true }); if (result.tables !== 2) process.exit(2);` ;
			const run     = Bun.spawnSync([process.execPath, "-e", program], { env: { ...process.env, PATH: root }, stdout: "pipe", stderr: "pipe" })                                                                                                                                                                    ;
			expect(run.exitCode).toBe(0);
			expect(readFileSync(count, "utf8")).toBe("x");
		} finally { rmSync(root, { recursive: true, force: true }); }
	});

	test("uses UTF-8 AST and code-point token columns independently with non-BMP text", () => {
		const source  = 'é = "😀"\nlonger = 2\nthird = 3\n' ;
		const context = analyzePython(source)              ;
		expect(context.rows.filter(row => row.kind === "statement")).toHaveLength(3);
		expect(context.tokens.map(token => source.slice(token.start, token.end))).toContain('"😀"');
	});
});

test("NUL input is parser-confirmed invalid and never produces rows", () => {
	expect(() => align("a=1\n\u0000\n")).toThrow(PythonSourceSyntaxError);
});

test("unrelated parser ValueError remains a tool failure", () => {
	const python = Bun.which("python3");
	expect(python).not.toBeNull();
	const altered = PYTHON_ANALYSIS_SCRIPT.replace  ("tree=ast.parse(s)", "raise ValueError('synthetic-non-nul')"                                   ) ;
	const child   = Bun                   .spawnSync([python!, "-I", "-c", altered], { stdin: Buffer.from("a=1\n"), stdout: "pipe", stderr: "pipe" }) ;
	expect(child.exitCode         ).not.toBe     (0                  ) ;
	expect(child.stderr.toString())    .toContain("synthetic-non-nul") ;
	expect(child.stdout.toString()).not.toContain("syntax-invalid"   ) ;
});

test("source token index checks each edited line and preserves every formatted literal", () => {
	const lines    = Array.from({ length: 1000 }, (_, index) => `value${index}=f"item${index}"`) ;
	const source   = lines.join("\n") + "\n"                                                     ;
	const analysis = analyzePython(source)                                                       ;
	const edits    = lines.map((line, index) => ({ index, after: line.replace("=", " = ") }))    ;
	expect(analysis.unsafeEditLines(edits)).toEqual([]);
	const corrupt = edits.map(edit => edit.index === 500 ? { ...edit, after: edit.after.replace("item500", "itemBAD") } : edit);
	expect(analysis.unsafeEditLines(corrupt)).toEqual([500]);
});

test("source token protocol refuses a token crossing a formatted range", () => {
	const root = mkdtempSync(join(tmpdir(), "boxbox-overlap-"));
	try {
		const executable = join(root, "python3")                                                                                                                                   ;
		const reply      = { version: 1, status: "ok", sourceLength: 4, pythonVersion: [3, 14, 2], owners: [], rows: [], multiline: [], tokens: [[1, 0, 4]], formatted: [[1, 3]] } ;
		writeFileSync(executable, `#!${process.execPath}\nconsole.log(${JSON.stringify(JSON.stringify(reply))});\n`);
		chmodSync(executable, 0o755);
		const module  = resolve("product/engine/python/analysis.ts")                                                                                                                               ;
		const program = `import { analyzePython } from ${JSON.stringify(module)}; try { analyzePython("abcd"); process.exit(5); } catch(error) { console.error(error.message); process.exit(7); }` ;
		const result  = Bun.spawnSync([process.execPath, "-e", program], { env: { ...process.env, PATH: root }, stdout: "pipe", stderr: "pipe" })                                                  ;
		expect(result.exitCode).toBe(7);
		expect(result.stderr.toString()).toContain("Python source analysis returned an invalid response");
	} finally { rmSync(root, { recursive: true, force: true }); }
});

test("source analysis refuses an older interpreter instead of silently dropping its rows", () => {
	const root = mkdtempSync(join(tmpdir(), "boxbox-old-python-"));
	try {
		const executable = join(root, "python3")                                                                                                                    ;
		const reply      = { version: 1, status: "ok", sourceLength: 4, pythonVersion: [3, 8, 18], owners: [], rows: [], multiline: [], tokens: [], formatted: [] } ;
		writeFileSync(executable, `#!${process.execPath}\nconsole.log(${JSON.stringify(JSON.stringify(reply))});\n`);
		chmodSync(executable, 0o755);
		const module  = resolve("product/engine/python/analysis.ts")                                                                                                                               ;
		const program = `import { analyzePython } from ${JSON.stringify(module)}; try { analyzePython("pass"); process.exit(5); } catch(error) { console.error(error.message); process.exit(7); }` ;
		const result  = Bun.spawnSync([process.execPath, "-e", program], { env: { ...process.env, PATH: root }, stdout: "pipe", stderr: "pipe" })                                                  ;
		expect(result.exitCode).toBe(7);
		expect(result.stderr.toString()).toContain("requires Python 3.9 or newer");
	} finally { rmSync(root, { recursive: true, force: true }); }
});
