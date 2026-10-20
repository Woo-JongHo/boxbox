#!/usr/bin/env bun
/**
 * Verdict promotion (plan M1.5 D4): turns a judged corpus type into a minimized synthetic-identifier fixture
 * under test/fixtures/<language>/corpus/<slug>/ — a scaffold tables file the author refines, the aligned
 * golden, and verdict.json binding the fixture to its verdict. The promotion gate (--check) re-aligns every
 * promoted fixture and fails when a judged result changed silently (design §7). `different-role` and
 * `missing-kind` verdicts are registry work, not fixtures: --report lists them as pending.
 *
 * Usage:
 *   bun development/tools/corpus-promote.ts --rank 5        # scaffold + golden + verdict.json for the type at rank 5
 *   bun development/tools/corpus-promote.ts --check         # the promotion gate over every promoted fixture
 *   bun development/tools/corpus-promote.ts --report        # pending non-correct verdicts
 */
import      {
              existsSync     ,
              mkdirSync      ,
              readFileSync   ,
              readdirSync    ,
              rmSync         ,
              writeFileSync  ,
                               } from "node:fs"                ;
import      { tmpdir           } from "node:os"                ;
import      { join             } from "node:path"              ;
import      { spawnSync        } from "node:child_process"     ;
import      { createHash       } from "node:crypto"            ;
import      { readCensusReport } from "./corpus-signatures.ts" ;

const ROOT     = join(import.meta.dir, "..", "..")                             ;
const CACHE    = join(process.env["HOME"] ?? "", ".cache", "boxbox", "corpus") ;
const LOG      = join(ROOT, "development", "corpus", "verdicts.jsonl")         ;
const FIXTURES = join(ROOT, "test", "fixtures")                                ;

interface SignatureType {
	readonly signature : string ;
	readonly language  : string ;
	readonly kind      : string ;
}

interface VerdictRecord {
	readonly schemaVersion : number ;
	readonly signature     : string ;
	readonly verdict       : string ;
	readonly judge         : string ;
	readonly date          : string ;
	readonly note          : string ;
}

/** The fixture directory of a promoted type: test/fixtures/<language>/corpus/<rank>-<hash8>. */
export function fixtureDir(language: string, signature: string, rank: number): string {
	const hash = createHash("sha1").update(signature).digest("hex").slice(0, 8);
	return join(FIXTURES, language, "corpus", `${String(rank).padStart(3, "0")}-${hash}`);
}

/** The minimized synthetic scaffold a promoted fixture starts from; the author refines it to the judged shape. */
export function scaffoldFor(language: string, kind: string): string {
	if (language === "typescript") {
		if (kind === "registration") return [
			"const settings1 = { retries: 3 };"  ,
			"const settings2 = { retries: 33 };",
			"const settings3 = { retries: 333 };",
		].join("\n") + "\n";
		if (kind === "interface-members") return [
			"interface Sample {"                 ,
			"\tfirst: string;"                   ,
			"\tsecond: number;"                  ,
			"}"                                  ,
		].join("\n") + "\n";
		return [
			"const value1 = initial1;"           ,
			"const value2 = initial2;"           ,
			"const value33 = initial33;"         ,
		].join("\n") + "\n";
	}
	return [
		"alpha = first(1, 22)"               ,
		"beta = first(2, 33)"                ,
		"gamma = first(3, 44)"               ,
	].join("\n") + "\n";
}

function runAligner(language: string, file: string): void {
	const aligner = language === "typescript"
		? join(ROOT, "product", "engine", "typescript", "06_align-tables.ts")
		: join(ROOT, "product", "engine", "python", "06_align-tables.ts");
	const result = spawnSync("bun", [aligner, "--file", file, "--write"], { encoding: "utf8", timeout: 300_000 })  ;
	if (result.status !== 0) throw new Error(`alignment failed: ${result.stderr.toString().split("\n")[0]}`)       ;
}

/** The promotion gate: every promoted fixture still aligns to its committed golden, and carries its verdict. */
export function checkGate(): { readonly checked: number; readonly failures: readonly string[] } {
	const failures: string[] = [] ;
	let checked              = 0  ;
	for (const language of ["typescript", "python"]) {
		const corpus = join(FIXTURES, language, "corpus")                                      ;
		if (!existsSync(corpus)) continue                                                      ;
		for (const entry of readdirSync(corpus).sort()) {
			const dir    = join(corpus, entry                                                         ) ;
			const tables = join(dir   , "tables" + (language === "typescript" ? ".ts" : ".py")        ) ;
			const golden = join(dir   , "tables.aligned" + (language === "typescript" ? ".ts" : ".py")) ;
			if (!existsSync(tables) || !existsSync(golden)) {
				failures.push(`${language}/${entry}: missing tables or golden`)                ;
				continue                                                                       ;
			}
			if (!existsSync(join(dir, "verdict.json"))) {
				failures.push(`${language}/${entry}: missing verdict.json`)                    ;
				continue                                                                       ;
			}
			const work = join(tmpdir(), `promote-gate-${entry}${language === "typescript" ? ".ts" : ".py"}`);
			writeFileSync(work, readFileSync(tables, "utf8"));
			try {
				runAligner(language, work);
				if (readFileSync(work, "utf8") !== readFileSync(golden, "utf8")) {
					failures.push(`${language}/${entry}: golden drifted from the current engine`);
				}
			} catch (error) {
				failures.push(`${language}/${entry}: ${error instanceof Error ? error.message : String(error)}`);
			} finally {
				rmSync(work, { force: true });
			}
			checked += 1;
		}
	}
	return { checked, failures };
}

function readVerdicts(): readonly VerdictRecord[] {
	return existsSync(LOG)
		? readFileSync(LOG, "utf8").split("\n").filter(line => line.trim() !== "").map(line => JSON.parse(line) as VerdictRecord)
		: [];
}

function main(): void {
	const args = argsOf();
	if (args.includes("--check")) {
		const gate = checkGate();
		for (const failure of gate.failures) console.error(`gate: ${failure}`);
		console.log(`promotion gate checked=${gate.checked} failures=${gate.failures.length}`);
		if (gate.failures.length > 0) process.exit(1)                        ;
		return                                                               ;
	}
	if (args.includes("--report")) {
		const records = readVerdicts()                                         ;
		const pending = records.filter(record => record.verdict !== "correct") ;
		for (const record of pending) console.log(`pending ${record.verdict}: ${record.signature}${record.note === "" ? "" : ` — ${record.note}`}`);
		console.log(`pending=${pending.length} judged=${records.length}`);
		return;
	}
	const rankIndex = args.indexOf("--rank")                                    ;
	const rank      = rankIndex >= 0 ? Number(args[rankIndex + 1]) : Number.NaN ;
	const census    = readCensusReport<SignatureType>()                         ;
	const type      = census.types[rank - 1]                                    ;
	if (type === undefined) throw new Error(`no type at rank ${rank} — run development/tools/corpus-judge.ts --status`);
	const record = readVerdicts().filter(candidate => candidate.signature === type.signature).at(-1);
	if (record === undefined) throw new Error(`rank ${rank} has no verdict yet — judge it with development/tools/corpus-judge.ts --verdict ${rank} <verdict>`)  ;
	if (record.verdict !== "correct") throw new Error(`rank ${rank} is "${record.verdict}" — only correct types promote to fixtures; see --report`)   ;
	const dir = fixtureDir(type.language, type.signature, rank) ;
	const ext = type.language === "typescript" ? ".ts" : ".py"  ;
	mkdirSync(dir, { recursive: true })                                                             ;
	writeFileSync(join(dir, `tables${ext}`), scaffoldFor(type.language, type.kind))                 ;
	runAligner(type.language, join(dir, `tables${ext}`))                                            ;
	writeFileSync(join(dir, `tables.aligned${ext}`), readFileSync(join(dir, `tables${ext}`), "utf8"));
	writeFileSync(join(dir, "verdict.json"), `${JSON.stringify({ schemaVersion: 1, rank, signature: type.signature, verdict: record.verdict, date: record.date, note: record.note }, null, 2)}\n`);
	console.log(`promoted rank ${rank} → test/fixtures/${type.language}/corpus — refine tables${ext}, then rerun promote --rank ${rank} to refresh the golden`);
}

function argsOf(): readonly string[] {
	return process.argv.slice(2);
}

if (import.meta.main) main();
