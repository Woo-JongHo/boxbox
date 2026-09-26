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
 *
 * 거부: fn·struct·impl·enum·mod 등 선언·제어 키워드로 시작하는 행, #[속성] 줄, macro_rules!,
 * `{`·`(`·`[`로 끝나는 여는 행, 간격 자리에 문자열이 숨은 행, 타입을 확신할 수 없는 행,
 * 빈 pattern·action·value 셀. enum 변형은 UpperCamelCase 관습으로 변형 이름을 가려
 * 함수 호출과 구별한다.
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

export const RUST_ALIGNER: LineProfiler = {
	language   : "rust",
	syntax     : RUST_SYNTAX,
	columnAxes : ["action", "name", "paren", "pattern", "type", "value"],
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

		return null;
	},
};
