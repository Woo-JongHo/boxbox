#!/usr/bin/env bun
/**
 * Check report CLI (M1.8 S3.5). Runs the language's aligner on one file and prints safety checks S1–S4 and alarms A1–A9.
 * With --write, it writes the alignment and checks once more to confirm idempotence (S3). The first scope is TypeScript and Python.
 * With --baseline <file>, it checks the pre-edit baseline the same way and splits alarms into new, existing and resolved
 * (docs/development/authoring-flow.md section 3). For a new file use --baseline none. A missing baseline path is treated as a typo and ends with an error.
 * CLI error messages are in English (AGENTS.md language policy).
 *
 * Usage:
 *   bun <SKILL>/engine/report.ts --file <target file> [--baseline <baseline|none>] [--write] [--json]
 * Exit code: 1 if any safety check fails, otherwise 0 (alarms are not failures).
 */
import      { spawnSync                                } from "node:child_process"      ;
import      { existsSync, readFileSync                 } from "node:fs"                 ;
import      { fileURLToPath                            } from "node:url"                ;
import      { buildReport, compareAlarms, renderReport } from "@/common/report.ts"      ;
import      { loadConventions                          } from "@/common/conventions.ts" ;
import type { FileResult, ResultEnvelope               } from "@/common/result-json.ts" ;

const LANGUAGES: readonly (readonly [RegExp, string])[] = [
	[/\.[cm]?ts$/u, "typescript"],
	[/\.py$/u     , "python"    ],
];

function languageOf(file: string): string {
	const found = LANGUAGES.find(([extension]) => extension.test(file));
	if (!found) throw new Error(`outside the first scope (TypeScript, Python): ${file}`);

	return found[1];
}

/** Runs the aligner with --json to get one file result. The aligner exits 1 when edits are pending, so the exit code is ignored. */
function runAligner(language: string, file: string, write: boolean): FileResult {
	const script = fileURLToPath(new URL(`./${language}/06_align-tables.ts`, import.meta.url)) ;
	const args   = [script, "--file", file, "--json", ...(write ? ["--write"] : [])]           ;
	const run    = spawnSync(process.execPath, args, { encoding: "utf8" })                     ;

	let envelope: ResultEnvelope;
	try {
		envelope = JSON.parse(run.stdout) as ResultEnvelope;
	} catch {
		throw new Error(`cannot read the ${language} aligner output: ${run.stderr.trim() || run.stdout.trim()}`);
	}

	const result = envelope.results[0];
	if (!result) throw new Error(`the aligner returned no result: ${file}`);

	return result;
}

/** With --baseline, attaches the comparison paired with the baseline's alarms. `none` means a new file (no baseline alarms). */
function baselineOf(args: readonly string[], language: string, current: ReturnType<typeof buildReport>): ReturnType<typeof buildReport> {
	const at = args.indexOf("--baseline");
	if (at < 0) return current;

	const path = args[at + 1];
	if (!path) throw new Error("--baseline needs a file path or none");
	if (path === "none") return { ...current, comparison: compareAlarms(current.alarms, []) };
	if (!existsSync(path)) throw new Error(`baseline not found: ${path} (use --baseline none for a new file)`);

	const baseline = buildReport({ result: runAligner(language, path, false), text: readFileSync(path, "utf8") });

	return { ...current, comparison: compareAlarms(current.alarms, baseline.alarms) };
}

function main(): void {
	const args   = process.argv.slice(2)                      ;
	const fileAt = args.indexOf("--file")                     ;
	const file   = fileAt >= 0 ? args[fileAt + 1] : undefined ;
	if (!file) throw new Error("usage: report.ts --file <target file> [--baseline <file|none>] [--write] [--json]");

	const write    = args.includes("--write")                                                                               ;
	const language = languageOf(file)                                                                                       ;
	const result   = runAligner(language, file, write)                                                                      ;
	const recheck  = write ? runAligner(language, file, false) : undefined                                                  ;
	const current  = buildReport({ result, text: readFileSync(file, "utf8"), recheck, db: loadConventions(process.cwd()) }) ;
	const report   = baselineOf(args, language, current)                                                                    ;

	console.log(args.includes("--json") ? JSON.stringify(report, null, 2) : renderReport(report));
	process.exit(report.ok ? 0 : 1);
}

if (import.meta.main) main();
