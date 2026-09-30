import      { describe, expect, test                  } from "bun:test"                   ;
import      { codexModel, codexTokens, estimateTokens } from "@/common/usage.ts"          ;
import      { agreementOf, usageRows                  } from "../scripts/usage-report.ts" ;

describe("AI 사용량", () => {
	test("추정 토큰: ASCII 4글자당 1, 한글 1글자당 1", () => {
		expect(estimateTokens("abcdefgh")).toBe(2) ;
		expect(estimateTokens("가나다"  )).toBe(3) ;
		expect(estimateTokens("ab가"    )).toBe(2) ;
	});

	test("Codex가 남긴 토큰 수와 모델·추론 강도를 읽는다", () => {
		const stderr = "workdir: /x\nmodel: gpt-6-sol\nprovider: openai\nreasoning effort: medium\n…\ntokens used\n27,877\n";

		expect(codexTokens(stderr)          ).toBe(27877)                                     ;
		expect(codexModel(stderr)           ).toEqual({ model: "gpt-6-sol", effort: "medium" }) ;
		expect(codexTokens("no usage here") ).toBeUndefined()                                 ;
		expect(codexModel("no header")      ).toEqual({})                                     ;
	});

	test("모델·출처·이벤트별로 합치고, 추정이 섞이면 표시한다", () => {
		const rows = usageRows([
			{ date : "d" , source : "hook"  , event : "PostToolUse" , chars : 100 , tokens : 60 , estimated : true  , model : "host"      },
			{ date : "d" , source : "hook"  , event : "PostToolUse" , chars : 50  , tokens : 40 , estimated : true  , model : "host"      },
			{ date : "d" , source : "codex" , event : "review"      , chars : 10  , tokens : 99 , estimated : false , model : "gpt-6-sol" },
		]);

		expect(rows.map(row => [row.model, row.event, row.count, row.tokens, row.estimated])).toEqual([["gpt-6-sol", "review", 1, 99, false], ["host", "PostToolUse", 2, 100, true]]);
	});

	test("정확도: AI 제안과 사람 판정이 둘 다 있는 유형만 비교한다", () => {
		const suggestion = (signature: string, verdict: string) => JSON.stringify({ schemaVersion: 1, signature, rank: 1, verdict, reason: "", flags: [], reviewer: "codex", date: "d", model: "gpt-6-sol" }) ;
		const verdict    = (signature: string, value: string)   => JSON.stringify({ schemaVersion: 1, signature, verdict: value, judge: "user", date: "d", note: "" })                                        ;

		const agreements = agreementOf([suggestion("a", "correct"), suggestion("b", "taste"), suggestion("c", "correct")], [verdict("a", "correct"), verdict("b", "correct")]);

		expect(agreements).toEqual([{ reviewer: "gpt-6-sol", judged: 2, agreed: 1 }]);
	});
});
