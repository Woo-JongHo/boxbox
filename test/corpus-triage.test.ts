import      { describe, expect, test           } from "bun:test"                    ;
import      { latestSuggestions, renderSummary } from "../scripts/corpus-judge.ts"  ;
import      { parseSuggestions                 } from "../scripts/corpus-triage.ts" ;

const SIG_A = "typescript|Block|declaration-equals|equals>semicolon|d1" ;
const SIG_B = "python||table|key>colon>value>comma|d2"                  ;
const RANKS = new Map([[1, SIG_A], [2, SIG_B]])                         ;

describe("코퍼스 AI 사전 판정", () => {
	test("판정 줄만 골라 검증하고, 모르는 순위·판정·플래그는 버린다", () => {
		const output = [
			"여기는 설명 문장이다",
			'{"rank": 1, "verdict": "correct", "reason": "같은 역할", "flags": ["pushed-apart", "prettier"]}',
			'{"rank": 2, "verdict": "approve", "reason": "모르는 판정"}',
			'{"rank": 9, "verdict": "taste", "reason": "모르는 순위"}',
			'{"rank": 2, "verdict": "taste", "reason": "취향", "flags": "too-wide"}',
			"{not json",
		].join("\n");

		const parsed = parseSuggestions(output, RANKS, "codex-test", "2026-09-30");

		expect(parsed.map(suggestion => [suggestion.rank, suggestion.verdict])).toEqual([[1, "correct"], [2, "taste"]]) ;
		expect(parsed[0]?.flags                                               ).toEqual(["pushed-apart"]              ) ;
		expect(parsed[1]?.flags                                               ).toEqual([]                            ) ;
		expect(parsed[0]?.reviewer                                            ).toBe   ("codex-test"                  ) ;
	});

	test("요약에는 AI 제안이 판정과 따로 보이고, 같은 시그니처는 마지막 제안이 이긴다", () => {
		const queue = [
			JSON.stringify({ schemaVersion: 1, signature: SIG_A, rank: 1, verdict: "unsure" , reason: "", flags: [], reviewer: "codex", date: "2026-09-30" }),
			JSON.stringify({ schemaVersion: 1, signature: SIG_A, rank: 1, verdict: "correct", reason: "", flags: [], reviewer: "codex", date: "2026-09-30" }),
		];

		const lines = renderSummary([{ signature: SIG_A, count: 10, edits: 20 }, { signature: SIG_B, count: 5, edits: 6 }], new Map(), latestSuggestions(queue)).split("\n");

		expect(lines[2]).toContain("unjudged"  ) ;
		expect(lines[2]).toContain("ai=correct") ;
		expect(lines[3]).toContain("ai=-"      ) ;
	});
});
