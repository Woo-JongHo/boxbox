/**
 * JavaScript profiler. Accepts repeated rows of plain JavaScript (.js/.mjs/.cjs) as four table row forms:
 * object literal `key: value,`, class field / plain assignment `name = value;`, const assignment `const name = value;`,
 * and bracket bundle row `["alpha", 1, "x"],`.
 * Structure is judged on `masked` (string contents and comments blanked); cell text is sliced from `code` at the same coordinates.
 * Arrow functions (=>), unclosed parentheses, rows with a remaining opening brace, control flow and uncertain rows are not table rows.
 * Bundle rows are rejected when structural symbols remain inside (nesting, assignment, calls), or when they have one cell or an empty cell.
 */
import type { CodeSyntax     } from "../common/code-text.ts"    ;
import type {
              LineProfiler ,
              RowProfile   ,
              Slot         ,
                             } from "../common/table-engine.ts" ;

export const JAVASCRIPT_SYNTAX: CodeSyntax = {
	lineComments  : ["//"],
	blockComments : [{ open: "/*", close: "*/" }],
	strings       : [
		{ open : '"' , close : '"' , escape : true },
		{ open : "'" , close : "'" , escape : true },
		{ open : "`" , close : "`" , escape : true },
	],
	cppRaw        : false,
};

/** Reserved words that cannot lead a row — never mistake control flow or labels for table rows. */
const RESERVED = new Set([
	"await", "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do",
	"else", "enum", "export", "extends", "finally", "for", "function", "if", "import", "in", "instanceof",
	"let", "new", "of", "return", "super", "switch", "this", "throw", "try", "typeof", "var", "void",
	"while", "with", "yield",
]);

const CONST_ROW  = /^([ \t]*)(const)([ \t]+)([A-Za-z_$][\w$]*)(\s*)=(?![=>])(\s*)(.+?)(\s*);$/du      ;
const FIELD_ROW  = /^([ \t]*)([A-Za-z_$][\w$]*)(\s*)=(?![=>])(\s*)(.+?)(\s*);$/du                     ;
const OBJECT_ROW = /^([ \t]*)((?:"[^"]*"|'[^']*'|`[^`]*`|[A-Za-z_$][\w$]*))(\s*):(\s*)(.+?)(\s*),$/du ;
/** Multiple declarations such as `const a = 1, b = 2;` — the second `=` is not an axis, so refuse. */
const DECLARATOR = /,\s*[A-Za-z_$][\w$]*\s*=(?!=)/;

/** Bundle row `[cell, cell, ...]` — split into indent, interior and trailing `,`/`;` tail. */
const BUNDLE_ROW  = /^([ \t]*)\[(.+)\]([,;]?)$/du                                                             ;
/** If these characters remain in the mask inside a bundle, it mixes nesting, assignment, calls or objects — do not attempt decomposition. */
const BUNDLE_JUNK = /[[\]{}()=]/u                                                                             ;
/** String literal form of a bundle cell — accepts "", '' and ``; commas and brackets inside are blanked by the mask. */
const STRING_CELL = /^(?:"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`[^`\\]*(?:\\.[^`\\]*)*`)$/u                  ;
/** Scalar form of a bundle cell — signed decimal numbers and identifiers (including true/false/null/undefined). */
const NUMBER_CELL = /^[+-]?(?:[0-9][0-9_]*(?:\.[0-9_]*)?|\.[0-9_]+)(?:[eE][+-]?[0-9]+)?$/u ;
const IDENT_CELL  = /^[A-Za-z_$][A-Za-z0-9_$]*$/u                                          ;

const CLOSERS: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

/** Checks paren, bracket and brace balance in the mask. String contents are blanked, so only structural symbols count. */
function balanced(masked: string): boolean {
	const stack: string[] = [];
	for (const character of masked) {
		if (character === "(" || character === "[" || character === "{") stack.push(character);
		else if (character in CLOSERS && stack.pop() !== CLOSERS[character]) return false;
	}
	return stack.length === 0;
}

function sliceAt(code: string, indices: RegExpIndicesArray, group: number): string {
	const range = indices[group];
	return range ? code.slice(range[0], range[1]) : "";
}

function constProfile(code: string, masked: string, match: RegExpExecArray): RowProfile | null {
	const indices = match.indices;
	if (!indices) return null;
	const value = sliceAt(masked, indices, 7);
	if (value.includes(";") || DECLARATOR.test(value)) return null;
	const slots: Slot[] = [
		{ axis : "keyword"   , text : sliceAt(code, indices, 2) , gapBefore : ""                        },
		{ axis : "name"      , text : sliceAt(code, indices, 4) , gapBefore : sliceAt(code, indices, 3) },
		{ axis : "equal"     , text : "="                       , gapBefore : sliceAt(code, indices, 5) },
		{ axis : "value"     , text : sliceAt(code, indices, 7) , gapBefore : sliceAt(code, indices, 6) },
		{ axis : "semicolon" , text : ";"                       , gapBefore : sliceAt(code, indices, 8) },
	];
	return { indent: sliceAt(code, indices, 1), slots };
}

function fieldProfile(code: string, masked: string, match: RegExpExecArray): RowProfile | null {
	const indices = match.indices;
	if (!indices) return null;
	if (RESERVED.has(sliceAt(masked, indices, 2))) return null;
	const value = sliceAt(masked, indices, 5);
	if (value.includes(";") || DECLARATOR.test(value)) return null;
	const slots: Slot[] = [
		{ axis : "name"      , text : sliceAt(code, indices, 2) , gapBefore : ""                        },
		{ axis : "equal"     , text : "="                       , gapBefore : sliceAt(code, indices, 3) },
		{ axis : "value"     , text : sliceAt(code, indices, 5) , gapBefore : sliceAt(code, indices, 4) },
		{ axis : "semicolon" , text : ";"                       , gapBefore : sliceAt(code, indices, 6) },
	];
	return { indent: sliceAt(code, indices, 1), slots };
}

function objectProfile(code: string, masked: string, match: RegExpExecArray): RowProfile | null {
	const indices = match.indices;
	if (!indices) return null;
	if (RESERVED.has(sliceAt(masked, indices, 2))) return null;
	const value = sliceAt(masked, indices, 5);
	if (value.includes(";") || DECLARATOR.test(value)) return null;
	const slots: Slot[] = [
		{ axis : "key"   , text : sliceAt(code, indices, 2) , gapBefore : ""                        },
		{ axis : "colon" , text : ":"                       , gapBefore : sliceAt(code, indices, 3) },
		{ axis : "value" , text : sliceAt(code, indices, 5) , gapBefore : sliceAt(code, indices, 4) },
		{ axis : "comma" , text : ","                       , gapBefore : sliceAt(code, indices, 6) },
	];
	return { indent: sliceAt(code, indices, 1), slots };
}

/** Compares the source and mask at the cell position and passes scalars only — refuses when comment or string fragments remain. */
function isScalarCell(masked: string, start: number, text: string): boolean {
	const quote = text[0];
	if (quote === '"' || quote === "'" || quote === "`") return STRING_CELL.test(text);
	if (masked.slice(start, start + text.length) !== text) return false;
	return NUMBER_CELL.test(text) || IDENT_CELL.test(text);
}

/**
 * Bundle row `["alpha", 1, "x"],` — decomposes a single-level bracketed scalar list into open, cell, arg, comma and close axes.
 * Cell boundaries are cut at the mask's commas and text is taken from `code` at the same coordinates, so commas inside strings are not boundaries.
 * Only scalar cells (strings, numbers, identifiers) pass; rows with a single cell or an empty cell are refused.
 */
function bundleProfile(code: string, masked: string, match: RegExpExecArray): RowProfile | null {
	const indices = match.indices        ;
	if (!indices) return null            ;
	const interior = indices[2] ;
	const trailer  = indices[3] ;
	if (!interior || !trailer) return null;
	if (BUNDLE_JUNK.test(masked.slice(interior[0], interior[1]))) return null;

	// Cut cell ranges by mask coordinates. Commas inside string cells are spaces in the mask, so they are not boundaries.
	const bounds: Array<{ start: number; end: number }> = []          ;
	let boundStart                                      = interior[0] ;
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
		const raw  = code.slice(bound.start, bound.end) ;
		const text = raw.trim()                         ;
		if (text === "") return null; // empty cell from consecutive commas or before the closing bracket
		const cellStart = bound.start + raw.indexOf(text)           ;
		if (!isScalarCell(masked, cellStart, text)) return null     ;
		const cellEnd = cellStart + text.length                     ;
		cells.push({ text, gap: code.slice(bound.start, cellStart), commaGap: code.slice(cellEnd, bound.end), end: cellEnd });
	}

	const slots: Slot[] = [{ axis: "open", text: "[", gapBefore: "" }];
	cells.forEach((cell, position) => {
		// The first cell attaches directly to the opening bracket (gap ""); other cells get one space after the comma.
		slots.push({ axis: position === 0 ? "cell" : "arg", text: cell.text, gapBefore: cell.gap });
		if (position < cells.length - 1) slots.push({ axis: "comma", text: ",", gapBefore: cell.commaGap });
	});
	// The close slot is last in the row, so padding the last cell column never creates trailing whitespace.
	slots.push({ axis: "close", text: "]" + sliceAt(code, indices, 3), gapBefore: code.slice(cells[cells.length - 1].end, interior[1]) });
	return { indent: sliceAt(code, indices, 1), slots };
}

function profileLine(code: string, masked: string): RowProfile | null {
	if (masked.includes("=>") || !balanced(masked)) return null;
	const assignment = CONST_ROW.exec(masked);
	if (assignment) return constProfile(code, masked, assignment);
	const field = FIELD_ROW.exec(masked);
	if (field) return fieldProfile(code, masked, field);
	const object = OBJECT_ROW.exec(masked);
	if (object) return objectProfile(code, masked, object);
	const bundle = BUNDLE_ROW.exec(masked);
	if (bundle) return bundleProfile(code, masked, bundle);
	return null;
};

export const JAVASCRIPT_ALIGNER: LineProfiler = {
	language      : "javascript",
	syntax        : JAVASCRIPT_SYNTAX,
	// cell/arg axes of bundle rows are followed by a comma or the close slot, so aligning them never creates trailing whitespace.
	columnAxes    : ["key", "name", "value", "cell", "arg"],
	canonicalGaps : { key: " ", name: " ", value: " ", cell: "", arg: " ", colon: "", comma: "", equal: " ", semicolon: " ", keyword: " ", open: "", close: "" },
	profile       : profileLine,
};
