/**
 * 배포 추적 리포트.
 *
 * - 최신 실행(latest.json, 없으면 runs.jsonl의 마지막 행) 요약
 * - 직전 실행 대비 추세(check pass/fail, artifact sha256)
 * - docs/plan.md REL 표를 파싱해 최신 기계 증거를 조인해 보여준다.
 *   하네스는 REL 상태를 판정하지 않는다 — 상태는 plan.md의 사람 판정이고, 이 리포트는 증거만 붙인다.
 *
 * 사용법: `bun harness/report.ts [--json] [--evidence <dir>] [--plan <docs/plan.md>]`
 */

import      { existsSync, readFileSync } from "node:fs"   ;
import      { resolve                  } from "node:path" ;
import      {
              latestOf               ,
              readLatest             ,
              readRuns               ,
              type RunRecord         ,
              type RunStage          ,
                                       } from "./db.ts"   ;

const root        = resolve(import.meta.dir, ".."      ) ;
const evidenceDir = resolve(import.meta.dir, "evidence") ;

export interface BunTestCounts {
	readonly pass      : number        ;
	readonly skip      : number        ;
	readonly fail      : number        ;
	readonly tests     : number | null ;
	readonly testFiles : number | null ;
}

/** `bun test` 요약 꼬리(pass/skip/fail · Ran N tests across M files)를 파싱한다. */
export function parseBunTestOutput(text: string): BunTestCounts | null {
	const count = (pattern: RegExp): number | null => {
		const match = text.match(pattern)              ;
		return match === null ? null : Number(match[1]!) ;
	};
	const pass = count(/(\d+) pass/) ;
	const skip = count(/(\d+) skip/) ;
	const fail = count(/(\d+) fail/) ;
	if (pass === null || skip === null || fail === null) return null ;
	const ran = text.match(/Ran (\d+) tests across (\d+) files/) ;
	return {
		pass,
		skip,
		fail,
		tests     : ran === null ? null : Number(ran[1]!)   ,
		testFiles : ran === null ? null : Number(ran[2]!)   ,
	}                                                ;
}

export interface RelRow {
	readonly id      : string ;
	readonly task    : string ;
	readonly depends : string ;
	readonly status  : string ;
}

/** docs/plan.md의 "공개 배포 실행 TODO" 표에서 REL 행을 순서대로 파싱한다. */
export function parseRelTable(planMarkdown: string): RelRow[] {
	const rows: RelRow[] = [] ;
	for (const line of planMarkdown.split("\n")) {
		const match = line.match(/^\|\s*(REL\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/) ;
		if (match === null) continue                              ;
		rows.push({ id: match[1]!, task: match[2]!, depends: match[3]!, status: match[4]! }) ;
	}
	return rows                                                 ;
}

/** REL이 어떤 하네스 스테이지의 증거로 뒷받침되는지의 대응(참고용 — 판정이 아니다). */
const REL_EVIDENCE_STAGES: Readonly<Record<string, readonly string[]>> = {
	REL0  : [],
	REL1  : [],
	REL2  : ["self-align", "check"],
	REL3  : ["pack", "artifact-journey"],
	REL4  : ["check", "artifact-journey"],
	REL5  : ["check"],
	REL6  : [],
	REL7  : ["check"],
	REL8  : ["check", "artifact-journey"],
	REL9  : ["artifact-journey"],
	REL10 : ["artifact-journey"],
	REL11 : ["pack"],
	REL12 : [],
};

export function relEvidence(rel: RelRow, run: RunRecord | null): string {
	const stages = REL_EVIDENCE_STAGES[rel.id] ?? []        ;
	if (run === null || stages.length === 0) return "증거 없음(사람 판정 영역)" ;
	const parts = stages.map(id => {
		const stage = run.stages.find(entry => entry.id === id) ;
		if (stage === undefined) return `${id}=미실행`          ;
		if (stage.skipped) return `${id}=skip`                  ;
		return `${id}=${stage.ok ? "ok" : "FAIL"}`              ;
	})                                                          ;
	return `${run.startedAt.slice(0, 10)} ${parts.join(" · ")}` ;
}

function stageOf(run: RunRecord, id: string): RunStage | undefined {
	return run.stages.find(stage => stage.id === id) ;
}

function checkCounts(run: RunRecord): { readonly pass: number; readonly fail: number } | null {
	const check = stageOf(run, "check")            ;
	if (check === undefined) return null            ;
	const pass = check.metrics["pass"] ;
	const fail = check.metrics["fail"] ;
	return typeof pass === "number" && typeof fail === "number" ? { pass, fail } : null ;
}

function artifactLine(run: RunRecord | null, target: string): string | null {
	if (run === null) return null                                            ;
	const artifact = run.artifacts.find(entry => (entry.target ?? entry.name) === target) ;
	if (artifact === undefined) return null                                  ;
	return `${artifact.bytes}B sha256=${artifact.sha256.slice(0, 12)}… files=${artifact.files}` ;
}

function formatSummary(run: RunRecord): string[] {
	const lines: string[] = []                                                             ;
	lines.push(`최신 실행 ${run.ok ? "ok" : "FAIL"}  ${run.runId}`)                        ;
	lines.push(`기준: ${run.git.branch ?? "??"} @${(run.git.sha ?? "????").slice(0, 8)} dirty=${run.git.dirty} ahead=${run.git.ahead ?? "?"} · ${run.host.platform} · bun ${run.host.bun} · node ${run.host.node ?? "없음"}`) ;
	const cache = run.preconditions.npmCache                                               ;
	lines.push(`전제: npm 캐시 typescript=${cache.typescript ? "✓" : "✗"} native=${cache.typescriptNative ? "✓" : "✗"}`) ;
	lines.push(`completion: complete=${run.completion.complete} 성공=${run.completion.succeeded} 실패=${run.completion.failed} skip=${run.completion.skipped}`) ;
	for (const stage of run.stages) {
		const metrics = Object.entries(stage.metrics).map(([key, value]) => `${key}=${value}`).join(" ") ;
		const tail    = stage.error === undefined ? "" : ` — ${stage.error.slice(0, 200)}`               ;
		lines.push(`  ${stage.skipped ? "skip" : stage.ok ? "ok  " : "FAIL"}  ${stage.id.padEnd(18)} ${(stage.durationMs / 1_000).toFixed(1).padStart(9)}s  ${metrics}${tail}`) ;
	}
	for (const artifact of run.artifacts) {
		lines.push(`  artifact  ${artifact.target}  ${artifact.name}  ${artifact.bytes}B  sha256=${artifact.sha256.slice(0, 12)}…  files=${artifact.files}`) ;
	}
	for (const limitation of run.limitations) lines.push(`  한계: ${limitation}`)          ;
	return lines                                                                            ;
}

function formatTrend(latest: RunRecord, previous: RunRecord | null): string[] {
	const lines: string[] = []                                                              ;
	if (previous === null) {
		lines.push("추세: 직전 실행이 없다(첫 기록).")                                        ;
		return lines                                                                          ;
	}
	lines.push(`추세(직전 ${previous.runId} 대비):`)                                          ;
	const before = checkCounts(previous) ;
	const after  = checkCounts(latest  ) ;
	if (before !== null && after !== null) lines.push(`  check pass ${before.pass} → ${after.pass}, fail ${before.fail} → ${after.fail}`) ;
	for (const artifact of latest.artifacts) {
		const was  = artifactLine(previous, artifact.target)                                                                        ;
		const now  = artifactLine(latest, artifact.target)                                                                          ;
		const same = previous.artifacts.find(entry => (entry.target ?? entry.name) === artifact.target)?.sha256 === artifact.sha256 ;
		lines.push(`  ${artifact.target}: ${same ? "sha256 동일" : `변경 ${was ?? "없음"} → ${now}`}`) ;
	}
	return lines                                                                             ;
}

function argOf(args: readonly string[], flag: string): string | undefined {
	const index = args.indexOf(flag)                          ;
	if (index >= 0 && index + 1 < args.length) return args[index + 1] ;
	return undefined                                          ;
}

function main(): void {
	const args        = process.argv.slice(2)                                                                             ;
	const asJson      = args.includes("--json")                                                                           ;
	const evidence    = argOf(args, "--evidence") === undefined ? evidenceDir : resolve(root, argOf(args, "--evidence")!) ;
	const planPath    = resolve(root, argOf(args, "--plan") ?? "docs/plan.md")                                            ;
	const runs        = readRuns(evidence)                                                                                ;
	const snapshot    = readLatest(evidence)                                                                              ;
	const latest      = snapshot ?? latestOf(runs)                                                                        ;
	const latestIndex = latest === null ? -1 : runs.findIndex(run => run.runId === latest.runId)                          ;
	const previous    = latestIndex > 0 ? runs[latestIndex - 1]! : null                                                   ;
	const rels        = parseRelTable(readFileSync(planPath, "utf8"))                                                     ;

	if (asJson) {
		console.log(JSON.stringify({
			schemaVersion : 1,
			latest,
			previousCheck : previous === null ? null : { runId: previous.runId, counts: checkCounts(previous) },
			rel           : rels.map(rel => ({ id: rel.id, status: rel.status, evidence: relEvidence(rel, latest) })),
		}))                                                                                        ;
		return                                                                                      ;
	}

	if (latest === null) {
		console.log("실행 이력이 없다 — `bun run harness`로 첫 기록을 남긴다.")                    ;
		process.exitCode = 1                                                                       ;
		return                                                                                      ;
	}

	for (const line of formatSummary(latest)) console.log(line)                                   ;
	for (const line of formatTrend(latest, previous)) console.log(line)                           ;
	console.log(`REL 표 — ${planPath}에서 파싱(상태는 사람 판정, 하네스는 기계 증거만 조인):`)      ;
	for (const rel of rels) {
		console.log(`  ${rel.id.padEnd(6)} ${rel.status.slice(0, 40).padEnd(42)} 증거: ${relEvidence(rel, latest)}`) ;
	}
}

if (import.meta.main) main() ;
