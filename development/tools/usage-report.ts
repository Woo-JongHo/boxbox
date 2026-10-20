#!/usr/bin/env bun
/**
 * AI usage and accuracy summary (M1.8). Combines the project's hook records (`.boxbox/cache/usage.jsonl`, estimated tokens) and external AI records
 * (`~/.cache/boxbox/corpus/ai-usage.jsonl`, tokens reported by the tool) by model, source and event, and computes how often AI pre-verdicts agree
 * with human verdicts. With `--doc` it regenerates the release cost document (docs/development/research/ai-cost.md).
 *
 * Usage: bun development/tools/usage-report.ts [--project <folder>] [--doc]
 */
import      { existsSync, readFileSync, writeFileSync  } from "node:fs"           ;
import      { homedir                                  } from "node:os"           ;
import      { join                                     } from "node:path"         ;
import type { UsageRecord                              } from "@/common/usage.ts" ;
import      { latestSuggestions, latestVerdicts, QUEUE } from "./corpus-judge.ts" ;

const ROOT = join(import.meta.dir, "..", "..");

export interface UsageRow {
	readonly model     : string  ;
	readonly source    : string  ;
	readonly event     : string  ;
	readonly count     : number  ;
	readonly chars     : number  ;
	readonly tokens    : number  ;
	readonly estimated : boolean ;
}

/** Sums by (model, source, event). Sorted by model → source → event. */
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

/** Share of matching verdicts among types that have both an AI pre-verdict and a human verdict. Per reviewer (model). */
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
		"| Model | Source | Event | Calls | Characters | Tokens | Tokens per call |",
		"|---|---|---|---|---|---|---|",
		...rows.map(row => `| ${row.model} | ${row.source} | ${row.event} | ${row.count} | ${row.chars} | ${row.tokens}${row.estimated ? " (estimated)" : ""} | ${Math.round(row.tokens / row.count)} |`),
	];
}

function renderAgreement(agreements: readonly Agreement[], suggestions: number, verdicts: number): readonly string[] {
	if (agreements.length === 0) return [`${verdicts} human verdict(s), ${suggestions} AI suggestion(s): no type has both yet, so this cannot be computed.`];

	return [
		"| Reviewer (model) | Types compared | Agreed | Agreement rate |",
		"|---|---|---|---|",
		...agreements.map(row => `| ${row.reviewer} | ${row.judged} | ${row.agreed} | ${(row.agreed / row.judged * 100).toFixed(0)}% |`),
	];
}

function main(): void {
	const at        = process.argv.indexOf("--project")                                                                                                     ;
	const project   = at >= 0 ? process.argv[at + 1]! : process.cwd()                                                                                       ;
	const records   = [...read(join(project, ".boxbox", "cache", "usage.jsonl")), ...read(join(homedir(), ".cache", "boxbox", "corpus", "ai-usage.jsonl"))] ;
	const queue     = lines(QUEUE).filter(line => line.trim() !== "")                                                                                       ;
	const verdicts  = lines(join(ROOT, "development", "corpus", "verdicts.jsonl")).filter(line => line.trim() !== "")                                       ;
	const usage     = renderRows(usageRows(records))                                                                                                        ;
	const agreement = renderAgreement(agreementOf(queue, verdicts), latestSuggestions(queue).size, latestVerdicts(verdicts).size)                           ;

	if (!process.argv.includes("--doc")) {
		console.log([...usage, "", ...agreement].join("\n"));
		return;
	}

	const doc = [
		"# AI usage and accuracy — how much would a release use?",
		"",
		`Generated: \`bun development/tools/usage-report.ts --doc\` · ${records.length} record(s)`,
		"",
		"## Method",
		"",
		"- **Hook injections:** text that enters the agent's (host model's) input. Estimated without a tokenizer (1 per 4 ASCII characters, 1 per other character). The model is `host` when the host does not say.",
		"- **External AI (Codex):** tokens, model and reasoning effort reported by the tool. Cached input appears to be excluded (short requests come out unusually low).",
		"- **The Claude session itself** (design and implementation conversation) is not here. Check it with Claude Code's `/cost`.",
		"",
		"## Usage",
		"",
		...usage,
		"",
		"## Accuracy (AI pre-verdict vs human verdict)",
		"",
		...agreement,
		"",
		"## Estimating a release",
		"",
		"- Daily tokens per user ≈ sessions × per session start + new files × per new-file guidance + edits × (share of edits with new alarms) × per post-write alarm.",
		"- The new-alarm share is set only once real usage records accumulate (only simulated measurements exist).",
		"- External AI (pre-verdicts, cross-review) is a development cost and is not part of the default user flow.",
		"",
	].join("\n");
	writeFileSync(join(ROOT, "docs", "development", "research", "ai-cost.md"), doc);
	console.log("wrote docs/development/research/ai-cost.md");
}

if (import.meta.main) main();
