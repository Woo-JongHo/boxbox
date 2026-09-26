/**
 * 언어별 01_group-regions.ts·06_align-tables.ts 셰임이 공유하는 CLI.
 * 사용법: 06_align-tables.ts --file <대상 파일>... [--write] [--min-rows 3] [--explain <줄번호>]
 *         01_group-regions.ts --file <대상 파일>... [--min-rows 3]
 * misaligned가 있고 --write가 없으면 종료 코드 1로 실패한다.
 */
import { readFileSync, writeFileSync }    from "node:fs";
import { relative, resolve }              from "node:path";
import { alignSource }                    from "./table-engine.ts";
import type { AlignResult, LineProfiler } from "./table-engine.ts";

/** CodeSyntax도 이 모듈에서 가져갈 수 있게 다시 내보낸다. */
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
	if (files.length === 0) return { report: "사용법: --file <대상 파일>... [--write] [--min-rows 3] [--explain <줄번호>] [--groups]", code: 2 };
	const minRows    = Number(flag(args, "--min-rows") ?? 3)             ;
	const write      = args.includes("--write") && !overrides.groupsOnly ;
	const explain    = numbers(args, "--explain")                        ;
	const groupsOnly = overrides.groupsOnly || args.includes("--groups") ;

	const reports: string[] = [];
	let failed = false;
	for (const file of files) {
		const absolute = resolve(file)                                                                                   ;
		const source   = readFileSync(absolute, "utf8")                                                                  ;
		const result   = alignSource(source, aligner, { minRows: Number.isFinite(minRows) ? minRows : 3, apply: write }) ;
		if (write && result.misaligned > 0) writeFileSync(absolute, result.output);
		const label = relative(process.cwd(), absolute).replaceAll("\\", "/");
		reports.push(formatResult(aligner, label, source, result, groupsOnly));
		for (const line of explain) reports.push(formatExplain(aligner, result, line));
		if (result.misaligned > 0 && !write) failed = true;
	}
	return { report: reports.join("\n"), code: failed ? 1 : 0 };
}

function formatResult(aligner: LineProfiler, label: string, source: string, result: AlignResult, groupsOnly: boolean): string {
	const command = groupsOnly ? "group-regions" : "align-tables";
	const head = `${command} file=${label} groups=${result.groups} tables=${result.tables} misaligned=${result.misaligned} edits=${result.edits}`;
	const body = groupsOnly
		? result.details.map(table => `  ${padRange(table.startLine, table.endLine)}  rows=${table.rows} axes=${table.axes.join(">")}`).join("\n")
		: result.details.map(table => `  ${padRange(table.startLine, table.endLine)}  rows=${table.rows} widths=${table.widths.join(",")}`).join("\n");
	const pairLines = result.pairs.map(pair => `  ${padRange(pair.startLine, pair.endLine)}  rows=${pair.rows} pair — ${pair.rows}행은 사용자가 비교 효용을 확인한 경우에만 표로 승격한다`).join("\n");
	const sourceLines = source.split("\n").length;
	return [head, body, pairLines, `  lines=${sourceLines} language=${aligner.language}`].filter(part => part !== "").join("\n");
}

function formatExplain(aligner: LineProfiler, result: AlignResult, line: number): string {
	const table = result.details.find(candidate => candidate.startLine <= line && line <= candidate.endLine);
	if (!table) return `explain ${line}: 표 없음 — ${aligner.language} 프로파일이 행 후보로 인정하지 않았거나 구획이 끊겼다`;
	const edit = table.edits.find(candidate => candidate.index === line - 1);
	return [
		`explain ${line}: rows=${table.rows} axes=${table.axes.join(">")} widths=${table.widths.join(",")}`,
		edit ? `  before: ${JSON.stringify(edit.before)}` : `  before: (정렬 상태)`,
		edit ? `  after : ${JSON.stringify(edit.after)}` : "",
	].filter(part => part !== "").join("\n");
}

function padRange(start: number, end: number): string {
	const text = start === end ? `${start}` : `${start}-${end}`;
	return text.padStart(10);
}
