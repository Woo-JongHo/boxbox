import      { describe, expect, test      } from "bun:test"                   ;
import      { codexTokens, estimateTokens } from "@/common/usage.ts"          ;
import      { summarizeUsage              } from "../scripts/usage-report.ts" ;

describe("AI 사용량", () => {
	test("추정 토큰: ASCII 4글자당 1, 한글 1글자당 1", () => {
		expect(estimateTokens("abcdefgh")).toBe(2) ;
		expect(estimateTokens("가나다"  )).toBe(3) ;
		expect(estimateTokens("ab가"    )).toBe(2) ;
	});

	test("Codex가 남긴 토큰 수를 읽고, 없으면 undefined", () => {
		expect(codexTokens("hook: Stop\ntokens used\n27,877\n")).toBe(27877);
		expect(codexTokens("no usage here")                    ).toBeUndefined() ;
	});

	test("출처·이벤트별로 합치고 추정이 섞이면 표시한다", () => {
		const lines = summarizeUsage([
			{ date: "d", source: "hook", event: "PostToolUse", chars: 100, tokens: 60, estimated: true },
			{ date: "d", source: "hook", event: "PostToolUse", chars: 50 , tokens: 40, estimated: true },
		]);

		expect(lines   ).toHaveLength(1                     ) ;
		expect(lines[0]).toContain   ("횟수    2"           ) ;
		expect(lines[0]).toContain   ("토큰      100 (추정)") ;
		expect(lines[0]).toContain   ("회당 50"             ) ;
	});
});
