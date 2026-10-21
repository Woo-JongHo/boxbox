import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, opendirSync, readSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LIMIT = 256 * 1024;
const STALE_MS = 5 * 60 * 1000;
const hash = value => createHash("sha256").update(value).digest("hex");
const safe = value => String(value).replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu, " ");

function directEntry() {
	try { return typeof process.argv[1] === "string" && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
	catch { return false; }
}

function regular(path) {
	if (typeof path !== "string" || !isAbsolute(path)) throw new Error("Expected an absolute file path");
	const stat = lstatSync(path);
	if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Expected a regular file");
}

function jsonFile(path) {
	regular(path);
	const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
	try {
		const stat = fstatSync(fd);
		if (!stat.isFile() || stat.size > LIMIT) throw new Error("JSON file exceeds HUD limit or is not regular");
		const buffer = Buffer.alloc(LIMIT + 1);
		let bytes = 0;
		let count;
		do {
			count = readSync(fd, buffer, bytes, buffer.length - bytes, null);
			bytes += count;
		} while (count && bytes < buffer.length);
		if (bytes > LIMIT) throw new Error("JSON file exceeds HUD limit");
		return JSON.parse(buffer.subarray(0, bytes).toString("utf8"));
	} finally {
		closeSync(fd);
	}
}

function directory(path) {
	const stat = lstatSync(path);
	if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Expected a real receipt directory");
}

function timestamp(value) {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/u.test(value)) throw new Error("Invalid receipt timestamp");
	const time = Date.parse(value);
	if (!Number.isFinite(time) || time > Date.now() + 60_000) throw new Error("Invalid receipt timestamp");
	return time;
}

function receiptStatus({ root, sessionId, pluginData, hudData }) {
	const scope = sessionId ? "current-session" : "latest-project";
	const unknown = { state: "location-unknown", scope, latest: null, hostAcceptance: "unverified" };
	let location = pluginData;
	try {
		if (!location) {
			if (!hudData) return unknown;
			if (!isAbsolute(hudData)) throw new Error("HUD data location is not absolute");
			directory(hudData);
			const pointer = jsonFile(join(hudData, `${hash(root).slice(0, 16)}.json`));
			if (pointer.schemaVersion !== 1 || pointer.root !== root || !/^[a-f0-9]{64}$/u.test(pointer.sessionHash)) throw new Error("Invalid project receipt pointer");
			timestamp(pointer.observedAt);
			if (sessionId && pointer.sessionHash !== hash(sessionId)) return { ...unknown, state: "session-mismatch" };
			location = pointer.directory;
			if (typeof location !== "string" || basename(location) !== pointer.sessionHash) throw new Error("Receipt pointer session does not match its directory");
		}
		if (typeof location !== "string" || !isAbsolute(location)) throw new Error("Receipt location is not absolute");
		location = resolve(location);
		const project = hash(root).slice(0, 16);
		const local = dirname(location) === join(root, ".boxbox", "hooks");
		if (!/^[a-f0-9]{64}$/u.test(basename(location)) || (!local && (basename(dirname(location)) !== project || basename(dirname(dirname(location))) !== "hooks"))) throw new Error("Receipt location belongs to another project");
		if (sessionId && basename(location) !== hash(sessionId)) return { ...unknown, state: "session-mismatch" };
		for (const path of [location, dirname(location), dirname(dirname(location))]) directory(path);

		const dir = opendirSync(location);
		let latest = null;
		const receipts = [];
		let receiptCount = 0;
		try {
			for (let entry = dir.readSync(); entry; entry = dir.readSync()) {
				if (entry.name === "baseline.json" || entry.name === "stop-blocked") continue;
				if (!entry.name.endsWith(".json")) continue;
				if (!entry.isFile() || entry.isSymbolicLink()) throw new Error("Receipt is not a regular file");
				receiptCount++;
				if (receiptCount <= 256) receipts.push(entry.name);
				else {
					if (receiptCount === 257) {
						const generated = receipts.filter(name => /^\d{13}-[0-9a-f-]{36}\.json$/u.test(name));
						receipts.splice(0, receipts.length, ...generated);
					}
					if (/^\d{13}-[0-9a-f-]{36}\.json$/u.test(entry.name)) receipts.push(entry.name);
					receipts.sort();
					if (receipts.length > 256) receipts.shift();
				}
			}
		} finally {
			dir.closeSync();
		}
		if (receiptCount > 256 && receipts.length === 0) throw new Error("Receipt directory has no bounded recent records");
		for (const name of receipts) {
			const receipt = jsonFile(join(location, name));
			if (!["PostToolUse", "Stop"].includes(receipt.event) || !["PASS", "FAIL", "UNSUPPORTED", "NO_CHANGES"].includes(receipt.state) || receipt.automaticFixPerformed !== false) throw new Error("Invalid receipt record");
			const time = timestamp(receipt.at);
			if (latest && time === Date.parse(latest.at) && receipt.state !== latest.state) throw new Error("Conflicting receipt states share a timestamp");
			if (!latest || time > Date.parse(latest.at)) latest = { event: receipt.event, state: receipt.state, at: receipt.at };
		}
		if (!latest) return { ...unknown, state: "not-observed" };
		const ageSeconds = Math.max(0, Math.floor((Date.now() - Date.parse(latest.at)) / 1000));
		return { ...unknown, state: ageSeconds * 1000 > STALE_MS ? "stale" : "recorded", latest, ageSeconds };
	} catch (error) {
		return { ...unknown, state: "unknown", error: error.message };
	}
}

/** Read only the explicitly installed runtime. Presence never implies host enablement or hook trust. */
export function collectStatus({ pluginRoot, root = process.cwd(), host = "codex", sessionId, pluginData, run = spawnSync } = {}) {
	root = resolve(root);
	const report = {
		schemaVersion: 1, tool: "boxbox", command: "hud", root, host, observedAt: new Date().toISOString()                                               ,
		plugin       : { state: "unknown", enabled: "unknown", trusted: "unknown" }                                                                      ,
		runtime      : { state: "unknown", approval: "unknown", approvedCount: null }                                                                    ,
		hooks        : { state: "location-unknown", scope: sessionId ? "current-session" : "latest-project", latest: null, hostAcceptance: "unverified" },
		errors       : []                                                                                                                                ,
	};
	let runtime;
	try {
		if (!["codex", "claude"].includes(host)) throw new Error("Unknown HUD host");
		if (typeof pluginRoot !== "string" || !isAbsolute(pluginRoot)) throw new Error("Installed plugin root is required");
		const manifest = jsonFile(join(pluginRoot, host === "claude" ? ".claude-plugin/plugin.json" : ".codex-plugin/plugin.json"));
		if (manifest.name !== "boxbox" || typeof manifest.version !== "string" || !/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/u.test(manifest.version)) throw new Error("Invalid installed plugin manifest");
		report.plugin = { ...report.plugin, state: "installed", version: manifest.version };
		runtime = jsonFile(join(pluginRoot, "runtime.json"));
		regular(runtime.node);
		regular(runtime.cli);
		const child = run(runtime.node, [runtime.cli, "doctor", "--json"], {
			cwd: root, encoding: "utf8", timeout: 5_000, maxBuffer: LIMIT, killSignal: "SIGKILL", windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
		});
		if (child.error || child.signal || ![0, 1].includes(child.status)) throw new Error("Installed engine doctor failed or timed out");
		if (typeof child.stdout !== "string" || Buffer.byteLength(child.stdout) > LIMIT) throw new Error("Invalid doctor output");
		const doctor = JSON.parse(child.stdout);
		if (doctor.tool !== "boxbox" || doctor.command !== "doctor" || typeof doctor.runtimeUsable !== "boolean" || child.status !== (doctor.runtimeUsable ? 0 : 1)) throw new Error("Invalid installed doctor result");
		const approval = doctor.checks?.approval?.detail;
		const count = typeof approval === "string" ? /^(\d+) approved convention record\(s\) loaded;/u.exec(approval) : null;
		report.runtime = {
			state           : doctor.runtimeUsable ? "ready" : "not-ready", approval: typeof approval === "string" ? approval : "unknown",
			approvedCount   : count ? Number(count[1]) : approval === "approved convention registry is empty" ? 0 : null                 ,
			formatConfigured: doctor.formatConfigured === true, fileVerification: "not-run"                                              ,
		};
	} catch (error) {
		report.errors.push(error.message);
	}
	report.hooks = receiptStatus({ root, sessionId, pluginData, hudData: runtime?.hudData });
	return report;
}

export function renderStatus(report, { compact = false, columns = 120, showProject = false } = {}) {
	const hooks   = report.hooks                                                                                                                                 ;
	const scope   = hooks.scope === "current-session" ? "session" : "project history (not current session)"                                                      ;
	const check   = hooks.latest ? `${hooks.state === "stale" ? "historical " : ""}${hooks.latest.state}, ${hooks.ageSeconds}s ago` : `unknown (${hooks.state})` ;
	const title   = `BoxBox ${report.plugin.version ?? "?"} | engine ${report.runtime.state} | approved ${report.runtime.approvedCount ?? "?"}`                  ;
	const project = showProject ? [`Pinned project: ${basename(report.root)} (${report.root})`] : []                                                             ;
	const lines = compact ? [title, ...project, `${scope} receipt: ${check} | file not run | host unverified`] : [
		title,
		...project,
		`Rules: ${report.runtime.approval}; file verification: not run`,
		`Last ${scope}: ${check}`,
		`Plugin ${report.plugin.state}; enabled/trusted: unknown | host acceptance: unverified`,
		...report.errors.map(error => `Error: ${error}`),
		...(hooks.error ? [`Receipts: ${hooks.error}`] : []),
	];
	const width = Number.isFinite(columns) ? Math.max(1, Math.floor(columns)) : 120;
	return lines.map(line => {
		const chars = Array.from(safe(line));
		return chars.length > width ? chars.slice(0, width - 1).join("") + "…" : chars.join("");
	}).join("\n");
}

async function readInput() {
	const chunks = [];
	let length = 0;
	const timer = setTimeout(() => process.stdin.destroy(new Error("Status input timed out")), 2_000);
	try {
		for await (const chunk of process.stdin) {
			length += chunk.length;
			if (length > LIMIT) throw new Error("Status input exceeds HUD limit");
			chunks.push(chunk);
		}
		return JSON.parse(Buffer.concat(chunks).toString("utf8"));
	} finally {
		clearTimeout(timer);
	}
}

async function main() {
	const options = {};
	const args = process.argv.slice(2);
	for (let index = 0; index < args.length; index++) {
		const key = args[index];
		if (["--json", "--watch", "--claude-statusline"].includes(key)) { options[key] = true; continue; }
		if (["--plugin-root", "--root", "--host"].includes(key) && args[index + 1]) { options[key] = args[++index]; continue; }
		throw new Error("Usage: status --plugin-root ABS [--root ABS] [--host codex|claude] [--json|--watch|--claude-statusline]");
	}
	if ([options["--json"], options["--watch"], options["--claude-statusline"]].filter(Boolean).length > 1) throw new Error("Choose one output mode");
	let root = options["--root"] ?? process.cwd();
	let sessionId;
	if (options["--claude-statusline"]) {
		const input = await readInput();
		if (typeof input.cwd !== "string" || !isAbsolute(input.cwd) || typeof input.session_id !== "string" || !input.session_id) throw new Error("Claude status input requires cwd and session_id");
		root = input.cwd;
		sessionId = input.session_id;
	}
	if (!isAbsolute(root)) throw new Error("Project root must be absolute");
	const refresh = () => {
		const report   = collectStatus({ pluginRoot: options["--plugin-root"], root, host: options["--claude-statusline"] ? "claude" : options["--host"] ?? "codex", sessionId })                                                                   ;
		const watching = options["--watch"] && process.stdout.isTTY                                                                                                                                                                                 ;
		const rows     = Math.max(1, process.stdout.rows || 4)                                                                                                                                                                                      ;
		const output   = options["--json"] ? JSON.stringify(report) : renderStatus(report, { compact: Boolean(options["--claude-statusline"] || (watching && rows <= 4)), columns: process.stdout.columns || 120, showProject: Boolean(watching) }) ;
		if (watching) process.stdout.write("\u001b[H\u001b[2J" + output.split("\n").slice(0, rows).join("\n"));
		else process.stdout.write(output + "\n");
	};
	refresh();
	if (options["--watch"] && process.stdout.isTTY) {
		const timer = setInterval(refresh, 2_000);
		for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { clearInterval(timer); process.exitCode = 0; });
	}
}

if (directEntry()) {
	main().catch(error => { process.stdout.write(`BoxBox unknown | ${safe(error.message)}\n`); process.exitCode = 1; });
}
