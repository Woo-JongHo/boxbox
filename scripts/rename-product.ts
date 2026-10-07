import      { spawnSync                                        } from "node:child_process"          ;
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs"   ;
import { join, resolve                                                        } from "node:path"                  ;

/**
 * The one-pass product rename for REL11. The placeholder is exactly two forms:
 * `xxx` for identifiers and paths, `XXX` for display names and environment
 * variables. This script replaces both across every tracked file, moves the
 * skill directories, and re-syncs the release plugin folder.
 *
 * --dry-run (default) prints what would change and exits 0.
 * --apply performs the git mv and the replacements, then runs sync-plugin.
 * Neither mode commits; review `git diff` before committing.
 */

const ROOT       = resolve(import.meta.dir, "..")                            ;
const args       = process.argv.slice(2)                                     ;
const apply      = args.includes("--apply")                                  ;
const to         = args[args.indexOf("--to") + 1]                            ;
const displayRaw = args.includes("--display") ? args[args.indexOf("--display") + 1] : undefined;

function fail(message: string): never {
	console.error(`rename-product: ${message}`);
	process.exit(1);
}

if (!to || !/^[a-z][a-z0-9-]*$/u.test(to)) fail("--to must be a lowercase kebab identifier");
if (to === "xxx") fail("--to is already the placeholder");
const display = displayRaw ?? to.toUpperCase();
if (!/^[A-Z][A-Za-z0-9]*$/u.test(display)) fail("--display must be a Pascal or upper identifier");

function trackedFiles(): readonly string[] {
	const out   = spawnSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })          ;
	const files = (out.stdout ?? "").split("\n").filter(line => line.trim().length > 0)    ;
	if (out.status !== 0 || files.length === 0) fail("git ls-files returned nothing");
	return files;
}

function walk(dir: string): readonly string[] {
	if (!existsSync(dir)) return [];
	return readdirSync(dir, { recursive: true }).map(entry => join(dir, entry as string)).filter(entry => statSync(entry).isFile());
}

const files      = trackedFiles()                                                                                       ;
const contentHits: Array<{ readonly file: string; readonly xxx: number; readonly XXX: number }> = []     ;

for (const file of files) {
	const path    = resolve(ROOT, file)                                   ;
	if (!existsSync(path) || !statSync(path).isFile()) continue           ;
	const text    = readFileSync(path, "utf8")                            ;
	const xxx     = text.split("xxx").length - 1                          ;
	const XXX     = text.split("XXX").length - 1                          ;
	if (xxx > 0 || XXX > 0) contentHits.push({ file, xxx, XXX })          ;
}

const dirMoves: Array<{ readonly from: string; readonly to: string }> = []                                   ;
for (const candidate of ["skills/xxx", "plugin/skills/xxx"])                                                 {
	if (existsSync(resolve(ROOT, candidate))) dirMoves.push({ from: candidate, to: candidate.replace("xxx", to) });
}

console.log(`rename-product: xxx -> ${to}, XXX -> ${display} (${apply ? "APPLY" : "dry-run"})`);
for (const move of dirMoves) console.log(`  mv ${move.from} -> ${move.to}`);
console.log(`  ${contentHits.length} tracked file(s) contain placeholders`);
for (const hit of contentHits.slice(0, 40)) console.log(`    ${hit.file} (xxx:${hit.xxx} XXX:${hit.XXX})`);
if (contentHits.length > 40) console.log(`    … ${contentHits.length - 40} more`);

if (!apply) {
	console.log("dry-run only. Re-run with --apply --to <name> to perform the rename.");
	process.exit(0);
}

for (const move of dirMoves) renameSync(resolve(ROOT, move.from), resolve(ROOT, move.to));

let changed = 0;
for (const hit of contentHits) {
	const path   = resolve(ROOT, hit.file)                                      ;
	const before = readFileSync(path, "utf8")                                   ;
	const after  = before.replaceAll("xxx", to).replaceAll("XXX", display)      ;
	if (after !== before) { writeFileSync(path, after); changed += 1; }
}

	const synced = spawnSync("bun", ["run", "scripts/sync-plugin.ts"], { cwd: ROOT, stdio: "inherit" });
	console.log(`applied to ${changed} file(s), moved ${dirMoves.length} director(y/ies), sync-plugin exit ${synced.status}`);
console.log("next: bun run check, update AGENTS.md naming section, then commit as a single commit.");
