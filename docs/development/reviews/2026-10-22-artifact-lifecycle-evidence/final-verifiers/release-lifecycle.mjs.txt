#!/usr/bin/env node
import assert from "node:assert/strict";
import      { spawnSync                                } from "node:child_process" ;
import      { createHash                               } from "node:crypto"        ;
import      {
              cpSync                                 ,
              existsSync                             ,
              lstatSync                              ,
              mkdirSync                              ,
              mkdtempSync                            ,
              readFileSync                           ,
              readdirSync                            ,
              readlinkSync                           ,
              realpathSync                           ,
              writeFileSync                          ,
                                                       } from "node:fs"            ;
import      { isAbsolute, join, relative, resolve, sep } from "node:path"          ;
import      { fileURLToPath, pathToFileURL             } from "node:url"           ;

export const ARTIFACTS = Object.freeze({
	previous: { version: "0.2.3", sha256: "f07df7ada9aa234c2935ed500b4fe15b1a5d53f7b7a6de7d8ec107f53c8f572c", provenance: "Historical uncommitted candidate fixture; not an approved or published release." },
	current: { version: "0.2.4", sha256: "bec626435e525c2d7324d156f85d2c114427d875725abcecb42fed561b2b92be", provenance: "CI 39637622755 attempt 1; source 35b61780ae122744f39d9cb0b935db5f8bccd14b; unpublished candidate." },
});
const PLUGIN      = "boxbox@boxbox-plugins"                                                                                                                                                                  ;
const MARKETPLACE = "boxbox-plugins"                                                                                                                                                                         ;
const USAGE       = "node release-lifecycle.mjs --host codex|claude --previous <0.2.3.tgz> --current <0.2.4.tgz> --output <new-directory> [--current-sha256 <digest>] [--manual-rollback] [--current-again]" ;
const digest      = bytes => createHash("sha256").update(bytes).digest("hex")                                                                                ;
const json        = path => JSON.parse(readFileSync(path, "utf8"))                                                                                           ;

export function parseArguments(args) {
	const result = { currentAgain: false, manualRollback: false };
	for (let index = 0; index < args.length; index += 1) {
		const flag = args[index];
		if (flag === "--current-again" && !result.currentAgain) result.currentAgain = true;
		else if (flag === "--manual-rollback" && !result.manualRollback) result.manualRollback = true;
		else {
			assert.ok(["--host", "--previous", "--current", "--output", "--current-sha256"].includes(flag), USAGE);
			const key = flag === "--current-sha256" ? "currentSha256" : flag.slice(2);
			assert.ok(result[key] === undefined && args[index + 1] && !args[index + 1].startsWith("--"), USAGE);
			result[key] = args[++index];
		}
	}
	assert.ok(["codex", "claude"].includes(result.host), USAGE);
	for (const key of ["previous", "current", "output"]) {
		assert.equal(typeof result[key], "string", USAGE);
		result[key] = resolve(result[key]);
	}
	assert.notEqual(result.previous, result.current, "Lifecycle needs two distinct archives");
	expectedArtifact("current", result.currentSha256);
	return result;
}

/** An explicit digest binds a new unpublished candidate; it does not establish CI or clean-source provenance. */
export function expectedArtifact(role, currentSha256) {
	assert.ok(Object.hasOwn(ARTIFACTS, role), "Unknown artifact role");
	if (currentSha256 !== undefined) assert.match(currentSha256, /^[a-f0-9]{64}$/u, "Candidate digest must be 64 lowercase hexadecimal characters");
	if (role !== "current" || currentSha256 === undefined) return ARTIFACTS[role];
	return { ...ARTIFACTS.current, sha256: currentSha256, provenance: "Explicit caller-bound unpublished 0.2.4 candidate; source/build provenance must be recorded separately." };
}

/** The historical archive has no clean-build claim; only these exact bytes may be used. */
export function verifyArchive(path, expected) {
	const stat = lstatSync(path);
	assert.ok(stat.isFile() && !stat.isSymbolicLink(), "Installer archive must be a regular non-symlink file");
	assert.equal(digest(readFileSync(path)), expected.sha256, `Archive digest differs: ${path}`);
	return { path, bytes: stat.size, ...expected };
}

/** Inherit executable discovery and OS essentials only, never credentials, host overrides or npm configuration. */
export function isolatedEnvironment(root, inherited = process.env) {
	assert.ok(isAbsolute(root), "Isolated profile root must be absolute");
	const environment = {};
	for (const [key, value] of Object.entries(inherited)) {
		if (/^(PATH|SYSTEMROOT|WINDIR|COMSPEC|PATHEXT|PROGRAMFILES|PROGRAMFILES\(X86\)|PROGRAMW6432|PROGRAMDATA|LANG|LC_ALL|TZ)$/iu.test(key)) environment[key] = value;
	}
	Object.assign(environment, {
		HOME                 : join(root, "home"), USERPROFILE: join(root, "home")                                ,
		XDG_DATA_HOME        : join(root, "data"), XDG_CONFIG_HOME: join(root, "config")                          ,
		XDG_CACHE_HOME       : join(root, "cache"), XDG_STATE_HOME: join(root, "state")                           ,
		LOCALAPPDATA         : join(root, "local"), APPDATA: join(root, "appdata")                                ,
		CODEX_HOME           : join(root, "codex"), CLAUDE_CONFIG_DIR: join(root, "claude")                       ,
		TMPDIR               : join(root, "tmp"), TMP: join(root, "tmp"), TEMP: join(root, "tmp")                 ,
		npm_config_cache     : join(root, "npm-cache"), npm_config_prefix: join(root, "npm-prefix")               ,
		npm_config_userconfig: join(root, "npm-user.conf"), npm_config_globalconfig: join(root, "npm-global.conf"),
		NO_COLOR             : "1", CI: "1"                                                                       ,
	});
	return environment;
}

function inside(root, path) {
	const local = relative(realpathSync(root), realpathSync(path));
	assert.ok(local !== ".." && !local.startsWith(`..${sep}`) && !isAbsolute(local), `Path is outside the owned workspace: ${path}`);
	return path;
}

export function hostPath(path, platform = process.platform) {
	assert.equal(typeof path, "string", "Host JSON lacks an expected source path");
	if (platform !== "win32" || !path.startsWith("\\\\?\\")) return path;
	assert.match(path.slice(4), /^[a-z]:\\/iu, "Unsupported Windows extended host path");
	return path.slice(4);
}

function samePath(actual, expected) {
	assert.equal(realpathSync(hostPath(actual)), realpathSync(hostPath(expected)), "Host points to a different installation");
}

/** Explicit host schemas only. Unexpected CLI JSON is a retained failure, never a guessed success. */
export function hostRecords(host, plugins, marketplaces) {
	assert.ok(["codex", "claude"].includes(host), "Unsupported host");
	const installed = host === "codex" ? plugins.installed : plugins              ;
	const markets   = host === "codex" ? marketplaces.marketplaces : marketplaces ;
	assert.ok(Array.isArray(installed) && Array.isArray(markets), "Unsupported host plugin-list JSON schema");
	const id = record => host === "codex" ? record.pluginId : record.id;
	assert.ok(installed.every(record => typeof id(record) === "string"), "Host plugin list omitted an identity");
	assert.ok(markets.every(record => typeof record.name === "string"), "Host marketplace list omitted a name");
	const selected        = installed.filter(record => id(record) === PLUGIN      ) ;
	const selectedMarkets = markets  .filter(record => record.name === MARKETPLACE) ;
	assert.ok(selected.length <= 1 && selectedMarkets.length <= 1, "Duplicate BoxBox registration");
	assert.ok(installed.every(record => id(record) === PLUGIN), "An unrelated plugin appeared in the isolated profile");
	assert.ok(markets.every(record => record.name === MARKETPLACE), "An unrelated marketplace appeared in the isolated profile");
	return { plugin: selected[0], marketplace: selectedMarkets[0] };
}

export function isMarketplaceCollision(output) {
	return output.split(/\r?\n/u).some(line => line.includes(MARKETPLACE)
		&& /marketplace/iu.test(line)
		&& /\balready (?:exists|added|registered|installed)\b|\bdifferent (?:source|path)\b|\bduplicate\b/iu.test(line));
}

/** Codex 0.157.1 omits repeated marketplace provenance; plugin-level provenance is still required separately. */
export function codexMarketplaceSource(marketplace, hostVersion) {
	if (marketplace.marketplaceSource !== undefined) {
		assert.equal(typeof marketplace.marketplaceSource.source, "string", "Marketplace provenance omitted its source");
		return marketplace.marketplaceSource.source;
	}
	assert.equal(hostVersion, "codex-cli 0.157.1", "Unknown Codex marketplace schema without provenance");
	assert.deepEqual(Object.keys(marketplace).sort(), ["name", "root"], "Unexpected legacy Codex marketplace schema");
	assert.equal(typeof marketplace.root, "string", "Legacy marketplace omitted its root");
	return marketplace.root;
}

function inventory(root, prefix = "") {
	return readdirSync(join(root, prefix)).sort().flatMap(name => {
		const path = join     (prefix, name    ) ;
		const stat = lstatSync(join(root, path)) ;
		if (stat.isSymbolicLink()) return [{ path, kind: "symlink", target: readlinkSync(join(root, path)) }];
		if (stat.isDirectory()) return [{ path, kind: "directory" }, ...inventory(root, path)];
		return [{ path, kind: "file", bytes: stat.size }];
	});
}

/** Explicit opt-in runner. Importing this module never installs a host or runs a command. */
export async function lifecycle(options) {
	assert.ok(["codex", "claude"].includes(options.host), "Select exactly one real host");
	assert.ok(!existsSync(options.output), "Output must be a new task-owned directory; existing runs are never reused");
	mkdirSync(options.output);
	const workspace   = mkdtempSync        (join(options.output, "workspace-")) ;
	const project     = join               (workspace, "project"              ) ;
	const environment = isolatedEnvironment(join(workspace, "profile")        ) ;
	const reportFile  = join               (options.output, "lifecycle.json"  ) ;
	const report = {
		schemaVersion: 1, ok: false, host: options.host, platform: process.platform, arch: process.arch                                                                                                                                                                                                                                                                                                  ,
		node         : process.version, workspace, project, harnessSha256: digest(readFileSync(fileURLToPath(import.meta.url)))                                                                                                                                                                                                                                                                          ,
		startedAt    : new Date().toISOString(), artifacts: {}, artifactChecks: [], commands: [], steps: [], preservationChecks: []                                                                                                                                                                                                                                                                      ,
		limitations  : ["Real host registration/discovery and installed engine behavior only; no model, hooks, trust, authentication or HUD acceptance.", "Version directories are intentionally retained. Host unregistration is not a product filesystem uninstaller.", "npm_config_offline tests dependency-cache behavior only, not whole-process network isolation.", ARTIFACTS.previous.provenance],
	};
	const save = () => writeFileSync(reportFile, JSON.stringify(report, null, 2) + "\n");
	const run = (label, command, args, statuses = [0], overrides = {}) => {
		const number = report.commands.length + 1                                                                                                                                                        ;
		const record = { label, executable: command.executable, args: [...command.args, ...args], cwd: project, environmentOverrides: overrides, startedAt: new Date().toISOString(), state: "running" } ;
		report.commands.push(record);
		save();
		const started = Date.now ()                                                                                                                                                                                                                                                    ;
		const child   = spawnSync(command.executable, record.args, { cwd: project, env: { ...environment, ...overrides }, encoding: "utf8", shell: false, windowsHide: true, timeout: 180_000, killSignal: "SIGKILL", maxBuffer: 8 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }) ;
		record.stdout = `${String(number).padStart(3, "0")}.stdout.log`;
		record.stderr = `${String(number).padStart(3, "0")}.stderr.log`;
		writeFileSync(join(options.output, record.stdout), child.stdout ?? "");
		writeFileSync(join(options.output, record.stderr), child.stderr ?? "");
		Object.assign(record, { pid: child.pid, durationMs: Date.now() - started, exitCode: child.status, signal: child.signal, error: child.error?.message, state: child.error || child.signal || (statuses !== null && !statuses.includes(child.status)) ? "failed" : statuses === null ? "observed" : "passed" });
		save();
		assert.notEqual(record.state, "failed", `Command failed: ${label}; retain ${options.output} (no automatic cleanup/retry)`);
		return child.stdout.trim();
	};
	const preserved = new Map() ;
	const roots     = {}        ;
	const boundArchive = (role, stage) => {
		const verified = verifyArchive(options[role], expectedArtifact(role, options.currentSha256));
		report.artifactChecks.push({ role, stage, sha256: verified.sha256, at: new Date().toISOString() });
		return verified;
	};
	const remember = path => { preserved.set(path, digest(readFileSync(path))); };
	const checkPreserved = () => {
		for (const [path, hash] of preserved) assert.equal(digest(readFileSync(path)), hash, `Preserved bytes changed: ${path}`);
		if (options.host === "claude") {
			assert.equal(json(join(environment.CLAUDE_CONFIG_DIR, "settings.json")).env.BOXBOX_REL10_PRESERVED, "unrelated-user-setting");
		} else {
			const top = readFileSync(join(environment.CODEX_HOME, "config.toml"), "utf8").split(/^\s*\[/mu)[0];
			assert.equal(top.match(/^\s*hide_agent_reasoning\s*=\s*(true|false)\s*(?:#.*)?$/gmu)?.length, 1, "Missing or duplicate unrelated Codex setting");
			assert.match(top, /^\s*hide_agent_reasoning\s*=\s*true\s*(?:#.*)?$/mu, "Unrelated Codex setting changed");
		}
		report.preservationChecks.push({ afterCommand: report.commands.at(-1)?.label, files: preserved.size, hostSettingPreserved: true });
	};
	try {
		for (const role of ["previous", "current"]) report.artifacts[role] = boundArchive(role, "pre-execution");
		save();
		for (const [key, path] of Object.entries(environment)) {
			if (path.startsWith(workspace) && !key.endsWith("config")) mkdirSync(path, { recursive: true });
		}
		for (const key of ["npm_config_userconfig", "npm_config_globalconfig"]) writeFileSync(environment[key], "", { flag: "wx" });
		mkdirSync(project);
		if (options.host === "claude") writeFileSync(join(environment.CLAUDE_CONFIG_DIR, "settings.json"), '{"env":{"BOXBOX_REL10_PRESERVED":"unrelated-user-setting"}}\n', { flag: "wx" });
		else writeFileSync(join(environment.CODEX_HOME, "config.toml"), "hide_agent_reasoning = true\n", { flag: "wx" });

		const packages = {};
		for (const role of ["previous", "current"]) {
			const staging = join(workspace, role);
			mkdirSync(staging);
			run(`extract-${role}`, { executable: "tar", args: [] }, ["-xzf", options[role], "-C", staging]);
			packages[role] = join(staging, "package");
			const manifest = json(join(packages[role], "package.json"));
			assert.equal(manifest.name, "boxbox-plugin");
			assert.equal(manifest.version, ARTIFACTS[role].version);
		}
		// Load platform resolution only from the independently hash-verified exact current artifact.
		const platform = await import(pathToFileURL(join(packages.current, "payload/platform.mjs")).href);
		assert.ok(platform.supportedNode(process.versions.node), "Node >=22.22.3 is required");
		const searchPath = Object.entries(environment).find(([key]) => key.toLowerCase() === "path")?.[1];
		assert.ok(searchPath, "PATH is required to discover real host and npm executables");
		const host = platform.findCommand(options.host, { path: searchPath, probe: (exe, args, probeOptions) => {
			const started = Date.now()                                                                ;
			const child   = spawnSync(exe, args, { ...probeOptions, env: environment, cwd: project }) ;
			const number  = report.commands.length + 1                                                ;
			const stdout  = `${String(number).padStart(3, "0")}.stdout.log`                           ;
			const stderr  = `${String(number).padStart(3, "0")}.stderr.log`                           ;
			writeFileSync(join(options.output, stdout), child.stdout ?? "");
			writeFileSync(join(options.output, stderr), child.stderr ?? "");
			report.commands.push({ label: "native-codex-identification-probe", executable: exe, args, cwd: project, pid: child.pid, durationMs: Date.now() - started, exitCode: child.status, signal: child.signal, error: child.error?.message, state: "probe", stdout, stderr });
			save();
			return child;
		} });
		const npm = platform.findCommand("npm", { path: searchPath });
		assert.ok(host && npm, "Real selected host CLI and npm must be installed on PATH");
		report.hostVersion = run("host-version", host, ["--version"]);
		report.npmVersion = run("npm-version", npm, ["--version"]);
		run("plugin-help", host, ["plugin", "--help"]);
		for (const args of [["plugin", "list", "--help"], ["plugin", "marketplace", "list", "--help"]]) assert.match(run("list-help", host, args), /--json\b/u, "Installed host does not advertise JSON listing");
		const remove = options.host === "codex" ? ["plugin", "remove", PLUGIN] : ["plugin", "uninstall", PLUGIN, "--scope", "user"];
		run("remove-help", host, ["plugin", options.host === "codex" ? "remove" : "uninstall", "--help"]);
		run("marketplace-remove-help", host, ["plugin", "marketplace", "remove", "--help"]);
		const node = { executable: process.execPath, args: [] };
		Object.assign(roots, Object.fromEntries(Object.entries(ARTIFACTS).map(([role, artifact]) => [role, platform.installationRoot(artifact.version, options.host, { environment, home: environment.HOME })])));
		const list = label => hostRecords(options.host, JSON.parse(run(`${label}-plugins`, host, ["plugin", "list", "--json"])), JSON.parse(run(`${label}-marketplaces`, host, ["plugin", "marketplace", "list", "--json"])));
		const absent = label => {
			const state = list(label);
			assert.equal(state.plugin, undefined, "BoxBox remains registered");
			assert.equal(state.marketplace, undefined, "BoxBox marketplace remains registered");
			checkPreserved();
		};
		const registered = (label, role) => {
			const state = list(label);
			assert.ok(state.plugin && state.marketplace, "Host did not register BoxBox and its marketplace");
			assert.equal(state.plugin.version, ARTIFACTS[role].version, "Host retained the wrong plugin version");
			assert.equal(state.plugin.enabled, true, "Plugin is not enabled");
			let pluginRoot;
			if (options.host === "codex") {
				assert.equal(state.plugin.installed, true);
				assert.equal(state.plugin.source?.source, "local");
				assert.equal(state.plugin.marketplaceSource?.sourceType, "local");
				samePath(state.marketplace.root, roots[role]);
				samePath(codexMarketplaceSource(state.marketplace, report.hostVersion), roots[role]);
				samePath(state.plugin.marketplaceSource?.source, roots[role]);
				pluginRoot = state.plugin.source?.path;
				samePath(pluginRoot, join(roots[role], "plugin"));
			} else {
				assert.equal(state.plugin.scope, "user");
				assert.equal(state.marketplace.source, "directory", "Expected local directory marketplace");
				samePath(state.marketplace.path, roots[role]);
				samePath(state.marketplace.installLocation, roots[role]);
				pluginRoot = state.plugin.installPath;
			}
			inside(workspace, pluginRoot);
			const manifest = json(join(pluginRoot, options.host === "codex" ? ".codex-plugin/plugin.json" : ".claude-plugin/plugin.json"));
			assert.equal(manifest.version, ARTIFACTS[role].version);
			const runtime = json(join(pluginRoot, "runtime.json"));
			samePath(runtime.cli, join(roots[role], "runtime/node_modules/boxbox/dist/cli.js"));
			checkPreserved();
			return pluginRoot;
		};
		const engine = (label, role, initialize) => {
			const launcher = join(roots[role], "plugin/scripts/boxbox.mjs");
			assert.equal(run(`${label}-engine-version`, node, [launcher, "--version"]), ARTIFACTS[role].version);
			const cli = (args, statuses = [0]) => JSON.parse(run(`${label}-${args[0]}`, node, [launcher, ...args, "--json"], statuses));
			if (initialize) cli(["init"]);
			const doctor = cli(["doctor"]);
			assert.equal(doctor.runtimeUsable, true);
			assert.equal(doctor.formatConfigured, true);
			assert.equal(doctor.releaseReady, false);
			const path     = join(project, "calls.ts")                                                                          ;
			const before   = "const short = make(1);\nconst muchLonger = make(22);\nconst middle = make(333);\n"                ;
			const expected = "const short      = make(1  ) ;\nconst muchLonger = make(22 ) ;\nconst middle     = make(333) ;\n" ;
			writeFileSync(path, before);
			const checked = cli(["check", "--file", "calls.ts"], [1]);
			assert.ok(checked.results[0].summary.misaligned > 0);
			assert.equal(checked.formatReadiness.approvalEligible, true);
			const preview = cli(["format", "--file", "calls.ts", "--dry-run"]);
			assert.equal(preview.written, false);
			assert.equal(readFileSync(path, "utf8"), before);
			const applied = cli(["format", "--file", "calls.ts"]);
			assert.equal(applied.written, true);
			assert.equal(applied.safety.parserChecked, true);
			assert.equal(applied.safety.approvalChecked, true);
			assert.equal(readFileSync(path, "utf8"), expected);
			assert.equal(cli(["check", "--file", "calls.ts"]).results[0].summary.misaligned, 0);
			assert.equal(cli(["format", "--file", "calls.ts"]).written, false);
			assert.equal(readFileSync(path, "utf8"), expected);
			checkPreserved();
		};
		const acceptInstalled = (label, role, initialize = false) => {
			const registeredRoot = registered(label, role);
			engine(label, role, initialize);
			const sentinel = join(roots[role], "rel10-user-file.txt");
			if (!preserved.has(sentinel)) {
				writeFileSync(sentinel, `User-owned file retained across lifecycle ${ARTIFACTS[role].version}\n`, { flag: "wx" });
				remember(sentinel);
			}
			report.steps.push({ label, ok: true, version: ARTIFACTS[role].version, installation: roots[role], registeredRoot });
			save();
		};
		const installerArgs = role => ["exec", "--yes", "--package", options[role], "--", "boxbox", `--${options.host}`];
		const install = (label, role, initialize = false, overrides = {}) => {
			boundArchive(role, label);
			run(`${label}-install`, npm, installerArgs(role), [0], overrides);
			acceptInstalled(label, role, initialize);
		};
		const unregister = label => {
			const state = list(`${label}-before`);
			assert.ok(state.plugin && state.marketplace, "Expected owned registration before removal");
			run(`${label}-plugin`, host, remove);
			run(`${label}-marketplace`, host, ["plugin", "marketplace", "remove", MARKETPLACE]);
			absent(`${label}-after`);
			report.steps.push({ label, ok: true, registrationRemoved: true, filesystemRemoval: false });
			save();
		};

		const transition = (label, from, to) => {
			boundArchive(to, label);
			run(`${label}-direct-attempt`, npm, installerArgs(to), null);
			const attempt = report.commands.at(-1);
			if (attempt.exitCode === 0) {
				// A successful command must actually switch the version, not merely return zero.
				acceptInstalled(`${label}-direct-accepted`, to);
				engine(`${label}-prior-engine-retained`, from);
				report.steps.push({ label, directTransition: "accepted", priorEngineUsable: true });
			} else {
				const output = readFileSync(join(options.output, attempt.stdout), "utf8") + readFileSync(join(options.output, attempt.stderr), "utf8");
				assert.ok(isMarketplaceCollision(output), "Unrecognized direct-transition failure; do not modify registration");
				registered(`${label}-collision-retained`, from);
				engine(`${label}-collision-prior-engine`, from);
				report.steps.push({ label, directTransition: "marketplace-collision", priorRegistrationAndEnginePreserved: true });
				unregister(`${label}-documented-remove`);
				install(`${label}-documented-install`, to);
			}
			save();
		};

		absent("initial");
		install("fresh-previous", "previous", true);
		remember(join(project, ".boxbox/config.json"));
		// Preserve actual shipped approval bytes as an inactive user archive; never invent a new approval.
		const proof = join(project, ".boxbox/retained-approved-fixture");
		cpSync(join(roots.previous, "runtime/node_modules/boxbox/rules/presets/recommended"), proof, { recursive: true, errorOnExist: true, force: false });
		for (const item of inventory(proof)) if (item.kind === "file") remember(join(proof, item.path));
		const note = join(project, ".boxbox/user-note.txt");
		writeFileSync(note, "Project data belongs to the user; registration removal must retain it.\n", { flag: "wx" });
		remember(note);
		const coldCache = join(workspace, "cold-offline-npm-cache");
		mkdirSync(coldCache);
		assert.equal(readdirSync(coldCache).length, 0);
		boundArchive("current", "cold-cache-offline");
		run("cold-cache-current-offline", npm, installerArgs("current"), null, { npm_config_cache: coldCache, npm_config_offline: "true" });
		const cold = report.commands.at(-1);
		assert.notEqual(cold.exitCode, 0, "Cold-cache offline install unexpectedly succeeded");
		const coldOutput = readFileSync(join(options.output, cold.stdout), "utf8") + readFileSync(join(options.output, cold.stderr), "utf8");
		assert.match(coldOutput, /ENOTCACHED/u, "Expected a real npm offline cache miss");
		assert.match(coldOutput, /typescript/iu, "Expected bundled engine dependency failure, not an unrelated installer error");
		assert.ok(!existsSync(roots.current), "Failed cold-cache install left a partial current version directory");
		registered("cold-offline-retained", "previous");
		engine("cold-offline-prior-engine", "previous");
		report.steps.push({ label: "cold-cache-offline", ok: true, expectedFailure: "ENOTCACHED", priorRegistrationAndEnginePreserved: true, dependencyOfflineOnly: true });
		install("warm-cache-previous-repair", "previous", false, { npm_config_offline: "true" });
		transition("upgrade", "previous", "current");
		install("warm-cache-current-repair", "current", false, { npm_config_offline: "true" });
		if (options.manualRollback) {
			registered("manual-rollback-prior", "current");
			unregister("manual-rollback-remove");
			install("manual-rollback-install", "previous");
			report.steps.push({ label: "rollback", directTransition: "not-attempted", manualRemovalRequested: true, atomic: false });
		} else transition("rollback", "current", "previous");
		if (options.currentAgain) {
			unregister("before-current-again");
			install("current-again", "current");
		}
		unregister("final-remove");
		for (const role of ["previous", "current"]) boundArchive(role, "final");
		checkPreserved();
		report.preserved = [...preserved].map(([path, sha256]) => ({ path, sha256 }));
		for (const path of Object.values(roots)) assert.ok(existsSync(path), "Permanent version residue was unexpectedly removed");
		report.ok = true;
		return report;
	} catch (error) {
		report.error = error instanceof Error ? error.stack : String(error);
		throw error;
	} finally {
		report.finishedAt = new Date().toISOString()                                                                                                                     ;
		report.residue    = Object.entries(roots).map(([role, path]) => ({ role, path, present: existsSync(path), inventory: existsSync(path) ? inventory(path) : [] })) ;
		report.preserved  = [...preserved].map(([path, sha256]) => ({ path, sha256 }))                                                                                   ;
		save();
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	if (process.argv.length === 3 && process.argv[2] === "--help") console.log(USAGE);
	else {
		try {
			const result = await lifecycle(parseArguments(process.argv.slice(2)));
			console.log(JSON.stringify({ ok: result.ok, workspace: result.workspace, host: result.host, steps: result.steps }, null, 2));
		} catch (error) {
			console.error(error instanceof Error ? error.message : String(error));
			process.exitCode = 1;
		}
	}
}
