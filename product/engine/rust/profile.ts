/**
 * Rust line profiler. Structure is judged on `masked` (string contents and comments blanked), and cell text
 * is sliced from the original `code` at the same coordinates (via match.indices from the /d flag).
 *
 * Accepted table rows and axes:
 * - struct field `name: Type,`                   → name, type columns with colon and comma separators
 * - let binding  `let name: Type = value;`       → name, type, value columns with keyword, colon, equal, semicolon
 * - let binding  `let name = value;`             → name, value columns with keyword, equal, semicolon
 * - enum variant `Variant(u32),`/`Variant = 5,`  → name, paren, value columns with equal and comma separators
 * - match arm    `Pattern => Action,`            → pattern, action columns with arrow and comma separators
 * - bundle row   `("alpha", 1, "x"),`/`[1, 22],` → cell/arg columns with open, comma, close separators
 *
 * Refused: rows starting with declaration or control keywords such as fn, struct, impl, enum, mod; #[attribute]
 * lines; macro_rules!; opening rows ending in `{`, `(` or `[`; rows with a string hidden in a gap; rows whose type
 * is uncertain; empty pattern, action or value cells. Enum variants are distinguished from function calls by the
 * UpperCamelCase convention. Bundle rows accept only `(…)`/`[…]` rows with two or more cells, and are refused when
 * nesting or assignment remains inside or a cell is a path, lifetime or type name.
 */
import type { CodeSyntax     } from "@/common/code-text.ts"    ;
import type {
              LineProfiler ,
              RowProfile   ,
              Slot         ,
                             } from "@/common/table-engine.ts" ;

const RUST_SYNTAX: CodeSyntax = {
	lineComments  : ["//"]                                    ,
	blockComments : [{ open: "/*", close: "*/" }]             ,
	strings       : [{ open: '"', close: '"', escape: true }] ,
	rustChars     : true                                      ,
	cppRaw        : false                                     ,
};

/** Rows starting with these tokens are declarations or control flow, not table rows. */
const RUST_HEAD_KEYWORDS = new Set([
	"as",       "async",    "await",
	"break",    "const",    "continue",
	"crate",    "dyn",      "else",
	"enum",     "extern",   "fn",
	"for",      "if",       "impl",
	"in",       "loop",     "macro_rules",
	"match",    "mod",      "move",
	"pub",      "ref",      "return",
	"static",   "struct",   "trait",
	"type",     "union",    "unsafe",
	"use",      "where",    "while",
]);

const INDENT   = "([ \\t]*)"                                           ;
const GAP      = "([ \\t]+)"                                           ;
const OPT_GAP  = "([ \\t]*)"                                           ;
const NAME     = "([A-Za-z_][A-Za-z0-9_]*)"                            ;
const LIFETIME = "'[A-Za-z_][A-Za-z0-9_]*"                             ;
const REF      = `&(?:[ \\t]*${LIFETIME})?[ \\t]*(?:mut[ \\t]+)?`      ;
const PATH     = "[A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*" ;
const GENERIC  = "<[^<>\\n]*(?:<[^<>\\n]*>[^<>\\n]*)*>"                ;
const BRACKET  = "\\[[^\\[\\]\\n]*\\]"                                 ;
const TUPLE    = "\\([^\\(\\)\\n]*\\)"                                 ;
// A safe subset of Rust type expressions: reference and lifetime prefixes, paths, one level of generics, slices and tuples only.
const TYPE      = `(?:${REF})?(?:${PATH}(?:${GENERIC})?|${BRACKET}|${TUPLE})`;
// Statements end at ;, but a ; inside brackets as in [0; 4] belongs to the value. String contents are already blank in masked.
const VALUE   = "((?:[^;\\n]|\\[[^\\[\\]\\n]*\\])*?)" ;
const PATTERN = "((?:[^=\\n]|=(?!>))*?)"              ;
const PAREN   = "(\\([^\\(\\)\\n]*\\))"               ;

// Paren/bracket bundle rows — cell boundaries are cut at the mask's commas; the only bracket pairs are () and [].
const GROUP        = /^([ \t]*)([([])(.*)([)\]])(,)?[ \t]*$/du                                                                                                                                      ;
const STRING_CELL  = /^"(?:[^"\\]|\\.)*"$/u                                                                                                                                                         ;
const CHAR_CELL    = /^'(?:[^'\\]|\\.)'$/u                                                                                                                                                          ;
const SCALAR_CELL  = /^(?:[+-]?(?:0[bB][01_]+|0[oO][0-7_]+|0[xX][0-9A-Fa-f_]+|[0-9][0-9_]*(?:\.[0-9_]+)?(?:[eE][+-]?[0-9]+)?)(?:[iu](?:8|16|32|64|128|size)|f(?:32|64))?|[A-Za-z_][A-Za-z0-9_]*)$/u ;
const GROUP_UNSAFE = /[(){}[\]=>]/u                                                                                                                                                                 ;
/** The closing symbol matching a bundle row's opening symbol — mismatched pairs such as `[a, b)` are refused. */
const CLOSE_OF: Record<string, string> = { "(": ")", "[": "]" };
/** A primitive type name in a cell is a type, not a value — refuse type rows such as `("a", u32)`. */
const TYPE_CELL = new Set([
	"bool", "char", "str",
	"f32",  "f64",
	"i8",   "i16",  "i32", "i64", "i128", "isize",
	"u8",   "u16",  "u32", "u64", "u128", "usize",
]);

const STRUCT_FIELD = new RegExp(`^${INDENT}${NAME}${OPT_GAP}:${OPT_GAP}(${TYPE})${OPT_GAP}(,)?[ \\t]*$`, "du")                                                      ;
const LET_TYPED    = new RegExp(`^${INDENT}(let(?:[ \\t]+mut)?)${GAP}${NAME}${OPT_GAP}:${OPT_GAP}(${TYPE})${GAP}=(?!=)${OPT_GAP}${VALUE}${OPT_GAP};[ \\t]*$`, "du") ;
const LET_PLAIN    = new RegExp(`^${INDENT}(let(?:[ \\t]+mut)?)${GAP}${NAME}${GAP}=(?!=)${OPT_GAP}${VALUE}${OPT_GAP};[ \\t]*$`, "du")                               ;
const ENUM_VARIANT = new RegExp(`^${INDENT}${NAME}${OPT_GAP}${PAREN}?(?:${OPT_GAP}=(?![=>])${OPT_GAP}${VALUE})?${OPT_GAP}(,)?[ \\t]*$`, "du")                       ;
const MATCH_ARM    = new RegExp(`^${INDENT}${PATTERN}${OPT_GAP}=>${OPT_GAP}${VALUE}${OPT_GAP}(,)?[ \\t]*$`, "du")                                                   ;

const cellOf = (code: string, indices: RegExpIndicesArray, group: number): string => {
	const range = indices[group];
	return range === undefined ? "" : code.slice(range[0], range[1]);
};

/** Returns the source at the gap coordinates only if it is pure whitespace — a string hidden in a gap refuses the row. */
const gapOf = (code: string, indices: RegExpIndicesArray, group: number): string | null => {
	const range = indices[group];
	if (range === undefined) return "";
	const gap = code.slice(range[0], range[1]);
	return /[^ \t]/u.test(gap) ? null : gap;
};

const gapsOf = (code: string, indices: RegExpIndicesArray, groups: readonly number[]): readonly string[] | null => {
	const gaps: string[] = [];
	for (const group of groups) {
		const gap = gapOf(code, indices, group);
		if (gap === null) return null;
		gaps.push(gap);
	}
	return gaps;
};

/** `name: Type,` — 1 indent, 2 name, 3 gap, 4 gap, 5 type, 6 gap, 7 comma. */
const fieldRow = (code: string, indices: RegExpIndicesArray): RowProfile | null => {
	const gaps = gapsOf(code, indices, [3, 4, 6]);
	if (gaps === null) return null;
	const slots: Slot[] = [
		{ axis : "name"  , text : cellOf(code, indices, 2) , gapBefore : ""      },
		{ axis : "colon" , text : ":"                      , gapBefore : gaps[0] },
		{ axis : "type"  , text : cellOf(code, indices, 5) , gapBefore : gaps[1] },
	];
	if (indices[7] !== undefined) slots.push({ axis: "comma", text: ",", gapBefore: gaps[2] });
	return { indent: cellOf(code, indices, 1), slots };
};

/** `let name: Type = value;` — 1 indent, 2 keyword, 3 gap, 4 name, 5 gap, 6 gap, 7 type, 8 gap, 9 gap, 10 value, 11 gap. */
const letTypedRow = (code: string, indices: RegExpIndicesArray): RowProfile | null => {
	const gaps = gapsOf(code, indices, [3, 5, 6, 8, 9, 11]);
	if (gaps === null) return null;
	return {
		indent: cellOf(code, indices, 1),
		slots : [
			{ axis : "keyword"   , text : cellOf(code, indices, 2)  , gapBefore : ""      },
			{ axis : "name"      , text : cellOf(code, indices, 4)  , gapBefore : gaps[0] },
			{ axis : "colon"     , text : ":"                       , gapBefore : gaps[1] },
			{ axis : "type"      , text : cellOf(code, indices, 7)  , gapBefore : gaps[2] },
			{ axis : "equal"     , text : "="                       , gapBefore : gaps[3] },
			{ axis : "value"     , text : cellOf(code, indices, 10) , gapBefore : gaps[4] },
			{ axis : "semicolon" , text : ";"                       , gapBefore : gaps[5] },
		],
	};
};

/** `let name = value;` — 1 indent, 2 keyword, 3 gap, 4 name, 5 gap, 6 gap, 7 value, 8 gap. */
const letPlainRow = (code: string, indices: RegExpIndicesArray): RowProfile | null => {
	const gaps = gapsOf(code, indices, [3, 5, 6, 8]);
	if (gaps === null) return null;
	return {
		indent: cellOf(code, indices, 1),
		slots : [
			{ axis : "keyword"   , text : cellOf(code, indices, 2) , gapBefore : ""      },
			{ axis : "name"      , text : cellOf(code, indices, 4) , gapBefore : gaps[0] },
			{ axis : "equal"     , text : "="                      , gapBefore : gaps[1] },
			{ axis : "value"     , text : cellOf(code, indices, 7) , gapBefore : gaps[2] },
			{ axis : "semicolon" , text : ";"                      , gapBefore : gaps[3] },
		],
	};
};

/** `Variant(u32),`/`Variant = 5,` — 1 indent, 2 name, 3 gap, 4 paren, 5 gap, 6 gap, 7 value, 8 gap, 9 comma.
 * Gap 3 extends to before = when there is no paren, and to before the comma when there is neither paren nor value. */
const variantRow = (code: string, indices: RegExpIndicesArray): RowProfile | null => {
	const name = cellOf(code, indices, 2);
	// Variant names are identified by the UpperCamelCase convention — lowercase may be a function call, so refuse.
	if (!/^[A-Z]/u.test(name))           return null;
	const gaps = gapsOf(code, indices, [3, 5, 6, 8]);
	if (gaps === null)                   return null;
	const hasParen = indices[4] !== undefined ;
	const hasValue = indices[7] !== undefined ;
	const value    = cellOf(code, indices, 7) ;
	if (hasValue && value.trim() === "") return null;
	const slots: Slot[] = [{ axis: "name", text: name, gapBefore: "" }];
	if (hasParen) slots.push({ axis: "paren", text: cellOf(code, indices, 4), gapBefore: gaps[0] });
	if (hasValue) {
		slots.push({ axis: "equal", text: "=", gapBefore: hasParen ? gaps[1] : gaps[0] });
		slots.push({ axis: "value", text: value, gapBefore: gaps[2] });
	}
	if (indices[9] !== undefined) slots.push({ axis: "comma", text: ",", gapBefore: hasParen || hasValue ? gaps[3] : gaps[0] });
	return { indent: cellOf(code, indices, 1), slots };
};

/** `Pattern => Action,` — 1 indent, 2 pattern, 3 gap, 4 gap, 5 action, 6 gap, 7 comma. */
const armRow = (code: string, indices: RegExpIndicesArray): RowProfile | null => {
	const gaps = gapsOf(code, indices, [3, 4, 6]);
	if (gaps === null) return null;
	const pattern = cellOf(code, indices, 2) ;
	const action  = cellOf(code, indices, 5) ;
	if (pattern.trim() === "" || action.trim() === "") return null;
	const slots: Slot[] = [
		{ axis : "pattern" , text : pattern , gapBefore : ""      },
		{ axis : "arrow"   , text : "=>"    , gapBefore : gaps[0] },
		{ axis : "action"  , text : action  , gapBefore : gaps[1] },
	];
	if (indices[7] !== undefined) slots.push({ axis: "comma", text: ",", gapBefore: gaps[2] });
	return { indent: cellOf(code, indices, 1), slots };
};

/**
 * Paren bundle rows `("alpha", 1, "x"),` and `[1, 22],` — cell boundaries are cut at the mask's commas and text is
 * taken from `code` at the same coordinates. Commas inside string/char cells are blanked by the mask, so boundaries
 * hold. Only scalar cells (strings, chars, numbers, identifiers) pass; path, lifetime and type-name cells are refused.
 * The opening symbol and the closing symbol + `,` are structural axes, not columns, so padding cell columns never
 * creates trailing whitespace; the symbols are part of the axis names, so paren rows and bracket rows never share a table even at the same arity.
 */
function bundleProfile(code: string, masked: string): RowProfile | null {
	const match   = GROUP.exec(masked) ;
	const indices = match?.indices     ;
	if (!match || !indices)                                          return null;
	const interior   = indices[3] ;
	const openRange  = indices[2] ;
	const closeRange = indices[4] ;
	if (!interior || !openRange || !closeRange)                      return null;
	const open = code.slice(openRange[0], openRange[1]);
	if (CLOSE_OF[open] !== code.slice(closeRange[0], closeRange[1])) return null;
	if (GROUP_UNSAFE.test(masked.slice(interior[0], interior[1])))   return null; // row with nesting, assignment or slice type remaining

	// Cut cell ranges by mask coordinates. Commas inside string/char cells are spaces in the mask, so they are not boundaries.
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
		const text = raw .trim ()                       ;
		if (text === "") return null; // empty cell from consecutive commas or after a trailing comma
		const cellStart = bound.start + raw.indexOf(text);
		if (text.startsWith('"') || text.startsWith("'")) {
			// String/char cells are blanked by the mask, so check only the source form — a `'a` lifetime has no close and is refused.
			if (!STRING_CELL.test(text) && !CHAR_CELL.test(text)) return null;
		} else if (masked.slice(cellStart, cellStart + text.length) !== text || !SCALAR_CELL.test(text) || TYPE_CELL.has(text)) {
			return null; // not a scalar value if comment/string fragments remain or it is a path or type name
		}
		const cellEnd = cellStart + text.length;
		cells.push({ text, gap: code.slice(bound.start, cellStart), commaGap: code.slice(cellEnd, bound.end), end: cellEnd });
	}

	const [openAxis, closeAxis] = open === "(" ? ["parenOpen", "parenClose"] : ["bracketOpen", "bracketClose"];
	const slots: Slot[] = [{ axis: openAxis, text: open, gapBefore: "" }];
	cells.forEach((cell, position) => {
		// The first cell attaches directly to the opening symbol (gap ""); other cells get one space after the comma.
		slots.push({ axis: position === 0 ? "cell" : "arg", text: cell.text, gapBefore: cell.gap });
		if (position < cells.length - 1) slots.push({ axis: "comma", text: ",", gapBefore: cell.commaGap });
	});
	const closeEnd = indices[5] ? indices[5][1] : closeRange[1];
	slots.push({ axis: closeAxis, text: code.slice(closeRange[0], closeEnd), gapBefore: code.slice(cells[cells.length - 1].end, interior[1]) });
	return { indent: cellOf(code, indices, 1), slots };
}

export const RUST_ALIGNER: LineProfiler = {
	language   : "rust",
	syntax     : RUST_SYNTAX,
	// cell/arg axes of bundle rows are followed by a comma or the close slot, so aligning them never creates trailing whitespace.
	columnAxes : ["action", "arg", "cell", "name", "paren", "pattern", "type", "value"],
	canonicalGaps : {
		// Rust convention: colon, comma, semicolon and paren attach to the cell; equal and arrow get one space.
		colon     : ""  ,
		comma     : ""  ,
		semicolon : ""  ,
		paren     : ""  ,
		arrow     : " " ,
		equal     : " " ,
		keyword   : " " ,
		name      : " " ,
		type      : " " ,
		value     : " " ,
		pattern   : " " ,
		action    : " " ,
		// Bundle rows attach the first cell to the opening symbol and attach the closing symbol + `,` too, so they share the cell column.
		cell         : ""  ,
		arg          : " " ,
		parenOpen    : ""  ,
		parenClose   : ""  ,
		bracketOpen  : ""  ,
		bracketClose : ""  ,
	},
	profile(code: string, masked: string): RowProfile | null {
		const tail = code.trimEnd();
		if (tail === "" || /[[({]$/u.test(tail)) return null;
		if (/^[ \t]*#/u.test(code))              return null;
		const head = masked.trimStart().match(/[A-Za-z_][A-Za-z0-9_]*/u)?.[0] ?? "";
		if (RUST_HEAD_KEYWORDS.has(head))        return null;

		const field = STRUCT_FIELD.exec(masked);
		if (field?.indices)                      return fieldRow(code, field.indices);

		const letTyped = LET_TYPED.exec(masked);
		if (letTyped?.indices)                   return letTypedRow(code, letTyped.indices);

		const letPlain = LET_PLAIN.exec(masked);
		if (letPlain?.indices)                   return letPlainRow(code, letPlain.indices);

		const variant = ENUM_VARIANT.exec(masked);
		if (variant?.indices)                    return variantRow(code, variant.indices);

		const arm = MATCH_ARM.exec(masked);
		if (arm?.indices)                        return armRow(code, arm.indices);

		const bundle = bundleProfile(code, masked);
		if (bundle)                              return bundle;

		return null;
	},
};
