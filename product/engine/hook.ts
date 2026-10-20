#!/usr/bin/env bun
import { ruleData } from "./rule-data.ts";
/**
 * Claude Code hook entry point (M1.8 S3.6, docs/development/authoring-flow.md). The first scope is read-only.
 *
 *   hook.ts session : injects the charter's three core lines once at session start.
 *   hook.ts pre     : saves the baseline to `.boxbox/cache/baseline/<tool_use_id>` right before a write. For a new file it injects short
 *                     guidance once per language per session.
 *   hook.ts post    : compares the post-write report with the baseline and reports only when there are new alarms. Never fixes the file.
 *
 * Input is the host JSON on stdin. With BOXBOX_HOOKS=off it does nothing. A failing hook never blocks the edit (exit code 0).
 * Latency is recorded in `.boxbox/cache/hook-timing.jsonl` (S3.6 acceptance criterion).
 */
import      { spawnSync                   } from "node:child_process" ;
import      {
              appendFileSync            ,
              existsSync                ,
              mkdirSync                 ,
              readdirSync               ,
              readFileSync              ,
              rmSync                    ,
              statSync                  ,
              writeFileSync             ,
                                          } from "node:fs"            ;
import      { extname, join, relative     } from "node:path"          ;
import      { fileURLToPath               } from "node:url"           ;
import      {
              coreLines                 ,
              hookTarget                ,
              newFileGuide              ,
              postMessage               ,
              sessionGuide              ,
              type HookInput            ,
                                          } from "./common/hook.ts"   ;
import type { Report                      } from "./common/report.ts" ;
import      { appendUsage, estimateTokens } from "./common/usage.ts"  ;

const CHARTER = ruleData("references/charter.md")                                   ;
const REPORT  = fileURLToPath(new URL("./report.ts", import.meta.url)             ) ;

/** Baselines that lost their pair (post) because no write happened are deleted after this long. */
const STALE_MS = 60 * 60 * 1000;

/** The project's cache folder. It keeps a one-line `*` .gitignore so it stays out of git, and cleans up old baselines. */
function cacheDir(project: string): string {
	const dir = join(project, ".boxbox", "cache");
	mkdirSync(join(dir, "baseline"), { recursive: true });
	if (!existsSync(join(dir, ".gitignore"))) writeFileSync(join(dir, ".gitignore"), "*\n");

	for (const name of readdirSync(join(dir, "baseline"))) {
		const path = join(dir, "baseline", name);
		if (Date.now() - statSync(path).mtimeMs > STALE_MS) rmSync(path, { force: true });
	}
	return dir;
}

/** Injects text into the agent and records its size in `.boxbox/cache/usage.jsonl` (estimated tokens). */
function emit(event: string, context: string, project?: string, file?: string): void {
	console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: context } }));
	if (!project) return;

	appendUsage(join(cacheDir(project), "usage.jsonl"), { date: new Date().toISOString(), source: "hook", event, chars: context.length, tokens: estimateTokens(context), estimated: true, model: "host", ...(file ? { file } : {}) });
}

function session(): void {
	emit("SessionStart", sessionGuide(coreLines(readFileSync(CHARTER, "utf8"))), process.env["CLAUDE_PROJECT_DIR"]);
}

function pre(input: HookInput, project: string): void {
	const target = hookTarget(input);
	if (!target || !input.tool_use_id) return;

	const cache    = cacheDir(project)                                                      ;
	const baseline = join(cache, "baseline", `${input.tool_use_id}${extname(target.file)}`) ;
	const isNew    = !existsSync(target.file)                                               ;
	if (isNew) writeFileSync(`${baseline}.none`, "");
	else writeFileSync(baseline, readFileSync(target.file));

	const marker = join(cache, `guided-${input.session_id ?? "session"}-${target.language}`);
	if (!isNew || existsSync(marker)) return;

	writeFileSync(marker, "");
	emit("PreToolUse", newFileGuide(target.language), project, relative(project, target.file));
}

function post(input: HookInput, project: string): void {
	const target = hookTarget(input);
	if (!target || !input.tool_use_id || !existsSync(target.file)) return;

	const started  = Date.now()                                                                                                                  ;
	const cache    = cacheDir(project)                                                                                                           ;
	const saved    = join(cache, "baseline", `${input.tool_use_id}${extname(target.file)}`)                                                      ;
	const baseline = existsSync(saved) ? relative(project, saved) : "none"                                                                       ;
	const file     = relative(project, target.file)                                                                                              ;
	const run      = spawnSync(process.execPath, [REPORT, "--file", file, "--baseline", baseline, "--json"], { cwd: project, encoding: "utf8" }) ;

	rmSync(saved, { force: true });
	rmSync(`${saved}.none`, { force: true });
	appendFileSync(join(cache, "hook-timing.jsonl"), `${JSON.stringify({ file, tool: input.tool_name, ms: Date.now() - started, date: new Date().toISOString() })}\n`);

	let report: Report;
	try {
		report = JSON.parse(run.stdout) as Report;
	} catch {
		return;
	}

	const message = postMessage(report);
	if (message) emit("PostToolUse", message, project, file);
}

function main(): void {
	if (process.env["BOXBOX_HOOKS"] === "off") return;

	const mode = process.argv[2];
	if (mode === "session") return session();

	const input   = JSON.parse(readFileSync(0, "utf8") || "{}") as HookInput        ;
	const project = process.env["CLAUDE_PROJECT_DIR"] ?? input.cwd ?? process.cwd() ;
	if (mode === "pre" ) return pre(input, project);
	if (mode === "post") return post(input, project);
}

try {
	if (import.meta.main) main();
} catch (error) {
	// The hook never blocks the edit. Only the cause goes to stderr.
	console.error(`boxbox hook: ${error instanceof Error ? error.message : String(error)}`);
}
