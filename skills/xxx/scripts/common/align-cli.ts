/**
 * CLI shared by every language's 01_group-regions.ts and 06_align-tables.ts shims.
 * Usage: 06_align-tables.ts --file <target file>... [--write] [--min-rows 3] [--explain <line>] [--json]
 *        01_group-regions.ts --file <target file>... [--min-rows 3]
 * Fails with exit code 1 when anything is misaligned and --write is absent. --json prints the shared versioned
 * result (result-json.ts) instead of the text report.
 */
import      { readFileSync, writeFileSync          } from "node:fs"           ;
import      { relative, resolve                    } from "node:path"         ;
import      { compareParse                         } from "./parse-check.ts"  ;
import      { updateFileAtomicallySync             } from "./safe-file.ts"    ;
import      { alignSource                          } from "./table-engine.ts" ;
import type { AlignResult, LineProfiler            } from "./table-engine.ts" ;
import      { envelope, summarize                  } from "./result-json.ts"  ;
import type { FileResult, ResultGroup, ResultParse } from "./result-json.ts"  ;

/** Re-exported so CodeSyntax can also be imported from this module. */
export type { CodeSyntax } from "./code-text.ts";

export interface AlignCliResult {
	readonly report : string;
	readonly code   : number;
}

function flag(args: readonly string[], name: string): string | undefined {
	const index = args.indexOf(name);
	return index >= 0 ? args[index + 1] : undefined;
}

function numbers(args: readonly string[], name: string): readonly number[] {
	return args.flatMap((argument, index) => argument === name ? [Number(args[index + 1])] : []).filter(value => Number.isFinite(value));
}

export function runAlignCli(aligner: LineProfiler, args: readonly string[], overrides: { readonly groupsOnly?: boolean } = {}): AlignCliResult {
	const files = args.flatMap((argument, index) => argument === "--file" ? [args[index + 1]] : []);
	if (files.length === 0) return { report: "usage: --file <target file>... [--write] [--min-rows 3] [--explain <line>] [--groups]", code: 2 };
	const minRows    = Number(flag(args, "--min-rows") ?? 3)             ;
	const explain    = numbers(args, "--explain")                        ;
	const groupsOnly = overrides.groupsOnly || args.includes("--groups") ;
	const write      = args.includes("--write") && !groupsOnly           ;
	const json       = args.includes("--json")                           ;

	const reports : string[]     = []    ;
	const results : FileResult[] = []    ;
	let failed                   = false ;
	for (const file of files) {
		const absolute = resolve(file)                                           ;
		const label    = relative(process.cwd(), absolute).replaceAll("\\", "/") ;
		let source     = ""                                                      ;
		let result!    : AlignResult                                             ;
		let parsed     : ResultParse = { status: "not-run", tool: "" } ;
		let parseReport              = ""                              ;
		if (write) {
			updateFileAtomicallySync(absolute, ({ initial, working }) => {
				source = initial.toString("utf8");
				result = alignSource(source, aligner, { minRows: Number.isFinite(minRows) ? minRows : 3, apply: true });
				if (result.misaligned === 0) return;
				// Even after the working copy is verified, the helper rechecks the original identity and bytes right before commit.
				const parse = compareParse(aligner.language, source, result.output);
				parsed = { status: parse.status, tool: parse.tool };
				parseReport = `  parse=${parse.status} tool=${parse.tool}${parse.delta.map(line => `\n    ${line}`).join("")}`;
				if (parse.status === "changed") failed = true;
				else writeFileSync(working, result.output);
			});
		} else {
			source = readFileSync(absolute, "utf8");
			result = alignSource(source, aligner, { minRows: Number.isFinite(minRows) ? minRows : 3, apply: false });
		}
		reports.push(formatResult(aligner, label, source, result, groupsOnly));
		if (parseReport !== "") reports.push(parseReport);
		results.push(fileResult(aligner, label, write, result, parsed));
		for (const line of explain) reports.push(formatExplain(aligner, result, line));
		if (result.misaligned > 0 && !write) failed = true;
	}
	return { report: json ? JSON.stringify(envelope(results), null, 2) : reports.join("\n"), code: failed ? 1 : 0 };
}

/** Maps an engine result to the shared result: tables PASS/FIXABLE, pairs SUGGEST, refused tables REFUSE. */
function fileResult(aligner: LineProfiler, file: string, write: boolean, result: AlignResult, parse: ResultParse): FileResult {
	// The line engine has no AST container; the shared indent of a run is its nesting signal (a tab or four spaces per level).
	const depthOf = (indent: string): number => Math.floor(indent.replaceAll("\t", "    ").length / 4)                                  ;
	const groups: ResultGroup[] = [
		...result.details.map(table => ({ kind: "table", startLine: table.startLine, endLine: table.endLine, rows: table.rows, axes: table.axes, state: table.edits.length > 0 ? "FIXABLE" as const : "PASS" as const, edits: table.edits.length, depth: depthOf(table.indent) })),
		...result.pairs.map(pair => ({ kind: "pair", startLine: pair.startLine, endLine: pair.endLine, rows: pair.rows, axes: pair.signature.split("|")[1]?.split(">") ?? [], state: "SUGGEST" as const, edits: 0 })),
		...result.refused.map(table => ({ kind: "table", startLine: table.startLine, endLine: table.endLine, rows: table.rows, axes: table.axes, state: "REFUSE" as const, edits: table.edits.length, depth: depthOf(table.indent) })),
	].sort((left, right) => left.startLine - right.startLine);
	return { file, language: aligner.language, mode: write ? "write" : "check", summary: summarize(groups), groups, parse };
}

function formatResult(aligner: LineProfiler, label: string, source: string, result: AlignResult, groupsOnly: boolean): string {
	const command = groupsOnly ? "group-regions" : "align-tables"                                                                                                                     ;
	const head    = `${command} file=${label} groups=${result.groups} tables=${result.tables} misaligned=${result.misaligned} edits=${result.edits} refused=${result.refused.length}` ;
	const body = groupsOnly
		? result.details.map(table => `  ${padRange(table.startLine, table.endLine)}  rows=${table.rows} axes=${table.axes.join(">")}`).join("\n")
		: result.details.map(table => `  ${padRange(table.startLine, table.endLine)}  rows=${table.rows} widths=${table.widths.join(",")}`).join("\n");
	const pairLines    = result.pairs.map(pair => `  ${padRange(pair.startLine, pair.endLine)}  rows=${pair.rows} pair — ${pair.rows} rows are promoted to a table only when the user confirms the comparison is useful`).join("\n") ;
	const refusedLines = result.refused.map(table => `  ${padRange(table.startLine, table.endLine)}  rows=${table.rows} refused — the edit would change more than whitespace between tokens`).join("\n")                             ;
	const sourceLines  = source.split("\n").length                                                                                                                                                                                   ;
	return [head, body, pairLines, refusedLines, `  lines=${sourceLines} language=${aligner.language}`].filter(part => part !== "").join("\n");
}

function formatExplain(aligner: LineProfiler, result: AlignResult, line: number): string {
	const table = result.details.find(candidate => candidate.startLine <= line && line <= candidate.endLine);
	if (!table) return `explain ${line}: no table — the ${aligner.language} profile did not accept a row candidate or the section was broken`;
	const edit = table.edits.find(candidate => candidate.index === line - 1);
	return [
		`explain ${line}: rows=${table.rows} axes=${table.axes.join(">")} widths=${table.widths.join(",")}`,
		edit ? `  before: ${JSON.stringify(edit.before)}` : `  before: (aligned)`,
		edit ? `  after : ${JSON.stringify(edit.after)}` : "",
	].filter(part => part !== "").join("\n");
}

function padRange(start: number, end: number): string {
	const text = start === end ? `${start}` : `${start}-${end}`;
	return text.padStart(10);
}
