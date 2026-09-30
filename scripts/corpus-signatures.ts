#!/usr/bin/env bun
/**
 * Corpus census (plan M1.5 D2): runs the aligners over the fetched corpus and collapses every detected table
 * into a signature type — the pattern identity of skills/xxx/scripts/common/signature.ts (language, container context,
 * kind, ordered axis IDs, nesting depth); result states are counted per type, not keyed (design §4.1). Thousands of tables collapse into a few hundred types, ranked by frequency × risk so the judged
 * representatives of D3 sample the tables that matter first. The report is written to
 * ~/.cache/xxx/corpus/signatures.json; third-party source never enters this repository.
 *
 * TypeScript files load through the TypeScript 7 server (~0.3 s per file), so each source is capped with
 * --max-files (default 400, walked in sorted order for determinism; symlinked directories count once);
 * .tsx and .d.ts are skipped. Python runs through the in-process line engine under the same cap — it is fast,
 * so raise --max-files to scan a whole tree. Local-only sources are included when present.
 */
import      {
              existsSync                                ,
              readdirSync                               ,
              readFileSync                              ,
              realpathSync                              ,
              statSync                                  ,
              mkdirSync                                 ,
              writeFileSync                             ,
                                                          } from "node:fs"                         ;
import      { homedir                                     } from "node:os"                         ;
import      { join, relative                              } from "node:path"                       ;
import      { API                                         } from "typescript/unstable/async"       ;
import      { alignSource                                 } from "@/common/table-engine.ts"        ;
import      { PYTHON_ALIGNER                              } from "@/python/profile.ts"             ;
import      { indentDepth, signatureOf, SIGNATURE_VERSION } from "@/common/signature.ts"           ;
import      { censusGroups, groupPreserved                } from "@/typescript/06_align-tables.ts" ;

const ROOT  = join(import.meta.dir, "..")                ;
const CACHE = join(homedir(), ".cache", "xxx", "corpus") ;

interface CorpusSource {
	readonly id         : string            ;
	readonly language   : string            ;
	readonly repository : string            ;
	readonly commit     : string            ;
	readonly license    : string            ;
	readonly paths      : readonly string[] ;
}

interface CorpusManifest {
	readonly schemaVersion : number                  ;
	readonly sources       : readonly CorpusSource[] ;
}

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

/** Reads a census report; an older report (keyed with the result state) must be regenerated, never matched. */
export function readCensusReport<T>(path: string = join(CACHE, "signatures.json")): { readonly types: readonly T[] } {
	if (!existsSync(path)) throw new Error(`no census report: ${path} — run scripts/corpus-signatures.ts first`)             ;
	const report = JSON.parse(readFileSync(path, "utf8")) as { readonly schemaVersion?: number; readonly signatureVersion?: number; readonly types: readonly T[] } ;
	if (report.schemaVersion !== 2 || report.signatureVersion !== SIGNATURE_VERSION) throw new Error(`stale census report: ${path} — rerun scripts/corpus-signatures.ts`) ;
	return report                                                                                                              ;
}

const readManifest = (name: string): CorpusManifest => {
	const path = join(ROOT, "corpus", name)                                                    ;
	if (!existsSync(path)) {
		// the committed manifest is required; local.json is optional
		if (name === "manifest.json") throw new Error(`missing manifest: ${path}`)             ;
		return { schemaVersion: 1, sources: [] }                                               ;
	}
	const parsed = JSON.parse(readFileSync(path, "utf8")) as CorpusManifest                    ;
	if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.sources)) throw new Error(`bad manifest: ${path}`) ;
	return parsed                                                                              ;
} ;


function walkFiles(root: string, extension: string, limit: number): readonly string[] {
	const found: string[] = []                ;
	const seen            = new Set<string>() ;
	const visit = (dir: string): void => {
		if (found.length >= limit) return                               ;
		let entries: string[]                                           ;
		try {
			entries = readdirSync(dir).sort()                           ;
		} catch {
			return                                                      ;
		}
		for (const entry of entries) {
			if (found.length >= limit) return                           ;
			const full = join(dir, entry)                               ;
			// real paths dedup symlinked directories, so a tree reachable twice is counted once
			let real: string                                            ;
			let isDirectory = false                                     ;
			try {
				real        = realpathSync(full)                        ;
				isDirectory = statSync(full).isDirectory()              ;
			} catch {
				continue                                                ;
			}
			if (seen.has(real)) continue                                ;
			seen.add(real)                                              ;
			if (isDirectory) {
				// hidden directories (.github, .agents, …) and vendor trees are not product source
				if (entry === "node_modules" || entry.startsWith(".")) continue ;
				visit(full)                                             ;
				continue                                                ;
			}
			if (!entry.endsWith(extension)) continue                    ;
			if (entry.endsWith(".d.ts") || entry.endsWith(".tsx")) continue ;
			found.push(full)                                            ;
		}
	}                                                                 ;
	visit(root)                                                       ;
	return found                                                      ;
}

interface CensusRow {
	readonly signature : string    ;
	readonly language  : string    ;
	readonly kind      : string    ;
	readonly state     : string    ;
	readonly rows      : number    ;
	readonly edits     : number    ;
	readonly spot      : TableSpot ;
}

interface CensusResult {
	readonly files          : number               ;
	readonly rows           : readonly CensusRow[] ;
	readonly failedBatches? : number               ;
}

async function censusSource(source: CorpusSource, maxFiles: number): Promise<CensusResult> {
	const root              = join(CACHE, source.id)                           ;
	const suffix            = source.language === "typescript" ? ".ts" : ".py" ;
	const files             = walkFiles(root, suffix, maxFiles)                ;
	const rows: CensusRow[] = []                                               ;
	if (source.language === "typescript") {
		// One server for the whole source: opening per file spawns a TypeScript 7 project per file and leaks gigabytes.
		// A batch that triggers huge-project inference can wedge the server for many minutes (vscode's src/), so every
		// server call runs under a watchdog; a wedged batch is skipped and the server is rebuilt before continuing.
		const watchdog = async <T>(work: Promise<T>, what: string): Promise<T | null> => {
			let timer: ReturnType<typeof setTimeout> | undefined ;
			const timeout = new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 900_000); }) ;
			// a rejected batch is a failure (false), a timed-out batch is a wedged server (null)
			const settled = await Promise.race([work.catch(() => false as unknown as T), timeout])              ;
			clearTimeout(timer)                                                                                  ;
			if (settled === null) console.error(`corpus-signatures ${source.id} ${what} timed out after 900s`)   ;
			return settled                                                                                       ;
		}                                                                                                        ;
		let api           = new API({ cwd: root }) ;
		let batchesFailed = 0                      ;
		try {
			const size = 25                                                  ;
			for (let index = 0; index < files.length; index += size) {
				const batch = files.slice(index, index + size)                                     ;
				const label = (file: string): string => relative(root, file).replaceAll("\\", "/") ;
				const run = async (): Promise<boolean> => {
					const state = await api.updateSnapshot({ openFiles: batch }) ;
					for (const file of batch) {
						const project = await state.getDefaultProjectForFile(file)       ;
						if (!project) continue                                           ;
						const ast = await project.program.getSourceFile(file)            ;
						if (!ast) continue                                               ;
						for (const group of censusGroups(ast, 3)) {
							const safe  = groupPreserved(ast, group)                                      ;
							const state = group.edits.length === 0 ? "PASS" : safe ? "FIXABLE" : "REFUSE" ;
							rows.push({
								signature : signatureOf(source.language, group.context, group.kind, group.axes, group.depth),
								language  : source.language   ,
								kind      : group.kind        ,
								state     : state             ,
								rows      : group.rowCount    ,
								edits     : group.edits.length,
								spot      : { source: source.id, file: label(file), startLine: group.startLine, endLine: group.endLine, rows: group.rowCount },
							})                     ;
						}
					}
					return true                                                     ;
				}                                                                    ;
				// the first wedge may be huge-project inference doing real work (vscode src/), so the SAME batch is
				// retried once; only a second wedge rebuilds the server and skips the batch
				let settled: boolean | null = false                                  ;
				for (let attempt = 1; attempt <= 2; attempt += 1) {
					settled = await watchdog(run(), `batch ${Math.floor(index / size) + 1} attempt ${attempt}`) ;
					if (settled !== null) break                                      ;
				}                                                                    ;
				if (settled === null || settled === false) {
					batchesFailed += 1                                                          ;
					if (settled === null) {
						await watchdog(api.close().then(() => undefined), "close")               ;
						api = new API({ cwd: root })                                             ;
					}
					console.error(`corpus-signatures ${source.id} batch ${Math.floor(index / size) + 1} SKIPPED${batchesFailed > 0 ? ` failedBatches=${batchesFailed}` : ""}`) ;
				} else {
					console.error(`corpus-signatures ${source.id} batch ${Math.floor(index / size) + 1}/${Math.ceil(files.length / size)} tables=${rows.length}${batchesFailed > 0 ? ` failedBatches=${batchesFailed}` : ""}`) ;
				}
			}
		} finally {
			await watchdog(api.close().then(() => undefined), "close")               ;
		}
		return { files: files.length, rows, failedBatches: batchesFailed } ;
	}
	for (const file of files) {
		const label  = relative(root, file).replaceAll("\\", "/")                                                                                                 ;
		const result = alignSource(readFileSync(file, "utf8"), PYTHON_ALIGNER, { minRows: 3, apply: false })                                                      ;
		const spotOf = (startLine: number, endLine: number): TableSpot => ({ source: source.id, file: label, startLine, endLine, rows: endLine - startLine + 1 }) ;
		for (const table of result.details) {
			const state = table.edits.length === 0 ? "PASS" : "FIXABLE"                    ;
			rows.push({ signature: signatureOf(source.language, "", "table", table.axes, indentDepth(table.indent)), language: source.language, kind: "table", state, rows: table.rows, edits: table.edits.length, spot: spotOf(table.startLine, table.endLine) }) ;
		}
		for (const table of result.refused) {
			rows.push({ signature: signatureOf(source.language, "", "table", table.axes, indentDepth(table.indent)), language: source.language, kind: "table", state: "REFUSE", rows: table.rows, edits: table.edits.length, spot: spotOf(table.startLine, table.endLine) }) ;
		}
	}
	return { files: files.length, rows }                  ;
}

/** Representatives prefer tables with edits to judge (FIXABLE), then aligned ones (PASS), then refused ones. */
const EXAMPLE_ORDER = ["FIXABLE", "PASS", "REFUSE"] ;

function collapse(rows: readonly CensusRow[]): readonly SignatureType[] {
	interface Accumulator {
		readonly signature : string                      ;
		readonly language  : string                      ;
		readonly kind      : string                      ;
		readonly states    : Record<string, number>      ;
		count              : number                      ;
		rows               : number                      ;
		edits              : number                      ;
		readonly spots     : Record<string, TableSpot[]> ;
	}
	const types = new Map<string, Accumulator>()                          ;
	for (const row of rows) {
		const type = types.get(row.signature) ?? { signature: row.signature, language: row.language, kind: row.kind, states: {}, count: 0, rows: 0, edits: 0, spots: {} } ;
		types.set(row.signature, type)                                    ;
		type.count             += 1                                       ;
		type.rows              += row.rows                                ;
		type.edits             += row.edits                               ;
		type.states[row.state]  = (type.states[row.state] ?? 0) + 1       ;
		const spots             = type.spots[row.state] ??= []            ;
		if (spots.length < 3) spots.push(row.spot)                        ;
	}
	return [...types.values()]
		.map(type => ({ signature: type.signature, language: type.language, kind: type.kind, states: type.states, count: type.count, rows: type.rows, edits: type.edits, score: type.count * type.edits, examples: EXAMPLE_ORDER.flatMap(state => type.spots[state] ?? []).slice(0, 3) }))
		.sort((left, right) => right.score - left.score || right.count - left.count) ;
}

async function main(): Promise<void> {
	const maxFilesIndex                          = process.argv.indexOf("--max-files")                               ;
	const maxFiles                               = maxFilesIndex < 0 ? 400 : Number(process.argv[maxFilesIndex + 1]) ;
	const manifest                               = readManifest("manifest.json")                                     ;
	const local                                  = readManifest("local.json")                                        ;
	const sources                                = [...manifest.sources, ...local.sources]                           ;
	const all           : CensusRow[]            = []                                                                ;
	const scanned       : Record<string, number> = {}                                                                ;
	const failedBatches : Record<string, number> = {}                                                                ;
	for (const source of sources) {
		const census = await censusSource(source, maxFiles) ;
		scanned[source.id] = census.files                   ;
		if (census.failedBatches) failedBatches[source.id] = census.failedBatches ;
		all.push(...census.rows)                            ;
		console.error(`corpus-signatures ${source.id} files=${census.files} tables=${census.rows.length}${census.failedBatches ? ` failedBatches=${census.failedBatches}` : ""}`) ;
	}
	const types  = collapse(all)                                                                                                                                                                   ;
	const report = { schemaVersion: 2, signatureVersion: SIGNATURE_VERSION, sources: sources.map(source => source.id), maxFiles, filesScanned: scanned, failedBatches, tables: all.length, types } ;
	mkdirSync(CACHE, { recursive: true })                              ;
	const out = join(CACHE, "signatures.json")                         ;
	writeFileSync(out, `${JSON.stringify(report, null, "\t")}\n`)      ;
	console.error(`corpus-signatures tables=${all.length} types=${types.length} report=${out}`) ;
	console.log(JSON.stringify(types.slice(0, 20).map(type => ({ signature: type.signature, count: type.count, edits: type.edits })), null, 2)) ;
}

if (import.meta.main) await main() ;
