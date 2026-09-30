/**
 * 표현형 (2층, M1.8 S3): 엔진이 찾은 표(kind 또는 축 순서)를 문법의 문형(1층)에 대응시킨다.
 * 대응 데이터는 `skills/xxx/base/<language>.json`에 있고, 이 모듈은 그것을 읽고 검증하고 찾기만 한다.
 * 엔진의 정렬 동작은 바꾸지 않는다 — 문형은 표에 붙는 이름이다.
 */
import      { readFileSync            } from "node:fs"          ;
import      { fileURLToPath           } from "node:url"         ;
import      { isPattern, type Pattern } from "./grammar-ids.ts" ;

export const SURFACE_SCHEMA_VERSION = 1;

/** 한 표현형: TypeScript는 kind로, 라인 엔진 언어는 축 순서의 앞부분으로 찾는다. */
export interface SurfaceForm {
	readonly kind?       : string            ;
	readonly hasAxis?    : string            ;
	readonly axesPrefix? : readonly string[] ;
	readonly pattern     : Pattern           ;
	/** 엔진이 가를 수 없는 다른 문형. 있으면 이 표의 문형은 모호하다. */
	readonly alternatives? : readonly Pattern[]    ;
	readonly note?         : string                ;
}

export interface SurfaceData {
	readonly schemaVersion : number                 ;
	readonly language      : string                 ;
	readonly forms         : readonly SurfaceForm[] ;
}

export interface PatternMatch {
	readonly pattern      : Pattern            ;
	readonly alternatives : readonly Pattern[] ;
}

/** 데이터 한 벌을 검증한다. 문법에 없는 ID, 찾는 방법이 없거나 둘 다 있는 형태는 오류다. */
export function validateSurface(value: unknown, language: string): SurfaceData {
	const data = value as SurfaceData;
	if (data?.schemaVersion !== SURFACE_SCHEMA_VERSION) throw new Error(`surface ${language}: schemaVersion must be ${SURFACE_SCHEMA_VERSION}`);
	if (data.language !== language) throw new Error(`surface ${language}: language field is ${String(data.language)}`);
	if (!Array.isArray(data.forms) || data.forms.length === 0) throw new Error(`surface ${language}: forms must be a non-empty array`);
	for (const [index, form] of data.forms.entries()) {
		const where = `surface ${language} form ${index}`                                                                              ;
		if (!isPattern(form.pattern)) throw new Error(`${where}: unknown pattern ${String(form.pattern)}`)                             ;
		for (const alternative of form.alternatives ?? []) {
			if (!isPattern(alternative)) throw new Error(`${where}: unknown alternative ${String(alternative)}`);
		}
		const byKind = typeof form.kind === "string"                                ;
		const byAxes = Array.isArray(form.axesPrefix) && form.axesPrefix.length > 0 ;
		if (byKind === byAxes) throw new Error(`${where}: exactly one of kind or axesPrefix is required`);
	}
	return data;
}

const loaded = new Map<string, SurfaceData>();

/** `skills/xxx/base/<language>.json`을 읽는다. 데이터가 없는 언어는 undefined. */
export function surfaceOf(language: string): SurfaceData | undefined {
	const cached = loaded.get(language)                                                   ;
	if (cached) return cached                                                             ;
	let text: string                                                                      ;
	try {
		text = readFileSync(fileURLToPath(new URL(`../../base/${language}.json`, import.meta.url)), "utf8");
	} catch {
		return undefined;
	}
	const data = validateSurface(JSON.parse(text), language)                              ;
	loaded.set(language, data)                                                            ;
	return data                                                                           ;
}

/** 축 id에서 열 위치(`=17`)를 뗀다. */
const bareAxis = (axis: string): string => axis.split("=")[0]!;

/** 표 하나의 문형. 첫 번째로 맞는 형태가 이긴다. 맞는 형태가 없으면 undefined(알람 A8의 대상). */
export function patternOf(language: string, table: { readonly kind?: string; readonly axes: readonly string[] }): PatternMatch | undefined {
	const data = surfaceOf(language)                                                                                    ;
	if (!data) return undefined                                                                                         ;
	const axes = table.axes.map(bareAxis)                                                                               ;
	for (const form of data.forms) {
		if (form.kind !== undefined) {
			if (form.kind !== table.kind) continue                                                                      ;
			if (form.hasAxis !== undefined && !axes.includes(form.hasAxis)) continue                                    ;
		} else if (!form.axesPrefix!.every((axis, index) => axes[index] === axis)) continue;
		return { pattern: form.pattern, alternatives: form.alternatives ?? [] };
	}
	return undefined;
}
