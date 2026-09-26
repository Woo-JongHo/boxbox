/**
 * JavaScript 프로파일러. 순수 JavaScript(.js/.mjs/.cjs)의 반복 행을 세 형태의 표 행으로 인정한다:
 * 객체 리터럴 `key: value,`, 클래스 필드·단순 대입 `name = value;`, const 대입 `const name = value;`.
 * 구조 판정은 문자열 내부·주석이 공백화된 masked로 하고, 셀 텍스트는 원본 code에서 같은 좌표로 자른다.
 * 화살표 함수(=>), 닫히지 않은 괄호, 여는 중괄호가 남는 행, 제어문, 확신 없는 행은 표 행으로 인정하지 않는다.
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

function profileLine(code: string, masked: string): RowProfile | null {
	if (masked.includes("=>") || !balanced(masked)) return null;
	const assignment = CONST_ROW.exec(masked);
	if (assignment) return constProfile(code, masked, assignment);
	const field = FIELD_ROW.exec(masked);
	if (field) return fieldProfile(code, masked, field);
	const object = OBJECT_ROW.exec(masked);
	if (object) return objectProfile(code, masked, object);
	return null;
}

export const JAVASCRIPT_ALIGNER: LineProfiler = {
	language      : "javascript",
	syntax        : JAVASCRIPT_SYNTAX,
	columnAxes    : ["key", "name", "value"],
	canonicalGaps : { key: " ", name: " ", value: " ", colon: "", comma: "", equal: " ", semicolon: " ", keyword: " " },
	profile       : profileLine,
};
