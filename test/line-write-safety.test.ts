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

describe("라인 엔진 CLI의 안전한 파일 교체", () => {
	test("읽기 모드는 원본을 바꾸지 않고 쓰기 모드는 mode와 정리 계약을 지킨다", () => {
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

	test("--groups --write는 탐색 전용으로 원본을 바꾸지 않는다", () => {
		const target = join(workspace(), "groups.py");
		writeFileSync(target, FIXTURE);

		const result = run(target, ["--groups", "--write"]);
		expect(result.exitCode             ).toBe     (1              ) ;
		expect(result.stdout?.toString()   ).toContain("group-regions") ;
		expect(readFileSync(target, "utf8")).toBe     (FIXTURE        ) ;
	});

	test("symbolic link와 hard link 대상은 원본 bytes를 보존하며 거절한다", () => {
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

	test("parser 실행 중 외부 편집이 생기면 외부 bytes를 보존하고 commit을 거절한다", () => {
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
