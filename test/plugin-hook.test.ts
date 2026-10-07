import { afterEach, expect, test                             } from "bun:test"           ;
import { chmodSync, existsSync, mkdtempSync, readFileSync    } from "node:fs"            ;
import { rmSync, writeFileSync                                } from "node:fs"            ;
import { join, resolve                                        } from "node:path"          ;
import { spawnSync                                            } from "node:child_process" ;

const ROOT                  = resolve(import.meta.dir, "..")       ;
const PLUGIN                = join(ROOT, "plugin")                 ;
const ENTRY                 = join(ROOT, "packaging/cli/entry.ts") ;
const workspaces : string[] = []                                   ;

afterEach(() => {
	for (const path of workspaces.splice(0)) rmSync(path, { recursive: true, force: true });
});

function directory(): string {
	const path = mkdtempSync(join(import.meta.dir, "xxx-plugin-hook-"));
	workspaces.push(path);
	return path;
}

/** npm 공개 전이므로 가짜 npx가 shim이 넘긴 정확 버전을 기록하고 저장소의 CLI로 넘긴다. */
function fakeNpx(bin: string, log: string): void {
	const script = join(bin, "npx");
	writeFileSync(script, `#!/bin/sh\necho "$1 $2" >> "${log}"\nshift 2\nexec "${process.execPath}" "${ENTRY}" "$@"\n`);
	chmodSync(script, 0o755);
}

test("hooks.json 명령이 shim과 정확 버전 npx를 거쳐 CLI 훅을 실행하고 프로젝트에 파일을 남기지 않는다", () => {
	const project = directory()                                                                                                                                   ;
	const data    = directory()                                                                                                                                   ;
	const bin     = directory()                                                                                                                                   ;
	const log     = join(bin, "calls.log")                                                                                                                        ;
	const hooks   = JSON.parse(readFileSync(join(PLUGIN, "hooks/hooks.json"), "utf8")) as { hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>> } ;
	const command = (event: string): string => hooks.hooks[event]![0]!.hooks[0]!.command                                                                          ;
	const version = (JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { version: string }).version                                                 ;
	fakeNpx(bin, log);
	const run = (event: string, input: Record<string, unknown>): Record<string, unknown> => {
		const result = spawnSync("/bin/sh", ["-c", command(event)], {
			cwd      : project,
			input    : JSON.stringify({ ...input, cwd: project }),
			encoding : "utf8",
			env      : { ...process.env, PATH: `${bin}:${process.env.PATH}`, CLAUDE_PLUGIN_ROOT: PLUGIN, CLAUDE_PLUGIN_DATA: data },
		});
		expect(result.status).toBe(0);
		return JSON.parse(result.stdout);
	};

	run("SessionStart", { session_id: "plugin" });
	writeFileSync(join(project, "sample.py"), "a = 1\nlonger = 22\nmid = 333\n");

	expect(run("PostToolUse", { session_id: "plugin", tool_name: "Write" }).decision ).toBe("block")                ;
	expect(run("Stop", { session_id: "plugin" }).decision                            ).toBe("block")                ;
	expect(run("Stop", { session_id: "plugin" }).decision                            ).toBeUndefined()              ;
	expect(existsSync(join(project, ".xxx"))                                         ).toBe(false)                  ;
	expect(readFileSync(log, "utf8").trim().split("\n")[0]                           ).toBe(`--yes xxx@${version}`) ;
}, 60_000);
