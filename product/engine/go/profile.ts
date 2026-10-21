/**
 * Go line profiler. Structure is judged on `masked` (string contents and comments blanked), and cell text
 * is sliced from the original `code` at the same coordinates (via match.indices from the /d flag).
 *
 * Accepted table rows and axes:
 * - struct field  `Name Type `json:"name"``        → name, type, tag columns
 * - const/var row `Name = value`/`Name Type = value` → name, (type), value columns with equal separator
 * - map literal   `key: value,`                    → key, value columns with colon and comma separators
 * - import row    `alias "pkg/path"` / `"pkg/path"` → alias (optional), path columns
 * - bundle row    `{Kind, 22, "x"},`               → cell columns with open, comma, close separators
 *
 * Refused: rows starting with keywords such as func, type, if, for, switch, go, defer; opening rows ending in
 * `{`, `(` or `[`; rows with a string hidden in a gap; rows whose type is uncertain, such as func literals and
 * anonymous struct/interface; bundle rows with keys, nesting, calls or assignment remaining.
 */
import type { CodeSyntax     } from "@/common/code-text.ts"    ;
import type {
              LineProfiler ,
              RowProfile   ,
              Slot         ,
                             } from "@/common/table-engine.ts" ;

const GO_SYNTAX: CodeSyntax = {
	lineComments  : ["//"],
	blockComments : [{ open: "/*", close: "*/" }],
	strings       : [
		{ open : '"' , close : '"' , escape : true  },
		{ open : "'" , close : "'" , escape : true  },
		{ open : "`" , close : "`" , escape : false },
	],
	cppRaw        : false,
};

/** Rows starting with these tokens are declarations or control flow, not table rows. */
const GO_KEYWORDS = new Set([
	"break",     "case",     "chan",
	"const",     "continue", "default",
	"defer",     "else",     "fallthrough",
	"for",       "func",     "go",
	"goto",      "if",       "import",
	"interface", "map",      "package",
	"range",     "return",   "select",
	"struct",    "switch",   "type",
	"var",
]);

// A safe subset of Go type expressions: map[K], pointer, slice and array prefixes, qualified and generic
// names, and chan direction suffixes only. func and anonymous struct/interface are refused as uncertain.
const TYPE_PREFIX = "(?:map\\[[^\\[\\]\\s]*\\]|\\*|\\[\\]|\\[\\d+\\])*"                                                     ;
const TYPE_CORE   = "[A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z_][A-Za-z0-9_]*)*(?:\\[[^\\[\\]]*\\])?"                             ;
const GO_TYPE     = `${TYPE_PREFIX}(?:${TYPE_CORE}|(?:<-[ \\t]*|)chan(?:[ \\t]*<-|)(?:[ \\t]+${TYPE_PREFIX}${TYPE_CORE}|))` ;
const INDENT      = "([ \\t]*)"                                                                                             ;
const GAP         = "([ \\t]+)"                                                                                             ;
const TAG         = "(\\x60[^\\x60\\n]*\\x60)"                                                                              ;
const KEY         = `(?:${TYPE_CORE}|\\x60[^\\x60\\n]*\\x60|"[^"\\n]*")`                                                    ;

const FIELD_TAGGED = new RegExp(`^${INDENT}([A-Za-z_][A-Za-z0-9_]*)${GAP}(${GO_TYPE})${GAP}${TAG}[ \\t]*$`                   , "du") ;
const FIELD_PLAIN  = new RegExp(`^${INDENT}([A-Za-z_][A-Za-z0-9_]*)${GAP}(${GO_TYPE})[ \\t]*$`                               , "du") ;
const CONST_TYPED  = new RegExp(`^${INDENT}([A-Za-z_][A-Za-z0-9_]*)${GAP}(${GO_TYPE})${GAP}=(?!=)([ \\t]*)([^\\n]+?)[ \\t]*$`, "du") ;
const CONST_PLAIN  = new RegExp(`^${INDENT}([A-Za-z_][A-Za-z0-9_]*)${GAP}=(?!=)([ \\t]*)([^\\n]+?)[ \\t]*$`                  , "du") ;
const MAP_ROW      = new RegExp(`^${INDENT}(${KEY})([ \\t]*):(?!=)([ \\t]*)([^\\n]+?)([ \\t]*)(,)?[ \\t]*$`                  , "du") ;
const IMPORT_ALIAS = new RegExp(`^${INDENT}([A-Za-z_.][A-Za-z0-9_.]*)${GAP}("[^"\\n]*")[ \\t]*$`                             , "du") ;
const IMPORT_PLAIN = new RegExp(`^${INDENT}("[^"\\n]*")[ \\t]*$`                                                             , "du") ;

/** `{ cell , cell ... } trailer` — trailer holds the following `,`, `;` or nothing verbatim. */
const GROUP = /^([ \t]*)\{(.*)\}([,;]?)[ \t]*$/du;
/** String/rune literal form of a bundle cell — commas and braces inside are blanked by the mask. */
const STRING_CELL = /^"(?:[^"\\]|\\.)*"$|^'(?:[^'\\]|\\.)*'$|^\x60[^\x60\n]*\x60$/u;
/** Scalar form of a bundle cell — signed decimal and 0x hex numbers, identifiers and paths (pkg.Path). */
const SCALAR_CELL = /^(?:[+-]?(?:0[xX][0-9A-Fa-f_]+|[0-9][0-9_]*(?:\.[0-9_]*)?(?:[eE][+-]?[0-9]+)?)|[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)$/u;
/** If these characters remain in the mask inside a bundle row, it involves keys, nesting, calls or assignment — do not attempt decomposition. */
const GROUP_UNSAFE = /[{}()[\]:=&]/u;
/** func in a bundle cell starts a function literal or type, so it is not a scalar. */
const GROUP_FUNC = /(?:^|[^A-Za-z0-9_])func(?:[^A-Za-z0-9_]|$)/u;

interface Column {
	readonly axis : string;
	/** Mask regex group number used to cut the cell text. Separator axes use text directly. */
	readonly cell ?: number;
	/** Fixed text for separator axes such as colon, equal, comma. */
	readonly text ?: string;
	/** Group number used to cut the original gap. The first column has no gap. */
	readonly gap  ?: number;
}

const cellOf = (code: string, indices: RegExpIndicesArray, group: number): string => {
	const range = indices[group];
	return range === undefined ? "" : code.slice(range[0], range[1]);
};

/** Checks the source at the gap coordinates and returns it only if it is pure whitespace — a hidden string refuses the row. */
const gapOf = (code: string, indices: RegExpIndicesArray, group: number): string | null => {
	const range = indices[group];
	if (range === undefined) return "";
	const gap = code.slice(range[0], range[1]);
	return /[^ \t]/u.test(gap) ? null : gap;
};

const rowFrom = (code: string, indices: RegExpIndicesArray, columns: readonly Column[]): RowProfile | null => {
	const slots: Slot[] = [];
	for (const column of columns) {
		const gap = column.gap === undefined ? "" : gapOf(code, indices, column.gap);
		if (gap === null) return null;
		slots.push({ axis: column.axis, text: column.text ?? cellOf(code, indices, column.cell ?? 0), gapBefore: gap });
	}
	return { indent: cellOf(code, indices, 1), slots };
};

/**
 * Brace bundle row `{Kind, 22, "x"},` — cell boundaries are cut at the mask's commas and text is taken
 * from `code` at the same coordinates. Commas inside string cells are blanked by the mask, so boundaries hold.
 * Only scalar cells (strings, runes, numbers, identifiers, paths) pass; keys, nesting, calls or assignment inside
 * are refused. The close slot (`}` + trailer) is last in the row, so padding cell columns never creates trailing whitespace.
 */
function bundleProfile(code: string, masked: string): RowProfile | null {
	const match   = GROUP.exec(masked) ;
	const indices = match?.indices     ;
	if (!match || !indices)                                               return null;
	const interior = indices[2] ;
	const trailer  = indices[3] ;
	if (!interior || !trailer)                                            return null;
	const interiorText = masked.slice(interior[0], interior[1]);
	if (GROUP_UNSAFE.test(interiorText) || GROUP_FUNC.test(interiorText)) return null;

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
		const text = raw .trim ()                       ;
		if (text === "") return null; // empty cell from consecutive commas or after a trailing comma
		const cellStart = bound.start + raw.indexOf(text);
		if (text.startsWith('"') || text.startsWith("'") || text.startsWith("`")) {
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
	slots.push({ axis: "close", text: "}" + cellOf(code, indices, 3), gapBefore: code.slice(cells[cells.length - 1].end, interior[1]) });
	return { indent: cellOf(code, indices, 1), slots };
}

export const GO_ALIGNER: LineProfiler = {
	language   : "go",
	syntax     : GO_SYNTAX,
	// cell/arg axes of bundle rows are followed by a comma or the close slot, so aligning them never creates trailing whitespace.
	columnAxes : ["name", "type", "tag", "alias", "path", "key", "value", "cell", "arg"],
	canonicalGaps : {
		// Go convention: colon and comma attach to the cell; equal gets one space. Other axes use the default gap " ".
		// Bundle rows attach the first cell to the opening brace and attach close too, so the closing brace shares the cell width.
		colon : "",
		comma : "",
		equal : " ",
		open  : "",
		cell  : "",
		arg   : " ",
		close : "",
	},
	profile(code: string, masked: string): RowProfile | null {
		const tail = code.trimEnd();
		if (tail === "" || /[{([]$/u.test(tail)) return null;
		const head = masked.trimStart().match(/[A-Za-z_][A-Za-z0-9_]*/u)?.[0] ?? "";
		if (GO_KEYWORDS.has(head)) return null;

		const tagged = FIELD_TAGGED.exec(masked);
		if (tagged?.indices) {
			return rowFrom(code, tagged.indices, [
				{ axis : "name" , cell : 2           },
				{ axis : "type" , cell : 4 , gap : 3 },
				{ axis : "tag"  , cell : 6 , gap : 5 },
			]);
		}

		const typedConst = CONST_TYPED.exec(masked);
		if (typedConst?.indices) {
			return rowFrom(code, typedConst.indices, [
				{ axis : "name"  , cell : 2             },
				{ axis : "type"  , cell : 4   , gap : 3 },
				{ axis : "equal" , text : "=" , gap : 5 },
				{ axis : "value" , cell : 7   , gap : 6 },
			]);
		}

		const plainConst = CONST_PLAIN.exec(masked);
		if (plainConst?.indices) {
			return rowFrom(code, plainConst.indices, [
				{ axis : "name"  , cell : 2             },
				{ axis : "equal" , text : "=" , gap : 3 },
				{ axis : "value" , cell : 5   , gap : 4 },
			]);
		}

		const plainField = FIELD_PLAIN.exec(masked);
		if (plainField?.indices) {
			return rowFrom(code, plainField.indices, [
				{ axis: "name", cell: 2 },
				{ axis: "type", cell: 4, gap: 3 },
			]);
		}

		const mapRow = MAP_ROW.exec(masked);
		if (mapRow?.indices) {
			const columns: Column[] = [
				{ axis : "key"   , cell : 2             },
				{ axis : "colon" , text : ":" , gap : 3 },
				{ axis : "value" , cell : 5   , gap : 4 },
			];
			if (mapRow.indices[7] !== undefined) columns.push({ axis: "comma", text: ",", gap: 6 });
			return rowFrom(code, mapRow.indices, columns);
		}

		const importAlias = IMPORT_ALIAS.exec(masked);
		if (importAlias?.indices) {
			return rowFrom(code, importAlias.indices, [
				{ axis: "alias", cell: 2 },
				{ axis: "path" , cell: 4, gap: 3 },
			]);
		}

		const importPlain = IMPORT_PLAIN.exec(masked);
		if (importPlain?.indices) {
			return rowFrom(code, importPlain.indices, [
				{ axis: "path", cell: 2 },
			]);
		}

		const bundle = bundleProfile(code, masked);
		if (bundle) return bundle;

		return null;
	},
};
