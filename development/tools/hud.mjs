import      { spawnSync                 } from "node:child_process"                   ;
import      {
              existsSync              ,
              lstatSync               ,
              readFileSync            ,
              readdirSync             ,
                                        } from "node:fs"                              ;
import      { isAbsolute, join, resolve } from "node:path"                            ;
import      { pathToFileURL             } from "node:url"                             ;
import      { createHash                } from "node:crypto"                          ;
import      { findCommand               } from "../../product/installer/platform.mjs" ;

function command(tool, args, root) {
	if (!tool) throw new Error("Codex CLI is unavailable");

	const child = spawnSync(tool.executable, [...tool.args, ...args], {
		cwd: root, encoding: "utf8", timeout: 10_000, maxBuffer: 256 * 1024,
		killSignal: "SIGKILL", windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
	});
	if (child.error || child.signal || child.status !== 0) throw new Error(child.error?.message || `Command failed (${child.status ?? child.signal}): ${child.stderr.trim().slice(0, 200)}`);

	return JSON.parse(child.stdout);
}

function hookStatus(root, data) {
	if (!data) return { state: "location-unknown", latest: null, hostAcceptance: "unverified" };
	if (!isAbsolute(data)) throw new Error("Plugin data must be an absolute directory");

	const project   = createHash("sha256").update(root).digest("hex").slice(0, 16) ;
	const directory = join(data, "hooks", project)                                 ;
	const records   = []                                                           ;
	let unreadable = 0;
	try {
		if (existsSync(directory)) for (const session of readdirSync(directory, { withFileTypes: true })) {
			if (!session.isDirectory()) continue;
			for (const file of readdirSync(join(directory, session.name), { withFileTypes: true })) {
				if (!file.isFile() || !file.name.endsWith(".json") || file.name === "baseline.json") continue;

				const path = join(directory, session.name, file.name);
				try {
					if (lstatSync(path).size > 256 * 1024) throw new Error("Receipt exceeds HUD limit");
					const receipt = JSON.parse(readFileSync(path, "utf8"));
					if (!["PostToolUse", "Stop"].includes(receipt.event) || !["PASS", "FAIL", "UNSUPPORTED", "NO_CHANGES"].includes(receipt.state) || !Number.isFinite(Date.parse(receipt.at))) throw new Error("Invalid receipt");

					records.push({ event: receipt.event, state: receipt.state, at: receipt.at, path });
				} catch {
					unreadable++;
				}
			}
		}
	} catch {
		unreadable++;
	}
	return { state: unreadable ? "incomplete" : records.length ? "recorded" : "not-observed", latest: records.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0] ?? null, unreadable, hostAcceptance: "unverified" };
}

/** Read installed-host state; inspecting the checkout never substitutes for the installed engine. */
export function collectHud({ root = process.cwd(), pluginData = process.env.PLUGIN_DATA || process.env.CLAUDE_PLUGIN_DATA, run = command, codex = findCommand("codex") } = {}) {
	root = resolve(root);
	const report = { schemaVersion: 1, tool: "boxbox", command: "hud", root, observedAt: new Date().toISOString(), plugin: { state: "unknown" }, runtime: { state: "unknown" }, hooks: { state: "location-unknown", latest: null, hostAcceptance: "unverified" }, releaseReady: false };
	try {
		const list = run(codex, ["plugin", "list", "--marketplace", "boxbox-plugins", "--json"], root);
		if (!Array.isArray(list.installed)) throw new Error("Invalid Codex plugin list");

		const plugin = list.installed.find(item => item.pluginId === "boxbox@boxbox-plugins" && item.installed === true);
		if (!plugin) {
			report.plugin = { state: "not-installed" };
			return report;
		}
		report.plugin = { state: plugin.enabled === true ? "enabled" : "disabled", version: plugin.version, source: plugin.source?.path };
		if (typeof plugin.source?.path !== "string" || !isAbsolute(plugin.source.path)) throw new Error("Installed plugin source is unavailable");

		const runtime = JSON.parse(readFileSync(join(plugin.source.path, "runtime.json"), "utf8"));
		if (![runtime.node, runtime.cli].every(path => typeof path === "string" && isAbsolute(path) && existsSync(path))) throw new Error("Installed engine is missing; rerun its installer");

		const doctor = run({ executable: runtime.node, args: [runtime.cli] }, ["doctor", "--json"], root);
		if (doctor.tool !== "boxbox" || doctor.command !== "doctor" || typeof doctor.runtimeUsable !== "boolean") throw new Error("Invalid installed doctor result");

		report.runtime = { state: doctor.runtimeUsable ? "ready" : "not-ready", formatConfigured: doctor.formatConfigured === true, approval: doctor.checks?.approval?.detail ?? "unknown", formatter: doctor.checks?.formatter?.detail ?? "unknown", fileVerification: "not-run" };
		report.hooks = hookStatus(root, pluginData);
	} catch (error) {
		report.error = error.message;
	}
	return report;
}

export function renderHud(report) {
	const safe = value => String(value).replace(/[\u0000-\u001f\u007f-\u009f]/gu, " ");
	return [
		`BoxBox ${safe(report.plugin.version ?? "—")} | Codex ${safe(report.plugin.state)} | engine ${safe(report.runtime.state)}`,
		`Rules: ${safe(report.runtime.approval ?? "unknown")} | format: ${report.runtime.formatConfigured ? "configured; file verification pending" : "not verified"}`,
		`Hooks: ${safe(report.hooks.state)}${report.hooks.latest ? `; ${safe(report.hooks.latest.state)} at ${safe(report.hooks.latest.at)}` : ""} | host acceptance: unverified`,
		...(report.error ? [`Error: ${safe(report.error)}`] : []),
	].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	try {
		const args = process.argv.slice(2);
		let pluginData;
		for (let index = 0; index < args.length; index++) {
			if (args[index] === "--json") continue;
			if (args[index] === "--plugin-data" && args[index + 1]) { pluginData = args[++index]; continue; }

			throw new Error("Usage: hud [--json] [--plugin-data <absolute-directory>]");
		}
		const report = collectHud({ pluginData });
		console.log(args.includes("--json") ? JSON.stringify(report) : renderHud(report));
		process.exitCode = report.error ? 1 : 0;
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
