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
	test("pass·skip·fail과 Ran 요약을 파싱한다", () => {
		const text = " 403 pass\n 5 skip\n 0 fail\n 1617 expect() calls\nRan 408 tests across 45 files. [99.21s]" ;
		expect(parseBunTestOutput(text)).toEqual({ pass: 403, skip: 5, fail: 0, tests: 408, testFiles: 45 }) ;
	});

	test("요약이 없으면 null이다", () => {
		expect(parseBunTestOutput("아무 출력도 없다")).toBeNull() ;
	});
});

describe("validateRunRecord", () => {
	test("최소 계약을 만족하는 레코드를 통과시킨다", () => {
		expect(validateRunRecord(JSON.parse(JSON.stringify(sampleRun()))).runId).toContain("8338798a") ;
	});

	test("schemaVersion·runId·스테이지 항목 위반은 거절한다", () => {
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

describe("저장소", () => {
	const workspaces: string[] = []          ;

	afterEach(() => {
		for (const path of workspaces.splice(0)) rmSync(path, { recursive: true, force: true }) ;
	});

	function evidence(): string {
		const path = mkdtempSync(join(import.meta.dir, "harness-db-")) ;
		workspaces.push(path)                                          ;
		return path                                                    ;
	}

	test("append 후 오래된 순으로 읽힌다", () => {
		const dir = evidence()                                     ;
		appendRun(dir, sampleRun({ runId: "first" }))              ;
		appendRun(dir, sampleRun({ runId: "second" }))             ;
		const runs = readRuns(dir)                                 ;
		expect(runs.map(run => run.runId)).toEqual(["first", "second"]) ;
		expect(latestOf(runs)!.runId).toBe("second")               ;
	});

	test("latest는 완전 실행만 갱신하고 읽힌다", () => {
		const dir = evidence()                                     ;
		appendRun(dir, sampleRun())                                ;
		updateLatest(dir, sampleRun())                             ;
		expect(readLatest(dir)!.ok).toBe(true)                     ;
		const partial = sampleRun({
			completion : { complete: false, requested: 2, succeeded: 1, failed: 0, skipped: 0 },
			ok         : false                                                ,
		})                                                                     ;
		expect(() => updateLatest(dir, partial)).toThrow("완전 실행")           ;
	});

	test("완성 계산은 실행·실패·skip을 구분한다", () => {
		const stages = [
			{ id : "check" , ok : true  , skipped : false , exitCode : 0    , durationMs : 1 , metrics : {} },
			{ id : "pack"  , ok : false , skipped : false , exitCode : 1    , durationMs : 1 , metrics : {} },
			{ id : "eval"  , ok : true  , skipped : true  , exitCode : null , durationMs : 0 , metrics : {} },
		] as RunRecord["stages"]                                               ;
		expect(completionOf(["check", "pack", "eval"], stages)).toEqual({ complete: true, requested: 3, succeeded: 1, failed: 1, skipped: 1 }) ;
	});
});

describe("parseRelTable", () => {
	test("docs/plan.md의 REL0–REL12를 순서대로 읽는다", () => {
		const rows = parseRelTable(readFileSync(resolve(root, "docs/plan.md"), "utf8")) ;
		expect(rows.map(row => row.id)).toEqual(["REL0", "REL1", "REL2", "REL3", "REL4", "REL5", "REL6", "REL7", "REL8", "REL9", "REL10", "REL11", "REL12"]) ;
		expect(rows.every(row => row.task.length > 0 && row.status.length > 0)).toBe(true) ;
	});

	test("증거 조인은 사람 판정을 바꾸지 않는다", () => {
		const rel = { id: "REL2", task: "안전 gate", depends: "REL1", status: "부분 구현" } ;
		const run = sampleRun({ requestedStages: ["self-align", "check"], stages: [
			{ id: "self-align", ok: true, skipped: false, exitCode: 0, durationMs: 1, metrics: {} },
			{ id: "check", ok: true, skipped: false, exitCode: 0, durationMs: 1, metrics: {} },
		] })                                                                                   ;
		expect(relEvidence(rel, run)).toBe("2026-10-06 self-align=ok · check=ok")              ;
		expect(relEvidence(rel, null)).toBe("증거 없음(사람 판정 영역)")                        ;
		const withoutStages = { id: "REL6", task: "승인 데이터", depends: "REL5", status: "⏸" } ;
		expect(relEvidence(withoutStages, run)).toBe("증거 없음(사람 판정 영역)")               ;
	});
});
