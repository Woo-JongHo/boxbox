#!/usr/bin/env bun
/**
 * Corpus AI pre-verdict (M1.8 S3.5 ③, design §6 L3). Shows the AI representative cases (before/after) of the top types
 * and writes the proposed verdicts and reasons to the suggestion queue (~/.cache/xxx/corpus/review-queue.jsonl).
 * **It is only a suggestion.** The verdict record (corpus/verdicts.jsonl) is written only by a human via `corpus-judge.ts --verdict` (charter invariant 8).
 *
 * Only public sources in corpus/manifest.json are sent to the external AI. Private sources in local.json are never sent.
 *
 * Usage:
 *   bun scripts/corpus-triage.ts [--limit 20] [--dry-run]
 *   --dry-run: writes only the prompt files without calling the AI.
 */
import      { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"                ;
import      { tmpdir                                               } from "node:os"                ;
import      { join                                                 } from "node:path"              ;
import      { spawnSync                                            } from "node:child_process"     ;
import      { patternNameOf                                        } from "./corpus-measures.ts"   ;
import      { QUEUE, typeSlug, VERDICTS, type Suggestion           } from "./corpus-judge.ts"      ;
import      { readCensusReport                                     } from "./corpus-signatures.ts" ;
import      { appendUsage, codexModel, codexTokens                 } from "@/common/usage.ts"      ;

const ROOT  = join(import.meta.dir, "..")                               ;
const OUT   = join(ROOT, "TEST_COMPLETED", "corpus")                    ;
const FLAGS = ["pushed-apart", "covers-reducible", "too-wide"] as const ;

interface CensusType {
	readonly signature : string                           ;
	readonly language  : string                           ;
	readonly count     : number                           ;
	readonly states    : Readonly<Record<string, number>> ;
}

interface Context {
	readonly representatives : readonly { readonly source: string; readonly file: string; readonly startLine: number }[];
}

const INSTRUCTIONS = `You pre-triage tables found by a whitespace-only code aligner. For each type below you see up to two
representatives: the original rows and the rows after alignment (only spaces changed). Judge the type, not the file.

The question is: "are these rows the same role, and does aligning them make them easier to compare?" — never "is it pretty".
Verdicts (use exactly one):
- correct: the rows play the same role and the alignment helps comparison.
- different-role: rows grouped into one table do not play the same role; they should not be one table.
- missing-kind: the rows are one role, but the table should be a different or finer kind (for example it mixes value and type definitions, or declarations with assignments).
- taste: same role, but whether this alignment helps is a matter of taste (for example long padding for little gain).
- unsure: you cannot tell from what is shown.
Flags (zero or more): pushed-apart (padding separates units that belong together), covers-reducible (one long exceptional element
should be simplified instead of padding everyone), too-wide (alignment pushes rows past a comfortable screen width).

Answer with one JSON object per line and nothing else:
{"rank": <number>, "verdict": "<verdict>", "reason": "<one or two sentences in Korean>", "flags": [<flags>]}
`;

/** Prompt fragment for one type. Only representative cases from public sources are included. undefined if there is nothing to send. */
function typeBlock(type: CensusType, rank: number, publicSources: ReadonlySet<string>): string | undefined {
	const dir = join(OUT, type.language, typeSlug(type.signature, rank));
	if (!existsSync(join(dir, "context.txt"))) return undefined;

	const context = JSON.parse(readFileSync(join(dir, "context.txt"), "utf8")) as Context                                      ;
	const parts   = [`### rank ${rank} — ${type.signature} — pattern ${patternNameOf(type.signature)} — ${type.count} tables`] ;

	for (const [index, spot] of context.representatives.slice(0, 2).entries()) {
		const original = join(dir, `rep${index + 1}-original.txt`) ;
		const aligned  = join(dir, `rep${index + 1}-aligned.txt` ) ;
		if (!publicSources.has(spot.source) || !existsSync(original) || !existsSync(aligned)) continue;

		parts.push(`representative ${index + 1} (${spot.source}:${spot.file}:${spot.startLine})`, "original:", "```", readFileSync(original, "utf8").trimEnd(), "```", "aligned:", "```", readFileSync(aligned, "utf8").trimEnd(), "```");
	}

	return parts.length > 1 ? parts.join("\n") : undefined;
}

/** Picks and validates only verdict lines from the AI output. Malformed lines and unknown ranks, verdicts or flags are dropped. */
export function parseSuggestions(output: string, ranks: ReadonlyMap<number, string>, reviewer: string, date: string): readonly Suggestion[] {
	const suggestions: Suggestion[] = [];
	for (const line of output.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed.startsWith("{")) continue;

		let value: { rank?: unknown; verdict?: unknown; reason?: unknown; flags?: unknown };
		try {
			value = JSON.parse(trimmed);
		} catch {
			continue;
		}

		const signature = typeof value.rank === "number" ? ranks.get(value.rank) : undefined                                                                    ;
		const flags     = Array.isArray(value.flags) ? value.flags.filter((flag): flag is string => (FLAGS as readonly string[]).includes(flag as string)) : [] ;
		if (!signature || typeof value.verdict !== "string" || !VERDICTS.includes(value.verdict)) continue;

		suggestions.push({ schemaVersion: 1, signature, rank: value.rank as number, verdict: value.verdict, reason: typeof value.reason === "string" ? value.reason : "", flags, reviewer, date });
	}
	return suggestions;
}

function main(): void {
	const args          = process.argv.slice(2)                                                                                                               ;
	const limitAt       = args.indexOf("--limit")                                                                                                             ;
	const limit         = limitAt >= 0 ? Number(args[limitAt + 1]) : 20                                                                                       ;
	const manifest      = JSON.parse(readFileSync(join(ROOT, "corpus", "manifest.json"), "utf8")) as { readonly sources: readonly { readonly id: string }[] } ;
	const publicSources = new Set(manifest.sources.map(source => source.id))                                                                                  ;
	const types         = readCensusReport<CensusType>().types.slice(0, limit)                                                                                ;

	const ranks             = new Map<number, string>() ;
	const blocks : string[] = []                        ;
	for (const [index, type] of types.entries()) {
		const block = typeBlock(type, index + 1, publicSources);
		if (!block) continue;

		ranks.set(index + 1, type.signature);
		blocks.push(block);
	}

	const work   = mkdtempSync(join(tmpdir(), "xxx-triage-")) ;
	const prompt = join(work, "prompt.md")                    ;
	writeFileSync(prompt, `${INSTRUCTIONS}\n${blocks.join("\n\n")}\n`)      ;
	console.error(`corpus-triage types=${blocks.length} prompt=${prompt}`)  ;
	if (args.includes("--dry-run")) return;

	const version = spawnSync("codex", ["--version"], { encoding: "utf8" }).stdout.trim() || "codex"                                                                                                         ;
	const run     = spawnSync("codex", ["exec", "--skip-git-repo-check", "--sandbox", "read-only", "-C", work, "-"], { input: readFileSync(prompt, "utf8"), encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }) ;
	if (run.status !== 0) throw new Error(`codex failed (${run.status}): ${run.stderr.slice(-2000)}`);

	const suggestions = parseSuggestions(run.stdout, ranks, version, new Date().toISOString().slice(0, 10)).map(suggestion => ({ ...suggestion, ...codexModel(run.stderr) })) ;
	const previous    = existsSync(QUEUE) ? readFileSync(QUEUE, "utf8") : ""                                                                                                  ;
	writeFileSync(QUEUE, `${previous}${suggestions.map(suggestion => JSON.stringify(suggestion)).join("\n")}${suggestions.length > 0 ? "\n" : ""}`);
	const tokens      = codexTokens(run.stderr)                                                                                            ;
	appendUsage(join(QUEUE, "..", "ai-usage.jsonl"), { date: new Date().toISOString(), source: version, event: "corpus-triage", chars: readFileSync(prompt, "utf8").length, tokens: tokens ?? 0, estimated: tokens === undefined, ...codexModel(run.stderr) });
	writeFileSync(join(work, "codex-output.md"), run.stdout);
	console.log(`corpus-triage suggestions=${suggestions.length}/${blocks.length} queue=${QUEUE} raw=${join(work, "codex-output.md")}`);
}

if (import.meta.main) main();
