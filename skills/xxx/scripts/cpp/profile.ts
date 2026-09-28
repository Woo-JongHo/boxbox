/**
 * C++ line profiler. Structure is matched on `masked` lines (string contents and comments blanked), and cell
 * text is sliced from `code` at the same coordinates (/d flag indices). Brace bundle rows (`{"alpha", 1, 0x10},`)
 * are accepted only as initializer-list rows with two or more scalar cells. Uncertain rows — function signatures,
 * template declaration lines, remaining braces, control flow, lines with an open R"( raw string, parentheses in a
 * type cell (function pointers), function-like macros, bundles with `{}()[]=>` left in the interior (nesting,
 * assignment, lambdas) — are refused with null. The engine's lossless check is the second safeguard.
 */
import type { CodeSyntax }                     from "../common/code-text.ts";
import type { LineProfiler, RowProfile, Slot } from "../common/table-engine.ts";

const SYNTAX: CodeSyntax = {
	lineComments  : ["//"],
	blockComments : [{ open: "/*", close: "*/" }],
	strings       : [{ open: '"', close: '"', escape: true }, { open: "'", close: "'", escape: true }],
	cppRaw        : true,
};

/** One word that may carry namespace qualification (::) and template arguments (up to one level of nesting). */
const SEGMENT = String.raw`[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*(?:<(?:[^<>]|<[^<>]*>)*>)?`;
/** Type cell that may carry pointers, references, const, etc. Parentheses signal function pointers and are excluded outright. */
const TYPE = String.raw`${SEGMENT}(?:[ \t]*[*&]+|[ \t]+(?:const|constexpr|static|inline|mutable|volatile|unsigned|signed|short|long)|[ \t]+${SEGMENT})*(?:[ \t]*[*&]+)?`;
const NAME = String.raw`[A-Za-z_]\w*`;

/** Designated initializer `.field = value,` */
const DESIGNATED = new RegExp(String.raw`^([ \t]*)(\.${NAME})([ \t]*)=([ \t]*)([^ ,=;].*?)([ \t]*),$`, "du");
/** Enum class constant `Name = value,` */
const ENUM_CONSTANT = new RegExp(String.raw`^([ \t]*)(${NAME})([ \t]*)=([ \t]*)([^ ,=;].*?)([ \t]*),$`, "du");
/** Object-like macro `#define NAME value` — function-like macros with `(` right after the name do not match.
 *  value is the last column, so alignment padding would end up at the line end. Trailing spaces are absorbed
 *  into the cell so a rerun reads the same table again (lossless and idempotent). */
const DEFINE = new RegExp(String.raw`^([ \t]*)(#[ \t]*define)([ \t]+)(${NAME})([ \t]+)([^ \t].*?)$`, "du");
/** Field declaration `Type name;` */
const FIELD = new RegExp(String.raw`^([ \t]*)(${TYPE})([ \t]+)(${NAME})([ \t]*);$`, "du");
/** Field initialization `Type name = value;` */
const FIELD_INIT = new RegExp(String.raw`^([ \t]*)(${TYPE})([ \t]+)(${NAME})([ \t]*)=([ \t]*)(.+?)([ \t]*);$`, "du");
/** Bundle row cells — only strings (`"…"`/`'…'` in the mask), numbers, and identifiers such as `std::` paths, nullptr, true/false. */
const BUNDLE_CELL = /^(?:"[^"]*"|'[^']*'|[+-]?\d[\w.]*|[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*)$/u;
/** If any of these remain in a bundle interior it is a nested bundle, assignment, lambda, index or comparison — refused based on the mask. */
const BUNDLE_UNSAFE = /[{}()[\]=>]/u;

/** Words that prevent a field table when they lead a row — statements, control flow, declaration heads, access specifiers. */
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

/** If = or ; remains in the masked value axis, the row chains statements on one line — refuse as designated initializer or enum constant. */
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
	// A ; in the value axis is a code semicolon that survived the mask — the row chains statements on one line.
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

/** Brace bundle row `{"alpha", 1, 0x10},` — one initializer-list row. Cell text runs through the following `,`,
 *  and the last cell absorbs `}` and the trailing `,`/`;` into one slot. Engine padding goes after the comma,
 *  keeping the real-world shape `{"b",     22,  2}` with commas attached to cells, and the last-column cell is the
 *  row's last slot, so per engine rules it is not padded. Two or more cells, scalars only. */
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
