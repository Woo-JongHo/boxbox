/**
 * Go 라인 프로파일러. 구조 판정은 문자열 내부·주석이 공백화된 masked로 하고, 셀 텍스트는
 * 같은 좌표의 원본 code에서 자른다(/d 플래그의 match.indices로 좌표를 얻는다).
 *
 * 인정하는 표 행과 축:
 * - 구조체 필드  `Name Type `json:"name"``        → name·type·tag 열
 * - const/var 행 `Name = 값`·`Name Type = 값`     → name·(type)·value 열과 equal 구분자
 * - 맵 리터럴 행  `key: value,`                    → key·value 열과 colon·comma 구분자
 * - import 행    `alias "pkg/path"`·`"pkg/path"`  → alias(생략 가능)·path 열
 * - 묶음 행      `{Kind, 22, "x"},`               → cell 열과 open·comma·close 구분자
 *
 * 거부: func·type·if·for·switch·go·defer 등 키워드로 시작하는 행, `{`·`(`·`[`로 끝나는
 * 여는 행, 간격 자리에 문자열이 숨은 행, func 리터럴·익명 struct/interface처럼 타입을
 * 확신할 수 없는 행, 묶음 행 가운데 키·중첩·호출·대입이 남는 행.
 */
import type { CodeSyntax }                     from "../common/code-text.ts";
import type { LineProfiler, RowProfile, Slot } from "../common/table-engine.ts";

const GO_SYNTAX: CodeSyntax = {
	lineComments  : ["//"],
	blockComments : [{ open: "/*", close: "*/" }],
	strings       : [
		{ open : '"' , close : '"' , escape : true  },
		{ open : "'" , close : "'" , escape : true  },
		{ open : "`" , close : "`" , escape : false },
	],
	cppRaw        : false,
};

/** 이 토큰으로 시작하면 선언·제어 흐름이라 표 행으로 보지 않는다. */
const GO_KEYWORDS = new Set([
	"break",     "case",     "chan",
	"const",     "continue", "default",
	"defer",     "else",     "fallthrough",
	"for",       "func",     "go",
	"goto",      "if",       "import",
	"interface", "map",      "package",
	"range",     "return",   "select",
	"struct",    "switch",   "type",
	"var",
]);

// Go 타입 식의 안전한 부분집합: map[K]·포인터·슬라이스·배열 접두와 한정·일반화 이름,
// chan 방향 접미만 인정한다. func·익명 struct/interface는 확신이 없어 거부한다.
const TYPE_PREFIX = "(?:map\\[[^\\[\\]\\s]*\\]|\\*|\\[\\]|\\[\\d+\\])*"                                                     ;
const TYPE_CORE   = "[A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z_][A-Za-z0-9_]*)*(?:\\[[^\\[\\]]*\\])?"                             ;
const GO_TYPE     = `${TYPE_PREFIX}(?:${TYPE_CORE}|(?:<-[ \\t]*|)chan(?:[ \\t]*<-|)(?:[ \\t]+${TYPE_PREFIX}${TYPE_CORE}|))` ;
const INDENT      = "([ \\t]*)"                                                                                             ;
const GAP         = "([ \\t]+)"                                                                                             ;
const TAG         = "(\\x60[^\\x60\\n]*\\x60)"                                                                              ;
const KEY         = `(?:${TYPE_CORE}|\\x60[^\\x60\\n]*\\x60|"[^"\\n]*")`                                                    ;

const FIELD_TAGGED = new RegExp(`^${INDENT}([A-Za-z_][A-Za-z0-9_]*)${GAP}(${GO_TYPE})${GAP}${TAG}[ \\t]*$`, "du")                    ;
const FIELD_PLAIN  = new RegExp(`^${INDENT}([A-Za-z_][A-Za-z0-9_]*)${GAP}(${GO_TYPE})[ \\t]*$`, "du")                                ;
const CONST_TYPED  = new RegExp(`^${INDENT}([A-Za-z_][A-Za-z0-9_]*)${GAP}(${GO_TYPE})${GAP}=(?!=)([ \\t]*)([^\\n]+?)[ \\t]*$`, "du") ;
const CONST_PLAIN  = new RegExp(`^${INDENT}([A-Za-z_][A-Za-z0-9_]*)${GAP}=(?!=)([ \\t]*)([^\\n]+?)[ \\t]*$`, "du")                   ;
const MAP_ROW      = new RegExp(`^${INDENT}(${KEY})([ \\t]*):(?!=)([ \\t]*)([^\\n]+?)([ \\t]*)(,)?[ \\t]*$`, "du")                   ;
const IMPORT_ALIAS = new RegExp(`^${INDENT}([A-Za-z_.][A-Za-z0-9_.]*)${GAP}("[^"\\n]*")[ \\t]*$`, "du")                              ;
const IMPORT_PLAIN = new RegExp(`^${INDENT}("[^"\\n]*")[ \\t]*$`, "du")                                                              ;

/** `{ 셀 , 셀 ... } trailer` — trailer는 뒤따르는 `,` 또는 `;` 또는 없음을 그대로 담는다. */
const GROUP = /^([ \t]*)\{(.*)\}([,;]?)[ \t]*$/du;
/** 묶음 행 셀의 문자열·루네 리터럴 꼴 — 내부의 쉼표·중괄호는 마스크가 공백화해 있다. */
const STRING_CELL = /^"(?:[^"\\]|\\.)*"$|^'(?:[^'\\]|\\.)*'$|^\x60[^\x60\n]*\x60$/u;
/** 묶음 행 셀의 스칼라 꼴 — 부호 있는 10진·0x 16진 숫자와 식별자·경로(pkg.Path). */
const SCALAR_CELL = /^(?:[+-]?(?:0[xX][0-9A-Fa-f_]+|[0-9][0-9_]*(?:\.[0-9_]*)?(?:[eE][+-]?[0-9]+)?)|[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)$/u;
/** 묶음 행 내부에 이 문자들이 마스크에 남으면 키·중첩·호출·대입 행이다 — 분해를 시도하지 않는다. */
const GROUP_UNSAFE = /[{}()[\]:=&]/u;
/** 묶음 행 셀 자리의 func은 함수 리터럴·타입의 시작이라 스칼라가 아니다. */
const GROUP_FUNC = /(?:^|[^A-Za-z0-9_])func(?:[^A-Za-z0-9_]|$)/u;

interface Column {
	readonly axis : string;
	/** 셀 텍스트를 자를 마스크 정규식 그룹 번호. 구분자 축은 text를 직접 쓴다. */
	readonly cell ?: number;
	/** colon·equal·comma 같은 구분자 축의 고정 텍스트. */
	readonly text ?: string;
	/** 원본 간격을 자를 그룹 번호. 첫 열은 간격이 없다. */
	readonly gap  ?: number;
}

const cellOf = (code: string, indices: RegExpIndicesArray, group: number): string => {
	const range = indices[group];
	return range === undefined ? "" : code.slice(range[0], range[1]);
};

/** 간격 좌표의 원본을 검사해 순수 공백일 때만 돌려준다 — 문자열이 숨어 있으면 행을 거부한다. */
const gapOf = (code: string, indices: RegExpIndicesArray, group: number): string | null => {
	const range = indices[group];
	if (range === undefined) return "";
	const gap = code.slice(range[0], range[1]);
	return /[^ \t]/u.test(gap) ? null : gap;
};

const rowFrom = (code: string, indices: RegExpIndicesArray, columns: readonly Column[]): RowProfile | null => {
	const slots: Slot[] = [];
	for (const column of columns) {
		const gap = column.gap === undefined ? "" : gapOf(code, indices, column.gap);
		if (gap === null) return null;
		slots.push({ axis: column.axis, text: column.text ?? cellOf(code, indices, column.cell ?? 0), gapBefore: gap });
	}
	return { indent: cellOf(code, indices, 1), slots };
};

/**
 * 중괄호 묶음 행 `{Kind, 22, "x"},` — 셀 경계는 마스크의 쉼표로 자르고 텍스트는 code에서
 * 같은 좌표로 가져온다. 문자열 셀 안의 쉼표는 마스크가 공백화해 경계가 끊기지 않는다. 셀은
 * 스칼라(문자열·루네·숫자·식별자·경로)만 통과하고, 내부에 키·중첩·호출·대입이 남으면 거부한다.
 * close 슬롯(`}` + trailer)이 행의 마지막이라 셀 열을 패딩해도 줄 끝 공백이 생기지 않는다.
 */
function bundleProfile(code: string, masked: string): RowProfile | null {
	const match = GROUP.exec(masked);
	const indices = match?.indices;
	if (!match || !indices) return null;
	const interior = indices[2];
	const trailer = indices[3];
	if (!interior || !trailer) return null;
	const interiorText = masked.slice(interior[0], interior[1]);
	if (GROUP_UNSAFE.test(interiorText) || GROUP_FUNC.test(interiorText)) return null;

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
		if (text.startsWith('"') || text.startsWith("'") || text.startsWith("`")) {
			if (!STRING_CELL.test(text)) return null;
		} else if (masked.slice(cellStart, cellStart + text.length) !== text || !SCALAR_CELL.test(text)) {
			return null; // 셀 안에 주석·문자열 조각이 남으면 스칼라가 아니다
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
	slots.push({ axis: "close", text: "}" + cellOf(code, indices, 3), gapBefore: code.slice(cells[cells.length - 1].end, interior[1]) });
	return { indent: cellOf(code, indices, 1), slots };
}

export const GO_ALIGNER: LineProfiler = {
	language   : "go",
	syntax     : GO_SYNTAX,
	// 묶음 행의 cell·arg 축은 뒤에 쉼표나 close 슬롯이 있으므로 열로 맞춰도 줄 끝 공백이 생기지 않는다.
	columnAxes : ["name", "type", "tag", "alias", "path", "key", "value", "cell", "arg"],
	canonicalGaps : {
		// Go 관습: colon과 comma는 셀에 바로 붙이고 equal은 한 칸 띄운다. 나머지 축은 기본 간격 " "을 쓴다.
		// 묶음 행은 첫 셀을 여는 중괄호에 바로 붙이고 close도 붙여 닫는 중괄호가 cell 폭을 공유하게 한다.
		colon : "",
		comma : "",
		equal : " ",
		open  : "",
		cell  : "",
		arg   : " ",
		close : "",
	},
	profile(code: string, masked: string): RowProfile | null {
		const tail = code.trimEnd();
		if (tail === "" || /[{([]$/u.test(tail)) return null;
		const head = masked.trimStart().match(/[A-Za-z_][A-Za-z0-9_]*/u)?.[0] ?? "";
		if (GO_KEYWORDS.has(head)) return null;

		const tagged = FIELD_TAGGED.exec(masked);
		if (tagged?.indices) {
			return rowFrom(code, tagged.indices, [
				{ axis : "name" , cell : 2           },
				{ axis : "type" , cell : 4 , gap : 3 },
				{ axis : "tag"  , cell : 6 , gap : 5 },
			]);
		}

		const typedConst = CONST_TYPED.exec(masked);
		if (typedConst?.indices) {
			return rowFrom(code, typedConst.indices, [
				{ axis : "name"  , cell : 2             },
				{ axis : "type"  , cell : 4   , gap : 3 },
				{ axis : "equal" , text : "=" , gap : 5 },
				{ axis : "value" , cell : 7   , gap : 6 },
			]);
		}

		const plainConst = CONST_PLAIN.exec(masked);
		if (plainConst?.indices) {
			return rowFrom(code, plainConst.indices, [
				{ axis : "name"  , cell : 2             },
				{ axis : "equal" , text : "=" , gap : 3 },
				{ axis : "value" , cell : 5   , gap : 4 },
			]);
		}

		const plainField = FIELD_PLAIN.exec(masked);
		if (plainField?.indices) {
			return rowFrom(code, plainField.indices, [
				{ axis: "name", cell: 2 },
				{ axis: "type", cell: 4, gap: 3 },
			]);
		}

		const mapRow = MAP_ROW.exec(masked);
		if (mapRow?.indices) {
			const columns: Column[] = [
				{ axis : "key"   , cell : 2             },
				{ axis : "colon" , text : ":" , gap : 3 },
				{ axis : "value" , cell : 5   , gap : 4 },
			];
			if (mapRow.indices[7] !== undefined) columns.push({ axis: "comma", text: ",", gap: 6 });
			return rowFrom(code, mapRow.indices, columns);
		}

		const importAlias = IMPORT_ALIAS.exec(masked);
		if (importAlias?.indices) {
			return rowFrom(code, importAlias.indices, [
				{ axis: "alias", cell: 2 },
				{ axis: "path" , cell: 4, gap: 3 },
			]);
		}

		const importPlain = IMPORT_PLAIN.exec(masked);
		if (importPlain?.indices) {
			return rowFrom(code, importPlain.indices, [
				{ axis: "path", cell: 2 },
			]);
		}

		const bundle = bundleProfile(code, masked);
		if (bundle) return bundle;

		return null;
	},
};
