#!/usr/bin/env bun
/**
 * 코퍼스 AI 사전 판정 (M1.8 S3.5 ③, design §6 L3). 상위 유형의 대표 사례(전·후)를 AI에게 보여주고
 * 판정 후보와 근거를 받아 제안 대기열(~/.cache/xxx/corpus/review-queue.jsonl)에 쓴다.
 * **제안일 뿐이다.** 판정 기록(corpus/verdicts.jsonl)은 사람이 `corpus-judge.ts --verdict`로만 쓴다(헌장 불변식 8).
 *
 * 외부 AI로 보내는 코드는 corpus/manifest.json의 공개 소스뿐이다. local.json의 비공개 소스는 보내지 않는다.
 *
 * 사용법:
 *   bun scripts/corpus-triage.ts [--limit 20] [--dry-run]
 *   --dry-run: AI를 부르지 않고 프롬프트 파일만 만든다.
 */
import      { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"                ;
import      { tmpdir                                               } from "node:os"                ;
import      { join                                                 } from "node:path"              ;
import      { spawnSync                                            } from "node:child_process"     ;
import      { patternNameOf                                        } from "./corpus-measures.ts"   ;
import      { QUEUE, typeSlug, VERDICTS, type Suggestion           } from "./corpus-judge.ts"      ;
import      { readCensusReport                                     } from "./corpus-signatures.ts" ;

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
	readonly representatives : readonly { readonly source: string; readonly file: string; readonly startLine: number }[] ;
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

/** 유형 하나의 프롬프트 조각. 공개 소스의 대표 사례만 넣는다. 보낼 사례가 없으면 undefined. */
function typeBlock(type: CensusType, rank: number, publicSources: ReadonlySet<string>): string | undefined {
	const dir = join(OUT, type.language, typeSlug(type.signature, rank));
	if (!existsSync(join(dir, "context.txt"))) return undefined;

	const context = JSON.parse(readFileSync(join(dir, "context.txt"), "utf8")) as Context                                      ;
	const parts   = [`### rank ${rank} — ${type.signature} — pattern ${patternNameOf(type.signature)} — ${type.count} tables`] ;

	for (const [index, spot] of context.representatives.slice(0, 2).entries()) {
		const original = join(dir, `rep${index + 1}-original.txt`) ;
		const aligned  = join(dir, `rep${index + 1}-aligned.txt` ) ;
		if (!publicSources.has(spot.source) || !existsSync(original) || !existsSync(aligned)) continue ;

		parts.push(`representative ${index + 1} (${spot.source}:${spot.file}:${spot.startLine})`, "original:", "```", readFileSync(original, "utf8").trimEnd(), "```", "aligned:", "```", readFileSync(aligned, "utf8").trimEnd(), "```") ;
	}

	return parts.length > 1 ? parts.join("\n") : undefined;
}

/** AI 출력에서 판정 줄만 골라 검증한다. 형식이 틀리거나 모르는 순위·판정·플래그는 버린다. */
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

	const suggestions = parseSuggestions(run.stdout, ranks, version, new Date().toISOString().slice(0, 10)) ;
	const previous    = existsSync(QUEUE) ? readFileSync(QUEUE, "utf8") : ""                                ;
	writeFileSync(QUEUE, `${previous}${suggestions.map(suggestion => JSON.stringify(suggestion)).join("\n")}${suggestions.length > 0 ? "\n" : ""}`) ;
	writeFileSync(join(work, "codex-output.md"), run.stdout)                                                                           ;
	console.log(`corpus-triage suggestions=${suggestions.length}/${blocks.length} queue=${QUEUE} raw=${join(work, "codex-output.md")}`) ;
}

if (import.meta.main) main();
