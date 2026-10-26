import      { randomUUID, createHash             } from "node:crypto"              ;
import      { spawn, spawnSync                   } from "node:child_process"       ;
import      {
              existsSync                       ,
              closeSync                        ,
              lstatSync                        ,
              mkdirSync                        ,
              openSync                         ,
              readdirSync                      ,
              readFileSync                     ,
              readSync                         ,
              readlinkSync                     ,
              realpathSync                     ,
              renameSync                       ,
              statSync                         ,
              writeFileSync                    ,
                                                 } from "node:fs"                  ;
import      { extname, isAbsolute, join, resolve } from "node:path"                ;
import      { tmpdir                             } from "node:os"                  ;
import type { FileResult                         } from "@/common/result-json.ts"  ;
import      { acquireProcessLock                 } from "@/common/process-lock.ts" ;

const excluded         = new Set([".git", ".boxbox", "node_modules", ".venv", "venv", "__pycache__", "dist", "build"])                                                      ;
export const supported = new Set([".ts", ".tsx", ".mts", ".cts", ".py", ".json", ".yaml", ".yml"])                                                                          ;
const code             = new Set([...supported, ".js", ".jsx", ".mjs", ".cjs", ".java", ".go", ".rs", ".c", ".h", ".cpp", ".hpp", ".swift", ".kt", ".yaml", ".yml", ".sh"]) ;

export type Snapshot   = Record<string, string>                              ;
export type Inspection = (root: string, file: string) => Promise<FileResult> ;
type Preflight         = (root: string) => { runtimeUsable: boolean }        ;
type RunRecord         = Record<string, any>                                 ;
type RunReceiptIO      = {
	list(directory: string): string[];
	isSafeFile(path: string): boolean;
	readHeader(path: string): Buffer;
	readFull(path: string): string;
};

const receiptHeaderBytes  = 64 * 1024        ;
const maximumReceiptBytes = 64 * 1024 * 1024 ;

const runReceiptIO: RunReceiptIO = {
	list       : directory => readdirSync(directory)                                                          ,
	isSafeFile : path => { const entry = lstatSync(path); return entry.isFile() && !entry.isSymbolicLink(); } ,
	readHeader : path => {
		const descriptor = openSync(path, "r");
		try {
			const buffer = Buffer.allocUnsafe(receiptHeaderBytes);
			return buffer.subarray(0, readSync(descriptor, buffer, 0, buffer.length, 0));
		} finally { closeSync(descriptor); }
	},
	readFull   : path => {
		if (statSync(path).size > maximumReceiptBytes) throw new Error("Evidence file exceeds the status size limit");
		return readFileSync(path, "utf8");
	},
};

export function lockDirectory(root: string): string {
	const canonical = realpathSync(root);
	const base = process.platform === "darwin"
		? join("/private/tmp", `boxbox-locks-${process.getuid?.() ?? "unknown"}`)
		: join(tmpdir(), "boxbox-locks");
	return join(base, createHash("sha256").update(canonical).digest("hex").slice(0, 32));
}

function hashFile(path: string): string {
	const hash       = createHash        ("sha256" ) ;
	const descriptor = openSync          (path, "r") ;
	const buffer     = Buffer.allocUnsafe(64 * 1024) ;
	try {
		for (;;) {
			const bytes = readSync(descriptor, buffer, 0, buffer.length, null);
			if (!bytes) break;
			hash.update(buffer.subarray(0, bytes));
		}
	} finally { closeSync(descriptor); }
	return hash.digest("hex");
}

function advisoryStatusLock(args: readonly string[], root: string, json: boolean): number | null {
	if (process.platform !== "darwin") return null;
	const directory = lockDirectory(root);
	mkdirSync(directory, { recursive: true, mode: 0o700 });
	const path = join(directory, "status.advisory.lock");
	if (process.env.BOXBOX_STATUS_LOCK_PATH === path) {
		const probe = spawnSync("/usr/bin/lockf", ["-k", "-t", "0", path, "/usr/bin/true"], { stdio: "ignore" });
		if (probe.status !== 0) return null;
		throw new Error("STATUS_LOCK_NOT_HELD");
	}
	const entry = process.argv[1];
	if (!entry) throw new Error("Missing CLI entry path");
	const child = spawnSync("/usr/bin/lockf", ["-k", "-t", "0", path, process.execPath, entry, "status", ...args], {
		env: { ...process.env, BOXBOX_STATUS_LOCK_PATH: path } ,
		stdio: "inherit"                                         ,
	});
	if (child.error) throw child.error;
	if (child.status === 75) {
		emit({ command: "status", root, state: "TOOL_ERROR", errorCode: "CONCURRENT_OPERATION", nativeHookVerified: false }, json);
		return 2;
	}
	return child.status ?? 2;
}

export function loadLatestRun(directory: string, io: RunReceiptIO = runReceiptIO): { runs: number; latest: RunRecord | null } {
	const names                   = io.list(directory).filter(name => /^[a-f0-9-]+\.json$/.test(name)) ;
	let latestPath: string | null = null                                                               ;
	let latestStartedAt           = ""                                                                 ;
	for (const name of names) {
		const path = join(directory, name);
		if (!io.isSafeFile(path)) throw new Error("Unsafe evidence file");
		const header    = io.readHeader(path).toString("utf8")            ;
		const startedAt = /"startedAt"\s*:\s*"([^"]+)"/.exec(header)?.[1] ;
		if (!startedAt) throw new Error("Invalid evidence file header");
		if (!latestPath || startedAt > latestStartedAt) {
			latestPath = path;
			latestStartedAt = startedAt;
		}
	}
	if (!latestPath) return { runs: 0, latest: null };
	const latest = JSON.parse(io.readFull(latestPath)) as RunRecord;
	if (latest.startedAt !== latestStartedAt) throw new Error("Evidence file changed during status");
	return { runs: names.length, latest };
}

function options(args: readonly string[], run: boolean) {
	const separator = args.indexOf("--")                              ;
	const flags     = separator < 0 ? args : args.slice(0, separator) ;
	const command   = separator < 0 ? [] : args.slice(separator + 1)  ;
	let root        = ""                                              ;
	let json        = false                                           ;
	for (let i = 0; i < flags.length; i++) {
		if (flags[i] === "--json") { json = true; continue; }
		if (flags[i] === "--root" && !root) { root = flags[++i] ?? ""; continue; }
		throw new Error("Expected --root <absolute-path> [--json]");
	}
	if (!root || !isAbsolute(root)) throw new Error("An explicit absolute --root is required");
	if (!lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink()) throw new Error("Root must be a real directory");
	if (run && !command.length) throw new Error("Expected -- <command> [args...]");
	if (!run && separator >= 0) throw new Error("status accepts no child command");
	return { root: resolve(root), json, command };
}

export function snapshot(root: string, prefix = "", result: Snapshot = {}, ignored: string[] = [], excludedDirectories: ReadonlySet<string> = new Set()): Snapshot {
	for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
		const file     = join   (prefix, entry.name) ;
		const absolute = resolve(root, file        ) ;
		if (entry.isDirectory() && !excluded.has(entry.name) && !excludedDirectories.has(absolute)) snapshot(root, file, result, ignored, excludedDirectories);
		else if (entry.isSymbolicLink() && !code.has(extname(entry.name).toLowerCase())) ignored.push(file);
		else if (code.has(extname(entry.name).toLowerCase())) {
			if (!entry.isFile() && !entry.isSymbolicLink()) throw new Error("Non-regular source file cannot be checked");
			const path = join(root, file)                                                                                  ;
			const hash = existsSync(path) ? hashFile(path) : createHash("sha256").update(readlinkSync(path)).digest("hex") ;
			result[file] = `${entry.isSymbolicLink() ? "symlink:" : ""}${hash}`;
		}
	}
	return result;
}

export function changed(before: Snapshot, after: Snapshot): string[] {
	return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(file => before[file] !== after[file]).sort();
}

function runDirectory(root: string): string {
	for (const path of [join(root, ".boxbox"), join(root, ".boxbox/runs")]) {
		if (existsSync(path) && (!lstatSync(path).isDirectory() || lstatSync(path).isSymbolicLink())) throw new Error("Unsafe execution evidence directory");
		mkdirSync(path, { recursive: true, mode: 0o700 });
	}
	return join(root, ".boxbox/runs");
}

function persist(directory: string, run: object, id: string): void {
	const temporary = join(directory, `${id}.${randomUUID()}.tmp`);
	writeFileSync(temporary, `${JSON.stringify(run, null, 2)}\n`, { flag: "wx", mode: 0o600 });
	renameSync(temporary, join(directory, `${id}.json`));
}

async function execute(command: readonly string[], root: string, json: boolean): Promise<number | null> {
	const executable = command[0];
	if (!executable) throw new Error("Missing executable");
	return await new Promise((resolveChild, reject) => {
		const child = spawn(executable, command.slice(1), { cwd: root, stdio: json ? ["inherit", "pipe", "pipe"] : "inherit" });
		child.stdout?.pipe(process.stderr, { end: false });
		child.stderr?.pipe(process.stderr, { end: false });
		child.once("error", () => reject(new Error("CHILD_START_ERROR")));
		child.once("close", resolveChild);
	});
}

function emit(value: Record<string, unknown>, json: boolean): void {
	if (json) { console.log(JSON.stringify(value)); return; }
	const latest = value.latest && typeof value.latest === "object" ? value.latest as Record<string, unknown> : value ;
	const count  = (key: string) => Array.isArray(latest[key]) ? latest[key].length : 0                               ;
	console.log(`boxbox ${value.command}: ${value.state}; run=${latest.runId ?? "none"}; checked=${count("checked")}; changed=${count("changed")}`);
	if (latest.runId) console.log(`receipt: ${join(String(value.root), ".boxbox/runs", `${latest.runId}.json`)}`);
}

export async function guardedRun(args: readonly string[], preflight: Preflight, inspect: Inspection, engineVersion: string): Promise<number> {
	const { root, json, command } = options(args, true);
	const directory = runDirectory(root) ;
	const id        = randomUUID  ()     ;
	const record = {
		schemaVersion              : 1                                                                         ,
		tool                       : "boxbox"                                                                  ,
		command                    : "run"                                                                     ,
		runId                      : id                                                                        ,
		root                       : root                                                                      ,
		engineVersion              : engineVersion                                                             ,
		runtime                    : { node: process.versions.node, bunVersion: process.versions.bun ?? null } ,
		startedAt                  : new Date().toISOString()                                                  ,
		finishedAt                 : null as string | null                                                     ,
		state                      : "RUNNING"                                                                 ,
		childExitCode              : null as number | null                                                     ,
		preflight                  : "NOT_RUN"                                                                 ,
		validation                 : "NOT_RUN"                                                                 ,
		errorCode                  : null as string | null                                                     ,
		before                     : {} as Snapshot                                                            ,
		after                      : {} as Snapshot                                                            ,
		afterSnapshotComplete      : false                                                                     ,
		ignoredSymlinks            : [] as string[]                                                            ,
		changed                    : [] as string[]                                                            ,
		checked                    : [] as { file: string; result: FileResult }[]                              ,
		unsupported                : [] as string[]                                                            ,
		deleted                    : [] as string[]                                                            ,
		excludedDirectories        : [...excluded]                                                             ,
		symlinkDirectoriesFollowed : false                                                                     ,
		nativeHookVerified         : false                                                                     ,
		automaticFixPerformed      : false                                                                     ,
	};
	persist(directory, record, id);
	let exitCode = 2;
	try {
		record.preflight = preflight(root).runtimeUsable ? "PASS" : "FAIL";
		if (record.preflight !== "PASS") throw new Error("PREFLIGHT_FAILED");
		record.before = snapshot(root, "", {}, record.ignoredSymlinks);
		persist(directory, record, id);
		record.childExitCode         = await execute(command, root, json)             ;
		record.after                 = snapshot(root, "", {}, record.ignoredSymlinks) ;
		record.ignoredSymlinks       = [...new Set(record.ignoredSymlinks)].sort()    ;
		record.afterSnapshotComplete = true                                           ;
		record.changed               = changed(record.before, record.after)           ;
		if (record.changed.some(file => record.before[file]?.startsWith("symlink:") || record.after[file]?.startsWith("symlink:"))) throw new Error("CHANGED_SYMLINK");
		record.deleted = record.changed.filter(file => !record.after[file]);
		record.unsupported = record.changed.filter(file => record.after[file] && !supported.has(extname(file).toLowerCase()));
		for (const file of record.changed.filter(file => record.after[file] && supported.has(extname(file).toLowerCase()))) {
			record.checked.push({ file, result: await inspect(root, file) });
		}
		const invalid = record.checked.some(item => item.result.summary.misaligned > 0 || item.result.summary.refused > 0);
		record.validation = invalid ? "FAIL" : record.unsupported.length ? "UNSUPPORTED" : record.checked.length ? "PASS" : "NO_CHANGES";
		if (changed(record.after, snapshot(root)).length) throw new Error("SOURCE_CHANGED_DURING_CHECK");
		record.state = record.childExitCode !== 0 ? "CHILD_FAILED" : record.validation;
		exitCode = record.state === "PASS" || record.state === "NO_CHANGES" ? 0 : record.state === "FAIL" ? 1 : 2;
	} catch (error) {
		record.state = "TOOL_ERROR";
		// External error text can contain arguments or code, so only allowed codes are stored.
		const message = error instanceof Error ? error.message : "";
		record.errorCode = ["PREFLIGHT_FAILED", "CHILD_START_ERROR", "SOURCE_CHANGED_DURING_CHECK", "CHANGED_SYMLINK"].includes(message) ? message : "GUARD_ERROR";
	} finally {
		record.finishedAt = new Date().toISOString();
		persist(directory, record, id);
	}
	emit(record, json);
	return exitCode;
}

export function guardStatus(args: readonly string[], useOperatingSystemLock = true): number {
	const { root, json } = options(args, false);
	const boxbox = join(root, ".boxbox");
	if (existsSync(boxbox) && (!lstatSync(boxbox).isDirectory() || lstatSync(boxbox).isSymbolicLink())) throw new Error("Unsafe .boxbox directory");
	if (useOperatingSystemLock) {
		const delegated = advisoryStatusLock(args, root, json);
		if (delegated !== null) return delegated;
	}
	const release = acquireProcessLock(lockDirectory(root), "status");
	if (!release) throw new Error("CONCURRENT_OPERATION");
	try {
	const directory = join(root, ".boxbox/runs");
	if (!existsSync(directory)) { emit({ command: "status", state: "NOT_INVOKED", root, nativeHookVerified: false }, json); return 0; }
	if (lstatSync(directory).isSymbolicLink()) throw new Error("Unsafe evidence directory");
	const { runs, latest } = loadLatestRun(directory);
	const currentChanges = latest?.afterSnapshotComplete ? changed(latest.after, snapshot(root)) : [] ;
	emit({ command: "status", root, state: latest ? (currentChanges.length && ["PASS", "NO_CHANGES"].includes(latest.state)) ? "STALE" : latest.state : "NOT_INVOKED", runs, latest, changesSinceRun: currentChanges, nativeHookVerified: false }, json);
	return 0;
	} finally { release(); }
}
