#!/usr/bin/env node
import { lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const marker = "# BoxBox managed HUD launcher";

function directEntry() {
	try { return typeof process.argv[1] === "string" && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
	catch { return false; }
}

function read(path) {
	try {
		const stat = lstatSync(path);
		if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) throw new Error(`Expected a regular file smaller than 1 MiB: ${path}`);
		return readFileSync(path, "utf8");
	} catch (error) {
		if (error.code === "ENOENT") return undefined;
		throw error;
	}
}

function write(path, content, mode = 0o600, expected) {
	read(path);
	mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
	if (lstatSync(dirname(path)).isSymbolicLink()) throw new Error(`Refusing a symlink directory: ${dirname(path)}`);
	const temporary = join(dirname(path), `.${randomUUID()}.tmp`);
	try {
		writeFileSync(temporary, content, { flag: "wx", mode });
		if (arguments.length >= 4 && read(path) !== expected) throw new Error(`File changed while configuring HUD: ${path}; retry after the concurrent edit finishes.`);
		renameSync(temporary, path);
	} finally { rmSync(temporary, { force: true }); }
}

/** Explicit opt-in only. Preserve unrelated settings and refuse another status-line owner. */
export function configureHud({ pluginRoot, host, disable = false, environment = process.env, home = homedir(), platform = process.platform }) {
	if (platform === "win32") throw new Error("The terminal HUD currently supports macOS/Linux. Windows plugin installation remains available without --hud.");
	if (!["codex", "claude"].includes(host) || !isAbsolute(pluginRoot)) throw new Error("Expected an absolute plugin root and codex or claude host.");
	const runtime = JSON.parse(read(join(pluginRoot, "runtime.json")) ?? "null");
	if (!runtime || !isAbsolute(runtime.node ?? "") || !isAbsolute(runtime.hudData ?? "")) throw new Error("HUD runtime is missing. Repair this installation first.");
	if (host === "codex") {
		const bin = environment.BOXBOX_BIN_HOME || join(home, ".local/bin");
		if (!isAbsolute(bin)) throw new Error("BOXBOX_BIN_HOME must be absolute.");
		const path     = join(bin, "boxbox-codex")                            ;
		const previous = read(path)                                            ;
		const launcher = join(pluginRoot, "scripts/hud/codex.mjs");
		if (read(launcher) === undefined) throw new Error("Codex HUD launcher is missing; repair this installation.");
		const content = `#!/bin/sh\n${marker}\nexec ${quote(runtime.node)} ${quote(launcher)} --plugin-root ${quote(pluginRoot)} -- "$@"\n`;
		if (previous !== undefined && previous !== content) throw new Error(`Another file or a user edit owns ${path}; move it or choose BOXBOX_BIN_HOME.`);
		if (disable) { if (previous !== undefined) rmSync(path); return { path, disabled: true }; }
		write(path, content, 0o755);
		return { path, disabled: false, message: `Run ${path} in a terminal with tmux installed. The ordinary codex command is unchanged.` };
	}
	const config = environment.CLAUDE_CONFIG_DIR || join(home, ".claude");
	if (!isAbsolute(config)) throw new Error("CLAUDE_CONFIG_DIR must be absolute.");
	const path = join(config, "settings.json");
	const statePath = join(runtime.hudData, "claude-statusline.json");
	const source = read(path);
	const settings = JSON.parse(source ?? "{}");
	if (!settings || typeof settings !== "object" || Array.isArray(settings)) throw new Error("Claude settings must be a JSON object.");
	const state = JSON.parse(read(statePath) ?? "null");
	const owned = state?.settingsPath === path && JSON.stringify(settings.statusLine) === JSON.stringify(state.statusLine);
	if (disable) {
		if (settings.statusLine === undefined) {
			if (state?.settingsPath === path) rmSync(statePath, { force: true });
			return { path, disabled: true };
		}
		if (!owned) throw new Error("Claude statusLine is not owned by this HUD; no settings changed.");
		delete settings.statusLine;
		write(path, JSON.stringify(settings, null, 2) + "\n", 0o600, source);
		rmSync(statePath, { force: true });
		return { path, disabled: true };
	}
	if (settings.statusLine !== undefined && !owned) throw new Error("Claude already has a statusLine. Keep it or remove that setting before opting into BoxBox HUD; no settings changed.");
	const script = join(pluginRoot, "scripts/hud/status.mjs");
	if (read(script) === undefined) throw new Error("HUD status script is missing; repair this installation.");
	const statusLine = { type: "command", command: `${quote(runtime.node)} ${quote(script)} --plugin-root ${quote(pluginRoot)} --host claude --claude-statusline` };
	if (source !== undefined && !owned) write(join(runtime.hudData, "claude-settings.before-hud.json"), source);
	write(statePath, JSON.stringify({ settingsPath: path, statusLine }, null, 2) + "\n");
	settings.statusLine = statusLine;
	write(path, JSON.stringify(settings, null, 2) + "\n", 0o600, source);
	return { path, disabled: false, message: "Claude statusLine enabled. Restart Claude Code in a terminal. No hook trust or approval settings changed." };
}

if (directEntry()) {
	try {
		const args = process.argv.slice(2);
		if (args.length < 2 || !["codex", "claude"].includes(args[0]) || (args.length > 2 && (args.length !== 3 || args[2] !== "--disable"))) throw new Error("Usage: node setup.mjs codex|claude <absolute-plugin-root> [--disable]");
		console.log(JSON.stringify(configureHud({ host: args[0], pluginRoot: args[1], disable: args[2] === "--disable" })));
	} catch (error) { console.error(`[BoxBox] ${error.message}`); process.exitCode = 1; }
}
