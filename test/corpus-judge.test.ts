import      { describe, expect, test                  } from "bun:test"                   ;
import      { latestVerdicts, renderSummary, typeSlug } from "../scripts/corpus-judge.ts" ;

const SIG_A = "typescript|Block|declaration-equals|equals>semicolon|d1|FIXABLE" ;
const SIG_B = "python||table|key>colon>value>comma|d2|FIXABLE"                  ;

describe("corpus judging", () => {
	test("type slugs are rank-padded, sanitized and unique per signature", () => {
		const a = typeSlug(SIG_A, 3 ) ;
		const b = typeSlug(SIG_B, 41) ;
		expect(a                 ).toMatch(/^003-declaration-equals-FIXABLE-d1-[0-9a-f]{8}$/u) ;
		expect(b                 ).toMatch(/^041-table-FIXABLE-d2-[0-9a-f]{8}$/u             ) ;
		expect(a === b           ).toBe   (false                                             ) ;
		expect(typeSlug(SIG_A, 3)).toBe   (a                                                 ) ;
	});

	test("the last verdict record for a signature wins and blank lines are skipped", () => {
		const log = [
			JSON.stringify({ schemaVersion: 1, signature: SIG_A, verdict: "unsure", judge: "user", date: "2026-09-29", note: "" }),
			"",
			JSON.stringify({ schemaVersion: 1, signature: SIG_A, verdict: "correct", judge: "user", date: "2026-09-29", note: "ok" }),
			JSON.stringify({ schemaVersion: 1, signature: SIG_B, verdict: "taste", judge: "user", date: "2026-09-29", note: "spaced commas" }),
		]                                                  ;
		const verdicts = latestVerdicts(log)               ;
		expect(verdicts.get(SIG_A)?.verdict).toBe("correct") ;
		expect(verdicts.get(SIG_A)?.note   ).toBe("ok"     ) ;
		expect(verdicts.get(SIG_B)?.verdict).toBe("taste"  ) ;
		expect(verdicts.size               ).toBe(2        ) ;
	});

	test("the summary marks approved, judged and unjudged types by rank", () => {
		const types = [
			{ signature : SIG_A                                                                  , count : 1077 , edits : 3962 },
			{ signature : SIG_B                                                                  , count : 201  , edits : 887  },
			{ signature : "typescript|SourceFile|declaration-equals|equals>semicolon|d0|FIXABLE" , count : 266  , edits : 1431 },
		]                                                                                                                   ;
		const verdicts = latestVerdicts([
			JSON.stringify({ schemaVersion: 1, signature: SIG_A, verdict: "correct", judge: "user", date: "2026-09-29", note: "" }),
			JSON.stringify({ schemaVersion: 1, signature: SIG_B, verdict: "missing-kind", judge: "user", date: "2026-09-29", note: "" }),
		])                                                                                                                  ;
		const lines = renderSummary(types, verdicts).split("\n")                                                            ;
		expect(lines[0]).toBe     ("corpus judging — 3 types") ;
		expect(lines[2]).toContain("001"                     ) ;
		expect(lines[2]).toContain("approved"                ) ;
		expect(lines[3]).toContain("judged-missing-kind"     ) ;
		expect(lines[4]).toContain("unjudged"                ) ;
		expect(lines[4]).toContain("count=  266"             ) ;
	});
});
