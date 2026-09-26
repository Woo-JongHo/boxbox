/**
 * Go 라인 프로파일러. 구조 판정은 문자열 내부·주석이 공백화된 masked로 하고, 셀 텍스트는
 * 같은 좌표의 원본 code에서 자른다(/d 플래그의 match.indices로 좌표를 얻는다).
 *
 * 인정하는 표 행과 축:
 * - 구조체 필드  `Name Type `json:"name"``        → name·type·tag 열
 * - const/var 행 `Name = 값`·`Name Type = 값`     → name·(type)·value 열과 equal 구분자
 * - 맵 리터럴 행  `key: value,`                    → key·value 열과 colon·comma 구분자
 * - import 행    `alias "pkg/path"`·`"pkg/path"`  → alias(생략 가능)·path 열
 *
 * 거부: func·type·if·for·switch·go·defer 등 키워드로 시작하는 행, `{`·`(`·`[`로 끝나는
 * 여는 행, 간격 자리에 문자열이 숨은 행, func 리터럴·익명 struct/interface처럼 타입을
 * 확신할 수 없는 행.
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

export const GO_ALIGNER: LineProfiler = {
	language   : "go",
	syntax     : GO_SYNTAX,
	columnAxes : ["name", "type", "tag", "alias", "path", "key", "value"],
	canonicalGaps : {
		// Go 관습: colon과 comma는 셀에 바로 붙이고 equal은 한 칸 띄운다. 나머지 축은 기본 간격 " "을 쓴다.
		colon : "",
		comma : "",
		equal : " ",
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

		return null;
	},
};
