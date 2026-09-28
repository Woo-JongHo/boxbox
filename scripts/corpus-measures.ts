#!/usr/bin/env bun
/**
 * Corpus measures (plan M1.5 D5): per language, the judged share of types and of tables, and the
 * wrong-grouping rate from the verdict records — `different-role` (rows grouped that are not one role) and
 * `missing-kind` (the table should have been another, unregistered kind) count as grouping misses;
 * `taste` and `unsure` are judgments, not misses. With --baseline <report.json>, the share of the current
 * census types that never appeared in the baseline is reported as the unseen-type share (design §6 D5).
 *
 * Usage:
 *   bun scripts/corpus-measures.ts
 *   bun scripts/corpus-measures.ts --baseline <signatures.json>
 */
import      {
              existsSync   ,
              readFileSync ,
                             } from "node:fs"   ;
import      { join           } from "node:path" ;

const ROOT   = join(import.meta.dir, "..")                                ;
const CACHE  = join(process.env["HOME"] ?? "", ".cache", "xxx", "corpus") ;
const REPORT = join(CACHE, "signatures.json")                             ;
const LOG    = join(ROOT, "corpus", "verdicts.jsonl")                     ;

interface SignatureType {
	readonly signature : string ;
	readonly language  : string ;
	readonly count     : number ;
	readonly state     : string ;
}

export interface Measures {
	readonly language       : string ;
	readonly types          : number ;
	readonly tables         : number ;
	readonly judgedTypes    : number ;
	readonly judgedTables   : number ;
	readonly wrongGroupings : number ;
	readonly judgedShare    : number ;
	readonly tableShare     : number ;
	readonly wrongGrouping  : number ;
}

/** Verdict state per signature from the jsonl log; the LAST record for a signature wins. */
export function verdictOf(logLines: readonly string[]): ReadonlyMap<string, string> {
	const latest = new Map<string, string>()                          ;
	for (const line of logLines) {
		const trimmed = line.trim()                                   ;
		if (trimmed === "") continue                                  ;
		const record = JSON.parse(trimmed) as { readonly signature: string; readonly verdict: string } ;
		latest.set(record.signature, record.verdict)                  ;
	}
	return latest                                                     ;
}

export function measuresOf(types: readonly SignatureType[], verdicts: ReadonlyMap<string, string>): ReadonlyMap<string, Measures> {
	const grouped = new Map<string, SignatureType[]>()                                   ;
	for (const type of types) {
		const bucket = grouped.get(type.language) ?? []                                  ;
		bucket.push(type)                                                                ;
		grouped.set(type.language, bucket)                                               ;
	}
	const measures = new Map<string, Measures>()                                         ;
	for (const [language, bucket] of grouped) {
		const judged       = bucket.filter(type => verdicts.has(type.signature)) ;
		const judgedTables = judged.reduce((sum, type) => sum + type.count, 0)   ;
		const tables       = bucket.reduce((sum, type) => sum + type.count, 0)   ;
		const misses       = judged.filter(type => {
			const verdict = verdicts.get(type.signature)                                 ;
			return verdict === "different-role" || verdict === "missing-kind"            ;
		}).reduce((sum, type) => sum + type.count, 0)                                    ;
		measures.set(language, {
			language       : language                                                       ,
			types          : bucket.length                                                  ,
			tables         : tables                                                         ,
			judgedTypes    : judged.length                                                  ,
			judgedTables   : judgedTables                                                   ,
			wrongGroupings : misses                                                         ,
			judgedShare    : bucket.length === 0 ? 0 : judged.length / bucket.length        ,
			tableShare     : tables === 0 ? 0 : judgedTables / tables                       ,
			wrongGrouping  : judgedTables === 0 ? 0 : misses / judgedTables                 ,
		})                                                                                ;
	}
	return measures                                                                       ;
}

export function unseenShare(current: readonly { readonly signature: string }[], baseline: readonly { readonly signature: string }[]): number {
	if (baseline.length === 0) return 0                              ;
	const known = new Set(baseline.map(type => type.signature))      ;
	const fresh = current.filter(type => !known.has(type.signature)) ;
	return current.length === 0 ? 0 : fresh.length / current.length  ;
}

function main(): void {
	if (!existsSync(REPORT)) throw new Error(`no census report: ${REPORT} — run scripts/corpus-signatures.ts first`) ;
	const report      = JSON.parse(readFileSync(REPORT, "utf8")) as { readonly types: readonly SignatureType[] }                   ;
	const logPath     = join(ROOT, "corpus", "verdicts.jsonl")                                                                     ;
	const logLines    = existsSync(logPath) ? readFileSync(logPath, "utf8").split("\n") : []                                       ;
	const verdicts    = verdictOf(logLines)                                                                                        ;
	const measures    = measuresOf(report.types, verdicts)                                                                         ;
	const baselineArg = process.argv.indexOf("--baseline") >= 0 ? process.argv[process.argv.indexOf("--baseline") + 1] : undefined ;
	console.log(`measures language types tables judgedTypes judgedShare tableShare wrongGrouping`)                   ;
	for (const measure of [...measures.values()].sort((left, right) => left.language.localeCompare(right.language))) {
		console.log(`measures ${measure.language} ${measure.types} ${measure.tables} ${measure.judgedTypes} ${fraction(measure.judgedShare)} ${fraction(measure.tableShare)} ${fraction(measure.wrongGrouping)}`) ;
	}
	const judged = [...verdicts.keys()].length                                                                       ;
	console.log(`measures verdicts=${judged}`)                                                                       ;
	if (baselineArg !== undefined) {
		const baseline = JSON.parse(readFileSync(resolveBaseline(baselineArg), "utf8")) as { readonly types: readonly SignatureType[] } ;
		console.log(`measures unseenShare=${fraction(unseenShare(report.types, baseline.types))}`)                       ;
	} else {
		console.log("measures unseenShare=N/A (pass --baseline <signatures.json> to compare against an older census)")   ;
	}
}

function resolveBaseline(value: string): string {
	return existsSync(value) ? value : join(CACHE, value)                                                            ;
}

function fraction(value: number): string {
	return `${(value * 100).toFixed(1)}%`                                                                            ;
}

if (import.meta.main) main() ;
