#!/usr/bin/env bun
/**
 * Corpus census (plan M1.5 D2): runs the aligners over the fetched corpus and collapses every detected table
 * into an L2 signature type — (language, container context, kind, ordered axis IDs, nesting depth, result state,
 * design §6). Thousands of tables collapse into a few hundred types, ranked by frequency × risk so the judged
 * representatives of D3 sample the tables that matter first. The report is written to
 * ~/.cache/xxx/corpus/signatures.json; third-party source never enters this repository.
 *
 * TypeScript files load through the TypeScript 7 server (~0.3 s per file), so each source is capped with
 * --max-files (default 400, walked in sorted order for determinism; symlinked directories count once);
 * .tsx and .d.ts are skipped. Python runs through the in-process line engine under the same cap — it is fast,
 * so raise --max-files to scan a whole tree. Local-only sources are included when present.
 */
import      {
              existsSync                 ,
              readdirSync                ,
              readFileSync               ,
              realpathSync               ,
              statSync                   ,
              mkdirSync                  ,
              writeFileSync              ,
                                           } from "node:fs"                                             ;
import      { homedir                      } from "node:os"                                             ;
import      { join, relative               } from "node:path"                                           ;
import      { API                          } from "typescript/unstable/async"                           ;
import      { alignSource                  } from "../skills/xxx/scripts/common/table-engine.ts"        ;
import      { PYTHON_ALIGNER               } from "../skills/xxx/scripts/python/profile.ts"             ;
import      { censusGroups, groupPreserved } from "../skills/xxx/scripts/typescript/06_align-tables.ts" ;

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
	readonly signature : string               ;
	readonly language  : string               ;
	readonly kind      : string               ;
	readonly state     : string               ;
	readonly count     : number               ;
	readonly rows      : number               ;
	readonly edits     : number               ;
	readonly score     : number               ;
	readonly examples  : readonly TableSpot[] ;
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

/** Normalizes one axis id for typing: `axis=target` loses its column, digit runs become `{i}`, a callee becomes `call:*`. */
export function normalizeAxis(axis: string): string {
	const bare  = axis.split("=")[0]!                  ;
	const typed = bare.replace(/^call:.+$/u, "call:*") ;
	return typed.replace(/\d+/gu, "{i}")   ;
}

/** The L2 signature of one table: (language, container context, kind, ordered axis ids, depth, state). */
export function signatureOf(language: string, context: string, kind: string, axes: readonly string[], depth: number, state: string): string {
	return `${language}|${context}|${kind}|${axes.map(normalizeAxis).join(">")}|d${depth}|${state}` ;
}

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
	readonly files : number                   ;
	readonly rows  : readonly CensusRow[]     ;
}

async function censusSource(source: CorpusSource, maxFiles: number): Promise<CensusResult> {
	const root              = join(CACHE, source.id)                           ;
	const suffix            = source.language === "typescript" ? ".ts" : ".py" ;
	const files             = walkFiles(root, suffix, maxFiles)                ;
	const rows: CensusRow[] = []                                               ;
	if (source.language === "typescript") {
		const api = new API({ cwd: root })                          ;
		// One server for the whole source: opening per file spawns a TypeScript 7 project per file and leaks gigabytes.
		try {
			const size = 25                                                  ;
			for (let index = 0; index < files.length; index += size) {
				const batch = files.slice(index, index + size)                                     ;
				const label = (file: string): string => relative(root, file).replaceAll("\\", "/") ;
				try {
					const state = await api.updateSnapshot({ openFiles: batch }) ;
					for (const file of batch) {
						const project = await state.getDefaultProjectForFile(file)       ;
						if (!project) continue                                           ;
						const ast = await project.program.getSourceFile(file)            ;
						if (!ast) continue                                               ;
						for (const group of censusGroups(ast, 3)) {
							const safe = groupPreserved(ast, group)                        ;
							rows.push({
								signature : signatureOf(source.language, group.context, group.kind, group.axes, group.depth, group.edits.length === 0 ? "PASS" : safe ? "FIXABLE" : "REFUSE"),
								language  : source.language   ,
								kind      : group.kind        ,
								state     : group.edits.length === 0 ? "PASS" : safe ? "FIXABLE" : "REFUSE",
								rows      : group.rowCount    ,
								edits     : group.edits.length,
								spot      : { source: source.id, file: label(file), startLine: group.startLine, endLine: group.endLine, rows: group.rowCount },
							})                     ;
						}
					}
				} catch {
					// a batch the TypeScript project layer cannot open is skipped, not fatal — the census is a sample
				}
			}
		} finally {
			await api.close()                        ;
		}
		return { files: files.length, rows }         ;
	}
	for (const file of files) {
		const label  = relative(root, file).replaceAll("\\", "/")                                                                                                 ;
		const result = alignSource(readFileSync(file, "utf8"), PYTHON_ALIGNER, { minRows: 3, apply: false })                                                      ;
		const spotOf = (startLine: number, endLine: number): TableSpot => ({ source: source.id, file: label, startLine, endLine, rows: endLine - startLine + 1 }) ;
		for (const table of result.details) {
			const state = table.edits.length === 0 ? "PASS" : "FIXABLE"                    ;
			rows.push({ signature: signatureOf(source.language, "", "table", table.axes, Math.floor(table.indent.replaceAll("\t", "    ").length / 4), state), language: source.language, kind: "table", state, rows: table.rows, edits: table.edits.length, spot: spotOf(table.startLine, table.endLine) }) ;
		}
		for (const table of result.refused) {
			rows.push({ signature: signatureOf(source.language, "", "table", table.axes, Math.floor(table.indent.replaceAll("\t", "    ").length / 4), "REFUSE"), language: source.language, kind: "table", state: "REFUSE", rows: table.rows, edits: table.edits.length, spot: spotOf(table.startLine, table.endLine) }) ;
		}
	}
	return { files: files.length, rows }                  ;
}

function collapse(rows: readonly CensusRow[]): readonly SignatureType[] {
	interface Accumulator {
		readonly signature : string      ;
		readonly language  : string      ;
		readonly kind      : string      ;
		readonly state     : string      ;
		count              : number      ;
		rows               : number      ;
		edits              : number      ;
		readonly examples  : TableSpot[] ;
	}
	const types = new Map<string, Accumulator>()                          ;
	for (const row of rows) {
		const found = types.get(row.signature)                            ;
		if (found) {
			found.count += 1                                              ;
			found.rows  += row.rows                                       ;
			found.edits += row.edits                                      ;
			if (found.examples.length < 3) found.examples.push(row.spot)  ;
			continue                                                      ;
		}
		types.set(row.signature, { signature: row.signature, language: row.language, kind: row.kind, state: row.state, count: 1, rows: row.rows, edits: row.edits, examples: [row.spot] }) ;
	}
	return [...types.values()]
		.map(type => ({ signature: type.signature, language: type.language, kind: type.kind, state: type.state, count: type.count, rows: type.rows, edits: type.edits, score: type.count * type.edits, examples: type.examples }))
		.sort((left, right) => right.score - left.score || right.count - left.count) ;
}

async function main(): Promise<void> {
	const maxFilesIndex                    = process.argv.indexOf("--max-files")                               ;
	const maxFiles                         = maxFilesIndex < 0 ? 400 : Number(process.argv[maxFilesIndex + 1]) ;
	const manifest                         = readManifest("manifest.json")                                     ;
	const local                            = readManifest("local.json")                                        ;
	const sources                          = [...manifest.sources, ...local.sources]                           ;
	const all     : CensusRow[]            = []                                                                ;
	const scanned : Record<string, number> = {}                                                                ;
	for (const source of sources) {
		const census = await censusSource(source, maxFiles) ;
		scanned[source.id] = census.files                   ;
		all.push(...census.rows)                            ;
		console.error(`corpus-signatures ${source.id} files=${census.files} tables=${census.rows.length}`) ;
	}
	const types  = collapse(all)                                                                                                               ;
	const report = { schemaVersion: 1, sources: sources.map(source => source.id), maxFiles, filesScanned: scanned, tables: all.length, types } ;
	mkdirSync(CACHE, { recursive: true })                              ;
	const out = join(CACHE, "signatures.json")                         ;
	writeFileSync(out, `${JSON.stringify(report, null, "\t")}\n`)      ;
	console.error(`corpus-signatures tables=${all.length} types=${types.length} report=${out}`) ;
	console.log(JSON.stringify(types.slice(0, 20).map(type => ({ signature: type.signature, count: type.count, edits: type.edits })), null, 2)) ;
}

await main() ;
