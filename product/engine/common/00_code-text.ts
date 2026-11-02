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
	readonly open  : string;
	readonly close : string;
}

/** Half-open [start, end) UTF-16 code-unit offsets into the original source; source geometry, including newlines, is retained. */
export interface ProtectedRange {
	readonly start : number;
	readonly end   : number;
}

export interface CodeSyntax {
	readonly lineComments  : readonly string[]           ;
	readonly blockComments : readonly BlockCommentSpec[] ;
	readonly strings       : readonly StringSpec[]       ;
	/** Optional parser-owned opaque spans, measured on original source before any whitespace sentinels. */
	readonly protectedRanges?: (source: string) => readonly ProtectedRange[];
}

export interface MaskedSource {
	/** Copy of the source with string and comment contents replaced by spaces. Same line/column geometry. */
	readonly text          : string;
	/** Per line, start column of a comment beginning outside strings (-1 if none). The line's code part is [0, commentStart). */
	readonly commentStarts : readonly number[];
	/** Per line, whether the line starts inside a block comment. If true, the line is excluded from row candidates. */
	readonly opensInBlock  : readonly boolean[];
}

export function maskSource(source: string, syntax: CodeSyntax, protectedRanges = syntax.protectedRanges?.(source) ?? []): MaskedSource {
	// UTF-16 code unit array — indexOf/startsWith coordinates must match array indices exactly.
	// A code point array ([...source]) would shift coordinates at every non-BMP character (surrogate pair).
	const masked                    = source.split("")                                                                ;
	const strings                   = [...syntax.strings].sort((left, right) => right.open.length - left.open.length) ;
	const protectedEnds             = new Map(protectedRanges.map(range => [range.start, range.end]))                 ;
	const commentStarts : number[]  = [-1]                                                                            ;
	const opensInBlock  : boolean[] = [false]                                                                         ;
	let line                        = 0                                                                               ;
	let lineStart                   = 0                                                                               ;
	let inBlock                     = false                                                                           ;
	let blockClose                  = ""                                                                              ;
	let index                       = 0                                                                               ;

	const blank = (from: number, length: number): void => {
		for (let offset = 0; offset < length; offset += 1) masked[from + offset] = " ";
	};

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
				blank(index, blockClose.length);
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
			blank(index, blockOpen.open.length);
			inBlock    = true            ;
			blockClose = blockOpen.close ;
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

		const protectedEnd = protectedEnds.get(index)                                                                                                       ;
		const spec         = protectedEnd === undefined ? strings.find(candidate => source.startsWith(candidate.open, index)) : undefined                   ;
		const end          = protectedEnd ?? (spec && spec.open ? consumeString(source, masked, index + spec.open.length, spec.close, spec.escape) : index) ;
		if (end > index) {
			if (protectedEnd !== undefined) {
				for (let position = index; position < end; position += 1) {
					if (source[position] !== "\n" && source[position] !== "\r") masked[position] = " ";
				}
			}
			// A string may span lines (triple quotes, backslash-newline). Its newlines still start lines, or every later
			// line's commentStarts and opensInBlock would shift by one.
			for (let newline = source.indexOf("\n", index); newline >= 0 && newline < end; newline = source.indexOf("\n", newline + 1)) {
				line += 1;
				lineStart           = newline + 1 ;
				opensInBlock[line]  = inBlock     ;
				commentStarts[line] = -1          ;
			}
			index = end;
			continue;
		}

		index += 1;
	}
	return { text: masked.join(""), commentStarts, opensInBlock };
}

/** Masks the interior from after open to before close with spaces, and returns the index after close. */
function consumeString(source: string, masked: string[], from: number, close: string, escape: boolean): number {
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
