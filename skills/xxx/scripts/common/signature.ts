/**
 * Pattern identity (design §4.1, plan M1.7 P1): the key under which a table's pattern is judged, approved and looked
 * up. The key is (language, container context, kind, ordered axis ids, nesting depth) — never the result state, so a
 * table keeps its key before and after it is aligned. The key format is a public contract: any change to it bumps
 * SIGNATURE_VERSION, and stored records keyed by an older version must be migrated, never matched loosely.
 */
export const SIGNATURE_VERSION = 1;

/** Normalizes one axis id for typing: `axis=target` loses its column, digit runs become `{i}`, a callee becomes `call:*`. */
export function normalizeAxis(axis: string): string {
	const bare  = axis.split("=")[0]!                  ;
	const typed = bare.replace(/^call:.+$/u, "call:*") ;
	return typed.replace(/\d+/gu, "{i}")               ;
}

/** The identity key of one table: `language|context|kind|axis>axis|d<depth>`. */
export function signatureOf(language: string, context: string, kind: string, axes: readonly string[], depth: number): string {
	return `${language}|${context}|${kind}|${axes.map(normalizeAxis).join(">")}|d${depth}`;
}

/** Nesting depth of a line-engine table from its shared indentation (a tab counts as four columns). */
export function indentDepth(indent: string): number {
	return Math.floor(indent.replaceAll("\t", "    ").length / 4) ;
}

/**
 * 패턴 DB 조회 키 (M1.8 S5a, docs/reviews/2026-09-30-codex-lookup-review.md). 진단용 시그니처와 달리 깊이를 빼서
 * 같은 모양의 표가 들여쓰기와 상관없이 한 패턴으로 묶인다. 버전이 앞에 붙으므로 형식이 바뀌면 옛 키는 조회되지 않는다
 * (명시적 마이그레이션만). 비어 있는 context(라인 엔진)는 `-`로 적는다.
 */
export const LOOKUP_KEY_VERSION = 1;

export function lookupKeyOf(language: string, context: string | undefined, kind: string, axes: readonly string[]): string {
	return `v${LOOKUP_KEY_VERSION}|${language}|${context || "-"}|${kind}|${axes.map(normalizeAxis).join(">")}`;
}
