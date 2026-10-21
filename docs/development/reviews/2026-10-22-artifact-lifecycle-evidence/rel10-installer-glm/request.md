# Final read-only static audit: REL10 installer phase and Claude registration safety

Return one concise review of at most 1200 words ending exactly with `VERDICT: PASS` or `VERDICT: FIX_REQUIRED`.

Audit only the frozen installer source, artifact builder, focused tests, README and historical failure contract below. Do not execute/request tools, edit files, grant release approval, or claim native host acceptance. The actual macOS/Windows/Linux new-candidate cells are pending; the historical diagnosis proves the old failure only.

## Mandatory audit questions

1. Partial-state cleanup boundary: can parent restore/delete only when a valid same-install receipt proves failure before host mutation? Are signals, malformed/foreign state, post-mutation failures, zero-without-verified, retries and backups conservative?
2. Pre-copy shared guard: does entry validate an existing Claude catalog before backup/copy so same-version overlay cannot erase evidence? Are symlink, malformed, shared and foreign catalogs refused without mutation?
3. Foreign/phase protection: do exact marketplace/plugin identity, scope, root, manifest/runtime/version and schema checks prevent takeover or deletion of unrelated user state? Does child mutate only after capability/ownership preflight and phase transition?
4. Scoped update identity: is one exact user-scope Claude update issued only when stale, followed by complete identity verification? Are zero-exit stale/mismatched results failures?
5. Meaningful failures and preservation: are recovery paths and partial-state semantics honest, with no false host rollback or native acceptance claim? Are user bytes and retained material protected?
6. Pack allowlist: are every required helper and only intended installer payload files copied to the correct root/host payload locations? Can source work while the built artifact omits a dependency?
7. Tests: do dangerous negative paths prove bytes/host command logs/registrations/backups are unchanged or retained, without relying only on messages? Flag a missing executable regression only when it permits a concrete safety defect.

For each mandatory finding give severity, exact file/function or line, concrete execution trace, violated invariant and smallest correction. Separate optional observations. Avoid broad refactors, feature requests, approval changes and product-runtime changes.

## Frozen evidence and honest limits

All eight manifest hashes were independently rechecked before this request. Local focused/artifact evidence reports 13 pass, 0 fail, 310 assertions, plus syntax/type/layout checks. Prior reviews found M1-M4 and signal retention and recorded them closed. Treat this as supplied evidence, not authority. The last README-only wording change was after the recorded artifact build; executable/test bytes were unchanged, and a fresh candidate/native acceptance is still required.

Actual diagnosis/probe summary: Claude 2.1.286 returned zero after marketplace retarget + plugin install while the recorded plugin version/cache remained 0.2.3; WSL Claude 2.1.280 reproduced the old behavior. An explicitly scoped update repaired an isolated probe. This establishes the defect and repair direction, not new-candidate native acceptance, model/session loading, hooks, authentication, HUD or publication readiness.

## Frozen SHA-256
- `product/installer/install-state.mjs`: `2c127c6bc639f315dd485da08b3f293b7b086185dd376addc52b6707b69c72e7`
- `product/installer/claude-registration.mjs`: `b5bfdc71e0a451b3aed503537af5519db99cbc12a52eee182df44416c6f9b680`
- `product/installer/install.mjs`: `ed1aaef067811388c65ea504b28a5baa7790de5d456386b9bf6717359f967fa4`
- `product/installer/entry.mjs`: `b55dd99b50fbc103ee56f1d1f75014bac470346ddf4757852bd96c0307caa141`
- `product/installer/README.md`: `bf1c74dff0b9504b6c3bcaeaf31e508e6ec11b9a69995799e672af5fb60ffd93`
- `development/tools/build-installer-artifact.ts`: `e5ced9e6b958e38d489fe5582930fad3d8f74ff8d2d079667128628e9aee98f9`
- `test/installer-registration.test.ts`: `544b1d9581cc81b6eef19f2d1bfae817fc4859f4e9b8946aaeff327f9fd6e488`
- `test/installer-artifact.test.ts`: `13489356b5b7ef0deeba6e5077f1f1a1dcd4e74888542008f65564c01c22ad8e`

## Complete audited material

### `product/installer/entry.mjs`

```javascript
#!/usr/bin/env node
import      { spawnSync                                    } from "node:child_process"                 ;
import      {
              cpSync                                     ,
              existsSync                                 ,
              mkdirSync                                  ,
              mkdtempSync                                ,
              readFileSync                               ,
              rmSync                                     ,
              statSync                                   ,
                                                           } from "node:fs"                            ;
import      { dirname, join                                } from "node:path"                          ;
import      { fileURLToPath                                } from "node:url"                           ;
import      { findCommand, installationRoot, supportedNode } from "../payload/platform.mjs"            ;

import      { installationState                            } from "../payload/install-state.mjs"       ;

import      { assertClaudeCatalog                          } from "../payload/claude-registration.mjs" ;

/** Restore only failures proven to precede host mutation; retain uncertain state for recovery. */
function installHost(payload, destination, engineOnly) {
	mkdirSync(dirname(destination), { recursive: true });
	const metadata      = JSON.parse(readFileSync(join(payload, "bundle.json"), "utf8"))                 ;
	const previousState = existsSync(destination) ? installationState(destination, metadata) : undefined ;
	const retained      = previousState?.read()                                                          ;
	if (metadata.host === "claude" && existsSync(destination)) assertClaudeCatalog(destination, metadata, true);
	const backup        = existsSync(destination) ? mkdtempSync(join(dirname(destination), ".boxbox-repair-")) : undefined ;
	if (backup) {
		try {
			cpSync(destination, join(backup, "previous"), { recursive: true });
		} catch (error) {
			try {
				rmSync(backup, { recursive: true, force: true });
			} catch (cleanupError) {
				throw new Error(`Backup preparation failed; partial backup retained at ${backup}: ${error.message}. Cleanup failed: ${cleanupError.message}`);
			}
			throw error;
		}
	}
	let succeeded = false ;
	let launched  = false ;
	let state;
	let exitStatus;
	let signaled = false;
	try {
		mkdirSync(destination, { recursive: true });
		if (retained) previousState.remove();
		cpSync(payload, destination, { recursive: true });
		state = installationState(destination, metadata);
		state.create();
		launched = true;
		const child = spawnSync(process.execPath, [join(destination, "install.mjs"), ...(engineOnly ? ["--engine-only"] : [])], { stdio: "inherit" });
		exitStatus = child.status;
		signaled = Boolean(child.signal);
		if (child.error) throw child.error;
		if (child.signal) throw new Error(`Installer terminated by ${child.signal}`);
		succeeded = child.status === 0 && state.read()?.phase === "verified";
		if (child.status === 0 && !succeeded) throw new Error("Installer exited without verified completion.");
		return child.status ?? 1;
	} finally {
		let prepared = !launched;
		if (launched && !succeeded) {
			try { prepared = !signaled && exitStatus !== 0 && state.read()?.phase === "prepared"; } catch { prepared = false; }
		}
		if (!succeeded && !prepared) {
			console.error(`[BoxBox] Installation may have changed host registration. Retained installation: ${destination}. Receipt: ${state?.path}.${backup ? ` Previous backup retained at ${backup}.` : ""} Inspect host plugin/marketplace lists, then rerun this exact installer or remove the exact registration before manual recovery.`);
		} else {
			if (!succeeded) {
				try {
					rmSync(destination, { recursive: true, force: true });
					if (backup) cpSync(join(backup, "previous"), destination, { recursive: true });
				} catch (error) {
					throw new Error(backup ? `Repair could not restore the previous installation. Backup retained at ${backup}: ${error.message}` : `Failed installation cleanup was incomplete at ${destination}: ${error.message}`);
				}
			}
			if (succeeded) state.remove();
			if (backup) {
				try {
					rmSync(backup, { recursive: true, force: true });
				} catch (error) {
					console.error(`[BoxBox] Previous backup could not be removed; retained at ${backup}: ${error.message}`);
				}
			}
		}
	}
}

const arguments_ = process.argv.slice(2)                                                 ;
const usage      = "Usage: boxbox [--codex] [--claude] [--hud] | --engine-only | --help" ;
if (arguments_.length === 1 && arguments_[0] === "--help") {
	console.log(`${usage}\n\nInstall BoxBox plugins for detected Codex and Claude Code CLIs.\nUse --codex or --claude to select hosts explicitly; both flags select both.\n--engine-only prepares the Codex local engine without host checks or registration.\n--hud opts into a Claude status line and a separate boxbox-codex tmux launcher on macOS/Linux.\nRestart each host afterward and review its hooks manually.`);
	process.exit(0);
}
const engineOnly = arguments_.length === 1 && arguments_[0] === "--engine-only";
if (!engineOnly && arguments_.some(value => !["--codex", "--claude", "--hud"].includes(value))) {
	console.error(`[BoxBox] ${usage}`);
	process.exit(1);
}

try {
	if (!supportedNode(process.versions.node)) throw new Error(`Node.js >=22.22.3 is required; found ${process.versions.node}. Install a supported Node.js release and rerun the installer.`);
	const hud = arguments_.includes("--hud");
	if (hud && process.platform === "win32") throw new Error("The terminal HUD requires macOS/Linux. Install the Windows plugins without --hud.");
	const requested = [...new Set(arguments_.filter(value => value !== "--hud").map(value => value.slice(2)))]                      ;
	const hosts     = engineOnly ? ["codex"] : requested.length ? requested : ["codex", "claude"].filter(host => findCommand(host)) ;
	if (hosts.length === 0) throw new Error("Neither Codex nor Claude Code was found on PATH. Install at least one CLI with plugin support, open a new terminal, then rerun the BoxBox installer.");
	if (!engineOnly) {
		for (const host of hosts) {
			if (!findCommand(host)) throw new Error(`${host === "codex" ? "Codex" : "Claude Code"} was not found on PATH. Install that CLI or select another installed host with --codex or --claude.`);
		}
	}
	if (!engineOnly && hosts.includes("codex") && process.env.CODEX_HOME && (!existsSync(process.env.CODEX_HOME) || !statSync(process.env.CODEX_HOME).isDirectory())) throw new Error("CODEX_HOME must point to an existing directory. Create that directory or unset CODEX_HOME before rerunning the installer.");
	const payload  = fileURLToPath(new URL("../payload/", import.meta.url)           ) ;
	const metadata = JSON.parse   (readFileSync(join(payload, "bundle.json"), "utf8")) ;
	for (const host of hosts) {
		const destination = installationRoot(metadata.version, host                      ) ;
		const status      = installHost     (join(payload, host), destination, engineOnly) ;
		if (status !== 0) process.exit(status);
		if (hud) {
			const setup = spawnSync(process.execPath, [join(destination, "plugin/scripts/hud/setup.mjs"), host, join(destination, "plugin")], { stdio: "inherit" });
			if (setup.error) throw setup.error;
			if (setup.status !== 0) throw new Error("Plugin installed, but HUD setup failed. Resolve the error above and rerun --hud.");
		}
	}
} catch (error) {
	console.error(`[BoxBox] ${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
}

```

### `product/installer/install.mjs`

```javascript
import      { spawnSync                                                        } from "node:child_process"        ;
import      { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs"                   ;
import      { join, resolve                                                    } from "node:path"                 ;
import      { fileURLToPath                                                    } from "node:url"                  ;
import      {
              configureSkill                                                 ,
              engineCommand                                                  ,
              findCommand                                                    ,
              hookCommands                                                   ,
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
const hudData       = resolve(root, "..", "hud")                                                                                                                    ;
const skillCommand  = engineCommand(node, launcher, windows, metadata.host)                                                                                         ;
const documents     = [join(plugin, "skills", metadata.name, "SKILL.md"), ...(metadata.host === "claude" ? [join(plugin, "agents/readability-inspector.md")] : [])] ;
for (const path of documents) {
	try {
		writeFileSync(path, configureSkill(readFileSync(path, "utf8"), skillCommand, previous.skillCommand, windows));
	} catch (error) {
		fail(error.message);
	}
}
writeFileSync(configuration, JSON.stringify({ node, cli, skillCommand, hudData }, null, "\t") + "\n");

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

```

### `product/installer/install-state.mjs`

```javascript
import      {
              lstatSync     ,
              readFileSync  ,
              realpathSync  ,
              renameSync    ,
              unlinkSync    ,
              writeFileSync ,
                              } from "node:fs"   ;
import      { join            } from "node:path" ;

const FILE   = ".boxbox-install-state.json"                          ;
const PHASES = ["prepared", "host-registration-started", "verified"] ;

/** A receipt authorizes cleanup only before any host command can change registration. */
export function installationState(root, metadata) {
	const path     = join(root, FILE)                                                                                                                                ;
	const identity = { schema: 1, root: realpathSync(root), name: metadata.name, version: metadata.version, host: metadata.host, marketplace: metadata.marketplace } ;
	function read() {
		let stat;
		try { stat = lstatSync(path); } catch (error) {
			if (error.code === "ENOENT") return undefined;
			throw error;
		}
		if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Reserved installation receipt is not a regular file: ${path}`);
		const value = JSON.parse(readFileSync(path, "utf8"));
		if (!value || Object.entries(identity).some(([key, expected]) => value[key] !== expected) || !PHASES.includes(value.phase)) throw new Error(`Invalid installation receipt: ${path}`);
		return value;
	}
	function create() {
		writeFileSync(path, JSON.stringify({ ...identity, phase: "prepared" }) + "\n", { flag: "wx", mode: 0o600 });
	}
	function advance(phase) {
		const previous = read();
		if (!previous || !["host-registration-started", "verified"].includes(phase) || previous.phase !== "prepared" && !(previous.phase === "host-registration-started" && phase === "verified")) throw new Error(`Invalid installation phase transition at ${path}`);
		const temporary = `${path}.${process.pid}.tmp`;
		writeFileSync(temporary, JSON.stringify({ ...identity, phase }) + "\n", { flag: "wx", mode: 0o600 });
		try { renameSync(temporary, path); } finally {
			try { unlinkSync(temporary); } catch (error) { if (error.code !== "ENOENT") throw error; }
		}
	}
	function remove() {
		if (!read()) throw new Error(`Missing installation receipt: ${path}`);
		unlinkSync(path);
	}
	return { path, read, create, advance, remove };
}

```

### `product/installer/claude-registration.mjs`

```javascript
import      { lstatSync, readFileSync, realpathSync } from "node:fs"   ;
import      { dirname, join, resolve                } from "node:path" ;

/** Check before repair copies can erase evidence of a foreign or shared catalog. */
export function assertClaudeCatalog(root, metadata, allowMissing = false) {
	const directory = join(root     , ".claude-plugin"  ) ;
	const path      = join(directory, "marketplace.json") ;
	for (const [target, isDirectory] of [[directory, true], [path, false]]) {
		let stat;
		try { stat = lstatSync(target); } catch (error) {
			if (allowMissing && error.code === "ENOENT") return;
			throw error;
		}
		if (stat.isSymbolicLink() || (isDirectory ? !stat.isDirectory() : !stat.isFile())) throw new Error(`Refusing non-regular Claude marketplace catalog: ${target}`);
	}
	const catalog = JSON.parse(readFileSync(path, "utf8"));
	if (catalog.name !== metadata.marketplace || !Array.isArray(catalog.plugins) || catalog.plugins.length !== 1 || catalog.plugins[0].name !== metadata.name || catalog.plugins[0].source !== "./plugin") throw new Error("Refusing a foreign or shared Claude marketplace catalog.");
}

/** Bind updates to the installer-owned local marketplace, never a same-named foreign source. */
export function claudeRegistration(root, metadata, invoke) {
	const intended = realpathSync(root)                         ;
	const id       = `${metadata.name}@${metadata.marketplace}` ;
	function json(args) {
		const value = JSON.parse(invoke(args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).stdout);
		if (!Array.isArray(value)) throw new Error(`Unexpected Claude list schema for ${args.join(" ")}`);
		return value;
	}
	function marketplace(exact) {
		const entries = json(["plugin", "marketplace", "list", "--json"]).filter(value => value.name === metadata.marketplace);
		if (!entries.length && !exact) return;
		if (entries.length !== 1 || entries[0].source !== "directory" || typeof entries[0].path !== "string" || typeof entries[0].installLocation !== "string") throw new Error("Claude marketplace is missing, ambiguous or not an owned local directory.");
		const source = realpathSync(entries[0].path);
		if (realpathSync(entries[0].installLocation) !== source) throw new Error("Claude marketplace installLocation does not match its source.");
		if (exact && source !== intended) throw new Error("Claude marketplace did not select the intended installation root.");
		if (dirname(source) !== dirname(intended)) throw new Error("Refusing to replace a foreign Claude marketplace.");
		const bundle   = JSON.parse(readFileSync(join(source, "bundle.json"), "utf8"))                       ;
		const manifest = JSON.parse(readFileSync(join(source, "plugin/.claude-plugin/plugin.json"), "utf8")) ;
		if (bundle.name !== metadata.name || bundle.host !== "claude" || bundle.marketplace !== metadata.marketplace || manifest.name !== metadata.name || manifest.version !== bundle.version || source !== realpathSync(resolve(dirname(intended), bundle.version))) throw new Error("Claude marketplace ownership could not be established.");
		assertClaudeCatalog(source, metadata);
		return source;
	}
	function plugin(required) {
		const all = json(["plugin", "list", "--json"]);
		if (all.some(value => typeof value.id === "string" && value.id.endsWith(`@${metadata.marketplace}`) && value.id !== id)) throw new Error("Refusing to replace a Claude marketplace shared with another plugin.");
		const entries = all.filter(value => value.id === id);
		if (!entries.length && !required) return;
		if (entries.length !== 1 || entries[0].scope !== "user" || entries[0].enabled !== true || typeof entries[0].installPath !== "string") throw new Error("Claude plugin identity is missing, ambiguous, disabled or outside user scope.");
		return entries[0];
	}
	function preflight() {
		const help = invoke(["plugin", "update", "--help"], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).stdout;
		if (!/(?:^|\s)--scope(?:[\s=,]|$)/u.test(help)) throw new Error("Claude plugin update does not advertise --scope support; upgrade Claude before installation.");
		const source = marketplace(false);
		if (plugin(false) && !source) throw new Error("Existing Claude plugin has no owned marketplace registration.");
	}
	function verify() {
		marketplace(true);
		let installed = plugin(true);
		if (installed.version !== metadata.version) {
			invoke(["plugin", "update", id, "--scope", "user"]);
			marketplace(true);
			installed = plugin(true);
		}
		if (installed.version !== metadata.version) throw new Error("Claude retained the wrong plugin version after registration.");
		const cached   = realpathSync(installed.installPath                                           ) ;
		const manifest = JSON.parse  (readFileSync(join(cached, ".claude-plugin/plugin.json"), "utf8")) ;
		const runtime  = JSON.parse  (readFileSync(join(cached, "runtime.json"), "utf8")              ) ;
		const expected = JSON.parse  (readFileSync(join(intended, "plugin/runtime.json"), "utf8")     ) ;
		if (manifest.name !== metadata.name || manifest.version !== metadata.version || realpathSync(runtime.cli) !== realpathSync(expected.cli) || realpathSync(runtime.node) !== realpathSync(expected.node)) throw new Error("Claude cached plugin identity or runtime does not match the intended installation.");
	}
	return { preflight, marketplace: () => marketplace(true), verify };
}

```

### `development/tools/build-installer-artifact.ts`

```typescript
import      { spawnSync       } from "node:child_process" ;
import      {
              chmodSync     ,
              cpSync        ,
              mkdirSync     ,
              readFileSync  ,
              rmSync        ,
              writeFileSync ,
                              } from "node:fs"            ;
import      { join, resolve   } from "node:path"          ;

const ROOT = resolve(import.meta.dir, "..", "..");

function run(command: string, args: readonly string[]): string {
	const child = spawnSync(command, args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
	if (child.error) throw child.error;
	if (child.status !== 0) throw new Error(`${command} exited with ${child.status ?? child.signal}`);
	console.log(child.stdout);
	return child.stdout;
}

function projectDocument(source: string): string {
	const projected = source.replaceAll(/"<PLUGIN_ROOT>\/scripts\/boxbox"/gu, "@BOXBOX_ENGINE_COMMAND@");
	if (!projected.includes("@BOXBOX_ENGINE_COMMAND@") || /npx\s|scripts\/boxbox["\s]/u.test(projected)) throw new Error("Canonical plugin launcher changed; update the installer projection before shipping.");
	return projected;
}

/** Both host adapters carry the same fresh private engine, with no registry BoxBox lookup at runtime. */
export function buildInstallerArtifact(): string {
	run("bun", ["run", "sync:plugin"]);
	run("bun", ["run", "pack:cli"]);
	const product     = JSON.parse(readFileSync(join(ROOT, "product.json"), "utf8")) as { displayName: string; npmName: string }                                      ;
	const manifest    = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { name: string; version: string }                                             ;
	const marketplace = JSON.parse(readFileSync(join(ROOT, ".agents/plugins/marketplace.json"), "utf8")) as { name: string }                                          ;
	const output      = join(ROOT, "dist/installer-package")                                                                                                          ;
	const payload     = join(output, "payload")                                                                                                                       ;
	const metadata    = { name: manifest.name, npmName: product.npmName, version: manifest.version, displayName: product.displayName, marketplace: marketplace.name } ;
	if (!product.npmName) throw new Error("product.json must declare the public installer npmName.");
	rmSync(output, { recursive: true, force: true });
	mkdirSync(join(output, "bin"), { recursive: true });
	mkdirSync(payload, { recursive: true });
	for (const name of ["platform.mjs", "install-state.mjs", "claude-registration.mjs"]) cpSync(join(ROOT, "product/installer", name), join(payload, name));
	cpSync(join(ROOT, "product/installer/entry.mjs"), join(output, "bin/boxbox.mjs"));
	cpSync(join(ROOT, "product/installer/README.md"), join(output, "README.md"));
	chmodSync(join(output, "bin/boxbox.mjs"), 0o755);
	writeFileSync(join(payload, "bundle.json"), JSON.stringify(metadata, null, "\t") + "\n");
	writeFileSync(join(output, "package.json"), JSON.stringify({ name: product.npmName, version: manifest.version, license: "UNLICENSED", description: `${product.displayName} plugin installer for Codex and Claude Code`, type: "module", engines: { node: ">=22.22.3" }, bin: { [manifest.name]: "bin/boxbox.mjs" }, files: ["bin/boxbox.mjs", "payload/", "README.md"] }, null, "\t") + "\n");

	for (const host of ["codex", "claude"]) {
		const root            = join(payload, host)                                                                       ;
		const plugin          = join(root, "plugin")                                                                      ;
		const marketplacePath = host === "codex" ? ".agents/plugins/marketplace.json" : ".claude-plugin/marketplace.json" ;
		mkdirSync(join(root, "packages"), { recursive: true });
		mkdirSync(join(root, marketplacePath, ".."), { recursive: true });
		mkdirSync(join(plugin, "scripts"), { recursive: true });
		for (const path of [host === "codex" ? ".codex-plugin" : ".claude-plugin", "skills", "hooks", ...(host === "claude" ? ["agents"] : [])]) cpSync(join(ROOT, "plugin", path), join(plugin, path), { recursive: true });
		cpSync(join(ROOT, marketplacePath), join(root, marketplacePath));
		cpSync(join(ROOT, "dist", `${manifest.name}-${manifest.version}.tgz`), join(root, "packages", `${manifest.name}-${manifest.version}.tgz`));
		for (const name of ["install.mjs", "platform.mjs", "install-state.mjs", "claude-registration.mjs"]) cpSync(join(ROOT, "product/installer", name), join(root, name));
		cpSync(join(ROOT, "product/installer/launcher.mjs"), join(plugin, "scripts/boxbox.mjs"));
		cpSync(join(ROOT, "product/hud"), join(plugin, "scripts/hud"), { recursive: true });
		writeFileSync(join(root, "bundle.json"), JSON.stringify({ ...metadata, host }, null, "\t") + "\n");
		const skillPath = join(plugin, "skills", manifest.name, "SKILL.md")                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     ;
		const skill     = projectDocument(readFileSync(skillPath, "utf8")).replace(/^Every check and fix goes through.*$/mu, "Every check and fix goes through this plugin's permanent local Node launcher, already configured by the installer. Run the commands below from the root of the target repository. No BOXBOX_CLI setup is needed. Never fetch a separate registry package for the engine. " + (host === "claude" ? "On Windows, the generated Node bridge works from Bash or PowerShell." : "On Windows, run these commands through PowerShell.")) ;
		writeFileSync(skillPath, skill);
		if (host === "claude") {
			const inspector = join(plugin, "agents/readability-inspector.md");
			writeFileSync(inspector, projectDocument(readFileSync(inspector, "utf8")) + "\nOn Windows, the generated Node bridge works from Bash or PowerShell.\n");
		}
		const hooksPath = join      (plugin, "hooks/hooks.json"     ) ;
		const hooks     = JSON.parse(readFileSync(hooksPath, "utf8")) ;
		for (const [event, mode] of [["SessionStart", "session"], ["PostToolUse", "post"], ["Stop", "stop"]]) {
			for (const group of hooks.hooks[event!]) {
				for (const hook of group.hooks) {
					delete hook.commandWindows;
					delete hook.args;
					if (host === "claude") Object.assign(hook, { command: "node", args: ["${CLAUDE_PLUGIN_ROOT}/scripts/boxbox.mjs", "hook", mode] });
					else Object.assign(hook, { command: `node "\${PLUGIN_ROOT}/scripts/boxbox.mjs" hook ${mode}`, commandWindows: `node "$env:PLUGIN_ROOT/scripts/boxbox.mjs" hook ${mode}` });
				}
			}
		}
		writeFileSync(hooksPath, JSON.stringify(hooks, null, "\t") + "\n");
	}

	const destination = join(ROOT, "dist/installer");
	mkdirSync(destination, { recursive: true });
	const packed = run("npm", ["pack", output, "--pack-destination", destination, "--json"]);
	writeFileSync(join(destination, "pack-result.json"), packed);
	const archive = join(destination, (JSON.parse(packed) as [{ filename: string }])[0].filename);
	console.log(archive);
	return archive;
}

if (import.meta.main) buildInstallerArtifact();

```

### `test/installer-registration.test.ts`

```typescript
import      { afterAll, expect, test } from "bun:test"           ;
import      { spawnSync              } from "node:child_process" ;
import      {
              cpSync               ,
              existsSync           ,
              mkdirSync            ,
              mkdtempSync          ,
              readFileSync         ,
              readdirSync          ,
              rmSync               ,
              symlinkSync          ,
              writeFileSync        ,
                                     } from "node:fs"            ;
import      { tmpdir                 } from "node:os"            ;
import      { dirname, join, resolve } from "node:path"          ;

const SOURCE          = resolve(import.meta.dir, "../product/installer")                                    ;
const roots: string[] = []                                                                                  ;
const metadata        = { name: "boxbox", version: "0.2.4", host: "claude", marketplace: "boxbox-plugins" } ;
const registration    = await import(join(SOURCE, "claude-registration.mjs"))                               ;

function temporary(): string {
	const root = mkdtempSync(join(tmpdir(), "boxbox registration simulation "));
	roots.push(root);
	return root;
}

afterAll(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }); });

function payload(root: string, version: string): void {
	mkdirSync(join(root, "plugin/.claude-plugin"), { recursive: true });
	mkdirSync(join(root, ".claude-plugin"), { recursive: true });
	writeFileSync(join(root, ".claude-plugin/marketplace.json"), JSON.stringify({ name: "boxbox-plugins", plugins: [{ name: "boxbox", source: "./plugin" }] }));
	writeFileSync(join(root, "bundle.json"), JSON.stringify({ ...metadata, version }));
	writeFileSync(join(root, "plugin/.claude-plugin/plugin.json"), JSON.stringify({ name: "boxbox", version }));
	writeFileSync(join(root, "cli.js"), "engine fixture");
	writeFileSync(join(root, "plugin/runtime.json"), JSON.stringify({ cli: join(root, "cli.js"), node: process.execPath }));
}

test("simulated Claude no-op install requires one scoped update and matching cached identity", () => {
	const directory = temporary()                   ;
	const old       = join     (directory, "0.2.3") ;
	const current   = join     (directory, "0.2.4") ;
	payload(old, "0.2.3");
	payload(current, "0.2.4");
	let market                = old                                                                                                               ;
	let installed             = { id: "boxbox@boxbox-plugins", scope: "user", enabled: true, version: "0.2.3", installPath: join(old, "plugin") } ;
	const updates: string[][] = []                                                                                                                ;
	const invoke = (args: string[]) => {
		if (args.includes("--help"))   return { stdout: "--scope <scope>" };
		if (args[1] === "marketplace") return { stdout: JSON.stringify([{ name: "boxbox-plugins", source: "directory", path: market, installLocation: market }]) };
		if (args[1] === "list")        return { stdout: JSON.stringify([installed]) };
		updates.push(args);
		installed = { ...installed, version: "0.2.4", installPath: join(current, "plugin") };
		return { stdout: "" };
	};
	const host = registration.claudeRegistration(current, metadata, invoke);
	host.preflight();
	market = current;
	host.marketplace();
	host.verify();
	host.verify();
	expect(updates).toEqual([["plugin", "update", "boxbox@boxbox-plugins", "--scope", "user"]]);
	writeFileSync(join(current, "plugin/runtime.json"), JSON.stringify({ cli: join(old, "cli.js"), node: process.execPath }));
	const cache = join(directory, "cache");
	cpSync(join(current, "plugin"), cache, { recursive: true });
	installed = { ...installed, installPath: cache };
	writeFileSync(join(current, "plugin/runtime.json"), JSON.stringify({ cli: join(current, "cli.js"), node: process.execPath }));
	expect(() => host.verify()).toThrow("runtime");
});

test("simulated Claude refuses foreign marketplaces, duplicate scopes and stale successful updates", () => {
	const directory = temporary()                           ;
	const current   = join     (directory, "owned/0.2.4"  ) ;
	const foreign   = join     (directory, "foreign/0.2.3") ;
	payload(current, "0.2.4");
	payload(foreign, "0.2.3");
	let market  = foreign                                                                                                                 ;
	let entries = [{ id: "boxbox@boxbox-plugins", scope: "user", enabled: true, version: "0.2.3", installPath: join(foreign, "plugin") }] ;
	let updates = 0                                                                                                                       ;
	const host = registration.claudeRegistration(current, metadata, (args: string[]) => {
		if (args.includes("--help"))   return { stdout: "--scope <scope>" };
		if (args[1] === "marketplace") return { stdout: JSON.stringify([{ name: "boxbox-plugins", source: "directory", path: market, installLocation: market }]) };
		if (args[1] === "list")        return { stdout: JSON.stringify(entries) };
		updates += 1;
		return { stdout: "" };
	});
	expect(() => host.preflight()).toThrow("foreign");
	market = current;
	entries.push({ ...entries[0]!, scope: "project" });
	expect(() => host.preflight()).toThrow("ambiguous");
	entries = entries.slice(0, 1);
	expect(() => host.verify()).toThrow("wrong plugin version");
	expect(updates).toBe(1);
});

test("simulated Claude rejects split marketplace locations and uninstalled shared catalog entries before mutation", () => {
	const directory = temporary()                   ;
	const current   = join     (directory, "0.2.4") ;
	const old       = join     (directory, "0.2.3") ;
	payload(current, "0.2.4");
	payload(old, "0.2.3");
	let installLocation     = old ;
	const calls: string[][] = []  ;
	const host = registration.claudeRegistration(current, metadata, (args: string[]) => {
		calls.push(args);
		if (args.includes("--help")) return { stdout: "--scope <scope>" };
		if (args[1] === "marketplace") return { stdout: JSON.stringify([{ name: "boxbox-plugins", source: "directory", path: current, installLocation }]) };
		return { stdout: "[]" };
	});
	expect(() => host.preflight()).toThrow("installLocation");
	installLocation = current;
	writeFileSync(join(current, ".claude-plugin/marketplace.json"), JSON.stringify({ name: "boxbox-plugins", plugins: [{ name: "boxbox", source: "./plugin" }, { name: "uninstalled-other", source: "./other" }] }));
	expect(() => host.preflight()).toThrow("shared");
	expect(calls.every(args => args.includes("--help") || args.includes("list"))).toBe(true);
});

function simulatedChild(code: string) {
	const directory   = temporary()                                     ;
	const packageRoot = join     (directory, "package"                ) ;
	const bundled     = join     (packageRoot, "payload/codex"        ) ;
	const destination = join     (directory, "data/boxbox/codex/0.2.4") ;
	mkdirSync(join(packageRoot, "bin"), { recursive: true });
	mkdirSync(bundled, { recursive: true });
	mkdirSync(destination, { recursive: true });
	cpSync(join(SOURCE, "entry.mjs"), join(packageRoot, "bin/boxbox.mjs"));
	for (const name of ["platform.mjs", "install-state.mjs", "claude-registration.mjs"]) cpSync(join(SOURCE, name), join(packageRoot, "payload", name));
	cpSync(join(SOURCE, "install-state.mjs"), join(bundled, "install-state.mjs"));
	const bundle = { ...metadata, host: "codex" };
	writeFileSync(join(packageRoot, "payload/bundle.json"), JSON.stringify(bundle));
	writeFileSync(join(bundled, "bundle.json"), JSON.stringify(bundle));
	writeFileSync(join(destination, "preserved.txt"), "previous bytes");
	writeFileSync(join(bundled, "install.mjs"), `import { installationState } from './install-state.mjs'; import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'; import { fileURLToPath } from 'node:url'; const root=fileURLToPath(new URL('./',import.meta.url)); const metadata=JSON.parse(readFileSync(root+'bundle.json','utf8')); const state=installationState(root,metadata); writeFileSync(root+'preserved.txt','new bytes'); ${code}`);
	const run = () => spawnSync("node", [join(packageRoot, "bin/boxbox.mjs"), "--engine-only"], { encoding: "utf8", env: { ...process.env, XDG_DATA_HOME: join(directory, "data"), LOCALAPPDATA: join(directory, "data") } });
	return { run, destination };
}

test("real parent/child simulation restores only proven pre-registration failures", () => {
	const child = simulatedChild("process.exit(19);");
	expect(child.run().status                                            ).toBe   (19              ) ;
	expect(readFileSync(join(child.destination, "preserved.txt"), "utf8")).toBe   ("previous bytes") ;
	expect(readdirSync(dirname(child.destination))                       ).toEqual(["0.2.4"]       ) ;
});

test("real parent/child simulation retains mutation, missing, corrupt and unverified-zero outcomes", () => {
	for (const code of ["state.advance('host-registration-started'); process.exit(31);", "unlinkSync(state.path); process.exit(19);", "writeFileSync(state.path,'broken'); process.exit(19);", "process.exit(0);", "process.kill(process.pid, 'SIGTERM');"]) {
		const child  = simulatedChild(code) ;
		const result = child.run     ()     ;
		expect(result.status                                                 ).not.toBe     (0                      ) ;
		expect(result.stderr                                                 )    .toContain("Retained installation") ;
		expect(readFileSync(join(child.destination, "preserved.txt"), "utf8"))    .toBe     ("new bytes"            ) ;
		const backups = readdirSync(dirname(child.destination)).filter(name => name.startsWith(".boxbox-repair-"));
		expect(backups).toHaveLength(1);
		expect(readFileSync(join(dirname(child.destination), backups[0]!, "previous/preserved.txt"), "utf8")).toBe("previous bytes");
	}
});

test("real parent/child simulation retries owned partial receipts but refuses foreign and symlink receipts", () => {
	const child = simulatedChild("state.advance('host-registration-started'); process.exit(31);");
	expect(child.run().status                                                                        ).toBe        (31) ;
	expect(child.run().status                                                                        ).toBe        (31) ;
	expect(readdirSync(dirname(child.destination)).filter(name => name.startsWith(".boxbox-repair-"))).toHaveLength(2 ) ;
	for (const symlink of [false, true]) {
		const fresh   = simulatedChild("state.advance('verified');"                   ) ;
		const receipt = join          (fresh.destination, ".boxbox-install-state.json") ;
		const foreign = join          (fresh.destination, "foreign.json"              ) ;
		writeFileSync(foreign, "foreign bytes");
		if (symlink) symlinkSync(foreign, receipt);
		else writeFileSync(receipt, JSON.stringify({ schema: 1, root: "foreign", phase: "prepared" }));
		expect(fresh.run().status                                            ).toBe(1               ) ;
		expect(readFileSync(join(fresh.destination, "preserved.txt"), "utf8")).toBe("previous bytes") ;
		expect(readFileSync(foreign, "utf8")                                 ).toBe("foreign bytes" ) ;
	}
	const verified = simulatedChild("state.advance('verified');");
	expect(verified.run().status).toBe(0);
	expect(existsSync(join(verified.destination, ".boxbox-install-state.json"))).toBe(false);
});

```

### `test/installer-artifact.test.ts`

```typescript
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
	// Stateful simulation of host registration; this is not native host acceptance evidence.
	writeFileSync(executable, `#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
const host = ${JSON.stringify(host)};
const args = process.argv.slice(2);
appendFileSync(process.env.BOXBOX_TEST_LOG, JSON.stringify({host,args,codexHome:process.env.CODEX_HOME,claudeHome:process.env.CLAUDE_CONFIG_DIR}) + "\\n");
if (host === process.env.BOXBOX_TEST_FAIL_HOST && args[0] === "plugin" && ["add","install"].includes(args[1]) && args[2] !== "--help") process.exit(Number(process.env.BOXBOX_TEST_EXIT || 31));
if (host !== "claude") process.exit(0);
if (args.join(" ") === "plugin update --help") { console.log(process.env.BOXBOX_TEST_NO_SCOPE ? "Update a plugin" : "--scope <scope>"); process.exit(0); }
const statePath = process.env.BOXBOX_TEST_LOG + ".claude.json";
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath,"utf8")) : {};
if (args.join(" ") === "plugin marketplace list --json") console.log(JSON.stringify(state.root ? [{name:"boxbox-plugins",source:"directory",path:state.root,installLocation:state.root}] : []));
if (args.join(" ") === "plugin list --json") console.log(JSON.stringify(state.plugin ? [state.plugin] : []));
if (args[1] === "marketplace" && args[2] === "add") state.root = resolve(args[3]);
if ((args[1] === "install" && !state.plugin || args[1] === "update") && args[2] !== "--help") {
 const metadata = JSON.parse(readFileSync(join(state.root,"bundle.json"),"utf8"));
 state.plugin = {id:"boxbox@boxbox-plugins",version:metadata.version,scope:"user",enabled:true,installPath:join(state.root,"plugin")};
}
writeFileSync(statePath,JSON.stringify(state));
`);
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
		expect(platform.findCommand(host, { ...options, exists: (candidate: string) => candidate === path, probe: () => ({ status: 0, stdout: "codex-cli 0.163.0\n" }) })).toEqual({ executable: path, args: [] });
		expect(platform.installationRoot(VERSION, host, { windows: true, environment: { LOCALAPPDATA: "C:\\Users\\A Person\\AppData\\Local" } })).toBe(`C:\\Users\\A Person\\AppData\\Local\\BoxBox\\${host === "codex" ? "Codex" : "Claude"}\\${VERSION}`);
	}
	expect(() => platform.installationRoot(VERSION, "codex", { windows: true, environment: {} })                            ).toThrow("LOCALAPPDATA"                                        ) ;
	expect(platform.installationRoot(VERSION, "claude", { windows: false, environment: {}, home: "/home/a person" })        ).toBe   (`/home/a person/.local/share/boxbox/claude/${VERSION}`) ;
	expect(() => platform.installationRoot(VERSION, "codex", { windows: false, environment: { XDG_DATA_HOME: "relative" } })).toThrow("absolute"                                            ) ;
	for (const version of ["22.22.3", "22.23.0", "24.0.0"]) expect(platform.supportedNode(version)).toBe(true);
	for (const version of ["20.22.3", "22.22.2", "22.21.9"]) expect(platform.supportedNode(version)).toBe(false);
	const command = platform.engineCommand (executable, "C:\\A Person's Files\\BoxBox\\plugin\\scripts\\boxbox.mjs", true                                        ) ;
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
	const command = platform.engineCommand(node, launcher, true, "claude"                                                        ) ;
	const result  = run                   ("/bin/bash", ["-c", `${command} doctor --file 'a file.ts' --json`], { cwd: workspace }) ;
	expectStatus(result, 0);
	expect(JSON.parse(String(result.stdout))).toEqual(["doctor", "--file", "a file.ts", "--json"]);
	expectStatus(run("/bin/bash", ["-c", `${command} check`], { env: { ...process.env, BOXBOX_TEST_EXIT: "42" } }), 42);
	const missing = platform.engineCommand(join(workspace, "missing node"), launcher, true, "claude");
	expectStatus(run("/bin/bash", ["-c", `${missing} doctor`]), 1);
});

test("npm installer name differs from private engine and both host payloads have an exact allowlist", () => {
	const packageRoot = extract   ()                                                        ;
	const payload     = join      (packageRoot, "payload"                                 ) ;
	const manifest    = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) ;
	expect(manifest).toMatchObject({ name: NPM_NAME, version: VERSION, license: "UNLICENSED", bin: { boxbox: "bin/boxbox.mjs" }, engines: { node: ">=22.22.3" } });
	expect(manifest.private).toBeUndefined();
	expect(manifest.dependencies).toBeUndefined();
	expect(JSON.parse(readFileSync(join(payload, "bundle.json"), "utf8"))).toMatchObject({ name: "boxbox", npmName: NPM_NAME });
	const expected = ["README.md", "bin/boxbox.mjs", "package.json", "payload/bundle.json", "payload/platform.mjs", "payload/install-state.mjs", "payload/claude-registration.mjs"];
	for (const host of ["codex", "claude"]) {
		const root            = join(payload, host)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                ;
		const plugin          = join(root, "plugin")                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               ;
		const marketplacePath = host === "codex" ? ".agents/plugins/marketplace.json" : ".claude-plugin/marketplace.json"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          ;
		const hostFiles       = [marketplacePath, "bundle.json", "install.mjs", "install-state.mjs", "claude-registration.mjs", `packages/boxbox-${VERSION}.tgz`, "platform.mjs", `plugin/.${host === "codex" ? "codex" : "claude"}-plugin/plugin.json`, "plugin/hooks/hooks.json", "plugin/scripts/boxbox.mjs", ...["status.mjs", "codex.mjs", "record.mjs", "setup.mjs"].map(name => `plugin/scripts/hud/${name}`), "plugin/skills/boxbox/SKILL.md", ...["charter.md", "grammar.md", "readability-contract.md", "typescript-grid-template.md"].map(name => `plugin/skills/boxbox/references/${name}`), ...(host === "claude" ? ["plugin/agents/readability-inspector.md"] : [])] ;
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
	const nestedFiles = String(listing.stdout).trim().split("\n").filter(path => !path.endsWith("/"));
	expect(nestedFiles.sort()).toEqual([
		"package/README.md", "package/THIRD_PARTY_NOTICES", "package/dist/cli.js", "package/package.json",
		"package/rules/presets/recommended/conventions.jsonl",
		"package/rules/presets/recommended/decisions.jsonl",
		"package/rules/presets/recommended/docs/public/decisions/py-simple-assignments.md",
		"package/rules/presets/recommended/docs/public/decisions/ts-sourcefile-call-declarations.md",
		"package/rules/presets/recommended/examples.jsonl",
	].sort());
	for (const path of nestedFiles) expect(readFileSync(join(nested, path), "utf8")).not.toContain(ROOT);
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
	expect(calls.filter(call => !call.args.includes("list")).map(call => [call.host, call.args])).toEqual([
		["codex", ["--version"]], ["codex", ["plugin", "add", "--help"]], ["codex", ["plugin", "marketplace", "add", permanent(env, "codex") + "/"]], ["codex", ["plugin", "add", "boxbox@boxbox-plugins"]],
		["claude", ["--version"]], ["claude", ["plugin", "install", "--help"]], ["claude", ["plugin", "update", "--help"]], ["claude", ["plugin", "marketplace", "add", permanent(env, "claude") + "/"]], ["claude", ["plugin", "install", "boxbox@boxbox-plugins", "--scope", "user"]],
	]);
	expect(calls.every(call => call.codexHome === env.CODEX_HOME && call.claudeHome === env.CLAUDE_CONFIG_DIR)).toBe(true                                       ) ;
	expect(readFileSync(configurationPath, "utf8")                                                            ).toBe('# Existing setting\nmodel = "preserved"\n') ;
	expect(readFileSync(settingsPath, "utf8")                                                                 ).toBe('{"existing":true}\n'                      ) ;
	rmSync(cache, { recursive: true, force: true });
	rmSync(staging, { recursive: true, force: true });
	for (const host of ["codex", "claude"]) {
		const root          = permanent (env, host                                         ) ;
		const plugin        = join      (root, "plugin"                                    ) ;
		const launcher      = join      (plugin, "scripts/boxbox.mjs"                      ) ;
		const configuration = JSON.parse(readFileSync(join(plugin, "runtime.json"), "utf8")) ;
		expect(String(run(node, [launcher, "--version"], { env }).stdout).trim()).toBe       (VERSION) ;
		expect(configuration.node                                               ).toBe       (node   ) ;
		expect(configuration.cli                                                ).toStartWith(root   ) ;
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
		const preview = run(node, [launcher, "format", "--file", "sample.ts", "--dry-run", "--json"], { cwd: targetProject, env });
		expectStatus(preview, 0);
		expect(JSON.parse(String(preview.stdout))                     ).toMatchObject({ written: false, formatterExecuted: false, formatMode: "standalone" }) ;
		expect(JSON.parse(String(hook("PostToolUse").stdout)).decision).toBe         ("block"                                                               ) ;
		expect(JSON.parse(String(hook("Stop").stdout)).decision       ).toBe         ("block"                                                               ) ;
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
	expect(JSON.parse(readFileSync(join(codex, ".boxbox-install-state.json"), "utf8")).phase).toBe("host-registration-started");
	expect(readdirSync(resolve(codex, "..")).some(name => name.startsWith(".boxbox-repair-"))).toBe(true);
	for (const [index, path] of paths.entries()) expect(readFileSync(join(codex, path)).equals(before[index]!)).toBe(true);
	expectStatus(run(npm, ["exec", "--offline", "--yes", "--package", artifact, "--", "boxbox", "--codex"], { cwd: project, env }), 0);
	expect(readFileSync(join(codex, "preserved.txt"), "utf8")).toBe("user data\n");
}, 300_000);

test("explicit host flags install only selected adapters and engine-only does not register any host", () => {
	const packageRoot = extract();
	for (const host of ["codex", "claude"]) {
		const workspace = temporary         ()          ;
		const env       = runtimeEnvironment(workspace) ;
		fakeHost(workspace, "codex");
		fakeHost(workspace, "claude");
		const targeted = host === "claude" ? { ...env, CODEX_HOME: join(workspace, "absent codex home") } : env;
		expectStatus(run(node, [join(packageRoot, "bin/boxbox.mjs"), `--${host}`], { env: targeted }), 0);
		expect(existsSync(join(permanent(env, host), "plugin/runtime.json"))).toBe(true);
		expect(existsSync(permanent(env, host === "codex" ? "claude" : "codex"))).toBe(false);
		const calls = readFileSync(env.BOXBOX_TEST_LOG!, "utf8").trim().split("\n").map(line => JSON.parse(line));
		expect(calls.every(call => call.host === host)).toBe(true);
		if (host === "claude") {
			const statePath   = env.BOXBOX_TEST_LOG! + ".claude.json"                                                                             ;
			const stateBefore = readFileSync(statePath)                                                                                           ;
			const skillPath   = join(permanent(env, host), "plugin/skills/boxbox/SKILL.md")                                                       ;
			const skillBefore = readFileSync(skillPath)                                                                                           ;
			const unsupported = run(node, [join(packageRoot, "bin/boxbox.mjs"), "--claude"], { env: { ...targeted, BOXBOX_TEST_NO_SCOPE: "1" } }) ;
			expectStatus(unsupported, 1);
			expect(String(unsupported.stderr)                                          ).toContain("does not advertise --scope") ;
			expect(readFileSync(statePath).equals(stateBefore)                         ).toBe     (true                        ) ;
			expect(readFileSync(skillPath).equals(skillBefore)                         ).toBe     (true                        ) ;
			expect(existsSync(join(permanent(env, host), ".boxbox-install-state.json"))).toBe     (false                       ) ;
			const afterCalls = readFileSync(env.BOXBOX_TEST_LOG!, "utf8").trim().split("\n").map(line => JSON.parse(line));
			expect(afterCalls.slice(calls.length).map(call => call.args)).toEqual([["--version"], ["plugin", "install", "--help"], ["plugin", "update", "--help"]]);
			const catalogPath  = join        (permanent(env, host), ".claude-plugin/marketplace.json") ;
			const ownedCatalog = readFileSync(catalogPath                                            ) ;
			const catalog      = JSON.parse  (ownedCatalog.toString()                                ) ;
			const logBefore    = readFileSync(env.BOXBOX_TEST_LOG!                                   ) ;
			for (const foreign of [JSON.stringify({ ...catalog, plugins: [...catalog.plugins, { name: "other", source: "./other" }] }), "malformed catalog", "symlink"]) {
				if (foreign === "symlink") {
					rmSync(catalogPath);
					writeFileSync(join(workspace, "foreign-catalog.json"), ownedCatalog);
					symlinkSync(join(workspace, "foreign-catalog.json"), catalogPath);
				} else writeFileSync(catalogPath, foreign);
				const beforeCatalog = readFileSync(catalogPath);
				expectStatus(run(node, [join(packageRoot, "bin/boxbox.mjs"), "--claude"], { env: targeted }), 1);
				expect(readFileSync(catalogPath).equals(beforeCatalog)                                                    ).toBe   (true) ;
				expect(readFileSync(statePath).equals(stateBefore)                                                        ).toBe   (true) ;
				expect(readFileSync(env.BOXBOX_TEST_LOG!).equals(logBefore)                                               ).toBe   (true) ;
				expect(readdirSync(resolve(permanent(env, host), "..")).filter(name => name.startsWith(".boxbox-repair-"))).toEqual([]  ) ;
				rmSync(catalogPath);
				writeFileSync(catalogPath, ownedCatalog);
			}

		}
	}
	const workspace = temporary         ()          ;
	const env       = runtimeEnvironment(workspace) ;
	expectStatus(run(node, [join(packageRoot, "bin/boxbox.mjs"), "--engine-only"], { env }), 0);
	expect(existsSync(join(permanent(env, "codex"), "plugin/runtime.json"))).toBe(true ) ;
	expect(existsSync(permanent(env, "claude"))                            ).toBe(false) ;
	expect(existsSync(env.BOXBOX_TEST_LOG!)                                ).toBe(false) ;
}, 180_000);

test("repair filesystem failures retain a recovery backup and report its path", () => {
	for (const fault of ["remove", "restore", "backup", "backup-cleanup", "cleanup"]) {
		const packageRoot = extract           ()                     ;
		const workspace   = temporary         ()                     ;
		const environment = runtimeEnvironment(workspace           ) ;
		const destination = permanent         (environment, "codex") ;
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
	const packageRoot = extract           ()                                 ;
	const workspace   = temporary         ()                                 ;
	const env         = runtimeEnvironment(workspace                       ) ;
	const entry       = join              (packageRoot, "bin/boxbox.mjs"   ) ;
	const help        = run               (node, [entry, "--help"], { env }) ;
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

```

### `product/installer/README.md`

```markdown
# BoxBox plugin installer for Codex and Claude Code

The intended public command is **`npx boxbox-plugin`**. The npm package is `boxbox-plugin`; its single executable is `boxbox`, and
plugin/skill identifiers remain `boxbox`. This test preview uses license `UNLICENSED` and provides no
open-source grant. Confirm the publisher's registry release before using the public command; a supplied local tarball can be tested before publication. The unrelated npm package `boxbox` is not this installer.

## Windows PowerShell prerequisites

Install Node.js **22.22.3 or newer**, npm, and at least one host CLI with plugin support: Codex or Claude Code.
Check `node --version`, `npm.cmd --version`, and `codex.cmd plugin --help` or `claude plugin --help` in a new PowerShell
terminal. Use `codex` for a native Codex executable. Standard npm-installed Windows Claude Code is detected through its
native `claude.exe`; no Bash, WSL, or script execution-policy change is required by this installer.
BoxBox itself requires no global install, Bun, Python, or source checkout. Python formatting additionally requires `python3`.

If `CODEX_HOME` is set for a Codex installation, it must already be an existing directory. `CLAUDE_CONFIG_DIR` is passed to
Claude unchanged. Existing host configuration is preserved through normal plugin-management commands. The installer never
edits hook trust or grants it automatically.

## Install

After an authorized public release:

```powershell
npx.cmd boxbox-plugin
```

With no arguments, the installer detects installed Codex and Claude Code CLIs and installs for every detected host. It
fails with instructions if neither is found. Select a particular host explicitly when needed:

```powershell
npx.cmd boxbox-plugin --codex
npx.cmd boxbox-plugin --claude
npx.cmd boxbox-plugin --codex --claude
```

To test a local candidate before publication, use the absolute installer tarball path instead of the registry:

```powershell
npm.cmd exec --yes --package 'C:\path\to\boxbox-plugin-<version>.tgz' -- boxbox
```

## Optional terminal HUD (macOS/Linux)

Pass `--hud` with the selected host flags to opt in. For a local candidate:

```sh
npm exec --yes --package '/absolute/path/to/boxbox-plugin-<version>.tgz' -- boxbox --codex --claude --hud
~/.local/bin/boxbox-codex
```

Claude uses its official status line after restart. Setup preserves unrelated user settings and refuses another
status line. Codex uses an isolated tmux server with a four-row companion pane; install tmux first and launch outside
an existing tmux session. `BOXBOX_BIN_HOME` overrides `~/.local/bin`; no PATH or ordinary `codex` alias is changed.
The Codex HUD follows only the starting project (including `--cd`); relaunch when switching projects/sessions.
Remote, worktree, resume/fork startup and noninteractive subcommands are refused by this launcher. Use ordinary
`codex` for them. Detaching closes the owned session. Windows/desktop HUDs are outside this adapter's support.
Engine readiness and approval counts are configuration checks. Last-check receipts are labeled by scope and age;
missing receipts stay unknown. No hook trust or approval policy is changed. Direct marketplace installation alone
does not configure this optional installer HUD.

Before deleting permanent files, disable each selected HUD using that host's installed plugin directory:

```sh
node '/absolute/installed/plugin/scripts/hud/setup.mjs' claude '/absolute/installed/plugin' --disable
node '/absolute/installed/plugin/scripts/hud/setup.mjs' codex '/absolute/installed/plugin' --disable
```

Disable removes only a still-owned status-line key or launcher. Unrelated settings and later user changes are preserved.
The initial Claude settings backup is kept in the sibling `hud/claude-settings.before-hud.json` directory.

## Updating a local Codex candidate from an earlier version

If the old installation enabled the Codex HUD, disable it with that installation's permanent plugin directory before
updating. This removes an unchanged BoxBox-owned launcher and refuses a launcher edited by the user or another tool:

```sh
node '/absolute/old/installed/plugin/scripts/hud/setup.mjs' codex '/absolute/old/installed/plugin' --disable
```

Codex rejects the same marketplace name at a different versioned installation path. After the HUD handoff, replace
the old BoxBox marketplace registration once, then run the new installer with `--hud` when the HUD is wanted:

```powershell
codex.cmd plugin marketplace remove boxbox-plugins
npm.cmd exec --yes --package 'C:\path\to\boxbox-plugin-<version>.tgz' -- boxbox --codex --hud
```

Omit `--hud` on Windows, where the terminal HUD is unsupported, or when updating only the plugin. Claude's owned
status-line state is stored in the stable HUD data directory and can be updated in place; another status line is refused.

Use your installed OpenAI Codex CLI (`codex.cmd` is the standard Windows npm entry). Marketplace replacement is a
manual, non-atomic removal/reinstall operation. The installer does not migrate Codex marketplace sources automatically.

The payload is copied out of npm's temporary cache into permanent, separate host directories before registration:

- Windows: `%LOCALAPPDATA%\BoxBox\Codex\<version>` and `%LOCALAPPDATA%\BoxBox\Claude\<version>`
- macOS/Linux: `$XDG_DATA_HOME/boxbox/<host>/<version>`, or `~/.local/share/boxbox/<host>/<version>` when unset

Each selected host installs the included private `boxbox` engine tarball with `--ignore-scripts --no-audit --no-fund`.
The nested engine never comes from the npm registry. Pinned `typescript@7.0.2` and its native platform dependencies still
need internet access or a primed npm cache. Installed plugins survive npm cache cleanup or deletion of the original
installer tarball. Rerunning the same version repairs shipped files and runtime while preserving other data in that folder.
If repair fails before host registration starts, the previous directory is restored. Once registration may have
changed, a failure retains the new directory, its `.boxbox-install-state.json` phase receipt and any previous backup;
the error prints their exact paths. This prevents a host registration from pointing at a deleted directory. Inspect
the host plugin and marketplace lists before recovery. Rerunning the exact installer deliberately retries a valid
receipt belonging to that same root/version/host; its replacement backup is removed only after verified success. Foreign,
malformed or symlink receipts are refused without replacement. Do not delete retained directories while a host still
references them; after removing the exact registration, restore the printed backup or reinstall. This is partial-state
retention, not an automatic rollback of host settings. Successful retries do not delete backups retained by earlier runs.

For an installer-owned local Claude marketplace, installation checks the exact user-scope plugin identity and
refreshes stale recorded versions with `claude plugin update boxbox@boxbox-plugins --scope user`. Completion requires
the intended marketplace root, version, cached manifest and engine paths to agree. A foreign/shared marketplace or
ambiguous plugin scope is refused. Older installer archives do not gain these checks: use the documented exact plugin
and marketplace removal commands below before reinstalling an older archive for rollback. Restart Claude after a change.

Restart each selected host. In Codex, select the BoxBox `boxbox` skill in the picker; in Claude Code, select the installed
BoxBox skill from its skill list. Name one TypeScript or Python file and request a read-only check first. Review the
three hook definitions in the host before relying on them. Codex skips untrusted plugin hooks: use `/hooks` to review and
explicitly trust their exact current definitions. Claude Code uses its own hook/settings review workflow.

Codex hooks use the documented Windows PowerShell override. Claude hooks use direct `command` plus `args` execution,
including variable expansion of `${CLAUDE_PLUGIN_ROOT}`, avoiding Windows shell parsing. Both adapters inspect changes
without formatting, store receipts in host plugin data, and refuse a hook when the host omits its data directory.
Claude's generated Windows engine commands use a Node bridge that works from Bash or PowerShell and preserves paths and
arguments literally, so no shell switch is needed.
The Claude plugin also includes the canonical read-only inspector; the Codex plugin does not include an agent.
Native Windows execution must still be verified on the destination computer.

The recommended preset includes approved TypeScript top-level single-call variable declarations (2+ rows) and Python
simple name assignments (3+ rows at one indentation). No custom formatter or approval DB is required for those exact
patterns. Other patterns remain read-only until approved. Use `check --json`, `guide --json`, then `format --dry-run`
before an explicit `format` request. Hooks remain read-only.

External formatters are optional. On Windows use a native executable or a Node JS entry point (`node.exe` plus script
and `{file}` arguments). Arbitrary `.cmd`/`.bat` formatters are refused with configuration guidance; BoxBox never
interpolates formatter arguments into a shell. A configured formatter failure never falls back silently to standalone mode.
`boxbox --help` prints usage without installing. `boxbox --engine-only` is for diagnosis: it prepares only the Codex
permanent local engine and skips all host checks and registration. It cannot be combined with host selection flags.

## Remove

Use the same host configuration environment as installation, and remove each installed adapter separately:

```powershell
codex.cmd plugin remove boxbox@boxbox-plugins
codex.cmd plugin marketplace remove boxbox-plugins
claude plugin uninstall boxbox@boxbox-plugins --scope user
claude plugin marketplace remove boxbox-plugins
```

Use `codex` for a native executable. Restart the host. Once its removal succeeds, its version directory above can be
deleted if desired. Keep a marketplace used by other plugins. Project `.boxbox/` approvals and personal data are not
removed. On macOS/Linux use `npx`, `npm exec`, `codex`, `claude`, and the corresponding data directory.

Official contracts: [Codex packaging](https://developers.openai.com/plugins/build/plugins),
[Codex hooks](https://learn.chatgpt.com/docs/hooks), [Claude marketplaces](https://code.claude.com/docs/en/plugin-marketplaces),
and [Claude hooks](https://code.claude.com/docs/en/hooks).

```

### `docs/development/reviews/2026-10-22-artifact-lifecycle-evidence/rel10-claude-transition-diagnosis.md`

```markdown
# REL10 Claude transition diagnosis and minimal repair proposal

Status: **read-only diagnosis; implementation and native update remain unexecuted**. Only scratch evidence was written. No live profile, authentication, model request, hook trust, product source, host registration or failed lifecycle state was changed.

## Measured defect

The exact 0.2.4 installer (`bec626435e…`) returned exit 0 when directly upgrading the existing 0.2.3 fixture in the isolated macOS Claude 2.1.286 cell. The harness correctly failed on the subsequent listed plugin version mismatch; weakening that assertion would hide a real identity inconsistency.

Evidence under `/tmp/boxbox-readiness/rel10-macos-claude-1/`:

- `043.stdout.log`: marketplace add explicitly repoints `boxbox-plugins` from permanent 0.2.3 to permanent 0.2.4. Plugin install then says the plugin is already installed at user scope; it describes local in-place loading and explicitly suggests `claude plugin update boxbox@boxbox-plugins` to re-record version 0.2.3 → 0.2.4. The installer nevertheless prints its generic installed-success message and exits 0.
- `044.stdout.log`: real `plugin list --json` still records version `0.2.3` and `.../plugins/cache/boxbox-plugins/boxbox/0.2.3`.
- `045.stdout.log`: real marketplace list records the new permanent 0.2.4 directory as source/path/installLocation.
- `lifecycle.json`: fresh previous install, cold-cache dependency failure with prior-state preservation, and warm-cache previous repair passed; direct-upgrade acceptance failed before current-version engine assertions.

Read-only filesystem inspection confirms that the listed old cache is a real directory, **not a symlink** to the new plugin. Its actual manifest says 0.2.3 and its `runtime.json` points at the permanent 0.2.3 engine. The permanent new plugin has manifest/runtime 0.2.4. All existing project/approval/user preservation hashes still match.

**Do not overstate this finding:** Claude's command says a directory marketplace loads the new source in place at next session/reload. We did not start a host model session or exercise that loader. The measured defect is inconsistent recorded version/cache versus the current marketplace source, and the installer's unverified success claim. It is not proof that every future session executes only old code.

Raw inspection, help and reduced lifecycle evidence: `/tmp/boxbox-readiness/rel10-claude-transition-inspection.json`. Source/log hashes and preservation confirmation: `/tmp/boxbox-readiness/rel10-claude-transition-hashes.json`.

## Cause in current source

`product/installer/install.mjs:87–90` calls marketplace add and plugin install, treating their zero exits as completion. It never lists the resulting identity/version/source and never invokes Claude's explicit plugin update operation when install is a no-op.

`product/installer/entry.mjs:32–56` separately treats every nonzero child result as a pre-registration failure: it removes the destination and restores any same-version backup. Adding a post-registration update/verification failure without changing this contract could leave a real host registration pointing at a deleted directory. That would be a new defect, not a safe fix.

## Smallest recommended change

Keep the product's host-adapter boundary and its documented manual Codex migration. Limit new host identity/update behavior to Claude, plus a narrowly shared installation-phase handshake needed to avoid deleting registered files.

### Claude preflight and identity completion

1. Before any host mutation, obtain real Claude plugin and marketplace JSON. Verify JSON listing and scoped update support from the selected CLI's help. macOS 2.1.286 `plugin update --help` was measured with the failed cell's isolated environment and supports `--scope`; Windows/Linux 2.1.280 remains a required native compatibility check, not an assumed pass.
2. Reject duplicate target identities, ambiguous scopes and a foreign/shared marketplace before overwriting its source. An existing BoxBox marketplace is accepted only when it is a local directory at the exact target root or a verified previous BoxBox version under the same permanent host/version parent. Verification binds real paths, bundle name/host/marketplace/version, and plugin manifest identity; a matching marketplace name alone is insufficient. If ownership cannot be established, fail with the documented explicit migration guidance. Do not silently update a remote or unrelated source.
3. Register the exact local marketplace and install exact `boxbox@boxbox-plugins` at `--scope user` as today. Re-list the marketplace and require its real source/path/installLocation to match the intended permanent root before any update command.
4. Re-list the plugin. Require exactly one target user-scope record. If its recorded version differs, invoke only `claude plugin update boxbox@boxbox-plugins --scope user`, then re-list. Do not parse human install output to decide success, update all plugins, select an unqualified name, or auto-remove unrelated records.
5. Require target identity, user scope, intended version and usable registered root. Check the registered manifest version and `runtime.json` CLI path against the intended permanent installation, and execute the resolved permanent engine `--version`. A zero exit plus stale recorded version remains failure. If Claude intentionally leaves an old cache while loading in-place, retain that evidence and resolve the explicit contract rather than silently relaxing the gate.
6. Print installation success only after these checks. A fresh/same-version correct registration needs no unnecessary update command.

An isolated, explicitly authorized `plugin update` probe on the retained failed cell should be captured before finalizing assertions about how update changes its cache/installPath. This diagnosis intentionally performed only `plugin update --help`; it does not claim the update operation has already repaired the cell.

### Safe partial-registration handshake

Prefer a parent-created structured phase receipt over a magic child exit code. Host commands may use arbitrary nonzero codes, and abrupt termination may not run a child catch block.

- `entry.installHost` creates a fresh owned transaction directory beside the version directories and a private JSON receipt before spawning the copied installer. Bind schema version, random transaction ID, exact destination real path, package name/version and host. Initial phase is `prepared`. Pass only this transaction's receipt path/ID to the child through an internal environment variable; do not trust an inherited external receipt path.
- The child validates those bindings, then atomically records `host-registration-started` **before the first host mutation**. It records `verified` only after all intended registration checks finish (or after successful engine-only completion, which has no registration mutation).
- On child failure with a valid `prepared` receipt, retain the current pre-registration failure behavior: restore the previous same-version backup or remove a fresh partial destination. This preserves existing dependency-install failure safety.
- On failure/signal after `host-registration-started`, or on missing/malformed/mismatched phase evidence where pre-mutation failure cannot be established, retain the destination, receipt and any prior backup. Return failure with exact retained paths and a partial-state/recovery message. Do not claim host rollback or restore/delete files underneath a possibly changed host registration.
- A zero child exit without a valid `verified` receipt is not verified installation success. Successful completion can clean its own backup/receipt with existing cleanup-failure reporting. Never delete another transaction directory or automatically undo global host state.

This handshake is intentionally not a global installer transaction. It identifies when filesystem rollback is safe and preserves recovery material when host mutation may already have happened. A failed cross-host batch may leave an earlier host successfully installed; report that accurately as today. HUD setup remains outside this core change.

## Required regression and native proof

Focused source/artifact tests should distinguish these cases:

- Fresh Claude install and already-correct same-version repair verify without update.
- Install returns zero with old listed version: one exact scoped update is issued; new identity/path/engine are required afterward.
- Update returns zero but the listed version/root/runtime remains wrong: fail, no success message.
- Duplicate record, another scope, foreign remote/local marketplace, shared marketplace and malformed list output: fail before update/mutation as applicable.
- **Fail after marketplace registration:** host points at the new root, update or final check fails; destination and same-version backup remain byte-accessible, sentinel data is retained, receipt is bound to the failing transaction, and the installer returns a partial-state failure. This must not merely assert a log message.
- **Fail before registration:** dependency install fails; existing destination and its extra user file are restored exactly as before. A forged/foreign/mismatched receipt must not authorize destructive cleanup.
- A real new exact installer candidate must repeat the complete macOS/Windows/Linux host cells after review, including the supported Claude 2.1.280 surface. Historical 0.2.3 rollback uses its frozen old installer and cannot acquire the new behavior retroactively; if that old installer returns stale metadata, use and document the explicit host removal/reinstall recovery rather than rewriting its artifact or declaring its direct transition successful.

Expected implementation surface, subject to parent ownership approval: `product/installer/install.mjs`, `product/installer/entry.mjs`, narrowly necessary installer tests, and a shared helper/build-copy entry only if the phase/identity logic warrants it. Installer README may need a precise retained-partial-state explanation after behavior is implemented; no documentation or runtime source was edited in this diagnosis.

```
