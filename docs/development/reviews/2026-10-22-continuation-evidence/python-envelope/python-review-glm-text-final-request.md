Audit frozen BoxBox Python outer-assignment runtime source. Return exactly PASS or FIX_REQUIRED, <=1200 words. Mandatory defects only: file/function or line, concrete reproduction/trace, violated invariant/impact, smallest fix. Optional hardening separately. No style rewrite, grammar expansion or approval grant. No tools; do not claim execution.

Invariants: optional pure project callback leaves absent-callback adapters unchanged; new key v1|python|-|table|name>equal>assignment-value cannot inherit approved name>equal>value; complete primary tables reserve rows even if refused later; no table/pair overlap or duplicate counts; projected runs require contiguous lines/same indent/axes; quote/escape/comment/bracket/backslash state fails closed; detector is not syntax authority; simple ASCII target and opaque RHS only, changing gaps around = only; unsupported Python stays outside projection.

Existing approved record unchanged:
{"schemaVersion":1,"id":"py-simple-assignments","key":"v1|python|-|table|name>equal>value","pattern":"DEFINE","status":"approved","scope":"**/*.py","examples":["py-simple-assignments-positive","py-simple-assignments-two-row-counterexample"],"versions":{"lookupKey":1,"conventionSchema":1,"exampleSchema":1,"decisionSchema":1},"approvedBy":"maintainer","date":"2026-10-21"}

Hashes: table-engine b7dc0ad9750cbcfb8af3a7de8cc89360040644d9ffa0334e420e93663f11b1cb; assignment-envelope 38e212df561fb035fdcb5e33142ff149d28ea2b21d0a59177d5c7e4e89c56653; profile 4a76139ca42aeb38e2abef0a03a6a30ab7ef886c571bdbb68a5985f699e4493b. Reported evidence (not executable here): exact native quotation 180 cases; 39 focused pass; tsc pass; full 648 pass/5 existing missing Rust-Kotlin parser skips/0 fail/3396 assertions; independent Codex source review found no runtime defect. Tests are not in this packet; state that limit.

## complete product/engine/common/table-engine.ts
```ts
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
import      { changedLines } from "@/common/preservation.ts"  ;
import      { displayWidth } from "@/common/display-width.ts" ;
import      { maskSource   } from "@/common/code-text.ts"     ;
import type { CodeSyntax   } from "@/common/code-text.ts"     ;

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

function contiguousRuns(rows: readonly AcceptedRow[]): AcceptedRow[][] {
	const runs  : AcceptedRow[][] = [] ;
	let current : AcceptedRow[]   = [] ;
	const flush = (): void => {
		if (current.length >= 2) runs.push(current);
		current = [];
	};

	for (const row of rows) {
		const previous   = current.at(-1)                                                         ;
		const contiguous = !previous || previous.index === row.index - 1                          ;
		const sameShape  = previous && signatureOf(previous.profile) === signatureOf(row.profile) ;
		if (contiguous && sameShape) current.push(row);
		else { flush(); current = [row]; }
	}
	flush();

	return runs;
}

/** Select one owner per row. A primary table remains reserved even if the preservation gate later refuses it. */
function projectedRuns(primary: AcceptedRow[][], projected: readonly AcceptedRow[], minRows: number): AcceptedRow[][] {
	const primaryTables  = primary.filter(run => run.length >= minRows)                                               ;
	const reserved       = new Set(primaryTables.flatMap(run => run.map(row => row.index)))                           ;
	const fallback       = contiguousRuns(projected.filter(row => !reserved.has(row.index)))                          ;
	const fallbackTables = fallback.filter(run => run.length >= minRows)                                              ;
	const claimed        = new Set(fallbackTables.flatMap(run => run.map(row => row.index)))                          ;
	const primaryPairs   = primary.filter(run => run.length < minRows && run.every(row => !claimed.has(row.index)))   ;
	const pairRows       = new Set(primaryPairs.flatMap(run => run.map(row => row.index)))                            ;
	const fallbackPairs  = fallback.filter(run => run.length < minRows && run.every(row => !pairRows.has(row.index))) ;

	return [...primaryTables, ...fallbackTables, ...primaryPairs, ...fallbackPairs].sort((left, right) => left[0].index - right[0].index);
}

export function alignSource(source: string, aligner: LineProfiler, options: AlignOptions): AlignResult {
	const minRows     = Math     .max  (3, options.minRows    ) ;
	const mask        = maskSource     (source, aligner.syntax) ;
	const lines       = source   .split("\n"                  ) ;
	const maskedLines = mask.text.split("\n"                  ) ;

	const projections               = aligner.project?.(source) ;
	const accepted  : AcceptedRow[] = []                        ;
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

		const projection = projections?.get(index);
		if (projection && losslessProfile(projection, code)) projected.push({ index, profile: projection, comment });
	});

	const primary = contiguousRuns(accepted)                                                         ;
	const runs    = projections === undefined ? primary : projectedRuns(primary, projected, minRows) ;

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
		const alignedCodes = run.map(row => rebuildCode(aligner, row.profile, widths)) ;
		const commentRows  = run.map(row => row.comment !== null)                      ;
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
			startLine : run[0].index + 1,
			endLine   : run[run.length - 1].index + 1,
			rows      : run.length,
			indent    : run[0].profile.indent,
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
		const candidate = lines.map((line, index) => afterByLine.get(index) ?? line).join("\n") ;
		const changed   = new Set(changedLines(source, candidate, aligner.syntax))              ;
		if (changed.size === 0) break;
		const culprits = kept.filter(table => table.edits.some(edit => changed.has(edit.index)))                ;
		const drop     = new Set(culprits.length > 0 ? culprits : kept.filter(table => table.edits.length > 0)) ;
		refused.push(...drop);
		kept = kept.filter(table => !drop.has(table));
	}
	return { details: kept, refused };
}

```
## complete product/engine/python/assignment-envelope.ts
```ts
import type { RowProfile } from "@/common/table-engine.ts";

const KEYWORDS = new Set([
	"False", "None", "True", "and", "as", "assert", "async", "await", "break", "class", "continue", "def",
	"del", "elif", "else", "except", "finally", "for", "from", "global", "if", "import", "in", "is",
	"lambda", "nonlocal", "not", "or", "pass", "raise", "return", "try", "while", "with", "yield", "match", "case",
]);

const NAME      = /^[A-Za-z_][A-Za-z0-9_]*$/u                    ;
const NUMBER    = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u  ;
const OPERATORS = new Set(["+", "-", "*", "/", "//", "%", "**"]) ;

/** A deliberately bounded calculation grammar; all accepted expression bytes remain one opaque cell. */
function calculation(text: string): boolean {
	const tokens = text.match(/[A-Za-z_][A-Za-z0-9_]*|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|\*\*|\/\/|[()+\-*/%,.]/gu) ?? [];
	if (tokens.join("") !== text.replace(/[ \t]/gu, "")) return false;

	let cursor       = 0                                                                    ;
	const identifier = (token: string): boolean => NAME.test(token) && !KEYWORDS.has(token) ;
	const expression = (depth: number): boolean => {
		if (depth > 64 || !operand(depth)) return false;
		while (OPERATORS.has(tokens[cursor] ?? "")) {
			cursor += 1;
			if (!operand(depth)) return false;
		}
		return true;
	};
	const operand = (depth: number): boolean => {
		while (tokens[cursor] === "+" || tokens[cursor] === "-") cursor += 1;

		const token = tokens[cursor] ?? "";
		if (identifier(token) || NUMBER.test(token)) cursor += 1;
		else if (token === "(") {
			cursor += 1;
			if (!expression(depth + 1) || tokens[cursor] !== ")") return false;
			cursor += 1;
		} else return false;

		for (;;) {
			if (tokens[cursor] === ".") {
				cursor += 1;
				if (!identifier(tokens[cursor] ?? "")) return false;
				cursor += 1;
			} else if (tokens[cursor] === "(") {
				cursor += 1;
				if (tokens[cursor] !== ")") {
					if (!expression(depth + 1)) return false;
					while (tokens[cursor] === ",") {
						cursor += 1;
						if (!expression(depth + 1)) return false;
					}
				}
				if (tokens[cursor] !== ")") return false;
				cursor += 1;
			} else return true;
		}
	};

	return expression(0) && cursor === tokens.length;
}

function assignment(code: string): RowProfile | null {
	const match = /^([ \t]*)([A-Za-z_][A-Za-z0-9_]*)([ \t]*)=([ \t]*)(\S(?:.*\S)?)$/u.exec(code);
	if (!match || KEYWORDS.has(match[2]!) || !calculation(match[5]!)) return null;

	return {
		indent: match[1]!,
		slots: [
			{ axis : "name"             , text : match[2]! , gapBefore : ""        },
			{ axis : "equal"            , text : "="       , gapBefore : match[3]! },
			{ axis : "assignment-value" , text : match[5]! , gapBefore : match[4]! },
		],
	};
}

/**
 * Complete physical assignments outside continuations only. This source pass tracks quote state because the
 * shared mask does not expose whether a physical line starts inside a multiline string. Prefixed strings and
 * mismatched delimiters stop new projections for the remainder of the file; detailed profiles are unaffected.
 */
export function assignmentEnvelopes(source: string): ReadonlyMap<number, RowProfile> {
	const result                                      = new Map<number, RowProfile>()    ;
	const brackets : string[]                         = []                               ;
	const opening  : Readonly<Record<string, string>> = { ")": "(", "]": "[", "}": "{" } ;
	let quote                                         = ""                               ;
	let continued                                     = false                            ;
	let uncertain                                     = false                            ;

	for (const [index, raw] of source.split("\n").entries()) {
		const line        = raw.endsWith("\r") ? raw.slice(0, -1) : raw                       ;
		const independent = quote === "" && brackets.length === 0 && !continued && !uncertain ;
		let comment       = line.length                                                       ;

		for (let position = 0; position < line.length; position += 1) {
			const character = line[position]!;
			if (quote !== "") {
				if (character === "\\") position += 1;
				else if (line.startsWith(quote, position)) { position += quote.length - 1; quote = ""; }
				continue;
			}
			if (character === "#") { comment = position; break; }
			if (character === '"' || character === "'") {
				const prefix = /[A-Za-z_][A-Za-z0-9_]*$/u.exec(line.slice(0, position))?.[0] ?? "";
				if (/^[rubf]+$/iu.test(prefix)) uncertain = true;
				quote = line.startsWith(character.repeat(3), position) ? character.repeat(3) : character;
				position += quote.length - 1;
			} else if ("([{".includes(character)) brackets.push(character);
			else if (opening[character] !== undefined && brackets.pop() !== opening[character]) uncertain = true;
		}

		const code = comment < line.length ? line.slice(0, comment).replace(/[ \t]+$/u, "") : line;
		continued = quote === "" && code.endsWith("\\");
		if (!independent || quote !== "" || brackets.length !== 0 || continued || uncertain) continue;

		const profile = assignment(code);
		if (profile) result.set(index, profile);
	}

	return result;
}

```
## product/engine/python/profile.ts registration excerpts
```ts
 * A separate outer calculation projection can compare unclaimed simple assignments without decomposing their RHS.
 * Its distinct assignment-value axis never inherits approval for the detailed value axis.
 * Refusal is safe; misrecognition is dangerous.
 */
import type {
              CodeSyntax        ,
              LineProfiler      ,
              RowProfile        ,
// unchanged detailed profiler body omitted

export const PYTHON_ALIGNER: LineProfiler = {
	language      : "python",
	syntax        : PYTHON_SYNTAX,
	// cell/arg axes of bundle rows are followed by a comma or the close slot, so aligning them never creates trailing whitespace.
	columnAxes    : ["name", "attribute", "chain-target", "key", "type", "value", "cell", "arg"],
	// Python convention: colon and comma attach to the cell; equal gets one space. Bundle rows attach the
	// first cell to the opening bracket and attach close too, so the closing bracket shares the last cell's width.
	// The call layer's wrapped bundle attaches its brackets to the call the same way.
	canonicalGaps : { name: " ", attribute: " ", "chain-target": " ", key: " ", type: " ", value: " ", colon: "", equal: " ", comma: "", cell: "", arg: " ", "open[": "", "open(": "", "open{": "", "close]": "", "close)": "", "close}": "" },
	profile       : profilePython,
```
