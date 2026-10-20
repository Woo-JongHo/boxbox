import      { createHash, randomUUID       } from "node:crypto"      ;
import      {
              existsSync                 ,
              mkdirSync                  ,
              readFileSync               ,
              writeFileSync              ,
                                           } from "node:fs"          ;
import      { extname, isAbsolute, join    } from "node:path"        ;
import      { snapshot, changed, supported } from "./guarded-run.ts" ;
import type { Inspection                   } from "./guarded-run.ts" ;

function rootOf(args: readonly string[]): string {
	if (args.length !== 2 || args[0] !== "--root" || !isAbsolute(args[1] ?? "")) throw new Error("Expected --root <absolute-path>");
	return args[1]!;
}

/** Plugin hooks write to the host's data folder (set by both Claude and Codex) so no files are left in the user's project. */
function stateDirectory(root: string, id: string): string {
	const data = process.env.CLAUDE_PLUGIN_DATA || process.env.PLUGIN_DATA;
	if (!data) return join(root, ".boxbox/hooks", id);
	return join(data, "hooks", createHash("sha256").update(root).digest("hex").slice(0, 16), id);
}

export async function lifecycleHook(args: readonly string[], inspect: Inspection): Promise<number> {
	const mode = args[0];
	if (!["session", "post", "stop"].includes(mode ?? "")) throw new Error("Expected session|post|stop");
	const given = args.length > 1 ? rootOf(args.slice(1)) : undefined                            ;
	const event = mode === "session" ? "SessionStart" : mode === "post" ? "PostToolUse" : "Stop" ;
	try {
		const input = JSON.parse(readFileSync(0, "utf8"));
		if (!input.session_id) throw new Error("Missing session_id");
		// Plugin hooks are called without --root, so use the working folder the host passes in.
		const root = given ?? input.cwd;
		if (typeof root !== "string" || !isAbsolute(root)) throw new Error("Missing absolute cwd");
		const id        = createHash("sha256").update(String(input.session_id)).digest("hex") ;
		const directory = stateDirectory(root, id)                                            ;
		mkdirSync(directory, { recursive: true });
		const baseline = join(directory, "baseline.json");
		if (mode === "session") {
			if (!existsSync(baseline)) writeFileSync(baseline, JSON.stringify(snapshot(root)), { flag: "wx" });
			console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: "[boxbox] Changed code is checked after each edit, and all session changes are checked again on completion. Results are recorded in .boxbox/hooks." } }));
			return 0;
		}
		if (!existsSync(baseline)) throw new Error("Missing SessionStart baseline; start a session in this project");
		const before      = JSON.parse(readFileSync(baseline, "utf8")) ;
		const after       = snapshot(root)                             ;
		const files       = changed(before, after)                     ;
		const checked     = []                                         ;
		const unsupported = []                                         ;
		for (const file of files) {
			if (!after[file]) continue;
			if (after[file]?.startsWith("symlink:") || before[file]?.startsWith("symlink:")) throw new Error("Changed symlink");
			if (!supported.has(extname(file).toLowerCase())) { unsupported.push(file); continue; }
			checked.push({ file, result: await inspect(root, file) });
		}
		if (changed(after, snapshot(root)).length) throw new Error("Source changed during check");
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
	for (const [event, mode] of [["SessionStart", "session"], ["PostToolUse", "post"], ["Stop", "stop"]]) {
		const list    = document.hooks[event!] ?? []                   ;
		const command = `${prefix} hook ${mode} --root ${quote(root)}` ;
		if (!list.some((item: any) => item.hooks?.some((hook: any) => hook.command === command))) list.push({ ...(event === "PostToolUse" ? { matcher: ".*" } : {}), hooks: [{ type: "command", command, timeout: 120 }] });
		document.hooks[event!] = list;
	}
	mkdirSync(folder, { recursive: true });
	writeFileSync(path, JSON.stringify(document, null, 2) + "\n");
	console.log(JSON.stringify({ path, host, registered: true, trusted: false, nativeVerified: false, restartRequired: true }));
	return 0;
}
