import      { randomUUID, createHash             } from "node:crypto"        ;
import      { spawn                              } from "node:child_process" ;
import      {
              existsSync                       ,
              lstatSync                        ,
              mkdirSync                        ,
              readdirSync                      ,
              readFileSync                     ,
              readlinkSync                     ,
              renameSync                       ,
              writeFileSync                    ,
                                                 } from "node:fs"            ;
import      { extname, isAbsolute, join, resolve } from "node:path"          ;
import type { FileResult                         } from "./result-json.ts"   ;

const excluded  = new Set([".git", ".xxx", "node_modules", ".venv", "venv", "__pycache__", "dist", "build"])                                                         ;
export const supported = new Set([".ts", ".tsx", ".mts", ".cts", ".py"])                                                                                                    ;
const code      = new Set([...supported, ".js", ".jsx", ".mjs", ".cjs", ".java", ".go", ".rs", ".c", ".h", ".cpp", ".hpp", ".swift", ".kt", ".yaml", ".yml", ".sh"]) ;

export type Snapshot   = Record<string, string>                              ;
export type Inspection = (root: string, file: string) => Promise<FileResult> ;
type Preflight  = (root: string) => { runtimeUsable: boolean }        ;

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

export function snapshot(root: string, prefix = "", result: Snapshot = {}, ignored: string[] = []): Snapshot {
	for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
		const file = join(prefix, entry.name);
		if (entry.isDirectory() && !excluded.has(entry.name)) snapshot(root, file, result, ignored);
		else if (entry.isSymbolicLink() && !code.has(extname(entry.name).toLowerCase())) ignored.push(file);
		else if (code.has(extname(entry.name).toLowerCase())) {
			if (!entry.isFile() && !entry.isSymbolicLink()) throw new Error("Non-regular source file cannot be checked");
			const path    = join(root, file)                                           ;
			const content = existsSync(path) ? readFileSync(path) : readlinkSync(path) ;
			result[file] = `${entry.isSymbolicLink() ? "symlink:" : ""}${createHash("sha256").update(content).digest("hex")}`;
		}
	}
	return result;
}

export function changed(before: Snapshot, after: Snapshot): string[] {
	return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(file => before[file] !== after[file]).sort();
}

function runDirectory(root: string): string {
	for (const path of [join(root, ".xxx"), join(root, ".xxx/runs")]) {
		if (existsSync(path) && (!lstatSync(path).isDirectory() || lstatSync(path).isSymbolicLink())) throw new Error("Unsafe execution evidence directory");
		mkdirSync(path, { recursive: true, mode: 0o700 });
	}
	return join(root, ".xxx/runs");
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
	console.log(`xxx ${value.command}: ${value.state}; run=${latest.runId ?? "none"}; checked=${count("checked")}; changed=${count("changed")}`);
	if (latest.runId) console.log(`receipt: ${join(String(value.root), ".xxx/runs", `${latest.runId}.json`)}`);
}

export async function guardedRun(args: readonly string[], preflight: Preflight, inspect: Inspection, engineVersion: string): Promise<number> {
	const { root, json, command } = options(args, true);
	const directory = runDirectory(root) ;
	const id        = randomUUID()       ;
	const record = {
		schemaVersion: 1, tool: "xxx", command: "run", runId: id, root, engineVersion,
		runtime: { node: process.versions.node, bunVersion: process.versions.bun ?? null },
		startedAt: new Date().toISOString(), finishedAt: null as string | null,
		state: "RUNNING", childExitCode: null as number | null,
		preflight: "NOT_RUN", validation: "NOT_RUN", errorCode: null as string | null,
		before: {} as Snapshot, after: {} as Snapshot, afterSnapshotComplete: false, ignoredSymlinks: [] as string[], changed: [] as string[],
		checked: [] as { file: string; result: FileResult }[], unsupported: [] as string[], deleted: [] as string[],
		excludedDirectories: [...excluded], symlinkDirectoriesFollowed: false, nativeHookVerified: false, automaticFixPerformed: false,
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
		// 외부 오류 문구에는 인자·코드가 섞일 수 있으므로 허용한 코드만 저장한다.
		const message = error instanceof Error ? error.message : "";
		record.errorCode = ["PREFLIGHT_FAILED", "CHILD_START_ERROR", "SOURCE_CHANGED_DURING_CHECK", "CHANGED_SYMLINK"].includes(message) ? message : "GUARD_ERROR";
	} finally {
		record.finishedAt = new Date().toISOString();
		persist(directory, record, id);
	}
	emit(record, json);
	return exitCode;
}

export function guardStatus(args: readonly string[]): number {
	const { root, json } = options(args, false);
	const directory = join(root, ".xxx/runs");
	if (!existsSync(directory)) { emit({ command: "status", state: "NOT_INVOKED", root, nativeHookVerified: false }, json); return 0; }
	if (lstatSync(directory).isSymbolicLink()) throw new Error("Unsafe evidence directory");
	const records = readdirSync(directory).filter(name => /^[a-f0-9-]+\.json$/.test(name)).map(name => {
		const path = join(directory, name);
		if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink()) throw new Error("Unsafe evidence file");
		return JSON.parse(readFileSync(path, "utf8"));
	}).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
	const latest         = records[0]                                                                 ;
	const currentChanges = latest?.afterSnapshotComplete ? changed(latest.after, snapshot(root)) : [] ;
	emit({ command: "status", root, state: latest ? (currentChanges.length && ["PASS", "NO_CHANGES"].includes(latest.state)) ? "STALE" : latest.state : "NOT_INVOKED", runs: records.length, latest: latest ?? null, changesSinceRun: currentChanges, nativeHookVerified: false }, json);
	return 0;
}
