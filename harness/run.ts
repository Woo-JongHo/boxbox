/**
 * Release tracking harness orchestrator.
 *
 * Pins and records the git fingerprint, host and preconditions (npm cache) before running (a manifest per run, eval-protocol principle),
 * runs the stages in sequence and stores the result as one line in runs.jsonl. If one stage fails, the rest still
 * run and everything is recorded. latest.json is updated only when results for all requested stages are in.
 *
 * Usage: `bun run harness [--stages a,b] [--skip a,b] [--with-eval] [--note "…"] [--dry-run] [--json]`
 */

import      { spawnSync               } from "node:child_process" ;
import      { createHash              } from "node:crypto"        ;
import      {
              existsSync            ,
              readdirSync           ,
              readFileSync          ,
              statSync              ,
                                      } from "node:fs"            ;
import      { join, relative, resolve } from "node:path"          ;
import      {
              appendRun             ,
              completionOf          ,
              RUNS_SCHEMA_VERSION   ,
              updateLatest          ,
              type RunArtifact      ,
              type RunRecord        ,
              type RunStage         ,
                                      } from "./db.ts"            ;

const root           = resolve(import.meta.dir, "..")       ;
const evidenceDir    = resolve(import.meta.dir, "evidence") ;
const bun            = process.execPath                     ;
const TYPESCRIPT_PIN = "7.0.2"                              ;

/** All stages in default run order. eval calls a paid model, so it is requested only with --with-eval. */
const ALL_STAGES = ["self-align", "check", "pack", "artifact-journey", "corpus-gate", "eval"] as const;

const SELF_ALIGN_ROOTS = ["skills/xxx/scripts", "scripts", "test", "harness"]                                          ;
const SELF_ALIGN_SKIP  = new Set(["node_modules", "dist", "fixtures", "stress", "TEST_COMPLETED", ".xxx", "evidence"]) ;

interface SpawnResult {
	readonly status : number | null ;
	readonly output : string        ;
	readonly error? : string        ;
}

function spawn(command: string, args: readonly string[], timeoutMs: number): SpawnResult {
	const result = spawnSync(command, args, { cwd: root, encoding: "utf8", timeout: timeoutMs }) ;
	const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`                              ;
	if (result.error) return { status: result.status, output, error: String(result.error.message) };
	return { status: result.status, output };
}

function argOf(args: readonly string[], flag: string): string | undefined {
	const index = args.indexOf(flag)                          ;
	if (index >= 0 && index + 1 < args.length) return args[index + 1] ;
	const inline = args.find(value => value.startsWith(`${flag}=`))   ;
	return inline === undefined ? undefined : inline.slice(flag.length + 1) ;
}

function hasFlag(args: readonly string[], flag: string): boolean {
	return args.includes(flag) ;
}

function gitFingerprint(): RunRecord["git"] {
	const run = (args: readonly string[]): string | null => {
		const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
		return result.status === 0 ? (result.stdout ?? "").trim() : null;
	};
	const branch = run(["rev-parse", "--abbrev-ref", "HEAD"]) ;
	const sha    = run(["rev-parse", "HEAD"]                ) ;
	const ahead  = run(["rev-list", "--count", "@{u}..HEAD"]) ;
	const status = run(["status", "--porcelain"]            ) ;
	return {
		branch,
		sha,
		dirty : status !== null && status.length > 0,
		ahead : ahead === null ? null : Number(ahead),
	};
}

function hostFingerprint(): RunRecord["host"] {
	const node = spawnSync("node", ["--version"], { encoding: "utf8" }) ;
	return {
		platform : `${process.platform}-${process.arch}`,
		bun      : Bun.version ?? "unknown",
		node     : node.status === 0 ? (node.stdout ?? "").trim() : null,
	};
}

/** Determines from the npm cache index whether the precondition of the isolated artifact install tests (`npm install --offline`) is met. */
function npmCacheHas(fragment: string): boolean {
	const cache = resolve(process.env.HOME ?? ".", ".npm/_cacache/index-v5") ;
	if (!existsSync(cache)) return false                                     ;
	return spawnSync("grep", ["-rqs", fragment, cache], { encoding: "utf8" }).status === 0 ;
}

function npmCachePreconditions(): RunRecord["preconditions"] {
	return {
		npmCache: {
			typescript       : npmCacheHas(`typescript/-/typescript-${TYPESCRIPT_PIN}.tgz`),
			typescriptNative : npmCacheHas(`@typescript/typescript-${process.platform}-${process.arch}`),
		},
	};
}

function listTypeScriptFiles(directory: string): string[] {
	const found: string[] = []                                        ;
	const walk = (current: string): void => {
		for (const entry of readdirSync(current).sort()) {
			if (SELF_ALIGN_SKIP.has(entry)) continue                  ;
			const path = join(current, entry)                         ;
			if (statSync(path).isDirectory()) walk(path)              ;
			else if (entry.endsWith(".ts")) found.push(path)          ;
		}
	};
	walk(directory)                                                   ;
	return found                                                      ;
}

function relativeToRoot(path: string): string {
	return path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path ;
}

function sha256Of(path: string): string {
	return createHash("sha256").update(readFileSync(path)).digest("hex") ;
}

function countOf(output: string, pattern: RegExp): number | null {
	const match = output.match(pattern)              ;
	return match === null ? null : Number(match[1]!) ;
}

// ─── stages ──────────────────────────────────────────────────────────────────

interface StageOutcome {
	readonly ok         : boolean                                             ;
	readonly exitCode   : number | null                                       ;
	readonly metrics    : Readonly<Record<string, number | string | boolean>> ;
	readonly artifacts? : readonly RunArtifact[]                              ;
	readonly error?     : string                                              ;
}

function runSelfAlign(): StageOutcome {
	const files = SELF_ALIGN_ROOTS
		.flatMap(prefix => listTypeScriptFiles(resolve(root, prefix)).map(relativeToRoot))
		.sort()                                                                                  ;
	const normalizeScript = resolve(root, "skills/xxx/scripts/typescript/00_normalize-imports.ts") ;
	const alignScript     = resolve(root, "skills/xxx/scripts/typescript/06_align-tables.ts")      ;
	const normalize       = spawn(bun, [normalizeScript, ...files], 600_000)                       ;
	const changed         = countOf(normalize.output, /changed=(\d+)/)                             ;
	const errors          = countOf(normalize.output, /errors=(\d+)/)                              ;
	let misaligned = 0, misalignedFiles = 0, compressed = 0                                      ;
	for (const path of files) {
		const result          = spawn(bun, [alignScript, "--file", path], 120_000) ;
		const count           = countOf(result.output, /misaligned=(\d+)/)         ;
		const compressedCount = countOf(result.output, /compressed=(\d+)/)         ;
		if (count === null || compressedCount === null) {
			return {
				ok       : false,
				exitCode : result.status,
				metrics  : { files: files.length, changed: changed ?? -1, errors: errors ?? -1, misaligned, misalignedFiles, compressed },
				error    : `could not parse the alignment check summary: ${path}`,
			}                                                                                        ;
		}
		if (count > 0) misalignedFiles += 1                                                      ;
		misaligned += count                                                                      ;
		compressed += compressedCount                                                            ;
	}
	return {
		ok       : changed === 0 && errors === 0 && misaligned === 0,
		exitCode : normalize.status,
		metrics  : { files: files.length, changed: changed ?? -1, errors: errors ?? -1, misaligned, misalignedFiles, compressed },
	};
}

function runCheck(): StageOutcome {
	const result = spawn(bun, ["run", "check"], 600_000)                     ;
	const pass   = countOf(result.output, /(\d+) pass/)                      ;
	const skip   = countOf(result.output, /(\d+) skip/)                      ;
	const fail   = countOf(result.output, /(\d+) fail/)                      ;
	const ran    = result.output.match(/Ran (\d+) tests across (\d+) files/) ;
	if (pass === null || skip === null || fail === null) {
		return { ok: false, exitCode: result.status, metrics: {}, error: "could not parse pass/skip/fail from the check output" } ;
	}
	return {
		ok       : result.status === 0 && fail === 0,
		exitCode : result.status,
		metrics  : { pass, skip, fail, tests: ran === null ? -1 : Number(ran[1]!), testFiles: ran === null ? -1 : Number(ran[2]!) },
	};
}

function packedArtifact(directory: string, version: string): RunArtifact {
	const packed = spawn("npm", ["pack", resolve(root, directory), "--pack-destination", resolve(root, "dist"), "--json"], 300_000) ;
	if (packed.status !== 0) throw new Error(`npm pack failed (${directory}): ${packed.output.slice(-500)}`) ;
	const parsed  = JSON.parse(packed.output.slice(packed.output.indexOf("["))) as { readonly filename: string; readonly files: readonly unknown[] }[] ;
	const entry   = parsed[0]!                                                                                                                         ;
	const tarball = resolve(root, "dist", entry.filename)                                                                                              ;
	return {
		stage  : "pack",
		target : directory,
		name   : entry.filename,
		bytes  : statSync(tarball).size,
		sha256 : sha256Of(tarball),
		files  : entry.files.length,
		version,
	};
}

function runPack(): StageOutcome {
	const buildCli = spawn(bun, ["run", "build:cli"], 300_000)           ;
	if (buildCli.status !== 0) return { ok: false, exitCode: buildCli.status, metrics: {}, error: `build:cli failed\n${buildCli.output.slice(-1_000)}` } ;
	const buildNode = spawn(bun, ["run", "build:node-artifact"], 300_000) ;
	if (buildNode.status !== 0) return { ok: false, exitCode: buildNode.status, metrics: {}, error: `build:node-artifact failed\n${buildNode.output.slice(-1_000)}` } ;
	const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as { readonly version: string } ;
	const artifacts = [
		packedArtifact("dist/cli", manifest.version),
		packedArtifact("dist/engine", manifest.version),
	]                                                                                    ;
	const clean = artifacts.every(artifact => artifact.files > 0 && artifact.bytes > 0)  ;
	return { ok: clean, exitCode: clean ? 0 : 1, metrics: { artifacts: artifacts.length }, artifacts } ;
}

function runArtifactJourney(): StageOutcome {
	const result = spawn(bun, ["test", "--timeout", "60000", "test/public-artifact.test.ts", "test/node-artifact.test.ts"], 600_000) ;
	const pass   = countOf(result.output, /(\d+) pass/)                                                                              ;
	const fail   = countOf(result.output, /(\d+) fail/)                                                                              ;
	if (pass === null || fail === null) {
		return { ok: false, exitCode: result.status, metrics: {}, error: "could not parse pass/fail from the artifact test output" } ;
	}
	return { ok: fail === 0 && result.status === 0, exitCode: result.status, metrics: { pass, fail } } ;
}

function runCorpusGate(): StageOutcome {
	const result   = spawn(bun, ["scripts/corpus-promote.ts", "--check"], 600_000) ;
	const checked  = countOf(result.output, /checked=(\d+)/)                       ;
	const failures = countOf(result.output, /failures=(\d+)/)                      ;
	if (checked === null || failures === null) {
		return { ok: false, exitCode: result.status, metrics: {}, error: "could not parse checked/failures from the corpus gate output" } ;
	}
	return { ok: failures === 0 && result.status === 0, exitCode: result.status, metrics: { checked, failures } } ;
}

function runEval(): StageOutcome {
	const run   = spawn(bun, ["scripts/eval.ts", "run"  ], 900_000) ;
	const grade = spawn(bun, ["scripts/eval.ts", "grade"], 300_000) ;
	return { ok: run.status === 0 && grade.status === 0, exitCode: grade.status, metrics: { runExit: run.status ?? -1, gradeExit: grade.status ?? -1 } } ;
}

const STAGE_RUNNERS: Readonly<Record<string, () => StageOutcome>> = {
	"self-align"       : runSelfAlign       ,
	"check"            : runCheck           ,
	"pack"             : runPack            ,
	"artifact-journey" : runArtifactJourney ,
	"corpus-gate"      : runCorpusGate      ,
	"eval"             : runEval            ,
};

interface StageExecution {
	readonly stage: RunStage;
	readonly artifacts: readonly RunArtifact[];
}

function executeStage(id: string): StageExecution {
	const started = Date.now()                                                     ;
	process.stderr.write(`harness: running ${id}…\n`)                              ;
	try {
		const outcome = STAGE_RUNNERS[id]!()                        ;
		const seconds = ((Date.now() - started) / 1_000).toFixed(1) ;
		process.stderr.write(`harness: ${id} ${outcome.ok ? "ok" : "FAIL"} (${seconds}s)\n`) ;
		return {
			stage     : { id, ok: outcome.ok, skipped: false, exitCode: outcome.exitCode, durationMs: Date.now() - started, metrics: outcome.metrics, error: outcome.error },
			artifacts : outcome.artifacts ?? [],
		}                                                                              ;
	} catch (error) {
		const message = String((error as Error).message ?? error)                      ;
		process.stderr.write(`harness: ${id} THROW (${message})\n`)                    ;
		return {
			stage     : { id, ok: false, skipped: false, exitCode: null, durationMs: Date.now() - started, metrics: {}, error: message },
			artifacts : [],
		}                                                                              ;
	}
}

function skippedStage(id: string, reason: string): RunStage {
	return { id, ok: true, skipped: true, exitCode: null, durationMs: 0, metrics: { reason } } ;
}

// ─── entry point ─────────────────────────────────────────────────────────────

function main(): void {
	const args      = process.argv.slice(2)                                                                                                         ;
	const dryRun    = hasFlag(args, "--dry-run")                                                                                                    ;
	const withEval  = hasFlag(args, "--with-eval")                                                                                                  ;
	const stagesArg = argOf(args, "--stages")                                                                                                       ;
	const skipArg   = argOf(args, "--skip")                                                                                                         ;
	const note      = argOf(args, "--note") ?? ""                                                                                                   ;
	const asJson    = hasFlag(args, "--json")                                                                                                       ;
	const known     = stagesArg === undefined ? [...ALL_STAGES] : stagesArg.split(",").map(value => value.trim()).filter(value => value.length > 0) ;
	const unknown   = known.filter(id => !(ALL_STAGES as readonly string[]).includes(id))                                                           ;
	if (unknown.length > 0) throw new Error(`unknown stage(s): ${unknown.join(", ")} (available: ${ALL_STAGES.join(", ")})`) ;
	const skip            = new Set((skipArg ?? "").split(",").map(value => value.trim()).filter(value => value.length > 0)) ;
	const requestedStages = known.filter(id => !skip.has(id))                                                                ;
	if (requestedStages.length === 0) throw new Error("no stages requested") ;

	const git           = gitFingerprint()        ;
	const host          = hostFingerprint()       ;
	const preconditions = npmCachePreconditions() ;

	if (dryRun) {
		console.log(JSON.stringify({ dryRun: true, requestedStages, git, host, preconditions }, null, "\t")) ;
		return                                                                                               ;
	}

	const startedAt                   = new Date().toISOString() ;
	const stages      : RunStage[]    = []                       ;
	const artifacts   : RunArtifact[] = []                       ;
	const limitations : string[]      = []                       ;

	for (const id of requestedStages) {
		if (id === "eval" && !withEval) {
			stages.push(skippedStage(id, "paid model call — runs only with --with-eval")) ;
			limitations.push("eval not run (paid model call, opt-in)")               ;
			continue                                                               ;
		}
		const execution = executeStage(id)                                        ;
		stages.push(execution.stage)                                              ;
		artifacts.push(...execution.artifacts)                                    ;
	}

	const npmCache = preconditions.npmCache                                   ;
	if (!npmCache.typescript || !npmCache.typescriptNative) {
		limitations.push(`the npm cache lacks the artifact install precondition (typescript=${npmCache.typescript}, native=${npmCache.typescriptNative}) — warm it with: npm cache add typescript@${TYPESCRIPT_PIN}`) ;
	}

	const completion = completionOf(requestedStages, stages)                  ;
	const record: RunRecord = {
		schemaVersion : RUNS_SCHEMA_VERSION,
		recordType    : "run",
		runId         : `${startedAt.replace(/[:.]/g, "-")}-${(git.sha ?? "nogit").slice(0, 8)}`,
		startedAt,
		git,
		host,
		preconditions,
		requestedStages,
		stages,
		artifacts,
		completion,
		ok       : completion.complete && completion.failed === 0,
		note,
		limitations,
	};

	appendRun(evidenceDir, record)                                            ;
	if (completion.complete) updateLatest(evidenceDir, record)                ;

	if (asJson) {
		console.log(JSON.stringify(record))                                   ;
	} else {
		console.log(`harness run ${record.ok ? "ok" : "FAIL"}  ${record.runId}`) ;
		for (const stage of stages) {
			const metrics = Object.entries(stage.metrics).map(([key, value]) => `${key}=${value}`).join(" ") ;
			const tail    = stage.error === undefined ? "" : `\n        ${stage.error.slice(0, 400)}`        ;
			console.log(`  ${stage.skipped ? "skip" : stage.ok ? "ok  " : "FAIL"}  ${stage.id.padEnd(18)} ${(stage.durationMs / 1_000).toFixed(1).padStart(8)}s  ${metrics}${tail}`) ;
		}
		for (const artifact of artifacts) {
			console.log(`  artifact  ${artifact.target}  ${artifact.name}  ${artifact.bytes}B  sha256=${artifact.sha256.slice(0, 12)}…  files=${artifact.files}`) ;
		}
	}
	process.exitCode = record.ok ? 0 : 1                                     ;
}

if (import.meta.main) main() ;
