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

describe("예문 레코드", () => {
	test("내용 해시가 맞지 않거나, taste가 아닌데 asserts가 없으면 오류다", () => {
		const good = example({ id: "a", before: PADDED, after: TIGHT, asserts: { after: { lacks: ["A12"] } } });

		expect(() => validateExample({ ...good, contentHash: "sha256:0" }, "t")).toThrow("contentHash")  ;
		expect(() => validateExample({ ...good, asserts: {} }, "t")            ).toThrow("asserts")      ;
		expect(() => validateExample({ ...good, asserts: {}, verdict: "taste" }, "t")).not.toThrow();
		expect(() => validateExample({ ...good, patterns: ["ASSIGN"] }, "t")   ).toThrow("grammar IDs")  ;
	});
});

describe("예문 검사 — 판정별 의미", () => {
	test("after-better: before에는 A12가 있고 after에는 없으며 after는 고정점이다", () => {
		const ok    = example({ id: "e1", before: PADDED, after: TIGHT, asserts: { before: { has: ["A12"] }, after: { lacks: ["A12"], fixedPoint: true } } }) ;
		const wrong = example({ id: "e2", before: PADDED, after: TIGHT, asserts: { after: { has: ["A12"] } } })                                               ;

		expect(checkExample(ok)   ).toEqual([])                       ;
		expect(checkExample(wrong)).toEqual(["after: A12 expected"]);
	});

	test("fixedPoint: 정렬 대기 표가 남은 after는 실패한다", () => {
		const pending = example({ id: "e3", regime: "table", patterns: ["DEFINE"], before: LOOSE, after: LOOSE, asserts: { after: { fixedPoint: true } } });

		expect(checkExample(pending)[0]).toContain("not a fixed point");
	});

	test("bad: 엔진이 before를 고친 결과가 금지된 after와 같으면 실패한다", () => {
		const forbiddenByEngine = example({ id: "e4", verdict: "bad", regime: "table", patterns: ["DEFINE"], before: LOOSE, after: ALIGNED, asserts: {} })                                ;
		const neverProduced     = example({ id: "e5", verdict: "bad", regime: "table", patterns: ["DEFINE"], before: LOOSE, after: LOOSE.split("\n").reverse().join("\n"), asserts: {} }) ;

		expect(checkExample(forbiddenByEngine)).toEqual(["bad: the engine produced the forbidden shape"]);
		expect(checkExample(neverProduced)    ).toEqual([])                                                ;
	});

	test("taste와 승인되지 않은 예문은 검사하지 않는다", () => {
		expect(checkExample(example({ id: "t", verdict: "taste", before: "x", after: "y" }))                       ).toEqual([]) ;
		expect(checkExample(example({ id: "c", status: "candidate", before: PADDED, after: TIGHT, asserts: { after: { has: ["A12"] } } }))).toEqual([]);
	});
});

describe("결정 레코드", () => {
	const DOC = ["# 문서", "", "## 규칙 A", "본문 A", "", "## 규칙 B", "본문 B"].join("\n");

	test("문서 절의 해시는 그 절이 바뀔 때만 바뀐다", () => {
		const a = sectionHash(DOC, "규칙 A");

		expect(sectionHash(DOC.replace("본문 B", "바뀐 B"), "규칙 A"))    .toBe   (a                  ) ;
		expect(sectionHash(DOC.replace("본문 A", "바뀐 A"), "규칙 A")).not.toBe   (a                  ) ;
		expect(() => sectionHash(DOC, "없는 절")                     )    .toThrow("heading not found") ;
	});

	test("가리키는 절이 바뀌면 다시 승인해야 한다고 알린다", () => {
		const decision = validateDecision({ schemaVersion: 1, id: "d", kind: "rule", layer: "grammar", ref: "skills/xxx/references/grammar.md#1. 네 단위", docHash: "sha256:stale", examples: [], approvedBy: "user", date: "2026-09-30" }, "t");

		expect(checkDecision(decision)[0]).toContain("re-approve");
	});
});

describe("GUIDE 예문 고르기", () => {
	test("승인된 after-better만, 겹치는 문형 수 → 최근 → id 순으로 최대 3개", () => {
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
	test("배포되는 예문은 모두 판정대로 통과하고, 결정의 문서 해시는 지금 문서와 같다", () => {
		const { examples, decisions } = loadPreset();

		expect(examples.flatMap(entry => checkExample(entry).map(reason => `${entry.id} ${reason}`))).toEqual([]) ;
		expect(decisions.flatMap(checkDecision)                                                     ).toEqual([]) ;
	});
});
