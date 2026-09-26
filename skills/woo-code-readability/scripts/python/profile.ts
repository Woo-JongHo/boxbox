/**
 * Python 라인 프로파일러. 구조 판정은 문자열 내부·주석을 공백화한 masked로 하고, 셀 텍스트는
 * code의 같은 좌표(/d 플래그 match.indices)에서 자른다. 표로 묶는 행은 네 형태로 제한한다.
 *
 * 표 형태:
 * 1. 어노테이션 대입   `name: Type = value`  → name·colon·type·equal·value
 * 2. 데이터클래스 필드 `name: Type`          → name·colon·type
 * 3. 딕셔너리 행       `"key": value,`       → key(따옴표 포함)·colon·value·comma
 * 4. 단순 대입         `name = value`        → name·equal·value
 *
 * 거부: 괄호·중괄호·대괄호가 남는 행(호출·컨테이너·첨자·def 시그니처), 줄 끝 연속 문자(\)가
 * 남는 행, 데코레이터·def·class·제어문·가져오기 행, 값이 비었거나 =로 시작하거나 ;·,를
 * 품는 행, 행 끝에 공백이 남는 행 등 확신 없는 행은 null로 거부한다. 거부는 안전, 오인식은 위험.
 */
import type { CodeSyntax, LineProfiler, RowProfile, Slot } from "../common/table-engine.ts";

export const PYTHON_SYNTAX: CodeSyntax = {
	lineComments  : ["#"],
	blockComments : [],
	strings       : [
		{ open : '"""' , close   : '"""' , escape   : true },
		{ open : "'''" , close   : "'''" , escape   : true },
		{ open : '"'   ,   close : '"'   ,   escape : true },
		{ open : "'"   ,   close : "'"   ,   escape : true },
	],
	cppRaw        : false,
};

const INDENT = "([ \\t]*)"                                              ;
const NAME   = "([A-Za-z_][A-Za-z0-9_]*)"                               ;
const QUOTED = "(\"[^\"]*\"|'[^']*')"                                   ;
const TYPE   = "([A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z_][A-Za-z0-9_]*)*)" ;
const GAP    = "(\\s*)"                                                 ;
const VALUE  = "(.+?)"                                                  ;

/** 표 행이 될 수 없는 문 시작 — 제어문·선언·가져오기. match·case는 소프트 키워드라 제외한다. */
const RESERVED_START = /^(?:if|elif|else|for|while|try|except|finally|with|def|class|return|raise|import|from|pass|break|continue|lambda|yield|assert|del|global|nonlocal|async|await)\b/;

const ANNOTATED = new RegExp(`^${INDENT}${NAME}${GAP}:${GAP}${TYPE}${GAP}=${GAP}${VALUE}${GAP}$`, "du") ;
const DECLARED  = new RegExp(`^${INDENT}${NAME}${GAP}:${GAP}${TYPE}$`, "du")                            ;
const DICT_ROW  = new RegExp(`^${INDENT}${QUOTED}${GAP}:${GAP}${VALUE}${GAP},$`, "du")                  ;
const ASSIGNED  = new RegExp(`^${INDENT}${NAME}${GAP}=${GAP}${VALUE}${GAP}$`, "du")                     ;

function slotAt(code: string, match: RegExpExecArray, group: number): string {
	const range = match.indices?.[group];
	return range ? code.slice(range[0], range[1]) : "";
}

/** 여는 괄호·중괄호·대괄호나 연속 문자(\)가 마스크에 남으면 호출·컨테이너·첨자·연속 행이다. */
function isUnsafe(masked: string): boolean {
	return /[(){}[\]]/.test(masked) || masked.includes("\\");
}

/** 값 셀을 원본 좌표로 자르고 확신 없는 값을 거부한다. 비었거나 =로 시작(== 비교)하거나 ;·,를 품으면 안 된다. */
function valueSlot(code: string, masked: string, match: RegExpExecArray, gapGroup: number, textGroup: number): Slot | null {
	const gapRange  = match.indices?.[gapGroup];
	const textRange = match.indices?.[textGroup];
	if (!gapRange || !textRange) return null;
	const text = code.slice(textRange[0], textRange[1]);
	if (text.trim() === "" || text.startsWith("=")) return null;
	if (/[;,]/.test(masked.slice(textRange[0], textRange[1]))) return null;
	return { axis: "value", text, gapBefore: code.slice(gapRange[0], gapRange[1]) };
}

function profilePython(code: string, masked: string): RowProfile | null {
	const trimmed = masked.trim();
	if (trimmed === "" || trimmed.startsWith("@") || RESERVED_START.test(trimmed)) return null;
	if (isUnsafe(masked)) return null;

	const annotated = ANNOTATED.exec(masked);
	if (annotated) {
		if (slotAt(code, annotated, 9) !== "") return null;
		const value = valueSlot(code, masked, annotated, 7, 8);
		if (!value) return null;
		return {
			indent : slotAt(code, annotated, 1),
			slots  : [
				{ axis: "name",  text: slotAt(code, annotated, 2), gapBefore: "" },
				{ axis: "colon", text: ":", gapBefore: slotAt(code, annotated, 3) },
				{ axis: "type",  text: slotAt(code, annotated, 5), gapBefore: slotAt(code, annotated, 4) },
				{ axis: "equal", text: "=", gapBefore: slotAt(code, annotated, 6) },
				value,
			],
		};
	}

	const declared = DECLARED.exec(masked);
	if (declared) {
		return {
			indent : slotAt(code, declared, 1),
			slots  : [
				{ axis : "name"  ,  text : slotAt(code, declared, 2) , gapBefore : ""                        },
				{ axis : "colon" , text  : ":"                       , gapBefore : slotAt(code, declared, 3) },
				{ axis : "type"  ,  text : slotAt(code, declared, 5) , gapBefore : slotAt(code, declared, 4) },
			],
		};
	}

	const dictRow = DICT_ROW.exec(masked);
	if (dictRow) {
		const value = valueSlot(code, masked, dictRow, 4, 5);
		if (!value) return null;
		return {
			indent : slotAt(code, dictRow, 1),
			slots  : [
				{ axis: "key",   text: slotAt(code, dictRow, 2), gapBefore: "" },
				{ axis: "colon", text: ":", gapBefore: slotAt(code, dictRow, 3) },
				value,
				{ axis: "comma", text: ",", gapBefore: slotAt(code, dictRow, 6) },
			],
		};
	}

	const assigned = ASSIGNED.exec(masked);
	if (assigned) {
		if (slotAt(code, assigned, 6) !== "") return null;
		const value = valueSlot(code, masked, assigned, 4, 5);
		if (!value) return null;
		return {
			indent : slotAt(code, assigned, 1),
			slots  : [
				{ axis: "name",  text: slotAt(code, assigned, 2), gapBefore: "" },
				{ axis: "equal", text: "=", gapBefore: slotAt(code, assigned, 3) },
				value,
			],
		};
	}

	return null;
}

export const PYTHON_ALIGNER: LineProfiler = {
	language      : "python",
	syntax        : PYTHON_SYNTAX,
	columnAxes    : ["name", "key", "type", "value"],
	canonicalGaps : { name: " ", key: " ", type: " ", value: " ", colon: "", equal: " ", comma: "" },
	profile       : profilePython,
};
