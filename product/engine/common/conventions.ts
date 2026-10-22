import { ruleData } from "@/rule-data.ts";
/**
 * Pattern DB (M1.8 S5a): reads and looks up the pattern records the checker queries for each table. Lookup is only an exact lookup-key match plus a scope (glob);
 * similarity is never used (charter invariant 7). Layers win in the order project → user → preset. The existing report loader
 * reads only the project (`.boxbox/conventions.jsonl`) and preset (`presets/recommended/conventions.jsonl`) layers; the approval-gate loader takes the user root explicitly.
 * Within one layer, scopes with the same key and the same specificity that state different statuses are a conflict (file order never decides).
 * `rejected` means "do not fix automatically"; it never disturbs code that is already aligned. At this stage the result is only reported.
 */
import      { existsSync, readFileSync } from "node:fs"                               ;
import      { join                     } from "node:path"                             ;
import      { parseRecords             } from "@/common/examples.ts"                  ;
import      { isPattern, type Pattern  } from "@/common/grammar-ids.ts"               ;
import      {
              runtimeNumberRecord    ,
              runtimeRecord          ,
              runtimeString          ,
              runtimeStringArray     ,
                                       } from "@/common/runtime-record-validation.ts" ;
import      { LOOKUP_KEY_VERSION       } from "@/common/signature.ts"                 ;

export const CONVENTION_SCHEMA_VERSION = 1;

export type ConventionStatus = "approved" | "rejected" | "candidate";
export type ConventionLayer  = "project" | "user" | "preset";

export interface Convention {
	readonly schemaVersion : number                           ;
	readonly id            : string                           ;
	readonly key           : string                           ;
	readonly pattern       : Pattern                          ;
	readonly status        : ConventionStatus                 ;
	readonly scope         : string                           ;
	readonly examples?     : readonly string[]                ;
	readonly evidence?     : Readonly<Record<string, number>> ;
	readonly versions      : Readonly<Record<string, number>> ;
	readonly approvedBy    : string                           ;
	readonly date          : string                           ;
}

export interface LoadedConvention extends Convention {
	readonly layer : ConventionLayer;
}

export type LookupStatus = "approved" | "rejected" | "unknown" | "conflict";

export interface LookupResult {
	readonly status : LookupStatus    ;
	readonly id?    : string          ;
	readonly layer? : ConventionLayer ;
}

const STATUSES: readonly string[] = ["approved", "rejected", "candidate"];

/** Validates one record. A malformed record is an error, never silently skipped. */
export function validateConvention(value: unknown, where: string): Convention {
	const record = runtimeRecord(value, where);
	if (record.schemaVersion !== CONVENTION_SCHEMA_VERSION) throw new Error(`${where}: schemaVersion must be ${CONVENTION_SCHEMA_VERSION}`);
	runtimeString(record.id, `${where}.id`);
	if (typeof record.key !== "string" || !/^v\d+\|[^|]+\|[^|]+\|[^|]+\|/u.test(record.key)) throw new Error(`${where}: key must look like v<n>|language|context|kind|axes`);
	if (!isPattern(record.pattern)) throw new Error(`${where}: unknown pattern ${String(record.pattern)}`);
	if (!STATUSES.includes(record.status as string)) throw new Error(`${where}: status must be approved, rejected or candidate`);
	runtimeString      (record.scope     , `${where}.scope`                  ) ;
	runtimeNumberRecord(record.versions  , `${where}.versions`               ) ;
	runtimeString      (record.approvedBy, `${where}.approvedBy`, true        ) ;
	runtimeString      (record.date      , `${where}.date`, true              ) ;
	if (record.examples !== undefined) runtimeStringArray (record.examples, `${where}.examples`) ;
	if (record.evidence !== undefined) runtimeNumberRecord(record.evidence, `${where}.evidence`) ;

	return record as unknown as Convention;
}

/** Reads a JSONL body. Blank lines are skipped; a duplicate id within the same layer is an error. */
export function parseConventions(text: string, layer: ConventionLayer, where: string): readonly LoadedConvention[] {
	return parseRecords(text, where, validateConvention).map(record => ({ ...record, layer }));
}

/** Lookup DB: (key → records). Records whose key version is not current are not looked up and are counted as stale. */
export interface ConventionDb {
	readonly byKey : ReadonlyMap<string, readonly LoadedConvention[]> ;
	readonly stale : number                                           ;
	readonly total : number                                           ;
}

export function indexConventions(records: readonly LoadedConvention[]): ConventionDb {
	const byKey = new Map<string, LoadedConvention[]>() ;
	let stale   = 0                                     ;

	for (const record of records) {
		if (!record.key.startsWith(`v${LOOKUP_KEY_VERSION}|`)) {
			stale += 1;
			continue;
		}

		const bucket = byKey.get(record.key) ?? [];
		bucket.push(record);
		byKey.set(record.key, bucket);
	}
	return { byKey, stale, total: records.length };
}

const PRESET = ruleData("presets/recommended/conventions.jsonl");

/** Reads the preset and project DBs. A missing file means that layer is empty. */
export function loadConventions(projectRoot: string): ConventionDb {
	const project = join(projectRoot, ".boxbox", "conventions.jsonl")                                                                                                        ;
	const read    = (path: string, layer: ConventionLayer): readonly LoadedConvention[] => existsSync(path) ? parseConventions(readFileSync(path, "utf8"), layer, path) : [] ;

	return indexConventions([...read(project, "project"), ...read(PRESET, "preset")]);
}

/** Glob to regex: `**` spans several path segments, `*` stays within one, `?` is one character. Paths are normalized to `/` before comparing. */
export function globToRegExp(glob: string): RegExp {
	let source = "";
	for (let index = 0; index < glob.length; index += 1) {
		const character = glob[index]!;
		if (character === "*" && glob[index + 1] === "*") {
			source += ".*";
			index += glob[index + 2] === "/" ? 2 : 1;
		} else if (character === "*") {
			source += "[^/]*";
		} else if (character === "?") {
			source += "[^/]";
		} else {
			source += character.replace(/[.+^${}()|[\]\\]/gu, "\\$&");
		}
	}
	return new RegExp(`^${source}$`, "u");
}

/** Scope specificity: the number of non-wildcard characters. Larger is more specific. */
const specificity = (scope: string): number => scope.replace(/[*?]/gu, "").length;

/**
 * Lookup: in project → user → preset order, among records with the same key whose scope matches the file, pick the most specific scope.
 * If the most specific records state different statuses, it is a conflict. A candidate is not an approval, so it counts as unknown.
 */
export function lookup(db: ConventionDb, key: string, file: string): LookupResult {
	const path       = file.replaceAll("\\", "/").replace(/^\.\//u, "")                                  ;
	const candidates = (db.byKey.get(key) ?? []).filter(record => globToRegExp(record.scope).test(path)) ;

	for (const layer of ["project", "user", "preset"] as const) {
		const inLayer = candidates.filter(record => record.layer === layer);
		if (inLayer.length === 0) continue;

		const top      = Math.max(...inLayer.map(record => specificity(record.scope)))                                                      ;
		const winners  = inLayer.filter(record => specificity(record.scope) === top).sort((left, right) => left.id.localeCompare(right.id)) ;
		const statuses = new Set(winners.map(record => record.status))                                                                      ;
		if (statuses.size > 1) return { status: "conflict", id: winners.map(record => record.id).join(","), layer };

		const winner = winners[0]!;

		return { status: winner.status === "candidate" ? "unknown" : winner.status, id: winner.id, layer };
	}
	return { status: "unknown" };
}
