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

const ROOT = join       (import.meta.dir, ".."                                                     ) ;
const KEY  = lookupKeyOf("typescript", "Block", "declaration-equals", ["equals=12", "semicolon=40"]) ;

function record(partial: Partial<LoadedConvention> & Pick<LoadedConvention, "id">): LoadedConvention {
	return { schemaVersion: 1, key: KEY, pattern: "DEFINE", status: "approved", scope: "**", versions: { grammar: 1 }, approvedBy: "user", date: "2026-09-30", layer: "preset", ...partial };
}

describe("lookup key", () => {
	test("drops depth, prefixes the version and writes an empty context as `-`", () => {
		expect(KEY).toBe("v1|typescript|Block|declaration-equals|equals>semicolon");
		expect(lookupKeyOf("python", "", "table", ["name", "equal=4", "value"])).toBe("v1|python|-|table|name>equal>value");
	});
});

describe("pattern records", () => {
	test("a malformed record and a duplicate id within one layer are errors", () => {
		expect(() => validateConvention({ ...record({ id: "a" }), pattern: "ASSIGN" }, "t")).toThrow("unknown pattern") ;
		expect(() => validateConvention({ ...record({ id: "a" }), status: "maybe"   }, "t")).toThrow("status"         ) ;
		expect(() => validateConvention({ ...record({ id: "a" }), key: "no-version" }, "t")).toThrow("key must"       ) ;

		const line = JSON.stringify(record({ id: "dup" }));

		expect(() => parseConventions(`${line}\n\n${line}\n`, "preset", "t")).toThrow("duplicate id dup");
	});

	test("glob: `**` spans several segments, `*` stays within one", () => {
		expect(globToRegExp("**").test("src/a/b.ts")         ).toBe(true ) ;
		expect(globToRegExp("src/**").test("src/a/b.ts")     ).toBe(true ) ;
		expect(globToRegExp("src/*.ts").test("src/a/b.ts")   ).toBe(false) ;
		expect(globToRegExp("test/**/*.ts").test("test/x.ts")).toBe(true ) ;
	});
});

describe("lookup", () => {
	test("the project layer wins over the preset", () => {
		const db = indexConventions([record({ id: "p", status: "approved" }), record({ id: "q", status: "rejected", layer: "project" })]);

		expect(lookup(db, KEY, "src/a.ts")).toEqual({ status: "rejected", id: "q", layer: "project" });
	});

	test("within one layer the most specific scope wins", () => {
		const db = indexConventions([record({ id: "all", status: "approved" }), record({ id: "legacy", status: "rejected", scope: "legacy/**" })]);

		expect(lookup(db, KEY, "legacy/old.ts").id).toBe("legacy") ;
		expect(lookup(db, KEY, "src/new.ts"   ).id).toBe("all"   ) ;
	});

	test("different statuses at the same layer and specificity are a conflict (file order never decides)", () => {
		const db = indexConventions([record({ id: "b", status: "approved" }), record({ id: "a", status: "rejected" })]);

		expect(lookup(db, KEY, "src/a.ts")).toEqual({ status: "conflict", id: "a,b", layer: "preset" });
	});

	test("a candidate is not an approval, and keys of another version or missing keys are unknown", () => {
		const db = indexConventions([record({ id: "c", status: "candidate" }), record({ id: "old", key: KEY.replace(/^v1/u, "v0") })]);

		expect(lookup(db, KEY, "a.ts").status  ).toBe   ("unknown"            ) ;
		expect(db.stale                        ).toBe   (1                    ) ;
		expect(lookup(db, "v1|x|-|y|z", "a.ts")).toEqual({ status: "unknown" }) ;
	});
});

describe("report and CLI", () => {
	test("the report attaches a lookup result per table and does not look up two-row pairs", () => {
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

	test("the CLI reads .boxbox/conventions.jsonl in the working folder for lookup", () => {
		const project = mkdtempSync(join(tmpdir(), "boxbox-conv-"))                                                                                                                                                            ;
		const approve = { schemaVersion: 1, id: "py-define", key: "v1|python|-|table|name>equal>value", pattern: "DEFINE", status: "approved", scope: "**", versions: { grammar: 1 }, approvedBy: "user", date: "2026-09-30" } ;
		mkdirSync(join(project, ".boxbox"));
		writeFileSync(join(project, ".boxbox", "conventions.jsonl"), `${JSON.stringify(approve)}\n`);
		writeFileSync(join(project, "a.py"), readFileSync(join(ROOT, "test/fixtures/python/tables.py"), "utf8"));

		const run    = spawnSync(process.execPath, [join(ROOT, "product/engine/report.ts"), "--file", "a.py", "--json"], { cwd: project, encoding: "utf8" }) ;
		const report = JSON.parse(run.stdout) as ReturnType<typeof buildReport>                                                                              ;

		expect(report.conventions?.counts.approved).toBeGreaterThan(0);
		expect(report.conventions?.lookups.filter(entry => entry.status === "approved").every(entry => entry.id === "py-define")).toBe(true);
	});
});
