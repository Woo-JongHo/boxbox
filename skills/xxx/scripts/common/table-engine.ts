/**
 * Language-agnostic table engine. Once a profiler decomposes a row into a sequence of axes (a signature),
 * this engine groups contiguous rows into a spreadsheet-like table and aligns each column axis at the
 * minimum width required by the actual longest cell.
 *
 * Safety rules:
 * 1. Reassemble the profile slots with their original gaps; if the result differs from the code part, refuse the row (no lossy decomposition).
 * 2. Blank lines, comment lines, block comment interiors and profile-refused rows break a region — different sections never share widths.
 * 3. Runs shorter than minRows (2 rows by default) are reported but not aligned.
 * 4. The candidate output is compared with the source by changedLines (preservation.ts). A table whose edits change
 *    anything but horizontal whitespace between tokens is refused as a whole and reported in `refused`.
 */
import      { changedLines } from "./preservation.ts"  ;
import      { displayWidth } from "./display-width.ts" ;
import      { maskSource   } from "./code-text.ts"     ;
import type { CodeSyntax   } from "./code-text.ts"     ;

/** Re-exported so profilers can import CodeSyntax directly from table-engine. */
export type { CodeSyntax };

export interface Slot {
	/** Cell role, defined per language by the profiler (name, type, value, colon, equal, semicolon, comma, ...). */
	readonly axis      : string;
	/** Cell content sliced verbatim from the source (no surrounding spaces). */
	readonly text      : string;
	/** The actual gap before this cell in the source. Used only for lossless verification; reassembly uses the canonical gap. */
	readonly gapBefore : string;
}

export interface RowProfile {
	readonly indent : string;
	readonly slots  : readonly Slot[];
}

export interface LineProfiler {
	readonly language      : string;
	readonly syntax        : CodeSyntax;
	/** Cells on these axes are right-padded to the column width (compared columns). */
	readonly columnAxes    : readonly string[];
	/** Canonical gap per axis used for reassembly. Axes not listed use " ". */
	readonly canonicalGaps : Readonly<Record<string, string>>;
	/** Returns the decomposition if the line is a table row, otherwise null. code is the source with the trailing comment cut; masked is the mask at the same coordinates. */
	profile(code: string, masked: string): RowProfile | null;
}

export interface TableEdit {
	readonly index  : number ;
	readonly before : string ;
	readonly after  : string ;
}

export interface DetectedTable {
	readonly startLine : number               ;
	readonly endLine   : number               ;
	readonly rows      : number               ;
	readonly axes      : readonly string[]    ;
	readonly widths    : readonly number[]    ;
	readonly edits     : readonly TableEdit[] ;
}

export interface PairGroup {
	readonly startLine : number ;
	readonly endLine   : number ;
	readonly rows      : number ;
	readonly signature : string ;
}

export interface AlignResult {
	readonly output     : string;
	/** Number of contiguous same-signature runs of 2+ rows. */
	readonly groups     : number;
	/** Number of tables actually aligned (minRows or more). */
	readonly tables     : number;
	/** Number of rows that alignment would change. */
	readonly misaligned : number;
	/** Number of rows actually changed when apply=true. */
	readonly edits   : number                   ;
	readonly details : readonly DetectedTable[] ;
	readonly pairs   : readonly PairGroup[]     ;
	/** Tables whose edits failed the whitespace-only check; never applied. */
	readonly refused : readonly DetectedTable[] ;
}

export interface AlignOptions {
	readonly minRows : number;
	/** When false, only report and leave output identical to the source. */
	readonly apply   : boolean;
}

const canonicalGap = (aligner: LineProfiler, axis: string): string => aligner.canonicalGaps[axis] ?? " ";

function signatureOf(profile: RowProfile): string {
	return `${profile.indent}|${profile.slots.map(slot => slot.axis).join(">")}`;
}

function rebuildCode(aligner: LineProfiler, profile: RowProfile, widths: readonly number[] | null): string {
	const parts: string[] = [profile.indent];
	const lastIndex = profile.slots.length - 1;
	profile.slots.forEach((slot, position) => {
		if (position > 0) parts.push(canonicalGap(aligner, slot.axis));
		// The last cell of a row has nothing after it to align, so it is not padded — never create trailing whitespace.
		if (widths !== null && aligner.columnAxes.includes(slot.axis) && position !== lastIndex) {
			const pad = widths[position] - displayWidth(slot.text);
			parts.push(pad > 0 ? slot.text + " ".repeat(pad) : slot.text);
		} else {
			parts.push(slot.text);
		}
	});
	return parts.join("");
}

export function alignSource(source: string, aligner: LineProfiler, options: AlignOptions): AlignResult {
	const minRows     = Math.max(2, options.minRows)       ;
	const mask        = maskSource(source, aligner.syntax) ;
	const lines       = source.split("\n")                 ;
	const maskedLines = mask.text.split("\n")              ;

	interface Accepted {
		readonly index   : number        ;
		readonly profile : RowProfile    ;
		readonly comment : string | null ;
	}
	const accepted: Accepted[] = [];

	lines.forEach((line, index) => {
		if (mask.opensInBlock[index]) return;
		const commentStart = mask.commentStarts[index]                                 ;
		const codeEnd      = commentStart >= 0 ? commentStart : line.length            ;
		const comment      = codeEnd < line.length ? line.slice(codeEnd).trim() : null ;
		// Leftover spaces before a comment are replaced by the computed gap on reassembly, so strip them from the code part.
		const code       = comment !== null ? line.slice(0, codeEnd).replace(/\s+$/u, "") : line.slice(0, codeEnd);
		const maskedCode = comment !== null ? maskedLines[index].slice(0, codeEnd).replace(/\s+$/u, "") : maskedLines[index].slice(0, codeEnd);
		if (maskedCode.trim() === "") return;
		const profile = aligner.profile(code, maskedCode);
		if (!profile) return;
		// Gaps may contain only whitespace. If a masked comment or string were absorbed into a gap it would be lost on reassembly, so refuse the row.
		const lossless = /^[ \t]*$/u.test(profile.indent)
			&& profile.slots.every(slot => /^[ \t]*$/u.test(slot.gapBefore))
			&& profile.indent + profile.slots.map((slot, position) => position === 0 ? slot.text : slot.gapBefore + slot.text).join("") === code;
		if (!lossless) return;
		accepted.push({ index, profile, comment });
	});

	const runs: Accepted[][] = [];
	let current: Accepted[] = [];
	const flush = (): void => {
		if (current.length >= 2) runs.push(current);
		current = [];
	};
	for (let position = 0; position < accepted.length; position += 1) {
		const row        = accepted[position]                                                     ;
		const previous   = current[current.length - 1]                                            ;
		const contiguous = !previous || previous.index === row.index - 1                          ;
		const sameShape  = previous && signatureOf(previous.profile) === signatureOf(row.profile) ;
		if (contiguous && sameShape) current.push(row);
		else { flush(); current = [row]; }
	}
	flush();

	const candidates : DetectedTable[] = [] ;
	const pairs      : PairGroup[]     = [] ;

	for (const run of runs) {
		const signature = signatureOf(run[0].profile);
		if (run.length < minRows) {
			pairs.push({ startLine: run[0].index + 1, endLine: run[run.length - 1].index + 1, rows: run.length, signature });
			continue;
		}
		const widths = run[0].profile.slots.map((_, position) =>
			Math.max(...run.map(row => displayWidth(row.profile.slots[position].text))),
		);
		const alignedCodes = run.map(row => rebuildCode(aligner, row.profile, widths));
		const commentRows = run.map(row => row.comment !== null);
		const commentColumn = Math.max(
			0,
			...run.map((row, position) => commentRows[position] ? displayWidth(alignedCodes[position]) : 0),
		) + (commentRows.some(Boolean) ? 1 : 0);
		const tableEdits: TableEdit[] = [];
		run.forEach((row, position) => {
			const code = alignedCodes[position];
			const after = row.comment !== null
				? code + " ".repeat(commentColumn - displayWidth(code)) + row.comment
				: code;
			if (after === lines[row.index]) return;
			tableEdits.push({ index: row.index, before: lines[row.index], after });
		});
		candidates.push({
			startLine : run[0].index + 1,
			endLine   : run[run.length - 1].index + 1,
			rows      : run.length,
			axes      : run[0].profile.slots.map(slot => slot.axis),
			widths,
			edits     : tableEdits,
		});
	}

	const { details, refused } = refuseUnsafeTables(source, lines, candidates, aligner);
	const editsByLine = new Map(details.flatMap(table => table.edits.map(edit => [edit.index, edit] as const)));
	const output = options.apply
		? lines.map((line, index) => editsByLine.get(index)?.after ?? line).join("\n")
		: source;
	const misaligned = new Set(details.flatMap(table => table.edits.map(edit => edit.index))).size;
	return {
		output,
		groups: runs.length,
		tables: details.length,
		misaligned,
		edits: options.apply ? misaligned : 0,
		details,
		pairs,
		refused,
	};
}

/**
 * Applies every table's edits, then refuses the tables that own a line failing the whitespace-only check and
 * repeats until the output passes. A failure that no remaining edited line explains (an edit that broke string or
 * comment state for later lines) refuses every table that still has edits.
 */
function refuseUnsafeTables(source: string, lines: readonly string[], tables: readonly DetectedTable[], aligner: LineProfiler): { readonly details: readonly DetectedTable[]; readonly refused: readonly DetectedTable[] } {
	let kept                       = [...tables] ;
	const refused: DetectedTable[] = []          ;
	for (;;) {
		const afterByLine = new Map(kept.flatMap(table => table.edits.map(edit => [edit.index, edit.after] as const)));
		if (afterByLine.size === 0) break;
		const candidate = lines.map((line, index) => afterByLine.get(index) ?? line).join("\n");
		const changed   = new Set(changedLines(source, candidate, aligner.syntax));
		if (changed.size === 0) break;
		const culprits = kept.filter(table => table.edits.some(edit => changed.has(edit.index)));
		const drop     = new Set(culprits.length > 0 ? culprits : kept.filter(table => table.edits.length > 0));
		refused.push(...drop);
		kept = kept.filter(table => !drop.has(table));
	}
	return { details: kept, refused };
}
