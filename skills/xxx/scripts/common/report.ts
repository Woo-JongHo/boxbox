/**
 * 검사 리포트 (M1.8 S3.5): 정렬기의 결과(Result JSON의 한 파일)와 파일 본문으로
 * 안전 검사 S1–S4의 통과/미통과와 알람 A1–A9를 만든다. 순수 함수라 같은 입력이면 같은 리포트가 나온다.
 * 알람은 실패가 아니라 "사람이나 AI가 볼 곳"이다. 판단(고칠지, 규칙을 바꿀지)은 이 모듈의 일이 아니다.
 */
import      { displayWidth            } from "./display-width.ts" ;
import type { FileResult, ResultGroup } from "./result-json.ts"   ;
import      { patternOf               } from "./surface.ts"       ;

export const REPORT_SCHEMA_VERSION = 1 ;

/** 알람 기준. 숫자는 약속(3층)의 기본값이며 사용자가 바꿀 수 있다. hard/soft는 실측 전 추정치다. */
export interface ReportLimits {
	/** 한계선: 기준 환경에서 가로 스크롤이 생기기 직전 칸 (docs/research/column-width.md, 측정 대기) */
	readonly hard         : number ;
	/** 권장선: 넘으면 제안만 한다 */
	readonly soft         : number ;
	/** 이상값: 가장 긴 행이 두 번째로 긴 행보다 이만큼 넓으면 알람 (import 규칙 B와 같은 20) */
	readonly outlierGap   : number ;
	/** 공백 낭비: 표 안에서 정렬 공백 ÷ 내용 글자가 이 비율을 넘으면 알람 */
	readonly paddingRatio : number ;
	/** 큰 변경량: 한 그룹의 대기 중인 편집이 이 수 이상이면 알람 */
	readonly largeEdits   : number ;
}

export const DEFAULT_LIMITS: ReportLimits = { hard: 118, soft: 100, outlierGap: 20, paddingRatio: 0.5, largeEdits: 20 } ;

/** 2행부터 자동 수정이 허용된 kind (사용자 승인, 헌장 불변식 4) */
const TWO_ROW_KINDS = new Set(["declaration-equals", "import-declarations"]) ;

export type CheckStatus = "pass" | "fail" | "not-run" | "skipped" ;

export interface ReportCheck {
	readonly id     : "S1" | "S2" | "S3" | "S4" ;
	readonly label  : string                    ;
	readonly status : CheckStatus               ;
	readonly detail : string                    ;
}

export type AlarmId = "A1" | "A2" | "A3" | "A4" | "A5" | "A6" | "A7" | "A8" | "A9" ;

export interface ReportAlarm {
	readonly id        : AlarmId ;
	readonly label     : string  ;
	readonly startLine : number  ;
	readonly endLine   : number  ;
	readonly detail    : string  ;
	readonly hint      : string  ;
	/** 기준본과 짝지을 때 쓰는 대상: 알람 첫 줄의 내용(공백을 하나로 접음). 줄 번호나 정렬 공백이 바뀌어도 같다. */
	readonly anchor    : string  ;
}

/** 기준본 대비 알람 비교 (docs/authoring-flow.md 3절): 종류와 대상으로 짝짓고, 개수로 비교하지 않는다. */
export interface AlarmComparison {
	readonly newAlarms      : readonly ReportAlarm[] ;
	readonly existingAlarms : readonly ReportAlarm[] ;
	readonly resolvedAlarms : readonly ReportAlarm[] ;
}

export interface Report {
	readonly schemaVersion : number                           ;
	readonly file          : string                           ;
	readonly language      : string                           ;
	readonly mode          : "check" | "write"                ;
	readonly limits        : ReportLimits                     ;
	readonly states        : Readonly<Record<string, number>> ;
	readonly checks        : readonly ReportCheck[]           ;
	readonly alarms        : readonly ReportAlarm[]           ;
	/** 안전 검사가 하나라도 fail이면 false. 알람은 실패로 치지 않는다. */
	readonly ok            : boolean                ;
	/** --baseline을 준 경우에만 있다. */
	readonly comparison?   : AlarmComparison        ;
}

export interface ReportInput {
	readonly result     : FileResult          ;
	/** 검사 대상 파일의 현재 본문 (--write 뒤라면 쓴 뒤의 본문) */
	readonly text       : string              ;
	/** --write 뒤 다시 돌린 check 결과. 멱등 검사(S3)에만 쓴다 */
	readonly recheck?   : FileResult          ;
	readonly limits?    : ReportLimits        ;
}

const ALARM_LABELS: Readonly<Record<AlarmId, string>> = {
	A1 : "한계선 초과"     ,
	A2 : "권장선 초과"     ,
	A3 : "이상값 행"       ,
	A4 : "분해 실패"       ,
	A5 : "문형 모호"       ,
	A6 : "2행 쌍"          ,
	A7 : "공백 낭비"       ,
	A8 : "문형 대응 없음"  ,
	A9 : "큰 변경량"       ,
} ;

function patternName(language: string, group: ResultGroup): string | undefined {
	const match = patternOf(language, { kind: language === "typescript" ? group.kind : undefined, axes: group.axes }) ;
	return match ? [match.pattern, ...match.alternatives].join("|") : undefined                                     ;
}

const PARSE_DETAIL: Readonly<Record<FileResult["parse"]["status"], (tool: string) => string>> = {
	"ok"      : tool => `${tool} 파서로 다시 읽어 진단이 같음`                    ,
	"changed" : tool => `${tool} 파서 진단이 달라져 쓰기를 되돌림`                ,
	"skipped" : tool => `${tool} 파서가 설치되어 있지 않음`                       ,
	"not-run" : ()   => "check 모드는 파일을 쓰지 않으므로 --write 때만 확인"     ,
} ;

function checksOf(input: ReportInput): readonly ReportCheck[] {
	const { result, recheck } = input                                                                                     ;
	const refused     = result.groups.filter(group => group.state === "REFUSE").length                                               ;
	const floorBreaks = result.groups.filter(group => group.state === "FIXABLE" && group.rows < 3 && !TWO_ROW_KINDS.has(group.kind)) ;
	const parse       = result.parse.status                                                                                          ;
	const idempotent  = recheck === undefined ? undefined : recheck.summary.edits === 0 && recheck.summary.misaligned === 0          ;
	return [
		{ id : "S1" , label : "공백만 바뀜"          , status : "pass"                                                              , detail : `엔진이 편집마다 토큰·문자열·주석 보존을 검증하고, 실패한 편집은 쓰지 않는다 (거부된 그룹 ${refused})`                                                          },
		{ id : "S2" , label : "재파싱 진단 동일"     , status : parse === "ok" ? "pass" : parse === "changed" ? "fail" : parse      , detail : PARSE_DETAIL[parse](result.parse.tool || result.language)                                                                                                       },
		{ id : "S3" , label : "멱등"                 , status : idempotent === undefined ? "not-run" : idempotent ? "pass" : "fail" , detail : idempotent === undefined ? "--write 뒤 다시 검사할 때만 확인" : `다시 검사한 대기 편집 ${recheck!.summary.edits}`                                               },
		{ id : "S4" , label : "자동 수정은 3행 이상" , status : floorBreaks.length === 0 ? "pass" : "fail"                          , detail : floorBreaks.length === 0 ? "2행 예외는 declaration-equals, import만" : floorBreaks.map(group => `${group.startLine}-${group.endLine} ${group.kind}`).join(", ") },
	] ;
}

/** 표 안에서 정렬용으로 보이는 공백(2칸 이상 연속, 들여쓰기 제외)과 내용 글자 수. */
function paddingOf(line: string): { readonly padding: number; readonly content: number } {
	const body    = line.replace(/^[ \t]*/u, "")                                                       ;
	const padding = [...body.matchAll(/ {2,}/gu)].reduce((sum, match) => sum + match[0].length - 1, 0) ;
	const content = body.replace(/\s/gu, "").length                                                    ;
	return { padding, content }                                                                   ;
}

function alarmsOf(input: ReportInput, limits: ReportLimits): readonly ReportAlarm[] {
	const { result, text } = input                                                                 ;
	const lines                 = text.split("\n").map(line => line.replace(/\r$/u, ""))                    ;
	const widthOf               = (lineNumber: number): number => displayWidth(lines[lineNumber - 1] ?? "") ;
	const alarms: ReportAlarm[] = []                                                                        ;
	const push = (id: AlarmId, startLine: number, endLine: number, detail: string, hint: string): void => {
		const anchor = (lines[startLine - 1] ?? "").trim().replace(/\s+/gu, " ")                   ;
		alarms.push({ id, label: ALARM_LABELS[id], startLine, endLine, detail, hint, anchor })       ;
	}                                                                                              ;
	const groupAt = (lineNumber: number): ResultGroup | undefined =>
		result.groups.find(group => group.startLine <= lineNumber && lineNumber <= group.endLine)    ;

	// ① 화면 축: 가로 스크롤이 생기는 줄. 같은 표 안의 줄은 알람 하나로 묶고, 문형과 열 수(밀도 축)를 함께 적는다.
	const reported = new Set<ResultGroup>()                                                                          ;
	for (let lineNumber = 1; lineNumber <= lines.length; lineNumber += 1) {
		const width = widthOf(lineNumber)                                                                            ;
		if (width <= limits.hard) continue                                                                           ;
		const group = groupAt(lineNumber)                                  ;
		const hint  = "넘는 행만 세로형으로, 또는 예외 요소를 먼저 단순화" ;
		if (!group) {
			push("A1", lineNumber, lineNumber, `${width}칸 > 한계 ${limits.hard} · 표 밖`, hint)                      ;
			continue                                                                                                 ;
		}
		if (reported.has(group)) continue                                                                            ;
		reported.add(group)                                                                                          ;
		const rows   = Array.from({ length: group.endLine - group.startLine + 1 }, (_, index) => group.startLine + index) ;
		const over   = rows.filter(row => widthOf(row) > limits.hard)                                                     ;
		const widest = Math.max(...over.map(widthOf))                                                                     ;
		push("A1", group.startLine, group.endLine, `${over.length}행이 한계 ${limits.hard} 초과 (최대 ${widest}칸) · 문형 ${patternName(result.language, group) ?? "?"} · 열 ${group.axes.length}`, hint) ;
	}

	for (const group of result.groups) {
		const rows    = Array.from({ length: group.endLine - group.startLine + 1 }, (_, index) => group.startLine + index) ;
		const widths  = rows.map(widthOf)                                                                                  ;
		const widest  = Math.max(...widths)                                                                                ;
		const pattern = patternName(result.language, group)                                                                ;
		const span    = [group.startLine, group.endLine] as const                                                          ;

		if (widest > limits.soft && widest <= limits.hard) push("A2", ...span, `표 폭 ${widest} > 권장 ${limits.soft}`, "허용 구간. 단순화할 수 있는지 검토") ;

		const sorted = [...widths].sort((left, right) => right - left)                                                     ;
		if (sorted.length >= 3 && sorted[0]! - sorted[1]! >= limits.outlierGap) {
			const row = rows[widths.indexOf(sorted[0]!)]!                                                                  ;
			push("A3", row, row, `가장 긴 행이 두 번째보다 ${sorted[0]! - sorted[1]!}칸 넓음`, "그 행의 예외 요소를 먼저 단순화")                  ;
		}

		if (group.state === "REFUSE" ) push("A4", ...span, `${group.kind}: 손실 없이 나눌 수 없음`, "행 구조를 확인. 엔진 버그면 fixture로")          ;
		if (group.state === "SUGGEST") push("A6", ...span, `${group.kind} ${group.rows}행`, "표로 만들지는 사람이 결정")                          ;

		if (pattern === undefined) push("A8", ...span, `${group.kind} (축 ${group.axes.map(axis => axis.split("=")[0]).join(">")})`, "표현형 데이터에 대응 추가")    ;
		else if (pattern.includes("|")) push("A5", ...span, `${pattern}`, "엔진이 가를 수 없는 문형. 판정으로 정함")                              ;

		const padding = rows.map(row => paddingOf(lines[row - 1] ?? "")).reduce((sum, cell) => ({ padding: sum.padding + cell.padding, content: sum.content + cell.content }), { padding: 0, content: 0 }) ;
		if (padding.content > 0 && padding.padding / padding.content > limits.paddingRatio) {
			push("A7", ...span, `정렬 공백 ${padding.padding} / 내용 ${padding.content}`, "공백이 의미 단위를 떼어 놓는지 확인")                 ;
		}

		if (group.state === "FIXABLE" && group.edits >= limits.largeEdits) push("A9", ...span, `대기 편집 ${group.edits}`, "변경 전후를 사람이 확인") ;
	}
	return alarms.sort((left, right) => left.startLine - right.startLine || left.id.localeCompare(right.id)) ;
}

export function buildReport(input: ReportInput): Report {
	const limits                         = input.limits ?? DEFAULT_LIMITS ;
	const checks                         = checksOf(input)                ;
	const states: Record<string, number> = {}                             ;
	for (const group of input.result.groups) states[group.state] = (states[group.state] ?? 0) + 1 ;
	return {
		schemaVersion : REPORT_SCHEMA_VERSION                 ,
		file          : input.result.file                     ,
		language      : input.result.language                 ,
		mode          : input.result.mode                     ,
		limits                                                ,
		states                                                ,
		checks                                                ,
		alarms        : alarmsOf(input, limits)               ,
		ok            : checks.every(check => check.status !== "fail") ,
	} ;
}

const alarmKey = (alarm: ReportAlarm): string => `${alarm.id}|${alarm.anchor}` ;

/** 결과의 알람을 기준본의 알람과 종류·대상으로 하나씩 짝짓는다. 같은 키가 여럿이면 개수만큼만 짝지어진다. */
export function compareAlarms(current: readonly ReportAlarm[], baseline: readonly ReportAlarm[]): AlarmComparison {
	const unmatched = new Map<string, ReportAlarm[]>()                                  ;
	for (const alarm of baseline) {
		const bucket = unmatched.get(alarmKey(alarm)) ?? []                             ;
		bucket.push(alarm)                                                              ;
		unmatched.set(alarmKey(alarm), bucket)                                          ;
	}
	const newAlarms      : ReportAlarm[] = [] ;
	const existingAlarms : ReportAlarm[] = [] ;
	for (const alarm of current) {
		const match = unmatched.get(alarmKey(alarm))?.shift()                           ;
		if (match) existingAlarms.push(alarm)                                           ;
		else newAlarms.push(alarm)                                                      ;
	}
	return { newAlarms, existingAlarms, resolvedAlarms: [...unmatched.values()].flat() } ;
}

/** 리포트에 기준본 비교를 붙인다. 안전 검사와 종료 코드는 그대로다. */
export function withBaseline(report: Report, baseline: Report): Report {
	return { ...report, comparison: compareAlarms(report.alarms, baseline.alarms) } ;
}

/** 표시 폭(한글 2칸) 기준으로 오른쪽을 채운다. */
const padDisplay = (value: string, width: number): string => value + " ".repeat(Math.max(0, width - displayWidth(value))) ;

const STATUS_TEXT: Readonly<Record<CheckStatus, string>> = { "pass": "통과", "fail": "미통과", "not-run": "해당 없음", "skipped": "건너뜀 (도구 없음)" } ;

/** 사람이 읽는 리포트. */
export function renderReport(report: Report): string {
	const lines = [`xxx report ${report.file}  (${report.language}, ${report.mode})`, "", "안전 검사"] ;
	for (const check of report.checks) lines.push(`  ${check.id} ${padDisplay(check.label, 22)} ${padDisplay(STATUS_TEXT[check.status], 20)} ${check.detail}`) ;
	const states = Object.entries(report.states).map(([state, count]) => `${state} ${count}`).join(" · ")                                        ;
	lines.push("", `그룹 ${Object.values(report.states).reduce((sum, count) => sum + count, 0)}개: ${states || "없음"}`, "")                     ;
	const renderAlarm = (alarm: ReportAlarm): string => {
		const where = alarm.startLine === alarm.endLine ? `${alarm.startLine}행` : `${alarm.startLine}–${alarm.endLine}행` ;
		return `  ${alarm.id} ${padDisplay(alarm.label, 14)} ${padDisplay(where, 12)} ${alarm.detail}  → ${alarm.hint}`   ;
	}                                                                                                                      ;
	const limits = `(한계 ${report.limits.hard} · 권장 ${report.limits.soft}: 추정치, 실측 대기)`                            ;
	const { comparison } = report                                                                                          ;
	if (!comparison) {
		lines.push(`알람 ${report.alarms.length}건  ${limits}`, ...report.alarms.map(renderAlarm))                            ;
	} else {
		lines.push(`새 알람 ${comparison.newAlarms.length}건  ${limits}`, ...comparison.newAlarms.map(renderAlarm))           ;
		lines.push("", `기존 알람 ${comparison.existingAlarms.length}건 (기준본에도 있던 것, 이번 편집의 책임 아님)`)          ;
		lines.push(...comparison.existingAlarms.map(renderAlarm))                                                             ;
		lines.push("", `사라진 알람 ${comparison.resolvedAlarms.length}건`)                                                  ;
		lines.push(...comparison.resolvedAlarms.map(alarm => `  ${alarm.id} ${padDisplay(alarm.label, 14)} 기준본 ${alarm.startLine}행: ${alarm.anchor}`)) ;
	}
	lines.push("", report.ok ? "결과: 안전 검사 통과 (알람은 실패로 치지 않음)" : "결과: 안전 검사 미통과")                                   ;
	return lines.join("\n")                                                                                                                         ;
}
