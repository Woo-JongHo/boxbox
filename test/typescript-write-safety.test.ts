import      { afterEach, describe, expect, test              } from "bun:test"              ;
import      {
              chmodSync                                    ,
              linkSync                                     ,
              lstatSync                                    ,
              mkdtempSync                                  ,
              readdirSync                                  ,
              readFileSync                                 ,
              rmSync                                       ,
              symlinkSync                                  ,
              writeFileSync                                ,
                                                             } from "node:fs"               ;
import      { join, relative, resolve                        } from "node:path"             ;

import      { updateFileAtomically, updateFileAtomicallySync } from "@/common/safe-file.ts" ;
import      { runStagedPasses, writeDiagnosedOutput          } from "@/typescript/align.ts" ;

const root                 = resolve(import.meta.dir, "..")                                    ;
const script               = resolve(root, "skills/xxx/scripts/typescript/06_align-tables.ts") ;
const workspaces: string[] = []                                                                ;

function workspace(): string {
	const value = mkdtempSync(join(import.meta.dir, "xxx-ts-write-"));
	workspaces.push(value);
	return value;
}

function targetWith(text = "original\n"): string {
	const target = join(workspace(), "sample.ts");
	writeFileSync(target, text);
	return target;
}

function leftovers(target: string): readonly string[] {
	return readdirSync(resolve(target, "..")).filter(name => name.includes("xxx-stage") || name.includes("xxx-write.lock"));
}

afterEach(() => {
	for (const value of workspaces.splice(0)) rmSync(value, { recursive: true, force: true });
});

describe("원자적 파일 교체 helper", () => {
	test("성공할 때 mode를 보존하고 임시 파일을 정리한다", async () => {
		const target = targetWith();
		chmodSync(target, 0o640);

		await updateFileAtomically(target, async ({ working }) => { writeFileSync(working, "updated\n"); });

		expect(readFileSync(target, "utf8")  ).toBe   ("updated\n") ;
		expect(lstatSync(target).mode & 0o777).toBe   (0o640      ) ;
		expect(leftovers(target)             ).toEqual([]         ) ;
	});

	test("동기 진입점도 같은 commit과 정리 계약을 쓴다", () => {
		const target = targetWith();

		const changed = updateFileAtomicallySync(target, ({ working }) => { writeFileSync(working, "sync\n"); });

		expect(changed                     ).toBe   (true    ) ;
		expect(readFileSync(target, "utf8")).toBe   ("sync\n") ;
		expect(leftovers(target)           ).toEqual([]      ) ;
	});

	test("외부 편집을 발견하면 그 편집을 유지하고 commit을 거절한다", async () => {
		const target = targetWith();

		await expect(updateFileAtomically(target, async ({ working }) => {
			writeFileSync(working, "staged\n");
			writeFileSync(target, "external\n");
		})).rejects.toThrow("target changed before commit");

		expect(readFileSync(target, "utf8")).toBe("external\n") ;
		expect(leftovers(target)           ).toEqual([])         ;
	});

	test("rename 실패에서 원본과 임시 파일 정리를 보존한다", async () => {
		const target = targetWith();

		await expect(updateFileAtomically(target, async ({ working }) => { writeFileSync(working, "staged\n"); }, {
			rename: () => { throw new Error("injected rename failure"); },
		})).rejects.toThrow("injected rename failure");

		expect(readFileSync(target, "utf8")).toBe("original\n") ;
		expect(leftovers(target)           ).toEqual([])         ;
	});

	test("symbolic link와 hard link 대상은 보수적으로 거절한다", async () => {
		const directory = workspace()                    ;
		const source    = join(directory, "source.ts")   ;
		const symbolic  = join(directory, "symbolic.ts") ;
		const hard      = join(directory, "hard.ts")     ;
		writeFileSync(source, "source\n");
		symlinkSync(source, symbolic);
		linkSync(source, hard);

		await expect(updateFileAtomically(symbolic, async () => {})).rejects.toThrow("symbolic link");
		await expect(updateFileAtomically(hard, async () => {})).rejects.toThrow("multiply-linked");
		expect(readFileSync(source, "utf8")).toBe("source\n");
	});
});

describe("TS 다중 pass 작업본", () => {
	for (const [name, operation] of [
		["later pass 예외", async (working: string) => runStagedPasses(working, { apply: async (_path, pass) => { writeFileSync(working, `pass-${pass}\n`); if (pass === 2) throw new Error("later pass failure"); return true; }, verify: async () => false })],
		["parser throw", async (working: string) => writeDiagnosedOutput(working, "original\n", "staged\n", async text => { if (text === "staged\n") throw new Error("parser throw"); return []; })],
		["diagnostic mismatch", async (working: string) => writeDiagnosedOutput(working, "original\n", "staged\n", async text => text === "original\n" ? [] : ["1:1005"])],
		["non-convergence", async (working: string) => runStagedPasses(working, { apply: async () => { writeFileSync(working, `${readFileSync(working, "utf8")}x`); return true; }, verify: async () => false }, 3)],
	] as const) test(`${name} 때 최초 원본을 바꾸지 않는다`, async () => {
		const target = targetWith();

		await expect(updateFileAtomically(target, async ({ working }) => { await operation(working); })).rejects.toThrow();

		expect(readFileSync(target, "utf8")).toBe("original\n") ;
		expect(leftovers(target)           ).toEqual([])         ;
	});

	test("실제 CLI 성공 뒤 재실행해도 byte-identical이다", () => {
		const target = targetWith([
			"const short = make(1);",
			"const muchLonger = make(22);",
			"const middle = make(333);",
		].join("\n") + "\n");
		const file = relative(root, target);

		const first   = Bun.spawnSync(["bun", script, "--file", file, "--write"], { cwd: root, stderr: "pipe", stdout: "pipe" }) ;
		const aligned = readFileSync(target)                                                                                     ;
		const second  = Bun.spawnSync(["bun", script, "--file", file, "--write"], { cwd: root, stderr: "pipe", stdout: "pipe" }) ;

		expect(first.exitCode                      ).toBe   (0   ) ;
		expect(second.exitCode                     ).toBe   (0   ) ;
		expect(readFileSync(target).equals(aligned)).toBe   (true) ;
		expect(leftovers(target)                   ).toEqual([]  ) ;
	}, 60_000);
});
