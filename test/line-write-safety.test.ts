import      {
              afterEach     ,
              describe      ,
              expect        ,
              test          ,
                              } from "bun:test"  ;
import      {
              chmodSync     ,
              linkSync      ,
              lstatSync     ,
              mkdirSync     ,
              mkdtempSync   ,
              readdirSync   ,
              readFileSync  ,
              rmSync        ,
              symlinkSync   ,
              writeFileSync ,
                              } from "node:fs"   ;
import      { tmpdir          } from "node:os"   ;
import      { join, resolve   } from "node:path" ;

const ROOT    = resolve(import.meta.dir, "..")                                     ;
const BUN     = process.execPath                                                   ;
const PYTHON  = Bun.which("python3")!                                              ;
const SCRIPT  = join(ROOT, "product/engine/python/06_align-tables.ts")             ;
const FIXTURE = readFileSync(join(ROOT, "test/fixtures/python/tables.py"), "utf8") ;

const workspaces: string[] = [];

function workspace(): string {
	const value = mkdtempSync(join(tmpdir(), "boxbox-line-write-"));
	workspaces.push(value);
	return value;
}

function leftovers(target: string): readonly string[] {
	return readdirSync(resolve(target, "..")).filter(name => name.includes("boxbox-stage") || name.includes("boxbox-write.lock"));
}

function run(target: string, args: readonly string[] = ["--write"], path = process.env.PATH): ReturnType<typeof Bun.spawnSync> {
	return Bun.spawnSync([BUN, SCRIPT, "--file", target, ...args], {
		cwd    : ROOT                           ,
		env    : { ...process.env, PATH: path } ,
		stderr : "pipe"                         ,
		stdout : "pipe"                         ,
	});
}

afterEach(() => {
	for (const value of workspaces.splice(0)) rmSync(value, { recursive: true, force: true });
});

describe("safe file replacement in the line-engine CLI", () => {
	test("read mode never changes the original, and write mode keeps the mode and cleanup contract", () => {
		const target = join(workspace(), "sample.py");
		writeFileSync(target, FIXTURE);
		chmodSync(target, 0o640);

		const check = run(target, []);
		expect(check.exitCode).toBe(1);
		expect(readFileSync(target, "utf8")).toBe(FIXTURE);

		const write = run(target);
		expect(write.exitCode                )    .toBe   (0      ) ;
		expect(readFileSync(target, "utf8")  ).not.toBe   (FIXTURE) ;
		expect(lstatSync(target).mode & 0o777)    .toBe   (0o640  ) ;
		expect(leftovers(target)             )    .toEqual([]     ) ;
	}, 60_000);

	test("--groups --write is exploration-only and never changes the original", () => {
		const target = join(workspace(), "groups.py");
		writeFileSync(target, FIXTURE);

		const result = run(target, ["--groups", "--write"]);
		expect(result.exitCode             ).toBe     (1              ) ;
		expect(result.stdout?.toString()   ).toContain("group-regions") ;
		expect(readFileSync(target, "utf8")).toBe     (FIXTURE        ) ;
	});

	test("refuses symbolic and hard link targets while preserving the original bytes", () => {
		const directory = workspace()                         ;
		const source    = join     (directory, "source.py"  ) ;
		const symbolic  = join     (directory, "symbolic.py") ;
		const hard      = join     (directory, "hard.py"    ) ;
		writeFileSync(source, FIXTURE);
		symlinkSync(source, symbolic);
		linkSync(source, hard);

		for (const target of [symbolic, hard]) {
			const result = run(target);
			expect(result.exitCode).not.toBe(0);
		}
		expect(readFileSync(source, "utf8")).toBe(FIXTURE);
		expect(leftovers(source)).toEqual([]);
	});

	test("an external edit during the parser run keeps the external bytes and refuses the commit", () => {
		const directory = workspace()                    ;
		const target    = join(directory, "external.py") ;
		const tools     = join(directory, "tools")       ;
		const python    = join(tools, "python3")         ;
		const external  = "external_edit = True\n"       ;
		mkdirSync(tools);
		writeFileSync(target, FIXTURE);
		writeFileSync(python, `#!${BUN}\nimport { readFileSync, writeFileSync } from "node:fs";\nif (process.argv.some(arg => arg.includes("BOXBOX_AST_EQUAL"))) writeFileSync(process.env.EDIT_TARGET, process.env.EDIT_TEXT);\nconst run = Bun.spawnSync([${JSON.stringify(PYTHON)}, ...process.argv.slice(2)], { stdin: readFileSync(0), stdout: "pipe", stderr: "pipe" });\nprocess.stdout.write(run.stdout); process.stderr.write(run.stderr); process.exit(run.exitCode);\n`);
		chmodSync(python, 0o755);

		const result = Bun.spawnSync([BUN, SCRIPT, "--file", target, "--write"], {
			cwd    : ROOT                                                                      ,
			env    : { ...process.env, PATH: tools, EDIT_TARGET: target, EDIT_TEXT: external } ,
			stderr : "pipe"                                                                    ,
			stdout : "pipe"                                                                    ,
		});

		expect(result.exitCode             ).not.toBe     (0                             ) ;
		expect(result.stderr?.toString()   )    .toContain("target changed before commit") ;
		expect(readFileSync(target, "utf8"))    .toBe     (external                      ) ;
		expect(leftovers(target)           )    .toEqual  ([]                            ) ;
	});
});


test("independent AST gate refuses a corrupted string candidate", () => {
	const target = join(workspace(), "corruption.py")        ;
	const source = 'a = "x = y"\nb = "x = y"\nc = "x = y"\n' ;
	writeFileSync(target, source);
	const program = `
		import { runAlignCli } from ${JSON.stringify(join(ROOT, "product/engine/common/align-cli.ts"))};
		const aligner = { language: "python", syntax: { lineComments: [], blockComments: [], strings: [] }, columnAxes: [], canonicalGaps: { equal: "", tail: "" },
			profile(code) { const match = /^([a-z] = "x)\\s+(=)\\s+(y")$/.exec(code); return match && { indent: "", slots: [{ axis: "head", text: match[1], gapBefore: "" }, { axis: "equal", text: match[2], gapBefore: " " }, { axis: "tail", text: match[3], gapBefore: " " }] }; } };
		const result = runAlignCli(aligner, ["--file", process.argv[1], "--write"]);
		console.log(result.report);
		process.exitCode = result.code;
	`;
	const result = Bun.spawnSync([BUN, "-e", program, target], { cwd: ROOT, stdout: "pipe", stderr: "pipe" });
	expect(result.exitCode             ).toBe     (1                   ) ;
	expect(result.stdout.toString()    ).toContain("Python AST differs") ;
	expect(readFileSync(target, "utf8")).toBe     (source              ) ;
	expect(leftovers(target)           ).toEqual  ([]                  ) ;
});

test("a formatted-string tokenizer fault refuses raw writing before any byte changes", () => {
	const directory = workspace()                               ;
	const target    = join(directory, "nested.py")              ;
	const empty     = join(directory, "empty")                  ;
	const source    = 'text = f"{1}"\na=1\nlonger=2\nthird=3\n' ;
	mkdirSync(empty);
	writeFileSync(target, source);
	const result = run(target, ["--write"], empty) ;
	const check  = run(target, ["--json" ], empty) ;

	expect(result.exitCode             ).not.toBe     (0                               ) ;
	expect(result.stderr?.toString()   )    .toContain("Python source analysis failed" ) ;
	expect(readFileSync(target, "utf8"))    .toBe     (source                          ) ;
	expect(leftovers(target)           )    .toEqual  ([]                              ) ;
	expect(check.exitCode              ).not.toBe     (0                               ) ;
	expect(check.stderr?.toString()    )    .toContain("Python source analysis failed" ) ;
});

test("invalid Python refuses a raw write with structured JSON and leaves bytes intact", () => {
	const target = join(workspace(), "invalid.py") ;
	const source = "a=1\nlonger=2\nthird=3\nif:\n" ;
	writeFileSync(target, source);
	const result = run(target, ["--write", "--json"]);
	expect(result.exitCode                                                    ).toBe(1        ) ;
	expect(JSON.parse(result.stdout?.toString() ?? "").results[0].parse.status).toBe("changed") ;
	expect(readFileSync(target, "utf8")                                       ).toBe(source   ) ;
});

test("invalid Python with formatted-string prefixes refuses with JSON and no staging residue", () => {
	for (const prefix of ["f", "F", "fr", "RF"]) {
		const target = join(workspace(), `${prefix}.py`)                    ;
		const source = `text=${prefix}"{1}"\na=1\nlonger=2\nthird=3\nif:\n` ;
		writeFileSync(target, source);
		const result = run(target, ["--write", "--json"]);
		expect(result.exitCode).toBe(1);
		const file = JSON.parse(result.stdout?.toString() ?? "").results[0];
		expect(file.parse.status           ).toBe   ("changed") ;
		expect(file.summary.edits          ).toBe   (0        ) ;
		expect(readFileSync(target, "utf8")).toBe   (source   ) ;
		expect(leftovers(target)           ).toEqual([]       ) ;
	}
});

test("raw check and groups report invalid formatted-string or false-prefix source as JSON", () => {
	for (const head of ['text=f"{1}"', 'text="a:t"']) {
		const target = join(workspace(), "invalid.py")          ;
		const source = `${head}\na=1\nlonger=2\nthird=3\nif:\n` ;
		writeFileSync(target, source);
		for (const args of [["--json"], ["--groups", "--json"]]) {
			const result = run(target, args);
			expect(result.exitCode).toBe(1);
			const file = JSON.parse(result.stdout?.toString() ?? "").results[0];
			expect(file.parse.status           ).toBe   ("changed") ;
			expect(file.summary.edits          ).toBe   (0        ) ;
			expect(readFileSync(target, "utf8")).toBe   (source   ) ;
			expect(leftovers(target)           ).toEqual([]       ) ;
		}
	}
});

test("raw check reports the actual interpreter's support for formatted-string syntax", () => {
	const python = Bun.which("python3");
	expect(python).not.toBeNull();
	const directory = workspace()                                               ;
	const target    = join(directory, "future.py")                              ;
	const source    = 'text = f"""{ """value""" }"""\na=1\nlonger=2\nthird=3\n' ;
	symlinkSync(python!, join(directory, "python3"));
	writeFileSync(target, source);
	const probe  = Bun.spawnSync([python!, "-I", "-c", "import ast,sys; ast.parse(sys.stdin.read())"], { stdin: Buffer.from(source), stdout: "pipe", stderr: "pipe" }) ;
	const result = run(target, ["--json"], directory)                                                                                                                  ;
	const parsed = JSON.parse(result.stdout?.toString() ?? "").results[0].parse.status                                                                                 ;
	expect(parsed                      ).toBe   (probe.exitCode === 0 ? "not-run" : "changed") ;
	expect(readFileSync(target, "utf8")).toBe   (source                                      ) ;
	expect(leftovers(target)           ).toEqual([]                                          ) ;
});
