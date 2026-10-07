import { afterEach, expect, test                 } from "bun:test"           ;
import { existsSync, mkdtempSync, readdirSync     } from "node:fs"            ;
import { rmSync, writeFileSync                    } from "node:fs"            ;
import { join                                     } from "node:path"          ;
import { spawnSync                                } from "node:child_process" ;

const CLI                   = join(import.meta.dir, "../packaging/cli/entry.ts") ;
const workspaces : string[] = []                                                 ;

afterEach(() => {
	for (const root of workspaces.splice(0)) rmSync(root, { recursive: true, force: true });
});

function project(): string {
	const root = mkdtempSync(join(import.meta.dir, "xxx-lifecycle-hook-"));
	workspaces.push(root);
	return root;
}

/** data를 주면 플러그인처럼 --root 없이 cwd 입력과 CLAUDE_PLUGIN_DATA로 부른다. */
function hook(root: string, mode: "session" | "post" | "stop", input: Record<string, unknown>, data?: string): Record<string, unknown> {
	const args = data ? [CLI, "hook", mode] : [CLI, "hook", mode, "--root", root];
	const run  = spawnSync(process.execPath, args, { input: JSON.stringify(data ? { ...input, cwd: root } : input), encoding: "utf8", env: { ...process.env, CLAUDE_PLUGIN_DATA: data ?? "" } });
	expect(run.status).toBe(0);
	return JSON.parse(run.stdout);
}

test("지원하지 않는 파일 변경은 이후 PostToolUse·Stop을 막지 않는다", () => {
	const root = project();
	hook(root, "session", { session_id: "one" });
	writeFileSync(join(root, "one.js"), "x=1\n");

	expect(hook(root, "post", { session_id: "one", tool_name: "Write" }).decision).toBeUndefined();
	expect(hook(root, "stop", { session_id: "one" }).decision                    ).toBeUndefined();
}, 60_000);

test("Stop은 stop_hook_active면 정렬 실패가 남아도 다시 막지 않는다", () => {
	const root = project();
	hook(root, "session", { session_id: "two" });
	writeFileSync(join(root, "sample.py"), "a = 1\nlonger = 22\nmid = 333\n");

	expect(hook(root, "post", { session_id: "two", tool_name: "Write" }).decision     ).toBe("block")   ;
	expect(hook(root, "stop", { session_id: "two" }).decision                         ).toBe("block")   ;
	expect(hook(root, "stop", { session_id: "two", stop_hook_active: true }).decision ).toBeUndefined() ;
	expect(hook(root, "stop", { session_id: "two" }).decision                         ).toBeUndefined() ;
}, 60_000);

test("플러그인 훅은 cwd 입력을 쓰고 기록을 프로젝트가 아닌 플러그인 데이터 폴더에 남긴다", () => {
	const root = project() ;
	const data = project() ;
	hook(root, "session", { session_id: "three" }, data);
	writeFileSync(join(root, "sample.py"), "a = 1\nlonger = 22\nmid = 333\n");

	expect(hook(root, "post", { session_id: "three", tool_name: "apply_patch" }, data).decision ).toBe("block") ;
	expect(existsSync(join(root, ".xxx"))                                                       ).toBe(false)   ;
	expect(readdirSync(join(data, "hooks")).length                                              ).toBe(1)       ;
}, 60_000);

test("훅 자체 오류는 작업을 막지 않고 알리기만 한다", () => {
	const root   = project()                                     ;
	const output = hook(root, "post", { session_id: "missing" }) ;

	expect(output.decision                        ).toBeUndefined()            ;
	expect(JSON.stringify(output.hookSpecificOutput)).toContain("hook error") ;
}, 60_000);
