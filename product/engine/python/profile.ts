/**
 * Python line profiler. Structure is judged on `masked` (string contents and comments blanked), and cell text
 * is sliced from `code` at the same coordinates (match.indices from the /d flag). Table rows are limited to six forms.
 *
 * Table forms:
 * 1. Annotated assignment `name: Type = value` → name, colon, type, equal, value
 * 2. Dataclass field      `name: Type`         → name, colon, type
 * 3. Dictionary row       `"key": value,`      → key (with quotes), colon, value, comma
 * 4. Plain assignment     `name = value`       → name, equal, value
 * 5. Bundle row           `["a", 1, "x"],`     → cell/arg columns with open, comma, close separators
 * 6. Assigned call row    `name = call(a, b)`  → name, equal, call cell (callee in the axis name), argument cells;
 *                                                one flat bundle argument folds its cells inside the call
 *
 * Refused (null) when uncertain: non-bundle rows with remaining parens, braces or brackets (calls, containers,
 * indexing, def signatures); rows ending in a continuation (\); decorator, def, class, control-flow and import
 * rows; rows whose value is empty, starts with =, or contains ; or ,; rows with trailing whitespace.
 * Refusal is safe; misrecognition is dangerous.
 */
import type { CodeSyntax, LineProfiler, RowProfile, Slot } from "@/common/table-engine.ts";

export const PYTHON_SYNTAX: CodeSyntax = {
	lineComments  : ["#"],
	blockComments : [],
	strings       : [
		{ open : '"""' , close : '"""' , escape : true },
		{ open : "'''" , close : "'''" , escape : true },
		{ open : '"'   , close : '"'   , escape : true },
		{ open : "'"   , close : "'"   , escape : true },
	],
	cppRaw        : false,
};

const INDENT = "([ \\t]*)"                                              ;
const NAME   = "([A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z_][A-Za-z0-9_]*)*)" ;
const QUOTED = "(\"[^\"]*\"|'[^']*')"                                   ;
const TYPE   = "([A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z_][A-Za-z0-9_]*)*)" ;
const GAP    = "(\\s*)"                                                 ;
const VALUE  = "(.+?)"                                                  ;

/** Statement starts that cannot be table rows — control flow, declarations, imports. match/case are soft keywords and excluded. */
const RESERVED_START = /^(?:if|elif|else|for|while|try|except|finally|with|def|class|return|raise|import|from|pass|break|continue|lambda|yield|assert|del|global|nonlocal|async|await)\b/;

const ANNOTATED = new RegExp(`^${INDENT}${NAME}${GAP}:${GAP}${TYPE}${GAP}=${GAP}${VALUE}${GAP}$`, "du") ;
const DECLARED  = new RegExp(`^${INDENT}${NAME}${GAP}:${GAP}${TYPE}$`                           , "du") ;
const DICT_ROW  = new RegExp(`^${INDENT}${QUOTED}${GAP}:${GAP}${VALUE}${GAP},$`                 , "du") ;
const ASSIGNED  = new RegExp(`^${INDENT}${NAME}${GAP}=${GAP}${VALUE}${GAP}$`                    , "du") ;

/** Bundle rows `[ cell , cell ... ] trailer` and `( cell , cell ... ) trailer` — trailer holds the following `,` verbatim. */
const BUNDLED       = /^([ \t]*)([[(])(.*)([\])])(,?)[ \t]*$/du                                         ;
/** String form of a bundle cell — commas and brackets inside are blanked by the mask. */
const BUNDLE_STRING = /^"(?:[^"\\]|\\.)*"$|^'(?:[^'\\]|\\.)*'$/u;
/** Scalar form of a bundle cell — signed decimal, hex and exponent numbers and identifiers (including True, False, None). */
const BUNDLE_SCALAR = /^(?:[+-]?(?:0[xX][0-9A-Fa-f_]+|[0-9][0-9_]*(?:\.[0-9_]+)?(?:[eE][+-]?[0-9]+)?)|[A-Za-z_][A-Za-z0-9_]*)$/u;
/** If these characters remain in the mask inside a bundle row, it involves nesting, assignment, indexing or continuation — do not attempt decomposition. */
const BUNDLE_UNSAFE = /[[\]{}()=\\]/u;

function slotAt(code: string, match: RegExpExecArray, group: number): string {
	const range = match.indices?.[group];
	return range ? code.slice(range[0], range[1]) : "";
}

/** If an opening paren, brace, bracket or continuation (\) remains in the mask, the row is a call, container, index or continuation row. */
function isUnsafe(masked: string): boolean {
	return /[(){}[\]]/.test(masked) || masked.includes("\\");
}

/** Cuts the value cell by source coordinates and refuses uncertain values. It must not be empty, start with = (== comparison), or contain ; or ,. */
function valueSlot(code: string, masked: string, match: RegExpExecArray, gapGroup: number, textGroup: number): Slot | null {
	const gapRange  = match.indices?.[gapGroup ] ;
	const textRange = match.indices?.[textGroup] ;
	if (!gapRange || !textRange)                               return null;
	const text = code.slice(textRange[0], textRange[1]);
	if (text.trim() === "" || text.startsWith("="))            return null;
	if (/[;,]/.test(masked.slice(textRange[0], textRange[1]))) return null;
	return { axis: "value", text, gapBefore: code.slice(gapRange[0], gapRange[1]) };
}

/**
 * Bundle rows `["alpha", 1, "x"],` and `("ccc", 333, "z"),` — list and tuple data rows. Cell boundaries are cut
 * at the mask's commas and text is taken from `code` at the same coordinates. Commas inside string cells are
 * blanked by the mask, so boundaries hold. Only scalar cells (strings, numbers, identifiers) pass; nesting,
 * assignment or indexing inside is refused. The bracket pair is part of the open/close axis names so `[` tables
 * and `(` tables never mix, and arity is part of the axis sequence so only same-arity rows form one table. The
 * close slot (closing bracket + trailer) is last in the row, so padding cell columns never creates trailing whitespace.
 */
function bundleProfile(code: string, masked: string): RowProfile | null {
	const match   = BUNDLED.exec(masked) ;
	const indices = match?.indices       ;
	if (!match || !indices) return null;
	const open  = match[2] ;
	const close = match[4] ;
	if ((open === "[") !== (close === "]")) return null; // mismatched bracket pair is not a bundle
	const interior = indices[3] ;
	const trailer  = indices[5] ;
	if (!interior || !trailer)                                      return null;
	if (BUNDLE_UNSAFE.test(masked.slice(interior[0], interior[1]))) return null;

	const cells = cellsIn(code, masked, interior[0], interior[1]);
	if (!cells)                                                     return null;

	const slots: Slot[] = [{ axis: open === "[" ? "open[" : "open(", text: open, gapBefore: "" }];
	cells.forEach((cell, position) => {
		// The first cell attaches directly to the opening bracket (gap ""); other cells get one space after the comma.
		slots.push({ axis: position === 0 ? "cell" : "arg", text: cell.text, gapBefore: cell.gap });
		if (position < cells.length - 1) slots.push({ axis: "comma", text: ",", gapBefore: cell.commaGap });
	});
	slots.push({ axis: close === "]" ? "close]" : "close)", text: close + slotAt(code, match, 5), gapBefore: code.slice(cells[cells.length - 1].end, interior[1]) });
	return { indent: slotAt(code, match, 1), slots };
}

/** Cuts `[start, end)` into cells at the mask's commas and validates every cell as a scalar; null when a cell fails. */
function cellsIn(code: string, masked: string, start: number, end: number): Array<{ text: string; gap: string; commaGap: string; end: number }> | null {
	const bounds: Array<{ start: number; end: number }> = []    ;
	let boundStart                                      = start ;
	for (let index = start; index < end; index += 1) {
		if (masked[index] === ",") {
			bounds.push({ start: boundStart, end: index });
			boundStart = index + 1;
		}
	}
	bounds.push({ start: boundStart, end });
	if (bounds.length < 2) return null; // a row with a single cell is not a bundle table

	const cells: Array<{ text: string; gap: string; commaGap: string; end: number }> = [];
	for (const bound of bounds) {
		const raw  = code.slice(bound.start, bound.end) ;
		const text = raw .trim ()                       ;
		if (text === "") return null; // empty cell from consecutive commas or after a trailing comma
		const cellStart = bound.start + raw.indexOf(text);
		if (text.startsWith('"') || text.startsWith("'")) {
			if (!BUNDLE_STRING.test(text)) return null;
		} else if (masked.slice(cellStart, cellStart + text.length) !== text || !BUNDLE_SCALAR.test(text)) {
			return null; // a cell with an f-string prefix or string fragment left is not a scalar
		}
		const cellEnd = cellStart + text.length;
		cells.push({ text, gap: code.slice(bound.start, cellStart), commaGap: code.slice(cellEnd, bound.end), end: cellEnd });
	}
	return cells;
}

/**
 * Layer 2 and 3 on assignment rows: `name = callee(...)` decomposes into the call cell and its argument cells.
 * The callee travels in the axis name, so rows calling a different callee never share a table, and arity is part
 * of the axis sequence. Two argument shapes pass: exactly one flat bundle argument (`frozenset({"a", "b"})` — the
 * bundle cells become the inner columns) or two or more scalar arguments (`run(files, before)`). Nesting, keyword
 * arguments and anything else inside the parentheses are refused. A bare `name = {...}` value without a call is
 * not a call row and stays refused with the other unsafe values.
 */
function assignedCallProfile(code: string, masked: string): RowProfile | null {
	const match   = /^([ \t]*)([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)(\s*)=(\s*)([A-Za-z_][A-Za-z0-9_.]*)(\s*)\((.*)\)[ \t]*$/du.exec(masked) ;
	const indices = match?.indices                                                                                                                          ;
	if (!match || !indices) return null;
	const nameRange = indices[2] ;
	const inner     = indices[7] ;
	if (!nameRange || !inner) return null;
	const callee = slotAt(code, match, 5);

	const slots: Slot[] = [
		{ axis : "name"           , text : slotAt(code, match, 2) , gapBefore : ""                     },
		{ axis : "equal"          , text : "="                    , gapBefore : slotAt(code, match, 3) },
		{ axis : `call:${callee}` , text : callee                 , gapBefore : slotAt(code, match, 4) },
		{ axis : "open("          , text : "("                    , gapBefore : slotAt(code, match, 6) },
	];
	const interiorText                    = masked.slice(inner[0], inner[1])                                         ;
	const trimmedStart                    = inner[0] + interiorText.length - interiorText.trimStart().length         ;
	const trimmedEnd                      = inner[0] + interiorText.trimEnd().length                                 ;
	const trimmed                         = masked.slice(trimmedStart, trimmedEnd)                                   ;
	const OPEN_OF: Record<string, string> = { "}": "{", "]": "[", ")": "(" }                                         ;
	const wrapOpen                        = OPEN_OF[trimmed.at(-1) ?? ""]                                            ;
	const isWrapped                       = trimmed.length >= 2 && wrapOpen !== undefined && trimmed[0] === wrapOpen ;
	let contentEnd                        = inner[1]                                                                 ;
	if (isWrapped) {
		const cells = BUNDLE_UNSAFE.test(masked.slice(trimmedStart + 1, trimmedEnd - 1))
			? null
			: cellsIn(code, masked, trimmedStart + 1, trimmedEnd - 1);
		if (!cells) return null;
		const wrap = trimmed[0]!;
		slots.push({ axis: wrap === "{" ? "open{" : wrap === "[" ? "open[" : "open(", text: code[trimmedStart] ?? "", gapBefore: code.slice(inner[0], trimmedStart) });
		cells.forEach((cell, position) => {
			slots.push({ axis: position === 0 ? "cell" : "arg", text: cell.text, gapBefore: cell.gap });
			if (position < cells.length - 1) slots.push({ axis: "comma", text: ",", gapBefore: cell.commaGap });
		});
		slots.push({ axis: trimmed.at(-1) === "}" ? "close}" : trimmed.at(-1) === "]" ? "close]" : "close)", text: code[trimmedEnd - 1] ?? "", gapBefore: code.slice(cells[cells.length - 1].end, trimmedEnd - 1) });
		contentEnd = trimmedEnd;
	} else {
		const cells = cellsIn(code, masked, inner[0], inner[1]);
		if (!cells) return null;
		cells.forEach((cell, position) => {
			slots.push({ axis: position === 0 ? "cell" : "arg", text: cell.text, gapBefore: cell.gap });
			if (position < cells.length - 1) slots.push({ axis: "comma", text: ",", gapBefore: cell.commaGap });
		});
		contentEnd = cells[cells.length - 1]!.end;
	}
	slots.push({ axis: "close)", text: ")", gapBefore: code.slice(contentEnd, inner[1]) });
	return { indent: slotAt(code, match, 1), slots };
}

function profilePython(code: string, masked: string): RowProfile | null {
	const trimmed = masked.trim();
	if (trimmed === "" || trimmed.startsWith("@") || RESERVED_START.test(trimmed)) return null;
	// Bundle rows keep their brackets, so decompose them before the isUnsafe check. Assigned call rows decompose
	// into the call cell and its argument cells the same way. Non-bundle rows with remaining brackets are refused
	// by isUnsafe below — the existing refusal rules still hold.
	const bundle = bundleProfile(code, masked);
	if (bundle)           return bundle;
	const assignedCall = assignedCallProfile(code, masked);
	if (assignedCall)     return assignedCall;
	if (isUnsafe(masked)) return null;

	const annotated = ANNOTATED.exec(masked);
	if (annotated) {
		if (slotAt(code, annotated, 9) !== "") return null;
		const value = valueSlot(code, masked, annotated, 7, 8);
		if (!value) return null;
		return {
			indent : slotAt(code, annotated, 1),
			slots  : [
				{ axis: "name",  text: slotAt(code, annotated, 2), gapBefore: "" },
				{ axis: "colon", text: ":", gapBefore: slotAt(code, annotated, 3) },
				{ axis: "type",  text: slotAt(code, annotated, 5), gapBefore: slotAt(code, annotated, 4) },
				{ axis: "equal", text: "=", gapBefore: slotAt(code, annotated, 6) },
				value,
			],
		};
	}

	const declared = DECLARED.exec(masked);
	if (declared) {
		return {
			indent : slotAt(code, declared, 1),
			slots  : [
				{ axis : "name"  , text : slotAt(code, declared, 2) , gapBefore : ""                        },
				{ axis : "colon" , text : ":"                       , gapBefore : slotAt(code, declared, 3) },
				{ axis : "type"  , text : slotAt(code, declared, 5) , gapBefore : slotAt(code, declared, 4) },
			],
		};
	}

	const dictRow = DICT_ROW.exec(masked);
	if (dictRow) {
		const value = valueSlot(code, masked, dictRow, 4, 5);
		if (!value) return null;
		return {
			indent : slotAt(code, dictRow, 1),
			slots  : [
				{ axis: "key",   text: slotAt(code, dictRow, 2), gapBefore: "" },
				{ axis: "colon", text: ":", gapBefore: slotAt(code, dictRow, 3) },
				value,
				{ axis: "comma", text: ",", gapBefore: slotAt(code, dictRow, 6) },
			],
		};
	}

	const assigned = ASSIGNED.exec(masked);
	if (assigned) {
		if (slotAt(code, assigned, 6) !== "") return null;
		const value      = valueSlot(code, masked, assigned, 4, 5)                                ;
		const name       = slotAt(code, assigned, 2)                                              ;
		const valueRange = assigned.indices![5]!                                                  ;
		const chained    = /(?<![=!<>:])=(?!=)/u.test(masked.slice(valueRange[0], valueRange[1])) ;
		const targetAxis = name.includes(".") ? "attribute" : chained ? "chain-target" : "name"   ;
		if (!value) return null;
		return {
			indent : slotAt(code, assigned, 1),
			slots  : [
				{ axis: targetAxis, text: name, gapBefore: "" },
				{ axis: "equal", text: "=", gapBefore: slotAt(code, assigned, 3) },
				value,
			],
		};
	}

	return null;
}

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
};
