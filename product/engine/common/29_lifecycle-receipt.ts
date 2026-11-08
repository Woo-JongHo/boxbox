import      { lstatSync, readFileSync } from "node:fs"                    ;
import type { FileResult              } from "@/common/24_result-json.ts" ;

export const LIFECYCLE_RECEIPT_SCHEMA_VERSION = 1               ;
export const LIFECYCLE_RECEIPT_MAX_BYTES      = 8 * 1024 * 1024 ;

export type LifecycleEvent = "PostToolUse" | "Stop";
export type LifecycleState = "FAIL" | "UNSUPPORTED" | "SUGGEST" | "PASS" | "NO_GROUPS" | "DELETED_ONLY" | "NO_CHANGES";

export interface LifecycleCoverage {
	readonly changedFiles     : number ;
	readonly checkedFiles     : number ;
	readonly unsupportedFiles : number ;
	readonly deletedFiles     : number ;
	readonly filesWithGroups  : number ;
	readonly groups           : number ;
}

export interface LifecycleCheckedFile {
	readonly file   : string     ;
	readonly result : FileResult ;
}

export interface LifecycleReceiptV1 {
	readonly schemaVersion : 1              ;
	readonly event         : LifecycleEvent ;
	readonly state         : LifecycleState ;

	readonly files       : readonly string[]               ;
	readonly checked     : readonly LifecycleCheckedFile[] ;
	readonly unsupported : readonly string[]               ;
	readonly deleted     : readonly string[]               ;
	readonly coverage    : LifecycleCoverage               ;

	readonly tool: string | null;
	readonly at  : string;

	readonly automaticFixPerformed: false;
}

/** Receipts written before schema 1 remain readable evidence, but are never returned by the schema-1 validator. */
export type LegacyLifecycleReceipt = Omit<LifecycleReceiptV1, "schemaVersion" | "coverage" | "deleted"> & {
	readonly schemaVersion?: undefined;
	readonly coverage?     : undefined;
};

export type LifecycleReceipt = LifecycleReceiptV1 | LegacyLifecycleReceipt;

function record(value: unknown, where: string): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${where}: must be a JSON object`);

	return value as Record<string, unknown>;
}

function unknownKeys(value: Record<string, unknown>, keys: readonly string[], where: string): void {
	const unknown = Object.keys(value).filter(key => !keys.includes(key));
	if (unknown.length) throw new Error(`${where}: unknown field ${unknown[0]}`);
}

function string(value: unknown, where: string): string {
	if (typeof value !== "string" || value === "") throw new Error(`${where}: must be a non-empty string`);

	return value;
}

function strings(value: unknown, where: string): readonly string[] {
	if (!Array.isArray(value)) throw new Error(`${where}: must be an array`);
	const result = value.map((item, index) => string(item, `${where}[${index}]`));
	if (new Set(result).size !== result.length) throw new Error(`${where}: duplicate file`);

	return result;
}

function count(value: unknown, where: string): number {
	if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`${where}: must be a non-negative safe integer`);

	return value as number;
}

function checkedFiles(value: unknown, where: string, strict: boolean): readonly LifecycleCheckedFile[] {
	if (!Array.isArray(value)) throw new Error(`${where}: must be an array`);

	const checked = value.map((item, index) => {
		const entry   = record(item          , `${where}[${index}]`               ) ;
		const result  = record(entry.result  , `${where}[${index}].result`        ) ;
		const summary = record(result.summary, `${where}[${index}].result.summary`) ;
		if (strict) {
			unknownKeys(entry, ["file", "result"], `${where}[${index}]`);
			unknownKeys(result, ["file", "language", "mode", "summary", "groups", "parse", "unsupported"], `${where}[${index}].result`);
			unknownKeys(summary, ["groups", "misaligned", "edits", "refused", "suggested"], `${where}[${index}].result.summary`);
			for (const key of ["misaligned", "edits", "refused", "suggested"] as const) count(summary[key], `${where}[${index}].result.summary.${key}`);
			string(result.file, `${where}[${index}].result.file`);
			string(result.language, `${where}[${index}].result.language`);
			if (result.mode !== "check" && result.mode !== "write") throw new Error(`${where}[${index}].result.mode: must be check or write`);
			const parse = record(result.parse, `${where}[${index}].result.parse`);
			unknownKeys(parse, ["status", "tool", "passes"], `${where}[${index}].result.parse`);
			if (!["ok", "changed", "skipped", "not-run"].includes(String(parse.status))) throw new Error(`${where}[${index}].result.parse.status: unsupported status`);
			if (typeof parse.tool !== "string") throw new Error(`${where}[${index}].result.parse.tool: must be a string`);
			if (parse.passes !== undefined) count(parse.passes, `${where}[${index}].result.parse.passes`);
		}
		if (!Array.isArray(result.groups)) throw new Error(`${where}[${index}].result.groups: must be an array`);
		if (count(summary.groups, `${where}[${index}].result.summary.groups`) !== result.groups.length) {
			throw new Error(`${where}[${index}].result: group count does not match groups`);
		}
		const file = string(entry.file, `${where}[${index}].file`);
		if (strict && result.file !== file) throw new Error(`${where}[${index}].result.file: must match checked file`);

		return { file, result: entry.result as FileResult };
	});
	if (new Set(checked.map(item => item.file)).size !== checked.length) throw new Error(`${where}: duplicate file`);

	return checked;
}

function sharedReceipt(value: Record<string, unknown>, where: string, strict: boolean) {
	const events : readonly LifecycleEvent[] = ["PostToolUse", "Stop"]                                                               ;
	const states : readonly LifecycleState[] = ["FAIL", "UNSUPPORTED", "SUGGEST", "PASS", "NO_GROUPS", "DELETED_ONLY", "NO_CHANGES"] ;
	if (!events.includes(value.event as LifecycleEvent)) throw new Error(`${where}.event: unsupported event`);
	if (!states.includes(value.state as LifecycleState)) throw new Error(`${where}.state: unsupported state`);
	const files       = strings     (value.files      , `${where}.files`          ) ;
	const checked     = checkedFiles(value.checked    , `${where}.checked`, strict) ;
	const unsupported = strings     (value.unsupported, `${where}.unsupported`    ) ;
	if (value.tool !== null && typeof value.tool !== "string") throw new Error(`${where}.tool: must be a string or null`);
	const at = string(value.at, `${where}.at`);
	if (!Number.isFinite(Date.parse(at)) || new Date(at).toISOString() !== at) throw new Error(`${where}.at: must be an ISO date string`);
	if (value.automaticFixPerformed !== false) throw new Error(`${where}.automaticFixPerformed: must be false`);

	return {
		event : value.event as LifecycleEvent,
		state : value.state as LifecycleState,

		files       ,
		checked     ,
		unsupported ,

		tool : value.tool as string | null,
		at,

		automaticFixPerformed: false as const,
	};
}

export function validateLifecycleReceipt(value: unknown, where = "lifecycle receipt"): LifecycleReceiptV1 {
	const receipt = record(value, where);
	unknownKeys(receipt, ["schemaVersion", "event", "state", "files", "checked", "unsupported", "deleted", "coverage", "tool", "at", "automaticFixPerformed"], where);
	if (receipt.schemaVersion !== LIFECYCLE_RECEIPT_SCHEMA_VERSION) throw new Error(`${where}.schemaVersion: expected 1`);
	const shared   = sharedReceipt(receipt, where, true                 ) ;
	const deleted  = strings      (receipt.deleted, `${where}.deleted`  ) ;
	const coverage = record       (receipt.coverage, `${where}.coverage`) ;
	unknownKeys(coverage, ["changedFiles", "checkedFiles", "unsupportedFiles", "deletedFiles", "filesWithGroups", "groups"], `${where}.coverage`);
	const parsedCoverage: LifecycleCoverage = {
		changedFiles     : count(coverage.changedFiles    , `${where}.coverage.changedFiles`    ) ,
		checkedFiles     : count(coverage.checkedFiles    , `${where}.coverage.checkedFiles`    ) ,
		unsupportedFiles : count(coverage.unsupportedFiles, `${where}.coverage.unsupportedFiles`) ,
		deletedFiles     : count(coverage.deletedFiles    , `${where}.coverage.deletedFiles`    ) ,
		filesWithGroups  : count(coverage.filesWithGroups , `${where}.coverage.filesWithGroups` ) ,
		groups           : count(coverage.groups          , `${where}.coverage.groups`          ) ,
	};
	const groups          = shared.checked.reduce((total, item) => total + item.result.summary.groups, 0)                      ;
	const filesWithGroups = shared.checked.filter(item => item.result.summary.groups > 0).length                               ;
	const checkedFiles    = shared.checked.map(item => item.file)                                                              ;
	const partition       = [...checkedFiles, ...shared.unsupported, ...deleted]                                               ;
	const failed          = shared.checked.some(item => item.result.summary.misaligned > 0 || item.result.summary.refused > 0) ;
	const suggested       = shared.checked.reduce((total, item) => total + item.result.summary.suggested, 0)                   ;
	const expectedState: LifecycleState =
		  failed                    ? "FAIL"
		: shared.unsupported.length ? "UNSUPPORTED"
		: suggested                 ? "SUGGEST"
		: groups                    ? "PASS"
		: shared.checked.length     ? "NO_GROUPS"
		: deleted.length            ? "DELETED_ONLY"
		: "NO_CHANGES";
	if (
		   parsedCoverage.changedFiles     !== shared.files.length
		|| parsedCoverage.checkedFiles     !== shared.checked.length
		|| parsedCoverage.unsupportedFiles !== shared.unsupported.length
		|| parsedCoverage.deletedFiles     !== deleted.length
		|| parsedCoverage.filesWithGroups  !== filesWithGroups
		|| parsedCoverage.groups           !== groups
	) throw new Error(`${where}.coverage: counts do not match receipt contents`);
	if (new Set(partition).size !== partition.length || partition.some(file => !shared.files.includes(file)) || partition.length !== shared.files.length) {
		throw new Error(`${where}: checked, unsupported and deleted files must be a disjoint partition of files`);
	}
	if (shared.state !== expectedState) throw new Error(`${where}.state: expected ${expectedState}`);

	return { schemaVersion: 1, ...shared, deleted, coverage: parsedCoverage };
}

export function parseLifecycleReceipt(text: string, where = "lifecycle receipt"): LifecycleReceipt {
	if (Buffer.byteLength(text) > LIFECYCLE_RECEIPT_MAX_BYTES) throw new Error(`${where}: exceeds ${LIFECYCLE_RECEIPT_MAX_BYTES} bytes`);
	let value: unknown;
	try { value = JSON.parse(text); }
	catch (error) { throw new Error(`${where}: malformed JSON: ${error instanceof Error ? error.message : String(error)}`); }
	const receipt = record(value, where);
	if (receipt.schemaVersion !== undefined) return validateLifecycleReceipt(receipt, where);

	return sharedReceipt(receipt, where, false);
}

export function readLifecycleReceipt(path: string): LifecycleReceipt {
	const status = lstatSync(path);
	if (!status.isFile() || status.isSymbolicLink()) throw new Error(`${path}: receipt must be a regular file, not a symlink`);
	if (status.size > LIFECYCLE_RECEIPT_MAX_BYTES) throw new Error(`${path}: exceeds ${LIFECYCLE_RECEIPT_MAX_BYTES} bytes`);

	return parseLifecycleReceipt(readFileSync(path, "utf8"), path);
}

export function encodeLifecycleReceipt(value: LifecycleReceiptV1): string {
	const text = `${JSON.stringify(validateLifecycleReceipt(value), null, 2)}\n`;
	if (Buffer.byteLength(text) > LIFECYCLE_RECEIPT_MAX_BYTES) throw new Error(`lifecycle receipt: exceeds ${LIFECYCLE_RECEIPT_MAX_BYTES} bytes`);

	return text;
}
