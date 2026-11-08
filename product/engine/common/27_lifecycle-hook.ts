import      { createHash, randomUUID                              } from "node:crypto"                ;
import      { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs" ;
import      { dirname, extname, isAbsolute, join, relative, resolve } from "node:path"                ;
import      { snapshot, changed, supported                        } from "@/common/25_guarded-run.ts" ;
import      { encodeLifecycleReceipt                              } from "@/common/29_lifecycle-receipt.ts" ;
import type { Inspection                                          } from "@/common/25_guarded-run.ts" ;
import type { LifecycleEvent, LifecycleReceiptV1                  } from "@/common/29_lifecycle-receipt.ts" ;

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

function claimStopBlock(directory: string): boolean {
	const marker = join(directory, "stop-blocked");
	let descriptor: number;
	try { descriptor = openSync(marker, "wx", 0o600); }
	catch (error) {
		if (existingPath(error)) return false;
		throw error;
	}
	closeSync(descriptor);

	return true;
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

export async function lifecycleHook(args: readonly string[], inspect: Inspection): Promise<number> {
	const mode  = args[0]                                            ;
	const event = HOOK_EVENTS.find(([, name]) => name === mode)?.[0] ;
	if (event === undefined) throw new Error("Expected session|post|stop");

	const given = args.length > 1 ? rootOf(args.slice(1)) : undefined;

	try {
		const input = JSON.parse(readFileSync(0, "utf8"));
		if (!input.session_id) throw new Error("Missing session_id");

		// Plugin hooks are called without --root, so use the working folder the host passes in.
		const suppliedRoot = given ?? input.cwd;
		if (typeof suppliedRoot !== "string" || !isAbsolute(suppliedRoot)) throw new Error("Missing absolute cwd");

		const root = realpathSync(resolve(suppliedRoot));

		const id = createHash("sha256").update(String(input.session_id)).digest("hex");

		const directory  = stateDirectory    (root, id) ;
		const exclusions = snapshotExclusions(root    ) ;

		const baseline = join(directory, "baseline.json");
		if (mode === "session") {
			if (!existsSync(baseline)) writeFileSync(
				baseline                                              ,
				JSON.stringify(snapshot(root, "", {}, [], exclusions)),
				{ flag: "wx", mode: 0o600 }
			);

			console.log(JSON.stringify({
				hookSpecificOutput: {
					hookEventName     : event,
					additionalContext : `[boxbox] Session changes are checked after matched file-edit and shell tools and again on completion. Results are recorded in ${directory}.`
				}
			}));

			return 0;
		}

		if (!existsSync(baseline)) throw new Error("Missing SessionStart baseline; start a session in this project");

		const before = JSON.parse(readFileSync(baseline, "utf8")) ;
		const after  = snapshot  (root, "", {}, [], exclusions  ) ;

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

		const record: LifecycleReceiptV1 = {
			schemaVersion : 1                       ,
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

			automaticFixPerformed: false
		};

		const receipt = join(directory, `${Date.now()}-${randomUUID()}.json`);

		writeFileSync(receipt, encodeLifecycleReceipt(record), { flag: "wx", mode: 0o600 });

		const reason = `[boxbox] ${event}: ${state}; checked=${checked.length}, groups=${groups}, filesWithGroups=${filesWithGroups}. ${receipt}`;

		// Unsupported files are only reported. Stop blocks at most once per session: this breaks endless continuation
		// even on Codex, which has no Claude-style stop_hook_active.
		const blocked = failed
			&& !(mode === "post" && input.tool_name === "Bash")
			&& (mode !== "stop" || input.stop_hook_active !== true && claimStopBlock(directory));

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
		const reason = `[boxbox] hook error: ${error instanceof Error ? error.message : String(error)}`;
		// Hook errors (such as a missing baseline) never trap the agent. The check is read-only, so it only reports.
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
			...(event === "PostToolUse" ? { matcher: ".*" } : {}),
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
