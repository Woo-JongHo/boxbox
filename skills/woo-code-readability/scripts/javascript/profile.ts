/**
 * JavaScript 프로파일러. 순수 JavaScript(.js/.mjs/.cjs)의 반복 행을 네 형태의 표 행으로 인정한다:
 * 객체 리터럴 `key: value,`, 클래스 필드·단순 대입 `name = value;`, const 대입 `const name = value;`,
 * 대괄호 묶음 행 `["alpha", 1, "x"],`.
 * 구조 판정은 문자열 내부·주석이 공백화된 masked로 하고, 셀 텍스트는 원본 code에서 같은 좌표로 자른다.
 * 화살표 함수(=>), 닫히지 않은 괄호, 여는 중괄호가 남는 행, 제어문, 확신 없는 행은 표 행으로 인정하지 않는다.
 * 묶음 행은 중첩·대입·호출처럼 내부에 구조 기호가 남으면, 셀이 하나거나 빈 셀이 있으면 인정하지 않는다.
 */
import type { CodeSyntax }                     from "../common/code-text.ts";
import type { LineProfiler, RowProfile, Slot } from "../common/table-engine.ts";

export const JAVASCRIPT_SYNTAX: CodeSyntax = {
	lineComments  : ["//"],
	blockComments : [{ open: "/*", close: "*/" }],
	strings       : [
		{ open : '"' , close : '"' , escape : true },
		{ open : "'" , close : "'" , escape : true },
		{ open : "`" , close : "`" , escape : true },
	],
	cppRaw        : false,
};

/** 행 머리에 올 수 없는 예약어 — 제어문·라벨을 표 행으로 오판하지 않는다. */
const RESERVED = new Set([
	"await", "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do",
	"else", "enum", "export", "extends", "finally", "for", "function", "if", "import", "in", "instanceof",
	"let", "new", "of", "return", "super", "switch", "this", "throw", "try", "typeof", "var", "void",
	"while", "with", "yield",
]);

const CONST_ROW  = /^([ \t]*)(const)([ \t]+)([A-Za-z_$][\w$]*)(\s*)=(?![=>])(\s*)(.+?)(\s*);$/du      ;
const FIELD_ROW  = /^([ \t]*)([A-Za-z_$][\w$]*)(\s*)=(?![=>])(\s*)(.+?)(\s*);$/du                     ;
const OBJECT_ROW = /^([ \t]*)((?:"[^"]*"|'[^']*'|`[^`]*`|[A-Za-z_$][\w$]*))(\s*):(\s*)(.+?)(\s*),$/du ;
/** `const a = 1, b = 2;` 같은 다중 선언 — 두 번째 `=`는 축이 아니므로 거부한다. */
const DECLARATOR = /,\s*[A-Za-z_$][\w$]*\s*=(?!=)/;

/** 묶음 행 `[셀, 셀, ...]` 껴넣기 — indent, 내부, 뒤 `,`/`;` 꼬리로 자른다. */
const BUNDLE_ROW  = /^([ \t]*)\[(.+)\]([,;]?)$/du                                                             ;
/** 묶음 내부에 이 문자들이 마스크에 남으면 중첩·대입·호출·객체가 섞인 행이다 — 분해를 시도하지 않는다. */
const BUNDLE_JUNK = /[[\]{}()=]/u                                                                             ;
/** 묶음 행 셀의 문자열 리터럴 꼴 — "", '', `` 모두 인정하고 내부의 쉼표·대괄호는 마스크가 공백화해 있다. */
const STRING_CELL = /^(?:"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`[^`\\]*(?:\\.[^`\\]*)*`)$/u                  ;
/** 묶음 행 셀의 스칼라 꼴 — 부호 있는 10진 숫자와 식별자(true/false/null/undefined 포함). */
const NUMBER_CELL = /^[+-]?(?:[0-9][0-9_]*(?:\.[0-9_]*)?|\.[0-9_]+)(?:[eE][+-]?[0-9]+)?$/u                    ;
const IDENT_CELL  = /^[A-Za-z_$][A-Za-z0-9_$]*$/u                                                             ;

const CLOSERS: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

/** 마스크의 괄호·대괄호·중괄호 균형을 검사한다. 문자열 내부는 공백화돼 있어 구조 기호만 본다. */
function balanced(masked: string): boolean {
	const stack: string[] = [];
	for (const character of masked) {
		if (character === "(" || character === "[" || character === "{") stack.push(character);
		else if (character in CLOSERS && stack.pop() !== CLOSERS[character]) return false;
	}
	return stack.length === 0;
}

function sliceAt(code: string, indices: RegExpIndicesArray, group: number): string {
	const range = indices[group];
	return range ? code.slice(range[0], range[1]) : "";
}

function constProfile(code: string, masked: string, match: RegExpExecArray): RowProfile | null {
	const indices = match.indices;
	if (!indices) return null;
	const value = sliceAt(masked, indices, 7);
	if (value.includes(";") || DECLARATOR.test(value)) return null;
	const slots: Slot[] = [
		{ axis : "keyword"   ,   text    : sliceAt(code, indices, 2) , gapBefore                       : ""                        },
		{ axis : "name"      ,      text : sliceAt(code, indices, 4) , gapBefore                       : sliceAt(code, indices, 3) },
		{ axis : "equal"     ,     text  : "="                       ,                       gapBefore : sliceAt(code, indices, 5) },
		{ axis : "value"     ,     text  : sliceAt(code, indices, 7) , gapBefore                       : sliceAt(code, indices, 6) },
		{ axis : "semicolon" , text      : ";"                       ,                       gapBefore : sliceAt(code, indices, 8) },
	];
	return { indent: sliceAt(code, indices, 1), slots };
}

function fieldProfile(code: string, masked: string, match: RegExpExecArray): RowProfile | null {
	const indices = match.indices;
	if (!indices) return null;
	if (RESERVED.has(sliceAt(masked, indices, 2))) return null;
	const value = sliceAt(masked, indices, 5);
	if (value.includes(";") || DECLARATOR.test(value)) return null;
	const slots: Slot[] = [
		{ axis : "name"      ,      text : sliceAt(code, indices, 2) , gapBefore                       : ""                        },
		{ axis : "equal"     ,     text  : "="                       ,                       gapBefore : sliceAt(code, indices, 3) },
		{ axis : "value"     ,     text  : sliceAt(code, indices, 5) , gapBefore                       : sliceAt(code, indices, 4) },
		{ axis : "semicolon" , text      : ";"                       ,                       gapBefore : sliceAt(code, indices, 6) },
	];
	return { indent: sliceAt(code, indices, 1), slots };
}

function objectProfile(code: string, masked: string, match: RegExpExecArray): RowProfile | null {
	const indices = match.indices;
	if (!indices) return null;
	if (RESERVED.has(sliceAt(masked, indices, 2))) return null;
	const value = sliceAt(masked, indices, 5);
	if (value.includes(";") || DECLARATOR.test(value)) return null;
	const slots: Slot[] = [
		{ axis : "key"   ,   text : sliceAt(code, indices, 2) , gapBefore                       : ""                        },
		{ axis : "colon" , text   : ":"                       ,                       gapBefore : sliceAt(code, indices, 3) },
		{ axis : "value" , text   : sliceAt(code, indices, 5) , gapBefore                       : sliceAt(code, indices, 4) },
		{ axis : "comma" , text   : ","                       ,                       gapBefore : sliceAt(code, indices, 6) },
	];
	return { indent: sliceAt(code, indices, 1), slots };
}

/** 셀 자리의 원본과 마스크를 대조해 스칼라만 통과시킨다 — 주석·문자열 조각이 남으면 거부한다. */
function isScalarCell(masked: string, start: number, text: string): boolean {
	const quote = text[0];
	if (quote === '"' || quote === "'" || quote === "`") return STRING_CELL.test(text);
	if (masked.slice(start, start + text.length) !== text) return false;
	return NUMBER_CELL.test(text) || IDENT_CELL.test(text);
}

/**
 * 묶음 행 `["alpha", 1, "x"],` — 대괄호 한 겹의 스칼라 나열을 open·cell·arg·comma·close 축으로 분해한다.
 * 셀 경계는 마스크의 쉼표로 자르고 텍스트는 code에서 같은 좌표로 가져오므로 문자열 안의 쉼표는 경계가 되지 않는다.
 * 셀은 스칼라(문자열·숫자·식별자)만 통과하고, 셀이 하나끼거나 빈 셀이 있으면 거부한다.
 */
function bundleProfile(code: string, masked: string, match: RegExpExecArray): RowProfile | null {
	const indices = match.indices        ;
	if (!indices) return null            ;
	const interior = indices[2]          ;
	const trailer  = indices[3]          ;
	if (!interior || !trailer) return null;
	if (BUNDLE_JUNK.test(masked.slice(interior[0], interior[1]))) return null;

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
	if (bounds.length < 2) return null; // 셀이 하나뿐인 행은 묶음 표가 아니다

	const cells: Array<{ text: string; gap: string; commaGap: string; end: number }> = [];
	for (const bound of bounds) {
		const raw  = code.slice(bound.start, bound.end);
		const text = raw.trim()                                     ;
		if (text === "") return null; // 연속 쉼표·닫는 대괄호 앞의 빈 셀
		const cellStart = bound.start + raw.indexOf(text)           ;
		if (!isScalarCell(masked, cellStart, text)) return null     ;
		const cellEnd = cellStart + text.length                     ;
		cells.push({ text, gap: code.slice(bound.start, cellStart), commaGap: code.slice(cellEnd, bound.end), end: cellEnd });
	}

	const slots: Slot[] = [{ axis: "open", text: "[", gapBefore: "" }];
	cells.forEach((cell, position) => {
		// 첫 셀은 여는 대괄호에 바로 붙이고(간격 ""), 나머지 셀은 쉼표 뒤 한 칸 간격을 둔다.
		slots.push({ axis: position === 0 ? "cell" : "arg", text: cell.text, gapBefore: cell.gap });
		if (position < cells.length - 1) slots.push({ axis: "comma", text: ",", gapBefore: cell.commaGap });
	});
	// 닫는 슬롯이 행의 마지막이라 마지막 셀 열을 패딩해도 줄 끝 공백이 생기지 않는다.
	slots.push({ axis: "close", text: "]" + sliceAt(code, indices, 3), gapBefore: code.slice(cells[cells.length - 1].end, interior[1]) });
	return { indent: sliceAt(code, indices, 1), slots };
}

function profileLine(code: string, masked: string): RowProfile | null {
	if (masked.includes("=>") || !balanced(masked)) return null;
	const assignment = CONST_ROW.exec(masked);
	if (assignment) return constProfile(code, masked, assignment);
	const field = FIELD_ROW.exec(masked);
	if (field) return fieldProfile(code, masked, field);
	const object = OBJECT_ROW.exec(masked);
	if (object) return objectProfile(code, masked, object);
	const bundle = BUNDLE_ROW.exec(masked);
	if (bundle) return bundleProfile(code, masked, bundle);
	return null;
};

export const JAVASCRIPT_ALIGNER: LineProfiler = {
	language      : "javascript",
	syntax        : JAVASCRIPT_SYNTAX,
	// 묶음 행의 cell·arg 축은 뒤에 쉼표나 close 슬롯이 있으므로 열로 맞춰도 줄 끝 공백이 생기지 않는다.
	columnAxes    : ["key", "name", "value", "cell", "arg"],
	canonicalGaps : { key: " ", name: " ", value: " ", cell: "", arg: " ", colon: "", comma: "", equal: " ", semicolon: " ", keyword: " ", open: "", close: "" },
	profile       : profileLine,
};
