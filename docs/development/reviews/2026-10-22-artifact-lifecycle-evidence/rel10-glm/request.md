# Read-only static audit request: REL10 artifact lifecycle verifier

Return exactly one concise final review, at most 1200 words, ending with `VERDICT: PASS` or `VERDICT: FIX_REQUIRED`.

You are auditing a frozen, development-only release lifecycle verifier, its focused tests, and its proposal. Do not execute tools, request tools, modify files, grant product approval, or infer that native cells passed. This is source-only review. Real macOS/Windows/Linux lifecycle cells are underway and are explicitly outside this static audit.

## Required review scope

Find only concrete release-safety defects in these areas:

1. Scope isolation and authorization: no inherited credentials, host homes, caches, configuration overrides, or unrelated registrations; exact input archives and digests; fail closed on ambiguity.
2. Real host/version acceptance: prove registrations point to the expected version/root and host schemas; reject duplicate/foreign entries without deleting unrelated user state.
3. Cold and warm offline recovery: cold current install must fail safely without corrupting the old install; warm caches must repair both pinned versions deterministically.
4. Manual transition and rollback: direct collision refusal, narrowly recognized manual removal, exact switch, rollback, and final removal behavior.
5. User preservation and residue: fixture/project/user bytes remain exact; removal residue is inventoried honestly; no claim of filesystem uninstallation.
6. Test adequacy for static contracts and dangerous negative paths. Do not demand that unit tests simulate the real native cells described in the proposal.

For every mandatory finding, provide: severity, exact file and function or line, a concrete execution trace or reproduction, the violated invariant and impact, and the smallest correction. Put non-blocking observations in a separate optional section. Do not suggest broad style refactors, new features, approval changes, or product-runtime changes.

## Frozen evidence and limits

The independent read-only pass recorded `PASS (pre-native gate)` with no mandatory source finding, 6 focused tests / 56 assertions, syntax/help/hash/diff checks passing. Treat that only as supplied evidence, not authority. Native lifecycle cells remained unexecuted at that point.

Frozen SHA-256:
- `development/tools/release-lifecycle.mjs`: `1b8a197be252133fb5792194d74f80e43a227c8feb747dc8a69998afb0a4ef49`
- `test/release-lifecycle.test.ts`: `d0c451acde4770a32463af8c6756f2e261d05a90e2f0f7c60204ba498252da04`
- `docs/development/proposals/2026-10-22-artifact-lifecycle.md`: `d5caa444445609680636817a31cc9213a9f8b7f028d1b3687ac5a1018a4c5d2f`

Pinned archive facts stated by the frozen source:
- 0.2.3 archive SHA-256 `f07df7ada9aa234c2935ed500b4fe15b1a5d53f7b7a6de7d8ec107f53c8f572c`
- 0.2.4 CI candidate SHA-256 `bec626435e525c2d7324d156f85d2c114427d875725abcecb42fed561b2b92be`

## Complete audited files

### `development/tools/release-lifecycle.mjs`

```javascript
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
const PLUGIN      = "boxbox@boxbox-plugins"                                                                                                                  ;
const MARKETPLACE = "boxbox-plugins"                                                                                                                         ;
const USAGE       = "node release-lifecycle.mjs --host codex|claude --previous <0.2.3.tgz> --current <0.2.4.tgz> --output <new-directory> [--current-again]" ;
const digest      = bytes => createHash("sha256").update(bytes).digest("hex")                                                                                ;
const json        = path => JSON.parse(readFileSync(path, "utf8"))                                                                                           ;

export function parseArguments(args) {
	const result = { currentAgain: false };
	for (let index = 0; index < args.length; index += 1) {
		const flag = args[index];
		if (flag === "--current-again" && !result.currentAgain) result.currentAgain = true;
		else {
			assert.ok(["--host", "--previous", "--current", "--output"].includes(flag), USAGE);
			const key = flag.slice(2);
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
	return result;
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
		HOME: join(root, "home"), USERPROFILE: join(root, "home"),
		XDG_DATA_HOME: join(root, "data"), XDG_CONFIG_HOME: join(root, "config"),
		XDG_CACHE_HOME: join(root, "cache"), XDG_STATE_HOME: join(root, "state"),
		LOCALAPPDATA: join(root, "local"), APPDATA: join(root, "appdata"),
		CODEX_HOME: join(root, "codex"), CLAUDE_CONFIG_DIR: join(root, "claude"),
		TMPDIR: join(root, "tmp"), TMP: join(root, "tmp"), TEMP: join(root, "tmp"),
		npm_config_cache: join(root, "npm-cache"), npm_config_prefix: join(root, "npm-prefix"),
		npm_config_userconfig: join(root, "npm-user.conf"), npm_config_globalconfig: join(root, "npm-global.conf"),
		NO_COLOR: "1", CI: "1",
	});
	return environment;
}

function inside(root, path) {
	const local = relative(realpathSync(root), realpathSync(path));
	assert.ok(local !== ".." && !local.startsWith(`..${sep}`) && !isAbsolute(local), `Path is outside the owned workspace: ${path}`);
	return path;
}

function samePath(actual, expected) {
	assert.equal(typeof actual, "string", "Host JSON lacks an expected source path");
	assert.equal(realpathSync(actual), realpathSync(expected), "Host points to a different installation");
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
		schemaVersion: 1, ok: false, host: options.host, platform: process.platform, arch: process.arch,
		node: process.version, workspace, project, harnessSha256: digest(readFileSync(fileURLToPath(import.meta.url))),
		startedAt: new Date().toISOString(), artifacts: {}, artifactChecks: [], commands: [], steps: [], preservationChecks: [],
		limitations: ["Real host registration/discovery and installed engine behavior only; no model, hooks, trust, authentication or HUD acceptance.", "Version directories are intentionally retained. Host unregistration is not a product filesystem uninstaller.", "npm_config_offline tests dependency-cache behavior only, not whole-process network isolation.", ARTIFACTS.previous.provenance],
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
		const verified = verifyArchive(options[role], ARTIFACTS[role]);
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
				samePath(state.marketplace.marketplaceSource?.source, roots[role]);
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
		transition("rollback", "current", "previous");
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

```

### `test/release-lifecycle.test.ts`

```typescript
import      { afterEach, expect, test } from "bun:test"    ;
import      { createHash              } from "node:crypto" ;
import      {
              existsSync            ,
              mkdtempSync           ,
              readFileSync          ,
              rmSync                ,
              symlinkSync           ,
              writeFileSync         ,
                                      } from "node:fs"     ;
import      { tmpdir                  } from "node:os"     ;
import      { join, resolve           } from "node:path"   ;

const harness         = await import(join(import.meta.dir, "../development/tools/release-lifecycle.mjs")) ;
const roots: string[] = []                                                                                ;

function temporary(): string {
	const root = mkdtempSync(join(tmpdir(), "boxbox-lifecycle-unit-"));
	roots.push(root);
	return root;
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test("lifecycle arguments require a single explicit host, exact archives and a new output location", () => {
	const args   = ["--host", "codex", "--previous", "old.tgz", "--current", "new.tgz", "--output", "evidence"] ;
	const result = harness.parseArguments([...args, "--current-again"])                                         ;

	expect(result).toEqual({ host: "codex", previous: resolve("old.tgz"), current: resolve("new.tgz"), output: resolve("evidence"), currentAgain: true });
	for (const invalid of [[], [...args, "--hud"], [...args, "--host", "claude"], [...args, "--current-again", "--current-again"], args.map(value => value === "codex" ? "all" : value), args.map(value => value === "new.tgz" ? "old.tgz" : value)]) {
		expect(() => harness.parseArguments(invalid)).toThrow();
	}
});

test("isolated subprocesses inherit executable discovery but never authentication or host and npm overrides", () => {
	const root = temporary();
	const isolated = harness.isolatedEnvironment(root, {
		Path: "native-executable-search", SystemRoot: "system-root", COMSPEC: "command-processor", LANG: "en_US.UTF-8",
		HOME: "live-home", USERPROFILE: "live-user", CODEX_HOME: "live-codex", CLAUDE_CONFIG_DIR: "live-claude",
		OPENAI_API_KEY: "secret", ANTHROPIC_API_KEY: "secret", CLAUDE_CODE_OAUTH_TOKEN: "secret",
		NODE_OPTIONS: "--import=untrusted", npm_config_cache: "live-cache", NPM_CONFIG_USERCONFIG: "live-config",
		BOXBOX_INSTALL_HOME: "live-install", PLUGIN_ROOT: "live-plugin", CLAUDE_PLUGIN_ROOT: "live-plugin",
	});

	expect(isolated.Path).toBe("native-executable-search");
	expect(isolated.SystemRoot).toBe("system-root");
	for (const key of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN", "NODE_OPTIONS", "NPM_CONFIG_USERCONFIG", "BOXBOX_INSTALL_HOME", "PLUGIN_ROOT", "CLAUDE_PLUGIN_ROOT"]) expect(isolated[key]).toBeUndefined();
	for (const key of ["HOME", "USERPROFILE", "CODEX_HOME", "CLAUDE_CONFIG_DIR", "XDG_DATA_HOME", "XDG_CONFIG_HOME", "LOCALAPPDATA", "APPDATA", "npm_config_cache", "npm_config_userconfig", "npm_config_globalconfig"]) expect(isolated[key]).toStartWith(root);
	expect(() => harness.isolatedEnvironment("relative", {})).toThrow("absolute");
});

test("archive verification rejects modified bytes, directories and symlinks before candidate execution", () => {
	const root     = temporary()                                                                                               ;
	const archive  = join(root, "fixture.tgz")                                                                                 ;
	const bytes    = Buffer.from("test-only digest fixture, never executable")                                                 ;
	const expected = { version: "test", sha256: createHash("sha256").update(bytes).digest("hex"), provenance: "unit fixture" } ;
	writeFileSync(archive, bytes);

	expect(harness.verifyArchive(archive, expected)).toMatchObject({ bytes: bytes.length, ...expected });
	expect(() => harness.verifyArchive(root, expected)).toThrow("regular");
	// Directory junctions do not need Windows developer-mode symlink privileges.
	const link = join(root, "directory-link");
	symlinkSync(root, link, process.platform === "win32" ? "junction" : "dir");
	expect(() => harness.verifyArchive(link, expected)).toThrow("regular");
	writeFileSync(archive, "modified");
	expect(() => harness.verifyArchive(archive, expected)).toThrow("digest differs");
});

test("host list parsing refuses foreign ownership, duplicate registrations and unknown schemas", () => {
	const codex   = { installed: [{ pluginId: "boxbox@boxbox-plugins", version: "0.2.4" }], available: [] } ;
	const claude  = [{ id: "boxbox@boxbox-plugins", version: "0.2.4" }]                                     ;
	const markets = [{ name: "boxbox-plugins" }]                                                            ;

	expect(harness.hostRecords("codex", codex, { marketplaces: markets }).plugin.version       ).toBe   ("0.2.4"                                      ) ;
	expect(harness.hostRecords("claude", claude, markets).plugin.version                       ).toBe   ("0.2.4"                                      ) ;
	expect(harness.hostRecords("codex", { installed: [], available: [] }, { marketplaces: [] })).toEqual({ plugin: undefined, marketplace: undefined }) ;
	expect(() => harness.hostRecords("codex", [], [])                                          ).toThrow("schema"                                     ) ;
	expect(() => harness.hostRecords("claude", [...claude, ...claude], markets)                ).toThrow("Duplicate"                                  ) ;
	expect(() => harness.hostRecords("claude", [{ id: "another@boxbox-plugins" }], markets)    ).toThrow("unrelated plugin"                           ) ;
	expect(() => harness.hostRecords("claude", claude, [...markets, { name: "shared" }])       ).toThrow("unrelated marketplace"                      ) ;
	expect(() => harness.hostRecords("claude", [{ name: "boxbox" }], markets)                  ).toThrow("identity"                                   ) ;
	expect(() => harness.hostRecords("claude", claude, [{}])                                   ).toThrow("name"                                       ) ;
});

test("a mismatched historical digest fails with retained evidence and zero child commands", async () => {
	const root     = temporary()                    ;
	const previous = join     (root, "old.tgz"    ) ;
	const current  = join     (root, "current.tgz") ;
	const output   = join     (root, "evidence"   ) ;
	writeFileSync(previous, "not the authorized historical bytes");
	writeFileSync(current, "not a candidate");

	await expect(harness.lifecycle({ host: "codex", previous, current, output })).rejects.toThrow("digest differs");
	const report = JSON.parse(readFileSync(join(output, "lifecycle.json"), "utf8"));

	expect(report.ok                   ).toBe     (false           ) ;
	expect(report.commands             ).toEqual  ([]              ) ;
	expect(report.error                ).toContain("digest differs") ;
	expect(existsSync(report.workspace)).toBe     (true            ) ;
	await expect(harness.lifecycle({ host: "codex", previous, current, output })).rejects.toThrow("existing runs are never reused");
});


test("only a named marketplace collision permits the documented removal transition", () => {
	for (const output of ["Error: marketplace boxbox-plugins already exists at another path", "Marketplace 'boxbox-plugins' has a different source", "Marketplace boxbox-plugins already installed"]) expect(harness.isMarketplaceCollision(output)).toBe(true);
	for (const output of ["marketplace add --help\nENOSPC: dependency already exists", "Error: another-marketplace already exists", "boxbox-plugins marketplace has different permissions", "Failed to load marketplace boxbox-plugins: invalid config", "marketplace boxbox-plugins\ndependency already installed"]) expect(harness.isMarketplaceCollision(output)).toBe(false);
});

```

### `docs/development/proposals/2026-10-22-artifact-lifecycle.md`

```markdown
# Exact-artifact lifecycle verification

## Gap and scope

The READINESS1 completion audit found an unexecuted REL10 requirement: a clean install, cross-version update,
rollback and host removal while preserving user configuration and project approval data. Existing candidate CI
proves fresh engine-only installation on three operating systems. Development install-shell tests and mocked host
artifact tests do not prove a real host plugin manager accepts these transitions.

Use the existing archives without rebuilding or modifying their bytes:

| Role | Version | SHA-256 | Provenance |
| --- | --- | --- | --- |
| Previous fixture | 0.2.3 | `f07df7ada9aa234c2935ed500b4fe15b1a5d53f7b7a6de7d8ec107f53c8f572c` | Retained local preview built from an uncommitted worktree; not a released or independently approved baseline |
| Current candidate | 0.2.4 | `bec626435e525c2d7324d156f85d2c114427d875725abcecb42fed561b2b92be` | Clean source `35b6178`, CI run 39637622755, three-OS engine smoke passed |

Registration and removal commands need no model request. This work does not satisfy authenticated Claude UI,
Claude/current-Windows hook acceptance, persistent trust, public rule approvals, licensing or publication.
Keep those prerequisites open. A Linux run under WSL is explicitly a Linux/WSL process result, not a hosted-CI
lifecycle result or Windows native-host result.

## Execution and ownership

1. Inspect actual host CLI help/version and isolated-platform prerequisites; never infer commands from memory.
2. Add a reusable Node harness under `development/tools/release-lifecycle.mjs`. Bind archive hashes before extraction,
   validate package identity, and isolate HOME, user/config/data locations, both host homes and npm cache.
3. Exercise each real host separately: install 0.2.3, initialize a project, and run doctor and the existing approved
   check/format/recheck journey. With that registration still present, attempt the 0.2.4 install using a fresh npm
   cache and `npm_config_offline=true`: require the dependency-cache failure before host registration, the prior
   version still usable, preservation sentinels unchanged and no mixed active registration. Retain failed-install residue.
4. Attempt the direct version transition with normal dependency access. For a known marketplace collision/refusal,
   verify the prior registration/engine/data remain intact, then use the documented manual unregister/reinstall
   procedure. A successful direct transition must prove the actual installed version and root changed; a stale installed
   cache cannot count as success. Unexpected errors stop the cell. Verify 0.2.4, then perform a warm-cache offline
   same-version repair and require success. Repeat the reverse transition to exact 0.2.3, recheck, and remove registration.
   Report manual migration as manual and non-atomic: the installer does not promise automatic marketplace migration.
   npm dependency-offline mode is not OS-wide network isolation or proof of an entirely offline host CLI.
5. Preserve representative user settings semantically when the host rewrites its own config; preserve project config,
   existing approved-rule fixture bytes and unrelated user files byte-for-byte. Do not create new canonical approvals.
6. Record host listings and permanent-directory residue before cleanup. The public installer has no filesystem
   uninstall command: documented host removal may leave permanent version directories. Do not present a harness
   deletion as a product uninstaller or broadly delete a parent/shared directory.
7. Run the same bound archives on macOS, native Windows and Linux. If Linux uses WSL, retain that qualifier. Core
   lifecycle registration must not be replaced with fake hosts, engine-only mode or model/hook evidence.
8. For supported macOS/Linux HUD adapters, separately verify the documented owned-launcher disable/update/removal
   handoff and preservation of unrelated settings. Windows HUD remains unsupported. Retain failures and distinguish
   partial plugin installation from a later HUD setup failure.
9. Independently review command evidence, archive identities, preservation and residue claims. Fix any actual defect,
   run relevant regressions and the requested GLM review for product changes, then update REL10 with measured cells.

The main agent owns plan/integration and documentation. The harness worker owns only its new verifier and focused
verifier tests. The platform investigator owns read-only prerequisite evidence. No live profile, credential copy,
login, model call, hook trust or public publication is part of this work.

## Completion criteria

Each host/OS cell needs actual command acceptance, registration pointing to the expected version, working engine
checks after update and rollback, fresh-cache dependency failure with prior-version recovery, warm-cache offline repair,
successful exact-plugin/marketplace removal, preserved user-owned data and an honest residue inventory. Version directories may remain under the documented manual-cleanup contract; deleting
those directories is not evidence of automated ownership-aware removal. Unsupported or unavailable cells stay open.

The overall release journey remains incomplete while its authenticated-host or human-approval prerequisites remain
unmet. These lifecycle results extend the existing CI evidence; they do not change the artifact source identity or
transfer the local 2b43 native-hook evidence to the byte-distinct CI archive.

```
