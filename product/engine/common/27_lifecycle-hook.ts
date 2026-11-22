import      { captureLifecycleBaseline, baselineHashes              } from "@/common/32_lifecycle-baseline.ts" ;
import      { spawnSync } from "node:child_process";
import      { createHash, randomUUID                                } from "node:crypto"                       ;
import      {
              closeSync                                           ,
              existsSync                                          ,
              lstatSync                                           ,
              mkdirSync                                           ,
              openSync                                            ,
              readFileSync                                        ,
              renameSync                                          ,
              realpathSync                                        ,
              statSync                                            ,
              unlinkSync                                            ,
              writeFileSync
                                                                    } from "node:fs"                           ;
import      { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path"                         ;
import      { snapshot, changed, supported                          } from "@/common/25_guarded-run.ts"        ;
import      { encodeLifecycleReceipt                                } from "@/common/29_lifecycle-receipt.ts"  ;
import type { Snapshot } from "@/common/25_guarded-run.ts";
import type { FileResult, ResultGroup } from "@/common/24_result-json.ts";
import type { SyntaxValidation } from "@/common/11_syntax-validation.ts";
import type { LifecycleEvent, LifecycleReceiptV2                    } from "@/common/29_lifecycle-receipt.ts"  ;
import      { resolveMode                                           } from "@/common/35_mode.ts"               ;
import type { Mode                                                  } from "@/common/35_mode.ts"               ;
import      { updateNotice                                          } from "@/common/37_update.ts"             ;
import      { mergeRecovery, renderRecovery, resultRecovery         } from "@/common/39_recovery.ts"           ;
import      { inspectionCacheKey, inspectionDependenciesCurrent, observeInspection, readInspectionCache, writeInspectionCache } from "@/common/40_lifecycle-cache.ts" ;
import type { ObservedInspection } from "@/common/40_lifecycle-cache.ts" ;

type Inspection = (root: string, file: string) => Promise<FileResult | { readonly result: FileResult; readonly syntax: SyntaxValidation }>;
type Workflow = "author" | "align" | "quiet";

export interface LifecycleHookOptions {
	readonly version?: string;
	/** Complete engine/runtime/parser/config/proof identity; null or absence disables reuse. */
	readonly inspectionContext?: (root: string) => string | null | Promise<string | null>;
	readonly align?: (root: string, file: string) => Promise<{ readonly written: boolean; readonly edits: number }>;
}

const MODE_LINES: Readonly<Record<Mode, string>> = {
	off      : "Mode off. Automatic checks and alignment are disabled."                                                                                                       ,
	auto     : "Mode auto. Infer Write for new code, Align for an explicit layout request and Quiet for other work."                                                          ,
	check    : "Mode check. Session changes are checked after matched file-edit and shell tools and again on completion."                                                     ,
	align    : "Mode align. Matched tools are checked; approved horizontal whitespace may be aligned after tool completion. Session changes are checked again on completion." ,
	refactor : "Mode refactor. Hooks only inspect and guide; structural refactoring remains explicit agent work."                                                             ,
};

/** The host event each hook mode answers; one table so the dispatcher and the installer cannot disagree. */
const HOOK_EVENTS: readonly (readonly [event: string, mode: string])[] = [
	["SessionStart", "session"],
	["PostToolUse" , "post"   ],
	["Stop"        , "stop"   ],
];


function rootOf(args: readonly string[]): string {
	if (args.length !== 2 || args[0] !== "--root" || !isAbsolute(args[1] ?? "")) throw new Error("Expected --root <absolute-path>");
	return args[1]!;
}

/** Use host plugin data when provided; direct CLI hooks fall back to project-local receipts. */
function projectReceiptNamespace(root: string): string {
	const data = process.env.CLAUDE_PLUGIN_DATA || process.env.PLUGIN_DATA;
	if (!data) return join(root, ".boxbox/hooks");
	if (!isAbsolute(data)) throw new Error("Plugin data must be an absolute path");
	return resolve(data, "hooks", createHash("sha256").update(root).digest("hex").slice(0, 16));
}

function missingPath(error: unknown): boolean {
	return   typeof error === "object"
		  && error        !== null
		  && "code" in error
		  && error.code   === "ENOENT";
}

function existingPath(error: unknown): boolean {
	return   typeof error === "object"
		  && error        !== null
		  && "code" in error
		  && error.code   === "EEXIST";
}

function ensureRealDirectory(path: string, create: boolean): void {
	try {
		const status = lstatSync(path);
		if (!status.isDirectory() || status.isSymbolicLink()) throw new Error(`Unsafe receipt namespace: ${path}`);
		return;
	} catch (error) {
		if (!missingPath(error)) throw error;
	}
	if (!create) throw new Error(`Missing receipt namespace: ${path}`);
	try { mkdirSync(path, { mode: 0o700 }); }
	catch (error) { if (!existingPath(error)) throw error; }
	const status = lstatSync(path);
	if (!status.isDirectory() || status.isSymbolicLink()) throw new Error(`Unsafe receipt namespace: ${path}`);
}

function ensurePluginDataRoot(path: string): void {
	const missing: string[] = []   ;
	let current             = path ;
	for (;;) {
		try {
			const status = lstatSync(current);
			if (current === path) {
				if (!status.isDirectory() || status.isSymbolicLink()) throw new Error(`Unsafe receipt namespace: ${path}`);

				return;
			}
			if (!statSync(current).isDirectory()) throw new Error(`Plugin data ancestor must be a directory: ${current}`);
			break;
		} catch (error) {
			if (!missingPath(error)) throw error;
			missing.unshift(current);
			const parent = dirname(current);
			if (parent === current) throw new Error(`Missing plugin data ancestor: ${current}`);
			current = parent;
		}
	}
	for (const component of missing) ensureRealDirectory(component, true);
}

/** Where `stateDirectory` keeps a session baseline, computed without creating directories. */
function baselinePath(root: string, id: string, data = pluginData()): string {
	return data && isAbsolute(data)
		? join(resolve(data), "hooks", createHash("sha256").update(root).digest("hex").slice(0, 16), id, "baseline.json")
		: join(root, ".boxbox", "hooks", id, "baseline.json");
}

/**
 * The host may move the hook cwd below the folder where the session started (for example into a nested repository).
 * Keep using that session's baseline from the nearest ancestor instead of reporting it missing; a session that never
 * started still has no baseline anywhere and fails as before.
 */
function sessionRoot(root: string, id: string, data = pluginData()): string {
	for (let current = root; ; current = dirname(current)) {
		if (existsSync(baselinePath(current, id, data))) return current;
		if (dirname(current) === current) return root;
	}
}

function stateDirectory(root: string, id: string, data = pluginData()): string {
	if (!statSync(root).isDirectory()) throw new Error(`Project root must be a directory: ${root}`);
	if (data && !isAbsolute(data)) throw new Error("Plugin data must be an absolute path");
	const base = data ? resolve(data) : join(root, ".boxbox")              ;
	if (data) ensurePluginDataRoot(base);
	else ensureRealDirectory(base, true);
	const hooks = join(base, "hooks");
	ensureRealDirectory(hooks, true);
	if (data) {
		const project = join(hooks, createHash("sha256").update(root).digest("hex").slice(0, 16));
		ensureRealDirectory(project, true);
		const directory = join(project, id);
		ensureRealDirectory(directory, true);

		return directory;
	}
	const directory = join(hooks, id);
	ensureRealDirectory(directory, true);

	return directory;
}

function claimMarker(marker: string): boolean {
	let descriptor: number;
	try { descriptor = openSync(marker, "wx", 0o600); }
	catch (error) {
		if (existingPath(error)) return false;
		throw error;
	}
	closeSync(descriptor);

	return true;
}



export function lifecyclePostFingerprint(setting: string, source: Record<string, string>): string {
	const entries = Object.entries(source).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);

	return createHash("sha256").update(setting).update("\0").update(JSON.stringify(entries)).digest("hex");
}

function snapshotExclusions(root: string): ReadonlySet<string> {
	const projectRoot = realpathSync(root                                ) ;
	const namespace   = realpathSync(projectReceiptNamespace(projectRoot)) ;
	const path        = relative    (projectRoot, namespace              ) ;
	if (
		   path === ""
		|| path === ".."
		|| path.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
		|| isAbsolute(path)
	)
		return new Set();
	return new Set([namespace]);
}

function currentFileHash(root: string, file: string): string {
	const absolute = join     (root, file                  ) ;
	const status   = lstatSync(absolute                    ) ;
	const physical = relative (root, realpathSync(absolute)) ;
	if (!status.isFile() || status.isSymbolicLink() || physical === ".." || physical.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(physical)) throw new Error("Changed symlink or non-regular alignment target");

	return createHash("sha256").update(readFileSync(absolute)).digest("hex");
}


const pluginData = (): string => process.env.CLAUDE_PLUGIN_DATA || process.env.PLUGIN_DATA || ""        ;
const digest     = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex") ;

function sessionKey(id: string): string {
	const data = pluginData();
	return data ? `${id}.${Buffer.from(resolve(data)).toString("base64url")}` : id;
}

export function runHookWorkflow(args: readonly string[], start: string): number {
	const [key, workflow] = args;
	const parts = /^([a-f0-9]{64})(?:\.([a-zA-Z0-9_-]+))?$/u.exec(key ?? "");
	if (args.length !== 2 || !parts || (workflow !== "author" && workflow !== "align" && workflow !== "quiet")) {
		throw new Error("Expected hooks workflow <session-key> author|align|quiet");
	}
	const id   = parts[1]!                                                           ;
	const data = parts[2] ? Buffer.from(parts[2], "base64url").toString("utf8") : "" ;
	if (data && !isAbsolute(data)) throw new Error("Invalid BoxBox session key");

	const root = sessionRoot(realpathSync(start), id, data);
	if (!existsSync(baselinePath(root, id, data))) throw new Error("No matching BoxBox session. Start a new host session.");
	const directory = stateDirectory(root, id, data              ) ;
	const baseline  = lstatSync     (baselinePath(root, id, data)) ;
	if (!baseline.isFile() || baseline.isSymbolicLink()) throw new Error("Unsafe session baseline");
	if (resolveMode(root) !== "auto") throw new Error("Session workflow requires BoxBox mode auto");

	writePrivateFile(join(directory, "workflow"), workflow);
	return 0;
}

function readWorkflow(directory: string): Workflow {
	const path   = join     (directory, "workflow"          ) ;
	const status = lstatSync(path, { throwIfNoEntry: false }) ;
	if (!status?.isFile() || status.isSymbolicLink() || status.size > 6) return "quiet";
	const value = readFileSync(path, "utf8");
	return value === "author" || value === "align" ? value : "quiet";
}

function writePrivateFile(path: string, content: string): void {
	const temporary = `${path}.${randomUUID()}.tmp`;
	writeFileSync(temporary, content, { flag: "wx", mode: 0o600 });
	try { renameSync(temporary, path); }
	finally { if (existsSync(temporary)) unlinkSync(temporary); }
}

function captureSourceBaselines(root: string, directory: string, before: Snapshot): void {
	const listed = spawnSync("git", ["ls-files", "--cached", "-z", "--", "."], {
		cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: 5_000,
	});
	if (listed.status !== 0) return;
	const tracked = new Set(listed.stdout.split("\0").map(file => file.replaceAll("/", sep)));
	for (const file of tracked) {
		const hash = before[file];
		if (!hash || !/^[a-f0-9]{64}$/u.test(hash) || !supported.has(extname(file).toLowerCase())) continue;
		try {
			const path = join(root, file);
			if (!lstatSync(path).isFile()) continue;
			const bytes = readFileSync(path);
			if (digest(bytes) !== hash) continue;
			writeFileSync(join(directory, `source-${digest(file)}-${hash}`), bytes, { flag: "wx", mode: 0o600 });
		} catch (error) {
			// A missing or changed source has no trustworthy line baseline; still capture the session receipt baseline.
			if (!missingPath(error) && !existingPath(error)) throw error;
		}
	}
}

interface Range {
	readonly start: number;
	readonly end: number;
}

function sessionRanges(root: string, directory: string, file: string, before: string | undefined): Range[] {
	if (before === undefined)                                                                      return [{ start: 1, end: Number.MAX_SAFE_INTEGER }];
	if (!/^[a-f0-9]{64}$/u.test(before))                                                           return [];

	const original = join     (directory, `source-${digest(file)}-${before}`) ;
	const status   = lstatSync(original, { throwIfNoEntry: false }          ) ;
	if (!status?.isFile() || status.isSymbolicLink() || digest(readFileSync(original)) !== before) return [];

	const diff = spawnSync("git", [
		"diff", "--no-index", "--no-ext-diff", "--no-textconv", "--no-color", "--text", "--unified=0",
		"--diff-algorithm=myers", "--no-indent-heuristic", "--", original, join(root, file),
	], { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 5_000 });
	if (diff.status !== 1)                                                                         return [];

	const ranges: Range[] = [];
	for (const match of diff.stdout.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@(?: |$)/gmu)) {
		const start = Number(match[1]       ) ;
		const count = Number(match[2] ?? "1") ;
		if (count > 0) ranges.push({ start, end: start + count - 1 });
	}
	return ranges;
}

function findingsOnRows(group: ResultGroup, ranges: readonly Range[]): boolean {
	if (group.state === "PASS" || group.kind === "syntax") return false;
	return ranges.some(({ start, end }) => group.rowLines
		? group.rowLines.some(line => line >= start && line <= end)
		: group.startLine <= end && group.endLine >= start);
}

function syntaxLabel(syntax: SyntaxValidation | undefined, isNew: boolean, ranges: readonly Range[], result: FileResult): string | undefined {
	if (!syntax                  ) return isNew && result.groups.some(group => group.kind === "syntax") ? "syntax diagnostics" : undefined;
	if (syntax.status === "valid") return undefined;
	if (syntax.status === "error") return "parser error";
	const lines   = syntax.diagnostics.map   (value => /^(\d+):/u.exec(value)?.[1] ?? /\bline\s+(\d+)\b/iu.exec(value)?.[1]                ) ;
	const touched = lines             .filter(line => line && ranges.some(({ start, end }) => Number(line) >= start && Number(line) <= end)) ;
	if (touched.length) return `syntax error L${[...new Set(touched)].slice(0, 3).join(", L")}`;
	return isNew ? "syntax error" : undefined;
}

interface FindingNote {
	readonly file    : string                 ;
	readonly syntax? : string                 ;
	readonly rows    : readonly ResultGroup[] ;
}

function sessionNotes(
	root: string, directory: string, before: Snapshot, after: Snapshot, workflow: Exclude<Workflow, "quiet">,
	checked: LifecycleReceiptV2["checked"], syntaxByFile: ReadonlyMap<string, SyntaxValidation>
): string {
	const notes: FindingNote[] = [];
	for (const { file, result } of checked) {
		if (!result.groups.some(group => group.state !== "PASS")) continue;
		const ranges = sessionRanges(root, directory, file, before[file]);
		if (ranges.length && currentFileHash(root, file) !== after[file]) continue;

		const syntax = ranges.length ? syntaxLabel(syntaxByFile.get(file), before[file] === undefined, ranges, result) : undefined ;
		const rows   = result.groups.filter(group => findingsOnRows(group, ranges))                                                ;
		if (!syntax && !rows.length) continue;
		const fingerprint = digest(JSON.stringify([workflow, file, after[file], syntax, rows]));
		if (claimMarker(join(directory, `note-${fingerprint}`))) notes.push({ file, syntax, rows });
	}
	notes.sort((a, b) => Number(Boolean(b.syntax)) - Number(Boolean(a.syntax)));
	if (notes.length === 0) return "";

	const labels = notes.slice(0, 5).map(({ file, syntax, rows }) => {
		const location = JSON.stringify(file);
		if (syntax) return `${location} ${syntax}`;
		const groups = rows.slice(0, 3).map(group => `L${group.startLine}-${group.endLine} (${group.state}, ${group.kind})`);
		if (rows.length > groups.length) groups.push(`+${rows.length - groups.length} ranges`);
		return `${location} ${groups.join(", ")}`;
	});
	if (notes.length > labels.length) labels.push(`+${notes.length - labels.length} files`);
	const hint = notes.some(note => note.syntax) ? "Review syntax diagnostics first."
		: workflow === "author" ? "Review the row shape on the changed lines." : "Use align --dry-run to preview approved changes.";
	return `[boxbox] ${labels.join(". ")}. ${hint}`;
}


function alignmentMessage(aligned: LifecycleReceiptV2["aligned"]): string {
	return aligned.length ? ` Aligned ${aligned.map(item => `${item.file} (${item.edits} changed lines)`).join(", ")}; re-read before editing.` : "";
}

export async function lifecycleHook(args: readonly string[], inspect: Inspection, options: LifecycleHookOptions = {}): Promise<number> {
	const mode  = args[0]                                            ;
	const event = HOOK_EVENTS.find(([, name]) => name === mode)?.[0] ;
	if (event === undefined) throw new Error("Expected session|post|stop");

	const given                                       = args.length > 1 ? rootOf(args.slice(1)) : undefined ;
	const aligned : { file: string; edits: number }[] = []                                                  ;
	let setting   : Mode                              = "check"                                             ;
	let workflow  : Workflow                          = "quiet"                                             ;

	try {
		const input = JSON.parse(readFileSync(0, "utf8"));
		if (!input.session_id) throw new Error("Missing session_id");

		// Claude keeps its session project fixed while payload cwd follows cd and worktree changes.
		const suppliedRoot = given ?? (process.env.CLAUDE_PROJECT_DIR || input.cwd);
		if (typeof suppliedRoot !== "string" || !isAbsolute(suppliedRoot)) throw new Error("Missing absolute cwd");

		const started = realpathSync(resolve(suppliedRoot))                                 ;
		const id      = createHash("sha256").update(String(input.session_id)).digest("hex") ;
		const root    = mode === "session" ? started : sessionRoot(started, id)             ;
		setting = resolveMode(root);
		if (setting === "off") {
			console.log(JSON.stringify(mode === "session"
				? { hookSpecificOutput: { hookEventName: event, additionalContext: `[boxbox] ${MODE_LINES.off}` } }
				: {}));

			return 0;
		}

		const directory  = stateDirectory    (root, id) ;
		const exclusions = snapshotExclusions(root    ) ;

		const baseline = join(directory, "baseline.json");
		if (mode === "session") {
			if (!existsSync(baseline)) {
				const sources = snapshot(root, "", {}, [], exclusions);
				if (setting === "auto") captureSourceBaselines(root, directory, sources);
				const captured = JSON.stringify(captureLifecycleBaseline(root, sources));
				try { writeFileSync(baseline, captured, { flag: "wx", mode: 0o600 }); }
				catch (error) { if (!existingPath(error)) throw error; }
			}
			let update: ReturnType<typeof updateNotice> = undefined;
			try { update = options.version ? updateNotice(options.version) : undefined; }
			catch { /* Update advice never interrupts baseline capture or checking. */ }
			const lines = [
				`[boxbox] ${MODE_LINES[setting]}`,
				`Results are recorded in ${directory}.`,
				...(setting === "auto" ? [`Use the BoxBox launcher with hooks workflow ${sessionKey(id)} followed by author, align, or quiet. Start Write with guide --authoring --brief.`] : []),
				...(update ? [update.context] : []),
			];

			console.log(JSON.stringify({
				...(update ? { systemMessage: update.user } : {}),
				hookSpecificOutput: {
					hookEventName     : event,
					additionalContext : lines.join(" ")
				}
			}));

			return 0;
		}

		if (!existsSync(baseline)) throw new Error("Missing SessionStart baseline. Start a new host session after enabling hooks.");

		if (setting === "auto") workflow = readWorkflow(directory);
		const before = baselineHashes(JSON.parse(readFileSync(baseline, "utf8"))) ;
		const after  = snapshot      (root, "", {}, [], exclusions              ) ;

		const files                                                = changed(before, after)                                                      ;
		const checked     : { file: string; result: FileResult }[] = []                                                                          ;
		const unsupported : string[]                               = []                                                                          ;
		const deleted                                              = files.filter(file => !after[file])                                          ;
		const syntaxByFile                                         = new Map<string, SyntaxValidation>()                                         ;
		const observations                                         = new Map<string, { context: string | null; observed: ObservedInspection }>() ;
		const inspectionStarted                                    = performance.now()                                                           ;
		let inspected                                              = 0                                                                           ;
		let reused                                                 = 0                                                                           ;
		let cacheMisses                                            = 0                                                                           ;
		const contextOf = async (): Promise<string | null> => {
			try {
				const identity = await options.inspectionContext?.(root);
				return typeof identity === "string" && identity.length > 0 ? identity : null;
			} catch { return null; }
		};
		const cacheable      = (file: string): boolean => /\.(?:[cm]?tsx?|json|ya?ml)$/iu.test(file)                            ;
		const initialContext = mode === "post" && files.some(file => after[file] && cacheable(file)) ? await contextOf() : null ;

		const inspectResult = async (file: string): Promise<FileResult> => {
			inspected++;
			const reported = await inspect(root, file);
			if (!("result" in reported)) return reported;
			syntaxByFile.set(file, reported.syntax);
			return reported.result;
		};
		const inspectCurrent = async (file: string, allowCache: boolean): Promise<FileResult> => {
			const context = cacheable(file) ? initialContext : null                                                  ;
			const key     = context === null ? null : inspectionCacheKey(root, file, setting, after[file]!, context) ;
			const cached  = allowCache && key ? readInspectionCache(directory, file, key) : null                     ;
			if (allowCache && key && !cached) cacheMisses++;
			if (cached) reused++;
			const observed = cached ?? (context === null
				? { result: await inspectResult(file), dependencies: [], stable: false }
				: await observeInspection(() => inspectResult(file)));
			observations.set(file, { context, observed });
			return observed.result;
		};

		for (const file of files) {
			if (!after[file]) continue;
			if (
				after[file]?.startsWith("symlink:") || before[file]?.startsWith("symlink:")
			) throw new Error("Changed symlink");
			if (!supported.has(extname(file).toLowerCase())) {
				unsupported.push(file);
				continue;
			}

			checked.push({ file, result: await inspectCurrent(file, mode === "post") });
		}

		if (changed(after, snapshot(root, "", {}, [], exclusions)).length) throw new Error("Source changed during check");
		if (setting === "align" && mode === "post" && options.align) {
			for (const item of checked) {
				if (!item.result.summary.misaligned) continue;
				if (currentFileHash(root, item.file) !== after[item.file]) throw new Error("Source changed before alignment");
				let outcome: Awaited<ReturnType<NonNullable<LifecycleHookOptions["align"]>>>;
				try { outcome = await options.align(root, item.file); }
				catch {
					// A refused public pipeline leaves bytes unchanged; the existing failed check remains the result.
					if (currentFileHash(root, item.file) !== after[item.file]) throw new Error("Source changed during alignment");

					continue;
				}
				if (!outcome.written) continue;
				if (!Number.isSafeInteger(outcome.edits) || outcome.edits < 1) throw new Error(`Alignment callback reported a write without a positive changed-line count for ${item.file}; re-read it`);
				const fingerprint = currentFileHash(root, item.file);
				if (fingerprint === after[item.file]) throw new Error(`Alignment callback reported a write but bytes are unchanged: ${item.file}`);

				aligned.push({ file: item.file, edits: outcome.edits });
				// Accept only the file the approved callback wrote, never a whole fresh snapshot that could bless another writer.
				after[item.file] = fingerprint;
				item.result = await inspectCurrent(item.file, false);
			}
			if (changed(after, snapshot(root, "", {}, [], exclusions)).length) throw new Error("Source changed during alignment");
		}

		const ownedAlignmentPaths = new Set(aligned.map(item => realpathSync(resolve(root, item.file))));
		const invalidated = [...observations.values()].flatMap(item => item.observed.dependencies)
			.filter(dependency => !inspectionDependenciesCurrent([dependency]));
		if (aligned.length > 0 && invalidated.length > 0 && invalidated.every(dependency =>
			dependency.operation === "readFile" && ownedAlignmentPaths.has(realpathSync(dependency.path)))) {
			for (const item of checked) item.result = await inspectCurrent(item.file, false);
			if (changed(after, snapshot(root, "", {}, [], exclusions)).length) throw new Error("Source changed during alignment recheck");
		}

		for (const item of observations.values()) {
			if (!inspectionDependenciesCurrent(item.observed.dependencies)) throw new Error("Inspection dependencies changed during check");
		}
		if (initialContext !== null && await contextOf() !== initialContext) throw new Error("Inspection context changed during check");
		if (mode === "post") for (const [file, item] of observations) {
			if (item.context !== null && currentFileHash(root, file) === after[file]) {
				const key = inspectionCacheKey(root, file, setting, after[file]!, item.context);
				writeInspectionCache(directory, file, key, item.observed);
			}
		}
		if (changed(after, snapshot(root, "", {}, [], exclusions)).length) throw new Error("Source changed during check");

		const failed = checked.some(item => item.result.summary.misaligned || item.result.summary.refused);

		const groups          = checked.reduce((total, item) => total + item.result.summary.groups, 0)    ;
		const suggested       = checked.reduce((total, item) => total + item.result.summary.suggested, 0) ;
		const filesWithGroups = checked.filter(item => item.result.summary.groups > 0).length             ;
		const state =
			  failed             ? "FAIL"
			: unsupported.length ? "UNSUPPORTED"
			: suggested          ? "SUGGEST"
			: groups             ? "PASS"
			: checked.length     ? "NO_GROUPS"
			: deleted.length     ? "DELETED_ONLY"
			: "NO_CHANGES";

		const record: LifecycleReceiptV2 = {
			schemaVersion : 2                       ,
			event         : event as LifecycleEvent ,
			state                                   ,

			files       ,
			checked     ,
			unsupported ,
			deleted     ,
			coverage: {
				changedFiles     : files.length       ,
				checkedFiles     : checked.length     ,
				unsupportedFiles : unsupported.length ,
				deletedFiles     : deleted.length     ,
				filesWithGroups ,
				groups          ,
			},

			tool : input.tool_name ?? null  ,
			at   : new Date().toISOString() ,

			mode                  : setting ,
			aligned                         ,
			automaticFixPerformed : aligned.length > 0
		};

		const receipt = join(directory, `${Date.now()}-${randomUUID()}.json`);

		writeFileSync(receipt, encodeLifecycleReceipt(record), { flag: "wx", mode: 0o600 });
		try {
			writeFileSync(`${receipt}.inspection`, JSON.stringify({ schemaVersion: 1, event, cacheHits: reused, cacheMisses, inspections: inspected, elapsedMs: performance.now() - inspectionStarted }), { flag: "wx", mode: 0o600 });
		} catch { /* Optional performance evidence never changes hook behavior. */ }

		const edited   = input.tool_input?.file_path                                               ;
		const editBase = typeof input.cwd === "string" && isAbsolute(input.cwd) ? input.cwd : root ;
		let editPath   = typeof edited === "string" ? resolve(editBase, edited) : root             ;
		try { editPath = realpathSync(editPath); }
		catch { /* Deleted or unavailable edit targets retain their lexical scope; inspection is unchanged. */ }
		const editRelative = relative(root, editPath)                                                                                                                                                                                                                         ;
		const outside      = editRelative === ".." || editRelative.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(editRelative)                                                                                                                   ;
		const scope        = outside ? " Edited file is outside the session project; only session changes were checked." : ""                                                                                                                                                 ;
		const attention    = checked.filter(item => item.result.summary.misaligned || item.result.summary.refused).map(item => item.file)                                                                                                                                     ;
		const names        = attention.length ? ` attention=${attention.slice(0, 3).join(",")}${attention.length > 3 ? `,+${attention.length - 3}` : ""};` : ""                                                                                                               ;
		const recovery     = mergeRecovery(checked.map(item => resultRecovery(item.result, item.file)))                                                                                                                                                                       ;
		const recoveryText = recovery.issues.length ? ` Recovery:\n${renderRecovery(recovery)}` : ""                                                                                                                                                                          ;
		const reason       = `[boxbox] ${event}: ${state}; checked=${checked.length}, inspected=${inspected}, reused=${reused}, groups=${groups}, filesWithGroups=${filesWithGroups}. ${receipt} mode=${setting};${names}${alignmentMessage(aligned)}${scope}${recoveryText}` ;

		if (setting === "auto") {
			workflow = readWorkflow(directory);
			const note = mode === "post" && workflow !== "quiet"
				? sessionNotes(root, directory, before, after, workflow, checked, syntaxByFile) : "";
			const detail = note && recoveryText ? `${note}${recoveryText}` : note;
			console.log(JSON.stringify(detail ? { hookSpecificOutput: { hookEventName: event, additionalContext: detail } } : {}));
			return 0;
		}

		// Explicit inspection modes keep their established receipts and scope messages.
		if (mode === "post" && failed && aligned.length === 0
			&& !claimMarker(join(directory, `post-reported-${lifecyclePostFingerprint(setting, after)}`))) {
			console.log("{}");
			return 0;
		}

		console.log(JSON.stringify(mode === "stop" ? { systemMessage: reason } : {
			hookSpecificOutput: { hookEventName: event, additionalContext: reason },
		}));
	} catch (error) {
		const reason = `[boxbox] hook error: ${error instanceof Error ? error.message : String(error)}${alignmentMessage(aligned)}`;
		// Explicit modes report infrastructure failures and any alignment completed before the error.
		const silent = mode !== "session" && setting === "auto" && (workflow === "quiet" || mode === "stop");
		console.log(JSON.stringify(
			silent ? {} : mode === "stop"
				? { systemMessage: reason }
				: {
					hookSpecificOutput: {
						hookEventName     : event,
						additionalContext : reason
					}
				}
		));
	}

	return 0;
}

export function installHooks(args: readonly string[]): number {
	if (args[0] !== "install" || !["codex", "claude"].includes(args[1] ?? "")) throw new Error("Expected hooks install codex|claude --root <absolute-path>");
	const root = rootOf(args.slice(2)) ;
	const host = args[1]               ;

	const folder = join(root  , host === "codex" ? ".codex"     : ".claude"      ) ;
	const path   = join(folder, host === "codex" ? "hooks.json" : "settings.json") ;

	const document = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};

	const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";

	const entry = process.argv[1]!;

	const prefix = `${quote(process.execPath)} ${quote(entry)}`;
	document.hooks ??= {};
	for (const [event, mode] of HOOK_EVENTS) {
		const list    = document.hooks[event] ?? []                    ;
		const command = `${prefix} hook ${mode} --root ${quote(root)}` ;

		if (!list.some((item: any) =>
			item.hooks?.some((hook: any) => hook.command === command)
		)) list.push({
			...(event === "PostToolUse" ? { matcher: "^(Write|Edit|MultiEdit|apply_patch|Bash)$" } : {}),
			hooks: [{
				type    : "command" ,
				command             ,
				timeout : 120
			}]
		});

		document.hooks[event] = list;
	}
	mkdirSync(folder, { recursive: true });
	writeFileSync(path, JSON.stringify(document, null, 2) + "\n");
	console.log(JSON.stringify({ path, host, registered: true, trusted: false, nativeVerified: false, restartRequired: true }));
	return 0;
}
