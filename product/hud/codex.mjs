#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { accessSync, constants, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { constants as osConstants, tmpdir } from "node:os";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(import.meta.url);
const help = `Usage: boxbox-codex [--codex /absolute/path/to/codex] --plugin-root /installed/plugin [-- CODEX_ARGS...]

Open the normal Codex terminal above a persistent, read-only BoxBox HUD.
Requires Node.js, tmux, and a macOS/Linux terminal outside an existing tmux session.
The HUD observes the starting project (or --cd/-C directory); restart this launcher
when changing projects. Remote, worktree, resume, fork and noninteractive commands
are unsupported. Codex configuration, permissions and hook trust are unchanged.
Detach with Ctrl-b d to close this launcher and its owned session.
`;

function directEntry() {
	try { return typeof process.argv[1] === "string" && realpathSync(process.argv[1]) === realpathSync(entry); }
	catch { return false; }
}

export function parseArguments(args) {
	const result = { pluginRoot: undefined, codex: undefined, args: [], help: false };

	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		if (arg === "--") { result.args = args.slice(index + 1); break; }
		if (arg === "--help" || arg === "-h") { result.help = true; continue; }
		if (arg !== "--plugin-root" && arg !== "--codex") throw new Error(`Unknown launcher option: ${arg}. Pass Codex options after --.`);
		const value = args[++index];
		if (!value || !isAbsolute(value)) throw new Error(`${arg} requires an absolute path.`);
		result[arg === "--plugin-root" ? "pluginRoot" : "codex"] = value;
	}
	if (!result.help && !result.pluginRoot) throw new Error("--plugin-root requires the installed plugin directory.");
	return result;
}

// Follow only explicit startup-directory selection. A resumed or remote session
// may use another root, so those modes cannot truthfully share this fixed HUD.
export function projectRoot(args, cwd) {
	const valued = new Set(["-c", "--config", "--enable", "--disable", "-i", "--image", "-m", "--model", "--local-provider", "-p", "--profile", "-s", "--sandbox", "--add-dir", "-a", "--ask-for-approval"]);
	const commands = new Set(["agents", "exec", "e", "review", "login", "logout", "mcp", "plugin", "app-server", "remote-control", "app", "completion", "update", "doctor", "sandbox", "debug", "apply", "resume", "queue", "archive", "delete", "migrate-rollouts", "unarchive", "fork", "cloud", "exec-server", "features", "help"]);
	let root = cwd;
	let positional = false;
	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		if (arg === "--") break;
		if (/^--(?:remote|remote-auth-token-env|worktree)(?:=|$)/.test(arg)) throw new Error(`${arg.split("=")[0]} is unsupported by the local project HUD. Launch codex directly for this mode.`);
		if (arg === "-C" || arg === "--cd") {
			const value = args[++index];
			if (!value) throw new Error(`${arg} requires a directory.`);
			root = resolve(cwd, value);
		} else if (arg.startsWith("--cd=")) {
			if (arg.length === 5) throw new Error("--cd requires a directory.");
			root = resolve(cwd, arg.slice(5));
		} else if (arg.startsWith("-C") && arg.length > 2) {
			root = resolve(cwd, arg.slice(2));
		} else if (valued.has(arg)) {
			if (args[++index] === undefined) throw new Error(`${arg} requires a value.`);
		} else if (!arg.startsWith("-")) {
			if (!positional && commands.has(arg)) throw new Error(`The ${arg} command is unsupported by the fixed project HUD. Launch codex directly for this command.`);
			positional = true;
		}
	}
	return realpathSync(root);
}

function executable(name, env) {
	const paths = isAbsolute(name) ? [name] : (env.PATH ?? "").split(delimiter).map(directory => resolve(directory || ".", name));
	for (const path of paths) {
		try {
			accessSync(path, constants.X_OK);
			if (statSync(path).isFile()) return path;
		} catch { /* Continue searching the existing PATH. */ }
	}
	throw new Error(`${name} is not executable or is not on PATH. Install it before launching the BoxBox HUD.`);
}

function exitCode(code, signal) {
	return Number.isInteger(code) ? code : 128 + (osConstants.signals[signal] ?? 1);
}

// tmux treats a trailing semicolon as a command separator even in argv mode.
function tmuxArgument(value) {
	return value.endsWith(";") ? `${value.slice(0, -1)}\\;` : value;
}

function attach(tmux, args, options, cleanup) {
	return new Promise((resolveExit, reject) => {
		const child = spawn(tmux, args, { ...options, stdio: "inherit" });
		const handlers = new Map();
		let interrupted;
		for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
			const handler = () => { interrupted = signal; cleanup(); child.kill(signal); };
			handlers.set(signal, handler);
			process.once(signal, handler);
		}
		const remove = () => { for (const [signal, handler] of handlers) process.removeListener(signal, handler); };
		child.once("error", error => { remove(); reject(error); });
		child.once("exit", (code, signal) => { remove(); resolveExit(interrupted ? exitCode(null, interrupted) : exitCode(code, signal)); });
	});
}

export async function launch(options, dependencies = {}) {
	const platform = dependencies.platform ?? process.platform                                                                                                   ;
	const env      = dependencies.env ?? process.env                                                                                                             ;
	const cwd      = dependencies.cwd ?? process.cwd()                                                                                                           ;
	const terminal = dependencies.terminal ?? { isTTY: process.stdin.isTTY && process.stdout.isTTY, columns: process.stdout.columns, rows: process.stdout.rows } ;
	const run      = dependencies.run ?? spawnSync                                                                                                               ;
	const connect  = dependencies.attach ?? attach                                                                                                               ;

	if (platform !== "darwin" && platform !== "linux") throw new Error("The persistent Codex HUD requires macOS or Linux with tmux. Native Windows is unsupported; use the on-request BoxBox status view.");
	if (env.TMUX) throw new Error("Run boxbox-codex from a terminal outside tmux. This launcher owns a separate tmux server and does not modify existing sessions.");
	if (!terminal.isTTY) throw new Error("The persistent Codex HUD requires an interactive terminal.");
	if ((terminal.rows ?? 24) < 12) throw new Error("Enlarge the terminal to at least 12 rows before launching the BoxBox HUD.");

	const root   = projectRoot(options.args, cwd)            ;
	const tmux   = executable("tmux", env)                   ;
	const codex  = executable(options.codex ?? "codex", env) ;
	const status = join(dirname(entry), "status.mjs")        ;
	if (!existsSync(status)) throw new Error(`Missing installed HUD renderer: ${status}`);
	if (!statSync(options.pluginRoot).isDirectory()) throw new Error("The installed plugin root must be a directory.");

	const directory = mkdtempSync(join(tmpdir(), "boxbox-codex-hud-"))                                   ;
	const statePath = join(directory, "state.json")                                                      ;
	const gate      = join(directory, "ready")                                                           ;
	const result    = join(directory, "exit")                                                            ;
	const server    = ["-L", `boxbox-hud-${process.pid}-${randomUUID().slice(0, 8)}`, "-f", "/dev/null"] ;
	const execution = { cwd, env, encoding: "utf8", timeout: 10000 }                                     ;
	const cleanup = () => run(tmux, [...server, "kill-server"], execution);
	const command = args => {
		const completed = run(tmux, [...server, ...args.map(tmuxArgument)], execution);
		if (completed.error || completed.status !== 0) throw new Error(`tmux ${args[0]} failed: ${completed.error?.message ?? completed.stderr?.trim() ?? "unknown error"}`);
	};

	try {
		writeFileSync(statePath, JSON.stringify({ codex, args: options.args, cwd, tmux, server, gate, result }), { mode: 0o600 });
		// Multiple shell-command arguments are executed directly by tmux. Neither
		// prompts nor paths are interpreted by a shell, including quotes and $().
		command(["new-session", "-d", "-s", "boxbox", "-x", String(terminal.columns ?? 80), "-y", String(terminal.rows ?? 24), "-c", cwd, process.execPath, entry, "--pane", statePath]);
		command(["set-option", "-t", "boxbox", "status", "off"]);
		command(["split-window", "-d", "-v", "-l", "4", "-t", "boxbox:0.0", "-c", cwd, process.execPath, status, "--plugin-root", options.pluginRoot, "--root", root, "--host", "codex", "--watch"]);
		command(["select-pane", "-t", "boxbox:0.0"]);

		const attached = connect(tmux, [...server, "attach-session", "-t", "boxbox"], { cwd, env }, cleanup);
		writeFileSync(gate, "ready", { mode: 0o600 });
		const code = await attached;
		if (!existsSync(result)) return code;

		const recorded = Number(readFileSync(result, "utf8"));
		return Number.isInteger(recorded) && recorded >= 0 && recorded <= 255 ? recorded : 1;
	} finally {
		cleanup();
		rmSync(directory, { recursive: true, force: true });
	}
}

async function runPane(statePath) {
	const state = JSON.parse(readFileSync(statePath, "utf8"));
	const deadline = Date.now() + 15000;
	while (!existsSync(state.gate)) {
		if (Date.now() > deadline) throw new Error("The BoxBox HUD launcher did not finish initializing.");
		await new Promise(resolveWait => setTimeout(resolveWait, 50));
	}
	const child = spawn(state.codex, state.args, { cwd: state.cwd, env: process.env, stdio: "inherit" });
	const code = await new Promise(resolveExit => {
		child.once("error", error => { process.stderr.write(`Cannot start Codex: ${error.message}\n`); resolveExit(127); });
		child.once("exit", (status, signal) => resolveExit(exitCode(status, signal)));
	});
	writeFileSync(state.result, String(code), { mode: 0o600 });
	spawnSync(state.tmux, [...state.server, "kill-server"], { stdio: "ignore", timeout: 10000 });
	return code;
}

if (directEntry()) {
	try {
		if (process.argv[2] === "--pane") process.exitCode = await runPane(process.argv[3]);
		else {
			const options = parseArguments(process.argv.slice(2));
			if (options.help) process.stdout.write(help);
			else process.exitCode = await launch(options);
		}
	} catch (error) {
		process.stderr.write(`BoxBox HUD: ${error.message}\n`);
		process.exitCode = 1;
	}
}
