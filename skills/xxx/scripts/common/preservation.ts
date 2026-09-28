/**
 * Whitespace-only edit check for the line engine. An aligned file must differ from its source only in
 * horizontal whitespace between tokens. Per line it compares three keys:
 *
 * 1. Indentation — leading whitespace is never touched (Python and YAML give it meaning).
 * 2. Protected text — string interiors and comments, compared byte for byte in order. The one exception is
 *    whitespace at the end of a line that ends in a line comment: it is not content, so it may be removed. Trailing
 *    whitespace inside a string that continues on the next line stays protected.
 * 3. Code shape — code outside protected text, where a whitespace run survives as one space only between
 *    two word characters or two operator characters (`let x` never becomes `letx`, `==` never `= =`) and
 *    disappears everywhere else (`a:` and `a :` are the same code).
 *
 * Protected positions come from the shared mask. The mask blanks string interiors and block comments but keeps
 * whitespace that was already a space, so the source is masked with its whitespace replaced by a sentinel first:
 * every blank in that mask is then a masked position.
 */
import      { maskSource } from "./code-text.ts" ;
import type { CodeSyntax } from "./code-text.ts" ;

const SENTINEL    = "\u0000"                 ;
const PLACEHOLDER = "\u0001"                 ;
const WORD        = /[\p{L}\p{N}_$]/u        ;
const OPERATOR    = /[+\-*/%=<>!&|^~?:.@#]/u ;
const BLANK       = /[ \t\r\f\v]/u           ;

interface LineKey {
	readonly indent    : string            ;
	readonly code      : string            ;
	readonly protected : readonly string[] ;
}

function joinable(left: string, right: string): boolean {
	return (WORD.test(left) && WORD.test(right)) || (OPERATOR.test(left) && OPERATOR.test(right));
}

/** Collapses each whitespace run to one space when removing it would join two tokens, and to nothing otherwise. */
function normalizeCode(code: string): string {
	let result = "";
	let index  = 0;
	while (index < code.length) {
		if (!BLANK.test(code[index]!)) {
			result += code[index];
			index += 1;
			continue;
		}
		let end = index;
		while (end < code.length && BLANK.test(code[end]!)) end += 1;
		const left  = result[result.length - 1] ?? "";
		const right = code[end] ?? "";
		if (left !== "" && right !== "" && joinable(left, right)) result += " ";
		index = end;
	}
	return result;
}

function lineKeys(source: string, syntax: CodeSyntax): LineKey[] {
	const mask        = maskSource(source.replace(/[^\S\n]/gu, SENTINEL), syntax) ;
	const lines       = source.split("\n")                                        ;
	const maskedLines = mask.text.split("\n")                                     ;
	return lines.map((line, lineIndex) => {
		const maskedLine   = maskedLines[lineIndex] ?? ""                                                                             ;
		const commentStart = mask.commentStarts[lineIndex] ?? -1                                                                      ;
		const isProtected  = (column: number): boolean => maskedLine[column] === " " || (commentStart >= 0 && column >= commentStart) ;
		let indentEnd      = 0                                                                                                        ;
		while (indentEnd < line.length && !isProtected(indentEnd) && BLANK.test(line[indentEnd]!)) indentEnd += 1;
		const runs : string[]      = []   ;
		let code                   = ""   ;
		let run    : string | null = null ;
		for (let column = indentEnd; column < line.length; column += 1) {
			if (isProtected(column)) {
				if (run === null) { run = ""; code += PLACEHOLDER; }
				run += line[column];
				continue;
			}
			if (run !== null) { runs.push(run); run = null; }
			code += line[column];
		}
		if (run !== null) runs.push(commentStart >= 0 ? run.replace(/[ \t]+$/u, "") : run);
		return { indent: line.slice(0, indentEnd), code: normalizeCode(code), protected: runs };
	});
}

const sameKey = (left: LineKey, right: LineKey): boolean =>
	left.indent === right.indent
	&& left.code === right.code
	&& left.protected.length === right.protected.length
	&& left.protected.every((text, position) => text === right.protected[position]);

/**
 * Returns the 0-based indexes of lines where `after` differs from `before` in anything but horizontal
 * whitespace between tokens. A different line count marks every line as changed.
 */
export function changedLines(before: string, after: string, syntax: CodeSyntax): readonly number[] {
	const beforeKeys = lineKeys(before, syntax) ;
	const afterKeys  = lineKeys(after, syntax)  ;
	if (beforeKeys.length !== afterKeys.length) return beforeKeys.map((_, index) => index);
	return beforeKeys.flatMap((key, index) => sameKey(key, afterKeys[index]!) ? [] : [index]);
}
