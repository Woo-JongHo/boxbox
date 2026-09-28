import      { afterEach, describe, expect, test } from "bun:test"                                    ;
import      { copyFileSync, mkdtempSync, rmSync } from "node:fs"                                     ;
import      { join, relative, resolve           } from "node:path"                                   ;
import      { RESULT_SCHEMA_VERSION, summarize  } from "../skills/xxx/scripts/common/result-json.ts" ;
import type { FileResult, ResultEnvelope        } from "../skills/xxx/scripts/common/result-json.ts" ;

const root                 = resolve(import.meta.dir, "..") ;
const workspaces: string[] = []                             ;

afterEach(() => {
	for (const workspace of workspaces.splice(0)) rmSync(workspace, { recursive: true, force: true });
});

const STATES = new Set(["PASS", "FIXABLE", "SUGGEST", "REFUSE"]) ;
const PARSES = new Set(["ok", "changed", "skipped", "not-run"] ) ;

/** Structural check of the shared result; returns the problems found. */
function problems(value: ResultEnvelope): readonly string[] {
	const found: string[] = [];
	if (value.schemaVersion !== RESULT_SCHEMA_VERSION) found.push("schemaVersion");
	if (value.tool !== "xxx") found.push("tool");
	if (!Array.isArray(value.results) || value.results.length === 0) found.push("results");
	for (const result of value.results ?? []) {
		const file = result as FileResult;
		if (typeof file.file !== "string" || typeof file.language !== "string") found.push("file/language");
		if (file.mode !== "check" && file.mode !== "write") found.push("mode");
		if (!PARSES.has(file.parse?.status)) found.push("parse.status");
		for (const group of file.groups ?? []) {
			if (!STATES.has(group.state)) found.push(`state ${group.state}`);
			if (!(group.startLine >= 1 && group.endLine >= group.startLine && group.rows >= 1 && Array.isArray(group.axes))) found.push("group shape");
		}
		if (JSON.stringify(file.summary) !== JSON.stringify(summarize(file.groups ?? []))) found.push("summary");
	}
	return found;
}

function run(script: string, args: readonly string[]): ResultEnvelope {
	const result = Bun.spawnSync(["bun", resolve(root, script), ...args, "--json"], { cwd: root, stdout: "pipe", stderr: "pipe" });
	return JSON.parse(result.stdout.toString()) as ResultEnvelope;
}

const LINE_ENGINE = [["python", "py"], ["java", "java"], ["go", "go"], ["rust", "rs"], ["javascript", "js"], ["c", "c"], ["cpp", "cpp"]] as const;

describe("shared result JSON", () => {
	test("TypeScript aligner emits a valid envelope", () => {
		const value = run("skills/xxx/scripts/typescript/06_align-tables.ts", ["--file", "skills/xxx/fixtures/table-kinds.ts"]);
		expect(problems(value)                                                  ).toEqual([]          ) ;
		expect(value.results[0]!.language                                       ).toBe   ("typescript") ;
		expect(value.results[0]!.groups.some(group => group.state === "FIXABLE")).toBe   (true        ) ;
	});

	for (const [language, extension] of LINE_ENGINE) {
		test(`${language} aligner emits a valid envelope`, () => {
			const value = run(`skills/xxx/scripts/${language}/06_align-tables.ts`, ["--file", `skills/xxx/fixtures/${language}/tables.${extension}`]);
			expect(problems(value)).toEqual([]);
			expect(value.results[0]!.language).toBe(language);
		});
	}

	test("write mode reports the re-parse result", () => {
		const workspace = mkdtempSync(join(import.meta.dir, "result-json-")) ;
		const target    = join(workspace, "tables.py")                       ;
		workspaces.push(workspace);
		copyFileSync(resolve(root, "skills/xxx/fixtures/python/tables.py"), target);
		const value = run("skills/xxx/scripts/python/06_align-tables.ts", ["--file", relative(root, target), "--write"]);
		expect(problems(value)       ).toEqual  ([]                            ) ;
		expect(value.results[0]!.mode).toBe     ("write"                       ) ;
		expect(["ok", "skipped"]     ).toContain(value.results[0]!.parse.status) ;
	});
});
