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
import      { changedLines                    } from "@/common/09_preservation.ts"  ;
import      { displayWidth, hasWideCharacters } from "@/common/01_display-width.ts" ;
import      { maskSource                      } from "@/common/00_code-text.ts"     ;
import type { CodeSyntax                      } from "@/common/00_code-text.ts"     ;

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
	/** This terminal may be absent only when both profiles declare it. Omit this property for strict terminal matching. */
	readonly optionalTerminalAxis?: string;

	readonly indent : string;
	readonly slots  : readonly Slot[];
}

/** A source-confirmed row and an internal region identity; the identity never enters approval keys. */
export interface PreparedRow {
	readonly profile: RowProfile;
	readonly region: string;
}

/** Display-only source labels, excluded from grouping and approval identity. */
export interface GroupDescription {
	readonly semanticKind?: string;
	readonly sourceContext?: string;
}

/** One invocation's source analysis and edit safety checks. */
export interface PreparedSource {
	/** Opaque original-source spans consumed by the shared mask. */
	readonly protectedRanges: readonly { readonly start: number; readonly end: number }[];
	/** Decompose a physical row only when the source owner admits it. */
	row(index: number, code: string, masked: string): PreparedRow | null;
	/** Offer a lower-priority outer row in its original region. */
	project(index: number, code: string, masked: string): PreparedRow | null;
	/** Return the marker's owning region, or null when it is not transparent. */
	transparent(index: number, masked: string): string | null;
	/** Identify edits that fail the original-source preservation proof. */
	unsafeEditLines(edits: readonly TableEdit[]): readonly number[];
	/** Report candidates outside the selected zero-based row indexes; returned line numbers are one-based. */
	unsupported?(coveredLines: ReadonlySet<number>): readonly { readonly line: number; readonly reason: string }[];
	/** Describe an already selected run using its actual zero-based rows, including noncontiguous rows. */
	describeGroup?(rowIndexes: readonly number[], axes: readonly string[]): GroupDescription;
	/**
	 * Whether same-shape tables of one region compare as one table. A bracket region (call arguments, a literal,
	 * parameters) answers true, so a multiline argument or an unsupported row does not split its columns.
	 */
	sharesColumns?(region: string): boolean;
}

export interface LineProfiler {
	/** Prepare one source document; absent for legacy profilers. */
	prepareSource?(source: string): PreparedSource;
	readonly language: string;
	readonly syntax: CodeSyntax;
	/** Cells on these axes are right-padded to the column width (compared columns). */
	readonly columnAxes: readonly string[];
	/** Canonical gap per axis used for reassembly. Axes not listed use " ". */
	readonly canonicalGaps: Readonly<Record<string, string>>;
	/** Returns the decomposition if the line is a table row, otherwise null. code is the source with the trailing comment cut; masked is the mask at the same coordinates. */
	profile(code: string, masked: string): RowProfile | null;
	/**
	 * Rows whose axes are a prefix of the run's longest axes join that run (`name : type` beside `name : type = value`).
	 * Off by default; each language opts in only where a shorter row is the same role with fewer trailing cells.
	 */
	readonly prefixRuns?: boolean;
	/**
	 * Axes that close a row (a parameter list's `,`). In a prefix run whose rows all end with the same terminal axis,
	 * prefixes are compared without it and it forms its own column after the longest row, like a trailing comment.
	 */
	readonly terminalAxes?: readonly string[];
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

export interface DetectedTable extends GroupDescription {
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

export interface PairGroup extends GroupDescription {
	readonly startLine : number ;
	readonly endLine   : number ;
	readonly rows      : number ;
	readonly signature : string ;
}

export interface AlignResult {
	readonly output     : string                  ;
	/** Number of contiguous same-signature runs of 2+ rows. */
	readonly groups     : number                  ;
	/** Number of tables actually aligned (minRows or more). */
	readonly tables     : number                  ;
	/** Number of rows that alignment would change. */
	readonly misaligned : number                  ;
	/** Number of rows actually changed when apply=true. */
	readonly edits   : number                   ;
	readonly details : readonly DetectedTable[] ;
	readonly pairs   : readonly PairGroup[]     ;
	/** Tables whose edits failed the whitespace-only check or whose columns would follow wide characters; never applied. */
	readonly refused    : readonly DetectedTable[];
	/** Valid source candidates outside the profiler's supported shapes; never rewritten. */
	readonly unsupported?: readonly { readonly line: number; readonly reason: string }[];
}

export interface AlignOptions {
	readonly minRows: number;
	/** When false, only report and leave output identical to the source. */
	readonly apply: boolean;
	/** Optional read-only observation of the selected rows and actual alignment plan. */
	readonly observe?: (groups: readonly PlannedMeasurement[]) => void;
}

/** Read-only observation of one selected line-engine run. */
export interface PlannedMeasurement {
	readonly rows         : readonly { readonly line: number; readonly profile: RowProfile }[] ;
	readonly alignedCodes : readonly string[] | null                                           ;
	readonly edits        : readonly TableEdit[]                                               ;
	/** Explains a pair or preservation refusal when no safe plan is available. */
	readonly reason?: string;
}

const canonicalGap = (aligner: LineProfiler, axis: string): string => aligner.canonicalGaps[axis] ?? " ";

function signatureOf(profile: RowProfile): string {
	return `${profile.indent}|${profile.slots.map(slot => slot.axis).join(">")}`;
}

/** Measure a cell at its actual starting column without changing its tab bytes or the shared width policy. */
function cellWidth(text: string, column: number): number {
	const offset = column % 4;
	return text.includes("\t") ? displayWidth(" ".repeat(offset) + text) - offset : displayWidth(text);
}

function rebuildCode(aligner: LineProfiler, profile: RowProfile, widths: readonly number[] | null): string {
	const parts: string[] = [profile.indent]             ;
	const lastIndex       = profile.slots.length - 1     ;
	let column            = displayWidth(profile.indent) ;
	profile.slots.forEach((slot, position) => {
		if (position > 0) {
			const gap = canonicalGap(aligner, slot.axis);
			parts.push(gap);
			column += cellWidth(gap, column);
		}
		const width = cellWidth(slot.text, column);
		// The last cell of a row has nothing after it to align, so it is not padded — never create trailing whitespace.
		if (widths !== null && aligner.columnAxes.includes(slot.axis) && position !== lastIndex) {
			const pad = widths[position] - width;
			parts.push(pad > 0 ? slot.text + " ".repeat(pad) : slot.text);
			column += Math.max(0, pad);
		} else {
			parts.push(slot.text);
		}
		column += width;
	});
	return parts.join("");
}

interface AcceptedRow {
	readonly index   : number        ;
	readonly profile : RowProfile    ;
	readonly comment : string | null ;
	readonly region  : string | null ;
}

/** Both primary and projected rows must reconstruct the same original code with whitespace-only gaps. */
function losslessProfile(profile: RowProfile, code: string): boolean {
	return   /^[ \t]*$/u.test(profile.indent)
          && profile.slots.every(slot => /^[ \t]*$/u.test(slot.gapBefore))
          && profile.indent + profile.slots.map((slot, position) => position === 0 ? slot.text : slot.gapBefore + slot.text).join("") === code;
}

/** The row without its terminal cell when that cell's axis is listed as terminal. */
function withoutTerminal(profile: RowProfile, terminalAxes: readonly string[]): RowProfile {
	const last = profile.slots.at(-1);
	return last && terminalAxes.includes(last.axis) ? { indent: profile.indent, slots: profile.slots.slice(0, -1) } : profile;
}

/** A terminal cell matches on both rows unless both explicitly admit that axis as optional. */
function prefixRelated(left: RowProfile, right: RowProfile, terminalAxes: readonly string[]): boolean {
	if (left.indent !== right.indent) return false;
	const leftEnd  = left.slots.at(-1)?.axis ?? ""                                     ;
	const rightEnd = right.slots.at(-1)?.axis ?? ""                                    ;
	const terminal = terminalAxes.includes(leftEnd) || terminalAxes.includes(rightEnd) ;
	if (terminal && leftEnd !== rightEnd) {
		const optional = left.optionalTerminalAxis;
		if (optional === undefined || optional !== right.optionalTerminalAxis) return false;
		if (!terminalAxes.includes(optional)                                 ) return false;
		if (leftEnd !== optional && rightEnd !== optional                    ) return false;
		if (terminalAxes.includes(leftEnd) && terminalAxes.includes(rightEnd)) return false;
	}
	const bodies         = [withoutTerminal(left, terminalAxes), withoutTerminal(right, terminalAxes)] ;
	const [short, long]  = bodies[0].slots.length <= bodies[1].slots.length ? bodies : [bodies[1], bodies[0]] ;
	return short.slots.every((slot, position) => slot.axis === long.slots[position].axis);
}

/** True when only transparent marker lines sit between two rows. */
function adjacent(previous: AcceptedRow, next: AcceptedRow, transparent: ReadonlyMap<number, string | null>): boolean {
	for (let index = previous.index + 1; index < next.index; index += 1) if (!transparent.has(index) || transparent.get(index) !== previous.region) return false;
	return true;
}

/** The row with the most slots; a prefix run is judged and reported by it. */
function longestProfile(run: readonly AcceptedRow[]): RowProfile {
	return run.reduce((longest, row) => row.profile.slots.length > longest.slots.length ? row.profile : longest, run[0].profile);
}

function contiguousRuns(rows: readonly AcceptedRow[], prefixRuns: boolean, terminalAxes: readonly string[], transparent: ReadonlyMap<number, string | null>): AcceptedRow[][] {
	const runs  : AcceptedRow[][] = [] ;
	let current : AcceptedRow[]   = [] ;
	const flush = (): void => {
		if (current.length >= 2) runs.push(current);
		current = [];
	};

	for (const row of rows) {
		const previous   = current.at(-1)                                                                      ;
		const contiguous = !previous || adjacent(previous, row, transparent) && previous.region === row.region ;
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
function alignRun(aligner: LineProfiler, run: readonly AcceptedRow[], terminalAxes: readonly string[], measure: readonly AcceptedRow[] = run): string[] {
	const lengths  = new Set(run.map(row => row.profile.slots.length))                                                ;
	const terminal = run[0].profile.slots.at(-1)?.axis ?? ""                                                          ;
	const shared   = terminalAxes.includes(terminal) && run.every(row => row.profile.slots.at(-1)?.axis === terminal) ;
	if (lengths.size === 1 || !shared) {
		const widths = columnWidths(aligner, measure);
		return run.map(row => rebuildCode(aligner, row.profile, widths));
	}
	const strip    = (row: AcceptedRow): AcceptedRow => ({ ...row, profile: withoutTerminal(row.profile, terminalAxes) }) ;
	const widths   = columnWidths(aligner, measure.map(strip))                                                            ;
	const codes    = run.map     (row => rebuildCode(aligner, strip(row).profile, widths))                                ;
	const measured = measure.map (row => displayWidth(rebuildCode(aligner, strip(row).profile, widths)))                  ;
	const column   = Math.max    (...measured)                                                                            ;
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
function columnWidths(aligner: LineProfiler, run: readonly AcceptedRow[]): number[] {
	const columns = run.map(row => displayWidth(row.profile.indent));
	return longestProfile(run).slots.map((_, position) => {
		const cellWidths = run.map((row, index) => {
			const slot = row.profile.slots[position];
			if (!slot) return 0;
			if (position > 0) columns[index] += cellWidth(canonicalGap(aligner, slot.axis), columns[index]);
			return cellWidth(slot.text, columns[index]);
		});
		const continuing = run .some(row => position < row.profile.slots.length - 1                                                                ) ;
		const width      = Math.max (...cellWidths.map((value, index) => continuing && position >= run[index].profile.slots.length - 1 ? 0 : value)) ;
		run.forEach((row, index) => {
			const slot = row.profile.slots[position];
			if (!slot) return;
			columns[index] += aligner.columnAxes.includes(slot.axis) && position < row.profile.slots.length - 1
				? Math.max(width, cellWidths[index])
				: cellWidths[index];
		});
		return width;
	});
}

/**
 * Tables of one shared region with the same shape measure their columns together, so one bracket keeps one set of
 * columns although a multiline argument or an unsupported row splits its rows into several runs. A same-shape pair in
 * that region contributes its widths but is not rewritten.
 */
function regionMeasures(runs: readonly AcceptedRow[][], minRows: number, prepared: PreparedSource | undefined): ReadonlyMap<readonly AcceptedRow[], readonly AcceptedRow[]> {
	const families = new Map<string, AcceptedRow[][]>();
	for (const run of runs) {
		const region = run[0].region;
		if (region === null || !run.every(row => row.region === region) || !prepared?.sharesColumns?.(region)) continue;
		if (run.some(row => columnsFollowWideText(row))) continue;
		const key = `${region}\u0000${run[0].profile.indent}\u0000${signatureOf(longestProfile(run))}`;
		families.set(key, [...families.get(key) ?? [], run]);
	}
	const measures = new Map<readonly AcceptedRow[], readonly AcceptedRow[]>();
	for (const family of families.values()) {
		if (family.length < 2) continue;
		for (const run of family) if (run.length >= minRows) measures.set(run, family.flat());
	}
	return measures;
}

/** Select one owner per row. A primary table remains reserved even if the preservation gate later refuses it. */
function projectedRuns(primary: AcceptedRow[][], projected: readonly AcceptedRow[], minRows: number, prefixRuns: boolean, terminalAxes: readonly string[], transparent: ReadonlyMap<number, string | null>): AcceptedRow[][] {
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
	const prepared    = aligner.prepareSource?.(source)                                    ;
	const minRows     = Math     .max  (3, options.minRows    )                            ;
	const mask        = maskSource     (source, aligner.syntax, prepared?.protectedRanges) ;
	const lines       = source   .split("\n"                  )                            ;
	const maskedLines = mask.text.split("\n"                  )                            ;

	const projections               = prepared ? undefined : aligner.project?.(source) ;
	const accepted  : AcceptedRow[] = []                                               ;
	const transparent               = new Map<number, string | null>()                 ;
	const projected : AcceptedRow[] = []                                               ;

	lines.forEach((raw, index) => {
		// CRLF files carry \r at every line end; profiling strips it and the rebuilt line gets it back, so a
		// row is never refused for trailing \r and the file's line endings stay exactly as they were.
		const hadCR      = raw.endsWith("\r")                                                         ;
		const line       = hadCR ? raw.slice(0, -1) : raw                                             ;
		const maskedLine = hadCR ? (maskedLines[index] ?? "").slice(0, -1) : maskedLines[index] ?? "" ;
		if (mask.opensInBlock[index]) return;
		const commentStart = mask.commentStarts[index]                                                                    ;
		const codeEnd      = commentStart >= 0 ? commentStart : line.length                                               ;
		const comment      = codeEnd < line.length ? (prepared ? line.slice(codeEnd) : line.slice(codeEnd).trim()) : null ;
		// Leftover spaces before a comment are replaced by the computed gap on reassembly, so strip them from the code part.
		const code       = comment !== null ? line.slice(0, codeEnd).replace(/\s+$/u, "") : line.slice(0, codeEnd)             ;
		const maskedCode = comment !== null ? maskedLine.slice(0, codeEnd).replace(/\s+$/u, "") : maskedLine.slice(0, codeEnd) ;
		if (maskedCode.trim() === "") return;
		const row = prepared ? prepared.row(index, code, maskedCode) : (() => {
			const profile = aligner.profile(code, maskedCode);
			return profile ? { profile, region: null } : null;
		})();
		if (row && losslessProfile(row.profile, code)) accepted.push({ index, profile: row.profile, comment, region: row.region });
		else if (comment === null) {
			const region = prepared ? prepared.transparent(index, maskedCode) : aligner.transparentRow?.(maskedCode) ? null : undefined;
			if (region !== null && region !== undefined || !prepared && region === null) transparent.set(index, region ?? null);
		}

		const projection = prepared ? prepared.project(index, code, maskedCode) : (() => {
			const profile = projections?.get(index);
			return profile ? { profile, region: null } : null;
		})();
		if (projection && losslessProfile(projection.profile, code)) projected.push({ index, profile: projection.profile, comment, region: projection.region });
	});

	const terminalAxes = aligner.terminalAxes ?? []                                                                                                           ;
	const prefixRuns   = aligner.prefixRuns === true                                                                                                          ;
	const primary      = contiguousRuns(accepted, prefixRuns, terminalAxes, transparent)                                                                      ;
	const runs         = !prepared && projections === undefined ? primary : projectedRuns(primary, projected, minRows, prefixRuns, terminalAxes, transparent) ;

	const candidates   : DetectedTable[]                                                                                                   = [] ;
	const wideRefused  : DetectedTable[]                                                                                                   = [] ;
	const pairs        : PairGroup[]                                                                                                       = [] ;
	const observations : { run: readonly AcceptedRow[]; table?: DetectedTable; alignedCodes: readonly string[] | null; reason?: string }[] = [] ;

	const measures = regionMeasures(runs, minRows, prepared);

	for (const run of runs) {
		const signature   = signatureOf(longestProfile(run))                                                                       ;
		const description = prepared?.describeGroup?.(run.map(row => row.index), longestProfile(run).slots.map(slot => slot.axis)) ;
		const display = {
			...(description?.semanticKind === undefined ? {} : { semanticKind: description.semanticKind }),
			...(description?.sourceContext === undefined ? {} : { sourceContext: description.sourceContext }),
		};
		if (run.length < minRows) {
			pairs.push({ startLine: run[0].index + 1, endLine: run[run.length - 1].index + 1, rows: run.length, signature, ...display });
			if (options.observe) observations.push({ run, alignedCodes: null, reason: "pair below minimum row count" });
			continue;
		}
		if (run.some(row => columnsFollowWideText(row))) {
			if (options.observe) observations.push({ run, alignedCodes: null, reason: "wide characters" });
			wideRefused.push({
				startLine : run[0].index + 1                                 ,
				endLine   : run[run.length - 1].index + 1                    ,
				rows      : run.length                                       ,
				indent    : run[0].profile.indent                            ,
				axes      : longestProfile(run).slots.map(slot => slot.axis) ,
				widths    : columnWidths(aligner, run)                       ,
				edits     : []                                               ,
				refusal   : "wide-characters"                                ,
				...display,
			});
			continue;
		}
		const measure      = measures.get(run) ?? run                           ;
		const widths       = columnWidths(aligner, measure                    ) ;
		const alignedCodes = alignRun    (aligner, run, terminalAxes, measure ) ;
		const commentRows  = run.map     (row => row.comment !== null)          ;
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
		const table: DetectedTable = {
			startLine : run[0].index + 1                                 ,
			endLine   : run[run.length - 1].index + 1                    ,
			rows      : run.length                                       ,
			indent    : run[0].profile.indent                            ,
			axes      : longestProfile(run).slots.map(slot => slot.axis) ,
			widths    : widths                                           ,
			edits     : tableEdits                                       ,
			...display,
		};
		candidates.push(table);
		if (options.observe) observations.push({ run, table, alignedCodes });
	}

	const { details, refused } = refuseUnsafeTables(source, lines, candidates, aligner, prepared);
	options.observe?.(observations.map(entry => ({
		rows         : entry.run.map(row => ({ line: row.index + 1, profile: row.profile })) ,
		alignedCodes : entry.alignedCodes                                                    ,
		edits        : entry.table?.edits ?? []                                              ,
		...(entry.reason || entry.table && !details.includes(entry.table) ? { reason: entry.reason ?? "preservation refused the group" } : {}),
	})));
	const editsByLine = new Map(details.flatMap(table => table.edits.map(edit => [edit.index, edit] as const)));
	const output = options.apply
		? lines.map((line, index) => editsByLine.get(index)?.after ?? line).join("\n")
		: source;
	const misaligned  = new Set(details.flatMap(table => table.edits.map(edit => edit.index))).size            ;
	const unsupported = prepared?.unsupported?.(new Set(runs.flatMap(run => run.map(row => row.index)))) ?? [] ;
	return {
		output     : output                                                                               ,
		groups     : runs.length                                                                          ,
		tables     : details.length                                                                       ,
		misaligned : misaligned                                                                           ,
		edits      : options.apply ? misaligned : 0                                                       ,
		details    : details                                                                              ,
		pairs      : pairs                                                                                ,
		refused    : [...refused, ...wideRefused].sort((left, right) => left.startLine - right.startLine) ,
		...(unsupported.length ? { unsupported } : {}),
	};
}

/**
 * Applies every table's edits, then refuses the tables that own a line failing the whitespace-only check and
 * repeats until the output passes. A failure that no remaining edited line explains (an edit that broke string or
 * comment state for later lines) refuses every table that still has edits.
 */
function refuseUnsafeTables(source: string, lines: readonly string[], tables: readonly DetectedTable[], aligner: LineProfiler, prepared?: PreparedSource): { readonly details: readonly DetectedTable[]; readonly refused: readonly DetectedTable[] } {
	let kept                       = [...tables] ;
	const refused: DetectedTable[] = []          ;
	for (;;) {
		const afterByLine = new Map(kept.flatMap(table => table.edits.map(edit => [edit.index, edit.after] as const)));
		if (afterByLine.size === 0) break;
		const candidate = lines.map((line, index) => afterByLine.get(index) ?? line).join("\n")                                                              ;
		const changed   = new Set(prepared ? prepared.unsafeEditLines(kept.flatMap(table => table.edits)) : changedLines(source, candidate, aligner.syntax)) ;
		if (changed.size === 0) break;
		const culprits = kept.filter(table => table.edits.some(edit => changed.has(edit.index)))                ;
		const drop     = new Set(culprits.length > 0 ? culprits : kept.filter(table => table.edits.length > 0)) ;
		refused.push(...[...drop].map(table => ({ ...table, refusal: "whitespace-only" as const })));
		kept = kept.filter(table => !drop.has(table));
	}
	return { details: kept, refused };
}
