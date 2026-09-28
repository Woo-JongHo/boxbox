/**
 * Java line profiler. Structure is judged on `masked` (string contents and comments blanked), and cell text
 * is sliced from `code` at the same coordinates (match.indices from the /d flag). Table rows are limited to five forms.
 *
 * Table forms:
 * 1. Modified initialized field `private static final int MAX_SIZE = 10;`
 * 2. Modified declared field    `private Type name;`
 * 3. Unmodified initialization  `int count = 0;`
 * 4. Enum constant              `NAME(1, "x"),` / `NAME,`
 * 5. Brace bundle row           `{"alpha", 1, "x"},` (2+ cells; one table per arity)
 *
 * Refused (null) when uncertain: bundle rows with nesting, assignment, calls or indexing inside; annotation
 * lines (starting with @); control-flow or declaration keyword rows; method signatures with parentheses
 * (except form 4's argument list); rows with an empty value or more than one `;` outside strings.
 */
import type { CodeSyntax     } from "../common/code-text.ts"    ;
import type {
              LineProfiler ,
              RowProfile   ,
              Slot         ,
                             } from "../common/table-engine.ts" ;

export const JAVA_SYNTAX: CodeSyntax = {
	lineComments  : ["//"],
	blockComments : [{ open: "/*", close: "*/" }],
	strings       : [{ open: '"', close: '"', escape: true }],
	cppRaw        : false,
};

const IDENTIFIER = "[A-Za-z_$][A-Za-z0-9_$]*"                                     ;
const TYPE       = `${IDENTIFIER}(?:\\.${IDENTIFIER})*(?:\\[\\])*`                ;
const MODIFIER   = "(?:private|protected|public|static|final|volatile|transient)" ;
const MODIFIERS  = `${MODIFIER}(?:\\s+${MODIFIER})*`                              ;

/** Rows with an unclosed paren or brace, annotation lines, and rows starting with control-flow or declaration keywords are excluded from row candidates. */
const RESERVED_START = /^(?:if|for|while|switch|do|else|try|catch|finally|return|throw|new|break|continue|case|default|synchronized|assert|import|package|class|interface|enum|record|extends|implements|this|super)\b/;

const ENUM_WITH_ARGS = new RegExp(`^([ \\t]*)(${IDENTIFIER})(\\s*)(\\([^()]*\\))(\\s*),$`, "du")                    ;
const ENUM_BARE      = new RegExp(`^([ \\t]*)(${IDENTIFIER})(\\s*),$`, "du")                                        ;
const INITIALIZED    = new RegExp(`^([ \\t]*)(${MODIFIERS})(\\s+)(${TYPE})(\\s+)(${IDENTIFIER})(\\s*)=(.*)$`, "du") ;
const DECLARED       = new RegExp(`^([ \\t]*)(${MODIFIERS})(\\s+)(${TYPE})(\\s+)(${IDENTIFIER})(\\s*);$`, "du")     ;
const PLAIN_INIT     = new RegExp(`^([ \\t]*)(${TYPE})(\\s+)(${IDENTIFIER})(\\s*)=(.*)$`, "du")                     ;

/** `{ cell , cell ... } trailer` — trailer holds the following `,` or `;` verbatim. */
const GROUP = /^([ \t]*)\{(.*)\}([,;]?)$/du;
/** String form of a bundle cell — commas and braces inside are blanked by the mask and are not boundaries. */
const STRING_CELL = /^"(?:[^"\\]|\\.)*"$/u;
/** Scalar form of a bundle cell — signed decimal, hex and binary numbers (with suffixes and underscores) and identifiers (including true, false, null). */
const SCALAR_CELL = /^(?:[+-]?(?:0[xX][0-9A-Fa-f_]+[lL]?|0[bB][01_]+[lL]?|[0-9][0-9_]*(?:\.[0-9_]*)?(?:[eE][+-]?[0-9]+)?[fFdDlL]?)|[A-Za-z_$][A-Za-z0-9_$]*)$/u;
/** If these characters remain in the mask inside a bundle row, it involves nesting, assignment, calls or indexing — do not attempt decomposition. */
const GROUP_UNSAFE = /[{}()[\]=]/u;

function slotAt(code: string, match: RegExpExecArray, group: number): string {
	const range = match.indices?.[group];
	return range ? code.slice(range[0], range[1]) : "";
}

/** Cuts the value cell and semicolon by coordinates from the span after "=" (restGroup). Only the last ; terminates the statement; another ; outside strings inside the value is refused as uncertain. */
function tailSlots(code: string, masked: string, match: RegExpExecArray, restGroup: number): readonly [Slot, Slot] | null {
	const tailStart = match.indices?.[restGroup]?.[0];
	if (tailStart === undefined || masked.endsWith(";") === false) return null;
	const semicolonAt = masked.length - 1 ;
	let valueStart    = tailStart         ;
	let valueEnd      = semicolonAt       ;
	while (valueStart < valueEnd && /\s/.test(masked.charAt(valueStart))) valueStart += 1;
	while (valueEnd > valueStart && /\s/.test(masked.charAt(valueEnd - 1))) valueEnd -= 1;
	if (valueStart === valueEnd) return null;
	if (masked.slice(valueStart, valueEnd).includes(";")) return null;
	const value     : Slot = { axis: "value",     text: code.slice(valueStart, valueEnd), gapBefore: code.slice(tailStart, valueStart) };
	const semicolon : Slot = { axis: "semicolon", text: ";", gapBefore: code.slice(valueEnd, semicolonAt) };
	return [value, semicolon];
}

/**
 * Brace bundle row `{"alpha", 1, 0x10},` — cell boundaries are cut at the mask's commas and text is taken
 * from `code` at the same coordinates. Commas inside string cells are blanked by the mask, so boundaries hold.
 * Only scalar cells (strings, numbers, identifiers) pass; cells with remaining angle brackets or dots, such as
 * generics or qualified references, fail the scalar check. The close slot (`}` + trailer) is last in the row,
 * so padding cell columns never creates trailing whitespace.
 */
function bundleProfile(code: string, masked: string): RowProfile | null {
	const match   = GROUP.exec(masked) ;
	const indices = match?.indices     ;
	if (!match || !indices) return null;
	const interior = indices[2];
	const trailer  = indices[3];
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
		const raw  = code.slice(bound.start, bound.end) ;
		const text = raw.trim()                         ;
		if (text === "") return null; // empty cell from consecutive commas or after a trailing comma
		const cellStart = bound.start + raw.indexOf(text);
		if (text.startsWith('"')) {
			if (!STRING_CELL.test(text)) return null;
		} else if (masked.slice(cellStart, cellStart + text.length) !== text || !SCALAR_CELL.test(text)) {
			return null; // not a scalar if comment/string fragments, angle brackets or dots remain in the cell
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
	slots.push({ axis: "close", text: "}" + slotAt(code, match, 3), gapBefore: code.slice(cells[cells.length - 1].end, interior[1]) });
	return { indent: slotAt(code, match, 1), slots };
}

function profileJava(code: string, masked: string): RowProfile | null {
	// Rows with a remaining brace can only be bundle-row candidates — if they do not read as a bundle row, they are still refused.
	if (/[{}]/.test(masked)) return bundleProfile(code, masked);
	const trimmed = masked.trim();
	if (trimmed === "" || trimmed.startsWith("@") || RESERVED_START.test(trimmed)) return null;

	const withArgs = ENUM_WITH_ARGS.exec(masked);
	if (withArgs) {
		return {
			indent : slotAt(code, withArgs, 1),
			slots  : [
				{ axis : "name"      , text : slotAt(code, withArgs, 2) , gapBefore : ""                        },
				{ axis : "parenArgs" , text : slotAt(code, withArgs, 4) , gapBefore : slotAt(code, withArgs, 3) },
				{ axis : "comma"     , text : ","                       , gapBefore : slotAt(code, withArgs, 5) },
			],
		};
	}

	const bare = ENUM_BARE.exec(masked);
	if (bare) {
		return {
			indent : slotAt(code, bare, 1),
			slots  : [
				{ axis: "name",  text: slotAt(code, bare, 2), gapBefore: "" },
				{ axis: "comma", text: ",", gapBefore: slotAt(code, bare, 3) },
			],
		};
	}

	const initialized = INITIALIZED.exec(masked);
	if (initialized) {
		const tail = tailSlots(code, masked, initialized, 8);
		if (!tail) return null;
		return {
			indent : slotAt(code, initialized, 1),
			slots  : [
				{ axis: "modifiers", text: slotAt(code, initialized, 2), gapBefore: "" },
				{ axis: "type",      text: slotAt(code, initialized, 4), gapBefore: slotAt(code, initialized, 3) },
				{ axis: "name",      text: slotAt(code, initialized, 6), gapBefore: slotAt(code, initialized, 5) },
				{ axis: "equal",     text: "=", gapBefore: slotAt(code, initialized, 7) },
				...tail,
			],
		};
	}

	const declared = DECLARED.exec(masked);
	if (declared) {
		return {
			indent : slotAt(code, declared, 1),
			slots  : [
				{ axis : "modifiers" , text : slotAt(code, declared, 2) , gapBefore : ""                        },
				{ axis : "type"      , text : slotAt(code, declared, 4) , gapBefore : slotAt(code, declared, 3) },
				{ axis : "name"      , text : slotAt(code, declared, 6) , gapBefore : slotAt(code, declared, 5) },
				{ axis : "semicolon" , text : ";"                       , gapBefore : slotAt(code, declared, 7) },
			],
		};
	}

	const plain = PLAIN_INIT.exec(masked);
	if (plain) {
		const tail = tailSlots(code, masked, plain, 6);
		if (!tail) return null;
		return {
			indent : slotAt(code, plain, 1),
			slots  : [
				{ axis: "type",  text: slotAt(code, plain, 2), gapBefore: "" },
				{ axis: "name",  text: slotAt(code, plain, 4), gapBefore: slotAt(code, plain, 3) },
				{ axis: "equal", text: "=", gapBefore: slotAt(code, plain, 5) },
				...tail,
			],
		};
	}

	return null;
}

export const JAVA_ALIGNER: LineProfiler = {
	language   : "java",
	syntax     : JAVA_SYNTAX,
	// cell/arg axes of bundle rows are followed by a comma or the close slot, so aligning them never creates trailing whitespace.
	columnAxes : ["modifiers", "type", "name", "value", "parenArgs", "cell", "arg"],
	canonicalGaps : {
		// Java convention: semicolons and commas attach to the cell; other separators get one space.
		// Bundle rows attach the first cell to the opening brace and attach close too, so the closing brace shares the cell width.
		modifiers : " ",
		type      : " ",
		name      : " ",
		value     : " ",
		parenArgs : "",
		equal     : " ",
		semicolon : "",
		comma     : "",
		open      : "",
		cell      : "",
		arg       : " ",
		close     : "",
	},
	profile    : profileJava,
};
