import      {
              afterEach     ,
              describe      ,
              expect        ,
              test
                              } from "bun:test"    ;
import      { createHash      } from "node:crypto" ;
import      {
              existsSync    ,
              lstatSync     ,
              mkdirSync     ,
              mkdtempSync   ,
              readFileSync  ,
              readdirSync   ,
              realpathSync  ,
              rmSync        ,
              writeFileSync
                              } from "node:fs"     ;
import      { tmpdir          } from "node:os"     ;
import      { join, resolve   } from "node:path"   ;

const CLI             = resolve(import.meta.dir, "../product/engine/00_cli.ts")                                         ;
const VERSION         = JSON.parse(readFileSync(resolve(import.meta.dir, "../package.json"), "utf8")).version as string ;
const roots: string[] = []                                                                                              ;
const SOURCE          = "a = 1\nlonger = 22\nmid = 333\n"                                                               ;
const DENIED          = "a: int = 1\nlonger: int = 22\nmid: int = 333\n"                                                ;
const SECRET          = "PRIVATE_CONVERSATION_COMMAND_SOURCE"                                                           ;
const hash            = (value: string): string => createHash("sha256").update(value).digest("hex")                     ;

function fixture() {
	const base = realpathSync(mkdtempSync(join(tmpdir(), "boxbox-cli-controls-")));
	roots.push(base);
	const paths = { root: join(base, "project"), data: join(base, "data"), home: join(base, "home"), config: join(base, "config"), claude: join(base, "claude"), codex: join(base, "codex") };
	for (const path of Object.values(paths)) mkdirSync(path);
	return paths;
}

type Fixture = ReturnType<typeof fixture>;

function environment(value: Fixture, patch: Record<string, string | undefined> = {}) {
	return {
		...process.env, HOME: value.home, USERPROFILE: value.home, XDG_CONFIG_HOME: value.config,
		CLAUDE_CONFIG_DIR: value.claude, CODEX_HOME: value.codex, CLAUDE_PLUGIN_DATA: value.data, PLUGIN_DATA: "",
		CLAUDE_PROJECT_DIR: value.root, CODEX_THREAD_ID: "", CODEX_SESSION_ID: "", BOXBOX_MODE: "", BOXBOX_UPDATE_CHECK: "0", BOXBOX_COLOR: "0", NO_COLOR: "1", ...patch,
	};
}

function run(value: Fixture, args: readonly string[], input: unknown = {}, patch: Record<string, string | undefined> = {}, cwd = value.root) {
	const source = `import { runCli } from ${JSON.stringify(CLI)};process.exitCode=await runCli(JSON.parse(process.env.BOXBOX_TEST_ARGS!),process.cwd());`;
	const result = Bun.spawnSync([process.execPath, "-e", source], {
		cwd, env: { ...environment(value, patch), BOXBOX_TEST_ARGS: JSON.stringify(args) }, stdin: Buffer.from(JSON.stringify(input)), stdout: "pipe", stderr: "pipe",
	});
	return { status: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

function hook(value: Fixture, event: string, session = "controls-session", tool = "Write") {
	const result = run(value, ["hook", event], { session_id: session, cwd: value.root, tool_name: tool });
	expect(result.status).toBe(0);
	return JSON.parse(result.stdout);
}

function sessionFolder(value: Fixture, id = "controls-session"): string {
	return join(value.data, "hooks", hash(value.root).slice(0, 16), hash(id));
}

function receipts(value: Fixture, id = "controls-session") {
	const directory = sessionFolder(value, id);
	return readdirSync(directory).filter(name => name.endsWith(".json") && name !== "baseline.json").sort().map(name => JSON.parse(readFileSync(join(directory, name), "utf8")));
}

function claudeRecord(value: Fixture, id = "controls-session"): void {
	const directory = join(value.claude, "projects", "isolated");
	mkdirSync(directory, { recursive: true });
	const first = { type: "assistant", cwd: value.root, sessionId: id, message: { id: "one-message", model: "claude-test", content: [{ type: "text", text: SECRET }], usage: { input_tokens: 3, cache_read_input_tokens: 9, cache_creation_input_tokens: 2, output_tokens: 5 } } } ;
	const last  = structuredClone(first)                                                                                                                                                                                                                                           ;
	last.message.usage.output_tokens = 12;
	writeFileSync(join(directory, "session.jsonl"), [first, last, first].map(value => JSON.stringify(value)).join("\n") + "\n");
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("production CLI session controls", () => {
	test("mode persists project/global precedence and statusline reads that state without probing", () => {
		const value = fixture();
		expect(JSON.parse(run(value, ["mode", "align", "--global", "--json"]).stdout)).toMatchObject({ mode: "align", scope: "global" }    ) ;
		expect(JSON.parse(run(value, ["mode", "refactor", "--json"]).stdout)         ).toMatchObject({ mode: "refactor", scope: "project" }) ;
		expect(JSON.parse(run(value, ["mode", "--json"]).stdout).mode                ).toBe         ("refactor"                            ) ;
		expect(JSON.parse(run(value, ["mode", "--global", "--json"]).stdout).mode    ).toBe         ("align"                               ) ;
		const payload = { workspace: { current_dir: value.root } }                                                          ;
		const plain   = run(value, ["statusline", "--left", "--no-color"], payload)                                         ;
		const colored = run(value, ["statusline", "--left"], payload, { NO_COLOR: undefined, BOXBOX_COLOR: "1", PATH: "" }) ;

		expect(plain.status                           )    .toBe     (0            ) ;
		expect(plain.stdout                           )    .toContain("BB·REFACTOR") ;
		expect(plain.stdout                           ).not.toContain("\x1b["      ) ;
		expect(colored.stdout                         )    .toContain("\x1b["      ) ;
		expect(existsSync(join(value.root, ".boxbox")))    .toBe     (false        ) ;
	});

	test("update check reports probe failure without discarding the seeded version", () => {
		const value = fixture()                                ;
		const state = join   (value.config, "boxbox", "state") ;
		mkdirSync(state, { recursive: true });
		writeFileSync(join(state, "update.json"), JSON.stringify({ checkedAt: new Date().toISOString(), latest: "9.0.0" }));
		const emptyPath = join(value.home, "no-programs");
		mkdirSync(emptyPath);
		const driver = `
import { mock } from "bun:test";
const child=await import("node:child_process");
const spawnSync=child.spawnSync;
mock.module("node:child_process",()=>({...child,spawnSync:(command,args,options)=>{
 if(command==="git"&&args[0]==="ls-remote")return {status:1,stdout:"",stderr:"offline fixture"};
 return spawnSync(command,args,options);
}}));
const {runCli}=await import(${JSON.stringify(CLI)});
process.exitCode=await runCli(["update","--check","--json"],process.cwd());
`;
		const processResult = Bun.spawnSync([process.execPath, "-e", driver], { cwd: value.root, env: environment(value, { PATH: emptyPath }), stdout: "pipe", stderr: "pipe" }) ;
		const result        = { status: processResult.exitCode, stdout: processResult.stdout.toString() }                                                                        ;

		expect(result.status                          ).toBe         (2                                                                                   ) ;
		expect(JSON.parse(result.stdout)              ).toMatchObject({ command: "update", ok: false, error: { code: "UPDATE_CHECK_FAILED" } }            ) ;
		expect(existsSync(join(value.root, ".boxbox"))).toBe         (false                                                                               ) ;
	});

	test("SessionStart passes the actual CLI version to its update-advice dependency", () => {
		const value  = fixture()                                                         ;
		const update = resolve(import.meta.dir, "../product/engine/common/37_update.ts") ;
		const driver = `
import {mock} from "bun:test";
const update=await import(${JSON.stringify(update)});
mock.module(${JSON.stringify(update)},()=>({...update,updateNotice:version=>({user:"fixture-version:"+version,context:"captured-version:"+version})}));
const {runCli}=await import(${JSON.stringify(CLI)});
process.exitCode=await runCli(["hook","session"],process.cwd());
`;
		const result = Bun.spawnSync([process.execPath, "-e", driver], { cwd: value.root, env: environment(value), stdin: Buffer.from(JSON.stringify({ session_id: "version-seam", cwd: value.root })), stdout: "pipe", stderr: "pipe" });

		expect(result.exitCode).toBe(0);
		expect(JSON.parse(result.stdout.toString()).systemMessage).toBe(`fixture-version:${VERSION}`);
	});

	test("actual hook dispatch captures off baseline, inspects check/refactor and aligns only approved writes", () => {
		const value = fixture();
		run(value, ["mode", "off"]);
		expect(JSON.stringify(hook(value, "session"))).toContain("Mode off");
		const baseline = readFileSync(join(sessionFolder(value), "baseline.json"), "utf8");
		expect(JSON.parse(baseline).schemaVersion).toBe(2);
		writeFileSync(join(value.root, "approved.py"), SOURCE);
		expect(hook(value, "post")).toEqual({});
		expect(receipts(value)).toHaveLength(0);
		run(value, ["mode", "check"]);
		expect(hook(value, "post", "controls-session", "Bash").decision).toBeUndefined();
		expect(receipts(value).at(-1)).toMatchObject({ mode: "check", state: "FAIL", automaticFixPerformed: false });
		run(value, ["mode", "refactor"]);
		expect(hook(value, "post").decision).toBe("block");
		expect(readFileSync(join(value.root, "approved.py"), "utf8")).toBe(SOURCE);
		run(value, ["mode", "align"]);
		expect(hook(value, "post").decision).toBeUndefined();
		const aligned = receipts(value).at(-1)                                                                ;
		const output  = readFileSync(join(value.root, "approved.py"), "utf8")                                 ;
		const lines   = SOURCE.split("\n").filter((line, index) => line !== output.split("\n")[index]).length ;

		expect(aligned).toMatchObject({ mode: "align", state: "PASS", automaticFixPerformed: true, aligned: [{ file: "approved.py", edits: lines }] });
		expect(readFileSync(join(sessionFolder(value), "baseline.json"), "utf8")).toBe(baseline);
		writeFileSync(join(value.root, "denied.py"), DENIED);
		expect(hook(value, "post", "controls-session", "Bash").decision).toBeUndefined();
		expect(readFileSync(join(value.root, "denied.py"), "utf8")).toBe         (DENIED                                                      ) ;
		expect(receipts(value).at(-1)                             ).toMatchObject({ state: "FAIL", automaticFixPerformed: false, aligned: [] }) ;
		expect(hook(value, "stop").decision                       ).toBe         ("block"                                                     ) ;
		expect(hook(value, "stop").decision).toBeUndefined();
	}, 60_000);

	test("exported approved hook seam reports zero for no-op and preserves disabled or invalid source", () => {
		const value  = fixture()                        ;
		const target = join   (value.root, "sample.py") ;
		writeFileSync(target, SOURCE);
		const driver = `import { alignApprovedHook } from ${JSON.stringify(CLI)};const root=process.cwd();const a=await alignApprovedHook(root,"sample.py");const b=await alignApprovedHook(root,"sample.py");console.log(JSON.stringify([a,b]));` ;
		const result = Bun.spawnSync([process.execPath, "-e", driver], { cwd: value.root, env: environment(value), stdout: "pipe", stderr: "pipe" })                                                                                               ;

		expect(result.exitCode                        ).toBe         (0                           ) ;
		expect(JSON.parse(result.stdout.toString())[0]).toMatchObject({ written: true }           ) ;
		expect(JSON.parse(result.stdout.toString())[1]).toEqual      ({ written: false, edits: 0 }) ;
		mkdirSync(join(value.root, ".boxbox"));
		writeFileSync(join(value.root, ".boxbox/config.json"), JSON.stringify({ schemaVersion: 2, languages: ["typescript"] }));
		writeFileSync(target, "if:\n");
		const rejected = Bun.spawnSync([process.execPath, "-e", driver], { cwd: value.root, env: environment(value), stdout: "pipe", stderr: "pipe" });
		expect(rejected.exitCode).not.toBe(0);
		expect(readFileSync(target, "utf8")).toBe("if:\n");
		writeFileSync(join(value.root, ".boxbox/config.json"), JSON.stringify({ schemaVersion: 2, languages: ["python"] }));
		const invalid = Bun.spawnSync([process.execPath, "-e", driver], { cwd: value.root, env: environment(value), stdout: "pipe", stderr: "pipe" });
		expect(invalid.exitCode).not.toBe(0);
		expect(readFileSync(target, "utf8")).toBe("if:\n");
	});

	test("approved hook alignment rejects a source change after its real preview before applying", () => {
		const value  = fixture()                        ;
		const target = join   (value.root, "sample.py") ;
		writeFileSync(target, SOURCE);
		const pipeline = resolve(import.meta.dir, "../product/engine/common/21_format-pipeline.ts");
		const driver = `
import {mock} from "bun:test";
import {writeFileSync} from "node:fs";
const pipeline=await import(${JSON.stringify(pipeline)});
const original=pipeline.runFormatPipeline;
let calls=0;
mock.module(${JSON.stringify(pipeline)},()=>({...pipeline,runFormatPipeline:async options=>{
 calls+=1;
 const result=await original(options);
 if(options.dryRun)writeFileSync(${JSON.stringify(target)},"concurrent = True\\n");
 return result;
}}));
const {alignApprovedHook}=await import(${JSON.stringify(CLI)});
try{await alignApprovedHook(process.cwd(),"sample.py");console.log(JSON.stringify({error:null,calls}));}
catch(error){console.log(JSON.stringify({error:error.message,calls}));}
`;
		const result = Bun.spawnSync([process.execPath, "-e", driver], { cwd: value.root, env: environment(value), stdout: "pipe", stderr: "pipe" });

		expect(result.exitCode                     ).toBe         (0                                                            ) ;
		expect(JSON.parse(result.stdout.toString())).toMatchObject({ error: "Source changed after alignment preview", calls: 1 }) ;
		expect(readFileSync(target, "utf8")        ).toBe         ("concurrent = True\n"                                        ) ;
	});

	test("human checks display Python semantic kinds without changing legacy table identity", () => {
		const value = fixture();
		writeFileSync(join(value.root, "sample.py"), SOURCE);
		const text  = run(value, ["check", "--file", "sample.py"])                                          ;
		const json  = JSON.parse(run(value, ["check", "--file", "sample.py", "--json"]).stdout)             ;
		const group = json.results[0].groups.find((entry: { semanticKind?: string }) => entry.semanticKind) ;

		expect(group).toBeDefined();
		expect(text.stdout).toContain(`group ${group.semanticKind} kind=${group.kind} lines=${group.startLine}-${group.endLine} rows=${group.rows} state=${group.state}`);
		expect(group.kind).toBe("table");
	});

	test("new control options reject duplicates, missing values and conflicting actions before side effects", () => {
		const value = fixture();
		for (const args of [
			["mode", "check", "--global", "--global"], ["mode", "--json", "--json"], ["mode", "other"],
			["update", "--check", "--check"], ["update", "--source"], ["update", "--host", "invalid"], ["update", "--snooze", "0"], ["update", "--check", "--snooze"],
			["statusline", "--wrap"], ["statusline", "--left", "--left"], ["statusline", "--install-shim", "--left"],
			["monitor", "--project", "--session", "id"], ["monitor", "--host", "invalid"], ["monitor", "--host"], ["monitor", "--session"],
			["monitor", "--html"], ["monitor", "--html", "relative.html"], ["monitor", "--no-paths", "--no-paths"], ["monitor", "--unknown"],
		]) expect(run(value, args).status).toBe(2);
		expect(readdirSync(value.data)).toEqual([]);
		expect(readdirSync(value.root)).toEqual([]);
	});
});

describe("public monitor commands", () => {
	test("Claude monitor writes private HTML with real hook evidence and projects no conversation or source text", () => {
		const value  = fixture()                              ;
		const target = join   (value.root, "private_name.py") ;
		writeFileSync(target, SOURCE);
		hook(value, "session");
		writeFileSync(target, SOURCE + `\n# ${SECRET}\n`);
		hook(value, "post");
		claudeRecord(value);
		const before = readFileSync(target                                                 ) ;
		const result = run         (value, ["monitor", "--project", "--no-paths", "--json"]) ;
		const report = JSON.parse  (result.stdout                                          ) ;
		const html   = readFileSync(report.html, "utf8"                                    ) ;

		expect(result.status                             ).toBe         (0                                                                                                                               ) ;
		expect(report                                    ).toMatchObject({ host: "claude", totals: { input: 3, cacheRead: 9, cacheWrite: 2, output: 12 }, html: join(value.data, "monitor-claude.html") }) ;
		expect(report.sessions[0].receipts               ).toHaveLength (1                                                                                                                               ) ;
		expect(report.sessions[0].footprint.available    ).toBe         (true                                                                                                                            ) ;
		expect(report.sessions[0].footprint.files[0].file).toBe         ("file-1"                                                                                                                        ) ;
		for (const text of [result.stdout, html]) {
			expect(text).not.toContain(SECRET);
			expect(text).not.toContain("private_name.py");
		}
		expect(readFileSync(target).equals(before)).toBe(true);
		expect(readdirSync(value.root)).toEqual(["private_name.py"]);
		if (process.platform !== "win32") expect(lstatSync(report.html).mode & 0o777).toBe(0o600);
		const text = run(value, ["monitor", "--session", "controls-session"]);
		expect(text.stdout)    .toContain("HTML:"          ) ;
		expect(text.stdout)    .toContain("output=12"      ) ;
		expect(text.stdout).not.toContain("<!doctype html>") ;
	});

	test("legacy baselines and legacy/schema-1/v2 receipts remain separately readable through the CLI", () => {
		const value = fixture();
		hook(value, "session");
		writeFileSync(join(value.root, "sample.py"), SOURCE);
		hook(value, "post");
		claudeRecord(value);
		const directory = sessionFolder(value) ;
		const record    = receipts(value)[0]   ;
		const { mode: _mode, aligned: _aligned, ...shared } = record;
		writeFileSync(join(directory, "schema-one.json"), JSON.stringify({ ...shared, schemaVersion: 1, automaticFixPerformed: false }));
		const { schemaVersion: _schema, coverage: _coverage, deleted: _deleted, ...legacy } = shared;
		writeFileSync(join(directory, "legacy.json"), JSON.stringify(legacy));
		const baseline = JSON.parse(readFileSync(join(directory, "baseline.json"), "utf8"));
		writeFileSync(join(directory, "baseline.json"), JSON.stringify(baseline.hashes));
		const result  = run(value, ["monitor", "--session", "controls-session", "--json"]) ;
		const session = JSON.parse(result.stdout).sessions[0]                              ;

		expect(result.status                                                        ).toBe        (0    ) ;
		expect(session.footprint.available                                          ).toBe        (false) ;
		expect(session.receipts                                                     ).toHaveLength(3    ) ;
		expect(session.receipts.filter((entry: { legacy: boolean }) => entry.legacy)).toHaveLength(1    ) ;
		expect(session.unreadable                                                   ).toBe        (0    ) ;
	});

	test("Codex auto discovery uses cumulative usage and escapes raw session identity in one custom HTML page", () => {
		const value = fixture()                           ;
		const id    = "session-<script>alert(1)</script>" ;
		mkdirSync(join(value.codex, "sessions"));
		const usage = (input: number, cache: number, output: number) => ({ type: "event_msg", payload: { type: "token_count", info: { total_token_usage: { input_tokens: input, cached_input_tokens: cache, output_tokens: output } } } });
		const lines = [
			{ type: "session_meta", payload: { id, cwd: value.root } },
			{ type: "turn_context", payload: { model: "gpt-test", effort: "high" } },
			{ type: "response_item", payload: { type: "function_call", name: "exec_command", arguments: JSON.stringify({ cmd: `echo ${SECRET}` }) } },
			usage(100, 40, 10), usage(100, 40, 10), usage(160, 60, 25),
		];
		writeFileSync(join(value.codex, "sessions/record.jsonl"), lines.map(value => JSON.stringify(value)).join("\n") + "\n");
		const path   = join        (value.data, "reports", "custom.html"                                                      ) ;
		const result = run         (value, ["monitor", "--session", id, "--html", path, "--json"], {}, { CODEX_THREAD_ID: id }) ;
		const report = JSON.parse  (result.stdout                                                                             ) ;
		const html   = readFileSync(path, "utf8"                                                                              ) ;

		expect(result.status                                                                                              )    .toBe         (0                                                                               ) ;
		expect(report                                                                                                     )    .toMatchObject({ host: "codex", totals: { input: 100, cacheRead: 60, output: 25 }, html: path }) ;
		expect(report.sessions                                                                                            )    .toHaveLength (1                                                                               ) ;
		expect(html                                                                                                       )    .toContain    ("&lt;script&gt;"                                                                ) ;
		expect(html                                                                                                       ).not.toContain    ("<script>"                                                                      ) ;
		expect(html                                                                                                       ).not.toContain    (SECRET                                                                          ) ;
		expect(result.stdout                                                                                              ).not.toContain    (SECRET                                                                          ) ;
		expect(existsSync(join(value.data, "monitor-codex.html"))                                                         )    .toBe         (false                                                                           ) ;
		expect(JSON.parse(run(value, ["monitor", "--host", "claude", "--json"], {}, { CODEX_SESSION_ID: id }).stdout).host)    .toBe         ("claude"                                                                        ) ;
	});

	test("missing, relative or project-local plugin data and unsafe HTML destinations never write to the project", () => {
		const value = fixture();
		for (const data of ["", "relative", value.root]) {
			const result = run(value, ["monitor", "--json"], {}, { CLAUDE_PLUGIN_DATA: data, PLUGIN_DATA: "" });
			expect(result.status).toBe(2);
			if (data !== value.root) expect(JSON.parse(result.stdout).error.code).toBe("MISSING_PLUGIN_DATA");
		}
		expect(run(value, ["monitor", "--html", join(value.root, "report.html"), "--json"]).status).toBe   (2    ) ;
		expect(readdirSync(value.root)                                                            ).toEqual([]   ) ;
		expect(existsSync(join(value.root, "report.html"))                                        ).toBe   (false) ;
	});
});
