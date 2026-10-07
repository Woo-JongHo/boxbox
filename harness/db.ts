/**
 * 하네스 실행 이력 저장소.
 *
 * - `runs.jsonl`: append-only. 실행 1회가 1행(레코드 1개)이다. 부분 실행(스테이지 누락)도 기록한다.
 * - `latest.json`: `completion.complete`인 실행만 원자 교체로 갱신한다(09_observe-shapes 스냅샷 규율).
 * 둘 다 git-tracked라 diff로 이력·증거를 검토할 수 있다(M1.7 "DB는 git-tracked JSON/JSONL" 결정).
 */

import      {
              appendFileSync ,
              existsSync     ,
              mkdirSync      ,
              readFileSync   ,
              renameSync     ,
              rmSync         ,
              writeFileSync  ,
                               } from "node:fs"   ;
import      { join             } from "node:path" ;

export const RUNS_SCHEMA_VERSION = 1;

export const RUNS_FILE   = "runs.jsonl"  ;
export const LATEST_FILE = "latest.json" ;

export interface RunStage {
	readonly id         : string                                              ;
	readonly ok         : boolean                                             ;
	readonly skipped    : boolean                                             ;
	readonly exitCode   : number | null                                       ;
	readonly durationMs : number                                              ;
	readonly metrics    : Readonly<Record<string, number | string | boolean>> ;
	readonly error?     : string                                              ;
}

export interface RunArtifact {
	readonly stage   : string ;
	/** 산출 디렉터리 — CLI·엔진 tarball이 같은 파일명(xxx-<version>.tgz)을 공유하므로 이 필드로 구별한다. */
	readonly target  : string ;
	readonly name    : string ;
	readonly bytes   : number ;
	readonly sha256  : string ;
	readonly files   : number ;
	readonly version : string ;
}

export interface RunRecord {
	readonly schemaVersion   : number                                                                                                                                    ;
	readonly recordType      : "run"                                                                                                                                     ;
	readonly runId           : string                                                                                                                                    ;
	readonly startedAt       : string                                                                                                                                    ;
	readonly git             : { readonly branch: string | null; readonly sha: string | null; readonly dirty: boolean; readonly ahead: number | null }                   ;
	readonly host            : { readonly platform: string; readonly bun: string; readonly node: string | null }                                                         ;
	readonly preconditions   : { readonly npmCache: { readonly typescript: boolean; readonly typescriptNative: boolean } }                                               ;
	readonly requestedStages : readonly string[]                                                                                                                         ;
	readonly stages          : readonly RunStage[]                                                                                                                       ;
	readonly artifacts       : readonly RunArtifact[]                                                                                                                    ;
	readonly completion      : { readonly complete: boolean; readonly requested: number; readonly succeeded: number; readonly failed: number; readonly skipped: number } ;
	readonly ok              : boolean                                                                                                                                   ;
	readonly note            : string                                                                                                                                    ;
	readonly limitations     : readonly string[]                                                                                                                         ;
}

function fail(message: string): never {
	throw new Error(`harness run record: ${message}`);
}

function expectObject(value: unknown, field: string): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) fail(`${field}는 객체여야 한다`);
	return value as Record<string, unknown>;
}

function expectString(parent: Record<string, unknown>, field: string): string {
	const value = parent[field];
	if (typeof value !== "string" || value.length === 0) fail(`${field}는 비어 있지 않은 문자열이어야 한다`);
	return value;
}

function expectNumber(parent: Record<string, unknown>, field: string): number {
	const value = parent[field];
	if (typeof value !== "number" || !Number.isFinite(value)) fail(`${field}는 유한한 수여야 한다`);
	return value;
}

function expectBoolean(parent: Record<string, unknown>, field: string): boolean {
	const value = parent[field];
	if (typeof value !== "boolean") fail(`${field}는 boolean이어야 한다`);
	return value;
}

/** 저장소에 들어가는 행의 최소 계약을 검증한다. 모르는 필드는 미래 버전을 위해 허용한다. */
export function validateRunRecord(value: unknown): RunRecord {
	const record = expectObject(value, "root");
	if (record.schemaVersion !== RUNS_SCHEMA_VERSION) fail(`schemaVersion은 ${RUNS_SCHEMA_VERSION}이어야 한다`);
	if (record.recordType !== "run") fail(`recordType은 "run"이어야 한다`);
	expectString(record, "runId");
	expectString(record, "startedAt");
	expectObject(record.git, "git");
	expectObject(record.host, "host");
	expectObject(record.preconditions, "preconditions");
	const requested = record.requestedStages;
	if (!Array.isArray(requested) || requested.some(id => typeof id !== "string")) fail("requestedStages는 문자열 배열이어야 한다");
	if (!Array.isArray(record.stages)) fail("stages는 배열이어야 한다");
	for (const stage of record.stages) {
		const entry = expectObject(stage, "stages 항목");
		expectString(entry, "id");
		expectBoolean(entry, "ok");
		expectBoolean(entry, "skipped");
		expectNumber(entry, "durationMs");
		expectObject(entry.metrics ?? {}, "metrics");
	}
	if (!Array.isArray(record.artifacts)) fail("artifacts는 배열이어야 한다");
	const completion = expectObject(record.completion, "completion");
	expectBoolean(completion, "complete");
	expectNumber(completion, "requested");
	expectNumber(completion, "succeeded");
	expectNumber(completion, "failed");
	expectNumber(completion, "skipped");
	expectBoolean(record, "ok");
	return record as unknown as RunRecord;
}

/** 요청한 스테이지 수와 실행 결과에서 completion을 계산한다. */
export function completionOf(requestedStages: readonly string[], stages: readonly RunStage[]): RunRecord["completion"] {
	const executed = stages.filter(stage => !stage.skipped) ;
	const skipped  = stages.filter(stage => stage.skipped ) ;
	return {
		complete  : executed.length + skipped.length === requestedStages.length,
		requested : requestedStages.length,
		succeeded : executed.filter(stage => stage.ok).length,
		failed    : executed.filter(stage => !stage.ok).length,
		skipped   : skipped.length,
	};
}

export function appendRun(evidenceDir: string, record: RunRecord): void {
	mkdirSync(evidenceDir, { recursive: true });
	appendFileSync(join(evidenceDir, RUNS_FILE), `${JSON.stringify(record)}\n`);
}

/** runs.jsonl의 모든 실행을 오래된 순으로 읽는다. 파일이 없으면 빈 배열이다. */
export function readRuns(evidenceDir: string): RunRecord[] {
	const path = join(evidenceDir, RUNS_FILE);
	if (!existsSync(path)) return [];
	const lines = readFileSync(path, "utf8").split("\n").filter(line => line.trim().length > 0);
	return lines.map((line, index) => {
		try {
			return validateRunRecord(JSON.parse(line));
		} catch (error) {
			throw new Error(`${path} ${index + 1}행: ${String((error as Error).message)}`);
		}
	});
}

export function latestOf(runs: readonly RunRecord[]): RunRecord | null {
	return runs.length > 0 ? runs[runs.length - 1]! : null;
}

export function readLatest(evidenceDir: string): RunRecord | null {
	const path = join(evidenceDir, LATEST_FILE);
	if (!existsSync(path)) return null;
	return validateRunRecord(JSON.parse(readFileSync(path, "utf8")));
}

/** 최신 완전 실행 스냅샷을 임시 파일 + rename으로 교체한다. 부분 실행은 거절한다. */
export function updateLatest(evidenceDir: string, record: RunRecord): void {
	if (!record.completion.complete) throw new Error("latest.json은 완전 실행만 갱신한다");
	mkdirSync(evidenceDir, { recursive: true });
	const target    = join(evidenceDir, LATEST_FILE) ;
	const temporary = `${target}.${process.pid}.tmp` ;
	writeFileSync(temporary, `${JSON.stringify(record, null, "\t")}\n`);
	try {
		renameSync(temporary, target);
	} catch (error) {
		rmSync(temporary, { force: true });
		throw error;
	}
}
