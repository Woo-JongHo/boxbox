/**
 * C 프로파일러. 구조 매칭은 문자열·주석을 공백화한 masked로 하고, 셀 텍스트는 code에서 같은
 * 좌표로 자른다(/d 플래그 indices). 지원 표: 구조체·union 필드 `Type name;`, enum 상수
 * `NAME = 값,`, 지정 초기화 `.field = 값,`, 객체형 매크로 `#define 이름 값`, 중괄호 묶음 행
 * `{1, "alpha", 0x10},`(셀 2개 이상, 같은 arity끼리 한 표). 함수 시그니처, 여는 중괄호가
 * 남는 행, 제어문, return, 비트필드, 배열, 함수형 매크로, 역슬래시 줄 연결, 내부에 중첩·
 * 대입·호출이 남는 묶음 행처럼 확신 없는 행은 null로 거부해 구획을 끊는다.
 */
import type { CodeSyntax }                     from "../common/code-text.ts";
import type { LineProfiler, RowProfile, Slot } from "../common/table-engine.ts";

/** 마스크는 원본과 줄·열 기하를 보존하므로, 마스크 좌표를 code 슬라이스에 그대로 쓴다. */
const sliceAt = (code: string, indices: RegExpIndicesArray, group: number): string => {
	const range = indices[group];
	return range ? code.slice(range[0], range[1]) : "";
};

/** 이름 자리에 올 수 없는 C 예약어 — `int if;` 같은 행을 거부한다. */
const C_KEYWORDS = new Set([
	"auto", "break", "case", "char", "const", "continue", "default", "do", "double", "else", "enum",
	"extern", "float", "for", "goto", "if", "inline", "int", "long", "register", "restrict", "return",
	"short", "signed", "sizeof", "static", "struct", "switch", "typedef", "union", "unsigned", "void",
	"volatile", "while", "_Bool", "_Complex", "_Imaginary",
]);

/** type 자리에 오면 선언이 아니라 문장인 키워드 — `return value;` 형태를 거부한다. */
const CONTROL_KEYWORDS = new Set([
	"break", "case", "continue", "default", "do", "else", "for", "goto", "if", "return", "sizeof",
	"switch", "while",
]);

/** type 셀은 식별자와 포인터 별표만 허용한다 — `unsigned int`, `struct foo *`는 통과, `x =`는 거부. */
const TYPE_TOKEN = /^(?:[A-Za-z_]\w*|\*+)$/u;

/** 값 셀에 괄호·중괄호·대괄호·세미콜론이 보이면 함수 호출·초기화 목록이라 확신할 수 없다. */
const VALUE_UNSAFE = /[(){}[\];#]/u;

/** `Type name;` — type은 최소로 자라고 이름 직전의 포인터 별표는 이름 셀에 붙인다. */
const FIELD = /^([ \t]*)(.+?)([ \t]+)(\*+)?([A-Za-z_]\w*)([ \t]*);$/du;

/** `NAME = 값,` — 문자열 내부의 쉼표는 마스크가 공백화하므로 값이 끊기지 않는다. */
const ENUM = /^([ \t]*)([A-Za-z_]\w*)([ \t]*)(=)([ \t]*)([^,]+?)([ \t]*),$/du;

/** `.field = 값,` — 점 체인 `.a.b`도 한 셀로 자른다. */
const DESIGNATED = /^([ \t]*)((?:\.[A-Za-z_]\w*)+)([ \t]*)(=)([ \t]*)([^,]+?)([ \t]*),$/du;

/** `#define 이름 값` — 이름 바로 뒤 `(`는 함수형 매크로라 거부한다. */
const MACRO = /^([ \t]*)(#define)([ \t]+)([A-Za-z_]\w*)(?!\()(?:([ \t]+)(.+?))?$/du;

/** `{ 셀 , 셀 ... } trailer` — trailer는 뒤따르는 `,` 또는 `;` 또는 없음을 그대로 담는다. */
const GROUP = /^([ \t]*)\{(.*)\}([,;]?)$/du;

/** 묶음 행 셀의 문자열·문자 리터럴 꼴 — 내부의 쉼표·중괄호는 마스크가 공백화해 있다. */
const STRING_CELL = /^"(?:[^"\\]|\\.)*"$|^'(?:[^'\\]|\\.)*'$/u;
/** 묶음 행 셀의 스칼라 꼴 — 부호 있는 10진·0x 16진(C 접미사 포함) 숫자와 식별자·매크로. */
const SCALAR_CELL = /^(?:[+-]?(?:0[xX][0-9A-Fa-f]+[uUlL]*|[0-9]+(?:\.[0-9]+)?[fFuUlL]*)|[A-Za-z_]\w*)$/u;
/** 묶음 행 내부에 이 문자들이 마스크에 남으면 중첩·대입·호출·첨자 행이다 — 분해를 시도하지 않는다. */
const GROUP_UNSAFE = /[{}()[\]=>]/u;

export const C_SYNTAX: CodeSyntax = {
	lineComments  : ["//"],
	blockComments : [{ open: "/*", close: "*/" }],
	strings       : [{ open: '"', close: '"', escape: true }, { open: "'", close: "'", escape: true }],
	cppRaw        : false,
};

function macroProfile(code: string, masked: string): RowProfile | null {
	const match = MACRO.exec(masked);
	const indices = match?.indices;
	if (!match || !indices) return null;
	const slots: Slot[] = [
		{ axis: "directive", text: sliceAt(code, indices, 2), gapBefore: ""                             },
		{ axis: "name",      text: sliceAt(code, indices, 4), gapBefore: sliceAt(code, indices, 3) },
	];
	if (indices[6]) slots.push({ axis: "replacement", text: sliceAt(code, indices, 6), gapBefore: sliceAt(code, indices, 5) });
	return { indent: sliceAt(code, indices, 1), slots };
}

function fieldProfile(code: string, masked: string): RowProfile | null {
	const match = FIELD.exec(masked);
	const indices = match?.indices;
	if (!match || !indices) return null;
	const type = sliceAt(code, indices, 2);
	const tokens = type.split(/[ \t]+/u);
	if (tokens.some(token => !TYPE_TOKEN.test(token))) return null;
	if (CONTROL_KEYWORDS.has(tokens[0] ?? "")) return null;
	const stars = indices[4];
	const nameRange = indices[5];
	if (!nameRange) return null;
	const name = code.slice((stars ?? nameRange)[0], nameRange[1]);
	if (C_KEYWORDS.has(name.replace(/^\*+/u, ""))) return null;
	return {
		indent : sliceAt(code, indices, 1),
		slots  : [
			{ axis : "type"      ,      text : type ,                       gapBefore  : ""                        },
			{ axis : "name"      ,      text : name ,                       gapBefore  : sliceAt(code, indices, 3) },
			{ axis : "semicolon" , text      : ";"  ,                        gapBefore : sliceAt(code, indices, 6) },
		],
	};
}

/** enum 상수와 지정 초기화는 `이름 = 값,` 형태가 같아 한 검사에서 축 이름만 바꿔 분해한다. */
function assignProfile(code: string, masked: string): RowProfile | null {
	const enumMatch  = ENUM.exec(masked)                                ;
	const designated = enumMatch === null                               ;
	const match      = designated ? DESIGNATED.exec(masked) : enumMatch ;
	const indices    = match?.indices                                   ;
	if (!match || !indices) return null;
	const equalEnd = indices[4]?.[1];
	const valueRange = indices[6];
	if (equalEnd === undefined || !valueRange) return null;
	if (masked[equalEnd] === "=") return null;
	if (VALUE_UNSAFE.test(masked.slice(valueRange[0], valueRange[1]))) return null;
	const name = sliceAt(code, indices, 2);
	if (!designated && C_KEYWORDS.has(name)) return null;
	return {
		indent : sliceAt(code, indices, 1),
		slots  : [
			{ axis : designated ? "dotfield" : "name" , text                          : name                      ,                      gapBefore  : ""                        },
			{ axis : "equal"                          ,                          text : "="                       ,                       gapBefore : sliceAt(code, indices, 3) },
			{ axis : "value"                          ,                          text : sliceAt(code, indices, 6) , gapBefore                       : sliceAt(code, indices, 5) },
			{ axis : "comma"                          ,                          text : ","                       ,                       gapBefore : sliceAt(code, indices, 7) },
		],
	};
}

/**
 * 중괄호 묶음 행 `{1, "alpha", 0x10},` — 셀 경계는 마스크의 쉼표로 자르고 텍스트는 code에서
 * 같은 좌표로 가져온다. 문자열 셀 안의 쉼표는 마스크가 공백화해 경계가 끊기지 않는다. 셀은
 * 스칼라(문자열·숫자·식별자)만 통과하고, 내부에 중첩·대입·호출이 남으면 거부한다. close
 * 슬롯(`}` + trailer)이 행의 마지막이라 셀 열을 패딩해도 줄 끝 공백이 생기지 않는다.
 */
function groupProfile(code: string, masked: string): RowProfile | null {
	const match = GROUP.exec(masked);
	const indices = match?.indices;
	if (!match || !indices) return null;
	const interior = indices[2];
	const trailer = indices[3];
	if (!interior || !trailer) return null;
	if (GROUP_UNSAFE.test(masked.slice(interior[0], interior[1]))) return null;

	// 마스크 좌표로 셀 구간을 자른다. 문자열 셀 안의 쉼표는 마스크에서 공백이라 경계가 되지 않는다.
	const bounds: Array<{ start: number; end: number }> = [];
	let boundStart = interior[0];
	for (let index = interior[0]; index < interior[1]; index += 1) {
		if (masked[index] === ",") {
			bounds.push({ start: boundStart, end: index });
			boundStart = index + 1;
		}
	}
	bounds.push({ start: boundStart, end: interior[1] });
	if (bounds.length < 2) return null; // 셀이 1개뿐인 행은 묶음 표가 아니다

	const cells: Array<{ text: string; gap: string; commaGap: string; end: number }> = [];
	for (const bound of bounds) {
		const raw = code.slice(bound.start, bound.end);
		const text = raw.trim();
		if (text === "") return null; // 연속 쉼표·마지막 쉼표 뒤의 빈 셀
		const cellStart = bound.start + raw.indexOf(text);
		if (text.startsWith('"') || text.startsWith("'")) {
			if (!STRING_CELL.test(text)) return null;
		} else if (masked.slice(cellStart, cellStart + text.length) !== text || !SCALAR_CELL.test(text)) {
			return null; // 셀 안에 주석·문자열 조각이 남으면 스칼라가 아니다
		}
		const cellEnd = cellStart + text.length;
		cells.push({ text, gap: code.slice(bound.start, cellStart), commaGap: code.slice(cellEnd, bound.end), end: cellEnd });
	}

	const slots: Slot[] = [{ axis: "open", text: "{", gapBefore: "" }];
	cells.forEach((cell, position) => {
		// 첫 셀은 여는 중괄호에 바로 붙이고(간격 ""), 나머지 셀은 쉼표 뒤 한 칸 간격을 둔다.
		slots.push({ axis: position === 0 ? "cell" : "arg", text: cell.text, gapBefore: cell.gap });
		if (position < cells.length - 1) slots.push({ axis: "comma", text: ",", gapBefore: cell.commaGap });
	});
	slots.push({ axis: "close", text: "}" + sliceAt(code, indices, 3), gapBefore: code.slice(cells[cells.length - 1].end, interior[1]) });
	return { indent: sliceAt(code, indices, 1), slots };
}

export const C_ALIGNER: LineProfiler = {
	language      : "c",
	syntax        : C_SYNTAX,
	// 매크로 치환 목록(replacement)은 행의 마지막 셀이라 패딩해도 맞춰볼 뒤 셀이 없고,
	// 열 축에 넣으면 엔진이 주석 없는 행 끝에 공백을 남기므로 이름 열만 맞춘다.
	// 묶음 행의 cell·arg 축은 뒤에 쉼표나 close 슬롯이 있으므로 열로 맞춰도 줄 끝 공백이 생기지 않는다.
	columnAxes    : ["type", "name", "dotfield", "value", "cell", "arg"],
	canonicalGaps : { semicolon: "", comma: "", equal: " ", open: "", cell: "", arg: " ", close: "" },
	profile(code: string, masked: string): RowProfile | null {
		if (code.trimEnd() !== code) return null;
		if (code.endsWith("\\")) return null;
		return macroProfile(code, masked) ?? fieldProfile(code, masked) ?? assignProfile(code, masked) ?? groupProfile(code, masked);
	},
};
