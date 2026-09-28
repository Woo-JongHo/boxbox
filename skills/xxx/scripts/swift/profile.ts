/**
 * Swift line profiler (light). Structure is judged on `masked` (string contents and comments blanked), and cell
 * text is sliced from `code` at the same coordinates (match.indices from the /d flag). Table rows are limited to
 * four forms.
 *
 * Table forms:
 * 1. Let/var binding   `let name: Type = value` → keyword, name, colon, type, equal, value
 * 2. Let/var binding   `let name = value`       → keyword, name, equal, value
 * 3. Assignment        `name = value`           → name, equal, value
 * 4. Dictionary row    `"key": value,`          → key (with quotes), colon, value, comma
 *
 * Refused (null) when uncertain: rows with remaining brackets or backslashes (calls, containers, closures);
 * decorator, declaration and control-flow rows (func, class, struct, enum, protocol, if, guard, for, …); rows
 * whose value is empty or starts with =; rows with trailing whitespace. Refusal is safe; misrecognition is
 * dangerous. The syntax mask handles nested block comments, multi-line and raw strings, and interpolation
 * content is blanked as part of the string.
 */
import type { CodeSyntax, LineProfiler, RowProfile, Slot } from "../common/table-engine.ts";

export const SWIFT_SYNTAX: CodeSyntax = {
	lineComments  : ["//"],
	blockComments : [{ open: "/*", close: "*/", nested: true }],
	strings       : [
		{ open : '"""' , close : '"""' , escape : true  },
		{ open : '##"' , close : '"##' , escape : false },
		{ open : '#"'  , close : '"#'  , escape : false },
		{ open : '"'   , close : '"'   , escape : true  },
	],
	cppRaw        : false,
};

const INDENT   = "([ \\t]*)"                                                                      ;
const NAME     = "([A-Za-z_][A-Za-z0-9_]*)"                                                       ;
const QUOTED   = "(\"[^\"]*\"|'[^']*')"                                                           ;
const TYPE     = "((?:[A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z_][A-Za-z0-9_]*)*)(?:<[^<>\\n]*>)?\\??)" ;
const GAP      = "(\\s*)"                                                                         ;
const VALUE    = "(.+?)"                                                                          ;
const OPT_TAIL = "(\\s*)"                                                                         ;

/** Statement starts that cannot be table rows — declarations, control flow, attributes. */
const RESERVED_START = /^(?:@|import|class|struct|enum|protocol|extension|func|init|deinit|actor|typealias|operator|subscript|associatedtype|static|if|guard|else|for|while|repeat|switch|case|default|do|catch|throw|throws|rethrows|try|return|break|continue|fallthrough|defer|where|willSet|didSet|async|await|self|super)\b/;

const LET_TYPED  = new RegExp(`^${INDENT}(let|var)${GAP}${NAME}${GAP}:${GAP}${TYPE}${GAP}=${GAP}${VALUE}${OPT_TAIL}$`, "du") ;
const LET_PLAIN  = new RegExp(`^${INDENT}(let|var)${GAP}${NAME}${GAP}=${GAP}${VALUE}${OPT_TAIL}$`, "du")                    ;
const ASSIGNED   = new RegExp(`^${INDENT}${NAME}${GAP}=${GAP}${VALUE}${OPT_TAIL}$`, "du")                                   ;
const DICT_ROW   = new RegExp(`^${INDENT}${QUOTED}${GAP}:${GAP}${VALUE}${GAP},$`, "du")                                     ;
/** Any bracket, brace or backslash left in the mask means a call, container, closure or continuation — do not attempt decomposition. */
const UNSAFE     = /[(){}[\]\\]/u                                                                                           ;

function slotAt(code: string, match: RegExpExecArray, group: number): string {
	const range = match.indices?.[group];
	return range ? code.slice(range[0], range[1]) : "";
}

/** Cuts the value cell by source coordinates and refuses uncertain values. It must not be empty or start with =. */
function valueSlot(code: string, match: RegExpExecArray, gapGroup: number, textGroup: number): Slot | null {
	const gapRange  = match.indices?.[gapGroup ] ;
	const textRange = match.indices?.[textGroup] ;
	if (!gapRange || !textRange) return null      ;
	const text = code.slice(textRange[0], textRange[1]) ;
	if (text.trim() === "" || text.startsWith("=")) return null ;
	return { axis: "value", text, gapBefore: code.slice(gapRange[0], gapRange[1]) } ;
}

function profileSwift(code: string, masked: string): RowProfile | null {
	const trimmed = masked.trim()                                    ;
	if (trimmed === "" || trimmed.startsWith("@") || RESERVED_START.test(trimmed)) return null ;
	if (UNSAFE.test(masked)) return null                             ;

	const letTyped = LET_TYPED.exec(masked)                          ;
	if (letTyped) {
		if (slotAt(code, letTyped, 11) !== "") return null           ;
		const value = valueSlot(code, letTyped, 9, 10)          ;
		if (!value) return null                                      ;
		return {
			indent : slotAt(code, letTyped, 1)                       ,
			slots  : [
				{ axis: "keyword", text: slotAt(code, letTyped, 2), gapBefore: "" },
				{ axis: "name"    , text: slotAt(code, letTyped, 4), gapBefore: slotAt(code, letTyped, 3) },
				{ axis: "colon"   , text: ":"                     , gapBefore: slotAt(code, letTyped, 5) },
				{ axis: "type"    , text: slotAt(code, letTyped, 7), gapBefore: slotAt(code, letTyped, 6) },
				{ axis: "equal"   , text: "="                     , gapBefore: slotAt(code, letTyped, 8) },
				value                                                              ,
			],
		}                                                                ;
	}

	const letPlain = LET_PLAIN.exec(masked)                          ;
	if (letPlain) {
		if (slotAt(code, letPlain, 8) !== "") return null            ;
		const value = valueSlot(code, letPlain, 6, 7)           ;
		if (!value) return null                                      ;
		return {
			indent : slotAt(code, letPlain, 1)                       ,
			slots  : [
				{ axis: "keyword", text: slotAt(code, letPlain, 2), gapBefore: "" },
				{ axis: "name"    , text: slotAt(code, letPlain, 4), gapBefore: slotAt(code, letPlain, 3) },
				{ axis: "equal"   , text: "="                     , gapBefore: slotAt(code, letPlain, 5) },
				value                                                              ,
			],
		}                                                                ;
	}

	const dictRow = DICT_ROW.exec(masked)                            ;
	if (dictRow) {
		const value = valueSlot(code, dictRow, 4, 5)         ;
		if (!value) return null                                      ;
		return {
			indent : slotAt(code, dictRow, 1)                        ,
			slots  : [
				{ axis: "key"  , text: slotAt(code, dictRow, 2), gapBefore: ""                        },
				{ axis: "colon", text: ":"                      , gapBefore: slotAt(code, dictRow, 3) },
				value                                                                                 ,
				{ axis: "comma", text: ","                      , gapBefore: slotAt(code, dictRow, 6) },
			],
		}                                                             ;
	}

	const assigned = ASSIGNED.exec(masked)                           ;
	if (assigned) {
		if (slotAt(code, assigned, 6) !== "") return null            ;
		const value = valueSlot(code, assigned, 4, 5)        ;
		if (!value) return null                                      ;
		return {
			indent : slotAt(code, assigned, 1)                       ,
			slots  : [
				{ axis: "name"  , text: slotAt(code, assigned, 2), gapBefore: ""                      },
				{ axis: "equal" , text: "="                     , gapBefore: slotAt(code, assigned, 3) },
				value                                                                                 ,
			],
		}                                                             ;
	}

	return null                                                      ;
}

export const SWIFT_ALIGNER: LineProfiler = {
	language   : "swift",
	syntax     : SWIFT_SYNTAX,
	columnAxes : ["name", "key", "type", "value"],
	// Swift convention: colon and comma attach to the cell; keyword and equal get one space.
	canonicalGaps : { keyword: " ", name: " ", key: " ", type: " ", value: " ", colon: "", equal: " ", comma: "" },
	profile       : profileSwift,
};
