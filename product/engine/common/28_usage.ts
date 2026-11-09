/**
 * AI usage records (M1.8). Records the tokens of text the hooks inject into the agent and of external AI (Codex) calls, to measure how much
 * AI cost this product uses. Hook injections are estimated without a tokenizer: 1 token per 4 ASCII characters, 1 token per other (e.g. CJK) character.
 * This can differ from the real value, so records carry `estimated: true`. External AI uses the value that tool reports.
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
	/** The model that processed these tokens. Hook injections are received by the host model; "host" when the host does not say. */
	readonly model?    : string  ;
	/** Reasoning strength (such as Codex reasoning effort). */
	readonly effort?   : string  ;
}

/** Estimated tokens: 1 per 4 ASCII characters, 1 per other character. */
export function estimateTokens(text: string): number {
	let ascii = 0 ;
	let other = 0 ;
	for (const character of text) {
		if (character.charCodeAt(0) < 128) ascii += 1;
		else other += 1;
	}
	return Math.ceil(ascii / 4) + other;
}

/** Reads the number from "tokens used\n27,877" that the Codex CLI leaves on stderr. undefined if absent. */
export function codexTokens(stderr: string): number | undefined {
	const match = /tokens used\s*\n?\s*([\d,]+)/u.exec(stderr);

	return match ? Number(match[1]!.replaceAll(",", "")) : undefined;
}

/** The model and reasoning effort the Codex CLI prints at the top of stderr. */
export function codexModel(stderr: string): { readonly model?: string; readonly effort?: string } {
	const model  = /^model:\s*(\S+)/mu.exec(stderr)?.[1]            ;
	const effort = /^reasoning effort:\s*(\S+)/mu.exec(stderr)?.[1] ;

	return { ...(model ? { model } : {}), ...(effort ? { effort } : {}) };
}

export function appendUsage(path: string, record: UsageRecord): void {
	appendFileSync(path, `${JSON.stringify(record)}\n`);
}
