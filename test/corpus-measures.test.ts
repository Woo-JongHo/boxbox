import      { describe, expect, test } from "bun:test"                                ;
import      {
              measuresOf           ,
              patternNameOf        ,
              patternSharesOf      ,
              unseenShare          ,
              verdictOf            ,
                                     } from "../development/tools/corpus-measures.ts" ;

const TS  = "typescript|Block|declaration-equals|equals>semicolon|d1"      ;
const TS2 = "typescript|SourceFile|declaration-equals|equals>semicolon|d0" ;
const PY  = "python||table|key>colon>value>comma|d2"                       ;

describe("corpus measures", () => {
	test("the last verdict per signature wins", () => {
		const verdicts = verdictOf([
			JSON.stringify({ schemaVersion: 1, signature: TS, verdict: "unsure", judge: "user", date: "2026-09-29", note: "" }),
			JSON.stringify({ schemaVersion: 1, signature: TS, verdict: "correct", judge: "user", date: "2026-09-29", note: "" }),
		])                                              ;
		expect(verdicts.get(TS)).toBe("correct")        ;
		expect(verdicts.size  ).toBe(1)                 ;
	});

	test("judged share, table share and wrong-grouping rate come out per language", () => {
		const types = [
			{ signature : TS  , language : "typescript" , count : 100 },
			{ signature : TS2 , language : "typescript" , count : 300 },
			{ signature : PY  , language : "python"     , count : 200 },
		];
		const verdicts = verdictOf([
			JSON.stringify({ schemaVersion: 1, signature: TS, verdict: "different-role", judge: "user", date: "2026-09-29", note: "" }),
			JSON.stringify({ schemaVersion: 1, signature: PY, verdict: "correct", judge: "user", date: "2026-09-29", note: "" }),
		]);
		const measures = measuresOf(types, verdicts) ;
		const ts       = measures.get("typescript")! ;
		const py       = measures.get("python")!     ;

		expect(ts.types        ).toBe       (2   ) ;
		expect(ts.judgedTypes  ).toBe       (1   ) ;
		expect(ts.judgedShare  ).toBeCloseTo(0.5 ) ;
		expect(ts.tableShare   ).toBeCloseTo(0.25) ;
		expect(ts.wrongGrouping).toBe       (1   ) ; // the one judged typescript table is a grouping miss
		expect(py.judgedShare ).toBe(1)      ;
		expect(py.wrongGrouping).toBe(0)     ;
	});

	test("taste and unsure are judgments, not grouping misses", () => {
		const types = [{ signature: TS, language: "typescript", count: 50}];
		const verdicts = verdictOf([
			JSON.stringify({ schemaVersion: 1, signature: TS, verdict: "taste", judge: "user", date: "2026-09-29", note: "" }),
		])                                                                                                         ;
		expect(measuresOf(types, verdicts).get("typescript")!.wrongGrouping).toBe(0)                               ;
	});

	test("unseen share counts the signatures a new census has that the baseline lacks", () => {
		const baseline = [{ signature: TS }, { signature: PY }];

		expect(unseenShare([{ signature: TS }, { signature: PY }], baseline)                    ).toBe       (0    ) ;
		expect(unseenShare([{ signature: TS }, { signature: PY }, { signature: TS2 }], baseline)).toBeCloseTo(1 / 3) ;
		expect(unseenShare([], baseline)                                                        ).toBe       (0    ) ;
	});

	test("census types map to patterns through the surface-form data, and ambiguous ones are written with their alternatives", () => {
		expect(patternNameOf(TS                                     )).toBe("DEFINE"       ) ;
		expect(patternNameOf("python||table|name>equal>value|d1"    )).toBe("DEFINE|CHANGE") ;
		expect(patternNameOf("typescript|Block|not-a-kind|equals|d1")).toBe("unmapped"     ) ;
		const shares = patternSharesOf([{ signature: TS, language: "typescript", count: 3 }, { signature: TS2, language: "typescript", count: 4 }, { signature: PY, language: "python", count: 5 }]);

		expect(shares.get("typescript")?.get("DEFINE")).toBe(7) ;
		expect(shares.get("python"    )?.get("MAP"   )).toBe(5) ;
	});
});
