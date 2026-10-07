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

const ROOT    = resolve(import.meta.dir, "..")                                           ;
const BUN     = process.execPath                                                         ;
const SCRIPT  = join(ROOT, "skills/xxx/scripts/python/06_align-tables.ts")               ;
const FIXTURE = readFileSync(join(ROOT, "skills/xxx/fixtures/python/tables.py"), "utf8") ;

const workspaces: string[] = [];

function workspace(): string {
	const value = mkdtempSync(join(tmpdir(), "xxx-line-write-"));
	workspaces.push(value);
	return value;
}

function leftovers(target: string): readonly string[] {
	return readdirSync(resolve(target, "..")).filter(name => name.includes("xxx-stage") || name.includes("xxx-write.lock"));
}

function run(target: string, args: readonly string[] = ["--write"], path = process.env.PATH): ReturnType<typeof Bun.spawnSync> {
	return Bun.spawnSync([BUN, SCRIPT, "--file", target, ...args], {
		cwd    : ROOT,
		env    : { ...process.env, PATH: path },
		stderr : "pipe",
		stdout : "pipe",
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
		const directory = workspace()                    ;
		const source    = join(directory, "source.py")   ;
		const symbolic  = join(directory, "symbolic.py") ;
		const hard      = join(directory, "hard.py")     ;
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
		writeFileSync(python, `#!${BUN}\nimport { writeFileSync } from "node:fs";\nif (!process.argv.includes("--version")) writeFileSync(process.env.EDIT_TARGET, process.env.EDIT_TEXT);\nprocess.exit(0);\n`);
		chmodSync(python, 0o755);

		const result = Bun.spawnSync([BUN, SCRIPT, "--file", target, "--write"], {
			cwd    : ROOT,
			env    : { ...process.env, PATH: tools, EDIT_TARGET: target, EDIT_TEXT: external },
			stderr : "pipe",
			stdout : "pipe",
		});

		expect(result.exitCode             ).not.toBe     (0                             ) ;
		expect(result.stderr?.toString()   )    .toContain("target changed before commit") ;
		expect(readFileSync(target, "utf8"))    .toBe     (external                      ) ;
		expect(leftovers(target)           )    .toEqual  ([]                            ) ;
	});
});
