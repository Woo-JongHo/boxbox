import      { afterEach, expect, test } from "bun:test"           ;
import      {
              chmodSync             ,
              existsSync            ,
              mkdtempSync           ,
              readFileSync          ,
                                      } from "node:fs"            ;
import      { rmSync, writeFileSync   } from "node:fs"            ;
import      { join, resolve           } from "node:path"          ;
import      { spawnSync               } from "node:child_process" ;

const ROOT                  = resolve(import.meta.dir, "..")              ;
const PLUGIN                = join(ROOT, "plugin")                        ;
const ENTRY                 = join(ROOT, "product/packages/cli/entry.ts") ;
const workspaces : string[] = []                                          ;

afterEach(() => {
	for (const path of workspaces.splice(0)) rmSync(path, { recursive: true, force: true });
});

function directory(): string {
	const path = mkdtempSync(join(import.meta.dir, "boxbox-plugin-hook-"));
	workspaces.push(path);
	return path;
}

/** Record the configured engine path and forward to the development runtime for this hook adapter test. */
function fakeNode(bin: string, log: string): void {
	const script = join(bin, "node");
	writeFileSync(script, `#!/bin/sh\necho "$1" >> "${log}"\nexec "${process.execPath}" "$@"\n`);
	chmodSync(script, 0o755);
}

test("hooks.json commands run the configured local CLI through the shim and leave no files in the project", () => {
	const project = directory()                                                                                                                                   ;
	const data    = directory()                                                                                                                                   ;
	const bin     = directory()                                                                                                                                   ;
	const log     = join(bin, "calls.log")                                                                                                                        ;
	const hooks   = JSON.parse(readFileSync(join(PLUGIN, "hooks/hooks.json"), "utf8")) as { hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>> } ;
	const command = (event: string): string => hooks.hooks[event]![0]!.hooks[0]!.command                                                                          ;
	fakeNode(bin, log);
	const run = (event: string, input: Record<string, unknown>): Record<string, unknown> => {
		const result = spawnSync("/bin/sh", ["-c", command(event)], {
			cwd      : project,
			input    : JSON.stringify({ ...input, cwd: project }),
			encoding : "utf8",
			env      : { ...process.env, PATH: `${bin}:${process.env.PATH}`, BOXBOX_CLI: ENTRY, CLAUDE_PLUGIN_ROOT: PLUGIN, CLAUDE_PLUGIN_DATA: data },
		});
		expect(result.status).toBe(0);
		return JSON.parse(result.stdout);
	};

	run("SessionStart", { session_id: "plugin" });
	writeFileSync(join(project, "sample.py"), "a = 1\nlonger = 22\nmid = 333\n");

	expect(run("PostToolUse", { session_id: "plugin", tool_name: "Write" }).decision ).toBe("block")                ;
	expect(run("Stop", { session_id: "plugin" }).decision                            ).toBe("block")                ;
	expect(run("Stop", { session_id: "plugin" }).decision                            ).toBeUndefined()              ;
	expect(existsSync(join(project, ".boxbox"))                                         ).toBe(false)                  ;
	expect(readFileSync(log, "utf8").trim().split("\n")[0]                           ).toBe(ENTRY) ;
}, 60_000);

test("the plugin refuses an unconfigured engine before invoking a runtime or registry", () => {
	const env = { ...process.env };
	delete env.BOXBOX_CLI;

	const result = spawnSync("sh", [join(PLUGIN, "scripts/boxbox"), "--version"], { env, encoding: "utf8" });

	expect(result.status).toBe     (2                           ) ;
	expect(result.stdout).toBe     (""                          ) ;
	expect(result.stderr).toContain("no local engine configured") ;
});
