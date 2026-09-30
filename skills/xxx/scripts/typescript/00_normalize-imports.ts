#!/usr/bin/env bun
import      { readFileSync, writeFileSync } from "node:fs"                    ;
import      { relative                    } from "node:path"                  ;

import      { displayWidth                } from "../common/display-width.ts" ;
import      { repositoryFile              } from "./load-source-file.ts"      ;

interface ImportRow {
	readonly text  : string ;
	readonly start : number ;
	readonly end   : number ;
	readonly block : number ;
	/** Blocks separated only by blank lines form one section; code between imports starts a new section. */
	readonly section : number;
}

interface ParsedImport {
	readonly head       : string             ;
	readonly before     : string             ;
	readonly entries    : readonly string[]  ;
	readonly module     : string             ;
	readonly attributes : string | undefined ;
	readonly terminator : string             ;
	readonly suffix     : string             ;
}

function lexicalMask(source: string): string {
	const chars                                                             = source.split("") ;
	let state: "code" | "single" | "double" | "template" | "line" | "block" = "code"           ;
	let escaped                                                             = false            ;
	for (let index = 0; index < chars.length; index += 1) {
		const value = chars[index    ]! ;
		const next  = chars[index + 1]  ;
		if (state === "code") {
			if (value === "/" && next === "/") { state = "line"    ; chars[index] = chars[index + 1] = " "; index += 1; continue; }
			if (value === "/" && next === "*") { state = "block"   ; chars[index] = chars[index + 1] = " "; index += 1; continue; }
			if (value === "`"                ) { state = "template"; chars[index] = " ";                                continue; }
			if (value === "'"                ) { state = "single"  ;                                                    continue; }
			if (value === '"'                ) { state = "double"  ;                                                    continue; }
			continue;
		}
		if (state === "line") {
			if (value === "\n") state = "code";
			else chars[index] = " ";
			continue;
		}
		if (state === "block") {
			if (value === "*" && next === "/") { chars[index] = chars[index + 1] = " "; index += 1; state = "code"; }
			else if (value !== "\n") chars[index] = " ";
			continue;
		}
		if (state === "template") {
			if (value === "`" && !escaped) { chars[index] = " "; state = "code"; }
			else if (value !== "\n") chars[index] = " ";
			escaped = value === "\\" && !escaped;
			if (value !== "\\") escaped = false;
			continue;
		}
		const quote = state === "single" ? "'" : '"';
		if (value === quote && !escaped) state = "code";
		else if (value !== "\n") chars[index] = " ";
		escaped = value === "\\" && !escaped;
		if (value !== "\\") escaped = false;
	}
	const mask = chars.join("");
	if (mask.length !== source.length) throw new Error("lexical mask length changed");
	return mask;
}

function importRows(source: string, file: string): readonly ImportRow[] {
	void file;
	const mask    = lexicalMask(source)                                                                                                                                ;
	const pattern = /^import[ \t]+(?!["'])(?:type[ \t]+)?[^"'=();]+?[ \t]+from[ \t]+["'][^"'\n]*["'](?:[ \t]+(?:with|assert)[ \t]*\{[^{}\n]*\})?[ \t]*;?[ \t]*\r?$/gmu ;
	const ranges  = [...mask.matchAll(pattern)].map(match => {
		const matchedEnd = match.index + match[0].length;
		return { start: match.index, end: mask[matchedEnd - 1] === "\r" ? matchedEnd - 1 : matchedEnd };
	});
	let block   = 0 ;
	let section = 0 ;
	return ranges.map((range, index) => {
		if (index > 0) {
			const previous = ranges[index - 1]!                      ;
			const gap      = source.slice(previous.end, range.start) ;
			const code     = /\S/u.test(gap.replace(/;/u, ""))       ;
			if (/\n[ \t]*\n/u.test(gap) || code) block += 1;
			if (code) section += 1;
		}
		return { text : source.slice(range.start, range.end),
		         start: range.start                         ,
		         end  : range.end                           , block, section };
	});
}

function commentIndex(value: string): number {
	let quote: "'" | '"' | "`" | undefined;
	let escaped = false;
	for (let index = 0; index < value.length; index += 1) {
		const current = value[index]!;
		if (!quote &&  current === "/" && (value[index + 1] === "/" || value[index + 1] === "*")) return index;
		if (!quote && (current === "'" || current === '"' || current === "`")) quote = current;
		else if (quote && current === quote && !escaped) quote = undefined;
		escaped = current === "\\" && !escaped;
		if (current !== "\\") escaped = false;
	}
	return -1;
}

function hasComment(value: string): boolean {
	return commentIndex(value) >= 0;
}

function splitNamedImport(row: string, file: string): readonly string[] {
	if (/^import\s+type\b/u.test(row)) return [row];
	if (hasComment(row) && /\btype\s+[A-Za-z_$]/u.test(row)) throw new Error(`imports with comments are not fixed automatically: ${file}`);
	const match = /^import\s+([^"']*?)\s+from\s+(["'][^"']+["']);?$/su.exec(row);
	if (!match) return [row];
	const clause = match[1] ?? ""          ;
	const open   = clause.indexOf("{")     ;
	const close  = clause.lastIndexOf("}") ;
	if (open < 0 || close < open) return [row];
	const before  = clause.slice(0, open).replace(/,\s*$/u, "").trim()                                  ;
	const entries = clause.slice(open + 1, close).split(",").map(value => value.trim()).filter(Boolean) ;
	if (entries.some(value => /^type\s+as\s+[A-Za-z_$][\w$]*$/u.test(value))) return [row];
	const types = entries.filter(value => /^type\s+/u.test(value));
	if (types.length === 0) return [row];
	if (hasComment(row)) throw new Error(`mixed imports with comments are not fixed automatically: ${file}`);
	const values           = entries.filter(value => !/^type\s+/u.test(value)) ;
	const module           = match[2]                                          ;
	const terminator       = /;\s*$/u.test(row) ? ";" : ""                     ;
	const result: string[] = []                                                ;
	if (before || values.length > 0) {
		const named       = values.length > 0 ? `{ ${values.join(", ")} }` : "" ;
		const valueClause = [before, named].filter(Boolean).join(", ")          ;
		result.push(`import ${valueClause} from ${module}${terminator}`);
	}
	result.push(`import type { ${types.map(value => value.replace(/^type\s+/u, "")).join(", ")} } from ${module}${terminator}`);
	return result;
}

/** Splits a named clause at syntax boundaries. Comments or irregular clauses that do not complete a statement yield undefined. */
function parseImportRow(row: string): ParsedImport | undefined {
	const at     = commentIndex(row)                                                                                                                                                           ;
	const core   = at < 0 ? row : row.slice(0, at).trimEnd()                                                                                                                                   ;
	const suffix = at < 0 ? "" : row.slice(at)                                                                                                                                                 ;
	const match  = /^(import(?:[ \t]+type)?)[ \t]+([^{}'"]*?)\{([^{}]*)\}[ \t\r\n]*from[ \t]+(["'][^"'\n]+["'])([ \t]+(?:with|assert)[ \t\r\n]*\{[^{}]*\})?[ \t\r\n]*(;?)[ \t]*$/su.exec(core) ;
	if (!match) return undefined;
	const before = (match[2] ?? "").replace(/[ \t]+$/u, "").length > 0 ? `${(match[2] ?? "").replace(/[ \t]+$/u, "")} ` : "";
	return {
		head        : `${match[1]} `,
		before,
		entries    : (match[3] ?? "").split(",").map(value => value.trim()).filter(Boolean),
		module     : match[4] ?? "",
		attributes : (match[5] ?? "").replace(/[ \t\r\n]+$/u, "") || undefined,
		terminator : (match[6] ?? "") === ";" ? ";" : "",
		suffix,
	};
}

/** A brace import ready for the table: head cell, names, module, terminator and trailing comment. */
interface TableImport {
	readonly head       : string            ;
	readonly entries    : readonly string[] ;
	readonly module     : string            ;
	readonly terminator : string            ;
	readonly suffix     : string            ;
}

/** Width the head cell always reserves, so `{` sits in one column whether or not a section has a type import. */
const HEAD_WIDTH  = "import type".length ;
/** An import goes vertical when its one-line form exceeds this width. */
const MAX_WIDTH   = 120                  ;
/** An import also goes vertical when its names are this much wider than the second-widest names in the section. */
const OUTLIER_GAP = 20;

const pad = (value: string, width: number): string => value + " ".repeat(Math.max(0, width - displayWidth(value)));

/** Parses a brace import for the table, or returns undefined for forms that stay as written (after safety checks). */
function tableImport(row: string, file: string): TableImport | string {
	const parsed = parseImportRow(row);
	if (!parsed) {
		if (hasComment(row)) throw new Error(`imports with comments are not fixed automatically: ${file}`);
		return row;
	}
	if (parsed.entries.some(value => /[\/\n]/u.test(value))) throw new Error(`imports with comments are not fixed automatically: ${file}`);
	if (parsed.attributes) {
		const oneLine = `${parsed.head}${parsed.before}{ ${parsed.entries.join(", ")} } from ${parsed.module} ${parsed.attributes}${parsed.terminator}`;
		if (oneLine !== row) throw new Error(`imports with attributes are not fixed automatically: ${file}`);
		return row;
	}
	return {
		head       : `${parsed.head}${parsed.before}`.trimEnd(),
		entries    : parsed.entries,
		module     : parsed.module,
		terminator : parsed.terminator,
		suffix     : parsed.suffix,
	};
}

const compactLine = (row: TableImport): string =>
	`${row.head} { ${row.entries.join(", ")} } from ${row.module}${row.terminator}${row.suffix ? ` ${row.suffix}` : ""}`;

/**
 * Renders the brace imports of one section as one table (contract rules 8 and 35). Every row reserves the
 * `import type` head width, so `{` shares one column; `}`, `from`, the module and `;` share columns across all
 * blocks of the section. A row goes vertical when its one-line form exceeds MAX_WIDTH or its names outgrow the
 * second-widest names by OUTLIER_GAP; a vertical row lists one name per line on the names column with aligned
 * commas and closes on the table's `}` column. When the aligned table is still wider than MAX_WIDTH (long names and
 * a long module on different rows), the row with the widest names goes vertical, one row at a time.
 * A section with a single brace import keeps the compact form.
 */
function renderSection(rows: readonly TableImport[], newline: string): readonly string[] {
	if (rows.length === 1) {
		const row = rows[0]!;
		if (row.entries.length > 1 && displayWidth(compactLine(row)) > MAX_WIDTH) return renderTable(rows, new Set([0]), newline);
		return [compactLine(row)];
	}
	const vertical = new Set<number>();
	rows.forEach((row, index) => { if (row.entries.length > 1 && displayWidth(compactLine(row)) > MAX_WIDTH) vertical.add(index); });
	const widths = rows.map((row, index) => vertical.has(index) ? -1 : displayWidth(row.entries.join(", ")))                                          ;
	const order  = widths.map((width, index) => ({ width, index })).filter(entry => entry.width >= 0).sort((left, right) => right.width - left.width) ;
	const [first, second] = order;
	if (first && second && first.width - second.width >= OUTLIER_GAP && rows[first.index]!.entries.length > 1) vertical.add(first.index);
	for (;;) {
		if (Math.max(...renderTable(rows, vertical, newline).flatMap(text => text.split(newline)).map(line => displayWidth(line))) <= MAX_WIDTH) break;
		const widest = rows
			.map((row, index) => ({ index, width: vertical.has(index) || row.entries.length < 2 ? -1 : displayWidth(row.entries.join(", ")) }))
			.sort((left, right) => right.width - left.width)[0];
		if (!widest || widest.width < 0) break;
		vertical.add(widest.index);
	}
	return renderTable(rows, vertical, newline);
}

function renderTable(rows: readonly TableImport[], vertical: ReadonlySet<number>, newline: string): readonly string[] {
	const headWidth   = Math.max(HEAD_WIDTH, ...rows.map(row => displayWidth(row.head)));
	const namesWidth  = Math.max(...rows.map((row, index) => vertical.has(index)
		? Math.max(...row.entries.map(entry => displayWidth(entry))) + 2
		: displayWidth(row.entries.join(", "))));
	const moduleWidth = Math.max(...rows.map(row => displayWidth(row.module))) ;
	const namesColumn = headWidth + 3                                          ;
	return rows.map((row, index) => {
		const tail   = row.terminator ? `${pad(row.module, moduleWidth)} ;` : row.module ;
		const suffix = row.suffix ? ` ${row.suffix}` : ""                                ;
		if (!vertical.has(index)) return `${pad(row.head, headWidth)} { ${pad(row.entries.join(", "), namesWidth)} } from ${tail}${suffix}`;
		const names = row.entries.map(entry => `${" ".repeat(namesColumn)}${pad(entry, namesWidth - 2)} ,`);
		return [`${pad(row.head, headWidth)} {`, ...names, `${" ".repeat(namesColumn + namesWidth + 1)}} from ${tail}${suffix}`].join(newline);
	});
}

function normalizeOnce(source: string, file: string): string {
	const rows = importRows(source, file);
	if (rows.length === 0) return source;
	const newline     = source.includes("\r\n") ? "\r\n" : "\n" ;
	const terminators = new Map<number, Set<boolean>>()         ;
	for (const row of rows) {
		const styles = terminators.get(row.section) ?? new Set<boolean>() ;
		const at     = commentIndex(row.text)                             ;
		styles.add(/;[ \t]*$/u.test(at < 0 ? row.text : row.text.slice(0, at)));
		terminators.set(row.section, styles);
	}
	for (const styles of terminators.values()) {
		if (styles.size > 1) throw new Error(`mixed terminator styles in the same import section: ${file}`);
	}
	for (const row of rows) if (/\s(?:with|assert)\s*\{/u.test(row.text) && /\btype\s+[A-Za-z_$]/u.test(row.text)) throw new Error(`mixed imports with attributes are not fixed automatically: ${file}`);
	const split  = rows.map(row => splitNamedImport(row.text, file).map(text => ({ text, section: row.section }))) ;
	const flat   = split.flat()                                                                                    ;
	const parsed = flat.map(row => tableImport(row.text, file))                                                    ;
	const output = flat.map((row, index) => typeof parsed[index] === "string" ? parsed[index] : row.text)          ;
	for (const section of new Set(flat.map(row => row.section))) {
		const members = flat.flatMap((row, index) => row.section === section && typeof parsed[index] !== "string" ? [index] : []);
		if (members.length === 0) continue;
		const rendered = renderSection(members.map(index => parsed[index] as TableImport), newline);
		members.forEach((index, position) => { output[index] = rendered[position]!; });
	}
	let offset = 0;
	const replacements = rows.map((row, index) => {
		const count = split[index]!.length                               ;
		const text  = output.slice(offset, offset + count).join(newline) ;
		offset += count;
		return { ...row, text };
	});
	let result = source;
	for (const replacement of replacements.toReversed()) result = `${result.slice(0, replacement.start)}${replacement.text}${result.slice(replacement.end)}`;
	return result;
}

function normalize(source: string, file: string): string {
	const first = normalizeOnce(source, file);
	return normalizeOnce(first, file);
}

function targetArguments(root: string): readonly string[] {
	const values = process.argv.slice(2).filter(value => value !== "--write");
	if (values.length === 0) throw new Error("usage: 00_normalize-imports.ts [--write] <TypeScript file>...");
	return values.map(value => repositoryFile(root, value).absolute);
}

const root    = process.cwd()                    ;
const write   = process.argv.includes("--write") ;
const targets = targetArguments(root)            ;
let changed   = 0                                ;
let errors    = 0                                ;
for (const absolute of targets) {
	try {
		const before = readFileSync(absolute, "utf8") ;
		const after  = normalize(before, absolute)    ;
		if (after === before) continue;
		changed += 1;
		console.log(`${write ? "fixed" : "invalid"} ${relative(root, absolute)}`);
		if (write) writeFileSync(absolute, after);
	} catch (error) {
		errors += 1;
		console.error(`error ${relative(root, absolute)}: ${error instanceof Error ? error.message : String(error)}`);
	}
}
console.log(`import-declarations files=${targets.length} changed=${changed} errors=${errors}`);
if (errors > 0 || (!write && changed > 0)) process.exit(1);
