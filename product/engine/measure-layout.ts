#!/usr/bin/env bun

import { readFileSync } from "node:fs";

interface TokenSpec {
	token      : string;
	occurrence : number;
}

interface LeftAnchorSpec extends TokenSpec {
	closingToken : string;
}

function argument(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index < 0 ? undefined : process.argv[index + 1];
}

function parseTokenSpec(value: string): TokenSpec {
	const match = /^(.*?)(?:#([1-9][0-9]*))?$/u.exec(value);
	if (!match?.[1]) throw new Error(`invalid token spec: ${value}`);
	return { token: match[1], occurrence: Number(match[2] ?? "1") };
}

function parseLeftAnchorSpec(value: string): LeftAnchorSpec {
	const spec = parseTokenSpec(value);
	const closingToken = new Map([
		["(", ")"],
		["{", "}"],
		["<", ">"],
	]).get(spec.token);
	if (!closingToken) throw new Error(`left-anchor supports only (, {, <: ${value}`);
	return { ...spec, closingToken };
}

function parseLines(value: string | undefined, lineCount: number): ReadonlySet<number> {
	if (!value) return new Set(Array.from({ length: lineCount }, (_, index) => index + 1));
	const lines = new Set<number>();
	for (const part of value.split(",")) {
		const range = /^(\d+)(?:-(\d+))?$/u.exec(part.trim());
		if (!range) throw new Error(`invalid lines spec: ${part}`);
		const start = Number(range[1]            ) ;
		const end   = Number(range[2] ?? range[1]) ;
		if (start < 1 || end < start || end > lineCount) throw new Error(`lines spec out of range: ${part}`);
		for (let line = start; line <= end; line += 1) lines.add(line);
	}
	return lines;
}

function displayWidth(value: string): number {
	let width = 0;
	for (const character of value) {
		if (character === "\t") {
			width += 4 - width % 4;
		} else if (/[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(character)) {
			width += 2;
		} else {
			width += 1;
		}
	}
	return width;
}

function tokenIndex(line: string, spec: TokenSpec): number | undefined {
	let index = -1;
	for (let count = 0; count < spec.occurrence; count += 1) {
		index = line.indexOf(spec.token, index + 1);
		if (index < 0) return undefined;
	}
	return index;
}

function tokenColumn(line: string, spec: TokenSpec): number | undefined {
	const index = tokenIndex(line, spec);
	return index === undefined ? undefined : displayWidth(line.slice(0, index)) + 1;
}

function leftAnchorError(line: string, spec: LeftAnchorSpec): string | undefined {
	const openingIndex = tokenIndex(line, spec);
	if (openingIndex === undefined)                           return undefined;
	const contentStart = openingIndex + spec.token.length                                      ;
	const closingIndex = line.indexOf(spec.closingToken, contentStart)                         ;
	const content      = line.slice(contentStart, closingIndex < 0 ? undefined : closingIndex) ;
	if (!content.trim())                                      return undefined;
	if (!content.startsWith(" "))                             return "missing a single space after the opening boundary";
	if (content.startsWith("  ") || content.startsWith("\t")) return "more than one space before the content";
	return undefined;
}

function cellContent(line: string, spec: LeftAnchorSpec): string | undefined {
	const openingIndex = tokenIndex(line, spec);
	if (openingIndex === undefined) return undefined;
	const contentStart = openingIndex + spec.token.length              ;
	const closingIndex = line.indexOf(spec.closingToken, contentStart) ;
	if (closingIndex < 0) return undefined;
	return line.slice(contentStart, closingIndex);
}

const filePath = process.argv[2];
if (!filePath || filePath.startsWith("--")) {
	throw new Error("usage: measure-layout.ts <file> [--lines 1,3-8] [--tokens 'from|//#1'] [--expect 'from=41|//=146'] [--left-anchor '{#1|(#1|<#1'] [--center-cell '(#1|<#1'] [--compact-before '}#2']");
}

const source      : string              = readFileSync(filePath, "utf8"                       ) ;
const sourceLines : readonly string[]   = source.split("\n"                                   ) ;
const lineFilter  : ReadonlySet<number> = parseLines  (argument("--lines"), sourceLines.length) ;
const tokenSpecs : readonly TokenSpec[] = (argument("--tokens") ?? ":#1|=>|= await|//")
	.split("|")
	.filter(Boolean)
	.map(parseTokenSpec);
const leftAnchorSpecs: readonly LeftAnchorSpec[] = (argument("--left-anchor") ?? "")
	.split("|")
	.filter(Boolean)
	.map(parseLeftAnchorSpec);
const centerCellSpecs: readonly LeftAnchorSpec[] = (argument("--center-cell") ?? "")
	.split("|")
	.filter(Boolean)
	.map(parseLeftAnchorSpec);
const compactBeforeSpecs: readonly TokenSpec[] = (argument("--compact-before") ?? "")
	.split("|")
	.filter(Boolean)
	.map(parseTokenSpec);
const expected = new Map(
	(argument("--expect") ?? "")
		.split("|")
		.filter(Boolean)
		.map(entry => {
			const separator = entry.lastIndexOf("=");
			if (separator < 1) throw new Error(`invalid expect spec: ${entry}`);
			return [entry.slice(0, separator), Number(entry.slice(separator + 1))] as const;
		}),
);

let failed                = false             ;
const observedLeftAnchors = new Set<string>() ;
const centerWidths = new Map(centerCellSpecs.map(spec => {
	const contents = [...lineFilter]
		.map(lineNumber => cellContent(sourceLines[lineNumber - 1] ?? "", spec))
		.filter((content): content is string => content !== undefined && content.trim().length > 0);
	const maxContentWidth = Math.max(0, ...contents.map(content => displayWidth(content.trim())));
	return [`${spec.token}#${spec.occurrence}`, maxContentWidth] as const;
}));
for (const lineNumber of [...lineFilter].sort((left, right) => left - right)) {
	const line = sourceLines[lineNumber - 1] ?? "";
	const measurements = tokenSpecs.flatMap(spec => {
		const column = tokenColumn(line, spec);
		if (column === undefined) return [];
		const label  = `${spec.token}${spec.occurrence === 1 ? "" : `#${spec.occurrence}`}` ;
		const wanted = expected.get(label)                                                  ;
		if (wanted !== undefined && wanted !== column) failed = true;
		return [`${label}=${column}${wanted !== undefined && wanted !== column ? `(!=${wanted})` : ""}`];
	});
	const anchorMeasurements = leftAnchorSpecs.flatMap(spec => {
		if (tokenIndex(line, spec) === undefined) return [];
		const label = `${spec.token}${spec.occurrence === 1 ? "" : `#${spec.occurrence}`}`;
		observedLeftAnchors.add(label);
		const error = leftAnchorError(line, spec);
		if (error) failed = true;
		return [`left(${label})=${error ? `fail:${error}` : "ok"}`];
	});
	const centerMeasurements = centerCellSpecs.flatMap(spec => {
		const content = cellContent(line, spec);
		if (content === undefined || content.trim().length === 0) return [];
		const expectedWidth = centerWidths.get(`${spec.token}#${spec.occurrence}`) ?? 0 ;
		const value         = content.trim()                                            ;
		const valueStart    = content.indexOf(value)                                    ;
		const leftWidth     = displayWidth(content.slice(0, valueStart))                ;
		const rightWidth    = displayWidth(content.slice(valueStart + value.length))    ;
		const cellWidth     = displayWidth(content)                                     ;
		const centered      = Math.abs(leftWidth - rightWidth) <= 1                     ;
		const minimal       = cellWidth === expectedWidth                               ;
		if (!centered || !minimal) failed = true;
		const label = `${spec.token}${spec.occurrence === 1 ? "" : `#${spec.occurrence}`}`;
		return [`center(${label})=${centered && minimal ? "ok" : `fail:width=${cellWidth}/${expectedWidth},padding=${leftWidth}/${rightWidth}`}`];
	});
	const compactMeasurements = compactBeforeSpecs.flatMap(spec => {
		const index = tokenIndex(line, spec);
		if (index === undefined) return [];
		const compact = line.slice(0, index).endsWith("; ");
		if (!compact) failed = true;
		const label = `${spec.token}${spec.occurrence === 1 ? "" : `#${spec.occurrence}`}`;
		return [`compact-before(${label})=${compact ? "ok" : "fail:not exactly one space after the terminating semicolon"}`];
	});
	const results = [...measurements, ...anchorMeasurements, ...centerMeasurements, ...compactMeasurements];
	if (results.length > 0) console.log(`${String(lineNumber).padStart(4)}  ${results.join("  ")}  ${line.trim()}`);
}

for (const spec of leftAnchorSpecs) {
	const label = `${spec.token}${spec.occurrence === 1 ? "" : `#${spec.occurrence}`}`;
	if (observedLeftAnchors.has(label)) continue;
	console.error(`left-anchor target not found: ${label}`);
	failed = true;
}

if (failed) process.exitCode = 1;
