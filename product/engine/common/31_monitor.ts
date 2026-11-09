import      { createHash, randomUUID                                      } from "node:crypto"                       ;
import      {
              closeSync                                                 ,
              existsSync                                                ,
              lstatSync                                                 ,
              mkdirSync                                                 ,
              openSync                                                  ,
              readFileSync                                              ,
              readSync                                                  ,
              readdirSync                                               ,
              realpathSync                                              ,
              renameSync                                                ,
              unlinkSync                                                ,
              writeFileSync
                                                                          } from "node:fs"                           ;
import      { homedir                                                     } from "node:os"                           ;
import      { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path"                         ;
import      { snapshot                                                    } from "@/common/25_guarded-run.ts"        ;
import      { readLifecycleReceipt                                        } from "@/common/29_lifecycle-receipt.ts"  ;
import type { LifecycleCoverage, LifecycleEvent, LifecycleState           } from "@/common/29_lifecycle-receipt.ts"  ;
import      { hostSessionUsage                                            } from "@/common/30_session-usage.ts"      ;
import type { HostSessionUsage, SessionHost, Totals                       } from "@/common/30_session-usage.ts"      ;
import      {
              captureLifecycleBaseline                                  ,
              compareBaselineFootprints                                 ,
              decodeLifecycleBaseline
                                                                          } from "@/common/32_lifecycle-baseline.ts" ;
import type { FootprintComparison, LifecycleBaselineV2                    } from "@/common/32_lifecycle-baseline.ts" ;

export interface MonitorReceipt {
	readonly event    : LifecycleEvent           ;
	readonly state    : LifecycleState           ;
	readonly at       : string | null            ;
	readonly legacy   : boolean                  ;
	readonly coverage : LifecycleCoverage | null ;
}

export interface MonitorSession {
	readonly id         : string                    ;
	readonly usage      : HostSessionUsage | null   ;
	readonly footprint  : FootprintComparison       ;
	readonly receipts   : readonly MonitorReceipt[] ;
	readonly unreadable : number                    ;
}

export interface MonitorReport {
	readonly schemaVersion : 1                         ;
	readonly tool          : "boxbox"                  ;
	readonly command       : "monitor"                 ;
	readonly host          : SessionHost               ;
	readonly generatedAt   : string                    ;
	readonly totals        : Totals                    ;
	readonly sessions      : readonly MonitorSession[] ;
	readonly notes         : readonly string[]         ;
}

export interface MonitorOptions {
	readonly root       : string      ;
	readonly host       : SessionHost ;
	readonly pluginData : string      ;
	readonly sessionId? : string      ;
	readonly noPaths?   : boolean     ;
	/** Explicit record sources support deterministic callers; project ownership is still checked. */
	readonly recordPaths?: readonly string[];
	readonly home?       : string;
}

const MAX_RECORD_BYTES = 64 * 1024 * 1024                                                                                                                                          ;
const MAX_RECORDS      = 2000                                                                                                                                                      ;
const hash             = (text: string): string => createHash("sha256").update(text).digest("hex")                                                                                 ;
const record           = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null ;
const inside = (parent: string, child: string): boolean => {
	const path = relative(parent, child);
	return path === "" || path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
};

/** Check owned components only; existing unowned ancestor aliases resolve through the host filesystem. */
function directory(path: string, create: boolean, boundary = path): boolean {
	const owner  = resolve(boundary) ;
	const target = resolve(path    ) ;
	if (!inside(owner, target)) throw new Error("Monitor directory leaves its owned boundary");
	const parent = physicalPath(dirname(owner));
	if (create) mkdirSync(parent, { recursive: true, mode: 0o700 });
	let current = join(parent, basename(owner))                      ;
	const parts = relative(owner, target).split(sep).filter(Boolean) ;
	for (let index = 0; index <= parts.length; index += 1) {
		if (index > 0) current = join(current, parts[index - 1]!);
		let status;
		try { status = lstatSync(current); }
		catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("Unreadable monitor data directory");
			if (!create) return false;
			mkdirSync(current, { mode: 0o700 });
			status = lstatSync(current);
		}
		if (!status.isDirectory() || status.isSymbolicLink()) throw new Error("Unsafe monitor data directory");
	}
	return true;
}

function physicalPath(path: string): string {
	try { return realpathSync(path); }
	catch (error) {
		const parent = dirname(path);
		if ((error as NodeJS.ErrnoException).code !== "ENOENT" || parent === path) throw new Error("Unreadable monitor data path");
		return join(physicalPath(parent), basename(path));
	}
}

function pluginData(root: string, data: string, create: boolean): string {
	if (!isAbsolute(root) || !isAbsolute(data)) throw new Error("Monitor requires absolute project and plugin-data paths");
	const status = lstatSync(root);
	if (!status.isDirectory() || status.isSymbolicLink()) throw new Error("Unsafe monitor project directory");
	const project   = realpathSync(root                                                 ) ;
	const requested = resolve     (data                                                 ) ;
	const target    = join        (physicalPath(dirname(requested)), basename(requested)) ;
	if (inside(project, target)) throw new Error("Monitor output must be outside the project in plugin data");
	directory(target, create);
	return target;
}

function safeRead(path: string, maximum = MAX_RECORD_BYTES): string {
	const status = lstatSync(path);
	if (!status.isFile() || status.isSymbolicLink() || status.size > maximum) throw new Error("Unreadable monitor input");
	return readFileSync(path, "utf8");
}

function sessionFiles(base: string, depth: number, results: string[] = [], boundary = base): string[] {
	if (!directory(base, false, boundary)) return results;
	for (const entry of readdirSync(base, { withFileTypes: true }).sort((a, b) => b.name.localeCompare(a.name))) {
		if (results.length >= MAX_RECORDS) break;
		const path = join(base, entry.name);
		if (entry.isDirectory() && depth > 0) sessionFiles(path, depth - 1, results, boundary);
		else if (entry.isFile() && entry.name.endsWith(".jsonl")) results.push(path);
	}
	return results;
}

/** A record belongs to the project only through explicit host-recorded cwd metadata. */
function sessionProject(lines: readonly string[], root: string): boolean {
	for (const line of lines.slice(0, 128)) {
		let entry: Record<string, unknown> | null;
		try { entry = record(JSON.parse(line)); } catch { continue; }
		const cwd = entry?.type === "session_meta" ? record(entry.payload)?.cwd : entry?.cwd;
		if (typeof cwd === "string" && isAbsolute(cwd)) {
			try { return realpathSync(cwd) === root; } catch { return false; }
		}
	}
	return false;
}

function recordHeader(path: string): string[] {
	if (!directory(dirname(path), false)) return [];
	const status = lstatSync(path);
	if (!status.isFile() || status.isSymbolicLink() || status.size > MAX_RECORD_BYTES) throw new Error("Unreadable monitor input");
	const descriptor = openSync(path, "r");
	try {
		const buffer = Buffer.alloc(256 * 1024                             ) ;
		const size   = readSync    (descriptor, buffer, 0, buffer.length, 0) ;
		return buffer.subarray(0, size).toString("utf8").split("\n").slice(0, 128);
	} finally {
		closeSync(descriptor);
	}
}

function readRecord(path: string, host: SessionHost): string[] {
	if (!directory(dirname(path), false)) return [];
	const lines = safeRead(path).split("\n");
	if (host === "claude") {
		const folder = join(path.replace(/\.jsonl$/u, ""), "subagents");
		if (directory(folder, false, dirname(path))) {
			for (const entry of readdirSync(folder, { withFileTypes: true })) {
				if (entry.isFile() && entry.name.endsWith(".jsonl")) lines.push(...safeRead(join(folder, entry.name)).split("\n"));
			}
		}
	}
	return lines;
}

function receiptSummary(path: string): MonitorReceipt {
	const value = readLifecycleReceipt(path    ) ;
	const time  = Date.parse          (value.at) ;
	return {
		event    : value.event                                                 ,
		state    : value.state                                                 ,
		at       : Number.isFinite(time) ? new Date(time).toISOString() : null ,
		legacy   : value.schemaVersion === undefined                           ,
		coverage : value.coverage ?? null                                      ,
	};
}

/** Summarize only allowed receipt fields, never its source-bearing groups, tools or errors. */
export function monitorReceiptSummary(path: string): MonitorReceipt {
	return receiptSummary(path);
}

/** Build a current-project report without writing sources, session records or plugin data. */
export function buildMonitorReport(options: MonitorOptions): MonitorReport {
	const root = realpathSync(options.root)                          ;
	const data = pluginData(options.root, options.pluginData, false) ;
	const home = options.home ?? homedir()                           ;
	const sourceRoot = options.host === "claude"
		? join(options.home ? join(home, ".claude") : process.env.CLAUDE_CONFIG_DIR ?? join(home, ".claude"), "projects")
		: join(options.home ? join(home, ".codex") : process.env.CODEX_HOME ?? join(home, ".codex"), "sessions");
	let unreadableRecords = 0;
	let sources: readonly string[];
	try { sources = options.recordPaths ?? sessionFiles(sourceRoot, options.host === "claude" ? 1 : 4); }
	catch { sources = []; unreadableRecords += 1; }
	const sessions   = new Map<string, { id: string; usage: HostSessionUsage | null }>() ;
	const recordedAt = new Map<string, number>()                                         ;
	for (const path of sources) {
		try {
			if (!sessionProject(recordHeader(path), root)) continue;
			const lines = readRecord      (path, options.host ) ;
			const usage = hostSessionUsage(options.host, lines) ;
			if (!usage.session) { unreadableRecords += 1; continue; }
			if (options.sessionId && usage.session !== options.sessionId) continue;
			sessions.set(hash(usage.session), { id: usage.session, usage });
			recordedAt.set(usage.session, lstatSync(path).mtimeMs);
		} catch {
			unreadableRecords += 1;
		}
	}
	const namespace = join(data, "hooks", hash(root).slice(0, 16));
	if (directory(namespace, false, data)) {
		for (const entry of readdirSync(namespace, { withFileTypes: true })) {
			if (!entry.isDirectory() || !/^[a-f0-9]{64}$/u.test(entry.name)) continue;
			if (options.sessionId && entry.name !== hash(options.sessionId)) continue;
			if (!sessions.has(entry.name)) sessions.set(entry.name, { id: options.sessionId ?? entry.name, usage: null });
		}
	}
	const current                            = snapshot(root) ;
	let currentFootprints : LifecycleBaselineV2 | undefined   ;
	const rows            : MonitorSession[] = []             ;
	for (const [key, session] of sessions) {
		let footprint  : MonitorSession["footprint"] = { available: false, files: [], totals: null } ;
		let unreadable                               = 0                                             ;
		const receipts : MonitorReceipt[]            = []                                            ;
		const folder                                 = join(namespace, key)                          ;
		if (directory(folder, false, data)) {
			for (const entry of readdirSync(folder, { withFileTypes: true })) {
				if (!entry.name.endsWith(".json")) continue;
				try {
					const path = join(folder, entry.name);
					if (entry.name === "baseline.json") {
						const baseline = decodeLifecycleBaseline(JSON.parse(safeRead(path, 8 * 1024 * 1024)));
						if (baseline.schemaVersion === 2) currentFootprints ??= captureLifecycleBaseline(root, current);
						footprint = compareBaselineFootprints(root, baseline, current, currentFootprints);
					}
					else receipts.push(receiptSummary(path));
				} catch {
					unreadable += 1;
				}
			}
		}
		rows.push({ ...session, footprint, receipts: receipts.sort((a, b) => (a.at ?? "").localeCompare(b.at ?? "")), unreadable });
	}
	const timeOf = (session: MonitorSession): number => Date.parse(session.receipts.at(-1)?.at ?? "") || recordedAt.get(session.id) || 0;
	rows.sort((a, b) => timeOf(b) - timeOf(a) || a.id.localeCompare(b.id));
	const names   = [...new Set(rows.flatMap(row => row.footprint.files.map(file => file.file)))].sort() ;
	const aliases = new Map(names.map((name, index) => [name, `file-${index + 1}`]))                     ;
	const outputSessions = options.noPaths ? rows.map(row => ({
		...row,
		footprint: { ...row.footprint, files: row.footprint.files.map(file => ({ ...file, file: aliases.get(file.file)! })) },
	})) : rows;
	const totals = rows.reduce((total, session) => {
		const value = session.usage?.total;
		return {
			turns      : total.turns + (value?.turns ?? 0)           ,
			input      : total.input + (value?.input ?? 0)           ,
			cacheRead  : total.cacheRead + (value?.cacheRead ?? 0)   ,
			cacheWrite : total.cacheWrite + (value?.cacheWrite ?? 0) ,
			output     : total.output + (value?.output ?? 0)         ,
		};
	}, { turns: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0 });
	return {
		schemaVersion : 1                        ,
		tool          : "boxbox"                 ,
		command       : "monitor"                ,
		host          : options.host             ,
		generatedAt   : new Date().toISOString() ,
		totals                    ,
		sessions : outputSessions ,
		notes    : [
			"This report measures recorded volume, not correctness or savings. Whitespace byte deltas are observed changes, not proof that BoxBox caused them.",
			"Footprint fingerprints preserve token text, comments, indentation and physical line breaks. A matching fingerprint is not a semantic approval.",
			"Session ownership is read from bounded host metadata; records without a project cwd in their first 128 lines are omitted.",
			...(unreadableRecords ? [`${unreadableRecords} session record(s) were unreadable or lacked a session identity.`] : []),
			...(sources.length >= MAX_RECORDS ? ["Session discovery reached its bounded record limit; older sessions may be absent."] : []),
		],
	};
}

const escapeHtml = (value: unknown): string => String(value ?? "").replace(/[&<>"']/gu, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!)                                                                                                                                      ;
const table      = (headers: readonly string[], rows: readonly (readonly unknown[])[]): string => `<table><thead><tr>${headers.map(value => `<th>${escapeHtml(value)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(value => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("")}</tbody></table>` ;

/** Self-contained local HTML. Every dynamic string is escaped and no remote assets are loaded. */
export function renderMonitorHtml(report: MonitorReport): string {
	const tokenHeaders = ["Model:effort", "Turns/events", "Fresh input", "Cache read", "Cache write", "Output"]                                      ;
	const total        = report.totals                                                                                                               ;
	const summary      = table(tokenHeaders, [["All readable sessions", total.turns, total.input, total.cacheRead, total.cacheWrite, total.output]]) ;
	const sessions = report.sessions.map(session => {
		const usage  = session.usage                                                                                                                                             ;
		const totals = usage ? Object.entries(usage.byModel).map(([model, value]) => [model, value.turns, value.input, value.cacheRead, value.cacheWrite, value.output]) : []    ;
		const steps  = usage ? Object.entries(usage.byCategory).map(([step, value]) => [step, value.calls, value.input, value.cacheRead, value.output, value.resultTokens]) : [] ;
		const hooks  = Object.entries(usage?.hooks ?? {}).map(([event, value]) => [event, value.count, value.tokens])                                                            ;
		const files = session.footprint.files.map(file => [
			file.file,
			file.change,
			file.before?.bytes ?? "unknown",
			file.after?.bytes ?? "unknown",
			file.before?.lines ?? "unknown",
			file.after?.lines ?? "unknown",
			file.whitespaceBytes ?? "unattributed",
		]);
		const receipts  = session.receipts.map(value => [value.event, value.state, value.at ?? "unknown", value.legacy, value.coverage?.changedFiles ?? "unknown", value.coverage?.groups ?? "unknown"]) ;
		const footprint = session.footprint.totals                                                                                                                                                       ;
		const footprintTotals = footprint ? table(
			["Bytes before", "Bytes now", "Lines before", "Lines now", "Whitespace byte delta", "Growth tokens (est.)", "Content-changed files", "Unknown files"],
			[[footprint.beforeBytes ?? "unknown", footprint.afterBytes ?? "unknown", footprint.beforeLines ?? "unknown", footprint.afterLines ?? "unknown", footprint.whitespaceBytes, footprint.whitespaceTokensEstimated, footprint.contentChangedFiles, footprint.unknownFiles]],
		) : "";
		return [
			`<section><h2>Session ${escapeHtml(session.id)}</h2>`,
			`<p>${usage?.readable ? "Recorded usage" : "Usage unavailable"}</p>`,
			table(tokenHeaders, totals),
			"<h3>Steps</h3>",
			`<p>Token attribution: ${escapeHtml(usage?.attribution ?? "unavailable")}. Result and hook tokens are estimates.</p>`,
			table(["Step", "Calls", "Fresh input", "Cache read", "Output", "Result tokens (est.)"], steps),
			table(["Hook", "Count", "Text tokens (est.)"], hooks),
			"<h3>Change footprint</h3>",
			`<p>${session.footprint.available ? "Current files compared with the session baseline" : "Before sizes unavailable (missing or legacy baseline)"}</p>`,
			footprintTotals,
			table(["File", "Change", "Bytes before", "Bytes now", "Lines before", "Lines now", "Whitespace byte delta"], files),
			"<h3>Hook receipts</h3>",
			table(["Event", "State", "At", "Legacy", "Changed files", "Groups"], receipts),
			`<p>Unreadable evidence files: ${session.unreadable}</p>`,
			...(usage?.notes ?? []).map(note => `<p>${escapeHtml(note)}</p>`),
			"</section>",
		].join("");
	}).join("");
	return [
		'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>BoxBox monitor</title>',
		"<style>body{font:15px system-ui;max-width:1100px;margin:2rem auto;padding:0 1rem;color:#162334;background:#f5f7fa}section{background:white;padding:1.3rem;margin:1rem 0;border:1px solid #dce2e9;border-radius:8px}",
		"table{border-collapse:collapse;width:100%;font-size:.85rem;display:block;overflow:auto}td,th{padding:.45rem;text-align:left;border-bottom:1px solid #dce2e9;white-space:nowrap}h1,h2,h3{line-height:1.2}p{color:#405169}</style>",
		`<h1>BoxBox ${escapeHtml(report.host)} monitor</h1><p>Generated ${escapeHtml(report.generatedAt)}</p>`,
		summary,
		...report.notes.map(note => `<p>${escapeHtml(note)}</p>`),
		sessions || "<p>No matching sessions were found.</p>",
		"</html>",
	].join("");
}

/** Atomically replace only a report path inside external plugin data. */
export function writeMonitorReport(report: MonitorReport, options: { readonly root: string; readonly pluginData: string; readonly path?: string }): string {
	const data      = pluginData(options.root, options.pluginData, true)        ;
	const requested = options.path ?? join(data, `monitor-${report.host}.html`) ;
	if (!isAbsolute(requested)) throw new Error("Monitor HTML path must be inside plugin data");
	const absolute     = resolve(requested)                                   ;
	const suppliedData = resolve(options.pluginData)                          ;
	const owner        = inside(suppliedData, absolute) ? suppliedData : data ;
	if (!inside(owner, absolute) || absolute === owner) throw new Error("Monitor HTML path must be inside plugin data");
	const path = join(data, relative(owner, absolute));
	if (extname(path).toLowerCase() !== ".html") throw new Error("Monitor report destination must use a .html extension");
	if (relative(data, path).split(sep)[0]?.toLowerCase() === "hooks") throw new Error("Monitor report destination must stay outside hook evidence");

	directory(dirname(path), true, data);
	try {
		const status = lstatSync(path);
		if (!status.isFile() || status.isSymbolicLink()) throw new Error("Unsafe monitor report destination");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("Unsafe monitor report destination");
	}
	const temporary = join(dirname(path), `.monitor-${randomUUID()}.tmp`);
	try {
		writeFileSync(temporary, renderMonitorHtml(report), { flag: "wx", mode: 0o600 });
		renameSync(temporary, path);
	} finally {
		if (existsSync(temporary)) unlinkSync(temporary);
	}
	return path;
}
