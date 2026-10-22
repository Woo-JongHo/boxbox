#!/usr/bin/env bun
/**
 * Per-step token usage from one Claude Code session record (a `.jsonl` transcript). Reads usage numbers, model, effort,
 * tool names and sizes only: no message text, command or file content reaches the output. A single API response is
 * written as several lines that repeat the same `usage`, so usage is counted once per message id.
 * Tokens of tool results and hook text are estimated from their length (see `estimateTokens`); usage figures are exact.
 *
 * Known limit: input, cache-read and cache-write figures match Claude Code's own accounting exactly (ten runs compared on
 * 2026-10-22), and so do output tokens of a session without subagents. Output tokens in a subagent's record were 4 to 9 times
 * below that accounting, so they are lower bounds and the result says so in `notes`. The authoritative total for a
 * non-interactive run is the `modelUsage` in `claude -p --output-format json`.
 * A subagent writes its own record (`<session>/subagents/agent-*.jsonl`, lines marked `isSidechain`). Given a file path
 * the tool reads those records too and reports their turns as `subagent/<step>`; through standard input, concatenate them.
 *
 * Usage: bun development/tools/session-usage.ts <transcript.jsonl | -> [--json]   ("-" reads standard input, so a remote record need not be stored)
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { estimateTokens } from "@/common/usage.ts";

export interface Totals {
	readonly turns      : number ;
	readonly input      : number ;
	readonly cacheRead  : number ;
	readonly cacheWrite : number ;
	readonly output     : number ;
}

export interface CategoryUsage extends Totals {
	/** Tool calls in this category; a turn may make several, and one call may run several engine commands. */
	readonly calls        : number ;
	/** Estimated tokens of the results those calls returned; a call that runs several engine commands counts its result under the first one. */
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
	/** The part of `total` spent by subagent turns. */
	readonly subagent   : Totals                                  ;
	readonly byModel    : Readonly<Record<string, Totals>>        ;
	readonly byCategory : Readonly<Record<string, CategoryUsage>> ;
	readonly hooks      : Readonly<Record<string, HookUsage>>     ;
	/** Limits of the figures above that apply to this record. */
	readonly notes      : readonly string[]                       ;
}

type Json = Record<string, unknown>;

const EMPTY: Totals = { turns: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0 };

const asRecord = (value: unknown): Json | undefined => value && typeof value === "object" && !Array.isArray(value) ? value as Json : undefined ;
const asNumber = (value: unknown): number => typeof value === "number" && Number.isFinite(value) ? value : 0                                   ;
const asText   = (value: unknown): string => typeof value === "string" ? value : ""                                                            ;

/**
 * Engine commands in the forms they appear: the plugin launcher, the CLI entry, and the Windows bridge
 * `node -e "$B" -- <command>` (or the same script inline) that the generated skill uses. One shell call may run several of them.
 */
const ENGINE_COMMAND = /(?:\b(?:boxbox(?:\.mjs)?|entry\.ts|cli\.ts)['"]?|-e\s+"\$\w+"\s+--|-e\s+(?:"[^"]*spawnSync[^"]*"|'[^']*spawnSync[^']*')\s+--)\s+(check|guide|format|align|doctor|run|status|hook|init)\b/gu ;
const ALIGNER_SCRIPT = /06_align-tables\.ts/u                                                                                                                                                                       ;

/** Names every BoxBox step a tool call belongs to, in command order; a call that is none of them is `other`. */
export function categoriesOf(tool: string, input: unknown): readonly string[] {
	const fields = asRecord(input) ?? {};
	if (tool === "Skill" && /boxbox/iu.test(asText(fields.skill)))                       return ["boxbox:skill"]    ;
	if (tool === "Agent" && /readability-inspector/u.test(asText(fields.subagent_type))) return ["boxbox:inspector"] ;
	if (tool !== "Bash")                                                                 return ["other"]           ;
	const command = asText(fields.command)                                                   ;
	const engine  = [...command.matchAll(ENGINE_COMMAND)].map(match => `boxbox:${match[1]}`) ;
	if (engine.length)                                                                   return engine ;
	return ALIGNER_SCRIPT.test(command) ? ["boxbox:aligner"] : ["other"];
}

/** The first step of a call; kept for callers that need one name. */
export const categoryOf = (tool: string, input: unknown): string => categoriesOf(tool, input)[0]!;

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

interface Call {
	readonly id         : string            ;
	readonly categories : readonly string[] ;
}

interface Turn {
	model     : string             ;
	effort    : string | undefined ;
	sidechain : boolean            ;
	usage     : Totals             ;
	calls     : Call[]             ;
}

const FRESH: CategoryUsage = { ...EMPTY, calls: 0, resultTokens: 0 };

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
		const sidechain = entry.isSidechain === true ;
		const message   = asRecord(entry.message)    ;
		if (entry.type === "assistant" && message) {
			const model = asText  (message.model) ;
			const usage = asRecord(message.usage) ;
			if (!usage || model === "<synthetic>") continue;
			const id   = asText(message.id) || asText(entry.uuid)                                                                                                                                                                                                                                                                  ;
			const turn = turns.get(id) ?? { model, sidechain, effort: asText(entry.effort) || undefined, calls: [], usage: { turns: 1, input: asNumber(usage.input_tokens), cacheRead: asNumber(usage.cache_read_input_tokens), cacheWrite: asNumber(usage.cache_creation_input_tokens), output: asNumber(usage.output_tokens) } } ;
			for (const block of Array.isArray(message.content) ? message.content : []) {
				const part = asRecord(block);
				if (part?.type !== "tool_use") continue;
				const toolId = asText(part.id);
				if (turn.calls.some(call => call.id === toolId)) continue;
				const categories = categoriesOf(asText(part.name), part.input);
				turn.calls.push({ id: toolId, categories });
				owners.set(toolId, `${sidechain ? "subagent/" : ""}${categories[0]}`);
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
	let total        : Totals                        = EMPTY                                                                                       ;
	let subagent     : Totals                        = EMPTY                                                                                       ;
	const byModel    : Record<string, Totals>        = {}                                                                                          ;
	const byCategory : Record<string, CategoryUsage> = {}                                                                                          ;
	const label                                      = (turn: Turn, category: string): string => `${turn.sidechain ? "subagent/" : ""}${category}` ;
	for (const turn of turns.values()) {
		const model = turn.effort ? `${turn.model}:${turn.effort}` : turn.model                                                  ;
		const step  = label(turn, turn.calls.flatMap(call => call.categories).find(category => category !== "other") ?? "other") ;
		total          = add(total, turn.usage)                                ;
		subagent       = turn.sidechain ? add(subagent, turn.usage) : subagent ;
		byModel[model] = add(byModel[model] ?? EMPTY, turn.usage)              ;
		const seen     = byCategory[step] ?? FRESH;
		byCategory[step] = { ...add(seen, turn.usage), calls: seen.calls, resultTokens: seen.resultTokens };
	}
	for (const turn of turns.values()) {
		for (const category of turn.calls.flatMap(call => call.categories)) {
			const step = label(turn, category)     ;
			const seen = byCategory[step] ?? FRESH ;
			byCategory[step] = { ...seen, calls: seen.calls + 1 };
		}
	}
	for (const [category, tokens] of results) {
		const seen = byCategory[category] ?? FRESH;
		byCategory[category] = { ...seen, resultTokens: tokens };
	}
	const notes = subagent.turns ? ["Output tokens of subagent turns are lower bounds: subagent records were observed 4 to 9 times below Claude Code's own accounting. Input, cache-read and cache-write figures are exact."] : [];
	return { session, total, subagent, byModel, byCategory, hooks: Object.fromEntries(hooks), notes };
}

/** A session file plus the records of the subagents it started, which sit in a folder named like the session. */
export function sessionLines(path: string): string[] {
	const folder = join(path.replace(/\.jsonl$/u, ""), "subagents")                                                                             ;
	const extra  = existsSync(folder) ? readdirSync(folder).filter(name => name.endsWith(".jsonl")).sort().map(name => join(folder, name)) : [] ;
	return [path, ...extra].flatMap(file => readFileSync(file, "utf8").split("\n"));
}

export function formatUsage(usage: SessionUsage): string {
	const number = (value: number): string => value.toLocaleString("en-US")                                                                                                                                                                                                                                                                                                                                                    ;
	const rows   = (record: Readonly<Record<string, Totals>>): string[] => Object.entries(record).sort((left, right) => right[1].output - left[1].output).map(([name, row]) => `  ${name.padEnd(34)} turns=${number(row.turns).padStart(5)} input=${number(row.input).padStart(8)} cacheRead=${number(row.cacheRead).padStart(11)} cacheWrite=${number(row.cacheWrite).padStart(9)} output=${number(row.output).padStart(8)}`) ;
	const lines  = [`session ${usage.session ?? "unknown"}`, "total", ...rows({ all: usage.total }), ...(usage.subagent.turns ? ["of which subagents", ...rows({ subagents: usage.subagent })] : []), "by model:effort", ...rows(usage.byModel), "by step (a turn counts under its BoxBox call, else other; subagent turns are prefixed)", ...rows(usage.byCategory)]                                                          ;
	for (const [category, row] of Object.entries(usage.byCategory).filter(([name]) => !name.endsWith("other"))) lines.push(`  ${category.padEnd(34)} calls=${number(row.calls).padStart(5)} resultTokens(est)=${number(row.resultTokens)}`);
	for (const [event, row] of Object.entries(usage.hooks)) lines.push(`  hook ${event.padEnd(29)} count=${number(row.count).padStart(5)} tokens(est)=${number(row.tokens)}`);
	for (const note of usage.notes) lines.push(`note: ${note}`);
	return lines.join("\n");
}

if (import.meta.main) {
	const path = process.argv.slice(2).find(argument => argument === "-" || !argument.startsWith("--"));
	if (!path) { console.error("Usage: bun development/tools/session-usage.ts <transcript.jsonl | -> [--json]"); process.exit(1); }
	const usage = sessionUsage(path === "-" ? readFileSync(0, "utf8").split("\n") : sessionLines(path));
	console.log(process.argv.includes("--json") ? JSON.stringify(usage, null, "\t") : formatUsage(usage));
}
