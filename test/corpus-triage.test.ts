import      { describe, expect, test           } from "bun:test"                    ;
import      { latestSuggestions, renderSummary } from "../scripts/corpus-judge.ts"  ;
import      { parseSuggestions                 } from "../scripts/corpus-triage.ts" ;

const SIG_A = "typescript|Block|declaration-equals|equals>semicolon|d1" ;
const SIG_B = "python||table|key>colon>value>comma|d2"                  ;
const RANKS = new Map([[1, SIG_A], [2, SIG_B]])                         ;

describe("corpus AI pre-verdicts", () => {
	test("picks and validates only verdict lines and drops unknown ranks, verdicts and flags", () => {
		const output = [
			"this is an explanatory sentence",
			'{"rank": 1, "verdict": "correct", "reason": "same role", "flags": ["pushed-apart", "prettier"]}',
			'{"rank": 2, "verdict": "approve", "reason": "unknown verdict"}',
			'{"rank": 9, "verdict": "taste", "reason": "unknown rank"}',
			'{"rank": 2, "verdict": "taste", "reason": "taste", "flags": "too-wide"}',
			"{not json",
		].join("\n");

		const parsed = parseSuggestions(output, RANKS, "codex-test", "2026-09-30");

		expect(parsed.map(suggestion => [suggestion.rank, suggestion.verdict])).toEqual([[1, "correct"], [2, "taste"]]) ;
		expect(parsed[0]?.flags                                               ).toEqual(["pushed-apart"]              ) ;
		expect(parsed[1]?.flags                                               ).toEqual([]                            ) ;
		expect(parsed[0]?.reviewer                                            ).toBe   ("codex-test"                  ) ;
	});

	test("the summary shows AI suggestions separately from verdicts, and the last suggestion wins for the same signature", () => {
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
