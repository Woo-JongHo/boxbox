import      { describe, expect, test                  } from "bun:test"                     ;
import      {
              contentHashOf                         ,
              sectionHash                           ,
              selectGuideExamples                   ,
              validateDecision                      ,
              validateExample                       ,
              type Example                          ,
                                                      } from "@/common/examples.ts"         ;
import      { checkDecision, checkExample, loadPreset } from "../scripts/examples-check.ts" ;

function example(partial: Partial<Example> & Pick<Example, "id" | "before" | "after">): Example {
	return {
		schemaVersion: 1, status: "approved", versions: { grammar: 1 }, language: "typescript", regime: "sentence", patterns: ["WHEN", "EXIT"], rules: ["a12-stray-padding"],
		verdict: "after-better", asserts: {}, source: { kind: "synthetic", license: "repo" }, approvedBy: "user", date: "2026-09-30",
		...partial, contentHash: contentHashOf(partial.before, partial.after),
	};
}

const PADDED  = ["export function read(path: string): string {", "\tif (!path) throw new Error(\"no path\")     ;", "\treturn path;", "}", ""].join("\n") ;
const TIGHT   = PADDED.replace("\")     ;", "\");")                                                                                                       ;
const LOOSE   = ["export const ALPHA = 1;", "export const BETA_LONGER = 2;", "export const GAMMA = 3;", ""].join("\n")                                    ;
const ALIGNED = ["export const ALPHA       = 1 ;", "export const BETA_LONGER = 2 ;", "export const GAMMA       = 3 ;", ""].join("\n")                     ;

describe("example records", () => {
	test("a mismatched content hash, or missing asserts on a non-taste example, is an error", () => {
		const good = example({ id: "a", before: PADDED, after: TIGHT, asserts: { after: { lacks: ["A12"] } } });

		expect(() => validateExample({ ...good, contentHash: "sha256:0" }, "t")).toThrow("contentHash")  ;
		expect(() => validateExample({ ...good, asserts: {} }, "t")            ).toThrow("asserts")      ;
		expect(() => validateExample({ ...good, asserts: {}, verdict: "taste" }, "t")).not.toThrow();
		expect(() => validateExample({ ...good, patterns: ["ASSIGN"] }, "t")   ).toThrow("grammar IDs")  ;
	});
});

describe("example checks — meaning per verdict", () => {
	test("after-better: before has A12, after does not, and after is a fixed point", () => {
		const ok    = example({ id: "e1", before: PADDED, after: TIGHT, asserts: { before: { has: ["A12"] }, after: { lacks: ["A12"], fixedPoint: true } } }) ;
		const wrong = example({ id: "e2", before: PADDED, after: TIGHT, asserts: { after: { has: ["A12"] } } })                                               ;

		expect(checkExample(ok)   ).toEqual([])                       ;
		expect(checkExample(wrong)).toEqual(["after: A12 expected"]);
	});

	test("fixedPoint: an after with a table still pending alignment fails", () => {
		const pending = example({ id: "e3", regime: "table", patterns: ["DEFINE"], before: LOOSE, after: LOOSE, asserts: { after: { fixedPoint: true } } });

		expect(checkExample(pending)[0]).toContain("not a fixed point");
	});

	test("bad: fails when the engine's fix of before equals the forbidden after", () => {
		const forbiddenByEngine = example({ id: "e4", verdict: "bad", regime: "table", patterns: ["DEFINE"], before: LOOSE, after: ALIGNED, asserts: {} })                                ;
		const neverProduced     = example({ id: "e5", verdict: "bad", regime: "table", patterns: ["DEFINE"], before: LOOSE, after: LOOSE.split("\n").reverse().join("\n"), asserts: {} }) ;

		expect(checkExample(forbiddenByEngine)).toEqual(["bad: the engine produced the forbidden shape"]);
		expect(checkExample(neverProduced)    ).toEqual([])                                                ;
	});

	test("taste and unapproved examples are not checked", () => {
		expect(checkExample(example({ id: "t", verdict: "taste", before: "x", after: "y" }))                       ).toEqual([]) ;
		expect(checkExample(example({ id: "c", status: "candidate", before: PADDED, after: TIGHT, asserts: { after: { has: ["A12"] } } }))).toEqual([]);
	});
});

describe("decision records", () => {
	const DOC = ["# Document", "", "## Rule A", "Body A", "", "## Rule B", "Body B"].join("\n");

	test("a section hash changes only when that section changes", () => {
		const a = sectionHash(DOC, "Rule A");

		expect(sectionHash(DOC.replace("Body B", "Changed B"), "Rule A"))    .toBe   (a                  ) ;
		expect(sectionHash(DOC.replace("Body A", "Changed A"), "Rule A")).not.toBe   (a                  ) ;
		expect(() => sectionHash(DOC, "Missing section")                )    .toThrow("heading not found") ;
	});

	test("reports that re-approval is needed when the referenced section changes", () => {
		const decision = validateDecision({ schemaVersion: 1, id: "d", kind: "rule", layer: "grammar", ref: "skills/xxx/references/grammar.md#1. Four units", docHash: "sha256:stale", examples: [], approvedBy: "user", date: "2026-09-30" }, "t");

		expect(checkDecision(decision)[0]).toContain("re-approve");
	});
});

describe("picking GUIDE examples", () => {
	test("only approved after-better, by shared pattern count → recency → id, up to 3", () => {
		const pick = selectGuideExamples([
			example({ id: "b", before: "1", after: "1", patterns: ["DEFINE"]        , date: "2026-09-29" }),
			example({ id: "a", before: "2", after: "2", patterns: ["DEFINE", "WHEN"], date: "2026-09-28" }),
			example({ id: "c", before: "3", after: "3", patterns: ["DEFINE"]        , date: "2026-09-30" }),
			example({ id: "d", before: "4", after: "4", patterns: ["DEFINE"]        , verdict: "taste"   }),
			example({ id: "e", before: "5", after: "5", patterns: ["MAP"]                                }),
			example({ id: "f", before: "6", after: "6", patterns: ["DEFINE"]        , date: "2026-09-27" }),
		], { language: "typescript", regime: "sentence", patterns: ["DEFINE", "WHEN"] });

		expect(pick.map(entry => entry.id)).toEqual(["a", "c", "b"]);
	});
});

describe("preset DB", () => {
	test("every shipped example passes per its verdict, and each decision's document hash matches the current document", () => {
		const { examples, decisions } = loadPreset();

		expect(examples.flatMap(entry => checkExample(entry).map(reason => `${entry.id} ${reason}`))).toEqual([]) ;
		expect(decisions.flatMap(checkDecision)                                                     ).toEqual([]) ;
	});
});
