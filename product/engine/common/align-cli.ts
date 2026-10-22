/**
 * CLI shared by every language's 01_group-regions.ts and 06_align-tables.ts shims.
 * Usage: 06_align-tables.ts --file <target file>... [--write] [--min-rows 3] [--explain <line>] [--json]
 *        01_group-regions.ts --file <target file>... [--min-rows 3]
 * Fails with exit code 1 when anything is misaligned and --write is absent. --json prints the shared versioned
 * result (result-json.ts) instead of the text report.
 */
import      { readFileSync, writeFileSync          } from "node:fs"                  ;
import      { relative, resolve                    } from "node:path"                ;
import      { compareParse                         } from "@/common/parse-check.ts"  ;
import      { updateFileAtomicallySync             } from "@/common/safe-file.ts"    ;
import      { alignSource                          } from "@/common/table-engine.ts" ;
import type { AlignResult, DetectedTable, LineProfiler, PairGroup } from "@/common/table-engine.ts" ;
import      { envelope, summarize                  } from "@/common/result-json.ts"  ;
import      { indentDepth                          } from "@/common/signature.ts"    ;
import type { FileResult, GroupState, ResultGroup, ResultParse } from "@/common/result-json.ts"  ;

/** Re-exported so CodeSyntax can also be imported from this module. */
export type { CodeSyntax } from "@/common/code-text.ts";

export interface AlignCliResult {
	readonly report : string;
	readonly code   : number;
}

function readOptionValue(args: readonly string[], name: string): string | undefined {
	const index = args.indexOf(name);
	return index >= 0 ? args[index + 1] : undefined;
}

function readNumberOption(args: readonly string[], name: string, fallback: number): number {
	const value = Number(readOptionValue(args, name) ?? fallback);
	return Number.isFinite(value) ? value : fallback;
}

function readOptionValues(args: readonly string[], name: string, fallback: readonly string[]): readonly string[] {
	const values = args.flatMap((argument, index) => argument === name ? [args[index + 1]] : []);
	return values.length > 0 ? values : fallback;
}

function readNumberOptions(args: readonly string[], name: string, fallback: readonly number[]): readonly number[] {
	const values = readOptionValues(args, name, []).map(Number).filter(value => Number.isFinite(value));
	return values.length > 0 ? values : fallback;
}

function readBoolOption(args: readonly string[], name: string, fallback: boolean | undefined): boolean {
	return fallback === true || args.includes(name);
}

interface CliOptions {
	readonly files      : readonly string[] ;
	readonly minRows    : number            ;
	readonly explain    : readonly number[] ;
	readonly groupsOnly : boolean           ;
	readonly json       : boolean           ;
	readonly write      : boolean           ;
}

function readCliOptions(args: readonly string[], overrides: { readonly groupsOnly?: boolean }): CliOptions {
	const groupsOnly = readBoolOption(args, "--groups", overrides.groupsOnly) ;
	const writeFlag  = readBoolOption(args, "--write" , false               ) ;

	return {
		files      : readOptionValues (args, "--file"    , []        ) ,
		minRows    : readNumberOption (args, "--min-rows", 3         ) ,
		explain    : readNumberOptions(args, "--explain" , []        ) ,
		groupsOnly : groupsOnly                                        ,
		json       : readBoolOption   (args, "--json"    , false     ) ,
		write      : writeFlag && !groupsOnly                          ,
	};
}

interface FileRun {
	readonly source     : string            ;
	readonly result     : AlignResult       ;
	readonly parsed     : ResultParse       ;
	readonly parseLines : readonly string[] ;
}

interface FileReport {
	readonly result  : FileResult        ;
	readonly reports : readonly string[] ;
	readonly failed  : boolean           ;
}

function alignOnly(aligner: LineProfiler, absolute: string, minRows: number): FileRun {
	const source = readFileSync(absolute, "utf8");
	return {
		source     : source                                                  ,
		result     : alignSource(source, aligner, { minRows, apply: false }) ,
		parsed     : { status: "not-run", tool: "" }                         ,
		parseLines : []                                                      ,
	};
}

function alignAndWrite(aligner: LineProfiler, absolute: string, minRows: number): FileRun {
	let run!: FileRun;
	updateFileAtomicallySync(absolute, ({ initial, working }) => {
		const source = initial.toString("utf8"                                   ) ;
		const result = alignSource     (source, aligner, { minRows, apply: true }) ;
		run = { source, result, parsed: { status: "not-run", tool: "" }, parseLines: [] };
		if (result.misaligned === 0) return;
		// Even after the working copy is verified, the helper rechecks the original identity and bytes right before commit.
		const parse = compareParse(aligner.language, source, result.output);
		run = { source, result, parsed: { status: parse.status, tool: parse.tool }, parseLines: [`  parse=${parse.status} tool=${parse.tool}${parse.delta.map(line => `\n    ${line}`).join("")}`] };
		if (parse.status !== "changed") writeFileSync(working, result.output);
	});
	return run;
}

function runFile(aligner: LineProfiler, file: string, options: CliOptions): FileReport {
	const absolute  = resolve(file)                                           ;
	const label     = relative(process.cwd(), absolute).replaceAll("\\", "/") ;
	const alignFile = options.write ? alignAndWrite : alignOnly               ;

	const { source, result, parsed, parseLines } = alignFile(aligner, absolute, options.minRows);
	return {
		result  : toFileResult(aligner, label, options.write, result, parsed)                                                                                                         ,
		reports : [formatFileReport(aligner, label, source, result, options.groupsOnly), ...parseLines, ...options.explain.map(line => formatLineExplanation(aligner, result, line))] ,
		failed  : parsed.status === "changed" || (result.misaligned > 0 && !options.write)                                                                                            ,
	};
}

export function runAlignCli(aligner: LineProfiler, args: readonly string[], overrides: { readonly groupsOnly?: boolean } = {}): AlignCliResult {
	const options = readCliOptions(args, overrides);
	if (options.files.length === 0) return { report: "usage: --file <target file>... [--write] [--min-rows 3] [--explain <line>] [--groups]", code: 2 };

	const runs    = options.files.map    (file => runFile(aligner, file, options)) ;
	const reports = runs         .flatMap(run => run.reports                     ) ;
	const results = runs         .map    (run => run.result                      ) ;
	const failed  = runs         .some   (run => run.failed                      ) ;

	return { report: options.json ? JSON.stringify(envelope(results), null, 2) : reports.join("\n"), code: failed ? 1 : 0 };
}

function toTableGroup(table: DetectedTable, state: GroupState): ResultGroup {
	return {
		kind      : "table"                   ,
		startLine : table.startLine           ,
		endLine   : table.endLine             ,
		rows      : table.rows                ,
		axes      : table.axes                ,
		state     : state                     ,
		edits     : table.edits.length        ,
		depth     : indentDepth(table.indent) ,
	};
}

function toPairGroup(pair: PairGroup): ResultGroup {
	return {
		kind      : "pair"                                         ,
		startLine : pair.startLine                                 ,
		endLine   : pair.endLine                                   ,
		rows      : pair.rows                                      ,
		axes      : pair.signature.split("|")[1]?.split(">") ?? [] ,
		state     : "SUGGEST"                                      ,
		edits     : 0                                              ,
	};
}

/** Maps an engine result to the shared result: tables PASS/FIXABLE, pairs SUGGEST, refused tables REFUSE. */
function toFileResult(aligner: LineProfiler, file: string, write: boolean, result: AlignResult, parse: ResultParse): FileResult {
	const groups: ResultGroup[] = [
		...result.details.map(table => toTableGroup(table, table.edits.length > 0 ? "FIXABLE" : "PASS")),
		...result.pairs  .map(pair  => toPairGroup (pair)                                               ),
		...result.refused.map(table => toTableGroup(table, "REFUSE")                                    ),
	].sort((left, right) => left.startLine - right.startLine);
	return {
		file     : file                      ,
		language : aligner.language          ,
		mode     : write ? "write" : "check" ,
		summary  : summarize(groups)         ,
		groups   : groups                    ,
		parse    : parse                     ,
	};
}

function formatFileReport(aligner: LineProfiler, label: string, source: string, result: AlignResult, groupsOnly: boolean): string {
	const command = groupsOnly ? "group-regions" : "align-tables";

	const stats = [
		["file"      , label                ],
		["groups"    , result.groups        ],
		["tables"    , result.tables        ],
		["misaligned", result.misaligned    ],
		["edits"     , result.edits         ],
		["refused"   , result.refused.length],
	] as const;
	const head = [command, ...stats.map(([name, value]) => `${name}=${value}`)].join(" ");

	const rowHead = (item: { readonly startLine: number; readonly endLine: number; readonly rows: number }): string => `  ${padRange(item.startLine, item.endLine)}  rows=${item.rows}` ;
	const detail  = groupsOnly ? (table: DetectedTable): string => `axes=${table.axes.join(">")}` : (table: DetectedTable): string => `widths=${table.widths.join(",")}`                ;

	const detailLines  = result.details.map(table => `${rowHead(table)} ${detail(table)}`                                                                                    ) ;
	const pairLines    = result.pairs  .map(pair  => `${rowHead(pair)} pair — ${pair.rows} rows are promoted to a table only when the user confirms the comparison is useful`) ;
	const refusedLines = result.refused.map(table => `${rowHead(table)} refused — the edit would change more than whitespace between tokens`                                 ) ;

	const sourceLines = source.split("\n").length;
	return [head, ...detailLines, ...pairLines, ...refusedLines, `  lines=${sourceLines} language=${aligner.language}`].join("\n");
}

function formatLineExplanation(aligner: LineProfiler, result: AlignResult, line: number): string {
	const table = result.details.find(candidate => candidate.startLine <= line && line <= candidate.endLine);
	if (!table) return `explain ${line}: no table — the ${aligner.language} profile did not accept a row candidate or the section was broken`;
	const edit = table.edits.find(candidate => candidate.index === line - 1);
	return [
		`explain ${line}: rows=${table.rows} axes=${table.axes.join(">")} widths=${table.widths.join(",")}`,
		edit ? `  before: ${JSON.stringify(edit.before)}` : `  before: (aligned)` ,
		edit ? `  after : ${JSON.stringify(edit.after)}`  : ""                     ,
	].filter(part => part !== "").join("\n");
}

function padRange(start: number, end: number): string {
	const text = start === end ? `${start}` : `${start}-${end}`;
	return text.padStart(10);
}
