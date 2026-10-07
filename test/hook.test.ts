import      { describe, expect, test                                            } from "bun:test"                ;
import      { spawnSync                                                         } from "node:child_process"      ;
import      { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs"                 ;
import      { tmpdir                                                            } from "node:os"                 ;
import      { join                                                              } from "node:path"               ;
import      { AGENT_ALARMS, coreLines, hookTarget, postMessage                  } from "@/common/hook.ts"        ;
import      { buildReport, compareAlarms                                        } from "@/common/report.ts"      ;
import type { FileResult                                                        } from "@/common/result-json.ts" ;

const ROOT    = join(import.meta.dir, ".."                                  ) ;
const HOOK    = join(ROOT           , "skills/xxx/scripts/hook.ts"          ) ;
const FIXTURE = join(ROOT           , "skills/xxx/fixtures/python/tables.py") ;

describe("hook — target decision", () => {
	test("is a target only when a write tool writes a first-scope language file", () => {
		const target = (tool_name: string, file_path: string) => hookTarget({ tool_name, tool_input: { file_path } })?.language;

		expect(target("Write"    , "/p/a.ts" )).toBe("typescript") ;
		expect(target("Edit"     , "/p/a.py" )).toBe("python"    ) ;
		expect(target("MultiEdit", "/p/a.mts")).toBe("typescript") ;
		expect(target("Read"     , "/p/a.ts"        )).toBeUndefined()    ;
		expect(target("Write"    , "/p/a.d.ts"      )).toBeUndefined()    ;
		expect(target("Write"    , "/p/.xxx/cache/a.ts")).toBeUndefined() ;
		expect(target("Write"    , "/p/a.go"        )).toBeUndefined()    ;
	});

	test("the session guidance uses the charter's three core lines verbatim", () => {
		const core = coreLines(readFileSync(join(ROOT, "skills/xxx/references/charter.md"), "utf8"));

		expect(core.split("\n")).toHaveLength(3);
		expect(core).toStartWith("1. Write same-role code") ;
		expect(() => coreLines("no markers")).toThrow()    ;
	});
});

describe("hook — text to report", () => {
	const result = (state: "FIXABLE" | "PASS", axes: readonly string[] = ["equal=4", "value"]): FileResult => ({
		file: "a.py", language: "python", mode: "check", summary: { groups: 1, misaligned: 0, edits: 0, refused: 0, suggested: 0 },
		groups: [{ kind: "table", startLine: 1, endLine: 3, rows: 3, axes: ["name", ...axes], state, edits: state === "FIXABLE" ? 2 : 0 }],
		parse: { status: "not-run", tool: "python3" },
	});

	test("reports nothing when the only alarms are ones the agent cannot fix (A5 ambiguous)", () => {
		const report = buildReport({ result: result("PASS"), text: "A = 1\nB = 2\nC = 3" });

		expect(report.alarms.map(alarm => alarm.id)).toEqual(["A5"]);
		expect(postMessage(report)                 ).toBeUndefined()  ;
		expect(AGENT_ALARMS.has("A5")              ).toBe(false)      ;
	});

	test("reports only new alarms and states that existing alarms are not this edit's responsibility", () => {
		const current  = buildReport({ result: result("FIXABLE"), text: "A = 1\nBB = 2\nC = 3" })                ;
		const baseline = buildReport({ result: result("PASS"   ), text: "A = 1\nBB = 2\nC = 3" })                ;
		const message  = postMessage({ ...current, comparison: compareAlarms(current.alarms, baseline.alarms) }) ;

		expect(message)    .toContain("1 alarm(s) introduced by this edit"                     ) ;
		expect(message)    .toContain("A0 pending alignment"                                   ) ;
		expect(message)    .toContain("1 existing alarm(s) are not this edit's responsibility" ) ;
		expect(message).not.toContain("A5"                                                     ) ;
	});
});

describe("hook — flow (simulating Claude Code input)", () => {
	const run = (project: string, mode: string, input: object, env: Record<string, string> = {}) =>
		spawnSync(process.execPath, [HOOK, mode], { input: JSON.stringify(input), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: project, ...env } });
	const context = (stdout: string): string | undefined => stdout.trim() === "" ? undefined : (JSON.parse(stdout) as { hookSpecificOutput: { additionalContext: string } }).hookSpecificOutput.additionalContext;

	test("editing an existing file returns only the alarms that edit introduced, and the baseline is cleaned up", () => {
		const project = mkdtempSync(join(tmpdir(), "xxx-hook-"))                                                   ;
		const file    = join(project, "app.py")                                                                    ;
		const input   = { session_id: "s", tool_name: "Edit", tool_use_id: "t1", tool_input: { file_path: file } } ;
		writeFileSync(file, readFileSync(FIXTURE, "utf8"));

		expect(context(run(project, "pre", input).stdout)).toBeUndefined();
		writeFileSync(file, readFileSync(file, "utf8").replace('    "port": 8080,', `    "port": 8080,\n    "description": "${"x".repeat(120)}",`));
		const message = context(run(project, "post", input).stdout);

		expect(message                                                     )    .toContain("A1 over hard limit") ;
		expect(message                                                     )    .toContain("A3 outlier row"    ) ;
		expect(message                                                     ).not.toContain("A5"                ) ;
		expect(readdirSync(join(project, ".xxx/cache/baseline"))           )    .toEqual  ([]                  ) ;
		expect(readFileSync(join(project, ".xxx/cache/.gitignore"), "utf8"))    .toBe     ("*\n"               ) ;
		expect(existsSync(join(project, ".xxx/cache/hook-timing.jsonl"))   )    .toBe     (true                ) ;
	});

	test("a new file gets guidance once per language per session, and an edit without new alarms is silent", () => {
		const project = mkdtempSync(join(tmpdir(), "xxx-hook-"))                                                                     ;
		const first   = { session_id: "s", tool_name: "Write", tool_use_id: "t1", tool_input: { file_path: join(project, "a.py") } } ;
		const second  = { session_id: "s", tool_name: "Write", tool_use_id: "t2", tool_input: { file_path: join(project, "b.py") } } ;

		expect(context(run(project, "pre", first ).stdout)).toContain("New python file");
		expect(context(run(project, "pre", second).stdout)).toBeUndefined();
		writeFileSync(join(project, "a.py"), "value = 1\n");

		expect(context(run(project, "post", first).stdout)).toBeUndefined();
	});

	test("with XXX_HOOKS=off it does nothing, and invalid input never blocks the edit", () => {
		const project = mkdtempSync(join(tmpdir(), "xxx-hook-"))                                                                                                    ;
		const off     = run(project, "session", {}, { XXX_HOOKS: "off" })                                                                                           ;
		const broken  = spawnSync(process.execPath, [HOOK, "post"], { input: "{not json", encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: project } }) ;

		expect(off.stdout   ).toBe("") ;
		expect(broken.status).toBe(0 ) ;
		expect(broken.stdout).toBe("") ;
	});

	test("the plugin hooks.json connects three events to this hook script", () => {
		const hooks = JSON.parse(readFileSync(join(ROOT, "hooks/hooks.json"), "utf8")) as { hooks: Record<string, { matcher?: string; hooks: { command: string }[] }[]> };

		expect(Object.keys(hooks.hooks).sort()).toEqual(["PostToolUse", "PreToolUse", "SessionStart"]);
		for (const entries of Object.values(hooks.hooks)) expect(entries[0]?.hooks[0]?.command).toContain("${CLAUDE_PLUGIN_ROOT}/skills/xxx/scripts/hook.ts");
		expect(hooks.hooks["PostToolUse"]?.[0]?.matcher).toBe("Write|Edit|MultiEdit");
	});
});
