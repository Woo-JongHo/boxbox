#!/usr/bin/env bun
/**
 * AI 사용량 집계 (M1.8). 프로젝트의 훅 기록(`.xxx/cache/usage.jsonl`, 추정 토큰)과 외부 AI 기록
 * (`~/.cache/xxx/corpus/ai-usage.jsonl`, 도구가 보고한 토큰)을 출처·이벤트별로 합친다.
 *
 * 사용법: bun scripts/usage-report.ts [--project <폴더>]
 */
import      { existsSync, readFileSync } from "node:fs"           ;
import      { homedir                  } from "node:os"           ;
import      { join                     } from "node:path"         ;
import type { UsageRecord              } from "@/common/usage.ts" ;

/** (출처, 이벤트)별 횟수·글자·토큰. 추정이 하나라도 섞이면 표시한다. */
export function summarizeUsage(records: readonly UsageRecord[]): readonly string[] {
	const rows = new Map<string, { count: number; chars: number; tokens: number; estimated: boolean }>();
	for (const record of records) {
		const key = `${record.source} ${record.event}`                                   ;
		const row = rows.get(key) ?? { count: 0, chars: 0, tokens: 0, estimated: false } ;
		rows.set(key, { count: row.count + 1, chars: row.chars + record.chars, tokens: row.tokens + record.tokens, estimated: row.estimated || record.estimated });
	}
	return [...rows].sort(([left], [right]) => left.localeCompare(right)).map(([key, row]) =>
		`${key.padEnd(44)} 횟수 ${String(row.count).padStart(4)}  글자 ${String(row.chars).padStart(8)}  토큰 ${String(row.tokens).padStart(8)}${row.estimated ? " (추정)" : ""}  회당 ${Math.round(row.tokens / row.count)}`);
}

function read(path: string): readonly UsageRecord[] {
	return existsSync(path) ? readFileSync(path, "utf8").split("\n").filter(line => line.trim() !== "").map(line => JSON.parse(line) as UsageRecord) : [];
}

function main(): void {
	const at      = process.argv.indexOf("--project")                                                                                               ;
	const project = at >= 0 ? process.argv[at + 1]! : process.cwd()                                                                                 ;
	const records = [...read(join(project, ".xxx", "cache", "usage.jsonl")), ...read(join(homedir(), ".cache", "xxx", "corpus", "ai-usage.jsonl"))] ;
	console.log(records.length === 0 ? "기록 없음" : summarizeUsage(records).join("\n"));
}

if (import.meta.main) main();
