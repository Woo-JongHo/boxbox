import      {
              isAlias               ,
              isNode                ,
              isScalar              ,
              parseDocument         ,
              visit                 ,
                                      } from "yaml"                      ;

import      { displayWidth            } from "@/common/display-width.ts" ;
import      { summarize               } from "@/common/result-json.ts"   ;
import type { FileResult, ResultGroup } from "@/common/result-json.ts"   ;

export type StructuredLanguage = "json" | "yaml";

export interface StructuredRefusal {
	readonly line   : number;
	readonly reason : string;
}

interface Row {
	readonly line        : number ;
	readonly parent      : string ;
	readonly indent      : string ;
	readonly key         : string ;
	readonly beforeColon : string ;
	readonly afterColon  : string ;
	readonly tail        : string ;
	readonly suffix      : string ;
	readonly eol         : string ;
}

interface Parsed {
	readonly rows     : readonly Row[];
	readonly refusals : readonly StructuredRefusal[];
}

interface Run {
	readonly rows : readonly Row[];
	readonly edits: number;
}

const JSON_ROW = /^(?<indent>[ \t]*)(?<key>"(?:\\[\s\S]|[^"\\])*")(?<before>[ \t]*):(?<after>[ \t]*)(?<tail>"(?:\\[\s\S]|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)(?<suffix>[ \t]*,?[ \t]*)(?<eol>\r?)$/u ;
const YAML_ROW = /^(?<indent>[ ]*)(?<key>[A-Za-z0-9_.-]+)(?<before>[ \t]*):(?<after>[ \t]*)(?<tail>[^\r\n]+?)(?<eol>\r?)$/u                                                                                                            ;

function lineStarts(source: string): readonly number[] {
	const starts = [0];
	for (let index = 0; index < source.length; index += 1) if (source[index] === "\n") starts.push(index + 1);
	return starts;
}

function jsonParents(source: string): readonly string[] {
	const parents : string[]                                   = [] ;
	const stack   : { kind: "object" | "array"; id: number }[] = [] ;
	let id = 0, line = 0, string = false, escaped = false;
	parents[0] = "root";
	for (const character of source) {
		if (character === "\n") { line += 1; parents[line] = stack.map(item => `${item.kind}:${item.id}`).join("/"); continue; }
		if (string) {
			if (escaped) escaped = false;
			else if (character === "\\") escaped = true;
			else if (character === '"') string = false;
			continue;
		}
		if (character === '"') string = true;
		else if (character === "{") stack.push({ kind: "object", id: ++id });
		else if (character === "[") stack.push({ kind: "array", id: ++id });
		else if (character === "}" || character === "]") stack.pop();
	}
	return parents;
}

function parseJson(source: string): Parsed {
	JSON.parse(source);
	const parents = jsonParents(source), rows: Row[] = [], refusals: StructuredRefusal[] = [];
	source.split("\n").forEach((text, index) => {
		const match = JSON_ROW.exec(text);
		if (match?.groups) rows.push({ line: index, parent: parents[index] ?? "root", indent: match.groups.indent, key: match.groups.key, beforeColon: match.groups.before, afterColon: match.groups.after, tail: match.groups.tail, suffix: match.groups.suffix, eol: match.groups.eol });
		else if (/^\s*"/u.test(text) && text.includes(":")) refusals.push({ line: index + 1, reason: "only single-line scalar JSON properties are alignable" });
	});
	return { rows, refusals };
}

function yamlUnsupported(text: string): string | null {
	const trimmed = text.trimStart();
	if (/^(?:---|\.\.\.|%)/u.test(trimmed)) return "YAML directives and document markers are not alignable";
	if (/^(?:\?|\{|\[|-\s)/u.test(trimmed)) return "complex keys, flow collections, and sequence entries are not alignable";
	return null;
}

function splitYamlTail(tail: string): { value: string; suffix: string } | null {
	let single = false, double = false, escaped = false;
	for (let index = 0; index < tail.length; index += 1) {
		const character = tail[index]!;
		if (double && escaped) { escaped = false; continue; }
		if (double && character === "\\") { escaped = true; continue; }
		if (!double && character === "'") single = !single;
		else if (!single && character === '"') double = !double;
		else if (!single && !double && character === "#" && (index === 0 || /\s/u.test(tail[index - 1]!))) {
			const value = tail.slice(0, index).trimEnd();
			return value === "" ? null : { value, suffix: tail.slice(value.length) };
		}
	}
	const value = tail.trimEnd();
	return value === "" ? null : { value, suffix: tail.slice(value.length) };
}

function parseYaml(source: string): Parsed {
	if (/^%YAML[ \t]+(?!1\.2(?:[ \t]|$))/mu.test(source)) throw new Error("only the YAML 1.2 directive is supported");
	const document = parseDocument(source, { schema: "core", version: "1.2", strict: true });
	if (document.errors.length > 0) throw new Error(document.errors.map(error => error.message).join("; "));
	visit(document, {
		Alias(_, node) {
			if (!isAlias(node) || node.resolve(document)) return;
			throw new Error(`Unresolved alias (the anchor must be set before the alias): ${node.source}`);
		},
	});
	const starts = lineStarts(source);
	interface PairRange {
		readonly parent     : string        ;
		readonly keyStart   : number        ;
		readonly keyEnd     : number        ;
		readonly valueStart : number        ;
		readonly valueEnd   : number        ;
		readonly reason     : string | null ;
	}
	const pairByLine     = new Map<number, PairRange>() ;
	const ambiguousLines = new Set<number>()            ;
	let mapId            = 0                            ;
	visit(document, {
		Map(_, node) {
			if (node.flow) return visit.SKIP;
			const id = `map:${++mapId}`;
			for (const pair of node.items) {
				if (!isNode(pair.key) || !pair.key.range) continue;
				let line = 0;
				while (line + 1 < starts.length && starts[line + 1]! <= pair.key.range[0]) line += 1;
				const value      = pair.value                              ;
				const valueRange = isNode(value) ? value.range : undefined ;
				const reason = !isScalar(pair.key) || pair.key.type !== "PLAIN"
					? "only simple plain-scalar YAML keys are alignable"
					: pair.key.anchor || pair.key.tag || (isScalar(value) && (value.anchor || value.tag))
						? "YAML anchors, aliases, and tags are not alignable"
						: isScalar(value) && (value.type === "BLOCK_LITERAL" || value.type === "BLOCK_FOLDED")
							? "YAML block scalars are not alignable"
							: !isScalar(value) ? "only scalar YAML mapping values are alignable" : null;
				if (pairByLine.has(line)) { ambiguousLines.add(line); continue; }
				pairByLine.set(line, {
					parent: id, keyStart: pair.key.range[0], keyEnd: pair.key.range[1],
					valueStart: valueRange?.[0] ?? -1, valueEnd: valueRange?.[1] ?? -1,
					reason,
				});
			}
		},
	});
	const rows: Row[] = [], refusals: StructuredRefusal[] = [];
	source.split("\n").forEach((text, index) => {
		const unsupported = yamlUnsupported(text);
		if (unsupported) { refusals.push({ line: index + 1, reason: unsupported }); return; }
		const pair = pairByLine.get(index);
		if (!pair) return;
		if (ambiguousLines.has(index)) { refusals.push({ line: index + 1, reason: "multiple YAML pairs on one physical line are not alignable" }); return; }
		const match = YAML_ROW.exec(text);
		if (!match?.groups) { refusals.push({ line: index + 1, reason: "only simple plain-scalar YAML keys are alignable" }); return; }
		const lineEnd = (starts[index + 1] ?? source.length) - (starts[index + 1] === undefined ? 0 : 1);
		if (pair.reason) { refusals.push({ line: index + 1, reason: pair.reason }); return; }
		if (pair.keyStart < starts[index]! || pair.keyEnd > lineEnd || pair.valueStart < starts[index]! || pair.valueEnd > lineEnd) {
			refusals.push({ line: index + 1, reason: "only single-line scalar YAML pairs are alignable" }); return;
		}
		const split = splitYamlTail(match.groups.tail);
		if (!split || /^(?:\{|\[)/u.test(split.value)) {
			refusals.push({ line: index + 1, reason: "only simple scalar YAML mapping values are alignable" }); return;
		}
		const relativeValueStart = pair.valueStart - starts[index]!                ;
		const relativeValueEnd   = pair.valueEnd - starts[index]!                  ;
		const colon              = text.indexOf(":", pair.keyEnd - starts[index]!) ;
		const keyStart           = pair.keyStart - starts[index]!                  ;
		if (keyStart !== match.groups.indent.length || text.slice(keyStart, pair.keyEnd - starts[index]!) !== match.groups.key || colon < 0 || text.slice(colon + 1, relativeValueStart).trim() !== "") {
			refusals.push({ line: index + 1, reason: "YAML value properties are not alignable" }); return;
		}
		const row = { line: index, parent: pair.parent, indent: match.groups.indent, key: match.groups.key, beforeColon: text.slice(pair.keyEnd - starts[index]!, colon), afterColon: text.slice(colon + 1, relativeValueStart), tail: text.slice(relativeValueStart, relativeValueEnd), suffix: text.slice(relativeValueEnd, text.length - match.groups.eol.length), eol: match.groups.eol };
		if (!/^[ \t]*$/u.test(row.beforeColon) || !/^[ \t]*$/u.test(row.afterColon) || `${row.indent}${row.key}${row.beforeColon}:${row.afterColon}${row.tail}${row.suffix}${row.eol}` !== text) {
			refusals.push({ line: index + 1, reason: "YAML row decomposition is not lossless horizontal whitespace" }); return;
		}
		rows.push(row);
	});
	return { rows, refusals };
}

const parse = (source: string, language: StructuredLanguage): Parsed => language === "json" ? parseJson(source) : parseYaml(source);

function runsOf(rows: readonly Row[]): readonly Row[][] {
	const runs  : Row[][] = [] ;
	let current : Row[]   = [] ;
	for (const row of rows) {
		const previous = current.at(-1);
		if (previous && row.line === previous.line + 1 && row.parent === previous.parent && row.indent === previous.indent) current.push(row);
		else { if (current.length >= 3) runs.push(current); current = [row]; }
	}
	if (current.length >= 3) runs.push(current);
	return runs;
}

function alignedLine(row: Row, width: number): string {
	return `${row.indent}${row.key}${" ".repeat(width - displayWidth(row.key))}: ${row.tail}${row.suffix}${row.eol}`;
}

export function structuredDiagnostics(source: string, language: StructuredLanguage): readonly string[] {
	try { parse(source, language); return []; }
	catch (error) { return [error instanceof Error ? error.message : String(error)]; }
}

export function analyzeStructured(source: string, language: StructuredLanguage, file = "input"): { result: FileResult; output: string; refusals: readonly StructuredRefusal[] } {
	let parsed: Parsed;
	try { parsed = parse(source, language); }
	catch (error) {
		const refusals              = [{ line: 1, reason: error instanceof Error ? error.message : String(error) }]                                                                                                      ;
		const groups: ResultGroup[] = [{ kind: "mapping", startLine: 1, endLine: 1, rows: 0, axes: ["key-colon", "value"], state: "REFUSE", edits: 0, context: language === "json" ? "object" : "block-map", depth: 0 }] ;
		return { output: source, refusals, result: { file, language, mode: "check", groups, summary: summarize(groups), parse: { status: "skipped", tool: language === "json" ? "JSON.parse" : "yaml@2.9.1" } } };
	}
	const lines = source.split("\n"), runs: Run[] = runsOf(parsed.rows).map(rows => {
		const width = Math.max(...rows.map(row => displayWidth(row.key))) ;
		let edits   = 0                                                   ;
		for (const row of rows) { const after = alignedLine(row, width); if (after !== lines[row.line]) { lines[row.line] = after; edits += 1; } }
		return { rows, edits };
	});
	const output = lines.join("\n");
	if (!preservesStructured(source, output, language)) throw new Error("structured alignment escaped verified horizontal gap ranges");
	const groups: ResultGroup[] = runs.map(run => ({ kind: "mapping", startLine: run.rows[0]!.line + 1, endLine: run.rows.at(-1)!.line + 1, rows: run.rows.length, axes: ["key-colon", "value"], state: run.edits > 0 ? "FIXABLE" : "PASS", edits: run.edits, context: language === "json" ? "object" : "block-map", depth: Math.floor(run.rows[0]!.indent.length / 2) }));
	return { output, refusals: parsed.refusals, result: { file, language, mode: "check", groups, summary: summarize(groups), unsupported: parsed.refusals, parse: { status: "not-run", tool: language === "json" ? "JSON.parse" : "yaml@2.9.1" } } };
}

function rowSkeleton(row: Row): string { return `${row.indent}${row.key}\u0000:\u0000${row.tail}${row.suffix}${row.eol}`; }

export function preservesStructured(before: string, after: string, language: StructuredLanguage): boolean {
	try {
		parse(after, language);
		const beforeLines = before.split("\n"), afterLines = after.split("\n");
		if (beforeLines.length !== afterLines.length) return false;
		const beforeRows = new Map(parse(before, language).rows.map(row => [row.line, row])) ;
		const afterRows  = new Map(parse(after, language).rows.map(row => [row.line, row]) ) ;
		return beforeLines.every((line, index) => {
			if (line === afterLines[index])                                                                                                                                                                          return true;
			const output = afterLines[index]!;
			const beforeRow = beforeRows.get(index), afterRow = afterRows.get(index);
			if (!beforeRow || !afterRow || !/^[ \t]*$/u.test(beforeRow.beforeColon) || !/^[ \t]*$/u.test(beforeRow.afterColon) || !/^[ \t]*$/u.test(afterRow.beforeColon) || !/^[ \t]*$/u.test(afterRow.afterColon)) return false;
			if (line.match(/^[ \t]*/u)![0] !== output.match(/^[ \t]*/u)![0] || line.match(/[ \t]*\r?$/u)![0] !== output.match(/[ \t]*\r?$/u)![0])                                                                    return false;
			if (line.replace(/[ \t]/gu, "") !== output.replace(/[ \t]/gu, ""))                                                                                                                                       return false;
			return rowSkeleton(beforeRow) === rowSkeleton(afterRow);
		});
	} catch { return false; }
}
