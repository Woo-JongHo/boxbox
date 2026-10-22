import      { preservesTokens     } from "@/typescript/token-preservation.ts" ;
import      { PYTHON_SYNTAX       } from "@/python/profile.ts"                ;
import      { changedLines        } from "@/common/preservation.ts"           ;
import type { PublicLanguage      } from "@/common/project-config.ts"         ;
import      { preservesStructured } from "@/structured/index.ts"              ;

/** Align changes only spaces and tabs between existing tokens, never the file's physical layout. */
export function assertAlignmentOnly(before: Buffer, after: Buffer, language: PublicLanguage): void {
	const original  = before.toString("utf8")                                                                                                       ;
	const candidate = after.toString("utf8")                                                                                                        ;
	const refuse    = (): never => { throw new Error("alignment-only refusal: candidate changes more than horizontal whitespace between tokens"); } ;

	// Decoding invalid UTF-8 must not hide a byte change behind replacement characters.
	if (!Buffer.from(original).equals(before) || !Buffer.from(candidate).equals(after)) refuse();
	const left  = original .split(/(\r\n|[\r\n\u2028\u2029])/u) ;
	const right = candidate.split(/(\r\n|[\r\n\u2028\u2029])/u) ;

	if (left.length !== right.length) refuse();
	for (let index = 0; index < left.length; index += 1) {
		const source = left[index]!  ;
		const output = right[index]! ;
		if (index % 2 === 1) {
			if (source !== output) refuse();
			continue;
		}
		if (source.replace(/[ \t]/gu, "") !== output.replace(/[ \t]/gu, "")) refuse();
		if (source.match(/^\uFEFF?[ \t]*/u)![0] !== output.match(/^\uFEFF?[ \t]*/u)![0]) refuse();
		if (source.match(/[ \t]*$/u)![0] !== output.match(/[ \t]*$/u)![0]) refuse();
	}
	// The layout check cannot distinguish code gaps from spaces inside strings, regexes or comments.
	const preservedBy = {
		typescript : () => preservesTokens(original, candidate)                          ,
		python     : () => changedLines(original, candidate, PYTHON_SYNTAX).length === 0 ,
		json       : () => preservesStructured(original, candidate, "json")              ,
		yaml       : () => preservesStructured(original, candidate, "yaml")              ,
	}[language];
	const preserved = preservedBy();

	if (!preserved) refuse();
}
