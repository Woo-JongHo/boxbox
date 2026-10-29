import      { spawnSync                                                        } from "node:child_process"        ;
import      { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs"                   ;
import      { join, resolve                                                    } from "node:path"                 ;
import      { fileURLToPath                                                    } from "node:url"                  ;
import      {
              configureSkill                                                 ,
              engineCommand                                                  ,
              findCommand                                                    ,
              hookCommands                                                   ,
              pathLaunchers                                                  ,
              supportedNode                                                  ,
                                                                               } from "./platform.mjs"            ;

import      { installationState                                                } from "./install-state.mjs"       ;
import      { claudeRegistration                                               } from "./claude-registration.mjs" ;

const root       = fileURLToPath(new URL("./", import.meta.url))                    ;
const windows    = process.platform === "win32"                                     ;
const engineOnly = process.argv.length === 3 && process.argv[2] === "--engine-only" ;

function fail(message) {
	console.error(`[BoxBox] ${message}`);
	process.exit(1);
}

function run(executable, args, options = {}) {
	const child = spawnSync(executable, args, { stdio: "inherit", ...options });
	if (child.error) fail(`Cannot run ${executable}: ${child.error.message}`);
	if (child.signal) fail(`${executable} terminated by ${child.signal}`);
	if (child.status !== 0) process.exit(child.status ?? 1);
	return child;
}

function command(name) {
	const resolved = findCommand(name);
	if (resolved) return resolved;
	fail(`${name} was not found on PATH. Install ${name === "npm" ? "Node.js with npm" : "the selected host CLI with plugin support"}, open a new terminal, then rerun the BoxBox installer.${windows ? " Use the standard npm installation or a native host .exe." : ""}`);
}

function invoke(tool, args, options) {
	return run(tool.executable, [...tool.args, ...args], options);
}

if (process.argv.length > 2 && !engineOnly) fail("Usage: node install.mjs [--engine-only]");
if (!supportedNode(process.versions.node)) fail(`Node.js >=22.22.3 is required; found ${process.versions.node}. Install a supported Node.js release and rerun the BoxBox installer.`);

const metadata = JSON.parse(readFileSync(join(root, "bundle.json"), "utf8"));
if (!["codex", "claude"].includes(metadata.host)) fail("The installed payload has an invalid host. Rerun the BoxBox installer.");
const state = installationState(root, metadata);
if (state.read()?.phase !== "prepared") fail("A fresh parent installation receipt is required. Rerun the BoxBox installer.");
const npm = command("npm");
invoke(npm, ["--version"]);
const host = engineOnly ? undefined : command(metadata.host);
if (host) {
	invoke(host, ["--version"]);
	invoke(host, ["plugin", metadata.host === "codex" ? "add" : "install", "--help"]);
}

const claude = host && metadata.host === "claude" ? claudeRegistration(root, metadata, (args, options) => invoke(host, args, options)) : undefined;
claude?.preflight();

const tarball = join(root, "packages", `${metadata.name}-${metadata.version}.tgz`);
if (!existsSync(tarball)) fail(`Bundled engine is missing: ${tarball}. Rerun the BoxBox installer to repair the local payload.`);
const runtimeDirectory = join(root, "runtime");
mkdirSync(runtimeDirectory, { recursive: true });
writeFileSync(join(runtimeDirectory, "package.json"), JSON.stringify({ private: true, type: "module", name: `boxbox-${metadata.host}-runtime` }, null, "\t") + "\n");
invoke(npm, ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--save-exact", tarball], { cwd: runtimeDirectory });

const node = realpathSync(process.execPath                                              ) ;
const cli  = resolve     (runtimeDirectory, "node_modules", metadata.name, "dist/cli.js") ;
if (!existsSync(cli)) fail("The local engine did not install correctly. Keep the npm error output and rerun the BoxBox installer.");
const version = run(node, [cli, "--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).stdout.trim();
if (version !== metadata.version) fail(`Installed engine version mismatch: ${version}`);

const plugin        = join(root, "plugin")                                                                                                                          ;
const launcher      = join(plugin, "scripts/boxbox.mjs")                                                                                                            ;
const configuration = join(plugin, "runtime.json")                                                                                                                  ;
const previous      = existsSync(configuration) ? JSON.parse(readFileSync(configuration, "utf8")) : {}                                                              ;
const skillCommand  = engineCommand(node, launcher, windows, metadata.host)                                                                                         ;
const documents     = [join(plugin, "skills", metadata.name, "SKILL.md"), ...(metadata.host === "claude" ? [join(plugin, "agents/readability-inspector.md")] : [])] ;
for (const path of documents) {
	try {
		writeFileSync(path, configureSkill(readFileSync(path, "utf8"), skillCommand, previous.skillCommand, windows));
	} catch (error) {
		fail(error.message);
	}
}
writeFileSync(configuration, JSON.stringify({ node, cli, skillCommand }, null, "\t") + "\n");
mkdirSync(join(plugin, "bin"), { recursive: true });
for (const [path, text] of Object.entries(pathLaunchers(node, launcher))) writeFileSync(join(plugin, path), text, { mode: 0o755 });

const hooksPath = join      (plugin, "hooks/hooks.json"     ) ;
const hooks     = JSON.parse(readFileSync(hooksPath, "utf8")) ;
for (const [event, mode] of [["SessionStart", "session"], ["PostToolUse", "post"], ["Stop", "stop"]]) {
	for (const group of hooks.hooks[event]) {
		for (const hook of group.hooks) {
			delete hook.commandWindows;
			delete hook.args;
			Object.assign(hook, hookCommands(node, mode, metadata.host));
		}
	}
}
writeFileSync(hooksPath, JSON.stringify(hooks, null, "\t") + "\n");

if (host) {
	state.advance("host-registration-started");
	invoke(host, ["plugin", "marketplace", "add", root]);
	claude?.marketplace();
	invoke(host, metadata.host === "codex" ? ["plugin", "add", `${metadata.name}@${metadata.marketplace}`] : ["plugin", "install", `${metadata.name}@${metadata.marketplace}`, "--scope", "user"]);
}
claude?.verify();
state.advance("verified");
console.log(engineOnly ? "BoxBox local engine is ready; host checks and registration were skipped." : `BoxBox is installed for ${metadata.host === "codex" ? "Codex" : "Claude Code"}. Restart that host and select the BoxBox skill. Review the current hooks manually before relying on them.`);
console.log(`Permanent installation: ${root}`);
console.log("Approved TypeScript call declarations and Python simple assignments can format without an external formatter. Run check and guide, then format --dry-run before an explicit format request; other patterns require approval.");
