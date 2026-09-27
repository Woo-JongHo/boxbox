/**
 * Rust 라인 프로파일러. 구조 판정은 문자열 내부·주석이 공백화된 masked로 하고, 셀 텍스트는
 * 같은 좌표의 원본 code에서 자른다(/d 플래그의 match.indices로 좌표를 얻는다).
 *
 * 인정하는 표 행과 축:
 * - 구조체 필드 `name: Type,`                   → name·type 열과 colon·comma 구분자
 * - let 바인딩  `let name: Type = value;`       → name·type·value 열과 keyword·colon·equal·semicolon
 * - let 바인딩  `let name = value;`             → name·value 열과 keyword·equal·semicolon
 * - enum 변형   `Variant(u32),`·`Variant = 5,`  → name·paren·value 열과 equal·comma 구분자
 * - match 갈래  `Pattern => Action,`            → pattern·action 열과 arrow·comma 구분자
 * - 묶음 행     `("alpha", 1, "x"),`·`[1, 22],` → cell·arg 열과 open·comma·close 구분자
 *
 * 거부: fn·struct·impl·enum·mod 등 선언·제어 키워드로 시작하는 행, #[속성] 줄, macro_rules!,
 * `{`·`(`·`[`로 끝나는 여는 행, 간격 자리에 문자열이 숨은 행, 타입을 확신할 수 없는 행,
 * 빈 pattern·action·value 셀. enum 변형은 UpperCamelCase 관습으로 변형 이름을 가려
 * 함수 호출과 구별한다. 묶음 행은 셀 2개 이상인 `(…)`·`[…]` 행만 받고, 내부에 중첩·대입이
 * 남거나 셀이 경로·수명·타입 이름이면 거부한다.
 */
import type { CodeSyntax }                     from "../common/code-text.ts";
import type { LineProfiler, RowProfile, Slot } from "../common/table-engine.ts";

const RUST_SYNTAX: CodeSyntax = {
	lineComments  : ["//"],
	blockComments : [{ open: "/*", close: "*/" }],
	strings       : [{ open: '"', close: '"', escape: true }],
	rustChars     : true,
	cppRaw        : false,
};

/** 이 토큰으로 시작하면 선언·제어 흐름이라 표 행으로 보지 않는다. */
const RUST_HEAD_KEYWORDS = new Set([
	"as",       "async",    "await",
	"break",    "const",    "continue",
	"crate",    "dyn",      "else",
	"enum",     "extern",   "fn",
	"for",      "if",       "impl",
	"in",       "loop",     "macro_rules",
	"match",    "mod",      "move",
	"pub",      "ref",      "return",
	"static",   "struct",   "trait",
	"type",     "union",    "unsafe",
	"use",      "where",    "while",
]);

const INDENT   = "([ \\t]*)"                                           ;
const GAP      = "([ \\t]+)"                                           ;
const OPT_GAP  = "([ \\t]*)"                                           ;
const NAME     = "([A-Za-z_][A-Za-z0-9_]*)"                            ;
const LIFETIME = "'[A-Za-z_][A-Za-z0-9_]*"                             ;
const REF      = `&(?:[ \\t]*${LIFETIME})?[ \\t]*(?:mut[ \\t]+)?`      ;
const PATH     = "[A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*" ;
const GENERIC  = "<[^<>\\n]*(?:<[^<>\\n]*>[^<>\\n]*)*>"                ;
const BRACKET  = "\\[[^\\[\\]\\n]*\\]"                                 ;
const TUPLE    = "\\([^\\(\\)\\n]*\\)"                                 ;
// Rust 타입 식의 안전한 부분집합: 참조·수명 접두와 경로·제네릭 한 단계·슬라이스·튜플만 인정한다.
const TYPE      = `(?:${REF})?(?:${PATH}(?:${GENERIC})?|${BRACKET}|${TUPLE})`;
// 문은 ;로 끊지만 [0; 4]처럼 대괄호 안의 ;는 값에 포함된다. 문자열 내부는 masked에 이미 공백이다.
const VALUE   = "((?:[^;\\n]|\\[[^\\[\\]\\n]*\\])*?)" ;
const PATTERN = "((?:[^=\\n]|=(?!>))*?)"              ;
const PAREN   = "(\\([^\\(\\)\\n]*\\))"               ;

// 괄호·대괄호 묶음 행 — 셀 경계는 마스크의 쉼표로 자르고 기호 쌍은 ()와 []뿐이다.
const GROUP        = /^([ \t]*)([([])(.*)([)\]])(,)?[ \t]*$/du                                                                                                                                      ;
const STRING_CELL  = /^"(?:[^"\\]|\\.)*"$/u                                                                                                                                                         ;
const CHAR_CELL    = /^'(?:[^'\\]|\\.)'$/u                                                                                                                                                          ;
const SCALAR_CELL  = /^(?:[+-]?(?:0[bB][01_]+|0[oO][0-7_]+|0[xX][0-9A-Fa-f_]+|[0-9][0-9_]*(?:\.[0-9_]+)?(?:[eE][+-]?[0-9]+)?)(?:[iu](?:8|16|32|64|128|size)|f(?:32|64))?|[A-Za-z_][A-Za-z0-9_]*)$/u ;
const GROUP_UNSAFE = /[(){}[\]=>]/u                                                                                                                                                                 ;
/** 묶음 행 여는 기호가 받는 닫는 기호 — 짝이 어긋난 `[a, b)` 꼴은 거부한다. */
const CLOSE_OF: Record<string, string> = { "(": ")", "[": "]" };
/** 셀 자리의 원시 타입 이름은 값이 아니라 타입이다 — `("a", u32)` 꼴의 타입 행을 거부한다. */
const TYPE_CELL = new Set([
	"bool", "char", "str",
	"f32",  "f64",
	"i8",   "i16",  "i32", "i64", "i128", "isize",
	"u8",   "u16",  "u32", "u64", "u128", "usize",
]);

const STRUCT_FIELD = new RegExp(`^${INDENT}${NAME}${OPT_GAP}:${OPT_GAP}(${TYPE})${OPT_GAP}(,)?[ \\t]*$`, "du")                                                      ;
const LET_TYPED    = new RegExp(`^${INDENT}(let(?:[ \\t]+mut)?)${GAP}${NAME}${OPT_GAP}:${OPT_GAP}(${TYPE})${GAP}=(?!=)${OPT_GAP}${VALUE}${OPT_GAP};[ \\t]*$`, "du") ;
const LET_PLAIN    = new RegExp(`^${INDENT}(let(?:[ \\t]+mut)?)${GAP}${NAME}${GAP}=(?!=)${OPT_GAP}${VALUE}${OPT_GAP};[ \\t]*$`, "du")                               ;
const ENUM_VARIANT = new RegExp(`^${INDENT}${NAME}${OPT_GAP}${PAREN}?(?:${OPT_GAP}=(?![=>])${OPT_GAP}${VALUE})?${OPT_GAP}(,)?[ \\t]*$`, "du")                       ;
const MATCH_ARM    = new RegExp(`^${INDENT}${PATTERN}${OPT_GAP}=>${OPT_GAP}${VALUE}${OPT_GAP}(,)?[ \\t]*$`, "du")                                                   ;

const cellOf = (code: string, indices: RegExpIndicesArray, group: number): string => {
	const range = indices[group];
	return range === undefined ? "" : code.slice(range[0], range[1]);
};

/** 간격 좌표의 원본이 순수 공백일 때만 돌려준다 — 간격에 문자열이 숨어 있으면 행을 거부한다. */
const gapOf = (code: string, indices: RegExpIndicesArray, group: number): string | null => {
	const range = indices[group];
	if (range === undefined) return "";
	const gap = code.slice(range[0], range[1]);
	return /[^ \t]/u.test(gap) ? null : gap;
};

const gapsOf = (code: string, indices: RegExpIndicesArray, groups: readonly number[]): readonly string[] | null => {
	const gaps: string[] = [];
	for (const group of groups) {
		const gap = gapOf(code, indices, group);
		if (gap === null) return null;
		gaps.push(gap);
	}
	return gaps;
};

/** `name: Type,` — 1 indent·2 name·3 간격·4 간격·5 type·6 간격·7 comma. */
const fieldRow = (code: string, indices: RegExpIndicesArray): RowProfile | null => {
	const gaps = gapsOf(code, indices, [3, 4, 6]);
	if (gaps === null) return null;
	const slots: Slot[] = [
		{ axis : "name"  , text : cellOf(code, indices, 2) , gapBefore : ""      },
		{ axis : "colon" , text : ":"                      , gapBefore : gaps[0] },
		{ axis : "type"  , text : cellOf(code, indices, 5) , gapBefore : gaps[1] },
	];
	if (indices[7] !== undefined) slots.push({ axis: "comma", text: ",", gapBefore: gaps[2] });
	return { indent: cellOf(code, indices, 1), slots };
};

/** `let name: Type = value;` — 1 indent·2 keyword·3 간격·4 name·5 간격·6 간격·7 type·8 간격·9 간격·10 value·11 간격. */
const letTypedRow = (code: string, indices: RegExpIndicesArray): RowProfile | null => {
	const gaps = gapsOf(code, indices, [3, 5, 6, 8, 9, 11]);
	if (gaps === null) return null;
	return {
		indent: cellOf(code, indices, 1),
		slots : [
			{ axis : "keyword"   , text : cellOf(code, indices, 2)  , gapBefore : ""      },
			{ axis : "name"      , text : cellOf(code, indices, 4)  , gapBefore : gaps[0] },
			{ axis : "colon"     , text : ":"                       , gapBefore : gaps[1] },
			{ axis : "type"      , text : cellOf(code, indices, 7)  , gapBefore : gaps[2] },
			{ axis : "equal"     , text : "="                       , gapBefore : gaps[3] },
			{ axis : "value"     , text : cellOf(code, indices, 10) , gapBefore : gaps[4] },
			{ axis : "semicolon" , text : ";"                       , gapBefore : gaps[5] },
		],
	};
};

/** `let name = value;` — 1 indent·2 keyword·3 간격·4 name·5 간격·6 간격·7 value·8 간격. */
const letPlainRow = (code: string, indices: RegExpIndicesArray): RowProfile | null => {
	const gaps = gapsOf(code, indices, [3, 5, 6, 8]);
	if (gaps === null) return null;
	return {
		indent: cellOf(code, indices, 1),
		slots : [
			{ axis : "keyword"   , text : cellOf(code, indices, 2) , gapBefore : ""      },
			{ axis : "name"      , text : cellOf(code, indices, 4) , gapBefore : gaps[0] },
			{ axis : "equal"     , text : "="                      , gapBefore : gaps[1] },
			{ axis : "value"     , text : cellOf(code, indices, 7) , gapBefore : gaps[2] },
			{ axis : "semicolon" , text : ";"                      , gapBefore : gaps[3] },
		],
	};
};

/** `Variant(u32),`·`Variant = 5,` — 1 indent·2 name·3 간격·4 paren·5 간격·6 간격·7 value·8 간격·9 comma.
 * 3번 간격은 paren이 없으면 = 앞까지, paren·value가 모두 없으면 comma 앞까지 이어진다. */
const variantRow = (code: string, indices: RegExpIndicesArray): RowProfile | null => {
	const name = cellOf(code, indices, 2);
	// 변형 이름은 UpperCamelCase 관습으로 가린다 — 소문자면 함수 호출일 수 있어 거부한다.
	if (!/^[A-Z]/u.test(name)) return null;
	const gaps = gapsOf(code, indices, [3, 5, 6, 8]);
	if (gaps === null) return null;
	const hasParen = indices[4] !== undefined ;
	const hasValue = indices[7] !== undefined ;
	const value    = cellOf(code, indices, 7) ;
	if (hasValue && value.trim() === "") return null;
	const slots: Slot[] = [{ axis: "name", text: name, gapBefore: "" }];
	if (hasParen) slots.push({ axis: "paren", text: cellOf(code, indices, 4), gapBefore: gaps[0] });
	if (hasValue) {
		slots.push({ axis: "equal", text: "=", gapBefore: hasParen ? gaps[1] : gaps[0] });
		slots.push({ axis: "value", text: value, gapBefore: gaps[2] });
	}
	if (indices[9] !== undefined) slots.push({ axis: "comma", text: ",", gapBefore: hasParen || hasValue ? gaps[3] : gaps[0] });
	return { indent: cellOf(code, indices, 1), slots };
};

/** `Pattern => Action,` — 1 indent·2 pattern·3 간격·4 간격·5 action·6 간격·7 comma. */
const armRow = (code: string, indices: RegExpIndicesArray): RowProfile | null => {
	const gaps = gapsOf(code, indices, [3, 4, 6]);
	if (gaps === null) return null;
	const pattern = cellOf(code, indices, 2);
	const action  = cellOf(code, indices, 5);
	if (pattern.trim() === "" || action.trim() === "") return null;
	const slots: Slot[] = [
		{ axis : "pattern" , text : pattern , gapBefore : ""      },
		{ axis : "arrow"   , text : "=>"    , gapBefore : gaps[0] },
		{ axis : "action"  , text : action  , gapBefore : gaps[1] },
	];
	if (indices[7] !== undefined) slots.push({ axis: "comma", text: ",", gapBefore: gaps[2] });
	return { indent: cellOf(code, indices, 1), slots };
};

/**
 * 괄호 묶음 행 `("alpha", 1, "x"),`·`[1, 22],` — 셀 경계는 마스크의 쉼표로 자르고 텍스트는
 * code에서 같은 좌표로 가져온다. 문자열·문자 셀 안의 쉼표는 마스크가 공백화해 경계가 끊기지
 * 않는다. 셀은 스칼라(문자열·문자·숫자·식별자)만 통과하고 경로·수명·타입 이름 셀은 거부한다.
 * 여는 기호와 닫는 기호+`,`는 열이 아니라 구조 축이라 셀 열을 패딩해도 줄 끝 공백이 생기지
 * 않고, 기호를 축 이름에 넣어 같은 arity라도 괄호 행과 대괄호 행은 한 표로 묶이지 않는다.
 */
function bundleProfile(code: string, masked: string): RowProfile | null {
	const match   = GROUP.exec(masked) ;
	const indices = match?.indices     ;
	if (!match || !indices) return null;
	const interior   = indices[3]                    ;
	const openRange  = indices[2]                    ;
	const closeRange = indices[4]                    ;
	if (!interior || !openRange || !closeRange) return null;
	const open = code.slice(openRange[0], openRange[1]);
	if (CLOSE_OF[open] !== code.slice(closeRange[0], closeRange[1])) return null;
	if (GROUP_UNSAFE.test(masked.slice(interior[0], interior[1]))) return null; // 중첩·대입·슬라이스 타입이 남은 행

	// 마스크 좌표로 셀 구간을 자른다. 문자열·문자 셀 안의 쉼표는 마스크에서 공백이라 경계가 되지 않는다.
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
		const raw  = code.slice(bound.start, bound.end) ;
		const text = raw.trim()                         ;
		if (text === "") return null; // 연속 쉼표·마지막 쉼표 뒤의 빈 셀
		const cellStart = bound.start + raw.indexOf(text);
		if (text.startsWith('"') || text.startsWith("'")) {
			// 문자열·문자 셀은 마스크가 공백화하니 원본 꼴만 검사한다 — `'a` 수명은 닫힘이 없어 거부된다.
			if (!STRING_CELL.test(text) && !CHAR_CELL.test(text)) return null;
		} else if (masked.slice(cellStart, cellStart + text.length) !== text || !SCALAR_CELL.test(text) || TYPE_CELL.has(text)) {
			return null; // 셀 안에 주석·문자열 조각이 남거나 경로·타입 이름이면 스칼라 값이 아니다
		}
		const cellEnd = cellStart + text.length;
		cells.push({ text, gap: code.slice(bound.start, cellStart), commaGap: code.slice(cellEnd, bound.end), end: cellEnd });
	}

	const [openAxis, closeAxis] = open === "(" ? ["parenOpen", "parenClose"] : ["bracketOpen", "bracketClose"];
	const slots: Slot[] = [{ axis: openAxis, text: open, gapBefore: "" }];
	cells.forEach((cell, position) => {
		// 첫 셀은 여는 기호에 바로 붙이고(간격 ""), 나머지 셀은 쉼표 뒤 한 칸 간격을 둔다.
		slots.push({ axis: position === 0 ? "cell" : "arg", text: cell.text, gapBefore: cell.gap });
		if (position < cells.length - 1) slots.push({ axis: "comma", text: ",", gapBefore: cell.commaGap });
	});
	const closeEnd = indices[5] ? indices[5][1] : closeRange[1];
	slots.push({ axis: closeAxis, text: code.slice(closeRange[0], closeEnd), gapBefore: code.slice(cells[cells.length - 1].end, interior[1]) });
	return { indent: cellOf(code, indices, 1), slots };
}

export const RUST_ALIGNER: LineProfiler = {
	language   : "rust",
	syntax     : RUST_SYNTAX,
	// 묶음 행의 cell·arg 축은 뒤에 쉼표나 close 슬롯이 있으므로 열로 맞춰도 줄 끝 공백이 생기지 않는다.
	columnAxes : ["action", "arg", "cell", "name", "paren", "pattern", "type", "value"],
	canonicalGaps : {
		// Rust 관습: colon·comma·semicolon·paren은 셀에 바로 붙이고 equal·arrow는 한 칸 띄운다.
		colon     : "",
		comma     : "",
		semicolon : "",
		paren     : "",
		arrow     : " ",
		equal     : " ",
		keyword   : " ",
		name      : " ",
		type      : " ",
		value     : " ",
		pattern   : " ",
		action    : " ",
		// 묶음 행은 첫 셀을 여는 기호에 바로 붙이고 닫는 기호+`,`도 바로 붙여 셀 열을 공유하게 한다.
		cell        : "",
		arg         : " ",
		parenOpen   : "",
		parenClose  : "",
		bracketOpen : "",
		bracketClose: "",
	},
	profile(code: string, masked: string): RowProfile | null {
		const tail = code.trimEnd();
		if (tail === "" || /[[({]$/u.test(tail)) return null;
		if (/^[ \t]*#/u.test(code)) return null;
		const head = masked.trimStart().match(/[A-Za-z_][A-Za-z0-9_]*/u)?.[0] ?? "";
		if (RUST_HEAD_KEYWORDS.has(head)) return null;

		const field = STRUCT_FIELD.exec(masked);
		if (field?.indices) return fieldRow(code, field.indices);

		const letTyped = LET_TYPED.exec(masked);
		if (letTyped?.indices) return letTypedRow(code, letTyped.indices);

		const letPlain = LET_PLAIN.exec(masked);
		if (letPlain?.indices) return letPlainRow(code, letPlain.indices);

		const variant = ENUM_VARIANT.exec(masked);
		if (variant?.indices) return variantRow(code, variant.indices);

		const arm = MATCH_ARM.exec(masked);
		if (arm?.indices) return armRow(code, arm.indices);

		const bundle = bundleProfile(code, masked);
		if (bundle) return bundle;

		return null;
	},
};
