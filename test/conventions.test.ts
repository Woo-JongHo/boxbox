import      { describe, expect, test  } from "bun:test"                ;
import      { spawnSync               } from "node:child_process"      ;
import      {
              mkdirSync             ,
              mkdtempSync           ,
              readFileSync          ,
              writeFileSync         ,
                                      } from "node:fs"                 ;
import      { tmpdir                  } from "node:os"                 ;
import      { join                    } from "node:path"               ;
import      {
              globToRegExp          ,
              indexConventions      ,
              lookup                ,
              parseConventions      ,
              validateConvention    ,
              type LoadedConvention ,
                                      } from "@/common/conventions.ts" ;
import      { buildReport             } from "@/common/report.ts"      ;
import      { lookupKeyOf             } from "@/common/signature.ts"   ;

const ROOT = join(import.meta.dir, "..")                                                             ;
const KEY  = lookupKeyOf("typescript", "Block", "declaration-equals", ["equals=12", "semicolon=40"]) ;

function record(partial: Partial<LoadedConvention> & Pick<LoadedConvention, "id">): LoadedConvention {
	return { schemaVersion: 1, key: KEY, pattern: "DEFINE", status: "approved", scope: "**", versions: { grammar: 1 }, approvedBy: "user", date: "2026-09-30", layer: "preset", ...partial };
}

describe("조회 키", () => {
	test("깊이를 빼고 버전을 붙이며, 빈 context는 `-`로 적는다", () => {
		expect(KEY).toBe("v1|typescript|Block|declaration-equals|equals>semicolon");
		expect(lookupKeyOf("python", "", "table", ["name", "equal=4", "value"])).toBe("v1|python|-|table|name>equal>value");
	});
});

describe("패턴 레코드", () => {
	test("틀린 레코드와 같은 층의 중복 id는 오류다", () => {
		expect(() => validateConvention({ ...record({ id: "a" }), pattern: "ASSIGN" }, "t")).toThrow("unknown pattern") ;
		expect(() => validateConvention({ ...record({ id: "a" }), status: "maybe"   }, "t")).toThrow("status"         ) ;
		expect(() => validateConvention({ ...record({ id: "a" }), key: "no-version" }, "t")).toThrow("key must"       ) ;

		const line = JSON.stringify(record({ id: "dup" }));

		expect(() => parseConventions(`${line}\n\n${line}\n`, "preset", "t")).toThrow("duplicate id dup");
	});

	test("glob: `**`는 여러 단계, `*`는 한 단계 안", () => {
		expect(globToRegExp("**").test("src/a/b.ts")         ).toBe(true ) ;
		expect(globToRegExp("src/**").test("src/a/b.ts")     ).toBe(true ) ;
		expect(globToRegExp("src/*.ts").test("src/a/b.ts")   ).toBe(false) ;
		expect(globToRegExp("test/**/*.ts").test("test/x.ts")).toBe(true ) ;
	});
});

describe("조회", () => {
	test("프로젝트 층이 preset을 이긴다", () => {
		const db = indexConventions([record({ id: "p", status: "approved" }), record({ id: "q", status: "rejected", layer: "project" })]);

		expect(lookup(db, KEY, "src/a.ts")).toEqual({ status: "rejected", id: "q", layer: "project" });
	});

	test("같은 층에서는 가장 구체적인 범위가 이긴다", () => {
		const db = indexConventions([record({ id: "all", status: "approved" }), record({ id: "legacy", status: "rejected", scope: "legacy/**" })]);

		expect(lookup(db, KEY, "legacy/old.ts").id).toBe("legacy") ;
		expect(lookup(db, KEY, "src/new.ts"   ).id).toBe("all"   ) ;
	});

	test("같은 층·같은 구체성에서 상태가 다르면 충돌이다 (파일 순서로 정하지 않음)", () => {
		const db = indexConventions([record({ id: "b", status: "approved" }), record({ id: "a", status: "rejected" })]);

		expect(lookup(db, KEY, "src/a.ts")).toEqual({ status: "conflict", id: "a,b", layer: "preset" });
	});

	test("후보는 승인이 아니고, 다른 버전의 키와 없는 키는 미지정이다", () => {
		const db = indexConventions([record({ id: "c", status: "candidate" }), record({ id: "old", key: KEY.replace(/^v1/u, "v0") })]);

		expect(lookup(db, KEY, "a.ts").status  ).toBe   ("unknown"            ) ;
		expect(db.stale                        ).toBe   (1                    ) ;
		expect(lookup(db, "v1|x|-|y|z", "a.ts")).toEqual({ status: "unknown" }) ;
	});
});

describe("리포트와 CLI", () => {
	test("리포트는 표마다 조회 결과를 붙이고, 2행 쌍은 조회하지 않는다", () => {
		const db     = indexConventions([record({ id: "r1" })]) ;
		const report = buildReport({ db, text: "", result: {
			file: "src/a.ts", language: "typescript", mode: "check", summary: { groups: 2, misaligned: 0, edits: 0, refused: 0, suggested: 1 }, parse: { status: "not-run", tool: "typescript" },
			groups: [
				{ kind: "declaration-equals", startLine: 1, endLine: 3, rows: 3, axes: ["equals=12", "semicolon=40"], state: "PASS", edits: 0, context: "Block", depth: 2 },
				{ kind: "pair"              , startLine: 5, endLine: 6, rows: 2, axes: ["name"]                     , state: "SUGGEST", edits: 0 },
			] } });

		expect(report.conventions?.counts        ).toEqual({ approved: 1, rejected: 0, unknown: 0, conflict: 0 }) ;
		expect(report.conventions?.lookups[0]?.id).toBe   ("r1"                                                 ) ;
		expect(report.conventions?.lookups.length).toBe   (1                                                    ) ;
	});

	test("CLI는 작업 폴더의 .xxx/conventions.jsonl을 읽어 조회한다", () => {
		const project = mkdtempSync(join(tmpdir(), "xxx-conv-"))                                                                                                                                                               ;
		const approve = { schemaVersion: 1, id: "py-define", key: "v1|python|-|table|name>equal>value", pattern: "DEFINE", status: "approved", scope: "**", versions: { grammar: 1 }, approvedBy: "user", date: "2026-09-30" } ;
		mkdirSync(join(project, ".xxx"));
		writeFileSync(join(project, ".xxx", "conventions.jsonl"), `${JSON.stringify(approve)}\n`);
		writeFileSync(join(project, "a.py"), readFileSync(join(ROOT, "skills/xxx/fixtures/python/tables.py"), "utf8"));

		const run    = spawnSync(process.execPath, [join(ROOT, "skills/xxx/scripts/report.ts"), "--file", "a.py", "--json"], { cwd: project, encoding: "utf8" }) ;
		const report = JSON.parse(run.stdout) as ReturnType<typeof buildReport>                                                                                  ;

		expect(report.conventions?.counts.approved).toBeGreaterThan(0);
		expect(report.conventions?.lookups.filter(entry => entry.status === "approved").every(entry => entry.id === "py-define")).toBe(true);
	});
});
