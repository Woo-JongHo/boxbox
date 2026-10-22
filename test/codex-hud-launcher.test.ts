import { afterEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const entry = resolve(import.meta.dir, "../product/hud/codex.mjs");
const { launch, parseArguments, projectRoot } = await import(entry);
const temporary: string[] = [];

afterEach(() => {
	for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function fixture() {
	const directory         = mkdtempSync(join(tmpdir(), "boxbox-codex-launcher-test-")) ;
	const bin               = join(directory, "bin")                                     ;
	const project           = join(directory, "project ' $(touch no-file)")              ;
	const calls: string[][] = []                                                         ;

	temporary.push(directory);
	mkdirSync(bin);
	mkdirSync(project);
	for (const name of ["tmux", "codex"]) {
		const path = join(bin, name);
		writeFileSync(path, "#!/bin/sh\nexit 0\n");
		chmodSync(path, 0o755);
	}
	const dependencies = {
		platform: "linux", cwd: directory, env: { PATH: bin },
		terminal : { isTTY: true, columns: 100, rows: 30 }                                                       ,
		run      : (_command: string, args: string[]) => { calls.push(args); return { status: 0, stderr: "" }; } ,
		attach   : async (_command: string, args: string[]) => { calls.push(args); return 0; }                   ,
	};

	return { directory, bin, project, calls, dependencies, options: { pluginRoot: directory, args: [] } };
}

test("launcher accepts only its own options before the Codex separator", () => {
	const args   = ["-C", "/some project", "-c", 'model="value"', "quote ' and $(touch /never)"]                  ;
	const parsed = parseArguments(["--codex", "/usr/local/bin/codex", "--plugin-root", "/plugin", "--", ...args]) ;

	expect(parsed.args                                                                 ).toEqual(args                  ) ;
	expect(parsed.codex                                                                ).toBe   ("/usr/local/bin/codex") ;
	expect(() => parseArguments(["--plugin-root", "relative"])                         ).toThrow("absolute"            ) ;
	expect(() => parseArguments(["--plugin-root", "/plugin", "--sandbox", "read-only"])).toThrow("after --"            ) ;
	expect(parseArguments(["--help"]).help                                             ).toBe   (true                  ) ;
});

test("project selection follows Codex cd syntax and refuses roots that cannot be observed", () => {
	const { directory, project } = fixture();
	for (const args of [["-C", project], ["--cd", project], [`--cd=${project}`], [`-C${project}`]]) expect(projectRoot(args, directory)).toBe(projectRoot([], project));
	for (const args of [["--worktree"], ["--remote=ws://localhost"], ["resume", "--last"], ["fork"], ["exec", "anything"]]) expect(() => projectRoot(args, directory)).toThrow("unsupported");
	expect(projectRoot(["--model", "resume", "Explain resume"], directory)).toBe(projectRoot([], directory));
	expect(() => projectRoot(["--cd"], directory)).toThrow("requires a directory");
});

test("unsupported hosts and nested sessions fail before creating any tmux server", async () => {
	const { options, dependencies, calls } = fixture();
	await expect(launch(options, { ...dependencies, platform: "win32" })).rejects.toThrow("Native Windows is unsupported");
	await expect(launch(options, { ...dependencies, env: { ...dependencies.env, TMUX: "/existing" } })).rejects.toThrow("outside tmux");
	await expect(launch(options, { ...dependencies, terminal: { isTTY: false } })).rejects.toThrow("interactive terminal");
	expect(calls).toEqual([]);
});

test("launcher preserves argv and permissions, dedicates its server, and returns the main pane exit status", async () => {
	const { options, dependencies, calls, project, directory } = fixture();
	const args    = ["--cd", project, "--sandbox", "read-only", "-c", 'model="user-choice"', "quote ' ` $() ;\nnext"] ;
	let statePath = ""                                                                                                ;
	let mainState: { args: string[]; cwd: string; gate: string; result: string } | undefined                          ;
	const code = await launch({ ...options, args }, {
		...dependencies,
		attach: async (_command: string, attachArgs: string[]) => {
			calls.push(attachArgs);
			const create = calls.find(call => call.includes("new-session"))!;
			statePath = create[create.length - 1]!;
			mainState = JSON.parse(readFileSync(statePath, "utf8"));
			writeFileSync(mainState!.result, "23");
			return 0;
		},
	});

	expect(code                                                                                                            ).toBe   (23       ) ;
	expect(mainState!.args                                                                                                 ).toEqual(args     ) ;
	expect(mainState!.cwd                                                                                                  ).toBe   (directory) ;
	expect(existsSync(statePath)                                                                                           ).toBe   (false    ) ;
	expect(calls.every(call => call[0] === "-L" && call[1] === calls[0]![1] && call[2] === "-f" && call[3] === "/dev/null")).toBe   (true     ) ;
	const split = calls.find(call => call.includes("split-window"))!;
	expect(split.slice(-7)                                                                ).toEqual  (["--plugin-root", directory, "--root", projectRoot([], project), "--host", "codex", "--watch"]) ;
	expect(split                                                                          ).toContain("4"                                                                                           ) ;
	expect(calls.some(call => call.includes("select-pane") && call.includes("boxbox:0.0"))).toBe     (true                                                                                          ) ;
	expect(calls.at(-1)!.at(-1)                                                           ).toBe     ("kill-server"                                                                                 ) ;
});

test("failed pane setup cleans only the owned server and its temporary state", async () => {
	const { options, dependencies, calls } = fixture();
	let statePath = "";
	await expect(launch(options, {
		...dependencies,
		run: (_command: string, args: string[]) => {
			calls.push(args);
			if (args.includes("new-session")) statePath = args.at(-1)!;
			return args.includes("split-window") ? { status: 1, stderr: "cannot split pane" } : { status: 0, stderr: "" };
		},
	})).rejects.toThrow("cannot split pane");

	expect(existsSync(statePath)                              ).toBe(false        ) ;
	expect(calls.at(-1)!.at(-1)                               ).toBe("kill-server") ;
	expect(calls.every(call => call[1] === calls[0]![1])      ).toBe(true         ) ;
	expect(calls.some(call => call.includes("attach-session"))).toBe(false        ) ;
});

test("attachment failure cleans the owned server and path semicolons cannot become tmux commands", async () => {
	const { options, dependencies, calls, directory } = fixture();
	const project = join(directory, "trailing;");
	mkdirSync(project);
	await expect(launch({ ...options, pluginRoot: project, args: ["--cd", project] }, {
		...dependencies,
		attach: async () => { throw new Error("attach failed"); },
	})).rejects.toThrow("attach failed");

	const split = calls.find(call => call.includes("split-window"))!;
	expect(split               )    .toContain(`${project.slice(0, -1)}\\;`) ;
	expect(split               ).not.toContain(project                     ) ;
	expect(calls.at(-1)!.at(-1))    .toBe     ("kill-server"               ) ;
	const create = calls.find(call => call.includes("new-session"))!;
	expect(existsSync(create.at(-1)!)).toBe(false);
});

test("real pane runner passes hostile-looking arguments literally and records executable failure", () => {
	const { directory } = fixture();
	const output     = join(directory, "argv.json")                                                     ;
	const executable = join(directory, "fake-codex.mjs")                                                ;
	const args       = ["quote ' and \"", "$(touch should-not-exist)", "semi;colon", "line\nbreak", ""] ;
	const statePath  = join(directory, "state.json")                                                    ;
	const result     = join(directory, "result")                                                        ;
	const gate       = join(directory, "ready")                                                         ;

	writeFileSync(executable, 'import { writeFileSync } from "node:fs"; writeFileSync(process.argv[2], JSON.stringify(process.argv.slice(3))); process.exit(17);');
	writeFileSync(gate, "ready");
	writeFileSync(statePath, JSON.stringify({ codex: process.execPath, args: [executable, output, ...args], cwd: directory, tmux: "/usr/bin/true", server: [], gate, result }));
	const success = spawnSync(process.execPath, [entry, "--pane", statePath], { encoding: "utf8" });

	expect(success.status                                 ).toBe   (17   ) ;
	expect(JSON.parse(readFileSync(output, "utf8"))       ).toEqual(args ) ;
	expect(readFileSync(result, "utf8")                   ).toBe   ("17" ) ;
	expect(existsSync(join(directory, "should-not-exist"))).toBe   (false) ;

	const state = JSON.parse(readFileSync(statePath, "utf8"));
	state.codex = join(directory, "missing-codex");
	writeFileSync(statePath, JSON.stringify(state));
	const missing = spawnSync(process.execPath, [entry, "--pane", statePath], { encoding: "utf8" });

	expect(missing.status              ).toBe     (127                 ) ;
	expect(missing.stderr              ).toContain("Cannot start Codex") ;
	expect(readFileSync(result, "utf8")).toBe     ("127"               ) ;
});

test("direct launcher help accepts a symlinked entry path", () => {
	const { directory } = fixture()                               ;
	const script = resolve("product/hud/codex.mjs"      ) ;
	const linked = join   (directory, "linked-codex.mjs") ;
	symlinkSync(script, linked);
	const result = spawnSync(process.execPath, [linked, "--help"], { encoding: "utf8" });
	expect(result.status).toBe(0);
	expect(result.stdout).toContain("Usage: boxbox-codex");
});
