import type { GroupDescription         } from "@/common/06_table-engine.ts" ;
import type { PythonRow, PythonRowKind } from "@/python/05_analysis.ts"     ;

/** Source-confirmed display families; legacy table/pair keys remain unchanged. */
export type PythonSemanticKind =
	| "assignments"
	| "annotated-assignments"
	| "class-fields"
	| "dict-rows"
	| "keyword-arguments"
	| "parameters"
	| "bundle-rows"
	| "import-from"
	| "return-guards"
	| "unknown";

/** A source-free representative shape, with its exact legacy approval identity. */
export interface PythonColumnSet {
	readonly kind            : Exclude<PythonSemanticKind, "unknown"> ;
	readonly variant         : string                                 ;
	readonly columns         : readonly string[]                      ;
	readonly approvalKind    : "table"                                ;
	readonly approvalContext : null                                   ;
	readonly approvalAxes    : readonly string[]                      ;
	readonly detection       : "implemented"                          ;
	/** Representative arity and exact repeated cells; not a wildcard approval. */
	readonly repetition?: string;
}

const CALL_REPETITION   = "Two scalar positions shown; extra cells repeat comma, arg. call:* is the normalized callee axis." ;
const BUNDLE_REPETITION = "Two scalar cells shown; each additional cell repeats comma, arg."                                 ;

const variants: readonly [kind: PythonColumnSet["kind"], variant: string, columns: readonly string[], repetition?: string][] = [
	["assignments", "simple", ["name", "equal", "value"]],
	["assignments", "attribute", ["attribute", "equal", "value"]],
	["assignments", "chained", ["chain-target", "equal", "value"]],
	["assignments", "opaque-expression", ["name", "equal", "assignment-value"]],
	["assignments", "scalar-call", ["name", "equal", "call:*", "open(", "cell", "comma", "arg", "close)"], CALL_REPETITION],
	["assignments", "set-call", ["name", "equal", "call:*", "open(", "open{", "cell", "comma", "arg", "close}", "close)"], CALL_REPETITION],
	["assignments", "list-call", ["name", "equal", "call:*", "open(", "open[", "cell", "comma", "arg", "close]", "close)"], CALL_REPETITION],
	["assignments", "tuple-call", ["name", "equal", "call:*", "open(", "open(", "cell", "comma", "arg", "close)", "close)"], CALL_REPETITION],
	["annotated-assignments", "declared", ["name", "colon", "type"]],
	["annotated-assignments", "initialized", ["name", "colon", "type", "equal", "value"]],
	["class-fields", "declared", ["name", "colon", "type"]],
	["class-fields", "initialized", ["name", "colon", "type", "equal", "value"]],
	["dict-rows", "entries", ["key", "colon", "value", "comma"]],
	["keyword-arguments", "values", ["name", "equal", "value", "comma"]],
	["parameters", "annotated", ["name", "colon", "type", "comma"]],
	["parameters", "defaulted", ["name", "colon", "type", "equal", "value", "comma"]],
	["bundle-rows", "list", ["open[", "cell", "comma", "arg", "close]"], BUNDLE_REPETITION],
	["bundle-rows", "tuple", ["open(", "cell", "comma", "arg", "close)"], BUNDLE_REPETITION],
	["import-from", "whole-line-from-import", ["from", "module", "import", "names"]],
	["return-guards", "whole-line-if-return", ["if", "condition", "colon", "return", "value"]],
];

/** Ordered variants are authoring vocabulary, never permission to write an entire family. */
export const PYTHON_COLUMN_SETS: readonly PythonColumnSet[] = variants.map(([kind, variant, columns, repetition]) => ({
	kind    ,
	variant ,
	columns ,
	approvalKind    : "table"       ,
	approvalContext : null          ,
	approvalAxes    : columns       ,
	detection       : "implemented" ,
	...(repetition === undefined ? {} : { repetition }),
}));

/** Every current Python profile axis; call:* denotes the existing normalized callee identity. */
export const PYTHON_AXIS_NOTES: Readonly<Record<string, string>> = {
	from               : "Existing from keyword of a whole-line, non-parenthesized import-from statement."                               ,
	module             : "Opaque relative or dotted module spelling, confirmed by AST and original tokens."                              ,
	import             : "Existing import keyword of the same import-from statement."                                                    ,
	names              : "Opaque imported names and aliases; their internal commas and spaces are preserved."                            ,
	if                 : "Existing if keyword of a whole-line guard with one valued return and no else."                                 ,
	condition          : "Opaque single-line condition through its final token, including original parentheses."                         ,
	return             : "Existing return keyword; bare returns and extra statements are outside the bounded shape."                     ,
	name               : "Start of a simple assignment, field, parameter or keyword name."                                               ,
	attribute          : "Start of an attribute assignment target; distinct from a simple name."                                         ,
	"chain-target"     : "Start of a chained assignment target; distinct from a simple name."                                            ,
	key                : "Start of the original quoted dictionary key."                                                                  ,
	colon              : "Existing annotation or mapping colon."                                                                         ,
	type               : "Start of the opaque annotation cell, preserving its original bytes."                                           ,
	equal              : "Existing Python assignment or default-value equals sign."                                                      ,
	value              : "Start of a value cell, including an opaque return expression in guard rows."                                   ,
	"assignment-value" : "Opaque bounded outer expression; has a different approval identity from value."                                ,
	comma              : "Existing separator comma; repeated for each comparable bundle argument."                                       ,
	"call:*"           : "Normalized callee identity of a detailed assigned-call table; concrete callees remain distinct when grouping." ,
	cell               : "First scalar cell within a bundle or positional call."                                                         ,
	arg                : "Each later scalar cell; the comma and arg axes repeat for additional cells."                                   ,
	"open["            : "Existing opening list bracket."                                                                                ,
	"open("            : "Existing opening tuple or call parenthesis."                                                                   ,
	"open{"            : "Existing opening set bundle brace inside a call."                                                              ,
	"close]"           : "Existing closing list bracket, retaining any original trailer comma."                                          ,
	"close)"           : "Existing closing tuple or call parenthesis, retaining any original trailer comma."                             ,
	"close}"           : "Existing closing set bundle brace inside a call."                                                              ,
};

/** Explicit coverage limits are separate from implemented authoring column sets. */
export const PYTHON_UNSUPPORTED_KINDS = [
	{ kind : "plain-import"          , detection : "unsupported" , reason : "Plain import statements remain unsupported; the implemented table requires whole-line from/import rows."                                                      },
	{ kind : "complex-import-from"   , detection : "unsupported" , reason : "Multiline, parenthesized and same-line sibling imports remain unsupported; only bounded whole-line import-from runs are detected."                            },
	{ kind : "complex-return-guards" , detection : "unsupported" , reason : "Multiline guards, else branches, bare returns and additional statements remain unsupported; only sibling whole-line if/return runs with values are detected." },
] as const;

const exact = (axes: readonly string[], expected: readonly string[]): boolean => axes.length === expected.length && axes.every((axis, index) => axis === expected[index]);

/** Classify only the already selected physical rows; labels cannot create groups or edit plans. */
export function describePythonGroup(rows: readonly PythonRow[], rowIndexes: readonly number[], axes: readonly string[]): GroupDescription {
	const grammar: PythonRowKind = axes[0] === "from" ? "import-from"
		: axes[0] === "if" ? "return-guard"
		: axes[0] === "key" ? "dictionary"
		: axes[0]?.startsWith("open") ? "bundle"
		: axes.at(-1) === "comma" ? axes.includes("colon") ? "parameter" : "keyword"
		: "statement";
	const selected = new Set(rowIndexes)                                                ;
	const evidence = rows.filter(row => selected.has(row.line) && row.kind === grammar) ;
	const byOwner  = new Map<number, PythonRow[]>()                                     ;
	for (const row of evidence) {
		const siblings = byOwner.get(row.owner);
		if (siblings) siblings.push(row);
		else byOwner.set(row.owner, [row]);
	}
	const complete      = [...byOwner.values()].filter(ownerRows => ownerRows.length === selected.size && new Set(ownerRows.map(row => row.line)).size === selected.size) ;
	const matching      = complete.length === 1 ? complete[0] : undefined                                                                                                 ;
	const contextRows   = matching ?? evidence                                                                                                                            ;
	const ownerTypes    = new Set(contextRows.map(row => row.ownerType))                                                                                                  ;
	const sourceContext = ownerTypes.size === 1 ? contextRows[0]?.ownerType : undefined                                                                                   ;
	const context       = sourceContext === undefined ? {} : { sourceContext }                                                                                            ;
	if (selected.size === 0 || !matching) return { semanticKind: "unknown", ...context };

	let semanticKind: PythonSemanticKind = "unknown";
	switch (grammar) {
		case "import-from":
			if (exact(axes, ["from", "module", "import", "names"])) semanticKind = "import-from";
			break;
		case "return-guard":
			if (exact(axes, ["if", "condition", "colon", "return", "value"])) semanticKind = "return-guards";
			break;
		case "dictionary":
			if (axes[1] === "colon" && axes[2] === "value") semanticKind = "dict-rows";
			break;
		case "bundle":
			if (axes[1] === "cell" && axes.includes("arg")) semanticKind = "bundle-rows";
			break;
		case "parameter":
			if (axes[0] === "name" && axes[1] === "colon" && axes[2] === "type") semanticKind = "parameters";
			break;
		case "keyword":
			if (exact(axes, ["name", "equal", "value", "comma"])) semanticKind = "keyword-arguments";
			break;
		case "statement": {
			const annotation = exact(axes, ["name", "colon", "type"]) || exact(axes, ["name", "colon", "type", "equal", "value"]) ;
			const target     = ["name", "attribute", "chain-target"].includes(axes[0] ?? "") && axes[1] === "equal"               ;
			const value      = axes.length === 3 && ["value", "assignment-value"].includes(axes[2]!)                              ;
			const call       = axes[2]?.startsWith("call:") && axes[3] === "open(" && axes.at(-1) === "close)"                    ;

			if (annotation) semanticKind = sourceContext === "ClassDef" ? "class-fields" : "annotated-assignments";
			else if (target && (value || call)) semanticKind = "assignments";
			break;
		}
	}

	return { semanticKind, ...context };
}
