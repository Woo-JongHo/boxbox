/**
 * Java 라인 프로파일러. 구조 판정은 문자열 내부·주석을 공백화한 masked로 하고, 셀 텍스트는
 * code의 같은 좌표(/d 플래그 match.indices)에서 자른다. 표로 묶는 행은 네 형태로 제한한다.
 *
 * 표 형태:
 * 1. 수식어 초기화 필드 `private static final int MAX_SIZE = 10;`
 * 2. 수식어 선언 필드   `private Type name;`
 * 3. 무수식어 초기화    `int count = 0;`
 * 4. enum 상수          `NAME(1, "x"),` / `NAME,`
 *
 * 거부: 중괄호가 남는 행(여는 괄호·중괄호가 남는 행 포함), 어노테이션 줄(@로 시작),
 * 제어문·선언 키워드 행, 소괄호를 가진 메서드 시그니처(형태 4의 괄호 인자 제외),
 * 값이 비었거나 문자열 밖 ;를 둘 이상 품는 행 등 확신 없는 행은 null로 거부한다.
 */
import type { CodeSyntax } from "../common/code-text.ts";
import type { LineProfiler, RowProfile, Slot } from "../common/table-engine.ts";

export const JAVA_SYNTAX: CodeSyntax = {
	lineComments : ["//"],
	blockComments : [{ open: "/*", close: "*/" }],
	strings       : [{ open: '"', close: '"', escape: true }],
	cppRaw        : false,
};

const IDENTIFIER = "[A-Za-z_$][A-Za-z0-9_$]*";
const TYPE       = `${IDENTIFIER}(?:\\.${IDENTIFIER})*(?:\\[\\])*`;
const MODIFIER   = "(?:private|protected|public|static|final|volatile|transient)";
const MODIFIERS  = `${MODIFIER}(?:\\s+${MODIFIER})*`;

/** 여는 괄호·중괄호가 남는 행, 어노테이션 줄, 제어문·선언 키워드로 시작하는 행은 행 후보에서 제외한다. */
const RESERVED_START = /^(?:if|for|while|switch|do|else|try|catch|finally|return|throw|new|break|continue|case|default|synchronized|assert|import|package|class|interface|enum|record|extends|implements|this|super)\b/;

const ENUM_WITH_ARGS = new RegExp(`^([ \\t]*)(${IDENTIFIER})(\\s*)(\\([^()]*\\))(\\s*),$`, "du");
const ENUM_BARE      = new RegExp(`^([ \\t]*)(${IDENTIFIER})(\\s*),$`, "du");
const INITIALIZED    = new RegExp(`^([ \\t]*)(${MODIFIERS})(\\s+)(${TYPE})(\\s+)(${IDENTIFIER})(\\s*)=(.*)$`, "du");
const DECLARED       = new RegExp(`^([ \\t]*)(${MODIFIERS})(\\s+)(${TYPE})(\\s+)(${IDENTIFIER})(\\s*);$`, "du");
const PLAIN_INIT     = new RegExp(`^([ \\t]*)(${TYPE})(\\s+)(${IDENTIFIER})(\\s*)=(.*)$`, "du");

function slotAt(code: string, match: RegExpExecArray, group: number): string {
	const range = match.indices?.[group];
	return range ? code.slice(range[0], range[1]) : "";
}

/** "=" 뒤 구간(restGroup 그룹)에서 값 셀과 세미콜론을 좌표로 자른다. 마지막 ;만 문장 종결이고, 값 안에 문자열 밖 ;가 더 있으면 확신 없음으로 거부한다. */
function tailSlots(code: string, masked: string, match: RegExpExecArray, restGroup: number): readonly [Slot, Slot] | null {
	const tailStart = match.indices?.[restGroup]?.[0];
	if (tailStart === undefined || masked.endsWith(";") === false) return null;
	const semicolonAt = masked.length - 1;
	let valueStart = tailStart;
	let valueEnd   = semicolonAt;
	while (valueStart < valueEnd && /\s/.test(masked.charAt(valueStart))) valueStart += 1;
	while (valueEnd > valueStart && /\s/.test(masked.charAt(valueEnd - 1))) valueEnd -= 1;
	if (valueStart === valueEnd) return null;
	if (masked.slice(valueStart, valueEnd).includes(";")) return null;
	const value     : Slot = { axis: "value",     text: code.slice(valueStart, valueEnd), gapBefore: code.slice(tailStart, valueStart) };
	const semicolon : Slot = { axis: "semicolon", text: ";", gapBefore: code.slice(valueEnd, semicolonAt) };
	return [value, semicolon];
}

function profileJava(code: string, masked: string): RowProfile | null {
	if (/[{}]/.test(masked)) return null;
	const trimmed = masked.trim();
	if (trimmed === "" || trimmed.startsWith("@") || RESERVED_START.test(trimmed)) return null;

	const withArgs = ENUM_WITH_ARGS.exec(masked);
	if (withArgs) {
		return {
			indent : slotAt(code, withArgs, 1),
			slots  : [
				{ axis: "name",      text: slotAt(code, withArgs, 2), gapBefore: "" },
				{ axis: "parenArgs", text: slotAt(code, withArgs, 4), gapBefore: slotAt(code, withArgs, 3) },
				{ axis: "comma",     text: ",", gapBefore: slotAt(code, withArgs, 5) },
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
				{ axis: "modifiers", text: slotAt(code, declared, 2), gapBefore: "" },
				{ axis: "type",      text: slotAt(code, declared, 4), gapBefore: slotAt(code, declared, 3) },
				{ axis: "name",      text: slotAt(code, declared, 6), gapBefore: slotAt(code, declared, 5) },
				{ axis: "semicolon", text: ";", gapBefore: slotAt(code, declared, 7) },
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
	language      : "java",
	syntax        : JAVA_SYNTAX,
	columnAxes    : ["modifiers", "type", "name", "value", "parenArgs"],
	canonicalGaps : { modifiers: " ", type: " ", name: " ", value: " ", parenArgs: "", equal: " ", semicolon: "", comma: "" },
	profile       : profileJava,
};
