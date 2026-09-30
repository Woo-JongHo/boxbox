#!/usr/bin/env bun
/**
 * 검사 리포트 CLI (M1.8 S3.5). 파일 하나에 해당 언어의 정렬기를 돌리고, 안전 검사 S1–S4와 알람 A1–A9를 출력한다.
 * --write를 주면 정렬을 쓴 뒤 한 번 더 검사해 멱등(S3)까지 확인한다. 1차 범위는 TypeScript와 Python이다.
 * --baseline <파일>을 주면 편집 전 기준본을 같은 방식으로 검사해, 알람을 새 알람·기존 알람·사라진 알람으로 나눈다
 * (docs/authoring-flow.md 3절). 새 파일이면 --baseline none. 없는 기준본 경로는 오타로 보고 오류로 끝낸다.
 * CLI 출력의 오류 메시지는 영어다(AGENTS.md 언어 정책).
 *
 * 사용법:
 *   bun <SKILL>/scripts/report.ts --file <대상 파일> [--baseline <기준본|none>] [--write] [--json]
 * 종료 코드: 안전 검사가 하나라도 미통과면 1, 아니면 0 (알람은 실패가 아니다).
 */
import      { spawnSync                                } from "node:child_process"      ;
import      { existsSync, readFileSync                 } from "node:fs"                 ;
import      { fileURLToPath                            } from "node:url"                ;
import      { buildReport, compareAlarms, renderReport } from "./common/report.ts"      ;
import type { FileResult, ResultEnvelope               } from "./common/result-json.ts" ;

const LANGUAGES: readonly (readonly [RegExp, string])[] = [
	[/\.[cm]?ts$/u, "typescript"],
	[/\.py$/u     , "python"    ],
];

function languageOf(file: string): string {
	const found = LANGUAGES.find(([extension]) => extension.test(file));
	if (!found) throw new Error(`outside the first scope (TypeScript, Python): ${file}`);

	return found[1];
}

/** 정렬기를 --json으로 돌려 파일 결과 하나를 받는다. 정렬기는 대기 편집이 있으면 1로 끝나므로 종료 코드는 보지 않는다. */
function runAligner(language: string, file: string, write: boolean): FileResult {
	const script = fileURLToPath(new URL(`./${language}/06_align-tables.ts`, import.meta.url)) ;
	const args   = [script, "--file", file, "--json", ...(write ? ["--write"] : [])]           ;
	const run    = spawnSync(process.execPath, args, { encoding: "utf8" })                     ;

	let envelope: ResultEnvelope;
	try {
		envelope = JSON.parse(run.stdout) as ResultEnvelope;
	} catch {
		throw new Error(`cannot read the ${language} aligner output: ${run.stderr.trim() || run.stdout.trim()}`);
	}

	const result = envelope.results[0];
	if (!result) throw new Error(`the aligner returned no result: ${file}`);

	return result;
}

/** --baseline이 있으면 기준본의 알람과 짝지은 비교를 붙인다. `none`은 새 파일(기준본 알람 없음)이다. */
function baselineOf(args: readonly string[], language: string, current: ReturnType<typeof buildReport>): ReturnType<typeof buildReport> {
	const at = args.indexOf("--baseline");
	if (at < 0) return current;

	const path = args[at + 1];
	if (!path) throw new Error("--baseline needs a file path or none");
	if (path === "none") return { ...current, comparison: compareAlarms(current.alarms, []) };
	if (!existsSync(path)) throw new Error(`baseline not found: ${path} (use --baseline none for a new file)`);

	const baseline = buildReport({ result: runAligner(language, path, false), text: readFileSync(path, "utf8") });

	return { ...current, comparison: compareAlarms(current.alarms, baseline.alarms) };
}

function main(): void {
	const args   = process.argv.slice(2)                      ;
	const fileAt = args.indexOf("--file")                     ;
	const file   = fileAt >= 0 ? args[fileAt + 1] : undefined ;
	if (!file) throw new Error("usage: report.ts --file <target file> [--baseline <file|none>] [--write] [--json]");

	const write    = args.includes("--write")                                           ;
	const language = languageOf(file)                                                   ;
	const result   = runAligner(language, file, write)                                  ;
	const recheck  = write ? runAligner(language, file, false) : undefined              ;
	const current  = buildReport({ result, text: readFileSync(file, "utf8"), recheck }) ;
	const report   = baselineOf(args, language, current)                                ;

	console.log(args.includes("--json") ? JSON.stringify(report, null, 2) : renderReport(report));
	process.exit(report.ok ? 0 : 1);
}

if (import.meta.main) main();
