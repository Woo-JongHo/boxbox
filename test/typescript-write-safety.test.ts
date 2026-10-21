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

const root                 = resolve(import.meta.dir, "..")                                ;
const script               = resolve(root, "product/engine/typescript/06_align-tables.ts") ;
const workspaces: string[] = []                                                            ;

function workspace(): string {
	const value = mkdtempSync(join(import.meta.dir, "boxbox-ts-write-"));
	workspaces.push(value);
	return value;
}

function targetWith(text = "original\n"): string {
	const target = join(workspace(), "sample.ts");
	writeFileSync(target, text);
	return target;
}

function leftovers(target: string): readonly string[] {
	return readdirSync(resolve(target, "..")).filter(name => name.includes("boxbox-stage") || name.includes("boxbox-write.lock"));
}

afterEach(() => {
	for (const value of workspaces.splice(0)) rmSync(value, { recursive: true, force: true });
});

describe("atomic file replacement helper", () => {
	test("on success keeps the mode and cleans up temporary files", async () => {
		const target = targetWith();
		chmodSync(target, 0o640);

		await updateFileAtomically(target, async ({ working }) => { writeFileSync(working, "updated\n"); });

		expect(readFileSync(target, "utf8")  ).toBe   ("updated\n") ;
		expect(lstatSync(target).mode & 0o777).toBe   (0o640      ) ;
		expect(leftovers(target)             ).toEqual([]         ) ;
	});

	test("the synchronous entry point uses the same commit and cleanup contract", () => {
		const target = targetWith();

		const changed = updateFileAtomicallySync(target, ({ working }) => { writeFileSync(working, "sync\n"); });

		expect(changed                     ).toBe   (true    ) ;
		expect(readFileSync(target, "utf8")).toBe   ("sync\n") ;
		expect(leftovers(target)           ).toEqual([]      ) ;
	});

	test("when an external edit is found, keeps that edit and refuses the commit", async () => {
		const target = targetWith();

		await expect(updateFileAtomically(target, async ({ working }) => {
			writeFileSync(working, "staged\n");
			writeFileSync(target, "external\n");
		})).rejects.toThrow("target changed before commit");

		expect(readFileSync(target, "utf8")).toBe("external\n") ;
		expect(leftovers(target)           ).toEqual([])         ;
	});

	test("on rename failure keeps the original and cleans up temporary files", async () => {
		const target = targetWith();

		await expect(updateFileAtomically(target, async ({ working }) => { writeFileSync(working, "staged\n"); }, {
			rename: () => { throw new Error("injected rename failure"); },
		})).rejects.toThrow("injected rename failure");

		expect(readFileSync(target, "utf8")).toBe("original\n") ;
		expect(leftovers(target)           ).toEqual([])         ;
	});

	test("refuses symbolic and hard link targets conservatively", async () => {
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

describe("TS multi-pass working copy", () => {
	for (const [name, operation] of [
		["later pass exception", async (working: string) => runStagedPasses(working, { apply: async (_path, pass) => { writeFileSync(working, `pass-${pass}\n`); if (pass === 2) throw new Error("later pass failure"); return true; }, verify: async () => false })],
		["parser throw", async (working: string) => writeDiagnosedOutput(working, "original\n", "staged\n", async text => { if (text === "staged\n") throw new Error("parser throw"); return []; })],
		["diagnostic mismatch", async (working: string) => writeDiagnosedOutput(working, "original\n", "staged\n", async text => text === "original\n" ? [] : ["1:1005"])],
		["non-convergence", async (working: string) => runStagedPasses(working, { apply: async () => { writeFileSync(working, `${readFileSync(working, "utf8")}x`); return true; }, verify: async () => false }, 3)],
	] as const) test(`on ${name}, the original is never changed`, async () => {
		const target = targetWith();

		await expect(updateFileAtomically(target, async ({ working }) => { await operation(working); })).rejects.toThrow();

		expect(readFileSync(target, "utf8")).toBe("original\n") ;
		expect(leftovers(target)           ).toEqual([])         ;
	});

	test("a rerun after a real CLI success is byte-identical", () => {
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
