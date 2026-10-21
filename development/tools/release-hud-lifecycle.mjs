#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const HUD_ARTIFACTS = Object.freeze({
	previous: { version: "0.2.3", archiveSha256: "f07df7ada9aa234c2935ed500b4fe15b1a5d53f7b7a6de7d8ec107f53c8f572c", setupSha256: "4ad73e096bd7db86add4c348a2b45f88df285d07059da82bf9527fa7e43b814f" },
	current: { version: "0.2.4", archiveSha256: "bec626435e525c2d7324d156f85d2c114427d875725abcecb42fed561b2b92be", setupSha256: "e888c90357f6165d553fd5e095206a83f4b7bd442b563d7a9f4f3631f0ac927d" },
});
export const ISOLATED_PATH_ENVIRONMENT_KEYS = Object.freeze([
	"HOME", "USERPROFILE", "CODEX_HOME", "CLAUDE_CONFIG_DIR",
	"XDG_DATA_HOME", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "XDG_STATE_HOME",
]);
const USAGE  = "node release-hud-lifecycle.mjs --core <successful-lifecycle.json> --output <new-directory> [--current-sha256 <digest>]" ;
const digest = bytes => createHash("sha256").update(bytes).digest("hex")                                  ;
const json   = path => JSON.parse(readFileSync(path, "utf8"))                                             ;

export function parseArguments(args) {
	const result = {};
	for (let index = 0; index < args.length; index += 1) {
		const flag = args[index];
		assert.ok(["--core", "--output", "--current-sha256"].includes(flag), USAGE);
		const key = flag === "--current-sha256" ? "currentSha256" : flag.slice(2);
		assert.ok(result[key] === undefined && args[index + 1] && !args[index + 1].startsWith("--"), USAGE);
		result[key] = key === "currentSha256" ? args[++index] : resolve(args[++index]);
	}
	for (const key of ["core", "output"]) assert.equal(typeof result[key], "string", USAGE);
	assert.notEqual(result.core, result.output, USAGE);
	expectedHudArtifact("current", result.currentSha256);
	return result;
}

/** An explicit digest binds caller-selected candidate bytes without inferring source or CI provenance. */
export function expectedHudArtifact(role, currentSha256) {
	assert.ok(Object.hasOwn(HUD_ARTIFACTS, role), "Unknown HUD artifact role");
	if (currentSha256 !== undefined) assert.match(currentSha256, /^[a-f0-9]{64}$/u, "Candidate digest must be 64 lowercase hexadecimal characters");
	if (role !== "current" || currentSha256 === undefined) return HUD_ARTIFACTS[role];
	return { ...HUD_ARTIFACTS.current, archiveSha256: currentSha256, provenance: "Explicit caller-bound unpublished 0.2.4 candidate; source/build provenance must be recorded separately." };
}

function regularDirectory(path, label) {
	const stat = lstatSync(path);
	assert.ok(stat.isDirectory() && !stat.isSymbolicLink(), `${label} must be a nonsymlink directory: ${path}`);
}

function regularFile(path, label) {
	const stat = lstatSync(path);
	assert.ok(stat.isFile() && !stat.isSymbolicLink(), `${label} must be a regular nonsymlink file: ${path}`);
}

/** Non-following inventory: symlink targets are recorded and never traversed. */
export function inventoryScopes(scopes) {
	const result = {};
	const visit = (root, prefix = "") => {
		for (const name of readdirSync(join(root, prefix)).sort()) {
			const relativePath = join(prefix, name)        ;
			const path         = join(root, relativePath)  ;
			const stat         = lstatSync(path)           ;
			const key          = `${root}:${relativePath}` ;
			if (stat.isSymbolicLink()) result[key] = { kind: "symlink", target: readlinkSync(path), mode: stat.mode & 0o777 };
			else if (stat.isDirectory()) { result[key] = { kind: "directory", mode: stat.mode & 0o777 }; visit(root, relativePath); }
			else result[key] = { kind: "file", mode: stat.mode & 0o777, bytes: stat.size, sha256: digest(readFileSync(path)) };
		}
	};
	for (const root of [...scopes].sort()) { regularDirectory(root, "Inventory scope"); visit(root); }
	return result;
}

export function inventoryKey(root, relativePath) {
	return `${root}:${relativePath}`;
}

export function assertInventoryDelta(before, after, allowed) {
	const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
	const changed = [...keys].filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key])).sort();
	for (const key of changed) assert.ok(allowed.includes(key), `Unexpected inventory mutation: ${key}`);
	return changed;
}

export function assertOwnershipRefusal(text, host, disable) {
	const expected = host === "codex"
		? "Another file or a user edit owns"
		: disable ? "Claude statusLine is not owned by this HUD; no settings changed." : "Claude already has a statusLine.";
	assert.ok(text.includes(expected), `Expected ownership refusal diagnostic: ${expected}`);
	return expected;
}

function canonicalInside(root, path) {
	const canonicalRoot = realpathSync(root)                     ;
	const canonicalPath = realpathSync(path)                     ;
	const local         = relative(canonicalRoot, canonicalPath) ;
	assert.ok(local !== ".." && !local.startsWith(`..${sep}`) && !isAbsolute(local), `Path is outside the core workspace: ${path}`);
	return canonicalPath;
}

export function validateEnvironmentPaths(environment, workspace) {
	for (const key of ISOLATED_PATH_ENVIRONMENT_KEYS) {
		assert.equal(typeof environment[key], "string", `Missing isolated path environment variable: ${key}`);
		canonicalInside(workspace, environment[key]);
	}
	return [...ISOLATED_PATH_ENVIRONMENT_KEYS];
}

export function validateCoreReport(report, corePath, currentSha256) {
	assert.equal(report.schemaVersion, 1, "Unsupported core lifecycle schema");
	assert.equal(report.ok, true, "Core lifecycle did not pass");
	assert.ok(["codex", "claude"].includes(report.host), "Core lifecycle has an unsupported host");
	assert.ok(["darwin", "linux"].includes(report.platform), "HUD lifecycle supports macOS/Linux only");
	assert.ok(Array.isArray(report.residue) && Array.isArray(report.steps), "Core lifecycle lacks residue/steps");
	assert.ok(report.steps.some(step => step.label === "final-remove" && step.registrationRemoved === true), "Core lifecycle lacks final registration removal");
	const workspace = realpathSync(report.workspace);
	const coreStat = lstatSync(corePath);
	assert.ok(coreStat.isFile() && !coreStat.isSymbolicLink(), "Core report must be a regular nonsymlink file");
	assert.ok(isAbsolute(workspace));
	canonicalInside(dirname(realpathSync(corePath)), workspace);
	const roots = {};
	const artifacts = {};
	for (const role of ["previous", "current"]) {
		const expected = expectedHudArtifact(role, currentSha256);
		const artifact = report.artifacts?.[role];
		assert.equal(artifact?.sha256, expected.archiveSha256, `${role} archive binding differs`);
		assert.equal(artifact?.version, expected.version, `${role} version differs`);
		const matches = report.residue.filter(item => item.role === role && item.present === true);
		assert.equal(matches.length, 1, `Core lifecycle needs one present ${role} residue`);
		regularDirectory(matches[0].path, `${role} residue root`);
		roots[role] = canonicalInside(workspace, matches[0].path);
		artifacts[role] = expected;
	}
	return { host: report.host, platform: report.platform, workspace, roots, artifacts };
}

export function expectedCodexLauncher(runtime, pluginRoot) {
	const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
	return `#!/bin/sh\n# BoxBox managed HUD launcher\nexec ${quote(runtime.node)} ${quote(join(pluginRoot, "scripts/hud/codex.mjs"))} --plugin-root ${quote(pluginRoot)} -- "$@"\n`;
}

export function assertExactOwned(path, expected) {
	const stat = lstatSync(path);
	assert.ok(stat.isFile() && !stat.isSymbolicLink(), `Owned file must be a regular nonsymlink: ${path}`);
	assert.equal(stat.mode & 0o777, 0o755, `Owned launcher mode differs: ${path}`);
	assert.equal(readFileSync(path, "utf8"), expected, `Owned file changed: ${path}`);
}

export function withoutStatusLine(settings) {
	const copy = structuredClone(settings);
	delete copy.statusLine;
	return copy;
}

function prospectiveInside(root, path) {
	const absolute = resolve(path);
	canonicalInside(root, dirname(absolute));
	if (existsSync(absolute)) {
		const stat = lstatSync(absolute);
		assert.ok(stat.isDirectory() && !stat.isSymbolicLink(), `Expected a nonsymlink directory: ${absolute}`);
		return realpathSync(absolute);
	}
	return join(realpathSync(dirname(absolute)), absolute.slice(dirname(absolute).length + 1));
}

export function validateBinding(role, root, workspace) {
	regularDirectory(root, `${role} residue root`);
	const pluginPath = join(root, "plugin"); regularDirectory(pluginPath, `${role} plugin root`);
	const plugin = canonicalInside(workspace, pluginPath);
	const setupPath = join(plugin, "scripts/hud/setup.mjs"); regularFile(setupPath, `${role} setup`);
	const setup = canonicalInside(workspace, setupPath);
	const runtimeFile = join(plugin, "runtime.json"); regularFile(runtimeFile, `${role} runtime metadata`);
	const runtimePath = canonicalInside(workspace, runtimeFile);
	assert.equal(digest(readFileSync(setup)), HUD_ARTIFACTS[role].setupSha256, `${role} HUD setup differs`);
	const runtime = json(runtimePath);
	for (const key of ["node", "cli", "hudData"]) assert.ok(isAbsolute(runtime[key]), `${role} runtime.${key} is not absolute`);
	assert.ok(existsSync(runtime.node) && existsSync(runtime.cli), `${role} runtime executable or CLI is unavailable`);
	regularFile(runtime.cli, `${role} runtime CLI`);
	const nodeStat = lstatSync(runtime.node);
	assert.ok(nodeStat.isFile() && !nodeStat.isSymbolicLink(), `${role} runtime.node must be a regular nonsymlink file`);
	canonicalInside(workspace, runtime.cli);
	return { role, root, plugin, setup, runtime: { ...runtime, hudData: prospectiveInside(workspace, runtime.hudData) } };
}

function preservedHashes(report, mutable) {
	return new Map((report.preserved ?? []).filter(item => !mutable.has(resolve(item.path))).map(item => [resolve(item.path), item.sha256]));
}

/** Explicit opt-in only. This invokes HUD setup scripts, never a host, model, hook, trust or UI command. */
export async function hudLifecycle(options) {
	assert.ok(!existsSync(options.output), "Output must be a new task-owned directory; existing runs are never reused");
	mkdirSync(options.output);
	const reportFile = join(options.output, "hud-lifecycle.json");
	const report = { schemaVersion: 1, ok: false, startedAt: new Date().toISOString(), commands: [], steps: [], limitations: ["Configuration ownership only; no host, model, hooks, trust, tmux or UI acceptance.", "Windows HUD is unsupported."] };
	const save = () => writeFileSync(reportFile, JSON.stringify(report, null, 2) + "\n");
	try {
		const core      = json(options.core)                                            ;
		const validated = validateCoreReport(core, options.core, options.currentSha256) ;
		const profile   = join(validated.workspace, "profile")                          ;
		const environment = {
			PATH         : process.env.PATH, HOME: join(profile, "home"), USERPROFILE: join(profile, "home")                                                              ,
			CODEX_HOME   : join(profile, "codex"), CLAUDE_CONFIG_DIR: join(profile, "claude")                                                                             ,
			XDG_DATA_HOME: join(profile, "data"), XDG_CONFIG_HOME: join(profile, "config"), XDG_CACHE_HOME: join(profile, "cache"), XDG_STATE_HOME: join(profile, "state"),
			NO_COLOR     : "1", CI: "1"                                                                                                                                   ,
		};
		validateEnvironmentPaths(environment, validated.workspace);
		const old     = validateBinding("previous", validated.roots.previous, validated.workspace) ;
		const current = validateBinding("current", validated.roots.current, validated.workspace)   ;
		assert.equal(old.runtime.node, current.runtime.node, "Versions use different Node executables");
		assert.equal(old.runtime.hudData, current.runtime.hudData, "Versions do not share stable HUD data");
		const hudData = old.runtime.hudData;
		mkdirSync(hudData, { recursive: true });
		const hudSentinel = join(hudData, "rel10-unrelated-hud-data.txt");
		writeFileSync(hudSentinel, "unrelated stable HUD data\n", { flag: "wx" });
		const hudSentinelHash  = digest(readFileSync(hudSentinel))                                          ;
		const codexConfig      = join(environment.CODEX_HOME, "config.toml")                                ;
		const codexConfigHash  = validated.host === "codex" ? digest(readFileSync(codexConfig)) : undefined ;
		const versionInventory = inventoryScopes([validated.roots.previous, validated.roots.current])       ;
		const versionHudScopes = [join(old.plugin, "scripts/hud"), join(current.plugin, "scripts/hud")]     ;
		let trackedScopes = [];
		Object.assign(report, { host: validated.host, platform: validated.platform, workspace: validated.workspace, roots: validated.roots, bindings: { previous: { archiveSha256: validated.artifacts.previous.archiveSha256, setupSha256: validated.artifacts.previous.setupSha256 }, current: { archiveSha256: validated.artifacts.current.archiveSha256, setupSha256: validated.artifacts.current.setupSha256, provenance: validated.artifacts.current.provenance ?? "Pinned default unpublished 0.2.4 HUD candidate." } } });
		const run = (label, item, disable = false, statuses = [0], allowed = []) => {
			const before = inventoryScopes(trackedScopes)                                                                                                  ;
			const number = report.commands.length + 1                                                                                                      ;
			const args   = [item.setup, validated.host, item.plugin, ...(disable ? ["--disable"] : [])]                                                    ;
			const record = { label, executable: item.runtime.node, args, cwd: validated.workspace, startedAt: new Date().toISOString(), state: "running" } ;
			report.commands.push(record); save();
			const started = Date.now();
			const child = spawnSync(record.executable, args, { cwd: validated.workspace, env: environment, encoding: "utf8", shell: false, timeout: 30_000, killSignal: "SIGKILL", windowsHide: true });
			record.stdout = `${String(number).padStart(3, "0")}.stdout.log`; record.stderr = `${String(number).padStart(3, "0")}.stderr.log`;
			writeFileSync(join(options.output, record.stdout), child.stdout ?? ""); writeFileSync(join(options.output, record.stderr), child.stderr ?? "");
			Object.assign(record, { exitCode: child.status, signal: child.signal, error: child.error?.message, durationMs: Date.now() - started, state: child.error || child.signal || !statuses.includes(child.status) ? "failed" : "passed" });
			const after = inventoryScopes(trackedScopes);
			record.inventoryDelta = assertInventoryDelta(before, after, allowed);
			save(); assert.equal(record.state, "passed", `${label} returned an unexpected result`); return record;
		};
		const mutate = (label, allowed, change) => {
			const before = inventoryScopes(trackedScopes);
			change();
			const delta = assertInventoryDelta(before, inventoryScopes(trackedScopes), allowed);
			report.steps.push({ label, harnessMutation: true, inventoryDelta: delta }); save();
		};
		if (validated.host === "codex") {
			const bin = join(validated.workspace, "hud-bin"); mkdirSync(bin); environment.BOXBOX_BIN_HOME = bin;
			const sentinel = join(bin, "unrelated.txt"); writeFileSync(sentinel, "unrelated HUD bin data\n", { flag: "wx" }); const sentinelHash = digest(readFileSync(sentinel));
			trackedScopes = [bin, hudData, environment.CODEX_HOME, ...versionHudScopes];
			const launcherAllowed = [inventoryKey(bin, "boxbox-codex")];
			const launcher = join(bin, "boxbox-codex"); const oldOwned = expectedCodexLauncher(old.runtime, old.plugin); const newOwned = expectedCodexLauncher(current.runtime, current.plugin);
			run("old-enable", old, false, [0], launcherAllowed); assertExactOwned(launcher, oldOwned); run("old-disable", old, true, [0], launcherAllowed); assert.ok(!existsSync(launcher));
			run("current-enable", current, false, [0], launcherAllowed); assertExactOwned(launcher, newOwned);
			const edited = newOwned + "# harness user edit\n"; mutate("codex-create-user-edit", launcherAllowed, () => writeFileSync(launcher, edited)); assertOwnershipRefusal(readFileSync(join(options.output, run("current-edited-enable-refusal", current, false, [1], []).stderr), "utf8"), "codex", false); assertExactOwned(launcher, edited); assertOwnershipRefusal(readFileSync(join(options.output, run("current-edited-disable-refusal", current, true, [1], []).stderr), "utf8"), "codex", true); assertExactOwned(launcher, edited);
			assertExactOwned(launcher, edited); mutate("codex-restore-owned", launcherAllowed, () => writeFileSync(launcher, newOwned)); assertExactOwned(launcher, newOwned); run("current-disable-for-rollback", current, true, [0], launcherAllowed); assert.ok(!existsSync(launcher));
			run("old-enable-rollback", old, false, [0], launcherAllowed); assertExactOwned(launcher, oldOwned); run("old-disable-remove", old, true, [0], launcherAllowed); assert.ok(!existsSync(launcher));
			mutate("codex-create-foreign", launcherAllowed, () => { writeFileSync(launcher, "#!/bin/sh\n# unrelated owner\n", { flag: "wx", mode: 0o755 }); }); const foreign = readFileSync(launcher, "utf8"); assertOwnershipRefusal(readFileSync(join(options.output, run("foreign-enable-refusal", current, false, [1], []).stderr), "utf8"), validated.host, false); assertExactOwned(launcher, foreign); assertOwnershipRefusal(readFileSync(join(options.output, run("foreign-disable-refusal", current, true, [1], []).stderr), "utf8"), validated.host, true); assertExactOwned(launcher, foreign); mutate("codex-remove-foreign", launcherAllowed, () => rmSync(launcher));
			assert.equal(digest(readFileSync(sentinel)), sentinelHash); report.steps.push({ label: "codex-hud-lifecycle", ok: true, finalLauncherAbsent: true, unrelatedBinPreserved: true });
		} else {
			trackedScopes = [environment.CLAUDE_CONFIG_DIR, hudData, ...versionHudScopes];
			const settingsAllowed = inventoryKey(environment.CLAUDE_CONFIG_DIR, "settings.json");
			const claudeAllowed = [settingsAllowed, inventoryKey(hudData, "claude-statusline.json"), inventoryKey(hudData, "claude-settings.before-hud.json")];
			const settingsPath = join(environment.CLAUDE_CONFIG_DIR, "settings.json"); const statePath = join(hudData, "claude-statusline.json"); const backupPath = join(hudData, "claude-settings.before-hud.json");
			const initial = json(settingsPath); initial.rel10Hud = { preserved: "before" }; mutate("claude-add-unrelated-setting", [settingsAllowed], () => writeFileSync(settingsPath, JSON.stringify(initial, null, 2) + "\n")); const beforeBytes = readFileSync(settingsPath, "utf8");
			run("old-enable", old, false, [0], claudeAllowed); assert.equal(readFileSync(backupPath, "utf8"), beforeBytes); let owned = json(settingsPath); assert.deepEqual(withoutStatusLine(owned), initial); assert.deepEqual(json(statePath).statusLine, owned.statusLine); assert.match(owned.statusLine.command, new RegExp(old.plugin.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
			owned.rel10Hud.afterEnable = "preserved"; mutate("claude-add-post-enable-setting", [settingsAllowed], () => writeFileSync(settingsPath, JSON.stringify(owned, null, 2) + "\n"));
			run("current-enable", current, false, [0], claudeAllowed); let currentOwned = json(settingsPath); assert.equal(currentOwned.rel10Hud.afterEnable, "preserved"); assert.deepEqual(json(statePath).statusLine, currentOwned.statusLine); assert.ok(currentOwned.statusLine.command.includes(current.plugin)); assert.equal(readFileSync(backupPath, "utf8"), beforeBytes);
			const edited = structuredClone(currentOwned); edited.statusLine.command = "foreign-user-status"; mutate("claude-create-user-edit", [settingsAllowed], () => writeFileSync(settingsPath, JSON.stringify(edited, null, 2) + "\n")); const editedBytes = readFileSync(settingsPath, "utf8"); const stateBytes = readFileSync(statePath, "utf8"); assertOwnershipRefusal(readFileSync(join(options.output, run("current-edited-enable-refusal", current, false, [1], []).stderr), "utf8"), "claude", false); assert.equal(readFileSync(settingsPath, "utf8"), editedBytes); assert.equal(readFileSync(statePath, "utf8"), stateBytes); assertOwnershipRefusal(readFileSync(join(options.output, run("current-edited-disable-refusal", current, true, [1], []).stderr), "utf8"), "claude", true); assert.equal(readFileSync(settingsPath, "utf8"), editedBytes);
			assert.equal(readFileSync(settingsPath, "utf8"), editedBytes); mutate("claude-restore-owned", [settingsAllowed], () => writeFileSync(settingsPath, JSON.stringify(currentOwned, null, 2) + "\n")); run("old-enable-rollback", old, false, [0], claudeAllowed); owned = json(settingsPath); assert.ok(owned.statusLine.command.includes(old.plugin)); assert.equal(owned.rel10Hud.afterEnable, "preserved"); run("old-disable-remove", old, true, [0], claudeAllowed); const removed = json(settingsPath); assert.deepEqual(removed, withoutStatusLine(owned)); assert.ok(!existsSync(statePath)); assert.equal(readFileSync(backupPath, "utf8"), beforeBytes);
			const foreign = { ...removed, statusLine: { type: "command", command: "foreign-owner" } }; mutate("claude-create-foreign", [settingsAllowed], () => writeFileSync(settingsPath, JSON.stringify(foreign, null, 2) + "\n")); const foreignBytes = readFileSync(settingsPath, "utf8"); assertOwnershipRefusal(readFileSync(join(options.output, run("foreign-enable-refusal", current, false, [1], []).stderr), "utf8"), validated.host, false); assert.equal(readFileSync(settingsPath, "utf8"), foreignBytes); assertOwnershipRefusal(readFileSync(join(options.output, run("foreign-disable-refusal", current, true, [1], []).stderr), "utf8"), validated.host, true); assert.equal(readFileSync(settingsPath, "utf8"), foreignBytes); assert.ok(!existsSync(statePath)); mutate("claude-remove-foreign", [settingsAllowed], () => writeFileSync(settingsPath, JSON.stringify(removed, null, 2) + "\n"));
			report.steps.push({ label: "claude-hud-lifecycle", ok: true, stateRemoved: true, unrelatedSettingsPreserved: true, backupRetained: true });
		}
		assert.deepEqual(inventoryScopes([validated.roots.previous, validated.roots.current]), versionInventory, "Version roots changed during HUD lifecycle");
		assert.equal(digest(readFileSync(hudSentinel)), hudSentinelHash, "Unrelated stable HUD data changed");
		if (validated.host === "codex") assert.equal(digest(readFileSync(codexConfig)), codexConfigHash, "Unrelated Codex config changed");
		const mutable = new Set([join(environment.CLAUDE_CONFIG_DIR, "settings.json"), join(hudData, "claude-statusline.json"), join(hudData, "claude-settings.before-hud.json"), hudSentinel]);
		for (const [path, sha256] of preservedHashes(core, mutable)) assert.equal(digest(readFileSync(path)), sha256, `Core preservation hash changed: ${path}`);
		report.ok = true; return report;
	} catch (error) { report.error = error instanceof Error ? error.stack : String(error); throw error; }
	finally { report.finishedAt = new Date().toISOString(); save(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	if (process.argv.length === 3 && process.argv[2] === "--help") console.log(USAGE);
	else { try { const result = await hudLifecycle(parseArguments(process.argv.slice(2))); console.log(JSON.stringify({ ok: result.ok, host: result.host, steps: result.steps }, null, 2)); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; } }
}
