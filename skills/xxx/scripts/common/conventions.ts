/**
 * 패턴 DB (M1.8 S5a): 검사기가 표마다 조회하는 패턴 레코드를 읽고 찾는다. 조회는 조회 키의 정확 일치와 범위(glob)뿐이며,
 * 유사도는 쓰지 않는다(헌장 불변식 7). 층은 project → user → preset 순으로 이긴다. 기존 report loader는
 * 프로젝트(`.xxx/conventions.jsonl`)와 preset(`presets/recommended/conventions.jsonl`)만 읽고, 승인 gate loader가 user root를 명시적으로 받는다.
 * 같은 층에서 같은 키·같은 구체성의 범위가 서로 다른 상태를 말하면 충돌이다(파일 순서로 정하지 않는다).
 * `rejected`는 "자동 수정하지 않는다"는 뜻이며 이미 정렬된 코드를 흐트러뜨리지 않는다. 이 단계에서는 결과를 보고만 한다.
 */
import      { existsSync, readFileSync } from "node:fs"          ;
import      { join                     } from "node:path"        ;
import      { fileURLToPath            } from "node:url"         ;
import      { isPattern, type Pattern  } from "./grammar-ids.ts" ;
import      { LOOKUP_KEY_VERSION       } from "./signature.ts"   ;

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

/** 레코드 하나를 검증한다. 틀린 레코드는 조용히 넘기지 않고 오류다. */
export function validateConvention(value: unknown, where: string): Convention {
	const record = value as Convention;
	if (record?.schemaVersion !== CONVENTION_SCHEMA_VERSION) throw new Error(`${where}: schemaVersion must be ${CONVENTION_SCHEMA_VERSION}`);
	if (typeof record.id !== "string" || record.id === "") throw new Error(`${where}: id is required`);
	if (typeof record.key !== "string" || !/^v\d+\|[^|]+\|[^|]+\|[^|]+\|/u.test(record.key)) throw new Error(`${where}: key must look like v<n>|language|context|kind|axes`);
	if (!isPattern(record.pattern)) throw new Error(`${where}: unknown pattern ${String(record.pattern)}`);
	if (!STATUSES.includes(record.status)) throw new Error(`${where}: status must be approved, rejected or candidate`);
	if (typeof record.scope !== "string" || record.scope === "") throw new Error(`${where}: scope is required (use "**" for everything)`);
	if (typeof record.approvedBy !== "string" || typeof record.date !== "string") throw new Error(`${where}: approvedBy and date are required`);

	return record;
}

/** JSONL 본문을 읽는다. 빈 줄은 건너뛰고, 같은 층 안의 중복 id는 오류다. */
export function parseConventions(text: string, layer: ConventionLayer, where: string): readonly LoadedConvention[] {
	const records: LoadedConvention[] = []                ;
	const ids                         = new Set<string>() ;

	for (const [index, line] of text.split("\n").entries()) {
		if (line.trim() === "") continue;

		const record = validateConvention(JSON.parse(line), `${where}:${index + 1}`);
		if (ids.has(record.id)) throw new Error(`${where}:${index + 1}: duplicate id ${record.id}`);

		ids.add(record.id);
		records.push({ ...record, layer });
	}
	return records;
}

/** 조회용 DB: (키 → 레코드들). 현재 키 버전이 아닌 레코드는 조회되지 않고 stale로 센다. */
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

const PRESET = fileURLToPath(new URL("../../presets/recommended/conventions.jsonl", import.meta.url));

/** preset과 프로젝트 DB를 읽는다. 파일이 없으면 그 층은 비어 있다. */
export function loadConventions(projectRoot: string): ConventionDb {
	const project = join(projectRoot, ".xxx", "conventions.jsonl")                                                                                                           ;
	const read    = (path: string, layer: ConventionLayer): readonly LoadedConvention[] => existsSync(path) ? parseConventions(readFileSync(path, "utf8"), layer, path) : [] ;

	return indexConventions([...read(project, "project"), ...read(PRESET, "preset")]);
}

/** glob을 정규식으로: `**`는 경로 여러 단계, `*`는 한 단계 안, `?`는 한 글자. 경로는 `/`로 정규화해 비교한다. */
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

/** 범위의 구체성: 와일드카드가 아닌 글자 수. 클수록 구체적이다. */
const specificity = (scope: string): number => scope.replace(/[*?]/gu, "").length;

/**
 * 조회: project → user → preset 순서로, 키가 같고 범위가 파일에 맞는 레코드 중 가장 구체적인 범위를 고른다.
 * 가장 구체적인 레코드들이 서로 다른 상태면 충돌이다. candidate는 승인이 아니므로 unknown으로 본다.
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
