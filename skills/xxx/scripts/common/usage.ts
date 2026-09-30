/**
 * AI 사용량 기록 (M1.8). 훅이 에이전트에 주입하는 글과 외부 AI(Codex) 호출의 토큰을 남겨, 이 제품이 AI 비용을 얼마나
 * 쓰는지 잰다. 훅 주입분은 토크나이저 없이 추정한다: ASCII는 4글자당 1토큰, 그 밖(한글 등)은 1글자당 1토큰.
 * 실제 값과 다를 수 있으므로 기록에 `estimated: true`를 남긴다. 외부 AI는 그 도구가 보고한 값을 그대로 쓴다.
 */
import { appendFileSync } from "node:fs";

export interface UsageRecord {
	readonly date      : string  ;
	readonly source    : string  ;
	readonly event     : string  ;
	readonly chars     : number  ;
	readonly tokens    : number  ;
	readonly estimated : boolean ;
	readonly file?     : string  ;
}

/** 추정 토큰: ASCII 4글자당 1, 그 밖 1글자당 1. */
export function estimateTokens(text: string): number {
	let ascii = 0 ;
	let other = 0 ;
	for (const character of text) {
		if (character.charCodeAt(0) < 128) ascii += 1;
		else other += 1;
	}
	return Math.ceil(ascii / 4) + other;
}

/** Codex CLI가 stderr에 남기는 "tokens used\n27,877"에서 숫자를 읽는다. 없으면 undefined. */
export function codexTokens(stderr: string): number | undefined {
	const match = /tokens used\s*\n?\s*([\d,]+)/u.exec(stderr);

	return match ? Number(match[1]!.replaceAll(",", "")) : undefined;
}

export function appendUsage(path: string, record: UsageRecord): void {
	appendFileSync(path, `${JSON.stringify(record)}\n`);
}
