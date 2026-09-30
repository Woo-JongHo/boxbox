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

describe("훅 — 대상 판단", () => {
	test("쓰기 도구로 1차 범위 언어 파일을 쓸 때만 대상이다", () => {
		const target = (tool_name: string, file_path: string) => hookTarget({ tool_name, tool_input: { file_path } })?.language;

		expect(target("Write"    , "/p/a.ts" )).toBe("typescript") ;
		expect(target("Edit"     , "/p/a.py" )).toBe("python"    ) ;
		expect(target("MultiEdit", "/p/a.mts")).toBe("typescript") ;
		expect(target("Read"     , "/p/a.ts"        )).toBeUndefined()    ;
		expect(target("Write"    , "/p/a.d.ts"      )).toBeUndefined()    ;
		expect(target("Write"    , "/p/.xxx/cache/a.ts")).toBeUndefined() ;
		expect(target("Write"    , "/p/a.go"        )).toBeUndefined()    ;
	});

	test("세션 안내는 헌장의 핵심 3줄을 그대로 쓴다", () => {
		const core = coreLines(readFileSync(join(ROOT, "skills/xxx/references/charter.md"), "utf8"));

		expect(core.split("\n")).toHaveLength(3);
		expect(core).toStartWith("1. 같은 역할의 코드는") ;
		expect(() => coreLines("표시 없음")).toThrow()    ;
	});
});

describe("훅 — 알릴 문장", () => {
	const result = (state: "FIXABLE" | "PASS", axes: readonly string[] = ["equal=4", "value"]): FileResult => ({
		file: "a.py", language: "python", mode: "check", summary: { groups: 1, misaligned: 0, edits: 0, refused: 0, suggested: 0 },
		groups: [{ kind: "table", startLine: 1, endLine: 3, rows: 3, axes: ["name", ...axes], state, edits: state === "FIXABLE" ? 2 : 0 }],
		parse: { status: "not-run", tool: "python3" },
	});

	test("에이전트가 고칠 수 없는 알람(A5 모호)만 있으면 아무것도 알리지 않는다", () => {
		const report = buildReport({ result: result("PASS"), text: "A = 1\nB = 2\nC = 3" });

		expect(report.alarms.map(alarm => alarm.id)).toEqual(["A5"]);
		expect(postMessage(report)                 ).toBeUndefined()  ;
		expect(AGENT_ALARMS.has("A5")              ).toBe(false)      ;
	});

	test("새 알람만 알리고, 기존 알람 수는 책임이 아니라고 적는다", () => {
		const current  = buildReport({ result: result("FIXABLE"), text: "A = 1\nBB = 2\nC = 3" })                ;
		const baseline = buildReport({ result: result("PASS"   ), text: "A = 1\nBB = 2\nC = 3" })                ;
		const message  = postMessage({ ...current, comparison: compareAlarms(current.alarms, baseline.alarms) }) ;

		expect(message)    .toContain("생긴 알람 1건"                     ) ;
		expect(message)    .toContain("A0 정렬 대기"                      ) ;
		expect(message)    .toContain("기존 1건은 이번 편집의 책임이 아님") ;
		expect(message).not.toContain("A5"                                ) ;
	});
});

describe("훅 — 흐름 (Claude Code 입력 흉내)", () => {
	const run = (project: string, mode: string, input: object, env: Record<string, string> = {}) =>
		spawnSync(process.execPath, [HOOK, mode], { input: JSON.stringify(input), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: project, ...env } });
	const context = (stdout: string): string | undefined => stdout.trim() === "" ? undefined : (JSON.parse(stdout) as { hookSpecificOutput: { additionalContext: string } }).hookSpecificOutput.additionalContext;

	test("기존 파일을 고치면 그 편집에서 생긴 알람만 돌아오고, 기준본은 치워진다", () => {
		const project = mkdtempSync(join(tmpdir(), "xxx-hook-"))                                                   ;
		const file    = join(project, "app.py")                                                                    ;
		const input   = { session_id: "s", tool_name: "Edit", tool_use_id: "t1", tool_input: { file_path: file } } ;
		writeFileSync(file, readFileSync(FIXTURE, "utf8"));

		expect(context(run(project, "pre", input).stdout)).toBeUndefined();
		writeFileSync(file, readFileSync(file, "utf8").replace('    "port": 8080,', `    "port": 8080,\n    "description": "${"x".repeat(120)}",`));
		const message = context(run(project, "post", input).stdout);

		expect(message                                                     )    .toContain("A1 한계선 초과") ;
		expect(message                                                     )    .toContain("A3 이상값 행"  ) ;
		expect(message                                                     ).not.toContain("A5"            ) ;
		expect(readdirSync(join(project, ".xxx/cache/baseline"))           )    .toEqual  ([]              ) ;
		expect(readFileSync(join(project, ".xxx/cache/.gitignore"), "utf8"))    .toBe     ("*\n"           ) ;
		expect(existsSync(join(project, ".xxx/cache/hook-timing.jsonl"))   )    .toBe     (true            ) ;
	});

	test("새 파일은 언어별로 세션당 한 번 안내하고, 새 알람이 없는 편집은 조용하다", () => {
		const project = mkdtempSync(join(tmpdir(), "xxx-hook-"))                                                                     ;
		const first   = { session_id: "s", tool_name: "Write", tool_use_id: "t1", tool_input: { file_path: join(project, "a.py") } } ;
		const second  = { session_id: "s", tool_name: "Write", tool_use_id: "t2", tool_input: { file_path: join(project, "b.py") } } ;

		expect(context(run(project, "pre", first ).stdout)).toContain("새 python 파일");
		expect(context(run(project, "pre", second).stdout)).toBeUndefined();
		writeFileSync(join(project, "a.py"), "value = 1\n");

		expect(context(run(project, "post", first).stdout)).toBeUndefined();
	});

	test("XXX_HOOKS=off이면 아무것도 하지 않고, 잘못된 입력에도 편집을 막지 않는다", () => {
		const project = mkdtempSync(join(tmpdir(), "xxx-hook-"))                                                                                                    ;
		const off     = run(project, "session", {}, { XXX_HOOKS: "off" })                                                                                           ;
		const broken  = spawnSync(process.execPath, [HOOK, "post"], { input: "{not json", encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: project } }) ;

		expect(off.stdout   ).toBe("") ;
		expect(broken.status).toBe(0 ) ;
		expect(broken.stdout).toBe("") ;
	});

	test("플러그인 hooks.json은 세 이벤트를 이 훅 스크립트로 잇는다", () => {
		const hooks = JSON.parse(readFileSync(join(ROOT, "hooks/hooks.json"), "utf8")) as { hooks: Record<string, { matcher?: string; hooks: { command: string }[] }[]> };

		expect(Object.keys(hooks.hooks).sort()).toEqual(["PostToolUse", "PreToolUse", "SessionStart"]);
		for (const entries of Object.values(hooks.hooks)) expect(entries[0]?.hooks[0]?.command).toContain("${CLAUDE_PLUGIN_ROOT}/skills/xxx/scripts/hook.ts");
		expect(hooks.hooks["PostToolUse"]?.[0]?.matcher).toBe("Write|Edit|MultiEdit");
	});
});
