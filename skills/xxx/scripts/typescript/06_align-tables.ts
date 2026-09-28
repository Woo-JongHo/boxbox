#!/usr/bin/env bun
/**
 * STEP6: Detects contiguous rows per registered table kind (grid-kinds.ts), checks the axis columns
 * (`:`, `;`, `=`, `(`, `)`, `,`, `}`, `//`), and aligns them at minimum width with --write. Conditional-type `:`,
 * for-header `;`, empty statements, one-line execution blocks, and rows split by JSDoc or blank lines are not
 * row candidates and are never aligned. --explain <line> reports which kind the line was detected as and its axes.
 */
import { isInterfaceDeclaration } from "typescript/unstable/ast";
import type { Node, SourceFile }  from "typescript/unstable/ast";

import { ROW_KINDS, displayColumn, runsOf, syntaxKindName } from "./grid-kinds.ts";
import type { DetectedRow }                                 from "./grid-kinds.ts";
import { loadSourceFile }                                   from "./load-source-file.ts";

interface Edit {
	readonly start : number ;
	readonly end   : number ;
	readonly text  : string ;
}

interface TableGroup {
	readonly kind      : string            ;
	readonly startLine : number            ;
	readonly endLine   : number            ;
	readonly rowCount  : number            ;
	readonly axes      : readonly string[] ;
	readonly skipped   : readonly string[] ;
	readonly edits     : readonly Edit[]   ;
}

function alignRows(source: SourceFile, rows: readonly DetectedRow[]): { axes: readonly string[]; skipped: readonly string[]; edits: readonly Edit[] } {
	// Axis processing order must follow the actual source order within a row. Some rows have `:` before `=`
	// and some have only `=`, so collect the precedence of adjacent boundary pairs into a topological order.
	// If this order breaks, shifts from later-axis edits leak into earlier-axis contracts and never converge.
	const edges = new Map<string, Set<string>>();
	for (const row of rows) {
		const sequence = [...row.boundaries].sort((left, right) => left.from - right.from);
		for (let index = 0; index + 1 < sequence.length; index += 1) {
			const before = sequence[index]!.axis;
			const after = sequence[index + 1]!.axis;
			if (before === after) continue;
			if (!edges.has(before)) edges.set(before, new Set());
			edges.get(before)!.add(after);
		}
	}
	const minFromOfAxis = new Map<string, number>();
	for (const row of rows) for (const boundary of row.boundaries) {
		minFromOfAxis.set(boundary.axis, Math.min(minFromOfAxis.get(boundary.axis) ?? Number.MAX_SAFE_INTEGER, displayColumn(source, boundary.from)));
	}
	const visited = new Set<string>();
	const ordered: string[] = [];
	const visit = (axis: string): void => {
		if (visited.has(axis)) return;
		visited.add(axis);
		for (const next of [...(edges.get(axis) ?? [])].sort()) visit(next);
		ordered.push(axis);
	};
	for (const axis of [...minFromOfAxis.keys()].sort((left, right) => minFromOfAxis.get(left)! - minFromOfAxis.get(right)!)) visit(axis);
	const axisOrder          = ordered.reverse()                      ;
	const shifts             = new Array<number>(rows.length).fill(0) ;
	const edits   : Edit[]   = []                                     ;
	const axes    : string[] = []                                     ;
	const skipped : string[] = []                                     ;
	for (const axis of axisOrder) {
		const entries = rows.map((row, index) => ({ row, index, boundary: row.boundaries.find(candidate => candidate.axis === axis) })).filter(entry => entry.boundary !== undefined);
		if (entries.length < 2) continue;
		// The target column is set by the farthest anchor (from). Gap axes keep at least one space;
		// insert axes align at the existing column — an aligned table is never pushed right again.
		const minGap = entries.some(entry => entry.boundary!.insert) ? 0 : 1                                                          ;
		const target = Math.max(...entries.map(entry => displayColumn(source, entry.boundary!.from) + shifts[entry.index]!)) + minGap ;
		const pads   = entries.map(entry => target - displayColumn(source, entry.boundary!.from) - shifts[entry.index]!)              ;
		if (pads.some(pad => pad < minGap)) {
			skipped.push(axis);
			continue;
		}
		axes.push(`${axis}=${target}`);
		for (const [position, entry] of entries.entries()) {
			const boundary = entry.boundary!;
			const pad = pads[position]!;
			if (pad !== boundary.at - boundary.from) edits.push({ start: boundary.from, end: boundary.at, text: " ".repeat(pad) });
			shifts[entry.index] += pad - (boundary.at - boundary.from);
		}
	}
	return { axes, skipped, edits };
}

function buildGroup(source: SourceFile, kindName: string, groupName: string, run: readonly DetectedRow[]): TableGroup {
	const { axes, skipped, edits } = alignRows(source, run);
	if (process.env.DEBUG_ALIGN) {
		for (const row of run) {
			const line = source.getLineAndCharacterOfPosition(row.node.getStart(source)).line + 1;
			const text = source.text.slice(row.node.getStart(source), row.node.getEnd()).slice(0, 50);
			console.error(`    row line=${line} [${text}] ${row.boundaries.map(b => `${b.axis}(from=${displayColumn(source, b.from)},at=${displayColumn(source, b.at)})`).join(" ")}`);
		}
	}
	const first = run[0]!.node;
	const last = run.at(-1)!.node;
	return {
		kind      : groupName,
		startLine : source.getLineAndCharacterOfPosition(first.getStart(source)).line + 1,
		endLine   : source.getLineAndCharacterOfPosition(last.getEnd() - 1).line + 1,
		rowCount  : run.length,
		axes,
		skipped,
		edits,
	};
}

interface CollectResult {
	readonly groups     : TableGroup[]                                          ;
	readonly candidates : Node[]                                                ;
	readonly compressed : { readonly line: number; readonly members: number }[] ;
}

/** Finds interfaces whose member table is compressed onto one physical line. Expanding is a structural change, so it is not fixed automatically. */
function collectCompressed(source: SourceFile, node: Node, result: CollectResult): void {
	if (isInterfaceDeclaration(node) && node.members.length >= 2) {
		const startLine = source.getLineAndCharacterOfPosition(node.getStart(source)).line;
		const endLine = source.getLineAndCharacterOfPosition(node.getEnd() - 1).line;
		if (startLine === endLine) result.compressed.push({ line: startLine + 1, members: node.members.length });
	}
	node.forEachChild(child => {
		collectCompressed(source, child, result);
		return undefined;
	});
}

function collect(source: SourceFile, node: Node, minRows: number, seen: Set<Node>, explainLine: number | undefined, result: CollectResult): void {
	for (const kind of ROW_KINDS) {
		const siblings = kind.containers(node, seen);
		if (!siblings) continue;
		if (kind.name === "object-rows") for (const sibling of siblings) seen.add(sibling);
		if (explainLine !== undefined) {
			for (const sibling of siblings) {
				if (source.getLineAndCharacterOfPosition(sibling.getStart(source)).line + 1 === explainLine) result.candidates.push(sibling);
			}
		}
		for (const run of runsOf(source, siblings, kind)) {
			if (run.length < minRows) continue;
			result.groups.push(buildGroup(source, kind.name, kind.groupName ? kind.groupName(run) : kind.name, run));
		}
	}
	node.forEachChild(child => {
		collect(source, child, minRows, seen, explainLine, result);
		return undefined;
	});
}

function applyEdits(text: string, edits: readonly Edit[]): string {
	let result = text;
	for (const edit of [...edits].sort((left, right) => right.start - left.start)) result = `${result.slice(0, edit.start)}${edit.text}${result.slice(edit.end)}`;
	return result;
}

interface Arguments {
	readonly file        : string             ;
	readonly write       : boolean            ;
	readonly minRows     : number             ;
	readonly explainLine : number | undefined ;
}

function parseArguments(): Arguments {
	const raw          = process.argv.slice(2)                                        ;
	const write        = raw.includes("--write")                                      ;
	const minRowsIndex = raw.indexOf("--min-rows")                                    ;
	const explainIndex = raw.indexOf("--explain")                                     ;
	const minRows      = minRowsIndex < 0 ? 3 : Number(raw[minRowsIndex + 1])         ;
	const explainLine  = explainIndex < 0 ? undefined : Number(raw[explainIndex + 1]) ;
	if (raw[0] !== "--file" || !raw[1] || (!Number.isInteger(minRows) || minRows < 3) || (explainLine !== undefined && !Number.isInteger(explainLine))) {
		throw new Error("usage: 06_align-tables.ts --file <repository TypeScript file> [--write] [--min-rows 3] [--explain <line>]");
	}
	return { file: raw[1], write, minRows, explainLine };
}

function errorMessage(value: unknown): string {
	return value instanceof Error ? value.message : String(value);
}

async function main(): Promise<void> {
	const root = process.cwd();
	const { file, write, minRows, explainLine } = parseArguments();
	const { source, relative } = await loadSourceFile(root, file);

	const result: CollectResult = { groups: [], candidates: [], compressed: [] };
	collect(source, source, minRows, new Set<Node>(), explainLine === undefined ? undefined : explainLine, result);
	collectCompressed(source, source, result);
	const groups = [...result.groups].sort((left, right) => left.startLine - right.startLine);
	const compressedMembers = result.compressed.reduce((count, entry) => count + entry.members, 0);

	const totalEdits = groups.reduce((count, group) => count + group.edits.length, 0);
	console.log(`align-tables file=${relative} groups=${groups.length} misaligned=${groups.filter(group => group.edits.length > 0).length} edits=${totalEdits} compressed=${result.compressed.length} compressed-members=${compressedMembers}${write ? " write=true" : ""}`);
	for (const entry of result.compressed) console.log(`  compressed  interface-members  line=${entry.line} members=${entry.members} — expanding is a structural change, so it is not fixed automatically`);
	for (const group of groups) {
		const range = group.startLine === group.endLine ? `${group.startLine}` : `${group.startLine}-${group.endLine}`;
		const axes = [...group.axes, ...group.skipped.map(axis => `${axis}=skip`)].join(" ");
		console.log(`  ${range.padStart(9)}  ${group.kind.padEnd(18)} rows=${String(group.rowCount).padStart(2)}  ${axes}  edits=${group.edits.length}`);
	}
	if (explainLine !== undefined) {
		if (result.candidates.length === 0) console.log(`explain line=${explainLine} no row candidate`);
		for (const candidate of result.candidates) {
			console.log(`explain line=${explainLine} node=${syntaxKindName(candidate)}`);
			let matched = false;
			for (const kind of ROW_KINDS) {
				try {
					const boundaries = kind.detect(source, candidate);
					if (!boundaries) continue;
					matched = true;
					console.log(`  ${kind.name}: ${boundaries.map(boundary => `${boundary.axis}@${displayColumn(source, boundary.at)}`).join(" ")}`);
				} catch {
					// A detector failing to read this node is itself diagnostic information, so skip silently.
				}
			}
			if (!matched) console.log("  no registered kind — classify with 01, then register the kind and axes in grid-kinds.ts");
		}
		process.exit(0);
	}
	if (result.compressed.length > 0) process.exit(1);
	if (write && totalEdits > 0) {
		const edits = groups.flatMap(group => group.edits).sort((left, right) => left.start - right.start);
		for (let index = 1; index < edits.length; index += 1) {
			if (edits[index - 1]!.end > edits[index]!.start) throw new Error(`alignment edits overlap: ${relative}`);
		}
		await Bun.write(`${root}/${relative}`, applyEdits(source.text, edits));
	}
	if (!write && totalEdits > 0) process.exit(1);
}

try {
	await main();
	process.exit(0);
} catch (error) {
	console.error(errorMessage(error));
	process.exit(1);
}
