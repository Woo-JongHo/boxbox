/**
 * Python 라인 프로파일러. 구조 판정은 문자열 내부·주석을 공백화한 masked로 하고, 셀 텍스트는
 * code의 같은 좌표(/d 플래그 match.indices)에서 자른다. 표로 묶는 행은 다섯 형태로 제한한다.
 *
 * 표 형태:
 * 1. 어노테이션 대입   `name: Type = value`  → name·colon·type·equal·value
 * 2. 데이터클래스 필드 `name: Type`          → name·colon·type
 * 3. 딕셔너리 행       `"key": value,`       → key(따옴표 포함)·colon·value·comma
 * 4. 단순 대입         `name = value`        → name·equal·value
 * 5. 묶음 행           `["a", 1, "x"],`      → cell·arg 열과 open·comma·close 구분자
 *
 * 거부: 묶음 행이 아니면서 괄호·중괄호·대괄호가 남는 행(호출·컨테이너·첨자·def 시그니처),
 * 줄 끝 연속 문자(\)가 남는 행, 데코레이터·def·class·제어문·가져오기 행, 값이 비었거나 =로
 * 시작하거나 ;·,를 품는 행, 행 끝에 공백이 남는 행 등 확신 없는 행은 null로 거부한다.
 * 거부는 안전, 오인식은 위험.
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

/** 묶음 행 `[ 셀 , 셀 ... ] trailer`·`( 셀 , 셀 ... ) trailer` — trailer는 뒤따르는 `,`를 그대로 담는다. */
const BUNDLED       = /^([ \t]*)([[(])(.*)([\])])(,?)[ \t]*$/du                                         ;
/** 묶음 행 셀의 문자열 꼴 — 내부의 쉼표·괄호는 마스크가 공백화해 있다. */
const BUNDLE_STRING = /^"(?:[^"\\]|\\.)*"$|^'(?:[^'\\]|\\.)*'$/u                                        ;
/** 묶음 행 셀의 스칼라 꼴 — 부호 있는 10진·16진·지수 숫자와 식별자(True·False·None 포함). */
const BUNDLE_SCALAR = /^(?:[+-]?(?:0[xX][0-9A-Fa-f_]+|[0-9][0-9_]*(?:\.[0-9_]+)?(?:[eE][+-]?[0-9]+)?)|[A-Za-z_][A-Za-z0-9_]*)$/u;
/** 묶음 행 내부에 이 문자들이 마스크에 남으면 중첩·대입·첨자·연속 행이다 — 분해를 시도하지 않는다. */
const BUNDLE_UNSAFE = /[[\]{}()=\\]/u                                                                   ;

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

/**
 * 묶음 행 `["alpha", 1, "x"],`·`("ccc", 333, "z"),` — 리스트·튜플 데이터 행이다. 셀 경계는
 * 마스크의 쉼표로 자르고 텍스트는 code에서 같은 좌표로 가져온다. 문자열 셀 안의 쉼표는
 * 마스크가 공백화해 경계가 끊기지 않는다. 셀은 스칼라(문자열·숫자·식별자)만 통과하고 내부에
 * 중첩·대입·첨자가 남으면 거부한다. 기호 쌍을 open·close 축 이름에 넣어 `[` 표와 `(` 표가
 * 섞이지 않게 하고, arity도 축 나열에 담아 같은 arity끼리만 한 표로 묶인다. close 슬롯(닫는
 * 기호+trailer)이 행의 마지막이라 셀 열을 패딩해도 줄 끝 공백이 생기지 않는다.
 */
function bundleProfile(code: string, masked: string): RowProfile | null {
	const match = BUNDLED.exec(masked);
	const indices = match?.indices;
	if (!match || !indices) return null;
	const open = match[2];
	const close = match[4];
	if ((open === "[") !== (close === "]")) return null; // 기호 쌍이 어긋나면 묶음이 아니다
	const interior = indices[3];
	const trailer = indices[5];
	if (!interior || !trailer) return null;
	if (BUNDLE_UNSAFE.test(masked.slice(interior[0], interior[1]))) return null;

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
			if (!BUNDLE_STRING.test(text)) return null;
		} else if (masked.slice(cellStart, cellStart + text.length) !== text || !BUNDLE_SCALAR.test(text)) {
			return null; // f-string 접두·문자열 조각이 남은 셀은 스칼라가 아니다
		}
		const cellEnd = cellStart + text.length;
		cells.push({ text, gap: code.slice(bound.start, cellStart), commaGap: code.slice(cellEnd, bound.end), end: cellEnd });
	}

	const slots: Slot[] = [{ axis: open === "[" ? "open[" : "open(", text: open, gapBefore: "" }];
	cells.forEach((cell, position) => {
		// 첫 셀은 여는 기호에 바로 붙이고(간격 ""), 나머지 셀은 쉼표 뒤 한 칸 간격을 둔다.
		slots.push({ axis: position === 0 ? "cell" : "arg", text: cell.text, gapBefore: cell.gap });
		if (position < cells.length - 1) slots.push({ axis: "comma", text: ",", gapBefore: cell.commaGap });
	});
	slots.push({ axis: close === "]" ? "close]" : "close)", text: close + slotAt(code, match, 5), gapBefore: code.slice(cells[cells.length - 1].end, interior[1]) });
	return { indent: slotAt(code, match, 1), slots };
}

function profilePython(code: string, masked: string): RowProfile | null {
	const trimmed = masked.trim();
	if (trimmed === "" || trimmed.startsWith("@") || RESERVED_START.test(trimmed)) return null;
	// 묶음 행은 괄호가 남는 형태라 isUnsafe 검사보다 먼저 분해한다. 묶음이 아니면서 괄호가
	// 남는 행은 아래 isUnsafe가 거부한다 — 기존 거부 규칙은 그대로 유지된다.
	const bundle = bundleProfile(code, masked);
	if (bundle) return bundle;
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
	// 묶음 행의 cell·arg 축은 뒤에 쉼표나 close 슬롯이 있으므로 열로 맞춰도 줄 끝 공백이 생기지 않는다.
	columnAxes    : ["name", "key", "type", "value", "cell", "arg"],
	// Python 관습: colon과 comma는 셀에 바로 붙이고 equal은 한 칸 띄운다. 묶음 행은 첫 셀을
	// 여는 기호에 바로 붙이고 close도 붙여 닫는 기호가 마지막 셀 폭을 공유하게 한다.
	canonicalGaps : { name: " ", key: " ", type: " ", value: " ", colon: "", equal: " ", comma: "", cell: "", arg: " ", "open[": "", "open(": "", "close]": "", "close)": "" },
	profile       : profilePython,
};
