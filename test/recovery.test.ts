import      { expect, test             } from "bun:test"                   ;
import      {
              typeScriptWriteFailure ,
              approvalRecovery       ,
              boundedRecovery        ,
              mergeRecovery          ,
              operationRecovery      ,
              resultRecovery
                                       } from "@/common/38_recovery.ts"    ;
import      { summarize                } from "@/common/24_result-json.ts" ;
import type { FileResult, ResultGroup  } from "@/common/24_result-json.ts" ;

function result(groups: readonly ResultGroup[]): FileResult {
	return { file: "sample.ts", language: "typescript", mode: "check", groups, summary: summarize(groups), parse: { status: "not-run", tool: "typescript" } };
}

for (const [state, kind, category] of [
	["PASS", "table", undefined],
	["FIXABLE", "table", "alignment"],
	["SUGGEST", "pair", "unsupported"],
	["SUGGEST", "interface-members-compressed", "structural-prerequisite"],
	["REFUSE", "table", "safety"],
	["REFUSE", "syntax", "syntax"],
] as const) test(`recovery routes ${state} ${kind} without granting write authority`, () => {
	const report = resultRecovery(result([{ state, kind, startLine: 4, endLine: 6, rows: 3, axes: [], edits: 0, reason: "specific evidence" }]));
	if (!category) { expect(report.issues).toEqual([]); return; }
	if (kind === "interface-members-compressed") expect(report.issues[0]!.next).toContain("Align-only request needs structural-edit authorization");
	expect(report).toMatchObject({ issues: [{ file: "sample.ts", startLine: 4, endLine: 6, kind, category, owner: "agent", next: expect.any(String) }], omitted: 0 });
});

test("approval recovery retains the exact key and requires a human for automatic writes only", () => {
	const group: ResultGroup = { kind: "table", startLine: 2, endLine: 4, rows: 3, axes: ["equals"], state: "PASS", edits: 0 }                                                     ;
	const issue              = approvalRecovery("sample.ts", group, "exact-key", { status: "unknown", writable: false, reasons: ["no matching convention"], guide: [], text: "" }) ;
	expect(issue).toMatchObject({ category: "approval", owner: "human", key: "exact-key", startLine: 2, endLine: 4 });
	expect(issue.next).toContain("Continue independently authorized Write/Refactor");
});

test("recovery bounds repeated findings and counts omitted entries across merged reports", () => {
	const issue  = operationRecovery("sample.ts", "tool", "x".repeat(2000)).issues[0]! ;
	const first  = boundedRecovery(Array.from({ length: 25 }, () => issue))            ;
	const report = mergeRecovery([first, first])                                       ;
	expect(first.issues[0]!.reason.length).toBe(500) ;
	expect(report.issues.length          ).toBe(20 ) ;
	expect(report.omitted                ).toBe(30 ) ;
});

test("unsupported source ranges remain distinct from safety refusals and syntax failures", () => {
	const report = resultRecovery({ ...result([]), unsupported: [{ line: 9, reason: "unsupported mapping" }] });
	expect(report.issues).toMatchObject([{ startLine: 9, category: "unsupported", owner: "maintainer" }]);
});

for (const report of ["", "not json", "{}", '{"results":[]}', '{"results":[{"groups":null}]}']) test(`writer failure preserves its status when the report is unusable: ${report}`, () => {
	const failure = typeScriptWriteFailure(report, "sample.ts", 7);
	expect(failure.message).toContain("exit code 7");
	expect(failure.recovery.issues).toMatchObject([{ file: "sample.ts", category: "tool", owner: "maintainer" }]);
});
