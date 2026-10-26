import      { createHash, randomUUID                              } from "node:crypto"             ;
import      { existsSync, mkdirSync, readFileSync, writeFileSync, } from "node:fs"                 ;
import      { extname, isAbsolute, join, relative, resolve        } from "node:path"               ;
import      { snapshot, changed, supported                        } from "@/common/guarded-run.ts" ;
import type { Inspection                                          } from "@/common/guarded-run.ts" ;

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
	return resolve(data, "hooks", createHash("sha256").update(root).digest("hex").slice(0, 16));
}

function stateDirectory(root: string, id: string): string {
	return join(projectReceiptNamespace(root), id);
}

function snapshotExclusions(root: string): ReadonlySet<string> {
	const projectRoot = resolve                (root                  ) ;
	const namespace   = projectReceiptNamespace(projectRoot           ) ;
	const path        = relative               (projectRoot, namespace) ;
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
		const root       = resolve(suppliedRoot)                                               ;
		const id         = createHash("sha256").update(String(input.session_id)).digest("hex") ;
		const directory  = stateDirectory(root, id)                                            ;
		const exclusions = snapshotExclusions(root)                                            ;
		mkdirSync(directory, { recursive: true });
		const baseline = join(directory, "baseline.json");
		if (mode === "session") {
			if (!existsSync(baseline)) writeFileSync(baseline, JSON.stringify(snapshot(root, "", {}, [], exclusions)), { flag: "wx" });
			console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: `[boxbox] Changed code is checked after each edit, and all session changes are checked again on completion. Results are recorded in ${directory}.` } }));
			return 0;
		}
		if (!existsSync(baseline)) throw new Error("Missing SessionStart baseline; start a session in this project");
		const before      = JSON.parse(readFileSync(baseline, "utf8")) ;
		const after       = snapshot(root, "", {}, [], exclusions)     ;
		const files       = changed(before, after)                     ;
		const checked     = []                                         ;
		const unsupported = []                                         ;
		for (const file of files) {
			if (!after[file]) continue;
			if (after[file]?.startsWith("symlink:") || before[file]?.startsWith("symlink:")) throw new Error("Changed symlink");
			if (!supported.has(extname(file).toLowerCase())) { unsupported.push(file); continue; }
			checked.push({ file, result: await inspect(root, file) });
		}
		if (changed(after, snapshot(root, "", {}, [], exclusions)).length) throw new Error("Source changed during check");
		const failed  = checked.some(item => item.result.summary.misaligned || item.result.summary.refused)                                                      ;
		const state   = failed ? "FAIL" : unsupported.length ? "UNSUPPORTED" : checked.length ? "PASS" : "NO_CHANGES"                                            ;
		const record  = { event, state, files, checked, unsupported, tool: input.tool_name ?? null, at: new Date().toISOString(), automaticFixPerformed: false } ;
		const receipt = join(directory, `${Date.now()}-${randomUUID()}.json`)                                                                                    ;
		writeFileSync(receipt, JSON.stringify(record, null, 2), { flag: "wx" });
		const reason = `[boxbox] ${event}: ${state}. ${receipt}`;
		// Unsupported files are only reported. Stop blocks at most once per session: this breaks endless continuation
		// even on Codex, which has no Claude-style stop_hook_active.
		const stopMarker = join(directory, "stop-blocked")                                                             ;
		const blocked    = failed && !(mode === "stop" && (input.stop_hook_active === true || existsSync(stopMarker))) ;
		if (blocked && mode === "stop") writeFileSync(stopMarker, "");
		console.log(JSON.stringify(mode === "stop" ? (blocked ? { decision: "block", reason } : { systemMessage: reason }) : { ...(blocked ? { decision: "block", reason } : {}), hookSpecificOutput: { hookEventName: event, additionalContext: reason } }));
	} catch (error) {
		const reason = `[boxbox] hook error: ${error instanceof Error ? error.message : String(error)}`;
		// Hook errors (such as a missing baseline) never trap the agent. The check is read-only, so it only reports.
		console.log(JSON.stringify(mode === "stop" ? { systemMessage: reason } : { hookSpecificOutput: { hookEventName: event, additionalContext: reason } }));
	}
	return 0;
}

export function installHooks(args: readonly string[]): number {
	if (args[0] !== "install" || !["codex", "claude"].includes(args[1] ?? "")) throw new Error("Expected hooks install codex|claude --root <absolute-path>");
	const root     = rootOf(args.slice(2))                                           ;
	const host     = args[1]                                                         ;
	const folder   = join(root, host === "codex" ? ".codex" : ".claude")             ;
	const path     = join(folder, host === "codex" ? "hooks.json" : "settings.json") ;
	const document = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {}  ;
	const quote    = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'"   ;
	const entry    = process.argv[1]!                                                ;
	const prefix   = `${quote(process.execPath)} ${quote(entry)}`                    ;
	document.hooks ??= {};
	for (const [event, mode] of HOOK_EVENTS) {
		const list    = document.hooks[event] ?? []                    ;
		const command = `${prefix} hook ${mode} --root ${quote(root)}` ;
		if (!list.some((item: any) => item.hooks?.some((hook: any) => hook.command === command))) list.push({ ...(event === "PostToolUse" ? { matcher: ".*" } : {}), hooks: [{ type: "command", command, timeout: 120 }] });
		document.hooks[event] = list;
	}
	mkdirSync(folder, { recursive: true });
	writeFileSync(path, JSON.stringify(document, null, 2) + "\n");
	console.log(JSON.stringify({ path, host, registered: true, trusted: false, nativeVerified: false, restartRequired: true }));
	return 0;
}
