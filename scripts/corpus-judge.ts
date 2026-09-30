#!/usr/bin/env bun
/**
 * Corpus judging (plan M1.5 D3): exports representative tables per signature type into
 * TEST_COMPLETED/corpus/<language>/<rank>-<slug>/ (repN-original.txt, repN-aligned.txt, context.txt) and
 * renders TEST_COMPLETED/corpus/SUMMARY.txt with one `approved` / `judged-<verdict>` / `unjudged` line per
 * type. The user judges a type by rank; verdicts are appended to corpus/verdicts.jsonl (committed — verdict
 * records only, never third-party source).
 *
 * Usage:
 *   bun scripts/corpus-judge.ts                                # export representatives + SUMMARY (all types)
 *   bun scripts/corpus-judge.ts --limit 40 --reps 2            # cap types and representatives
 *   bun scripts/corpus-judge.ts --verdict 3 correct            # judge the type at rank 3
 *   bun scripts/corpus-judge.ts --verdict 7 "missing-kind" --note "argv-like lists"
 *   bun scripts/corpus-judge.ts --status                       # print the SUMMARY
 *
 * A representative is aligned in a throwaway copy of the whole source file: alignment is whitespace-only and
 * keeps the line count, EXCEPT the declaration vertical form which inserts breaks — when the slice counts
 * drift, aligned.txt carries the original lines with a note instead of a wrong slice.
 */
import      {
              copyFileSync   ,
              existsSync     ,
              mkdirSync      ,
              readFileSync   ,
              rmSync         ,
              writeFileSync  ,
                               } from "node:fs"                ;
import      { join             } from "node:path"              ;
import      { spawnSync        } from "node:child_process"     ;
import      { createHash       } from "node:crypto"            ;
import      { readCensusReport } from "./corpus-signatures.ts" ;

const ROOT     = join(import.meta.dir, "..")                                      ;
const CACHE    = join(process.env["HOME"] ?? "", ".cache", "xxx", "corpus")       ;
const OUT      = join(ROOT, "TEST_COMPLETED", "corpus")                           ;
const LOG      = join(ROOT, "corpus", "verdicts.jsonl")                           ;
const VERDICTS = ["correct", "different-role", "missing-kind", "taste", "unsure"] ;

interface TableSpot {
	readonly source    : string ;
	readonly file      : string ;
	readonly startLine : number ;
	readonly endLine   : number ;
	readonly rows      : number ;
}

interface SignatureType {
	readonly signature : string                           ;
	readonly language  : string                           ;
	readonly kind      : string                           ;
	readonly states    : Readonly<Record<string, number>> ;
	readonly count     : number                           ;
	readonly rows      : number                           ;
	readonly edits     : number                           ;
	readonly score     : number                           ;
	readonly examples  : readonly TableSpot[]             ;
}

interface VerdictRecord {
	readonly schemaVersion : number ;
	readonly signature     : string ;
	readonly verdict       : string ;
	readonly judge         : string ;
	readonly date          : string ;
	readonly note          : string ;
}

/** Short unique directory name for a type: rank, sanitized kind, depth, signature hash. */
export function typeSlug(signature: string, rank: number): string {
	const parts = signature.split("|")                                           ;
	const kind  = (parts[2] ?? "type").replace(/[^A-Za-z0-9]+/gu, "-")           ;
	const depth = (parts[4] ?? "d0").replace(/\D/gu, "") || "0"                  ;
	const hash  = createHash("sha1").update(signature).digest("hex").slice(0, 8) ;
	return `${String(rank).padStart(3, "0")}-${kind.slice(0, 32)}-d${depth}-${hash}` ;
}

/** Parses the verdict log; the LAST record for a signature wins. */
export function latestVerdicts(logLines: readonly string[]): ReadonlyMap<string, VerdictRecord> {
	const latest = new Map<string, VerdictRecord>()                                     ;
	for (const line of logLines) {
		const trimmed = line.trim()                                                     ;
		if (trimmed === "") continue                                                    ;
		const record = JSON.parse(trimmed) as VerdictRecord                             ;
		latest.set(record.signature, record)                                            ;
	}
	return latest                                                                       ;
}

export function renderSummary(types: readonly { readonly signature: string; readonly count: number; readonly edits: number }[], verdicts: ReadonlyMap<string, VerdictRecord>): string {
	const lines = [`corpus judging — ${types.length} types`, `verdicts: ${VERDICTS.join(" | ")}`]         ;
	types.forEach((type, index) => {
		const record = verdicts.get(type.signature)                                                                               ;
		const state  = record === undefined ? "unjudged" : record.verdict === "correct" ? "approved" : `judged-${record.verdict}` ;
		lines.push(`${String(index + 1).padStart(3, "0")}  ${state.padEnd(18)} count=${String(type.count).padStart(5)} edits=${String(type.edits).padStart(5)}  ${type.signature}`) ;
	})                                                                                                  ;
	return `${lines.join("\n")}\n`                                                                      ;
}

function alignedSlice(language: string, absolute: string, before: string, startLine: number, endLine: number): { readonly lines: readonly string[]; readonly note: string } {
	const aligner = language === "typescript"
		? join(ROOT, "skills", "xxx", "scripts", "typescript", "06_align-tables.ts")
		: join(ROOT, "skills", "xxx", "scripts", "python", "06_align-tables.ts")                        ;
	const result = spawnSync("bun", [aligner, "--file", absolute, "--write"], { encoding: "utf8", timeout: 300_000 }) ;
	if (result.status !== 0) return { lines: [], note: `alignment failed: ${result.stderr.toString().split("\n")[0]}` }  ;
	const afterLines  = readFileSync(absolute, "utf8").split("\n") ;
	const beforeLines = before.split("\n")                         ;
	if (afterLines.length === beforeLines.length) {
		return { lines: afterLines.slice(startLine - 1, endLine).map(line => line.replace(/\r$/u, "")), note: "" }       ;
	}
	// the vertical form inserted breaks somewhere in the file — the slice would be wrong, so show the original
	return { lines: beforeLines.slice(startLine - 1, endLine).map(line => line.replace(/\r$/u, "")), note: "the aligned file has a different line count here (vertical form); showing the original lines" } ;
}

function exportRepresentatives(limit: number, reps: number): void {
	const report = readCensusReport<SignatureType>() ;
	const types  = report.types.slice(0, limit)      ;
	mkdirSync(OUT, { recursive: true })                                                                                  ;
	const work  = join(OUT, ".work")                                                                                     ;
	mkdirSync(work, { recursive: true })                                                                                 ;
	try {
		for (const [index, type] of types.entries()) {
			const rank = index + 1                                                ;
			const dir  = join(OUT, type.language, typeSlug(type.signature, rank)) ;
			mkdirSync(dir, { recursive: true })                                                                          ;
			writeFileSync(join(dir, "context.txt"), `${JSON.stringify({ signature: type.signature, count: type.count, edits: type.edits, states: type.states, representatives: type.examples.slice(0, reps) }, null, 2)}\n`) ;
			for (const [position, spot] of type.examples.slice(0, reps).entries()) {
				const originalPath = join(CACHE, spot.source, spot.file)                                                 ;
				if (!existsSync(originalPath)) continue                                                                  ;
				const before        = readFileSync(originalPath, "utf8")                                                               ;
				const originalLines = before.split("\n").slice(spot.startLine - 1, spot.endLine).map(line => line.replace(/\r$/u, "")) ;
				const tag           = `rep${position + 1}`                                                                             ;
				writeFileSync(join(dir, `${tag}-original.txt`), `${originalLines.join("\n")}\n`)                         ;
				const tempFile = join(work, `${typeSlug(type.signature, rank)}-${tag}`.replace(/[^\w.-]+/gu, "_") + (spot.file.endsWith(".py") ? ".py" : ".ts")) ;
				copyFileSync(originalPath, tempFile)                                                                     ;
				const aligned = alignedSlice(type.language, tempFile, before, spot.startLine, spot.endLine)                       ;
				const body    = aligned.note === "" ? aligned.lines.join("\n") : `# ${aligned.note}\n${originalLines.join("\n")}` ;
				writeFileSync(join(dir, `${tag}-aligned.txt`), `${body}\n`)                                              ;
			}
		}
	} finally {
		rmSync(work, { recursive: true, force: true })                                                                   ;
	}
}

function renderTypeSummary(): string {
	const report = readCensusReport<SignatureType>()                            ;
	const log    = existsSync(LOG) ? readFileSync(LOG, "utf8").split("\n") : [] ;
	return renderSummary(report.types, latestVerdicts(log))                                                              ;
}

function recordVerdict(rank: number, verdict: string, note: string): void {
	if (!VERDICTS.includes(verdict)) throw new Error(`unknown verdict "${verdict}" — use one of: ${VERDICTS.join(", ")}`) ;
	const report = readCensusReport<SignatureType>() ;
	const type   = report.types[rank - 1]            ;
	if (type === undefined) throw new Error(`no type at rank ${rank} — the report holds ${report.types.length} types`)     ;
	const record: VerdictRecord = { schemaVersion: 1, signature: type.signature, verdict, judge: "user", date: new Date().toISOString().slice(0, 10), note } ;
	writeFileSync(LOG, `${existsSync(LOG) ? readFileSync(LOG, "utf8") : ""}${JSON.stringify(record)}\n`)                   ;
	console.log(`verdict recorded: rank ${rank} ${verdict} — ${type.signature}`)                                           ;
}

const args = process.argv.slice(2)                                                                                ;
const flag = (name: string): string | undefined => args.includes(name) ? args[args.indexOf(name) + 1] : undefined ;
if (args.includes("--verdict")) {
	const rank    = Number(flag("--verdict"))                 ;
	const verdict = args[args.indexOf("--verdict") + 2] ?? "" ;
	recordVerdict(rank, verdict, flag("--note") ?? "")                    ;
} else if (args.includes("--status")) {
	console.log(renderTypeSummary())                                      ;
} else {
	const limit  = Number(flag("--limit") ?? Number.MAX_SAFE_INTEGER) ;
	const reps   = Number(flag("--reps") ?? 2)                        ;
	const report = readCensusReport<SignatureType>()                  ;
	exportRepresentatives(limit, reps)                                                                               ;
	writeFileSync(join(OUT, "SUMMARY.txt"), renderTypeSummary())                                                     ;
	console.log(`corpus-judge exported ${Math.min(limit, report.types.length)} types to ${OUT}`)                     ;
}
