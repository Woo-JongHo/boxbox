/**
 * Language-agnostic table engine. Once a profiler decomposes a row into a sequence of axes (a signature),
 * this engine groups contiguous rows into a spreadsheet-like table and aligns each column axis at the
 * minimum width required by the actual longest cell.
 *
 * Safety rules:
 * 1. Reassemble the profile slots with their original gaps; if the result differs from the code part, refuse the row (no lossy decomposition).
 * 2. Blank lines, comment lines, block comment interiors and rows refused by both primary and optional outer profiles break a region.
 *    Detailed tables retain exclusive row ownership; projection never joins separate sections or retries refused tables.
 * 3. Runs shorter than minRows are reported as pairs but not aligned. Automatic fixes never apply to fewer than
 *    3 rows: a lower minRows is raised to 3 (a 2-row table needs a recorded human decision, not a flag).
 * 4. The candidate output is compared with the source by changedLines (preservation.ts). A table whose edits change
 *    anything but horizontal whitespace between tokens is refused as a whole and reported in `refused`.
 */
import      { changedLines                    } from "@/common/preservation.ts"  ;
import      { displayWidth, hasWideCharacters } from "@/common/display-width.ts" ;
import      { maskSource                      } from "@/common/code-text.ts"     ;
import type { CodeSyntax                      } from "@/common/code-text.ts"     ;

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
	/**
	 * Rows whose axes are a prefix of the run's longest axes join that run (`name : type` beside `name : type = value`).
	 * Off by default; each language opts in only where a shorter row is the same role with fewer trailing cells.
	 */
	readonly prefixRuns?   : boolean;
	/**
	 * Axes that close a row (a parameter list's `,`). In a prefix run whose rows all end with the same terminal axis,
	 * prefixes are compared without it and it forms its own column after the longest row, like a trailing comment.
	 */
	readonly terminalAxes? : readonly string[];
	/** Marker lines that sit inside a table without cells of their own (a parameter list's `*,`); they do not break a run. */
	transparentRow?(masked: string): boolean;
	/** Optional outer rows by zero-based physical line. Detailed tables keep priority; every projection must reconstruct its original code exactly. */
	project?(source: string): ReadonlyMap<number, RowProfile>;
}

export interface TableEdit {
	readonly index  : number ;
	readonly before : string ;
	readonly after  : string ;
}

export interface DetectedTable {
	readonly startLine : number ;
	readonly endLine   : number ;
	readonly rows      : number ;
	/** The shared indentation of the run — the line engine's nesting signal (design §6 L2). */
	readonly indent : string               ;
	readonly axes   : readonly string[]    ;
	readonly widths : readonly number[]    ;
	readonly edits  : readonly TableEdit[] ;
	/** Why a refused table was refused: its edits changed more than whitespace, or a column would follow wide characters. */
	readonly refusal? : "whitespace-only" | "wide-characters";
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
	/** Tables whose edits failed the whitespace-only check or whose columns would follow wide characters; never applied. */
	readonly refused : readonly DetectedTable[];
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
	const parts: string[] = [profile.indent]         ;
	const lastIndex       = profile.slots.length - 1 ;
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

interface AcceptedRow {
	readonly index   : number        ;
	readonly profile : RowProfile    ;
	readonly comment : string | null ;
}

/** Both primary and projected rows must reconstruct the same original code with whitespace-only gaps. */
function losslessProfile(profile: RowProfile, code: string): boolean {
	return /^[ \t]*$/u.test(profile.indent)
		&& profile.slots.every(slot => /^[ \t]*$/u.test(slot.gapBefore))
		&& profile.indent + profile.slots.map((slot, position) => position === 0 ? slot.text : slot.gapBefore + slot.text).join("") === code;
}

/** The row without its terminal cell when that cell's axis is listed as terminal. */
function withoutTerminal(profile: RowProfile, terminalAxes: readonly string[]): RowProfile {
	const last = profile.slots.at(-1);
	return last && terminalAxes.includes(last.axis) ? { indent: profile.indent, slots: profile.slots.slice(0, -1) } : profile;
}

/** True when one row's axes are a prefix of the other's at the same indentation; a terminal cell must match on both. */
function prefixRelated(left: RowProfile, right: RowProfile, terminalAxes: readonly string[]): boolean {
	if (left.indent !== right.indent) return false;
	const leftEnd  = left.slots.at(-1)?.axis ?? ""                                     ;
	const rightEnd = right.slots.at(-1)?.axis ?? ""                                    ;
	const terminal = terminalAxes.includes(leftEnd) || terminalAxes.includes(rightEnd) ;
	if (terminal && leftEnd !== rightEnd) return false;
	const bodies         = [withoutTerminal(left, terminalAxes), withoutTerminal(right, terminalAxes)] ;
	const [short, long]  = bodies[0].slots.length <= bodies[1].slots.length ? bodies : [bodies[1], bodies[0]] ;
	return short.slots.every((slot, position) => slot.axis === long.slots[position].axis);
}

/** True when only transparent marker lines sit between two rows. */
function adjacent(previous: number, next: number, transparent: ReadonlySet<number>): boolean {
	for (let index = previous + 1; index < next; index += 1) if (!transparent.has(index)) return false;
	return true;
}

/** The row with the most slots; a prefix run is judged and reported by it. */
function longestProfile(run: readonly AcceptedRow[]): RowProfile {
	return run.reduce((longest, row) => row.profile.slots.length > longest.slots.length ? row.profile : longest, run[0].profile);
}

function contiguousRuns(rows: readonly AcceptedRow[], prefixRuns: boolean, terminalAxes: readonly string[], transparent: ReadonlySet<number>): AcceptedRow[][] {
	const runs  : AcceptedRow[][] = [] ;
	let current : AcceptedRow[]   = [] ;
	const flush = (): void => {
		if (current.length >= 2) runs.push(current);
		current = [];
	};

	for (const row of rows) {
		const previous   = current.at(-1)                                                ;
		const contiguous = !previous || adjacent(previous.index, row.index, transparent) ;
		const sameShape  = previous && (prefixRuns
			? prefixRelated(longestProfile(current), row.profile, terminalAxes)
			: signatureOf(previous.profile) === signatureOf(row.profile));
		if (contiguous && sameShape) current.push(row);
		else { flush(); current = [row]; }
	}
	flush();

	return runs;
}

/**
 * Rebuilds a run's code. Rows of one length align cell by cell. A prefix run whose rows all end with the same terminal
 * cell aligns without it and places it in its own column after the longest row (the canonical gap attaches it there).
 */
function alignRun(aligner: LineProfiler, run: readonly AcceptedRow[], terminalAxes: readonly string[]): string[] {
	const lengths  = new Set(run.map(row => row.profile.slots.length))                                                ;
	const terminal = run[0].profile.slots.at(-1)?.axis ?? ""                                                          ;
	const shared   = terminalAxes.includes(terminal) && run.every(row => row.profile.slots.at(-1)?.axis === terminal) ;
	if (lengths.size === 1 || !shared) {
		const widths = columnWidths(run);
		return run.map(row => rebuildCode(aligner, row.profile, widths));
	}
	const bodies = run   .map  (row => ({ ...row, profile: withoutTerminal(row.profile, terminalAxes) })) ;
	const widths = columnWidths(bodies                                                                  ) ;
	const codes  = bodies.map  (row => rebuildCode(aligner, row.profile, widths)                        ) ;
	const column = Math  .max  (...codes.map(code => displayWidth(code))                                ) ;
	return codes.map((code, position) => {
		const cell = run[position].profile.slots.at(-1)!;
		return code + " ".repeat(column - displayWidth(code)) + canonicalGap(aligner, cell.axis) + cell.text;
	});
}

/** A row's cells before its last one, and every cell when a trailing comment follows, decide later columns. */
function columnsFollowWideText(row: AcceptedRow): boolean {
	const last = row.profile.slots.length - 1;
	return row.profile.slots.some((slot, position) => (position < last || row.comment !== null) && hasWideCharacters(slot.text));
}

/** A column is as wide as its longest cell among rows that continue past it; a row's last cell is never padded. */
function columnWidths(run: readonly AcceptedRow[]): number[] {
	return longestProfile(run).slots.map((_, position) => {
		const continuing = run.filter(row => position < row.profile.slots.length - 1) ;
		const present    = run.filter(row => position < row.profile.slots.length)     ;
		const measured   = continuing.length > 0 ? continuing : present               ;
		return Math.max(...measured.map(row => displayWidth(row.profile.slots[position].text)));
	});
}

/** Select one owner per row. A primary table remains reserved even if the preservation gate later refuses it. */
function projectedRuns(primary: AcceptedRow[][], projected: readonly AcceptedRow[], minRows: number, prefixRuns: boolean, terminalAxes: readonly string[], transparent: ReadonlySet<number>): AcceptedRow[][] {
	const primaryTables  = primary.filter(run => run.length >= minRows)                                                             ;
	const reserved       = new Set(primaryTables.flatMap(run => run.map(row => row.index)))                                         ;
	const fallback       = contiguousRuns(projected.filter(row => !reserved.has(row.index)), prefixRuns, terminalAxes, transparent) ;
	const fallbackTables = fallback.filter(run => run.length >= minRows)                                                            ;
	const claimed        = new Set(fallbackTables.flatMap(run => run.map(row => row.index)))                                        ;
	const primaryPairs   = primary.filter(run => run.length < minRows && run.every(row => !claimed.has(row.index)))                 ;
	const pairRows       = new Set(primaryPairs.flatMap(run => run.map(row => row.index)))                                          ;
	const fallbackPairs  = fallback.filter(run => run.length < minRows && run.every(row => !pairRows.has(row.index)))               ;

	return [...primaryTables, ...fallbackTables, ...primaryPairs, ...fallbackPairs].sort((left, right) => left[0].index - right[0].index);
}

export function alignSource(source: string, aligner: LineProfiler, options: AlignOptions): AlignResult {
	const minRows     = Math     .max  (3, options.minRows    ) ;
	const mask        = maskSource     (source, aligner.syntax) ;
	const lines       = source   .split("\n"                  ) ;
	const maskedLines = mask.text.split("\n"                  ) ;

	const projections               = aligner.project?.(source) ;
	const accepted  : AcceptedRow[] = []                        ;
	const transparent               = new Set<number>()         ;
	const projected : AcceptedRow[] = []                        ;

	lines.forEach((raw, index) => {
		// CRLF files carry \r at every line end; profiling strips it and the rebuilt line gets it back, so a
		// row is never refused for trailing \r and the file's line endings stay exactly as they were.
		const hadCR      = raw.endsWith("\r")                                                         ;
		const line       = hadCR ? raw.slice(0, -1) : raw                                             ;
		const maskedLine = hadCR ? (maskedLines[index] ?? "").slice(0, -1) : maskedLines[index] ?? "" ;
		if (mask.opensInBlock[index]) return;
		const commentStart = mask.commentStarts[index]                                 ;
		const codeEnd      = commentStart >= 0 ? commentStart : line.length            ;
		const comment      = codeEnd < line.length ? line.slice(codeEnd).trim() : null ;
		// Leftover spaces before a comment are replaced by the computed gap on reassembly, so strip them from the code part.
		const code       = comment !== null ? line.slice(0, codeEnd).replace(/\s+$/u, "") : line.slice(0, codeEnd)             ;
		const maskedCode = comment !== null ? maskedLine.slice(0, codeEnd).replace(/\s+$/u, "") : maskedLine.slice(0, codeEnd) ;
		if (maskedCode.trim() === "") return;
		const profile = aligner.profile(code, maskedCode);
		if (profile && losslessProfile(profile, code)) accepted.push({ index, profile, comment });
		else if (comment === null && aligner.transparentRow?.(maskedCode)) transparent.add(index);

		const projection = projections?.get(index);
		if (projection && losslessProfile(projection, code)) projected.push({ index, profile: projection, comment });
	});

	const terminalAxes = aligner.terminalAxes ?? []                                                                                              ;
	const prefixRuns   = aligner.prefixRuns === true                                                                                             ;
	const primary      = contiguousRuns(accepted, prefixRuns, terminalAxes, transparent)                                                         ;
	const runs         = projections === undefined ? primary : projectedRuns(primary, projected, minRows, prefixRuns, terminalAxes, transparent) ;

	const candidates  : DetectedTable[] = [] ;
	const wideRefused : DetectedTable[] = [] ;
	const pairs       : PairGroup[]     = [] ;

	for (const run of runs) {
		const signature = signatureOf(longestProfile(run));
		if (run.length < minRows) {
			pairs.push({ startLine: run[0].index + 1, endLine: run[run.length - 1].index + 1, rows: run.length, signature });
			continue;
		}
		if (run.some(row => columnsFollowWideText(row))) {
			wideRefused.push({
				startLine : run[0].index + 1                                 ,
				endLine   : run[run.length - 1].index + 1                    ,
				rows      : run.length                                       ,
				indent    : run[0].profile.indent                            ,
				axes      : longestProfile(run).slots.map(slot => slot.axis) ,
				widths    : columnWidths(run)                                ,
				edits     : []                                               ,
				refusal   : "wide-characters"                                ,
			});
			continue;
		}
		const widths       = columnWidths(run                        ) ;
		const alignedCodes = alignRun    (aligner, run, terminalAxes ) ;
		const commentRows  = run.map     (row => row.comment !== null) ;
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
			// the raw line keeps its \r so CRLF files stay CRLF
			const raw    = lines[row.index]                          ;
			const withCR = raw.endsWith("\r") ? `${after}\r` : after ;
			if (withCR === raw) return;
			tableEdits.push({ index: row.index, before: raw, after: withCR });
		});
		candidates.push({
			startLine : run[0].index + 1                                 ,
			endLine   : run[run.length - 1].index + 1                    ,
			rows      : run.length                                       ,
			indent    : run[0].profile.indent                            ,
			axes      : longestProfile(run).slots.map(slot => slot.axis) ,
			widths    : widths                                           ,
			edits     : tableEdits                                       ,
		});
	}

	const { details, refused } = refuseUnsafeTables(source, lines, candidates, aligner);
	const editsByLine = new Map(details.flatMap(table => table.edits.map(edit => [edit.index, edit] as const)));
	const output = options.apply
		? lines.map((line, index) => editsByLine.get(index)?.after ?? line).join("\n")
		: source;
	const misaligned = new Set(details.flatMap(table => table.edits.map(edit => edit.index))).size;
	return {
		output     : output                                                                               ,
		groups     : runs.length                                                                          ,
		tables     : details.length                                                                       ,
		misaligned : misaligned                                                                           ,
		edits      : options.apply ? misaligned : 0                                                       ,
		details    : details                                                                              ,
		pairs      : pairs                                                                                ,
		refused    : [...refused, ...wideRefused].sort((left, right) => left.startLine - right.startLine) ,
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
		const candidate = lines.map((line, index) => afterByLine.get(index) ?? line).join("\n") ;
		const changed   = new Set(changedLines(source, candidate, aligner.syntax))              ;
		if (changed.size === 0) break;
		const culprits = kept.filter(table => table.edits.some(edit => changed.has(edit.index)))                ;
		const drop     = new Set(culprits.length > 0 ? culprits : kept.filter(table => table.edits.length > 0)) ;
		refused.push(...[...drop].map(table => ({ ...table, refusal: "whitespace-only" as const })));
		kept = kept.filter(table => !drop.has(table));
	}
	return { details: kept, refused };
}
