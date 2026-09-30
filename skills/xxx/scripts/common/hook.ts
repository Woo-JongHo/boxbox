/**
 * 작성 시 훅의 판단 (M1.8 S3.6, docs/authoring-flow.md). 호스트(지금은 Claude Code)에서 받은 입력을 해석하고,
 * 에이전트에게 돌려줄 문장을 만든다. 파일과 프로세스는 건드리지 않는다 — 그건 `scripts/hook.ts`의 일이다.
 * 첫 범위는 읽기 전용이다: 파일을 고치지 않고, 새 알람만 알린다.
 */
import type { Report, ReportAlarm } from "./report.ts";

/** 호스트가 훅에 넘기는 입력 중 쓰는 필드 (Claude Code PreToolUse / PostToolUse). */
export interface HookInput {
	readonly session_id?  : string                                                     ;
	readonly cwd?         : string                                                     ;
	readonly tool_name?   : string                                                     ;
	readonly tool_use_id? : string                                                     ;
	readonly tool_input?  : { readonly file_path?: string; readonly content?: string } ;
}

export interface HookTarget {
	readonly file     : string ;
	readonly language : string ;
}

const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit"]) ;

const LANGUAGES: readonly (readonly [RegExp, string])[] = [
	[/\.[cm]?ts$/u, "typescript"],
	[/\.py$/u     , "python"    ],
] ;

/** 훅이 볼 대상인가: 쓰기 도구이고, 1차 범위 언어이고, .d.ts나 .xxx 안의 파일이 아니다. */
export function hookTarget(input: HookInput): HookTarget | undefined {
	const file = input.tool_input?.file_path;
	if (!file || !WRITE_TOOLS.has(input.tool_name ?? "")) return undefined;
	if (file.endsWith(".d.ts") || /[\\/]\.xxx[\\/]/u.test(file)) return undefined;

	const found = LANGUAGES.find(([extension]) => extension.test(file));

	return found ? { file, language: found[1] } : undefined;
}

/** 헌장의 핵심 줄 (`<!-- xxx:core:begin -->`과 `<!-- xxx:core:end -->` 사이). */
export function coreLines(charter: string): string {
	const begin = charter.indexOf("<!-- xxx:core:begin -->") ;
	const end   = charter.indexOf("<!-- xxx:core:end -->"  ) ;
	if (begin < 0 || end < begin) throw new Error("charter core markers are missing");

	return charter.slice(begin + "<!-- xxx:core:begin -->".length, end).trim();
}

/** 세션 시작 때 한 번 넣는 안내. */
export function sessionGuide(core: string): string {
	return [`[xxx] 이 프로젝트의 코드 가독성 원칙:`, core, "파일을 쓴 뒤 새로 생긴 알람만 알려준다."].join("\n");
}

/** 새 파일을 쓰기 직전에 언어별로 한 번 넣는 짧은 안내. */
export function newFileGuide(language: string): string {
	return [
		`[xxx] 새 ${language} 파일: 같은 역할의 줄은 같은 문형으로 쓰고, 속성(문형, 선언 종류)이 바뀌면 빈 줄로 나눈다.`,
		"같은 문형이 3줄 이상 이어지면 표로 정렬된다. 긴 예외 요소 하나 때문에 모두가 넓어지면 정렬보다 단순화가 먼저다.",
		"문장 순서는 원래 실행 순서를 지킨다. 문법: skills/xxx/references/grammar.md",
	].join("\n");
}

const renderAlarm = (alarm: ReportAlarm): string => {
	const where = alarm.startLine === alarm.endLine ? `${alarm.startLine}행` : `${alarm.startLine}–${alarm.endLine}행` ;

	return `- ${alarm.id} ${alarm.label} ${where}: ${alarm.detail} → ${alarm.hint}`;
}                                                                                                                      ;

/**
 * 에이전트가 이번 편집에서 직접 고칠 수 있는 알람. A2(권장선, 허용 구간)는 알리지 않고, A5(문형 모호)·A6(2행 쌍)·A8(대응 없음)은
 * 엔진이나 사람이 판단할 일이라 에이전트에게 보내지 않는다(판정 대기열의 몫).
 */
export const AGENT_ALARMS: ReadonlySet<string> = new Set(["A0", "A1", "A3", "A4", "A7", "A9"]) ;

/** 쓴 뒤의 리포트에서 에이전트에게 알릴 문장. 새 알람도 안전 검사 실패도 없으면 undefined(아무것도 출력하지 않음). */
export function postMessage(report: Report, limit = 12): string | undefined {
	const failed = report.checks.filter(check => check.status === "fail")                                      ;
	const fresh  = (report.comparison?.newAlarms ?? report.alarms).filter(alarm => AGENT_ALARMS.has(alarm.id)) ;
	if (failed.length === 0 && fresh.length === 0) return undefined;

	const existing = report.comparison?.existingAlarms.length ?? 0                                                                                               ;
	const lines    = [`[xxx] ${report.file}: 이번 편집으로 생긴 알람 ${fresh.length}건${existing > 0 ? ` (기존 ${existing}건은 이번 편집의 책임이 아님)` : ""}`] ;
	for (const check of failed) lines.push(`- 안전 검사 미통과 ${check.id} ${check.label}: ${check.detail}`);
	lines.push(...fresh.slice(0, limit).map(renderAlarm));
	if (fresh.length > limit) lines.push(`- … 외 ${fresh.length - limit}건 (bun <SKILL>/scripts/report.ts --file ${report.file})`);

	return lines.join("\n");
}
