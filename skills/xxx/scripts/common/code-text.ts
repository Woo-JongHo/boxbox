/**
 * Language-agnostic code text infrastructure. Masks string contents and comments while preserving
 * length, so profilers never mistake `:`, `=` or `;` inside strings for structure. The mask keeps the
 * original line/column geometry exactly, so mask coordinates can slice the original directly.
 */
export interface StringSpec {
	/** Opening delimiter. Triple quotes such as `"""` use the same value as close. */
	readonly open   : string  ;
	readonly close  : string  ;
	readonly escape : boolean ;
}

export interface BlockCommentSpec {
	readonly open    : string;
	readonly close   : string;
}

export interface CodeSyntax {
	readonly lineComments  : readonly string[]           ;
	readonly blockComments : readonly BlockCommentSpec[] ;
	readonly strings       : readonly StringSpec[]       ;
	/** Treat only Rust char literals `'a'` as strings; leave lifetimes `'a` as code. */
	readonly rustChars?    : boolean;
	/** Recognize C++ raw strings `R"delim( ... )delim"`. */
	readonly cppRaw?       : boolean;
}

export interface MaskedSource {
	/** Copy of the source with string and comment contents replaced by spaces. Same line/column geometry. */
	readonly text          : string;
	/** Per line, start column of a comment beginning outside strings (-1 if none). The line's code part is [0, commentStart). */
	readonly commentStarts : readonly number[];
	/** Per line, whether the line starts inside a block comment. If true, the line is excluded from row candidates. */
	readonly opensInBlock  : readonly boolean[];
}

const longestFirst = (values: readonly string[]): readonly string[] => [...values].sort((left, right) => right.length - left.length);

export function maskSource(source: string, syntax: CodeSyntax): MaskedSource {
	// UTF-16 code unit array — indexOf/startsWith coordinates must match array indices exactly.
	// A code point array ([...source]) would shift coordinates at every non-BMP character (surrogate pair).
	const masked                    = source.split("")                                    ;
	const strings                   = longestFirst(syntax.strings.map(spec => spec.open)) ;
	const commentStarts : number[]  = [-1]                                                ;
	const opensInBlock  : boolean[] = [false]                                             ;
	let line                        = 0                                                   ;
	let lineStart                   = 0                                                   ;
	let inBlock                     = false                                               ;
	let blockClose                  = ""                                                  ;
	let index                       = 0                                                   ;

	while (index < source.length) {
		const character = source[index];
		if (character === "\n") {
			line += 1;
			lineStart           = index + 1 ;
			opensInBlock[line]  = inBlock   ;
			commentStarts[line] = -1        ;
			index += 1;
			continue;
		}
		if (commentStarts[line] === undefined) commentStarts[line] = -1;

		if (inBlock) {
			if (source.startsWith(blockClose, index)) {
				for (let k = 0; k < blockClose.length; k += 1) masked[index + k] = " ";
				inBlock = false;
				index += blockClose.length;
				continue;
			}
			masked[index] = " ";
			index += 1;
			continue;
		}

		const blockOpen = syntax.blockComments.find(spec => source.startsWith(spec.open, index));
		if (blockOpen) {
			if (commentStarts[line] < 0) commentStarts[line] = index - lineStart;
			for (let k = 0; k < blockOpen.open.length; k += 1) masked[index + k] = " ";
			inBlock = true;
			blockClose = blockOpen.close;
			index += blockOpen.open.length;
			continue;
		}

		const lineComment = syntax.lineComments.find(token => source.startsWith(token, index));
		if (lineComment) {
			if (commentStarts[line] < 0) commentStarts[line] = index - lineStart;
			index = source.indexOf("\n", index);
			if (index < 0) index = source.length;
			continue;
		}

		if (syntax.cppRaw && character === "R" && source[index + 1] === '"') {
			let cursor    = index + 2 ;
			let delimiter = ""        ;
			while (cursor < source.length && source[cursor] !== "(" && source[cursor] !== "\n" && delimiter.length < 16) { delimiter += source[cursor]; cursor += 1; }
			if (source[cursor] === "(") {
				const close = `)${delimiter}"`;
				index = consumeString(source, masked, index, cursor + 1, close, false);
				continue;
			}
		}

		if (syntax.rustChars && character === "'") {
			const match = /^'(\\.|[^\\'])'/.exec(source.slice(index));
			if (match) { index = consumeString(source, masked, index, index + 1, "'", true); continue; }
		}

		const openToken = strings.find(token => source.startsWith(token, index));
		if (openToken) {
			const spec  = syntax.strings.find(candidate => candidate.open === openToken) ;
			const spec0 = spec as StringSpec                                             ;
			index = consumeString(source, masked, index, index + openToken.length, spec0.close, spec0.escape);
			continue;
		}

		index += 1;
	}
	return { text: masked.join(""), commentStarts, opensInBlock };
}

/** Masks the interior from after open to before close with spaces, and returns the index after close. */
function consumeString(source: string, masked: string[], open: number, from: number, close: string, escape: boolean): number {
	let index = from;
	while (index < source.length) {
		if (source.startsWith(close, index)) return index + close.length;
		if (escape && source[index] === "\\") {
			masked[index] = " ";
			if (source[index + 1] === "\n") {
				// Backslash-newline: keep the newline to preserve geometry and handle it on the next iteration.
				index += 1;
				continue;
			}
			if (index + 1 < source.length) masked[index + 1] = " ";
			index += 2;
			continue;
		}
		if (source[index] === "\n" && close.includes("\n") === false) {
			// Line boundary without a close: assume the string continues onto the next line (geometry is preserved even for files with unbalanced quotes).
			index += 1;
			continue;
		}
		if (masked[index] !== "\n") masked[index] = " ";
		index += 1;
	}
	return index;
}
