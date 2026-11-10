import      { captureLifecycleBaseline, baselineHashes              } from "@/common/32_lifecycle-baseline.ts" ;
import      { createHash, randomUUID                                } from "node:crypto"                       ;
import      {
              closeSync                                           ,
              existsSync                                          ,
              lstatSync                                           ,
              mkdirSync                                           ,
              openSync                                            ,
              readFileSync                                        ,
              realpathSync                                        ,
              statSync                                            ,
              writeFileSync
                                                                    } from "node:fs"                           ;
import      { dirname, extname, isAbsolute, join, relative, resolve } from "node:path"                         ;
import      { snapshot, changed, supported                          } from "@/common/25_guarded-run.ts"        ;
import      { encodeLifecycleReceipt                                } from "@/common/29_lifecycle-receipt.ts"  ;
import type { Inspection                                            } from "@/common/25_guarded-run.ts"        ;
import type { LifecycleEvent, LifecycleReceiptV2                    } from "@/common/29_lifecycle-receipt.ts"  ;
import      { resolveMode                                           } from "@/common/35_mode.ts"               ;
import type { Mode                                                  } from "@/common/35_mode.ts"               ;
import      { updateNotice                                          } from "@/common/37_update.ts"             ;

export interface LifecycleHookOptions {
	readonly version?: string;
	readonly align?: (root: string, file: string) => Promise<{ readonly written: boolean; readonly edits: number }>;
}

const MODE_LINES: Readonly<Record<Mode, string>> = {
	off      : "Mode off. The original session baseline is captured; automatic checks and alignment are disabled."                                                            ,
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
const MUTATING_POST_TOOLS = new Set(["Write", "Edit", "MultiEdit", "apply_patch", "Bash"]);

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
function baselinePath(root: string, id: string): string {
	const data = process.env.CLAUDE_PLUGIN_DATA || process.env.PLUGIN_DATA;
	return data && isAbsolute(data)
		? join(resolve(data), "hooks", createHash("sha256").update(root).digest("hex").slice(0, 16), id, "baseline.json")
		: join(root, ".boxbox", "hooks", id, "baseline.json");
}

/**
 * The host may move the hook cwd below the folder where the session started (for example into a nested repository).
 * Keep using that session's baseline from the nearest ancestor instead of reporting it missing; a session that never
 * started still has no baseline anywhere and fails as before.
 */
function sessionRoot(root: string, id: string): string {
	for (let current = root; ; current = dirname(current)) {
		if (existsSync(baselinePath(current, id))) return current;
		if (dirname(current) === current) return root;
	}
}

function stateDirectory(root: string, id: string): string {
	if (!statSync(root).isDirectory()) throw new Error(`Project root must be a directory: ${root}`);
	const data = process.env.CLAUDE_PLUGIN_DATA || process.env.PLUGIN_DATA ;
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

const claimStopBlock = (directory: string): boolean => claimMarker(join(directory, "stop-blocked"));

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

function alignmentMessage(aligned: LifecycleReceiptV2["aligned"]): string {
	return aligned.length ? ` Aligned ${aligned.map(item => `${item.file} (${item.edits} changed lines)`).join(", ")}; re-read before editing.` : "";
}

export async function lifecycleHook(args: readonly string[], inspect: Inspection, options: LifecycleHookOptions = {}): Promise<number> {
	const mode  = args[0]                                            ;
	const event = HOOK_EVENTS.find(([, name]) => name === mode)?.[0] ;
	if (event === undefined) throw new Error("Expected session|post|stop");

	const given                                      = args.length > 1 ? rootOf(args.slice(1)) : undefined ;
	const aligned: { file: string; edits: number }[] = []                                                  ;

	try {
		const input = JSON.parse(readFileSync(0, "utf8"));
		if (!input.session_id) throw new Error("Missing session_id");

		// Claude keeps its session project fixed while payload cwd follows cd and worktree changes.
		const suppliedRoot = given ?? (process.env.CLAUDE_PROJECT_DIR || input.cwd);
		if (typeof suppliedRoot !== "string" || !isAbsolute(suppliedRoot)) throw new Error("Missing absolute cwd");

		const started = realpathSync(resolve(suppliedRoot))                                 ;
		const id      = createHash("sha256").update(String(input.session_id)).digest("hex") ;
		const root    = mode === "session" ? started : sessionRoot(started, id)             ;
		const setting = resolveMode(root)                                                   ;
		if (mode !== "session" && setting === "off") {
			console.log("{}");

			return 0;
		}

		const directory  = stateDirectory    (root, id) ;
		const exclusions = snapshotExclusions(root    ) ;

		const baseline = join(directory, "baseline.json");
		if (mode === "session") {
			if (!existsSync(baseline)) writeFileSync(
				baseline                                                                              ,
				JSON.stringify(captureLifecycleBaseline(root, snapshot(root, "", {}, [], exclusions))),
				{ flag: "wx", mode: 0o600 }
			);
			let update: ReturnType<typeof updateNotice> = undefined;
			try { update = options.version ? updateNotice(options.version) : undefined; }
			catch { /* Update advice never interrupts baseline capture or checking. */ }
			const lines = [
				`[boxbox] ${MODE_LINES[setting]}`,
				...(setting === "off" ? [] : [`Results are recorded in ${directory}.`]),
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

		if (!existsSync(baseline)) throw new Error("Missing SessionStart baseline; start a session in this project");

		const before = baselineHashes(JSON.parse(readFileSync(baseline, "utf8"))) ;
		const after  = snapshot      (root, "", {}, [], exclusions              ) ;

		const files = changed(before, after);

		const checked     = []                                 ;
		const unsupported = []                                 ;
		const deleted     = files.filter(file => !after[file]) ;

		for (const file of files) {
			if (!after[file]) continue;
			if (
				after[file]?.startsWith("symlink:") || before[file]?.startsWith("symlink:")
			) throw new Error("Changed symlink");
			if (!supported.has(extname(file).toLowerCase())) {
				unsupported.push(file);
				continue;
			}

			checked.push({ file, result: await inspect(root, file) });
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
				item.result = await inspect(root, item.file);
			}
			if (changed(after, snapshot(root, "", {}, [], exclusions)).length) throw new Error("Source changed during alignment");
		}

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

		const edited   = input.tool_input?.file_path                                               ;
		const editBase = typeof input.cwd === "string" && isAbsolute(input.cwd) ? input.cwd : root ;
		let editPath   = typeof edited === "string" ? resolve(editBase, edited) : root             ;
		try { editPath = realpathSync(editPath); }
		catch { /* Deleted or unavailable edit targets retain their lexical scope; inspection is unchanged. */ }
		const editRelative = relative(root, editPath)                                                                                                                                                                ;
		const outside      = editRelative === ".." || editRelative.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(editRelative)                                                          ;
		const scope        = outside ? " Edited file is outside the session project; only session changes were checked." : ""                                                                                        ;
		const attention    = checked.filter(item => item.result.summary.misaligned || item.result.summary.refused).map(item => item.file)                                                                            ;
		const names        = attention.length ? ` attention=${attention.slice(0, 3).join(",")}${attention.length > 3 ? `,+${attention.length - 3}` : ""};` : ""                                                      ;
		const reason       = `[boxbox] ${event}: ${state}; checked=${checked.length}, groups=${groups}, filesWithGroups=${filesWithGroups}. ${receipt} mode=${setting};${names}${alignmentMessage(aligned)}${scope}` ;

		// Unsupported files are only reported. Stop blocks at most once per session: this breaks endless continuation
		// even on Codex, which has no Claude-style stop_hook_active.
		let blocked = false;
		if (mode === "post" && failed) {
			const fingerprint = lifecyclePostFingerprint(setting, after)                               ;
			const report      = join(directory, `post-reported-${fingerprint}`)                        ;
			const mayBlock    = input.tool_name !== "Bash" && MUTATING_POST_TOOLS.has(input.tool_name) ;
			if (mayBlock) {
				blocked = claimMarker(join(directory, `post-blocked-${fingerprint}`));
				if (blocked) claimMarker(report);
			}
			const reportFresh = mayBlock ? blocked : claimMarker(report);
			if (!reportFresh) {
				console.log("{}");

				return 0;
			}
		} else if (mode === "stop" && failed)
			blocked = input.stop_hook_active !== true && claimStopBlock(directory);

		console.log(JSON.stringify(
			mode === "stop"
				? (blocked
					? { decision: "block", reason }
					: { systemMessage: reason })
				: {
					...(blocked ? { decision: "block", reason } : {}),
					hookSpecificOutput: {
						hookEventName     : event,
						additionalContext : reason
					}
				}
		));
	} catch (error) {
		const reason = `[boxbox] hook error: ${error instanceof Error ? error.message : String(error)}${alignmentMessage(aligned)}`;
		// Errors stay advisory; any completed approved alignments are reported rather than described as a no-write refusal.
		console.log(JSON.stringify(
			mode === "stop"
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
