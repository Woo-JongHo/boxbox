import      { describe, expect, test                                   } from "bun:test"                  ;
import      { spawnSync                                                } from "node:child_process"        ;
import      { mkdtempSync, readFileSync, writeFileSync                 } from "node:fs"                   ;
import      { tmpdir                                                   } from "node:os"                   ;
import      { join                                                     } from "node:path"                 ;
import      { displayWidth                                             } from "@/common/display-width.ts" ;
import      { buildReport, compareAlarms, DEFAULT_LIMITS, renderReport } from "@/common/report.ts"        ;
import type { FileResult, ResultGroup                                  } from "@/common/result-json.ts"   ;

const ROOT = join(import.meta.dir, "..") ;

function group(partial: Partial<ResultGroup> & Pick<ResultGroup, "startLine" | "endLine">): ResultGroup {
	return { kind: "declaration-equals", rows: partial.endLine - partial.startLine + 1, axes: ["equals=8"], state: "PASS", edits: 0, ...partial } ;
}

function fileResult(groups: readonly ResultGroup[], parse: FileResult["parse"]["status"] = "not-run", language = "typescript"): FileResult {
	const fixable = groups.filter(entry => entry.state === "FIXABLE")                                                                            ;
	return {
		file     : "sample.ts"                                                                                                                  ,
		language                                                                                                                                ,
		mode     : parse === "not-run" ? "check" : "write"                                                                                      ,
		summary  : { groups: groups.length, misaligned: fixable.length, edits: fixable.reduce((sum, entry) => sum + entry.edits, 0), refused: 0, suggested: 0 } ,
		groups                                                                                                                                  ,
		parse    : { status: parse, tool: language }                                                                                            ,
	} ;
}

const text = (...lines: readonly string[]): string => lines.join("\n")                                           ;
const ids  = (report: ReturnType<typeof buildReport>): readonly string[] => report.alarms.map(alarm => alarm.id) ;

describe("검사 리포트 — 안전 검사", () => {
	test("같은 입력이면 같은 리포트가 나온다", () => {
		const input = { result: fileResult([group({ startLine: 1, endLine: 3, state: "FIXABLE", edits: 4 })]), text: text("const a = 1;", "const bb = 2;", "const ccc = 3;") } ;

		expect(buildReport(input)).toEqual(buildReport(input)) ;
	});

	test("재파싱 진단이 달라지면 S2 미통과, 결과는 실패", () => {
		const report = buildReport({ result: fileResult([], "changed"), text: "" })  ;

		expect(report.checks.find(check => check.id === "S2")?.status).toBe("fail") ;
		expect(report.ok).toBe(false)                                                ;
	});

	test("쓴 뒤 다시 검사해 편집이 남아 있으면 S3 미통과, 없으면 통과", () => {
		const dirty = fileResult([group({ startLine: 1, endLine: 3, state: "FIXABLE", edits: 2 })])                                             ;

		expect(buildReport({ result: fileResult([], "ok"), text: "", recheck: dirty          }).checks[2]?.status).toBe("fail"   ) ;
		expect(buildReport({ result: fileResult([], "ok"), text: "", recheck: fileResult([]) }).checks[2]?.status).toBe("pass"   ) ;
		expect(buildReport({ result: fileResult([]      ), text: ""                          }).checks[2]?.status).toBe("not-run") ;
	});

	test("2행 자동 수정은 승인된 kind만 허용된다 (S4)", () => {
		const allowed  = buildReport({ result: fileResult([group({ startLine: 1, endLine: 2, state: "FIXABLE", kind: "declaration-equals" })]), text: ""}) ;
		const breaking = buildReport({ result: fileResult([group({ startLine: 1, endLine: 2, state: "FIXABLE", kind: "interface-members"  })]), text: ""}) ;

		expect(allowed.checks[3]?.status ).toBe("pass") ;
		expect(breaking.checks[3]?.status).toBe("fail") ;
		expect(breaking.ok               ).toBe(false ) ;
	});
});

describe("검사 리포트 — 알람", () => {
	test("A1: 표 밖은 줄마다, 표 안은 그룹마다 한 번", () => {
		const long   = `const x = "${"a".repeat(DEFAULT_LIMITS.hard)}";`                                                              ;
		const report = buildReport({ result: fileResult([group({ startLine: 2, endLine: 4 })]), text: text(long, long, long, long) }) ;
		const a1     = report.alarms.filter(alarm => alarm.id === "A1")                                                               ;

		expect(a1.map(alarm => [alarm.startLine, alarm.endLine])).toEqual  ([[1, 1], [2, 4]]) ;
		expect(a1[1]?.detail                                    ).toContain("3행이 한계"    ) ;
		expect(a1[1]?.detail                                    ).toContain("문형 DEFINE"   ) ;
	});

	test("A2: 권장선과 한계선 사이는 허용 구간 알람", () => {
		const middle = `const x = "${"a".repeat(DEFAULT_LIMITS.soft)}";`                                                                              ;
		const report = buildReport({ result: fileResult([group({ startLine: 1, endLine: 3 })]), text: text("const a = 1;", middle, "const c = 3;") }) ;

		expect(ids(report)).toContain("A2") ;
		expect(ids(report)).not.toContain("A1") ;
	});

	test("A3: 가장 긴 행이 두 번째보다 크게 넓으면 그 행을 짚는다", () => {
		const report = buildReport({ result: fileResult([group({ startLine: 1, endLine: 3 })]), text: text("const a = 1;", `const b = ${"9".repeat(40)};`, "const c = 3;") }) ;

		expect(report.alarms.find(alarm => alarm.id === "A3")?.startLine).toBe(2) ;
	});

	test("A4 분해 실패, A6 2행 쌍, A9 큰 변경량은 그룹 상태로", () => {
		const report = buildReport({ result: fileResult([
			group({ startLine: 1, endLine: 3, state: "REFUSE"                             }),
			group({ startLine: 5, endLine: 6, state: "SUGGEST", kind: "pair"              }),
			group({ startLine: 8, endLine: 12, state: "FIXABLE", edits: DEFAULT_LIMITS.largeEdits }),
		]), text: "" }) ;
		expect(ids(report)).toEqual(expect.arrayContaining(["A4", "A6", "A9"])) ;
	});

	test("A5 모호, A8 대응 없음은 표현형 데이터로", () => {
		const python = buildReport({ result: fileResult([group({ startLine: 1, endLine: 3, kind: "table", axes: ["name", "equal=4", "value"] })], "not-run", "python"), text: "" }) ;
		const alien  = buildReport({ result: fileResult([group({ startLine: 1, endLine: 3, kind: "not-a-kind" })]), text: "" })                                                     ;

		expect(python.alarms.find(alarm => alarm.id === "A5")?.detail).toBe("DEFINE|CHANGE") ;
		expect(ids(alien)).toContain("A8")                                                     ;
	});

	test("A7: 정렬 공백이 내용보다 지나치게 많으면", () => {
		const report = buildReport({ result: fileResult([group({ startLine: 1, endLine: 3 })]), text: text("a          = 1;", "bb         = 2;", "ccc        = 3;") }) ;

		expect(ids(report)).toContain("A7") ;
	});

	test("알람이 없는 깨끗한 표", () => {
		const report = buildReport({ result: fileResult([group({ startLine: 1, endLine: 3 })]), text: text("const a   = 1;", "const bb  = 2;", "const ccc = 3;") }) ;

		expect(report.alarms).toEqual([]) ;
		expect(report.ok    ).toBe(true)  ;
	});
});

describe("검사 리포트 — 출력", () => {
	test("안전 검사 줄의 설명 열이 한글 폭을 반영해 한 열에 맞는다", () => {
		const rendered = renderReport(buildReport({ result: fileResult([]), text: "" })).split("\n").filter(line => /^  S\d /u.test(line)) ;
		const columns  = rendered.map(line => displayWidth(line.slice(0, line.search(/(엔진이|check|--write|2행)/u))))                     ;

		expect(rendered.length    ).toBe(4) ;
		expect(new Set(columns).size).toBe(1) ;
	});

	test("CLI: Python fixture를 check 모드로 검사하면 안전 검사 통과, 종료 코드 0", () => {
		const run    = spawnSync(process.execPath, [join(ROOT, "skills/xxx/scripts/report.ts"), "--file", "skills/xxx/fixtures/python/tables.py", "--json"], { cwd: ROOT, encoding: "utf8" }) ;
		const report = JSON.parse(run.stdout) as ReturnType<typeof buildReport>                                                                                                               ;

		expect(run.status                          ).toBe     (0   ) ;
		expect(report.ok                           ).toBe     (true) ;
		expect(report.alarms.map(alarm => alarm.id)).toContain("A5") ;
	});
});

describe("검사 리포트 — 기준본 비교", () => {
	const long     = `const x = "${"a".repeat(DEFAULT_LIMITS.hard)}";`                                                     ;
	const other    = `const y = "${"b".repeat(DEFAULT_LIMITS.hard)}";`                                                     ;
	const alarmsOf = (...lines: readonly string[]) => buildReport({ result: fileResult([]), text: text(...lines) }).alarms ;

	test("같은 파일이면 모두 기존 알람, 새 알람 0", () => {
		const comparison = compareAlarms(alarmsOf("a", long), alarmsOf("a", long)) ;

		expect(comparison.newAlarms     ).toEqual([]) ;
		expect(comparison.existingAlarms).toHaveLength(1) ;
	});

	test("줄이 밀리거나 공백만 바뀌어도 같은 알람으로 짝지어진다", () => {
		const comparison = compareAlarms(alarmsOf("", "", long.replace(" = ", "   =   ")), alarmsOf(long)) ;

		expect(comparison.newAlarms     ).toEqual([]) ;
		expect(comparison.resolvedAlarms).toEqual([]) ;
	});

	test("하나가 사라지고 하나가 생기면 새 알람 1, 사라진 알람 1 (총개수 비교의 구멍을 막는다)", () => {
		const comparison = compareAlarms(alarmsOf(other), alarmsOf(long)) ;

		expect(comparison.newAlarms.map(alarm => alarm.anchor)     ).toEqual([other]) ;
		expect(comparison.resolvedAlarms.map(alarm => alarm.anchor)).toEqual([long ]) ;
	});

	test("같은 알람이 여럿이면 개수만큼만 짝지어진다", () => {
		const comparison = compareAlarms(alarmsOf(long, long, long), alarmsOf(long)) ;

		expect(comparison.existingAlarms).toHaveLength(1) ;
		expect(comparison.newAlarms     ).toHaveLength(2) ;
	});

	test("CLI: --baseline으로 편집에서 생긴 알람만 새 알람이 되고, --baseline none이면 전부 새 알람", () => {
		const dir     = mkdtempSync(join(tmpdir(), "xxx-report-"))                               ;
		const fixture = readFileSync(join(ROOT, "skills/xxx/fixtures/python/tables.py"), "utf8") ;
		writeFileSync(join(dir, "base.py"), fixture)                                                                  ;
		writeFileSync(join(dir, "cur.py" ), fixture.replace('    "port": 8080,', `    "port": 8080,\n    "description": "${"x".repeat(120)}",`)) ;
		const run     = (...extra: readonly string[]) => JSON.parse(spawnSync(process.execPath, [join(ROOT, "skills/xxx/scripts/report.ts"), "--file", "cur.py", "--json", ...extra], { cwd: dir, encoding: "utf8" }).stdout) as ReturnType<typeof buildReport> ;
		const edited  = run("--baseline", "base.py")                                                                                                                                                                                                            ;
		const created = run("--baseline", "none"   )                                                                                                                                                                                                            ;

		expect(edited.comparison?.newAlarms.map(alarm => alarm.id).sort()).toEqual(["A1", "A3"]            ) ;
		expect(edited.comparison?.existingAlarms.length                  ).toBe   (edited.alarms.length - 2) ;
		expect(created.comparison?.newAlarms.length                      ).toBe   (created.alarms.length   ) ;
		const missing = spawnSync(process.execPath, [join(ROOT, "skills/xxx/scripts/report.ts"), "--file", "cur.py", "--baseline", "nope.py"], { cwd: dir, encoding: "utf8" }) ;

		expect(missing.status).not.toBe(0)          ;
		expect(missing.stderr).toContain("baseline not found") ;
	});
});
