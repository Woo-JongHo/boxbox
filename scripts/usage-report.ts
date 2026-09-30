#!/usr/bin/env bun
/**
 * AI 사용량·정확도 집계 (M1.8). 프로젝트의 훅 기록(`.xxx/cache/usage.jsonl`, 추정 토큰)과 외부 AI 기록
 * (`~/.cache/xxx/corpus/ai-usage.jsonl`, 도구가 보고한 토큰)을 모델·출처·이벤트별로 합치고, AI 사전 판정이 사람 판정과
 * 얼마나 일치하는지 계산한다. `--doc`이면 배포 비용 문서(docs/research/ai-cost.md)를 다시 만든다.
 *
 * 사용법: bun scripts/usage-report.ts [--project <폴더>] [--doc]
 */
import      { existsSync, readFileSync, writeFileSync  } from "node:fs"           ;
import      { homedir                                  } from "node:os"           ;
import      { join                                     } from "node:path"         ;
import type { UsageRecord                              } from "@/common/usage.ts" ;
import      { latestSuggestions, latestVerdicts, QUEUE } from "./corpus-judge.ts" ;

const ROOT = join(import.meta.dir, "..");

export interface UsageRow {
	readonly model     : string  ;
	readonly source    : string  ;
	readonly event     : string  ;
	readonly count     : number  ;
	readonly chars     : number  ;
	readonly tokens    : number  ;
	readonly estimated : boolean ;
}

/** (모델, 출처, 이벤트)별로 합친다. 정렬은 모델 → 출처 → 이벤트. */
export function usageRows(records: readonly UsageRecord[]): readonly UsageRow[] {
	const rows = new Map<string, UsageRow>();
	for (const record of records) {
		const model = record.model ?? "unknown"                                                                                               ;
		const key   = `${model}\u0000${record.source}\u0000${record.event}`                                                                   ;
		const row   = rows.get(key) ?? { model, source: record.source, event: record.event, count: 0, chars: 0, tokens: 0, estimated: false } ;
		rows.set(key, { ...row, count: row.count + 1, chars: row.chars + record.chars, tokens: row.tokens + record.tokens, estimated: row.estimated || record.estimated });
	}
	return [...rows.values()].sort((left, right) => left.model.localeCompare(right.model) || left.source.localeCompare(right.source) || left.event.localeCompare(right.event));
}

export interface Agreement {
	readonly reviewer : string ;
	readonly judged   : number ;
	readonly agreed   : number ;
}

/** AI 사전 판정과 사람 판정이 둘 다 있는 유형에서 판정이 같은 비율. 검토자(모델)별. */
export function agreementOf(suggestionLines: readonly string[], verdictLines: readonly string[]): readonly Agreement[] {
	const suggestions = latestSuggestions(suggestionLines)                    ;
	const verdicts    = latestVerdicts(verdictLines)                          ;
	const byReviewer  = new Map<string, { judged: number; agreed: number }>() ;

	for (const [signature, suggestion] of suggestions) {
		const verdict = verdicts.get(signature);
		if (!verdict) continue;

		const reviewer = suggestion.model ?? suggestion.reviewer              ;
		const row      = byReviewer.get(reviewer) ?? { judged: 0, agreed: 0 } ;
		byReviewer.set(reviewer, { judged: row.judged + 1, agreed: row.agreed + (verdict.verdict === suggestion.verdict ? 1 : 0) });
	}
	return [...byReviewer].map(([reviewer, row]) => ({ reviewer, ...row })).sort((left, right) => left.reviewer.localeCompare(right.reviewer));
}

const lines = (path: string): readonly string[] => existsSync(path) ? readFileSync(path, "utf8").split("\n") : [];

function read(path: string): readonly UsageRecord[] {
	return lines(path).filter(line => line.trim() !== "").map(line => JSON.parse(line) as UsageRecord);
}

function renderRows(rows: readonly UsageRow[]): readonly string[] {
	return [
		"| 모델 | 출처 | 이벤트 | 횟수 | 글자 | 토큰 | 회당 토큰 |",
		"|---|---|---|---|---|---|---|",
		...rows.map(row => `| ${row.model} | ${row.source} | ${row.event} | ${row.count} | ${row.chars} | ${row.tokens}${row.estimated ? " (추정)" : ""} | ${Math.round(row.tokens / row.count)} |`),
	];
}

function renderAgreement(agreements: readonly Agreement[], suggestions: number, verdicts: number): readonly string[] {
	if (agreements.length === 0) return [`사람 판정 ${verdicts}건, AI 제안 ${suggestions}건: 둘 다 있는 유형이 없어 아직 계산할 수 없다.`];

	return [
		"| 검토자(모델) | 비교한 유형 | 일치 | 일치율 |",
		"|---|---|---|---|",
		...agreements.map(row => `| ${row.reviewer} | ${row.judged} | ${row.agreed} | ${(row.agreed / row.judged * 100).toFixed(0)}% |`),
	];
}

function main(): void {
	const at        = process.argv.indexOf("--project")                                                                                               ;
	const project   = at >= 0 ? process.argv[at + 1]! : process.cwd()                                                                                 ;
	const records   = [...read(join(project, ".xxx", "cache", "usage.jsonl")), ...read(join(homedir(), ".cache", "xxx", "corpus", "ai-usage.jsonl"))] ;
	const queue     = lines(QUEUE).filter(line => line.trim() !== "")                                                                                 ;
	const verdicts  = lines(join(ROOT, "corpus", "verdicts.jsonl")).filter(line => line.trim() !== "")                                                ;
	const usage     = renderRows(usageRows(records))                                                                                                  ;
	const agreement = renderAgreement(agreementOf(queue, verdicts), latestSuggestions(queue).size, latestVerdicts(verdicts).size)                     ;

	if (!process.argv.includes("--doc")) {
		console.log([...usage, "", ...agreement].join("\n"));
		return;
	}

	const doc = [
		"# AI 사용량과 정확도 — 배포하면 얼마나 쓸까",
		"",
		`자동 생성: \`bun scripts/usage-report.ts --doc\` · 기록 ${records.length}건`,
		"",
		"## 측정 방식",
		"",
		"- **훅 주입분:** 에이전트(호스트 모델)의 입력으로 들어가는 글. 토크나이저 없이 추정한다(ASCII 4글자당 1, 그 밖 1글자당 1). 모델은 호스트가 알려주지 않으면 `host`.",
		"- **외부 AI(Codex):** 도구가 보고한 토큰과 모델·추론 강도. 캐시된 입력은 빼고 세는 것으로 보인다(짧은 요청이 유난히 적게 나옴).",
		"- **Claude 세션 자체**(설계·구현 대화)는 여기 없다. Claude Code의 `/cost`로 확인한다.",
		"",
		"## 사용량",
		"",
		...usage,
		"",
		"## 정확도 (AI 사전 판정 vs 사람 판정)",
		"",
		...agreement,
		"",
		"## 배포 시 추정 방법",
		"",
		"- 사용자 한 명의 하루 토큰 ≈ 세션 수 × 세션 시작 회당 + 새 파일 수 × 새 파일 안내 회당 + 편집 수 × (새 알람이 생긴 편집 비율) × 쓴 뒤 알람 회당.",
		"- 새 알람 비율은 실제 사용 기록이 쌓여야 정해진다(흉내 측정만 있음).",
		"- 외부 AI(사전 판정·교차 검토)는 개발 과정의 비용이며, 사용자 쪽 기본 흐름에는 들어가지 않는다.",
		"",
	].join("\n");
	writeFileSync(join(ROOT, "docs", "research", "ai-cost.md"), doc);
	console.log("wrote docs/research/ai-cost.md");
}

if (import.meta.main) main();
