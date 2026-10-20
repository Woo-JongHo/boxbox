#!/usr/bin/env bun
/**
 * Corpus fetcher: materializes every pinned source of corpus/manifest.json as a shallow working tree at the
 * pinned commit under ~/.cache/boxbox/corpus/<id>. Local-only sources (the user's private repositories) are read
 * from gitignored corpus/local.json when present and merged in; duplicate ids are refused. Re-running is
 * idempotent — a clone already at the pinned commit is left untouched.
 */
import      {
              existsSync   ,
              mkdirSync    ,
              readFileSync ,
                             } from "node:fs"            ;
import      { homedir        } from "node:os"            ;
import      { join           } from "node:path"          ;
import      { spawnSync      } from "node:child_process" ;

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

const ROOT  = join(import.meta.dir, "..", "..")             ;
const CACHE = join(homedir(), ".cache", "boxbox", "corpus") ;

function readManifest(path: string, required: boolean): CorpusManifest {
	if (!existsSync(path)) {
		if (!required) return { schemaVersion: 1, sources: [] }                                       ;
		throw new Error(`missing manifest: ${path}`)                                                  ;
	}
	const parsed = JSON.parse(readFileSync(path, "utf8")) as CorpusManifest;
	if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.sources)) throw new Error(`bad manifest: ${path}`);
	return parsed;
}

function runGit(args: readonly string[], cwd: string | undefined, what: string): void {
	const result = spawnSync("git", cwd === undefined ? args : ["-C", cwd, ...args], { encoding: "utf8", timeout: 600_000 }) ;
	if (result.status !== 0) throw new Error(`${what} failed: ${result.stderr?.split("\n")[0]}`)                             ;
}

function headOf(target: string): string | undefined {
	const result = spawnSync("git", ["-C", target, "rev-parse", "HEAD"], { encoding: "utf8" });
	return result.status === 0 ? result.stdout.toString().trim() : undefined;
}

function materialize(source: CorpusSource): string {
	const target = join(CACHE, source.id)                        ;
	const url    = `https://github.com/${source.repository}.git` ;
	if (headOf(target) === source.commit) return "current";
	if (!existsSync(join(target, ".git"))) {
		mkdirSync(target, { recursive: true })                           ;
		runGit(["init", target], undefined, "init")                      ;
		runGit(["remote", "add", "origin", url], target, "remote add")   ;
	}
	runGit(["fetch", "--depth", "1", "origin", source.commit], target, "fetch")   ;
	runGit(["checkout", "--detach", "FETCH_HEAD"], target, "checkout")            ;
	if (headOf(target) !== source.commit) throw new Error(`${source.id}: worktree is not at the pinned commit`);
	return "fetched";
}

/** Merges the committed manifest with the local-only sources; a duplicate id is refused, never silently dropped. */
export function mergeSources(manifest: CorpusManifest, local: CorpusManifest): readonly CorpusSource[] {
	const ids = new Set(manifest.sources.map(source => source.id));
	for (const source of local.sources) {
		if (ids.has(source.id)) throw new Error(`duplicate corpus id: ${source.id}`)    ;
		ids.add(source.id)                                                              ;
	}
	return [...manifest.sources, ...local.sources];
}

function main(): void {
	const manifest = readManifest(join(ROOT, "development", "corpus", "manifest.json"), true) ;
	const local    = readManifest(join(ROOT, "development", "corpus", "local.json"), false)   ;
	const sources  = mergeSources(manifest, local)                                            ;
	mkdirSync(CACHE, { recursive: true })                                               ;
	let failures = 0                                                                    ;
	for (const source of sources) {
		try {
			const state = materialize(source);
			console.log(`corpus-fetch ${source.id} ${state} (${source.language} ${source.repository} @ ${source.commit.slice(0, 12)})`);
		} catch (error) {
			failures += 1;
			console.error(`corpus-fetch ${source.id} failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	console.log(`corpus-fetch files=${sources.length} failures=${failures}`)            ;
	if (failures > 0) process.exit(1)                                                   ;
}

if (import.meta.main) main();
