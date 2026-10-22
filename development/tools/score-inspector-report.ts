#!/usr/bin/env bun
/**
 * Scores an inspector's written report against the engine's own `check` result for the same file. The engine is the
 * ground truth: which line ranges are misaligned (FIXABLE). The report is free text, so the score counts how many of those
 * ranges the report points at by line number. It does not judge whether the advice is good; that needs a human reading
 * the saved report. Defined before the 2026-10-22 inspector model pilot ran (see its PROTOCOL.md).
 *
 * Usage: bun development/tools/score-inspector-report.ts <check.json> <report.txt> [--json]
 */
import { readFileSync } from "node:fs";

export interface TruthGroup {
	readonly startLine : number ;
	readonly endLine   : number ;
	readonly state     : string ;
}

export interface ReportScore {
	/** Groups the engine marked FIXABLE. */
	readonly fixable          : number                    ;
	/** FIXABLE groups whose lines the report cites with an explicit "line(s) N" / "L N" reference. */
	readonly citedStrict      : number                    ;
	/** FIXABLE groups hit by any in-file line range or "line N" reference, including bare "a-b" ranges. */
	readonly citedLenient  : number ;
	readonly recallStrict  : number ;
	readonly recallLenient : number ;
	/** PASS groups the strict references point into: possible false alarms, to be read by a human. */
	readonly passGroupsCited  : number                    ;
	/** Numbers written directly before "misaligned" or "fixable" ("8 misaligned groups"). */
	readonly claimedMisaligned: readonly number[]         ;
	/** Strict line references outside the file's line count. */
	readonly outOfFileCitations: number                   ;
}

type Range = readonly [number, number];

const STRICT_RANGE  = /\b(?:lines?|ln\.?|L)\s*(\d{1,5})(?:\s*(?:[-–—]|to|through)\s*(\d{1,5}))?/giu ;
const BARE_RANGE    = /(?<![\d.])(\d{1,5})\s*[-–—]\s*(\d{1,5})(?![\d.])/gu                          ;
const CLAIMED_COUNT = /(\d{1,3})\s+(?:\w+\s+)?(?:misaligned|fixable)/giu                            ;

function rangesIn(report: string, pattern: RegExp, fileLines: number): { readonly inFile: Range[]; readonly outside: number } {
	const inFile: Range[] = [] ;
	let outside           = 0  ;
	for (const match of report.matchAll(pattern)) {
		const first  = Number(match[1])                                  ;
		const second = match[2] === undefined ? first : Number(match[2]) ;
		const low    = Math.min(first, second)                           ;
		const high   = Math.max(first, second)                           ;
		if (high > fileLines || low < 1) outside += 1;
		else inFile.push([low, high]);
	}
	return { inFile, outside };
}

const overlaps = (group: TruthGroup, ranges: readonly Range[]): boolean => ranges.some(([low, high]) => low <= group.endLine && high >= group.startLine);

export function scoreReport(report: string, groups: readonly TruthGroup[], fileLines: number): ReportScore {
	const strict  = rangesIn(report, STRICT_RANGE, fileLines)                                                     ;
	const bare    = rangesIn(report, BARE_RANGE, fileLines).inFile.filter(([low, high]) => high - low <= 80)      ;
	const fixable = groups.filter(group => group.state === "FIXABLE")                                             ;
	const passes  = groups.filter(group => group.state === "PASS")                                                ;
	const lenient = [...strict.inFile, ...bare]                                                                   ;
	const hits    = (ranges: readonly Range[]): number => fixable.filter(group => overlaps(group, ranges)).length ;
	return {
		fixable            : fixable.length                                                     ,
		citedStrict        : hits(strict.inFile)                                                ,
		citedLenient       : hits(lenient)                                                      ,
		recallStrict       : fixable.length ? hits(strict.inFile) / fixable.length : 0          ,
		recallLenient      : fixable.length ? hits(lenient) / fixable.length : 0                ,
		passGroupsCited    : passes.filter(group => overlaps(group, strict.inFile)).length      ,
		claimedMisaligned  : [...report.matchAll(CLAIMED_COUNT)].map(match => Number(match[1])) ,
		outOfFileCitations : strict.outside                                                     ,
	};
}

if (import.meta.main) {
	const [checkPath, reportPath] = process.argv.slice(2).filter(argument => !argument.startsWith("--"));
	if (!checkPath || !reportPath) { console.error("Usage: bun development/tools/score-inspector-report.ts <check.json> <report.txt> [--json]"); process.exit(1); }
	const check  = JSON.parse(readFileSync(checkPath, "utf8")) as { results: { groups: TruthGroup[] }[] } ;
	const report = readFileSync(reportPath, "utf8")                                                       ;
	const score  = scoreReport(report, check.results[0]!.groups, Number(process.env.FILE_LINES ?? 0))     ;
	console.log(JSON.stringify(score, null, "\t"));
}
