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
		const independent = quote === ""
			&& brackets.length === 0
			&& !continued
			&& !uncertain ;
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
		if (
			!independent
			|| quote !== ""
			|| brackets.length !== 0
			|| continued
			|| uncertain
		) continue;

		const profile = assignment(code);
		if (profile) result.set(index, profile);
	}

	return result;
}
