import      { describe, expect, test                                   } from "bun:test"                  ;
import      { spawnSync                                                } from "node:child_process"        ;
import      { mkdtempSync, readFileSync, writeFileSync                 } from "node:fs"                   ;
import      { tmpdir                                                   } from "node:os"                   ;
import      { join                                                     } from "node:path"                 ;
import      { displayWidth                                             } from "@/common/display-width.ts" ;
import      { buildReport, compareAlarms, DEFAULT_LIMITS, renderReport } from "@/common/report.ts"        ;
import type { FileResult, ResultGroup                                  } from "@/common/result-json.ts"   ;

const ROOT = join(import.meta.dir, "..");

function group(partial: Partial<ResultGroup> & Pick<ResultGroup, "startLine" | "endLine">): ResultGroup {
	return { kind: "declaration-equals", rows: partial.endLine - partial.startLine + 1, axes: ["equals=8"], state: "PASS", edits: 0, ...partial };
}

function fileResult(groups: readonly ResultGroup[], parse: FileResult["parse"]["status"] = "not-run", language = "typescript"): FileResult {
	const fixable = groups.filter(entry => entry.state === "FIXABLE");
	return {
		file     : "sample.ts"                                                                                                                  ,
		language                                                                                                                                ,
		mode     : parse === "not-run" ? "check" : "write"                                                                                      ,
		summary  : { groups: groups.length, misaligned: fixable.length, edits: fixable.reduce((sum, entry) => sum + entry.edits, 0), refused: 0, suggested: 0 } ,
		groups                                                                                                                                  ,
		parse    : { status: parse, tool: language }                                                                                            ,
	};
}

const text = (...lines: readonly string[]): string => lines.join("\n")                                           ;
const ids  = (report: ReturnType<typeof buildReport>): readonly string[] => report.alarms.map(alarm => alarm.id) ;

describe("check report — safety checks", () => {
	test("the same input yields the same report", () => {
		const input = { result: fileResult([group({ startLine: 1, endLine: 3, state: "FIXABLE", edits: 4 })]), text: text("const a = 1;", "const bb = 2;", "const ccc = 3;") };

		expect(buildReport(input)).toEqual(buildReport(input));
	});

	test("changed re-parse diagnostics fail S2 and the result fails", () => {
		const report = buildReport({ result: fileResult([], "changed"), text: "" });

		expect(report.checks.find(check => check.id === "S2")?.status).toBe("fail");
		expect(report.ok).toBe(false);
	});

	test("rechecking after a write fails S3 when edits remain and passes otherwise", () => {
		const dirty = fileResult([group({ startLine: 1, endLine: 3, state: "FIXABLE", edits: 2 })]);

		expect(buildReport({ result: fileResult([], "ok"), text: "", recheck: dirty          }).checks[2]?.status).toBe("fail"   ) ;
		expect(buildReport({ result: fileResult([], "ok"), text: "", recheck: fileResult([]) }).checks[2]?.status).toBe("pass"   ) ;
		expect(buildReport({ result: fileResult([]      ), text: ""                          }).checks[2]?.status).toBe("not-run") ;
	});

	test("two-row auto-fix is allowed only for approved kinds (S4)", () => {
		const allowed  = buildReport({ result: fileResult([group({ startLine: 1, endLine: 2, state: "FIXABLE", kind: "declaration-equals" })]), text: ""}) ;
		const breaking = buildReport({ result: fileResult([group({ startLine: 1, endLine: 2, state: "FIXABLE", kind: "interface-members"  })]), text: ""}) ;

		expect(allowed.checks[3]?.status ).toBe("pass") ;
		expect(breaking.checks[3]?.status).toBe("fail") ;
		expect(breaking.ok               ).toBe(false ) ;
	});
});

describe("check report — alarms", () => {
	test("A1: once per line outside a table, once per group inside", () => {
		const long   = `const x = "${"a".repeat(DEFAULT_LIMITS.hard)}";`                                                              ;
		const report = buildReport({ result: fileResult([group({ startLine: 2, endLine: 4 })]), text: text(long, long, long, long) }) ;
		const a1     = report.alarms.filter(alarm => alarm.id === "A1")                                                               ;

		expect(a1.map(alarm => [alarm.startLine, alarm.endLine])).toEqual  ([[1, 1], [2, 4]]        ) ;
		expect(a1[1]?.detail                                    ).toContain("3 row(s) over hard"    ) ;
		expect(a1[1]?.detail                                    ).toContain("pattern DEFINE"        ) ;
	});

	test("A2: between the soft and hard limits is an allowed-range alarm", () => {
		const middle = `const x = "${"a".repeat(DEFAULT_LIMITS.soft)}";`                                                                              ;
		const report = buildReport({ result: fileResult([group({ startLine: 1, endLine: 3 })]), text: text("const a = 1;", middle, "const c = 3;") }) ;

		expect(ids(report)).toContain("A2");
		expect(ids(report)).not.toContain("A1");
	});

	test("A3: points at the longest row when it is much wider than the second", () => {
		const report = buildReport({ result: fileResult([group({ startLine: 1, endLine: 3 })]), text: text("const a = 1;", `const b = ${"9".repeat(40)};`, "const c = 3;") });

		expect(report.alarms.find(alarm => alarm.id === "A3")?.startLine).toBe(2);
	});

	test("A4 cannot decompose, A6 two-row pair and A9 large change come from group state", () => {
		const report = buildReport({ result: fileResult([
			group({ startLine: 1, endLine: 3, state: "REFUSE"                             }),
			group({ startLine: 5, endLine: 6, state: "SUGGEST", kind: "pair"              }),
			group({ startLine: 8, endLine: 12, state: "FIXABLE", edits: DEFAULT_LIMITS.largeEdits }),
		]), text: "" });
		expect(ids(report)).toEqual(expect.arrayContaining(["A4", "A6", "A9"]));
	});

	test("A5 ambiguous and A8 no mapping come from the surface-form data", () => {
		const python = buildReport({ result: fileResult([group({ startLine: 1, endLine: 3, kind: "table", axes: ["name", "equal=4", "value"] })], "not-run", "python"), text: "" }) ;
		const alien  = buildReport({ result: fileResult([group({ startLine: 1, endLine: 3, kind: "not-a-kind" })]), text: "" })                                                     ;

		expect(python.alarms.find(alarm => alarm.id === "A5")?.detail).toBe("DEFINE|CHANGE");
		expect(ids(alien)).toContain("A8");
	});

	test("A7: when alignment spaces far exceed the content", () => {
		const report = buildReport({ result: fileResult([group({ startLine: 1, endLine: 3 })]), text: text("a          = 1;", "bb         = 2;", "ccc        = 3;") }) ;

		expect(ids(report)).toContain("A7");
	});

	test("a clean table without alarms", () => {
		const report = buildReport({ result: fileResult([group({ startLine: 1, endLine: 3 })]), text: text("const a   = 1;", "const bb  = 2;", "const ccc = 3;") }) ;

		expect(report.alarms).toEqual([]) ;
		expect(report.ok    ).toBe(true)  ;
	});
});

describe("check report — output", () => {
	test("the description column of the safety-check lines lines up in one column by display width", () => {
		const rendered = renderReport(buildReport({ result: fileResult([]), text: "" })).split("\n").filter(line => /^  S\d /u.test(line)) ;
		const columns  = rendered.map(line => displayWidth(line.slice(0, line.search(/(the engine|check mode|checked only|two-row)/u))))   ;

		expect(rendered.length    ).toBe(4) ;
		expect(new Set(columns).size).toBe(1);
	});

	test("CLI: checking the Python fixture in check mode passes the safety checks with exit code 0", () => {
		const run    = spawnSync(process.execPath, [join(ROOT, "product/engine/report.ts"), "--file", "test/fixtures/python/tables.py", "--json"], { cwd: ROOT, encoding: "utf8" }) ;
		const report = JSON.parse(run.stdout) as ReturnType<typeof buildReport>                                                                                                     ;

		expect(run.status                          ).toBe     (0   ) ;
		expect(report.ok                           ).toBe     (true) ;
		expect(report.alarms.map(alarm => alarm.id)).toContain("A5") ;
	});
});

describe("check report — baseline comparison", () => {
	const long     = `const x = "${"a".repeat(DEFAULT_LIMITS.hard)}";`                                                     ;
	const other    = `const y = "${"b".repeat(DEFAULT_LIMITS.hard)}";`                                                     ;
	const alarmsOf = (...lines: readonly string[]) => buildReport({ result: fileResult([]), text: text(...lines) }).alarms ;

	test("the same file gives all existing alarms and 0 new alarms", () => {
		const comparison = compareAlarms(alarmsOf("a", long), alarmsOf("a", long));

		expect(comparison.newAlarms     ).toEqual([]) ;
		expect(comparison.existingAlarms).toHaveLength(1);
	});

	test("pairs the same alarm even when lines shift or only whitespace changes", () => {
		const comparison = compareAlarms(alarmsOf("", "", long.replace(" = ", "   =   ")), alarmsOf(long)) ;

		expect(comparison.newAlarms     ).toEqual([]) ;
		expect(comparison.resolvedAlarms).toEqual([]) ;
	});

	test("one resolved and one introduced gives 1 new and 1 resolved alarm (closes the total-count loophole)", () => {
		const comparison = compareAlarms(alarmsOf(other), alarmsOf(long));

		expect(comparison.newAlarms.map(alarm => alarm.anchor)     ).toEqual([other]) ;
		expect(comparison.resolvedAlarms.map(alarm => alarm.anchor)).toEqual([long ]) ;
	});

	test("several identical alarms are paired only as many times as they exist", () => {
		const comparison = compareAlarms(alarmsOf(long, long, long), alarmsOf(long));

		expect(comparison.existingAlarms).toHaveLength(1) ;
		expect(comparison.newAlarms     ).toHaveLength(2) ;
	});

	test("CLI: with --baseline only alarms introduced by the edit are new, and with --baseline none all are new", () => {
		const dir     = mkdtempSync(join(tmpdir(), "boxbox-report-"))                      ;
		const fixture = readFileSync(join(ROOT, "test/fixtures/python/tables.py"), "utf8") ;
		writeFileSync(join(dir, "base.py"), fixture);
		writeFileSync(join(dir, "cur.py" ), fixture.replace('    "port": 8080,', `    "port": 8080,\n    "description": "${"x".repeat(120)}",`)) ;
		const run     = (...extra: readonly string[]) => JSON.parse(spawnSync(process.execPath, [join(ROOT, "product/engine/report.ts"), "--file", "cur.py", "--json", ...extra], { cwd: dir, encoding: "utf8" }).stdout) as ReturnType<typeof buildReport> ;
		const edited  = run("--baseline", "base.py")                                                                                                                                                                                                        ;
		const created = run("--baseline", "none"   )                                                                                                                                                                                                        ;

		expect(edited.comparison?.newAlarms.map(alarm => alarm.id).sort()).toEqual(["A1", "A3"]            ) ;
		expect(edited.comparison?.existingAlarms.length                  ).toBe   (edited.alarms.length - 2) ;
		expect(created.comparison?.newAlarms.length                      ).toBe   (created.alarms.length   ) ;
		const missing = spawnSync(process.execPath, [join(ROOT, "product/engine/report.ts"), "--file", "cur.py", "--baseline", "nope.py"], { cwd: dir, encoding: "utf8" });

		expect(missing.status).not.toBe(0);
		expect(missing.stderr).toContain("baseline not found");
	});
});
