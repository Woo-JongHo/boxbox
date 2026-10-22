#!/usr/bin/env bun
/**
 * Per-step token usage from one Claude Code session record (a `.jsonl` transcript). Reads usage numbers, model, effort,
 * tool names and sizes only: no message text, command or file content reaches the output. A single API response is
 * written as several lines that repeat the same `usage`, so usage is counted once per message id.
 * Tokens of tool results and hook text are estimated from their length (see `estimateTokens`); usage figures are exact.
 *
 * Usage: bun development/tools/session-usage.ts <transcript.jsonl | -> [--json]   ("-" reads standard input, so a remote record need not be stored)
 */
import { readFileSync } from "node:fs";
import { estimateTokens } from "@/common/usage.ts";

export interface Totals {
	readonly turns      : number ;
	readonly input      : number ;
	readonly cacheRead  : number ;
	readonly cacheWrite : number ;
	readonly output     : number ;
}

export interface CategoryUsage extends Totals {
	/** Tool calls in this category; a turn may make several. */
	readonly calls        : number ;
	/** Estimated tokens of the results those calls returned to the model. */
	readonly resultTokens : number ;
}

export interface HookUsage {
	readonly count  : number ;
	/** Estimated tokens of the text the hook put in front of the model. */
	readonly tokens : number ;
}

export interface SessionUsage {
	readonly session    : string | undefined                      ;
	readonly total      : Totals                                  ;
	readonly byModel    : Readonly<Record<string, Totals>>        ;
	readonly byCategory : Readonly<Record<string, CategoryUsage>> ;
	readonly hooks      : Readonly<Record<string, HookUsage>>     ;
}

type Json = Record<string, unknown>;

const EMPTY: Totals = { turns: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };

const asRecord = (value: unknown): Json | undefined => value && typeof value === "object" && !Array.isArray(value) ? value as Json : undefined ;
const asNumber = (value: unknown): number => typeof value === "number" && Number.isFinite(value) ? value : 0                                   ;
const asText   = (value: unknown): string => typeof value === "string" ? value : ""                                                            ;

/** Commands that run the engine, in the forms the plugin launcher, the CLI entry and the aligner script appear. */
const ENGINE_COMMAND = /\b(?:boxbox(?:\.mjs)?|entry\.ts|cli\.ts)['"]?\s+(check|guide|format|align|doctor|run|status|hook|init)\b/u ;
const ALIGNER_SCRIPT = /06_align-tables\.ts/u                                                                                      ;

/** Names a tool call by the BoxBox step it belongs to; everything else is `other`. */
export function categoryOf(tool: string, input: unknown): string {
	const fields = asRecord(input) ?? {};
	if (tool === "Skill" && /boxbox/iu.test(asText(fields.skill)))                       return "boxbox:skill"    ;
	if (tool === "Agent" && /readability-inspector/u.test(asText(fields.subagent_type))) return "boxbox:inspector" ;
	if (tool !== "Bash")                                                                 return "other"           ;
	const command = asText(fields.command)            ;
	const engine  = ENGINE_COMMAND.exec(command)?.[1] ;
	if (engine)                                                                          return `boxbox:${engine}` ;
	return ALIGNER_SCRIPT.test(command) ? "boxbox:aligner" : "other";
}

/** Characters of the model-facing text in a tool result or hook attachment. Text is measured, never kept. */
function textOf(value: unknown): string {
	if (typeof value === "string") return value;
	if (Array.isArray(value)) return value.map(part => asText(asRecord(part)?.text)).join("");
	return "";
}

const add = (left: Totals, right: Partial<Totals>): Totals => ({
	turns      : left.turns      + (right.turns      ?? 0) ,
	input      : left.input      + (right.input      ?? 0) ,
	cacheRead  : left.cacheRead  + (right.cacheRead  ?? 0) ,
	cacheWrite : left.cacheWrite + (right.cacheWrite ?? 0) ,
	output     : left.output     + (right.output     ?? 0) ,
});

interface Turn {
	model  : string                                               ;
	effort : string | undefined                                   ;
	usage  : Totals                                               ;
	tools  : { readonly id: string; readonly category: string }[] ;
}

export function sessionUsage(lines: Iterable<string>): SessionUsage {
	const turns   = new Map<string, Turn>()      ;
	const owners  = new Map<string, string>()    ;
	const results = new Map<string, number>()    ;
	const hooks   = new Map<string, HookUsage>() ;
	let session: string | undefined              ;
	for (const line of lines) {
		let entry: Json | undefined;
		try { entry = asRecord(JSON.parse(line)); } catch { continue; }
		if (!entry) continue;
		session ??= asText(entry.sessionId) || undefined;
		const message = asRecord(entry.message);
		if (entry.type === "assistant" && message) {
			const model = asText  (message.model) ;
			const usage = asRecord(message.usage) ;
			if (!usage || model === "<synthetic>") continue;
			const id   = asText(message.id) || asText(entry.uuid)                                                                                                                                                                                                                                                       ;
			const turn = turns.get(id) ?? { model, effort: asText(entry.effort) || undefined, tools: [], usage: { turns: 1, input: asNumber(usage.input_tokens), cacheRead: asNumber(usage.cache_read_input_tokens), cacheWrite: asNumber(usage.cache_creation_input_tokens), output: asNumber(usage.output_tokens) } } ;
			for (const block of Array.isArray(message.content) ? message.content : []) {
				const part = asRecord(block);
				if (part?.type !== "tool_use") continue;
				const toolId = asText(part.id);
				if (turn.tools.some(tool => tool.id === toolId)) continue;
				turn.tools.push({ id: toolId, category: categoryOf(asText(part.name), part.input) });
				owners.set(toolId, turn.tools[turn.tools.length - 1]!.category);
			}
			turns.set(id, turn);
		}
		if (entry.type === "user" && message && Array.isArray(message.content)) {
			for (const block of message.content) {
				const part = asRecord(block);
				if (part?.type !== "tool_result") continue;
				const owner = owners.get(asText(part.tool_use_id));
				if (owner) results.set(owner, (results.get(owner) ?? 0) + estimateTokens(textOf(part.content)));
			}
		}
		const attachment = asRecord(entry.attachment);
		if (entry.type === "attachment" && attachment && asText(attachment.type).startsWith("hook_")) {
			const text = textOf(attachment.content) + textOf(attachment.stdout) + textOf(attachment.stderr);
			if (!text.includes("[boxbox]")) continue;
			const key  = asText(attachment.hookEvent) || asText(attachment.type) ;
			const seen = hooks.get(key) ?? { count: 0, tokens: 0 }               ;
			hooks.set(key, { count: seen.count + 1, tokens: seen.tokens + estimateTokens(text) });
		}
	}
	let total                                        = EMPTY ;
	const byModel    : Record<string, Totals>        = {}    ;
	const byCategory : Record<string, CategoryUsage> = {}    ;
	for (const turn of turns.values()) {
		const label    = turn.effort ? `${turn.model}:${turn.effort}` : turn.model               ;
		const category = turn.tools.find(tool => tool.category !== "other")?.category ?? "other" ;
		total          = add(total, turn.usage);
		byModel[label] = add(byModel[label] ?? EMPTY, turn.usage);
		const seen     = byCategory[category] ?? { ...EMPTY, calls: 0, resultTokens: 0 };
		byCategory[category] = { ...add(seen, turn.usage), calls: seen.calls, resultTokens: seen.resultTokens };
	}
	for (const turn of turns.values()) {
		for (const tool of turn.tools) {
			const seen = byCategory[tool.category] ?? { ...EMPTY, calls: 0, resultTokens: 0 };
			byCategory[tool.category] = { ...seen, calls: seen.calls + 1 };
		}
	}
	for (const [category, tokens] of results) {
		const seen = byCategory[category] ?? { ...EMPTY, calls: 0, resultTokens: 0 };
		byCategory[category] = { ...seen, resultTokens: tokens };
	}
	return { session, total, byModel, byCategory, hooks: Object.fromEntries(hooks) };
}

export function formatUsage(usage: SessionUsage): string {
	const number = (value: number): string => value.toLocaleString("en-US")                                                                                                                                                                                                                                                                                                                                                    ;
	const rows   = (record: Readonly<Record<string, Totals>>): string[] => Object.entries(record).sort((left, right) => right[1].output - left[1].output).map(([name, row]) => `  ${name.padEnd(34)} turns=${number(row.turns).padStart(5)} input=${number(row.input).padStart(8)} cacheRead=${number(row.cacheRead).padStart(11)} cacheWrite=${number(row.cacheWrite).padStart(9)} output=${number(row.output).padStart(8)}`) ;
	const lines  = [`session ${usage.session ?? "unknown"}`, "total", ...rows({ all: usage.total }), "by model:effort", ...rows(usage.byModel), "by step (a turn counts under its BoxBox call, else other)", ...rows(usage.byCategory)]                                                                                                                                                                                        ;
	for (const [category, row] of Object.entries(usage.byCategory).filter(([name]) => name !== "other")) lines.push(`  ${category.padEnd(34)} calls=${number(row.calls).padStart(5)} resultTokens(est)=${number(row.resultTokens)}`);
	for (const [event, row] of Object.entries(usage.hooks)) lines.push(`  hook ${event.padEnd(29)} count=${number(row.count).padStart(5)} tokens(est)=${number(row.tokens)}`);
	return lines.join("\n");
}

if (import.meta.main) {
	const path = process.argv.slice(2).find(argument => argument === "-" || !argument.startsWith("--"));
	if (!path) { console.error("Usage: bun development/tools/session-usage.ts <transcript.jsonl | -> [--json]"); process.exit(1); }
	const usage = sessionUsage(readFileSync(path === "-" ? 0 : path, "utf8").split("\n"));
	console.log(process.argv.includes("--json") ? JSON.stringify(usage, null, "\t") : formatUsage(usage));
}
