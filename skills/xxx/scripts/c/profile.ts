/**
 * C profiler. Structure is matched on `masked` (strings and comments blanked), and cell text is sliced from `code`
 * at the same coordinates (/d flag indices). Supported tables: struct/union fields `Type name;`, enum constants
 * `NAME = value,`, designated initializers `.field = value,`, object-like macros `#define NAME value`, and brace
 * bundle rows `{1, "alpha", 0x10},` (2+ cells; one table per arity). Uncertain rows — function signatures, rows
 * with a remaining opening brace, control flow, return, bit fields, arrays, function-like macros, backslash line
 * continuation, bundle rows with nesting, assignment or calls inside — are refused with null, breaking the section.
 */
import type { CodeSyntax }                     from "../common/code-text.ts";
import type { LineProfiler, RowProfile, Slot } from "../common/table-engine.ts";

/** The mask preserves line/column geometry, so mask coordinates slice `code` directly. */
const sliceAt = (code: string, indices: RegExpIndicesArray, group: number): string => {
	const range = indices[group];
	return range ? code.slice(range[0], range[1]) : "";
};

/** C reserved words that cannot be names — refuses rows such as `int if;`. */
const C_KEYWORDS = new Set([
	"auto", "break", "case", "char", "const", "continue", "default", "do", "double", "else", "enum",
	"extern", "float", "for", "goto", "if", "inline", "int", "long", "register", "restrict", "return",
	"short", "signed", "sizeof", "static", "struct", "switch", "typedef", "union", "unsigned", "void",
	"volatile", "while", "_Bool", "_Complex", "_Imaginary",
]);

/** Keywords that make a statement rather than a declaration in the type position — refuses `return value;`. */
const CONTROL_KEYWORDS = new Set([
	"break", "case", "continue", "default", "do", "else", "for", "goto", "if", "return", "sizeof",
	"switch", "while",
]);

/** Type cells allow only identifiers and pointer stars — `unsigned int` and `struct foo *` pass, `x =` is refused. */
const TYPE_TOKEN = /^(?:[A-Za-z_]\w*|\*+)$/u;

/** Parentheses, braces, brackets or semicolons in a value cell indicate a call or initializer list, which is uncertain. */
const VALUE_UNSAFE = /[(){}[\];#]/u;

/** `Type name;` — type grows minimally, and a pointer star right before the name attaches to the name cell. */
const FIELD = /^([ \t]*)(.+?)([ \t]+)(\*+)?([A-Za-z_]\w*)([ \t]*);$/du;

/** `NAME = value,` — commas inside strings are blanked by the mask, so the value is not cut. */
const ENUM = /^([ \t]*)([A-Za-z_]\w*)([ \t]*)(=)([ \t]*)([^,]+?)([ \t]*),$/du;

/** `.field = value,` — dot chains such as `.a.b` are cut as one cell. */
const DESIGNATED = /^([ \t]*)((?:\.[A-Za-z_]\w*)+)([ \t]*)(=)([ \t]*)([^,]+?)([ \t]*),$/du;

/** `#define NAME value` — `(` right after the name is a function-like macro and is refused. */
const MACRO = /^([ \t]*)(#define)([ \t]+)([A-Za-z_]\w*)(?!\()(?:([ \t]+)(.+?))?$/du;

/** `{ cell , cell ... } trailer` — trailer holds the following `,`, `;` or nothing verbatim. */
const GROUP = /^([ \t]*)\{(.*)\}([,;]?)$/du;

/** String/char literal form of a bundle cell — commas and braces inside are blanked by the mask. */
const STRING_CELL = /^"(?:[^"\\]|\\.)*"$|^'(?:[^'\\]|\\.)*'$/u;
/** Scalar form of a bundle cell — signed decimal and 0x hex numbers (with C suffixes), identifiers and macros. */
const SCALAR_CELL = /^(?:[+-]?(?:0[xX][0-9A-Fa-f]+[uUlL]*|[0-9]+(?:\.[0-9]+)?[fFuUlL]*)|[A-Za-z_]\w*)$/u;
/** If these characters remain in the mask inside a bundle row, it involves nesting, assignment, calls or indexing — do not attempt decomposition. */
const GROUP_UNSAFE = /[{}()[\]=>]/u;

export const C_SYNTAX: CodeSyntax = {
	lineComments  : ["//"],
	blockComments : [{ open: "/*", close: "*/" }],
	strings       : [{ open: '"', close: '"', escape: true }, { open: "'", close: "'", escape: true }],
	cppRaw        : false,
};

function macroProfile(code: string, masked: string): RowProfile | null {
	const match = MACRO.exec(masked);
	const indices = match?.indices;
	if (!match || !indices) return null;
	const slots: Slot[] = [
		{ axis: "directive", text: sliceAt(code, indices, 2), gapBefore: ""                             },
		{ axis: "name",      text: sliceAt(code, indices, 4), gapBefore: sliceAt(code, indices, 3) },
	];
	if (indices[6]) slots.push({ axis: "replacement", text: sliceAt(code, indices, 6), gapBefore: sliceAt(code, indices, 5) });
	return { indent: sliceAt(code, indices, 1), slots };
}

function fieldProfile(code: string, masked: string): RowProfile | null {
	const match = FIELD.exec(masked);
	const indices = match?.indices;
	if (!match || !indices) return null;
	const type = sliceAt(code, indices, 2);
	const tokens = type.split(/[ \t]+/u);
	if (tokens.some(token => !TYPE_TOKEN.test(token))) return null;
	if (CONTROL_KEYWORDS.has(tokens[0] ?? "")) return null;
	const stars = indices[4];
	const nameRange = indices[5];
	if (!nameRange) return null;
	const name = code.slice((stars ?? nameRange)[0], nameRange[1]);
	if (C_KEYWORDS.has(name.replace(/^\*+/u, ""))) return null;
	return {
		indent : sliceAt(code, indices, 1),
		slots  : [
			{ axis : "type"      ,      text : type ,                       gapBefore  : ""                        },
			{ axis : "name"      ,      text : name ,                       gapBefore  : sliceAt(code, indices, 3) },
			{ axis : "semicolon" , text      : ";"  ,                        gapBefore : sliceAt(code, indices, 6) },
		],
	};
}

/** Enum constants and designated initializers share the `name = value,` form, so one check decomposes both with different axis names. */
function assignProfile(code: string, masked: string): RowProfile | null {
	const enumMatch  = ENUM.exec(masked)                                ;
	const designated = enumMatch === null                               ;
	const match      = designated ? DESIGNATED.exec(masked) : enumMatch ;
	const indices    = match?.indices                                   ;
	if (!match || !indices) return null;
	const equalEnd = indices[4]?.[1];
	const valueRange = indices[6];
	if (equalEnd === undefined || !valueRange) return null;
	if (masked[equalEnd] === "=") return null;
	if (VALUE_UNSAFE.test(masked.slice(valueRange[0], valueRange[1]))) return null;
	const name = sliceAt(code, indices, 2);
	if (!designated && C_KEYWORDS.has(name)) return null;
	return {
		indent : sliceAt(code, indices, 1),
		slots  : [
			{ axis : designated ? "dotfield" : "name" , text                          : name                      ,                      gapBefore  : ""                        },
			{ axis : "equal"                          ,                          text : "="                       ,                       gapBefore : sliceAt(code, indices, 3) },
			{ axis : "value"                          ,                          text : sliceAt(code, indices, 6) , gapBefore                       : sliceAt(code, indices, 5) },
			{ axis : "comma"                          ,                          text : ","                       ,                       gapBefore : sliceAt(code, indices, 7) },
		],
	};
}

/**
 * Brace bundle row `{1, "alpha", 0x10},` — cell boundaries are cut at the mask's commas and text is taken from
 * `code` at the same coordinates. Commas inside string cells are blanked by the mask, so boundaries hold. Only scalar
 * cells (strings, numbers, identifiers) pass; nesting, assignment or calls inside are refused. The close slot
 * (`}` + trailer) is last in the row, so padding cell columns never creates trailing whitespace.
 */
function groupProfile(code: string, masked: string): RowProfile | null {
	const match = GROUP.exec(masked);
	const indices = match?.indices;
	if (!match || !indices) return null;
	const interior = indices[2];
	const trailer = indices[3];
	if (!interior || !trailer) return null;
	if (GROUP_UNSAFE.test(masked.slice(interior[0], interior[1]))) return null;

	// Cut cell ranges by mask coordinates. Commas inside string cells are spaces in the mask, so they are not boundaries.
	const bounds: Array<{ start: number; end: number }> = [];
	let boundStart = interior[0];
	for (let index = interior[0]; index < interior[1]; index += 1) {
		if (masked[index] === ",") {
			bounds.push({ start: boundStart, end: index });
			boundStart = index + 1;
		}
	}
	bounds.push({ start: boundStart, end: interior[1] });
	if (bounds.length < 2) return null; // a row with a single cell is not a bundle table

	const cells: Array<{ text: string; gap: string; commaGap: string; end: number }> = [];
	for (const bound of bounds) {
		const raw = code.slice(bound.start, bound.end);
		const text = raw.trim();
		if (text === "") return null; // empty cell from consecutive commas or after a trailing comma
		const cellStart = bound.start + raw.indexOf(text);
		if (text.startsWith('"') || text.startsWith("'")) {
			if (!STRING_CELL.test(text)) return null;
		} else if (masked.slice(cellStart, cellStart + text.length) !== text || !SCALAR_CELL.test(text)) {
			return null; // not a scalar if comment or string fragments remain in the cell
		}
		const cellEnd = cellStart + text.length;
		cells.push({ text, gap: code.slice(bound.start, cellStart), commaGap: code.slice(cellEnd, bound.end), end: cellEnd });
	}

	const slots: Slot[] = [{ axis: "open", text: "{", gapBefore: "" }];
	cells.forEach((cell, position) => {
		// The first cell attaches directly to the opening brace (gap ""); other cells get one space after the comma.
		slots.push({ axis: position === 0 ? "cell" : "arg", text: cell.text, gapBefore: cell.gap });
		if (position < cells.length - 1) slots.push({ axis: "comma", text: ",", gapBefore: cell.commaGap });
	});
	slots.push({ axis: "close", text: "}" + sliceAt(code, indices, 3), gapBefore: code.slice(cells[cells.length - 1].end, interior[1]) });
	return { indent: sliceAt(code, indices, 1), slots };
}

export const C_ALIGNER: LineProfiler = {
	language      : "c",
	syntax        : C_SYNTAX,
	// The macro replacement list is the row's last cell, so padding it aligns nothing after it, and putting it on
	// a column axis would leave trailing spaces on comment-less rows, so only the name column is aligned.
	// cell/arg axes of bundle rows are followed by a comma or the close slot, so aligning them never creates trailing whitespace.
	columnAxes    : ["type", "name", "dotfield", "value", "cell", "arg"],
	canonicalGaps : { semicolon: "", comma: "", equal: " ", open: "", cell: "", arg: " ", close: "" },
	profile(code: string, masked: string): RowProfile | null {
		if (code.trimEnd() !== code) return null;
		if (code.endsWith("\\")) return null;
		return macroProfile(code, masked) ?? fieldProfile(code, masked) ?? assignProfile(code, masked) ?? groupProfile(code, masked);
	},
};
