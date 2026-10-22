/**
 * Store for the harness run history.
 *
 * - `runs.jsonl`: append-only. One run is one line (one record). Partial runs (missing stages) are recorded too.
 * - `latest.json`: updated by atomic replacement only for runs with `completion.complete` (the 09_observe-shapes snapshot discipline).
 * Both are git-tracked so history and evidence can be reviewed as diffs (M1.7 decision "the DB is git-tracked JSON/JSONL").
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
	/** Output directory — the CLI and engine tarballs share the file name (boxbox-<version>.tgz), so this field tells them apart. */
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
	if (typeof value !== "object" || value === null || Array.isArray(value)) fail(`${field} must be an object`);
	return value as Record<string, unknown>;
}

function expectString(parent: Record<string, unknown>, field: string): string {
	const value = parent[field];
	if (typeof value !== "string" || value.length === 0) fail(`${field} must be a non-empty string`);
	return value;
}

function expectNumber(parent: Record<string, unknown>, field: string): number {
	const value = parent[field];
	if (typeof value !== "number" || !Number.isFinite(value)) fail(`${field} must be a finite number`);
	return value;
}

function expectBoolean(parent: Record<string, unknown>, field: string): boolean {
	const value = parent[field];
	if (typeof value !== "boolean") fail(`${field} must be a boolean`);
	return value;
}

/** Validates the minimal contract of a stored line. Unknown fields are allowed for future versions. */
export function validateRunRecord(value: unknown): RunRecord {
	const record = expectObject(value, "root");
	if (record.schemaVersion !== RUNS_SCHEMA_VERSION) fail(`schemaVersion must be ${RUNS_SCHEMA_VERSION}`);
	if (record.recordType !== "run") fail(`recordType must be "run"`);
	expectString(record, "runId");
	expectString(record, "startedAt");
	expectObject(record.git, "git");
	expectObject(record.host, "host");
	expectObject(record.preconditions, "preconditions");
	const requested = record.requestedStages;
	if (!Array.isArray(requested) || requested.some(id => typeof id !== "string")) fail("requestedStages must be an array of strings");
	if (!Array.isArray(record.stages)) fail("stages must be an array");
	for (const stage of record.stages) {
		const entry = expectObject(stage, "stages entry");
		expectString(entry, "id");
		expectBoolean(entry, "ok");
		expectBoolean(entry, "skipped");
		expectNumber(entry, "durationMs");
		expectObject(entry.metrics ?? {}, "metrics");
	}
	if (!Array.isArray(record.artifacts)) fail("artifacts must be an array");
	const completion = expectObject(record.completion, "completion");
	expectBoolean(completion, "complete");
	expectNumber(completion, "requested");
	expectNumber(completion, "succeeded");
	expectNumber(completion, "failed");
	expectNumber(completion, "skipped");
	expectBoolean(record, "ok");
	return record as unknown as RunRecord;
}

/** Computes completion from the number of requested stages and the run results. */
export function completionOf(requestedStages: readonly string[], stages: readonly RunStage[]): RunRecord["completion"] {
	const executed = stages.filter(stage => !stage.skipped) ;
	const skipped  = stages.filter(stage => stage.skipped ) ;
	return {
		complete  : executed.length + skipped.length === requestedStages.length ,
		requested : requestedStages.length                                      ,
		succeeded : executed.filter(stage => stage.ok).length                   ,
		failed    : executed.filter(stage => !stage.ok).length                  ,
		skipped   : skipped.length                                              ,
	};
}

export function appendRun(evidenceDir: string, record: RunRecord): void {
	mkdirSync(evidenceDir, { recursive: true });
	appendFileSync(join(evidenceDir, RUNS_FILE), `${JSON.stringify(record)}\n`);
}

/** Reads every run in runs.jsonl, oldest first. An empty array if the file is missing. */
export function readRuns(evidenceDir: string): RunRecord[] {
	const path = join(evidenceDir, RUNS_FILE);
	if (!existsSync(path)) return [];
	const lines = readFileSync(path, "utf8").split("\n").filter(line => line.trim().length > 0);
	return lines.map((line, index) => {
		try {
			return validateRunRecord(JSON.parse(line));
		} catch (error) {
			throw new Error(`${path} line ${index + 1}: ${String((error as Error).message)}`);
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

/** Replaces the latest complete-run snapshot via a temporary file + rename. Partial runs are refused. */
export function updateLatest(evidenceDir: string, record: RunRecord): void {
	if (!record.completion.complete) throw new Error("latest.json is updated only by a complete run");
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
