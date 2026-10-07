import      { afterEach, describe, expect, test              } from "bun:test"                     ;
import      { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"                      ;
import      { join                                           } from "node:path"                    ;
import      { checkGate, fixtureDir, scaffoldFor             } from "../scripts/corpus-promote.ts" ;

const FIXTURES             = join(import.meta.dir, "..", "skills", "xxx", "fixtures") ;
const workspaces: string[] = []                                                       ;

afterEach(() => {
	for (const workspace of workspaces.splice(0)) rmSync(workspace, { recursive: true, force: true });
});

describe("verdict promotion", () => {
	test("scaffolds are minimized synthetic cases per language and kind", () => {
		const python = scaffoldFor("python"    , "table"             ) ;
		const tsDecl = scaffoldFor("typescript", "declaration-equals") ;
		const tsReg  = scaffoldFor("typescript", "registration"      ) ;
		expect(python.split("\n")   )    .toEqual  (["alpha = first(1, 22)", "beta = first(2, 33)", "gamma = first(3, 44)", ""]) ;
		expect(tsDecl.split("\n")[0])    .toBe     ("const value1 = initial1;"                                                 ) ;
		expect(tsReg.split("\n")[0] )    .toBe     ("const settings1 = { retries: 3 };"                                        ) ;
		expect(python               ).not.toContain("STATES"                                                                   ) ;
	});

	test("the promotion gate passes a consistent fixture and flags a drifted golden", () => {
		const dir     = join(FIXTURES, "python", "corpus", "099-gateprobe-1234abcd")                            ;
		const aligner = join(import.meta.dir, "..", "skills", "xxx", "scripts", "python", "06_align-tables.ts") ;
		workspaces.push(dir)                                                                                  ;
		mkdirSync(dir, { recursive: true })                                                                   ;
		writeFileSync(join(dir, "tables.py"), scaffoldFor("python", "table"))                                 ;
		writeFileSync(join(dir, "verdict.json"), JSON.stringify({ schemaVersion: 1, signature: "probe", verdict: "correct", date: "2026-09-29" }));
		let gate = checkGate();
		expect(gate.failures.some(failure => failure.includes("099-gateprobe") && failure.includes("golden"))).toBe(true);
		const aligned = spawnAligner(aligner, join(dir, "tables.py"))                                         ;
		writeFileSync(join(dir, "tables.aligned.py"), aligned)                                                ;
		gate = checkGate()                                                                                    ;
		expect(gate.failures.some(failure => failure.includes("099-gateprobe"))).toBe(false)                  ;
		writeFileSync(join(dir, "tables.aligned.py"), "alpha = first(1,    22)\nbeta = first(2, 33)\ngamma = first(3, 44)\n") ;
		gate = checkGate();
		expect(gate.failures.some(failure => failure.includes("099-gateprobe") && failure.includes("drifted"))).toBe(true);
	});

	test("fixtureDir pins the fixture to the signature hash under the language corpus tree", () => {
		const dir = fixtureDir("typescript", "typescript|Block|declaration-equals|equals>semicolon|d1|FIXABLE", 1);
		expect(dir.startsWith(join(FIXTURES, "typescript", "corpus", "001-"))).toBe(true) ;
		expect(dir.endsWith("001-")).toBe(false)                                          ;
		expect(readFileSyncSafe(dir)).toBeUndefined();
	});

	test("the aligner is the promotion gate's only engine dependency", () => {
		expect(scaffoldFor("typescript", "unknown-kind").split("\n")[0]).toBe("const value1 = initial1;");
	});
});

function spawnAligner(aligner: string, file: string): string {
	const { spawnSync } = require("node:child_process") as typeof import("node:child_process");
	const result = spawnSync("bun", [aligner, "--file", file, "--write"], { encoding: "utf8" }) ;
	if (result.status !== 0) throw new Error(`alignment failed: ${result.stderr}`)              ;
	return readFileSync(file, "utf8")                                                           ;
}

function readFileSyncSafe(path: string): string | undefined {
	try {
		return readFileSync(path, "utf8");
	} catch {
		return undefined;
	}
}
