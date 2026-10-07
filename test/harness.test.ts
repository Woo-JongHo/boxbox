import      { afterEach, describe, expect, test              } from "bun:test"             ;
import      { mkdtempSync, readFileSync, rmSync              } from "node:fs"              ;
import      { join, resolve                                  } from "node:path"            ;

import      {
              appendRun                                    ,
              completionOf                                 ,
              latestOf                                     ,
              readLatest                                   ,
              readRuns                                     ,
              RUNS_SCHEMA_VERSION                          ,
              updateLatest                                 ,
              validateRunRecord                            ,
              type RunRecord                               ,
                                                             } from "../harness/db.ts"     ;
import      { parseBunTestOutput, parseRelTable, relEvidence } from "../harness/report.ts" ;

const root = resolve(import.meta.dir, "..") ;

function sampleRun(overrides: Partial<RunRecord> = {}): RunRecord {
	return {
		schemaVersion   : RUNS_SCHEMA_VERSION,
		recordType      : "run",
		runId           : "2026-10-06T00-00-00-000Z-8338798a",
		startedAt       : "2026-10-06T00:00:00.000Z",
		git             : { branch: "m1-safety-proof", sha: "8338798a", dirty: true, ahead: 27 },
		host            : { platform: "darwin-arm64", bun: "1.4.0", node: "v22.22.3" },
		preconditions   : { npmCache: { typescript: true, typescriptNative: true } },
		requestedStages : ["check"],
		stages          : [{ id: "check", ok: true, skipped: false, exitCode: 0, durationMs: 1_000, metrics: { pass: 403, skip: 5, fail: 0 } }],
		artifacts       : [],
		completion      : { complete: true, requested: 1, succeeded: 1, failed: 0, skipped: 0 },
		ok              : true,
		note            : "",
		limitations     : [],
		...overrides,
	} as RunRecord ;
}

describe("parseBunTestOutput", () => {
	test("parses pass, skip, fail and the Ran summary", () => {
		const text = " 403 pass\n 5 skip\n 0 fail\n 1617 expect() calls\nRan 408 tests across 45 files. [99.21s]" ;
		expect(parseBunTestOutput(text)).toEqual({ pass: 403, skip: 5, fail: 0, tests: 408, testFiles: 45 }) ;
	});

	test("returns null without a summary", () => {
		expect(parseBunTestOutput("no output at all")).toBeNull() ;
	});
});

describe("validateRunRecord", () => {
	test("accepts a record that satisfies the minimal contract", () => {
		expect(validateRunRecord(JSON.parse(JSON.stringify(sampleRun()))).runId).toContain("8338798a") ;
	});

	test("refuses schemaVersion, runId and stage entry violations", () => {
		const broken = sampleRun() as unknown as Record<string, unknown> ;
		broken.schemaVersion = 99                                        ;
		expect(() => validateRunRecord(broken)).toThrow()                ;
		const missing = structuredClone(sampleRun()) as unknown as Record<string, unknown> ;
		delete missing.runId                                             ;
		expect(() => validateRunRecord(missing)).toThrow()               ;
		const badStage = sampleRun({ stages: [{ ok: true, skipped: false, durationMs: 0, metrics: {} }] as unknown as RunRecord["stages"] }) ;
		expect(() => validateRunRecord(badStage)).toThrow()              ;
	});
});

describe("store", () => {
	const workspaces: string[] = []          ;

	afterEach(() => {
		for (const path of workspaces.splice(0)) rmSync(path, { recursive: true, force: true }) ;
	});

	function evidence(): string {
		const path = mkdtempSync(join(import.meta.dir, "harness-db-")) ;
		workspaces.push(path)                                          ;
		return path                                                    ;
	}

	test("after append, records read back oldest first", () => {
		const dir = evidence()                                     ;
		appendRun(dir, sampleRun({ runId: "first" }))              ;
		appendRun(dir, sampleRun({ runId: "second" }))             ;
		const runs = readRuns(dir)                                 ;
		expect(runs.map(run => run.runId)).toEqual(["first", "second"]) ;
		expect(latestOf(runs)!.runId).toBe("second")               ;
	});

	test("latest is updated only by complete runs and reads back", () => {
		const dir = evidence()                                     ;
		appendRun(dir, sampleRun())                                ;
		updateLatest(dir, sampleRun())                             ;
		expect(readLatest(dir)!.ok).toBe(true)                     ;
		const partial = sampleRun({
			completion : { complete: false, requested: 2, succeeded: 1, failed: 0, skipped: 0 },
			ok         : false                                                ,
		})                                                                     ;
		expect(() => updateLatest(dir, partial)).toThrow("complete run")           ;
	});

	test("completion counting distinguishes ran, failed and skipped", () => {
		const stages = [
			{ id : "check" , ok : true  , skipped : false , exitCode : 0    , durationMs : 1 , metrics : {} },
			{ id : "pack"  , ok : false , skipped : false , exitCode : 1    , durationMs : 1 , metrics : {} },
			{ id : "eval"  , ok : true  , skipped : true  , exitCode : null , durationMs : 0 , metrics : {} },
		] as RunRecord["stages"]                                               ;
		expect(completionOf(["check", "pack", "eval"], stages)).toEqual({ complete: true, requested: 3, succeeded: 1, failed: 1, skipped: 1 }) ;
	});
});

describe("parseRelTable", () => {
	test("reads REL0–REL12 from docs/plan.md in order", () => {
		const rows = parseRelTable(readFileSync(resolve(root, "docs/plan.md"), "utf8")) ;
		expect(rows.map(row => row.id)).toEqual(["REL0", "REL1", "REL2", "REL3", "REL4", "REL5", "REL6", "REL7", "REL8", "REL9", "REL10", "REL11", "REL12"]) ;
		expect(rows.every(row => row.task.length > 0 && row.status.length > 0)).toBe(true) ;
	});

	test("evidence joining never changes the human verdict", () => {
		const rel = { id: "REL2", task: "safety gate", depends: "REL1", status: "partially implemented" } ;
		const run = sampleRun({ requestedStages: ["self-align", "check"], stages: [
			{ id: "self-align", ok: true, skipped: false, exitCode: 0, durationMs: 1, metrics: {} },
			{ id: "check", ok: true, skipped: false, exitCode: 0, durationMs: 1, metrics: {} },
		] })                                                                                   ;
		expect(relEvidence(rel, run)).toBe("2026-10-06 self-align=ok · check=ok")              ;
		expect(relEvidence(rel, null)).toBe("no evidence (human verdict area)")                        ;
		const withoutStages = { id: "REL6", task: "approval data", depends: "REL5", status: "⏸" } ;
		expect(relEvidence(withoutStages, run)).toBe("no evidence (human verdict area)")               ;
	});
});
