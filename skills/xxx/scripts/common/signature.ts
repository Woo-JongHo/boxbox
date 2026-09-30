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
	return `${language}|${context}|${kind}|${axes.map(normalizeAxis).join(">")}|d${depth}` ;
}

/** Nesting depth of a line-engine table from its shared indentation (a tab counts as four columns). */
export function indentDepth(indent: string): number {
	return Math.floor(indent.replaceAll("\t", "    ").length / 4) ;
}
