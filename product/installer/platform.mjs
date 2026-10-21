import      { spawnSync    } from "node:child_process" ;
import      { existsSync   } from "node:fs"            ;
import      { homedir      } from "node:os"            ;
import      { posix, win32 } from "node:path"          ;

export function supportedNode(version) {
	const [major, minor, patch] = version.split(".").map(Number);
	return major > 22 || (major === 22 && (minor > 22 || (minor === 22 && patch >= 3)));
}

export function installationRoot(version, host, { windows = process.platform === "win32", environment = process.env, home = homedir() } = {}) {
	if (!["codex", "claude"].includes(host)) throw new Error("Expected codex or claude installation host.");
	if (windows) {
		if (!environment.LOCALAPPDATA || !win32.isAbsolute(environment.LOCALAPPDATA)) throw new Error("LOCALAPPDATA must point to an absolute user data directory on Windows.");
		return win32.join(environment.LOCALAPPDATA, "BoxBox", host === "codex" ? "Codex" : "Claude", version);
	}
	const data = environment.XDG_DATA_HOME || posix.join(home, ".local/share");
	if (!posix.isAbsolute(data)) throw new Error("XDG_DATA_HOME must be an absolute directory when set.");
	return posix.join(data, "boxbox", host, version);
}

function identifiesCodex(executable, probe) {
	try {
		const result = probe(executable, ["--version"], {
			encoding: "utf8", shell: false, windowsHide: true,
			timeout: 3_000, maxBuffer: 4_096, killSignal: "SIGKILL", stdio: ["ignore", "pipe", "pipe"],
		});

		return result.status === 0 && !result.error && !result.signal
			&& /^codex-cli \d+\.\d+\.\d+(?:-[0-9a-z.-]+)?(?:\+[0-9a-z.-]+)?$/iu.test(String(result.stdout ?? "").trim());
	} catch {
		return false;
	}
}

/** Resolve standard Windows npm shims without a shell, and skip unrelated native programs named codex.exe. */
export function findCommand(name, { windows = process.platform === "win32", node = process.execPath, path = process.env.PATH || "", exists = existsSync, probe = spawnSync } = {}) {
	const paths = windows ? win32 : posix;
	const directories = [...path.split(windows ? ";" : ":").filter(Boolean), paths.dirname(node)];
	for (const directory of directories) {
		if (windows) {
			if (name === "npm" || name === "codex") {
				const script = paths.join(directory, name === "npm" ? "node_modules/npm/bin/npm-cli.js" : "node_modules/@openai/codex/bin/codex.js");
				if (exists(script)) return { executable: node, args: [script] };
			}
			if (name === "claude") {
				const packaged = paths.join(directory, "node_modules/@anthropic-ai/claude-code/bin/claude.exe");
				if (exists(packaged)) return { executable: packaged, args: [] };
			}
			const native = paths.join(directory, `${name}.exe`);
			if (name !== "npm" && exists(native) && (name !== "codex" || identifiesCodex(native, probe))) return { executable: native, args: [] };
		} else {
			const executable = paths.join(directory, name);
			if (exists(executable)) return { executable, args: [] };
		}
	}
	return undefined;
}

export function shellQuote(value) {
	return "'" + value.replaceAll("'", "'\\''") + "'";
}

export function powershellQuote(value) {
	return "'" + value.replaceAll(/['\u2018\u2019\u201A\u201B]/gu, quote => quote + quote) + "'";
}

export function engineCommand(node, launcher, windows, host = "codex") {
	if (windows && host === "claude") {
		const payload = Buffer.from(JSON.stringify([node, launcher]), "utf8").toString("base64");
		return `node -e "const [n,l]=JSON.parse(Buffer.from('${payload}','base64').toString('utf8'));const r=require('node:child_process').spawnSync(n,[l,...process.argv.slice(1)],{stdio:'inherit'});if(r.error){console.error(r.error.message);process.exit(1)}process.exit(r.status??1)" --`;
	}
	return windows ? `& ${powershellQuote(node)} ${powershellQuote(launcher)}` : `${shellQuote(node)} ${shellQuote(launcher)}`;
}

export function configureSkill(skill, command, previousCommand, windows) {
	const marker = "@BOXBOX_ENGINE_COMMAND@";
	const oldCommand = skill.includes(marker) ? marker : previousCommand;
	if (!oldCommand || !skill.includes(oldCommand)) throw new Error("The installed skill command is missing. Rerun the BoxBox installer to repair the plugin.");
	return skill.replaceAll(oldCommand, () => command).replaceAll(windows ? "```bash" : "```powershell", windows ? "```powershell" : "```bash");
}

export function hookCommands(node, mode, host = "codex") {
	if (host === "claude") return { command: node, args: ["${CLAUDE_PLUGIN_ROOT}/scripts/boxbox.mjs", "hook", mode] };
	return {
		command: `${shellQuote(node)} "\${PLUGIN_ROOT}/scripts/boxbox.mjs" hook ${mode}`,
		commandWindows: `& ${powershellQuote(node)} "$env:PLUGIN_ROOT/scripts/boxbox.mjs" hook ${mode}`,
	};
}
