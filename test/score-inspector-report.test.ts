import { describe, expect, test } from "bun:test";
import { scoreReport, type TruthGroup } from "../development/tools/score-inspector-report.ts";

const groups: TruthGroup[] = [
	{ startLine : 10 , endLine : 12 , state : "FIXABLE" },
	{ startLine : 20 , endLine : 21 , state : "FIXABLE" },
	{ startLine : 30 , endLine : 33 , state : "PASS"    },
	{ startLine : 40 , endLine : 42 , state : "FIXABLE" },
];

describe("scoreReport", () => {
	test("counts a FIXABLE group when the report cites its lines, singly or as a range", () => {
		const score = scoreReport("Misaligned: lines 10-12 and line 21. Also L41.", groups, 100);
		expect(score.fixable     ).toBe(3) ;
		expect(score.citedStrict ).toBe(3) ;
		expect(score.recallStrict).toBe(1) ;
	});

	test("a bare range counts only in the lenient score", () => {
		const score = scoreReport("The group at | 10-12 | needs padding.", groups, 100);
		expect(score.citedStrict ).toBe(0);
		expect(score.citedLenient).toBe(1);
	});

	test("citing a PASS group is reported as a possible false alarm, not as recall", () => {
		const score = scoreReport("Lines 30-33 look misaligned.", groups, 100);
		expect(score.passGroupsCited).toBe(1);
		expect(score.citedStrict    ).toBe(0);
	});

	test("citations beyond the file are counted separately and never score", () => {
		const score = scoreReport("See line 500 and lines 90-300.", groups, 100);
		expect(score.outOfFileCitations).toBe(2);
		expect(score.citedLenient      ).toBe(0);
	});

	test("records the counts the report claims", () => {
		expect(scoreReport("8 misaligned groups, and 3 FIXABLE rows.", groups, 100).claimedMisaligned).toEqual([8, 3]);
	});

	test("an empty report scores zero and a file with nothing to fix has zero recall", () => {
		expect(scoreReport("", groups, 100).recallStrict).toBe(0);
		expect(scoreReport("lines 1-5", [{ startLine: 1, endLine: 5, state: "PASS" }], 100).recallLenient).toBe(0);
	});
});
