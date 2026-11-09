import      { spawnSync               } from "node:child_process" ;
import      {
              mkdtempSync           ,
              readFileSync          ,
              rmSync                ,
              symlinkSync           ,
              writeFileSync
                                      } from "node:fs"            ;
import      { tmpdir                  } from "node:os"            ;
import      { join, relative, resolve } from "node:path"          ;
import      { describe, expect, test  } from "bun:test"           ;

const ROOT        = resolve(import.meta.dir, "..")                                                           ;
const VALIDATOR   = join(ROOT, "docs/development/issue-library/validate.py")                                 ;
const BASE        = join(ROOT, "docs/development/issue-library/records/BBX-20261021-001-return-column.json") ;
const OLD_GRID    = "product/engine/typescript/grid-kinds.ts"                                                ;
const OLD_PROFILE = "product/engine/python/profile.ts"                                                       ;
const OLD_RESULT  = "product/engine/common/result-json.ts"                                                   ;
const OLD_REPORT  = "product/engine/common/report.ts"                                                        ;
const OLD_TABLE   = "product/engine/common/table-engine.ts"                                                  ;

interface TestIssueRecord {
	id           : string                   ;
	history      : { evidence: string[] }[] ;
	related      : { path: string }[]       ;
	verification : { evidence: string[] }[] ;
}

function runWith(change: (record: TestIssueRecord) => void): { status: number | null; stdout: string; stderr: string } {
	const folder = mkdtempSync(join(tmpdir(), "boxbox-issue-reference-"));
	try {
		const record = JSON.parse(readFileSync(BASE, "utf8")) as TestIssueRecord;
		record.id = "BBX-20990101-001";
		change(record);
		const file = join(folder, `${record.id}-validator-test.json`);
		writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
		const result = spawnSync("python3", [VALIDATOR, file], { cwd: ROOT, encoding: "utf8" });
		return { status: result.status, stdout: result.stdout, stderr: result.stderr };
	} finally {
		rmSync(folder, { force: true, recursive: true });
	}
}

describe("issue-library historical source relocation", () => {
	test("accepts a declared relocated history source and reports the occurrence", () => {
		const result = runWith(record => { record.history[1]!.evidence = [OLD_GRID]; });
		expect(result.status).toBe(0);
		const output = JSON.parse(result.stdout);
		expect(output.relocatedHistoricalReferenceOccurrences).toBe(1);
		expect(output.existingReferenceOccurrences + output.relocatedHistoricalReferenceOccurrences).toBe(output.referenceOccurrences);
	});

	test("accepts the second exact historical source relocation", () => {
		const result = runWith(record => { record.history[1]!.evidence = [OLD_PROFILE]; });
		expect(result.status).toBe(0);
		const output = JSON.parse(result.stdout);
		expect(output.relocatedHistoricalReferenceOccurrences).toBe(1);
	});

	test("accepts the exact common-engine history relocations", () => {
		for (const path of [OLD_RESULT, OLD_REPORT, OLD_TABLE]) {
			const result = runWith(record => { record.history[1]!.evidence = [path]; });
			expect(result.status).toBe(0);
			expect(JSON.parse(result.stdout).relocatedHistoricalReferenceOccurrences).toBe(1);
		}
	});

	test("rejects an undeclared missing history path", () => {
		const result = runWith(record => { record.history[1]!.evidence = ["product/engine/python/does-not-exist.ts"]; });
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("missing historical evidence");
	});

	test("rejects an escaping historical evidence path", () => {
		const result = runWith(record => { record.history[1]!.evidence = ["../outside"]; });
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("evidence must be repository-relative");
	});

	test("rejects a historical alias used as a current related artifact", () => {
		const result = runWith(record => { record.related[0]!.path = OLD_GRID; });
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("missing reference");
	});

	test("rejects a historical alias used as current verification evidence", () => {
		const result = runWith(record => { record.verification[0]!.evidence = [OLD_GRID]; });
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("missing reference");
	});

	test("rejects escaping current references", () => {
		for (const path of ["../outside", "/tmp/outside"]) {
			const result = runWith(record => { record.related[0]!.path = path; });
			expect(result.status).toBe(1);
			expect(result.stderr).toContain("repository-relative");
		}
	});

	test("rejects a current reference that resolves outside the repository", () => {
		const folder  = mkdtempSync(join(ROOT, ".boxbox-issue-reference-")           ) ;
		const outside = mkdtempSync(join(tmpdir(), "boxbox-issue-reference-outside-")) ;
		try {
			const target = join(outside, "outside.txt") ;
			const link   = join(folder , "outside.txt") ;
			writeFileSync(target, "outside\n");
			symlinkSync(target, link);
			const path   = relative(ROOT, link                                   ) ;
			const result = runWith (record => { record.related[0]!.path = path; }) ;
			expect(result.status).toBe(1);
			expect(result.stderr).toContain("resolves outside the repository");
		} finally {
			rmSync(folder, { force: true, recursive: true });
			rmSync(outside, { force: true, recursive: true });
		}
	});
});
