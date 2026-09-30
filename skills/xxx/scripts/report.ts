#!/usr/bin/env bun
/**
 * 검사 리포트 CLI (M1.8 S3.5). 파일 하나에 해당 언어의 정렬기를 돌리고, 안전 검사 S1–S4와 알람 A1–A9를 출력한다.
 * --write를 주면 정렬을 쓴 뒤 한 번 더 검사해 멱등(S3)까지 확인한다. 1차 범위는 TypeScript와 Python이다.
 *
 * 사용법:
 *   bun <SKILL>/scripts/report.ts --file <대상 파일> [--write] [--json]
 * 종료 코드: 안전 검사가 하나라도 미통과면 1, 아니면 0 (알람은 실패가 아니다).
 */
import      { spawnSync                  } from "node:child_process"      ;
import      { readFileSync               } from "node:fs"                 ;
import      { fileURLToPath              } from "node:url"                ;
import      { buildReport, renderReport  } from "./common/report.ts"      ;
import type { FileResult, ResultEnvelope } from "./common/result-json.ts" ;

const LANGUAGES: readonly (readonly [RegExp, string])[] = [
	[/\.[cm]?ts$/u, "typescript"],
	[/\.py$/u     , "python"    ],
] ;

function languageOf(file: string): string {
	const found = LANGUAGES.find(([extension]) => extension.test(file))                                          ;
	if (!found) throw new Error(`1차 범위(TypeScript, Python) 밖의 파일: ${file}`)                                 ;
	return found[1]                                                                                              ;
}

/** 정렬기를 --json으로 돌려 파일 결과 하나를 받는다. 정렬기는 대기 편집이 있으면 1로 끝나므로 종료 코드는 보지 않는다. */
function runAligner(language: string, file: string, write: boolean): FileResult {
	const script = fileURLToPath(new URL(`./${language}/06_align-tables.ts`, import.meta.url)) ;
	const args   = [script, "--file", file, "--json", ...(write ? ["--write"] : [])]           ;
	const run    = spawnSync(process.execPath, args, { encoding: "utf8" })                     ;
	let envelope: ResultEnvelope                                                               ;
	try {
		envelope = JSON.parse(run.stdout) as ResultEnvelope                                                      ;
	} catch {
		throw new Error(`정렬기 출력을 읽을 수 없음 (${language}): ${run.stderr.trim() || run.stdout.trim()}`)     ;
	}
	const result = envelope.results[0]                                                                          ;
	if (!result) throw new Error(`정렬기가 결과를 내지 않음: ${file}`)                                             ;
	return result                                                                                                ;
}

function main(): void {
	const args   = process.argv.slice(2)                      ;
	const fileAt = args.indexOf("--file")                     ;
	const file   = fileAt >= 0 ? args[fileAt + 1] : undefined ;
	if (!file) throw new Error("usage: report.ts --file <target file> [--write] [--json]")                      ;
	const write    = args.includes("--write")                                           ;
	const language = languageOf(file)                                                   ;
	const result   = runAligner(language, file, write)                                  ;
	const recheck  = write ? runAligner(language, file, false) : undefined              ;
	const report   = buildReport({ result, text: readFileSync(file, "utf8"), recheck }) ;
	console.log(args.includes("--json") ? JSON.stringify(report, null, 2) : renderReport(report))               ;
	process.exit(report.ok ? 0 : 1)                                                                              ;
}

if (import.meta.main) main() ;
