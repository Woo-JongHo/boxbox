/**
 * 언어 무관 코드 텍스트 인프라. 문자열 내부와 주석을 길이 보존 마스킹해 프로파일러가
 * 문자열 안의 `:`·`=`·`;`를 구조로 오판하지 않게 한다. 마스크는 원본과 줄·열 기하를
 * 완전히 유지하므로, 마스크 좌표를 원본 슬라이스에 그대로 쓸 수 있다.
 */
export interface StringSpec {
	/** 여는 구분자. `"""` 같은 삼중 따옴표는 close와 같은 값을 쓴다. */
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
	/** Rust 문자 리터럴 `'a'`만 문자열로 인정하고 `'a` 수명은 코드로 둔다. */
	readonly rustChars?    : boolean;
	/** C++ 원본 문자열 `R"delim( ... )delim"`을 인정한다. */
	readonly cppRaw?       : boolean;
}

export interface MaskedSource {
	/** 문자열 내부·주석 내부가 공백으로 치환된 원본 복사본. 줄·열 기하는 원본과 같다. */
	readonly text          : string;
	/** 줄별로, 문자열 밖에서 시작한 주석의 시작 열(없으면 -1). 그 줄의 코드 부분은 [0, commentStart)다. */
	readonly commentStarts : readonly number[];
	/** 줄별로, 그 줄이 시작할 때 블록 주석 안에 있었는지. 참이면 그 줄은 행 후보에서 제외한다. */
	readonly opensInBlock  : readonly boolean[];
}

const longestFirst = (values: readonly string[]): readonly string[] => [...values].sort((left, right) => right.length - left.length);

export function maskSource(source: string, syntax: CodeSyntax): MaskedSource {
	// UTF-16 코드 단위 배열 — indexOf·startsWith 좌표와 배열 인덱스가 정확히 일치해야 한다.
	// 코드 포인트 배열([...source])은 비BMP 문자(서러게이트 페어)마다 좌표를 어긋나게 한다.
	const masked                    = source.split("")                    ;
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
			let cursor = index + 2;
			let delimiter = "";
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
			const spec = syntax.strings.find(candidate => candidate.open === openToken);
			const spec0 = spec as StringSpec;
			index = consumeString(source, masked, index, index + openToken.length, spec0.close, spec0.escape);
			continue;
		}

		index += 1;
	}
	return { text: masked.join(""), commentStarts, opensInBlock };
}

/** open 뒤부터 close 앞까지 내부를 공백으로 가리고, close 다음 칸 가리킨다. */
function consumeString(source: string, masked: string[], open: number, from: number, close: string, escape: boolean): number {
	let index = from;
	while (index < source.length) {
		if (source.startsWith(close, index)) return index + close.length;
		if (escape && source[index] === "\\") {
			masked[index] = " ";
			if (source[index + 1] === "\n") {
				// 역슬래시-줄바꿈: 줄바꿈은 기하 보존을 위해 남기고 다음 반복에서 처리한다.
				index += 1;
				continue;
			}
			if (index + 1 < source.length) masked[index + 1] = " ";
			index += 2;
			continue;
		}
		if (source[index] === "\n" && close.includes("\n") === false) {
			// 닫힘 없는 줄 경계: 문자열이 계속된다고 보고 다음 줄로 진행(뒤집힌 따옴표 파일도 기하 보존).
			index += 1;
			continue;
		}
		if (masked[index] !== "\n") masked[index] = " ";
		index += 1;
	}
	return index;
}
