import      {
              afterAll      ,
              beforeAll     ,
              expect        ,
              test          ,
                              } from "bun:test"           ;
import      { spawnSync       } from "node:child_process" ;
import      {
              chmodSync     ,
              cpSync        ,
              existsSync    ,
              mkdirSync     ,
              mkdtempSync   ,
              readFileSync  ,
              readdirSync   ,
              realpathSync  ,
              rmSync        ,
              symlinkSync   ,
              writeFileSync ,
                              } from "node:fs"            ;
import      { tmpdir          } from "node:os"            ;
import      { join, resolve   } from "node:path"          ;
import      { pathToFileURL   } from "node:url"           ;

const ROOT                 = resolve(import.meta.dir, "..")                                                                ;
const VERSION              = (JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { version: string }).version ;
const NPM_NAME             = (JSON.parse(readFileSync(join(ROOT, "product.json"), "utf8")) as { npmName: string }).npmName ;
const workspaces: string[] = []                                                                                            ;

let artifact : string ;
let node     : string ;
let npm      : string ;
let npx      : string ;
let npmCache : string ;

function temporary(): string {
	const path = mkdtempSync(join(tmpdir(), "boxbox dual host installer "));
	workspaces.push(path);
	return realpathSync(path);
}

function run(command: string, args: readonly string[], options: Parameters<typeof spawnSync>[2] = {}) {
	return spawnSync(command, args, { encoding: "utf8", timeout: 120_000, ...options });
}

function expectStatus(result: ReturnType<typeof run>, status: number): void {
	expect({ status: result.status, error: result.error?.message, output: `${result.stdout}\n${result.stderr}` }).toMatchObject({ status });
}

function extract(): string {
	const destination = join(temporary(), "other computer's copy");
	mkdirSync(destination);
	expectStatus(run("tar", ["-xzf", artifact, "-C", destination]), 0);
	return join(destination, "package");
}

function runtimeEnvironment(workspace: string): NodeJS.ProcessEnv {
	const bin        = join(workspace, "bin"        ) ;
	const codexHome  = join(workspace, "codex home" ) ;
	const claudeHome = join(workspace, "claude home") ;
	mkdirSync(bin);
	mkdirSync(codexHome);
	mkdirSync(claudeHome);
	symlinkSync(node, join(bin, "node"));
	symlinkSync(npm, join(bin, "npm"));
	return { ...process.env, PATH: `${bin}:/usr/bin:/bin`, XDG_CONFIG_HOME: join(workspace, "xdg config"), XDG_DATA_HOME: join(workspace, "permanent data"), CODEX_HOME: codexHome, CLAUDE_CONFIG_DIR: claudeHome, BOXBOX_TEST_LOG: join(workspace, "host calls.jsonl"), npm_config_offline: "true", CLAUDE_PLUGIN_DATA: "", CLAUDE_PLUGIN_ROOT: "", PLUGIN_ROOT: "", PLUGIN_DATA: "" };
}

function fakeHost(workspace: string, host: "codex" | "claude"): void {
	const executable = join(workspace, "bin", host);
	writeFileSync(executable, `#!/usr/bin/env node\nimport { appendFileSync } from "node:fs";\nconst host = ${JSON.stringify(host)};\nconst args = process.argv.slice(2);\nappendFileSync(process.env.BOXBOX_TEST_LOG, JSON.stringify({host,args,codexHome:process.env.CODEX_HOME,claudeHome:process.env.CLAUDE_CONFIG_DIR}) + "\\n");\nif (host === process.env.BOXBOX_TEST_FAIL_HOST && args[0] === "plugin" && ["add","install"].includes(args[1]) && args[2] !== "--help") process.exit(Number(process.env.BOXBOX_TEST_EXIT || 31));\n`);
	chmodSync(executable, 0o755);
}

function permanent(env: NodeJS.ProcessEnv, host: string): string {
	return join(env.XDG_DATA_HOME!, "boxbox", host, VERSION);
}

beforeAll(() => {
	const identity    = run("node"   , ["-p", "process.execPath"]) ;
	const npmLookup   = run("/bin/sh", ["-c", "command -v npm"]  ) ;
	const npxLookup   = run("/bin/sh", ["-c", "command -v npx"]  ) ;
	const cacheLookup = run("npm"    , ["config", "get", "cache"]) ;
	expectStatus(identity, 0);
	expectStatus(npmLookup, 0);
	expectStatus(npxLookup, 0);
	expectStatus(cacheLookup, 0);
	node     = realpathSync(String(identity.stdout).trim())  ;
	npm      = realpathSync(String(npmLookup.stdout).trim()) ;
	npx      = realpathSync(String(npxLookup.stdout).trim()) ;
	npmCache = String(cacheLookup.stdout).trim()             ;
	expectStatus(run("bun", ["development/tools/build-installer-artifact.ts"], { cwd: ROOT }), 0);
	artifact = join(ROOT, "dist/installer", `${NPM_NAME}-${VERSION}.tgz`);
}, 120_000);

afterAll(() => {
	for (const path of workspaces) rmSync(path, { recursive: true, force: true });
});

test("Windows native host discovery, permanent paths and PowerShell quotes support spaced and smart-quote paths", async () => {
	const platform    = await import(resolve(ROOT, "product/installer/platform.mjs"))                                                                                                                                   ;
	const executable  = "C:\\Program Files\\nodejs\\node.exe"                                                                                                                                                           ;
	const npmEntry    = "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js"                                                                                                                                 ;
	const codexEntry  = "C:\\Users\\A Person\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\bin\\codex.js"                                                                                                       ;
	const claudeEntry = "C:\\Users\\A Person\\AppData\\Roaming\\npm\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe"                                                                                         ;
	const options     = { windows: true, node: executable, path: "C:\\Users\\A Person\\AppData\\Roaming\\npm;C:\\Program Files\\nodejs", exists: (path: string) => [npmEntry, codexEntry, claudeEntry].includes(path) } ;
	expect(platform.findCommand("npm"   , options)).toEqual({ executable, args: [npmEntry] }     ) ;
	expect(platform.findCommand("codex" , options)).toEqual({ executable, args: [codexEntry] }   ) ;
	expect(platform.findCommand("claude", options)).toEqual({ executable: claudeEntry, args: [] }) ;
	expect(platform.findCommand("npm", { ...options, exists: (path: string) => path.endsWith("npm.cmd") })).toBeUndefined();
	for (const host of ["codex", "claude"]) {
		const path = `C:\\Users\\A Person\\AppData\\Roaming\\npm\\${host}.exe`;
		expect(platform.findCommand(host, { ...options, exists: (candidate: string) => candidate === path })).toEqual({ executable: path, args: [] });
		expect(platform.installationRoot(VERSION, host, { windows: true, environment: { LOCALAPPDATA: "C:\\Users\\A Person\\AppData\\Local" } })).toBe(`C:\\Users\\A Person\\AppData\\Local\\BoxBox\\${host === "codex" ? "Codex" : "Claude"}\\${VERSION}`);
	}
	expect(() => platform.installationRoot(VERSION, "codex", { windows: true, environment: {} })                            ).toThrow("LOCALAPPDATA"                                        ) ;
	expect(platform.installationRoot(VERSION, "claude", { windows: false, environment: {}, home: "/home/a person" })        ).toBe   (`/home/a person/.local/share/boxbox/claude/${VERSION}`) ;
	expect(() => platform.installationRoot(VERSION, "codex", { windows: false, environment: { XDG_DATA_HOME: "relative" } })).toThrow("absolute"                                            ) ;
	for (const version of ["22.22.3", "22.23.0", "24.0.0"]) expect(platform.supportedNode(version)).toBe(true);
	for (const version of ["20.22.3", "22.22.2", "22.21.9"]) expect(platform.supportedNode(version)).toBe(false);
	const command = platform.engineCommand(executable, "C:\\A Person's Files\\BoxBox\\plugin\\scripts\\boxbox.mjs", true)                                          ;
	const skill   = platform.configureSkill("```bash\n@BOXBOX_ENGINE_COMMAND@ doctor\n```\n```bash\n@BOXBOX_ENGINE_COMMAND@ check\n```", command, undefined, true) ;
	expect(skill.match(/```powershell/gu)?.length                     )    .toBe     (2                                                                                                     ) ;
	expect(skill                                                      )    .toContain("& 'C:\\Program Files\\nodejs\\node.exe' 'C:\\A Person''s Files\\BoxBox\\plugin\\scripts\\boxbox.mjs'") ;
	expect(skill                                                      ).not.toContain("@BOXBOX_ENGINE_COMMAND@"                                                                             ) ;
	expect(platform.powershellQuote("C:\\A‘B’C‚D‛E'F\\BoxBox")        )    .toBe     ("'C:\\A‘‘B’’C‚‚D‛‛E''F\\BoxBox'"                                                                      ) ;
	expect(platform.hookCommands(executable, "session").commandWindows)    .toBe     ("& 'C:\\Program Files\\nodejs\\node.exe' \"$env:PLUGIN_ROOT/scripts/boxbox.mjs\" hook session"        ) ;
	expect(platform.hookCommands(executable, "post", "claude")        )    .toEqual  ({ command: executable, args: ["${CLAUDE_PLUGIN_ROOT}/scripts/boxbox.mjs", "hook", "post"] }           ) ;
	const koreanProfile = "C:\\Users\\\uD64D\uAE38\uB3D9\\AppData\\Local";
	expect(platform.installationRoot(VERSION, "claude", { windows: true, environment: { LOCALAPPDATA: koreanProfile } })).toBe(`${koreanProfile}\\BoxBox\\Claude\\${VERSION}`);
	const literal = "$& | $` | $' | $$";
	expect(platform.configureSkill("before @BOXBOX_ENGINE_COMMAND@ after", literal, undefined, false)).toBe(`before ${literal} after`);
	for (const windows of [false, true]) {
		const path   = "C:\\$&\\$`\\$'\\$$\\\uD64D\uAE38\uB3D9\\boxbox.mjs" ;
		const prefix = platform.engineCommand(executable, path, windows)    ;
		expect(platform.configureSkill("@BOXBOX_ENGINE_COMMAND@ check", prefix, undefined, windows)).toBe(`${prefix} check`);
	}
	const claudePath = "C:\\A Person's ‘Files’ $& $` $' $$\\\uD64D\uAE38\uB3D9\\boxbox.mjs" ;
	const bridge     = platform.engineCommand(executable, claudePath, true, "claude")       ;
	const encoded    = bridge.match(/Buffer\.from\('([A-Za-z0-9+/=]+)','base64'\)/u)![1]    ;
	expect(JSON.parse(Buffer.from(encoded!, "base64").toString("utf8")))    .toEqual    ([executable, claudePath]) ;
	expect(bridge                                                      )    .toStartWith('node -e "'             ) ;
	expect(bridge                                                      )    .toEndWith  ('" --'                  ) ;
	expect(bridge                                                      ).not.toContain  ("eval("                 ) ;
});

test("Windows Claude Node bridge runs from Bash with literal paths, spaced arguments and child exit status", async () => {
	const platform  = await import(resolve(ROOT, "product/installer/platform.mjs"))   ;
	const workspace = temporary()                                                     ;
	const directory = join(workspace, "profile '‘’‚‛ $& $` $' $$ \uD64D\uAE38\uB3D9") ;
	mkdirSync(directory);
	const launcher = join(directory, "launcher.mjs");
	writeFileSync(launcher, 'console.log(JSON.stringify(process.argv.slice(2))); process.exit(Number(process.env.BOXBOX_TEST_EXIT || 0));\n');
	const command = platform.engineCommand(node, launcher, true, "claude")                                      ;
	const result  = run("/bin/bash", ["-c", `${command} doctor --file 'a file.ts' --json`], { cwd: workspace }) ;
	expectStatus(result, 0);
	expect(JSON.parse(String(result.stdout))).toEqual(["doctor", "--file", "a file.ts", "--json"]);
	expectStatus(run("/bin/bash", ["-c", `${command} check`], { env: { ...process.env, BOXBOX_TEST_EXIT: "42" } }), 42);
	const missing = platform.engineCommand(join(workspace, "missing node"), launcher, true, "claude");
	expectStatus(run("/bin/bash", ["-c", `${missing} doctor`]), 1);
});

test("npm installer name differs from private engine and both host payloads have an exact allowlist", () => {
	const packageRoot = extract()                                                           ;
	const payload     = join(packageRoot, "payload")                                        ;
	const manifest    = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) ;
	expect(manifest).toMatchObject({ name: NPM_NAME, version: VERSION, license: "UNLICENSED", bin: { boxbox: "bin/boxbox.mjs" }, engines: { node: ">=22.22.3" } });
	expect(manifest.private).toBeUndefined();
	expect(manifest.dependencies).toBeUndefined();
	expect(JSON.parse(readFileSync(join(payload, "bundle.json"), "utf8"))).toMatchObject({ name: "boxbox", npmName: NPM_NAME });
	const expected = ["README.md", "bin/boxbox.mjs", "package.json", "payload/bundle.json", "payload/platform.mjs"];
	for (const host of ["codex", "claude"]) {
		const root            = join(payload, host)                                                                                                                                                                                                                                                                                                                                                                                                                                                                           ;
		const plugin          = join(root, "plugin")                                                                                                                                                                                                                                                                                                                                                                                                                                                                          ;
		const marketplacePath = host === "codex" ? ".agents/plugins/marketplace.json" : ".claude-plugin/marketplace.json"                                                                                                                                                                                                                                                                                                                                                                                                     ;
		const hostFiles       = [marketplacePath, "bundle.json", "install.mjs", `packages/boxbox-${VERSION}.tgz`, "platform.mjs", `plugin/.${host === "codex" ? "codex" : "claude"}-plugin/plugin.json`, "plugin/hooks/hooks.json", "plugin/scripts/boxbox.mjs", "plugin/skills/boxbox/SKILL.md", ...["charter.md", "grammar.md", "readability-contract.md", "typescript-grid-template.md"].map(name => `plugin/skills/boxbox/references/${name}`), ...(host === "claude" ? ["plugin/agents/readability-inspector.md"] : [])] ;
		expected.push(...hostFiles.map(path => `payload/${host}/${path}`));
		expect(readdirSync(plugin).sort()).toEqual((host === "codex" ? [".codex-plugin", "hooks", "scripts", "skills"] : [".claude-plugin", "agents", "hooks", "scripts", "skills"]).sort());
		expect(readFileSync(join(root, "packages", `boxbox-${VERSION}.tgz`)).equals(readFileSync(join(ROOT, "dist", `boxbox-${VERSION}.tgz`)))).toBe(true);
		for (const reference of readdirSync(join(ROOT, "plugin/skills/boxbox/references"))) expect(readFileSync(join(plugin, "skills/boxbox/references", reference)).equals(readFileSync(join(ROOT, "plugin/skills/boxbox/references", reference)))).toBe(true);
		const source = JSON.parse(readFileSync(join(root, marketplacePath), "utf8")).plugins[0].source;
		expect(source).toEqual(host === "codex" ? { source: "local", path: "./plugin" } : "./plugin");
	}
	const packed = JSON.parse(readFileSync(join(ROOT, "dist/installer/pack-result.json"), "utf8"));
	expect(packed[0].files.map((file: { path: string }) => file.path).sort()).toEqual(expected.sort());
	for (const file of packed[0].files as { path: string }[]) {
		if (!file.path.endsWith(".tgz")) expect(readFileSync(join(packageRoot, file.path), "utf8")).not.toContain(ROOT);
	}
	const nested = join(temporary(), "nested engine");
	mkdirSync(nested);
	const engine = join(payload, "codex/packages", `boxbox-${VERSION}.tgz`);
	expectStatus(run("tar", ["-xzf", engine, "-C", nested]), 0);
	const listing = run("tar", ["-tzf", engine]);
	expectStatus(listing, 0);
	for (const path of String(listing.stdout).trim().split("\n").filter(path => !path.endsWith("/"))) expect(readFileSync(join(nested, path), "utf8")).not.toContain(ROOT);
	expect(JSON.parse(readFileSync(join(nested, "package/package.json"), "utf8"))).toMatchObject({ name: "boxbox", private: true });
});

test("real npx infers the boxbox bin from the public installer and installs both hosts independently of cache and origin", () => {
	const workspace              = temporary()                                 ;
	const environment            = runtimeEnvironment(workspace)               ;
	const cache                  = join(workspace, "isolated npm cache")       ;
	const staging                = join(workspace, "installer staging")        ;
	const project                = join(workspace, "target project")           ;
	const env: NodeJS.ProcessEnv = { ...environment, npm_config_cache: cache } ;
	mkdirSync(staging);
	mkdirSync(project);
	cpSync(join(npmCache, "_cacache"), join(cache, "_cacache"), { recursive: true });
	const staged = join(staging, `${NPM_NAME}-${VERSION}.tgz`);
	cpSync(artifact, staged);
	fakeHost(workspace, "codex");
	fakeHost(workspace, "claude");
	const configurationPath = join(env.CODEX_HOME!       , "config.toml"  ) ;
	const settingsPath      = join(env.CLAUDE_CONFIG_DIR!, "settings.json") ;
	writeFileSync(configurationPath, '# Existing setting\nmodel = "preserved"\n');
	writeFileSync(settingsPath, '{"existing":true}\n');
	expect(run("/bin/sh", ["-c", "command -v bun"], { env }).status).not.toBe(0);
	// The file: package spec avoids npm treating a bare absolute filename as an existing command.
	expectStatus(run(npx, ["--yes", `file:${staged}`], { cwd: project, env }), 0);
	const calls = readFileSync(env.BOXBOX_TEST_LOG!, "utf8").trim().split("\n").map(line => JSON.parse(line));
	expect(calls.map(call => [call.host, call.args])).toEqual([
		["codex", ["--version"]], ["codex", ["plugin", "add", "--help"]], ["codex", ["plugin", "marketplace", "add", permanent(env, "codex") + "/"]], ["codex", ["plugin", "add", "boxbox@boxbox-plugins"]],
		["claude", ["--version"]], ["claude", ["plugin", "install", "--help"]], ["claude", ["plugin", "marketplace", "add", permanent(env, "claude") + "/"]], ["claude", ["plugin", "install", "boxbox@boxbox-plugins", "--scope", "user"]],
	]);
	expect(calls.every(call => call.codexHome === env.CODEX_HOME && call.claudeHome === env.CLAUDE_CONFIG_DIR)).toBe(true                                       ) ;
	expect(readFileSync(configurationPath, "utf8")                                                            ).toBe('# Existing setting\nmodel = "preserved"\n') ;
	expect(readFileSync(settingsPath, "utf8")                                                                 ).toBe('{"existing":true}\n'                      ) ;
	rmSync(cache, { recursive: true, force: true });
	rmSync(staging, { recursive: true, force: true });
	for (const host of ["codex", "claude"]) {
		const root          = permanent(env, host)                                           ;
		const plugin        = join(root, "plugin")                                           ;
		const launcher      = join(plugin, "scripts/boxbox.mjs")                             ;
		const configuration = JSON.parse(readFileSync(join(plugin, "runtime.json"), "utf8")) ;
		expect(configuration.node).toBe(node);
		expect(configuration.cli).toStartWith(root);
		const documents = ["skills/boxbox/SKILL.md", ...(host === "claude" ? ["agents/readability-inspector.md"] : [])];
		for (const document of documents) {
			const text = readFileSync(join(plugin, document), "utf8");
			expect(text).toContain(configuration.skillCommand);
			for (const forbidden of ["@BOXBOX_ENGINE_COMMAND@", "<PLUGIN_ROOT>", "standard shim requires", cache, staging]) expect(text).not.toContain(forbidden);
		}
		if (host === "claude") expect(readFileSync(join(plugin, "agents/readability-inspector.md"), "utf8")).toContain("disallowedTools: Write, Edit, NotebookEdit, Agent, ExitPlanMode");
		const targetProject = join(project  , host                 ) ;
		const data          = join(workspace, `${host} plugin data`) ;
		mkdirSync(targetProject);
		mkdirSync(data);
		const doctor = run("/bin/sh", ["-c", `${configuration.skillCommand} doctor --json`], { cwd: targetProject, env });
		expectStatus(doctor, 0);
		expect(JSON.parse(String(doctor.stdout))).toMatchObject({ command: "doctor", ok: true, runtimeUsable: true, releaseReady: false });
		const hooks = JSON.parse(readFileSync(join(plugin, "hooks/hooks.json"), "utf8"));
		const hook = (event: string) => {
			const spec    = hooks.hooks[event][0].hooks[0]                                                                                                                                                                                                                                    ;
			const options = { cwd: targetProject, input: JSON.stringify({ session_id: host, cwd: targetProject, tool_name: "apply_patch" }), env: { ...env, ...(host === "codex" ? { PLUGIN_ROOT: plugin, PLUGIN_DATA: data } : { CLAUDE_PLUGIN_ROOT: plugin, CLAUDE_PLUGIN_DATA: data }) } } ;
			return host === "claude" ? run(spec.command, spec.args.map((arg: string) => arg.replaceAll("${CLAUDE_PLUGIN_ROOT}", plugin)), options) : run("/bin/sh", ["-c", spec.command], options);
		};
		if (host === "claude") {
			expect(hooks.hooks.SessionStart[0].hooks[0].command).toBe(node);
			expect(hooks.hooks.SessionStart[0].hooks[0].commandWindows).toBeUndefined();
		}
		expectStatus(hook("SessionStart"), 0);
		const target  = join(targetProject, "sample.ts")                                         ;
		const content = "const a = make(1);\nconst longer = make(22);\nconst mid = make(333);\n" ;
		writeFileSync(target, content);
		const check = run(node, [launcher, "check", "--file", "sample.ts", "--json"], { cwd: targetProject, env });
		expectStatus(check, 1);
		expect(JSON.parse(String(check.stdout)).results[0].summary.misaligned).toBeGreaterThan(0);
		const refused = run(node, [launcher, "format", "--file", "sample.ts", "--json"], { cwd: targetProject, env });
		expectStatus(refused, 2);
		expect(JSON.parse(String(refused.stdout)).error.code          ).toBe("FORMAT_NOT_ELIGIBLE") ;
		expect(JSON.parse(String(hook("PostToolUse").stdout)).decision).toBe("block"              ) ;
		expect(JSON.parse(String(hook("Stop").stdout)).decision       ).toBe("block"              ) ;
		expect(JSON.parse(String(hook("Stop").stdout)).decision).toBeUndefined();
		expect(readFileSync(target, "utf8")   ).toBe   (content      ) ;
		expect(readdirSync(targetProject)     ).toEqual(["sample.ts"]) ;
		expect(existsSync(join(data, "hooks"))).toBe   (true         ) ;
		const noData = run(node, [launcher, "hook", "session"], { cwd: targetProject, env, input: JSON.stringify({ session_id: "no-data", cwd: targetProject }) });
		expectStatus(noData, 1);
		expect(String(noData.stderr)).toContain("PLUGIN_DATA");
	}
	const codex = permanent(env, "codex");
	writeFileSync(join(codex, "preserved.txt"), "user data\n");
	const paths  = ["plugin/skills/boxbox/SKILL.md", "plugin/hooks/hooks.json", "plugin/runtime.json", "preserved.txt"] ;
	const before = paths.map(path => readFileSync(join(codex, path)))                                                   ;
	cpSync(join(npmCache, "_cacache"), join(cache, "_cacache"), { recursive: true });
	expectStatus(run(npm, ["exec", "--offline", "--yes", "--package", artifact, "--", "boxbox", "--codex"], { cwd: project, env: { ...env, BOXBOX_TEST_FAIL_HOST: "codex", BOXBOX_TEST_EXIT: "31" } }), 31);
	for (const [index, path] of paths.entries()) expect(readFileSync(join(codex, path)).equals(before[index]!)).toBe(true);
	expectStatus(run(npm, ["exec", "--offline", "--yes", "--package", artifact, "--", "boxbox", "--codex"], { cwd: project, env }), 0);
	expect(readFileSync(join(codex, "preserved.txt"), "utf8")).toBe("user data\n");
}, 300_000);

test("explicit host flags install only selected adapters and engine-only does not register any host", () => {
	const packageRoot = extract();
	for (const host of ["codex", "claude"]) {
		const workspace = temporary()                   ;
		const env       = runtimeEnvironment(workspace) ;
		fakeHost(workspace, "codex");
		fakeHost(workspace, "claude");
		const targeted = host === "claude" ? { ...env, CODEX_HOME: join(workspace, "absent codex home") } : env;
		expectStatus(run(node, [join(packageRoot, "bin/boxbox.mjs"), `--${host}`], { env: targeted }), 0);
		expect(existsSync(join(permanent(env, host), "plugin/runtime.json"))).toBe(true);
		expect(existsSync(permanent(env, host === "codex" ? "claude" : "codex"))).toBe(false);
		const calls = readFileSync(env.BOXBOX_TEST_LOG!, "utf8").trim().split("\n").map(line => JSON.parse(line));
		expect(calls.every(call => call.host === host)).toBe(true);
	}
	const workspace = temporary()                   ;
	const env       = runtimeEnvironment(workspace) ;
	expectStatus(run(node, [join(packageRoot, "bin/boxbox.mjs"), "--engine-only"], { env }), 0);
	expect(existsSync(join(permanent(env, "codex"), "plugin/runtime.json"))).toBe(true ) ;
	expect(existsSync(permanent(env, "claude"))                            ).toBe(false) ;
	expect(existsSync(env.BOXBOX_TEST_LOG!)                                ).toBe(false) ;
}, 180_000);

test("repair filesystem failures retain a recovery backup and report its path", () => {
	for (const fault of ["remove", "restore", "backup", "backup-cleanup", "cleanup"]) {
		const packageRoot = extract()                       ;
		const workspace   = temporary()                     ;
		const environment = runtimeEnvironment(workspace)   ;
		const destination = permanent(environment, "codex") ;
		mkdirSync(destination, { recursive: true });
		writeFileSync(join(destination, "preserved.txt"), "previous installation\n");
		const npmCommand = join(workspace, "bin/npm");
		rmSync(npmCommand);
		writeFileSync(npmCommand, "#!/bin/sh\nexit 19\n");
		chmodSync(npmCommand, 0o755);
		const shim = join(workspace, "fault-fs.mjs");
		writeFileSync(shim, `import * as fs from 'node:fs';\nexport * from 'node:fs';\nconst fault=process.env.BOXBOX_TEST_FS_FAULT;\nconst destination=process.env.BOXBOX_TEST_DESTINATION;\nexport function cpSync(source,target,options){\n if(source===destination && String(target).includes('.boxbox-repair-') && ['backup','backup-cleanup'].includes(fault)){fs.mkdirSync(target,{recursive:true});fs.writeFileSync(target+'/partial.txt','partial');throw new Error('simulated backup copy failure')}\n if(String(source).endsWith('/previous') && target===destination && fault==='restore')throw new Error('simulated restore copy failure');\n return fs.cpSync(source,target,options);\n}\nexport function rmSync(target,options){\n if(target===destination && fault==='remove')throw new Error('simulated locked installation');\n if(String(target).includes('.boxbox-repair-') && ['backup-cleanup','cleanup'].includes(fault))throw new Error('simulated locked backup');\n return fs.rmSync(target,options);\n}\n`);
		const entry = join(packageRoot, "bin/boxbox.mjs");
		writeFileSync(entry, readFileSync(entry, "utf8").replaceAll('"node:fs"', JSON.stringify(pathToFileURL(shim).href)));
		const result = run(node, [entry, "--engine-only"], { env: { ...environment, BOXBOX_TEST_FS_FAULT: fault, BOXBOX_TEST_DESTINATION: destination } });
		expectStatus(result, fault === "cleanup" ? 19 : 1);
		const parent  = join(environment.XDG_DATA_HOME!, "boxbox/codex")                       ;
		const backups = readdirSync(parent).filter(name => name.startsWith(".boxbox-repair-")) ;
		if (fault === "backup") {
			expect(backups).toEqual([]);
			expect(readFileSync(join(destination, "preserved.txt"), "utf8")).toBe("previous installation\n");
		} else {
			expect(backups.length).toBe(1);
			const backup = join(parent, backups[0]!);
			expect(String(result.stderr)).toContain(backup);
			if (fault !== "backup-cleanup") expect(readFileSync(join(backup, "previous/preserved.txt"), "utf8")).toBe("previous installation\n");
			else expect(existsSync(join(backup, "previous/partial.txt"))).toBe(true);
		}
	}
});

test("help, invalid flags, missing hosts and invalid Codex home refuse without installing; child status propagates", () => {
	const packageRoot = extract()                             ;
	const workspace   = temporary()                           ;
	const env         = runtimeEnvironment(workspace)         ;
	const entry       = join(packageRoot, "bin/boxbox.mjs")   ;
	const help        = run(node, [entry, "--help"], { env }) ;
	expectStatus(help, 0);
	expect(String(help.stdout)).toContain("Usage: boxbox");
	expect(existsSync(env.XDG_DATA_HOME!)).toBe(false);
	for (const flags of [["--unknown"], ["--engine-only", "--codex"]]) expectStatus(run(node, [entry, ...flags], { env }), 1);
	const missingHosts = run(node, [entry], { env });
	expectStatus(missingHosts, 1);
	expect(String(missingHosts.stderr)).toContain("Neither Codex nor Claude Code");
	for (const host of ["codex", "claude"]) {
		const missing = run(node, [entry, `--${host}`], { env });
		expectStatus(missing, 1);
		expect(String(missing.stderr)).toContain("was not found on PATH");
	}
	expect(existsSync(env.XDG_DATA_HOME!)).toBe(false);
	fakeHost(workspace, "codex");
	const missingHome = run(node, [entry, "--codex"], { env: { ...env, CODEX_HOME: join(workspace, "missing home") } });
	expectStatus(missingHome, 1);
	expect(String(missingHome.stderr)).toContain("CODEX_HOME must point to an existing directory");
	expect(existsSync(env.XDG_DATA_HOME!)).toBe(false);
	const beforeInstall = run(node, [join(packageRoot, "payload/codex/plugin/scripts/boxbox.mjs"), "doctor"], { env });
	expectStatus(beforeInstall, 1);
	expect(String(beforeInstall.stderr)).toContain("Local runtime is missing");
	const npmCommand = join(workspace, "bin/npm");
	rmSync(npmCommand);
	writeFileSync(npmCommand, "#!/bin/sh\nexit 19\n");
	chmodSync(npmCommand, 0o755);
	expectStatus(run(node, [entry, "--engine-only"], { env }), 19);
	expect(existsSync(permanent(env, "codex"))).toBe(false);
});
