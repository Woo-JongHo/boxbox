/**
 * C++ 라인 프로파일러. 구조 매칭은 문자열 내부·주석이 공백화된 masked 줄로 하고, 셀 텍스트는
 * code에서 같은 좌표(/d 플래그 indices)로 자른다. 중괄호 묶음 행(`{"alpha", 1, 0x10},`)은 스칼라
 * 셀 2개 이상인 초기화 리스트 행만 인정한다. 확신 없는 행 — 함수 시그니처, template 선언 줄,
 * 남는 중괄호, 제어문, R"( 원본 문자열이 열려 있는 줄, type 셀에 소괄호(함수 포인터), 함수형
 * 매크로, interior에 `{}()[]=>`가 남은 묶음(중첩·대입·람다) — 는 null로 거부한다. 엔진의
 * 무손실 검증이 두 번째 안전장치다.
 */
import type { CodeSyntax }                     from "../common/code-text.ts";
import type { LineProfiler, RowProfile, Slot } from "../common/table-engine.ts";

const SYNTAX: CodeSyntax = {
	lineComments  : ["//"],
	blockComments : [{ open: "/*", close: "*/" }],
	strings       : [{ open: '"', close: '"', escape: true }, { open: "'", close: "'", escape: true }],
	cppRaw        : true,
};

/** 네임스페이스 자격(::)과 템플릿 인자(1단 중첩까지)를 품은 한 단어. */
const SEGMENT = String.raw`[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*(?:<(?:[^<>]|<[^<>]*>)*>)?`;
/** 포인터·참조·const 등을 품은 타입 셀. 소괄호는 함수 포인터 신호라 애초에 문자 배제다. */
const TYPE = String.raw`${SEGMENT}(?:[ \t]*[*&]+|[ \t]+(?:const|constexpr|static|inline|mutable|volatile|unsigned|signed|short|long)|[ \t]+${SEGMENT})*(?:[ \t]*[*&]+)?`;
const NAME = String.raw`[A-Za-z_]\w*`;

/** 지정 초기화 `.field = value,` */
const DESIGNATED = new RegExp(String.raw`^([ \t]*)(\.${NAME})([ \t]*)=([ \t]*)([^ ,=;].*?)([ \t]*),$`, "du");
/** enum 클래스 상수 `Name = value,` */
const ENUM_CONSTANT = new RegExp(String.raw`^([ \t]*)(${NAME})([ \t]*)=([ \t]*)([^ ,=;].*?)([ \t]*),$`, "du");
/** 객체형 매크로 `#define NAME value` — 이름 바로 뒤 `(`가 붙는 함수형은 이 꼴이 아니다.
 *  value는 마지막 열이라 정렬 패딩이 줄 끝에 남는다. 뒤따른 공백을 셀 안으로 흡수해
 *  재실행 때도 같은 표로 다시 읽히게 한다(무손실·멱등). */
const DEFINE = new RegExp(String.raw`^([ \t]*)(#[ \t]*define)([ \t]+)(${NAME})([ \t]+)([^ \t].*?)$`, "du");
/** 필드 선언 `Type name;` */
const FIELD = new RegExp(String.raw`^([ \t]*)(${TYPE})([ \t]+)(${NAME})([ \t]*);$`, "du");
/** 필드 초기화 `Type name = value;` */
const FIELD_INIT = new RegExp(String.raw`^([ \t]*)(${TYPE})([ \t]+)(${NAME})([ \t]*)=([ \t]*)(.+?)([ \t]*);$`, "du");
/** 묶음 행 셀 — 문자열(마스크상 `"…"`·`'…'`), 숫자, `std::` 경로·nullptr·true/false 같은 식별자뿐이다. */
const BUNDLE_CELL = /^(?:"[^"]*"|'[^']*'|[+-]?\d[\w.]*|[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*)$/u;
/** 묶음 interior에 하나라도 남으면 중첩 묶음·대입·람다·인덱스·비교다 — 마스크 기준으로 거부한다. */
const BUNDLE_UNSAFE = /[{}()[\]=>]/u;

/** 머리에 오면 필드 표가 되지 않는 단어들 — 문·제어문·선언 서두·접근 지정자. */
const BLOCKED_HEADS = new Set([
	"case", "catch", "class", "delete", "do", "else", "enum", "for", "friend", "goto", "if",
	"namespace", "new", "operator", "private", "protected", "public", "return", "struct",
	"switch", "throw", "typedef", "union", "using", "while",
]);

const cell = (code: string, indices: RegExpIndicesArray, group: number): string => {
	const range = indices[group];
	return range ? code.slice(range[0], range[1]) : "";
};

const slot = (axis: string, text: string, gapBefore: string): Slot => ({ axis, text, gapBefore });

const blockedType = (type: string): boolean => {
	const head = /^[A-Za-z_]\w*/.exec(type)?.[0];
	return head !== undefined && BLOCKED_HEADS.has(head);
};

/** 마스크 값 축에 = ; 가 남아 있으면 한 줄에 문이 이어진 행이다 — 지정 초기화·enum 상수 거부. */
const continuationValue = (value: string): boolean => value.includes("=") || value.includes(";");

function profileDesignated(code: string, masked: string): RowProfile | null {
	const match  = DESIGNATED.exec(masked);
	const indices = match?.indices;
	if (!match || !indices) return null;
	if (continuationValue(cell(masked, indices, 5))) return null;
	return {
		indent : cell(code, indices, 1),
		slots  : [
			slot("dotfield", cell(code, indices, 2), ""),
			slot("equal", "=", cell(code, indices, 3)),
			slot("value", cell(code, indices, 5), cell(code, indices, 4)),
			slot("comma", ",", cell(code, indices, 6)),
		],
	};
}

function profileEnumConstant(code: string, masked: string): RowProfile | null {
	const match  = ENUM_CONSTANT.exec(masked);
	const indices = match?.indices;
	if (!match || !indices) return null;
	if (continuationValue(cell(masked, indices, 5))) return null;
	return {
		indent : cell(code, indices, 1),
		slots  : [
			slot("name", cell(code, indices, 2), ""),
			slot("equal", "=", cell(code, indices, 3)),
			slot("value", cell(code, indices, 5), cell(code, indices, 4)),
			slot("comma", ",", cell(code, indices, 6)),
		],
	};
}

function profileDefine(code: string, masked: string): RowProfile | null {
	const match  = DEFINE.exec(masked);
	const indices = match?.indices;
	if (!match || !indices) return null;
	return {
		indent : cell(code, indices, 1),
		slots  : [
			slot("directive", cell(code, indices, 2), ""),
			slot("name", cell(code, indices, 4), cell(code, indices, 3)),
			slot("value", cell(code, indices, 6), cell(code, indices, 5)),
		],
	};
}

function profileField(code: string, masked: string): RowProfile | null {
	const match  = FIELD.exec(masked);
	const indices = match?.indices;
	if (!match || !indices) return null;
	const type = cell(code, indices, 2);
	if (blockedType(type)) return null;
	return {
		indent : cell(code, indices, 1),
		slots  : [
			slot("type", type, ""),
			slot("name", cell(code, indices, 4), cell(code, indices, 3)),
			slot("semicolon", ";", cell(code, indices, 5)),
		],
	};
}

function profileFieldInit(code: string, masked: string): RowProfile | null {
	const match  = FIELD_INIT.exec(masked);
	const indices = match?.indices;
	if (!match || !indices) return null;
	const type = cell(code, indices, 2);
	if (blockedType(type)) return null;
	// 값 축의 ; 는 마스크를 통과한 코드 세미콜론 — 한 줄에 문이 이어진 행이다.
	if (cell(masked, indices, 7).includes(";")) return null;
	return {
		indent : cell(code, indices, 1),
		slots  : [
			slot("type", type, ""),
			slot("name", cell(code, indices, 4), cell(code, indices, 3)),
			slot("equal", "=", cell(code, indices, 5)),
			slot("value", cell(code, indices, 7), cell(code, indices, 6)),
			slot("semicolon", ";", cell(code, indices, 8)),
		],
	};
}

/** 중괄호 묶음 행 `{"alpha", 1, 0x10},` — 초기화 리스트 한 행. 셀 텍스트는 뒤따르는 `,`까지,
 *  마지막 셀은 `}`와 뒤따르는 `,`·`;` 꼬리까지 한 슬롯으로 흡수한다. 엔진 패딩이 쉼표 뒤에
 *  붙어 `{"b",     22,  2}`처럼 쉼표가 셀에 붙은 실전 모양이 유지되고, 마지막 열 셀이 행의
 *  마지막 슬롯이라 엔진 규칙대로 패딩되지 않는다. 셀은 2개 이상이며 스칼라만 허용한다. */
function profileBundle(code: string, masked: string): RowProfile | null {
	const openAt = masked.indexOf("{");
	if (openAt < 0 || masked.slice(0, openAt).trim() !== "") return null;
	const closeAt = masked.lastIndexOf("}");
	if (closeAt <= openAt) return null;
	const trailer = code.slice(closeAt + 1);
	if (!/^[,;]?$/u.test(trailer)) return null;
	if (BUNDLE_UNSAFE.test(masked.slice(openAt + 1, closeAt))) return null;
	const stops: number[] = [];
	for (let comma = masked.indexOf(",", openAt + 1); comma >= 0 && comma < closeAt; comma = masked.indexOf(",", comma + 1)) {
		stops.push(comma);
	}
	if (stops.length === 0) return null;
	const edges = [openAt + 1, ...stops.map(comma => comma + 1)];
	const slots: Slot[] = [slot("open", "{", "")];
	for (let position = 0; position < edges.length; position += 1) {
		const from = edges[position]                                     ;
		const to   = position < stops.length ? stops[position] : closeAt ;
		const lead = masked.slice(from, to).search(/\S/u)                ;
		if (lead < 0) return null;
		if (!BUNDLE_CELL.test(masked.slice(from + lead, to).trim())) return null;
		const textEnd = position < stops.length ? stops[position] + 1 : closeAt + 1 + trailer.length;
		slots.push(slot(position === 0 ? "item0" : "item", code.slice(from + lead, textEnd), code.slice(from, from + lead)));
	}
	return { indent: code.slice(0, openAt), slots };
}

export const CPP_ALIGNER: LineProfiler = {
	language      : "cpp",
	syntax        : SYNTAX,
	columnAxes    : ["type", "name", "value", "dotfield", "item0", "item"],
	canonicalGaps : { type: " ", name: " ", value: " ", dotfield: " ", directive: " ", equal: " ", semicolon: "", comma: "", open: "", item0: "", item: " " },
	profile(code: string, masked: string): RowProfile | null {
		return profileDesignated(code, masked) ?? profileEnumConstant(code, masked) ?? profileDefine(code, masked)
			?? profileField(code, masked) ?? profileFieldInit(code, masked) ?? profileBundle(code, masked);
	},
};
