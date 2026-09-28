/**
 * Deterministic source mutator for invariant testing. Given a seed, it produces variants of a fixture that stress
 * the aligner without needing to stay valid code: the invariants compare each variant with its own aligned output.
 *
 * Mutations: re-spacing existing inner whitespace with spaces and tabs, spaces before `;`/`,` and after `,`,
 * separators, CJK and emoji inside strings and comments, and inserted comment lines or trailing comments.
 */
import      { maskSource } from "../skills/xxx/scripts/common/code-text.ts" ;
import type { CodeSyntax } from "../skills/xxx/scripts/common/code-text.ts" ;

/** mulberry32: small, fast, seeded PRNG. */
export function random(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

const pick       = <T>(next: () => number, values: readonly T[]): T => values[Math.floor(next() * values.length)]! ;
const GAPS       = [" ", "  ", "   ", "\t", " \t", "\t "] as const                                                 ;
const PROTECTED  = [":", "=", ";", ",", "//", "#", "가", "漢", "😀", " ", "  ", "=>", "{}", "()", "[]"] as const    ;
const COMMENTARY = ["note: a = b;", "x : y , z", "가나다 = 1", "😀 {}", "k: v; // nested", "a  =  b"] as const      ;

export interface MutatorSyntax {
	readonly syntax  : CodeSyntax ;
	/** Token that starts a line comment in this language. */
	readonly comment : string     ;
}

/** Returns one variant of `source` for `seed`. */
export function mutate(source: string, language: MutatorSyntax, seed: number): string {
	const next          = random(seed)                        ;
	const mask          = maskSource(source, language.syntax) ;
	const lines         = source.split("\n")                  ;
	const masks         = mask.text.split("\n")               ;
	const out: string[] = []                                  ;
	lines.forEach((line, index) => {
		const masked    = masks[index] ?? ""                                                                                                                            ;
		const comment   = mask.commentStarts[index] ?? -1                                                                                                               ;
		const protectAt = (column: number): boolean => (masked[column] === " " && line[column] !== " " && line[column] !== "\t") || (comment >= 0 && column >= comment) ;
		const indent    = /^[ \t]*/u.exec(line)![0].length                                                                                                              ;
		let text        = line.slice(0, indent)                                                                                                                         ;
		for (let column = indent; column < line.length; column += 1) {
			const character = line[column]!;
			if (protectAt(column)) {
				text += next() < 0.15 && !/["'`\\*$\/]/u.test(character) ? pick(next, PROTECTED) : character;
				continue;
			}
			if (character === " " || character === "\t") {
				let end = column;
				while (end + 1 < line.length && (line[end + 1] === " " || line[end + 1] === "\t") && !protectAt(end + 1)) end += 1;
				text += next() < 0.6 ? pick(next, GAPS) : line.slice(column, end + 1);
				column = end;
				continue;
			}
			const before = line[column - 1] ?? "" ;
			const after  = line[column + 1] ?? "" ;
			if ((character === ";" || character === ",") && before !== " " && !/[;,]/u.test(before) && next() < 0.3) text += pick(next, GAPS);
			text += character;
			if (character === "," && after !== " " && after !== "" && next() < 0.3) text += " ";
		}
		if (masked.trim() !== "" && comment < 0 && next() < 0.08) text += ` ${language.comment} ${pick(next, COMMENTARY)}`;
		if (next() < 0.05) out.push(`${line.slice(0, indent)}${language.comment} ${pick(next, COMMENTARY)}`);
		out.push(text);
	});
	return out.join("\n");
}

/**
 * Shrinks a failing input by dropping lines while `fails` stays true — a small delta-debugging pass so a failure is
 * reported as the fewest lines that still reproduce it.
 */
export function minimize(source: string, fails: (candidate: string) => boolean): string {
	let lines = source.split("\n");
	for (let chunk = Math.max(1, Math.floor(lines.length / 2)); chunk >= 1; chunk = Math.floor(chunk / 2)) {
		for (let start = 0; start < lines.length;) {
			const candidate = [...lines.slice(0, start), ...lines.slice(start + chunk)];
			if (candidate.length > 0 && fails(candidate.join("\n"))) lines = candidate;
			else start += chunk;
		}
		if (chunk === 1) break;
	}
	return lines.join("\n");
}
