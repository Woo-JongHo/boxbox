import      { afterEach, expect, test } from "bun:test"                ;
import      {
              mkdtempSync           ,
              readFileSync          ,
              readdirSync           ,
              rmSync                ,
              writeFileSync         ,
              symlinkSync           ,
                                      } from "node:fs"                 ;
import      { tmpdir                  } from "node:os"                 ;
import      { join                    } from "node:path"               ;
import      { guardedRun, guardStatus } from "@/common/guarded-run.ts" ;

const roots: string[] = []                                                                                                                                                                                                                                       ;
const root            = () => { const path = mkdtempSync(join(tmpdir(), "xxx-guard-")); roots.push(path); return path; }                                                                                                                                         ;
const preflight       = () => ({ runtimeUsable: true })                                                                                                                                                                                                          ;
const inspect         = async (root: string, file: string) => ({ file, language: "python", mode: "check" as const, summary: { groups: 0, misaligned: 0, edits: 0, refused: 0, suggested: 0 }, groups: [], parse: { status: "not-run" as const, tool: "test" } }) ;
const latest          = (path: string) => JSON.parse(readFileSync(join(path, ".xxx/runs", readdirSync(join(path, ".xxx/runs"))[0]!), "utf8"))                                                                                                                    ;

afterEach(() => { for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true }); });

test("distinguishes a successful check, no changes and not storing arguments", async () => {
	const path   = root()                    ;
	const secret = "SECRET_COMMAND_ARGUMENT" ;
	expect(await guardedRun(["--root", path, "--json", "--", "python3", "-c", "open('one.py','w').write('x=1\\n')", secret], preflight, inspect, "test"))    .toBe     (0       ) ;
	expect(latest(path).state                                                                                                                           )    .toBe     ("PASS"  ) ;
	expect(JSON.stringify(latest(path))                                                                                                                 ).not.toContain(secret  ) ;
	expect(latest(path).checked[0].file                                                                                                                 )    .toBe     ("one.py") ;
});

test("a preflight failure ends before running and is recorded", async () => {
	const path = root();
	expect(await guardedRun(["--root", path, "--", "python3", "-c", "raise Exception()"], () => ({ runtimeUsable: false }), inspect, "test")).toBe(2);
	expect(latest(path)).toMatchObject({ state: "TOOL_ERROR", errorCode: "PREFLIGHT_FAILED", childExitCode: null });
});

test("child failure, unsupported and unchanged are not PASS", async () => {
	for (const [script, state, code] of [["raise SystemExit(7)", "CHILD_FAILED", 2], ["open('one.js','w').write('x=1')", "UNSUPPORTED", 2], ["pass", "NO_CHANGES", 0]] as const) {
		const path = root();
		expect(await guardedRun(["--root", path, "--", "python3", "-c", script], preflight, inspect, "test")).toBe(code);
		expect(latest(path).state).toBe(state);
	}
});

test("check errors and non-runnable commands leave an end record", async () => {
	const path = root();
	expect(await guardedRun(["--root", path, "--", "xxx-missing-executable"], preflight, inspect, "test")).toBe(2);
	expect(latest(path)).toMatchObject({ state: "TOOL_ERROR", errorCode: "CHILD_START_ERROR" });
	expect(latest(path).finishedAt).toBeTruthy();
});

test("a changed symbolic code file is not approved by the check", async () => {
	const path    = root() ;
	const outside = root() ;
	writeFileSync(join(outside, "target.py"), "x=1");
	symlinkSync(join(outside, "target.py"), join(path, "escape.py"));
	expect(await guardedRun(["--root", path, "--", "python3", "-c", "open('escape.py','w').write('x=2')"], preflight, inspect, "test")).toBe(2);
	expect(latest(path).state).toBe("TOOL_ERROR");
});

test("status marks changes made outside a run as STALE", async () => {
	const path = root();
	await guardedRun(["--root", path, "--", "python3", "-c", "pass"], preflight, inspect, "test");
	writeFileSync(join(path, "outside.py"), "x=1\n");
	const captured: string[] = []          ;
	const original           = console.log ;
	try {
		console.log = value => captured.push(String(value));
		guardStatus(["--root", path, "--json"]);
	} finally { console.log = original; }
	expect(JSON.parse(captured[0]!)).toMatchObject({ state: "STALE", changesSinceRun: ["outside.py"] });
});


test("distinguishes check failures from check exceptions and preserves the child result", async () => {
	for (const failure of [false, true]) {
		const path = root();
		const checker = async (project: string, file: string) => {
			if (failure) throw new Error("private diagnostics must not be stored");
			const result = await inspect(project, file);
			return { ...result, summary: { ...result.summary, misaligned: 1 } };
		};
		expect(await guardedRun(["--root", path, "--json", "--", "python3", "-c", "open('bad.py','w').write('x=1')"], preflight, checker, "test"))    .toBe     (failure ? 2 : 1                ) ;
		expect(latest(path).state                                                                                                                )    .toBe     (failure ? "TOOL_ERROR" : "FAIL") ;
		expect(latest(path).childExitCode                                                                                                        )    .toBe     (0                              ) ;
		expect(JSON.stringify(latest(path))                                                                                                      ).not.toContain("private diagnostics"          ) ;
	}
});
