/**
 * C 프로파일러. 구조 매칭은 문자열·주석을 공백화한 masked로 하고, 셀 텍스트는 code에서 같은
 * 좌표로 자른다(/d 플래그 indices). 지원 표: 구조체·union 필드 `Type name;`, enum 상수
 * `NAME = 값,`, 지정 초기화 `.field = 값,`, 객체형 매크로 `#define 이름 값`. 함수 시그니처,
 * 여는 중괄호가 남는 행, 제어문, return, 비트필드, 배열, 함수형 매크로, 역슬래시 줄 연결처럼
 * 확신 없는 행은 null로 거부해 구획을 끊는다.
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

export const C_ALIGNER: LineProfiler = {
	language      : "c",
	syntax        : C_SYNTAX,
	// 매크로 치환 목록(replacement)은 행의 마지막 셀이라 패딩해도 맞춰볼 뒤 셀이 없고,
	// 열 축에 넣으면 엔진이 주석 없는 행 끝에 공백을 남기므로 이름 열만 맞춘다.
	columnAxes    : ["type", "name", "dotfield", "value"],
	canonicalGaps : { semicolon: "", comma: "", equal: " " },
	profile(code: string, masked: string): RowProfile | null {
		if (code.trimEnd() !== code) return null;
		if (code.endsWith("\\")) return null;
		return macroProfile(code, masked) ?? fieldProfile(code, masked) ?? assignProfile(code, masked);
	},
};
