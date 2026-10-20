import      { afterEach, expect, test              } from "bun:test"           ;
import      { existsSync, mkdtempSync, readdirSync } from "node:fs"            ;
import      { rmSync, writeFileSync                } from "node:fs"            ;
import      { join                                 } from "node:path"          ;
import      { spawnSync                            } from "node:child_process" ;

const CLI                   = join(import.meta.dir, "../product/packages/cli/entry.ts") ;
const workspaces : string[] = []                                                        ;

afterEach(() => {
	for (const root of workspaces.splice(0)) rmSync(root, { recursive: true, force: true });
});

function project(): string {
	const root = mkdtempSync(join(import.meta.dir, "boxbox-lifecycle-hook-"));
	workspaces.push(root);
	return root;
}

/** With data, calls it like a plugin: no --root, a cwd input and CLAUDE_PLUGIN_DATA. */
function hook(root: string, mode: "session" | "post" | "stop", input: Record<string, unknown>, data?: string): Record<string, unknown> {
	const args = data ? [CLI, "hook", mode] : [CLI, "hook", mode, "--root", root]                                                                                                                ;
	const run  = spawnSync(process.execPath, args, { input: JSON.stringify(data ? { ...input, cwd: root } : input), encoding: "utf8", env: { ...process.env, CLAUDE_PLUGIN_DATA: data ?? "" } }) ;
	expect(run.status).toBe(0);
	return JSON.parse(run.stdout);
}

test("changes to unsupported files do not block later PostToolUse or Stop", () => {
	const root = project();
	hook(root, "session", { session_id: "one" });
	writeFileSync(join(root, "one.js"), "x=1\n");

	expect(hook(root, "post", { session_id: "one", tool_name: "Write" }).decision).toBeUndefined();
	expect(hook(root, "stop", { session_id: "one" }).decision                    ).toBeUndefined();
}, 60_000);

test("Stop does not block again with stop_hook_active even when an alignment failure remains", () => {
	const root = project();
	hook(root, "session", { session_id: "two" });
	writeFileSync(join(root, "sample.py"), "a = 1\nlonger = 22\nmid = 333\n");

	expect(hook(root, "post", { session_id: "two", tool_name: "Write" }).decision     ).toBe("block")   ;
	expect(hook(root, "stop", { session_id: "two" }).decision                         ).toBe("block")   ;
	expect(hook(root, "stop", { session_id: "two", stop_hook_active: true }).decision ).toBeUndefined() ;
	expect(hook(root, "stop", { session_id: "two" }).decision                         ).toBeUndefined() ;
}, 60_000);

test("plugin hooks use the cwd input and write records to the plugin data folder, not the project", () => {
	const root = project() ;
	const data = project() ;
	hook(root, "session", { session_id: "three" }, data);
	writeFileSync(join(root, "sample.py"), "a = 1\nlonger = 22\nmid = 333\n");

	expect(hook(root, "post", { session_id: "three", tool_name: "apply_patch" }, data).decision).toBe("block") ;
	expect(existsSync(join(root, ".boxbox"))                                                   ).toBe(false  ) ;
	expect(readdirSync(join(data, "hooks")).length                                             ).toBe(1      ) ;
}, 60_000);

test("hook errors never block work; they are only reported", () => {
	const root   = project()                                     ;
	const output = hook(root, "post", { session_id: "missing" }) ;

	expect(output.decision                        ).toBeUndefined()            ;
	expect(JSON.stringify(output.hookSpecificOutput)).toContain("hook error") ;
}, 60_000);
