/**
 * Java 라인 프로파일러. 구조 판정은 문자열 내부·주석을 공백화한 masked로 하고, 셀 텍스트는
 * code의 같은 좌표(/d 플래그 match.indices)에서 자른다. 표로 묶는 행은 다섯 형태로 제한한다.
 *
 * 표 형태:
 * 1. 수식어 초기화 필드 `private static final int MAX_SIZE = 10;`
 * 2. 수식어 선언 필드   `private Type name;`
 * 3. 무수식어 초기화    `int count = 0;`
 * 4. enum 상수          `NAME(1, "x"),` / `NAME,`
 * 5. 중괄호 묶음 행     `{"alpha", 1, "x"},`(셀 2개 이상, 같은 arity끼리 한 표)
 *
 * 거부: 묶음 행 내부에 중첩·대입·호출·첨자가 남는 행, 어노테이션 줄(@로 시작),
 * 제어문·선언 키워드 행, 소괄호를 가진 메서드 시그니처(형태 4의 괄호 인자 제외),
 * 값이 비었거나 문자열 밖 ;를 둘 이상 품는 행 등 확신 없는 행은 null로 거부한다.
 */
import type { CodeSyntax }                     from "../common/code-text.ts";
import type { LineProfiler, RowProfile, Slot } from "../common/table-engine.ts";

export const JAVA_SYNTAX: CodeSyntax = {
	lineComments  : ["//"],
	blockComments : [{ open: "/*", close: "*/" }],
	strings       : [{ open: '"', close: '"', escape: true }],
	cppRaw        : false,
};

const IDENTIFIER = "[A-Za-z_$][A-Za-z0-9_$]*"                                     ;
const TYPE       = `${IDENTIFIER}(?:\\.${IDENTIFIER})*(?:\\[\\])*`                ;
const MODIFIER   = "(?:private|protected|public|static|final|volatile|transient)" ;
const MODIFIERS  = `${MODIFIER}(?:\\s+${MODIFIER})*`                              ;

/** 여는 괄호·중괄호가 남는 행, 어노테이션 줄, 제어문·선언 키워드로 시작하는 행은 행 후보에서 제외한다. */
const RESERVED_START = /^(?:if|for|while|switch|do|else|try|catch|finally|return|throw|new|break|continue|case|default|synchronized|assert|import|package|class|interface|enum|record|extends|implements|this|super)\b/;

const ENUM_WITH_ARGS = new RegExp(`^([ \\t]*)(${IDENTIFIER})(\\s*)(\\([^()]*\\))(\\s*),$`, "du")                    ;
const ENUM_BARE      = new RegExp(`^([ \\t]*)(${IDENTIFIER})(\\s*),$`, "du")                                        ;
const INITIALIZED    = new RegExp(`^([ \\t]*)(${MODIFIERS})(\\s+)(${TYPE})(\\s+)(${IDENTIFIER})(\\s*)=(.*)$`, "du") ;
const DECLARED       = new RegExp(`^([ \\t]*)(${MODIFIERS})(\\s+)(${TYPE})(\\s+)(${IDENTIFIER})(\\s*);$`, "du")     ;
const PLAIN_INIT     = new RegExp(`^([ \\t]*)(${TYPE})(\\s+)(${IDENTIFIER})(\\s*)=(.*)$`, "du")                     ;

/** `{ 셀 , 셀 ... } trailer` — trailer는 뒤따르는 `,` 또는 `;`를 그대로 담는다. */
const GROUP = /^([ \t]*)\{(.*)\}([,;]?)$/du;
/** 묶음 행 셀의 문자열 꼴 — 내부의 쉼표·중괄호는 마스크가 공백화해 경계가 되지 않는다. */
const STRING_CELL = /^"(?:[^"\\]|\\.)*"$/u;
/** 묶음 행 셀의 스칼라 꼴 — 부호 있는 10진·16진·2진 숫자(접미사·밑줄 포함)와 식별자(true·false·null 포함). */
const SCALAR_CELL = /^(?:[+-]?(?:0[xX][0-9A-Fa-f_]+[lL]?|0[bB][01_]+[lL]?|[0-9][0-9_]*(?:\.[0-9_]*)?(?:[eE][+-]?[0-9]+)?[fFdDlL]?)|[A-Za-z_$][A-Za-z0-9_$]*)$/u;
/** 묶음 행 내부에 이 문자들이 마스크에 남으면 중첩·대입·호출·첨자 행이다 — 분해를 시도하지 않는다. */
const GROUP_UNSAFE = /[{}()[\]=]/u;

function slotAt(code: string, match: RegExpExecArray, group: number): string {
	const range = match.indices?.[group];
	return range ? code.slice(range[0], range[1]) : "";
}

/** "=" 뒤 구간(restGroup 그룹)에서 값 셀과 세미콜론을 좌표로 자른다. 마지막 ;만 문장 종결이고, 값 안에 문자열 밖 ;가 더 있으면 확신 없음으로 거부한다. */
function tailSlots(code: string, masked: string, match: RegExpExecArray, restGroup: number): readonly [Slot, Slot] | null {
	const tailStart = match.indices?.[restGroup]?.[0];
	if (tailStart === undefined || masked.endsWith(";") === false) return null;
	const semicolonAt = masked.length - 1 ;
	let valueStart    = tailStart         ;
	let valueEnd      = semicolonAt       ;
	while (valueStart < valueEnd && /\s/.test(masked.charAt(valueStart))) valueStart += 1;
	while (valueEnd > valueStart && /\s/.test(masked.charAt(valueEnd - 1))) valueEnd -= 1;
	if (valueStart === valueEnd) return null;
	if (masked.slice(valueStart, valueEnd).includes(";")) return null;
	const value     : Slot = { axis: "value",     text: code.slice(valueStart, valueEnd), gapBefore: code.slice(tailStart, valueStart) };
	const semicolon : Slot = { axis: "semicolon", text: ";", gapBefore: code.slice(valueEnd, semicolonAt) };
	return [value, semicolon];
}

/**
 * 중괄호 묶음 행 `{"alpha", 1, 0x10},` — 셀 경계는 마스크의 쉼표로 자르고 텍스트는 code에서
 * 같은 좌표로 가져온다. 문자열 셀 안의 쉼표는 마스크가 공백화해 경계가 끊기지 않는다. 셀은
 * 스칼라(문자열·숫자·식별자)만 통과하고, 제네릭·한정 참조처럼 꺾쇠·점이 남은 셀도 스칼라
 * 검사에서 거부한다. close 슬롯(`}` + trailer)이 행의 마지막이라 셀 열을 패딩해도 줄 끝
 * 공백이 생기지 않는다.
 */
function bundleProfile(code: string, masked: string): RowProfile | null {
	const match   = GROUP.exec(masked) ;
	const indices = match?.indices     ;
	if (!match || !indices) return null;
	const interior = indices[2];
	const trailer  = indices[3];
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
		const raw  = code.slice(bound.start, bound.end) ;
		const text = raw.trim()                         ;
		if (text === "") return null; // 연속 쉼표·마지막 쉼표 뒤의 빈 셀
		const cellStart = bound.start + raw.indexOf(text);
		if (text.startsWith('"')) {
			if (!STRING_CELL.test(text)) return null;
		} else if (masked.slice(cellStart, cellStart + text.length) !== text || !SCALAR_CELL.test(text)) {
			return null; // 셀 안에 주석·문자열 조각이 남거나 꺾쇠·점이 있으면 스칼라가 아니다
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
	slots.push({ axis: "close", text: "}" + slotAt(code, match, 3), gapBefore: code.slice(cells[cells.length - 1].end, interior[1]) });
	return { indent: slotAt(code, match, 1), slots };
}

function profileJava(code: string, masked: string): RowProfile | null {
	// 중괄호가 남는 행은 묶음 행 후보뿐이다 — 묶음 행으로도 읽히지 않으면 여전히 거부다.
	if (/[{}]/.test(masked)) return bundleProfile(code, masked);
	const trimmed = masked.trim();
	if (trimmed === "" || trimmed.startsWith("@") || RESERVED_START.test(trimmed)) return null;

	const withArgs = ENUM_WITH_ARGS.exec(masked);
	if (withArgs) {
		return {
			indent : slotAt(code, withArgs, 1),
			slots  : [
				{ axis : "name"      ,      text : slotAt(code, withArgs, 2) , gapBefore : ""                        },
				{ axis : "parenArgs" , text      : slotAt(code, withArgs, 4) , gapBefore : slotAt(code, withArgs, 3) },
				{ axis : "comma"     ,     text  : ","                       , gapBefore : slotAt(code, withArgs, 5) },
			],
		};
	}

	const bare = ENUM_BARE.exec(masked);
	if (bare) {
		return {
			indent : slotAt(code, bare, 1),
			slots  : [
				{ axis: "name",  text: slotAt(code, bare, 2), gapBefore: "" },
				{ axis: "comma", text: ",", gapBefore: slotAt(code, bare, 3) },
			],
		};
	}

	const initialized = INITIALIZED.exec(masked);
	if (initialized) {
		const tail = tailSlots(code, masked, initialized, 8);
		if (!tail) return null;
		return {
			indent : slotAt(code, initialized, 1),
			slots  : [
				{ axis: "modifiers", text: slotAt(code, initialized, 2), gapBefore: "" },
				{ axis: "type",      text: slotAt(code, initialized, 4), gapBefore: slotAt(code, initialized, 3) },
				{ axis: "name",      text: slotAt(code, initialized, 6), gapBefore: slotAt(code, initialized, 5) },
				{ axis: "equal",     text: "=", gapBefore: slotAt(code, initialized, 7) },
				...tail,
			],
		};
	}

	const declared = DECLARED.exec(masked);
	if (declared) {
		return {
			indent : slotAt(code, declared, 1),
			slots  : [
				{ axis : "modifiers" , text      : slotAt(code, declared, 2) , gapBefore : ""                        },
				{ axis : "type"      ,      text : slotAt(code, declared, 4) , gapBefore : slotAt(code, declared, 3) },
				{ axis : "name"      ,      text : slotAt(code, declared, 6) , gapBefore : slotAt(code, declared, 5) },
				{ axis : "semicolon" , text      : ";"                       , gapBefore : slotAt(code, declared, 7) },
			],
		};
	}

	const plain = PLAIN_INIT.exec(masked);
	if (plain) {
		const tail = tailSlots(code, masked, plain, 6);
		if (!tail) return null;
		return {
			indent : slotAt(code, plain, 1),
			slots  : [
				{ axis: "type",  text: slotAt(code, plain, 2), gapBefore: "" },
				{ axis: "name",  text: slotAt(code, plain, 4), gapBefore: slotAt(code, plain, 3) },
				{ axis: "equal", text: "=", gapBefore: slotAt(code, plain, 5) },
				...tail,
			],
		};
	}

	return null;
}

export const JAVA_ALIGNER: LineProfiler = {
	language   : "java",
	syntax     : JAVA_SYNTAX,
	// 묶음 행의 cell·arg 축은 뒤에 쉼표나 close 슬롯이 있으므로 열로 맞춰도 줄 끝 공백이 생기지 않는다.
	columnAxes : ["modifiers", "type", "name", "value", "parenArgs", "cell", "arg"],
	canonicalGaps : {
		// Java 관습: 세미콜론·쉼표는 셀에 바로 붙이고 나머지 구분자는 한 칸 띄운다.
		// 묶음 행은 첫 셀을 여는 중괄호에 바로 붙이고 close도 붙여 닫는 중괄호가 cell 폭을 공유하게 한다.
		modifiers : " ",
		type      : " ",
		name      : " ",
		value     : " ",
		parenArgs : "",
		equal     : " ",
		semicolon : "",
		comma     : "",
		open      : "",
		cell      : "",
		arg       : " ",
		close     : "",
	},
	profile    : profileJava,
};
