/**
 * Authoring-hook decisions (M1.8 S3.6, docs/authoring-flow.md). Interprets the input received from the host (currently Claude Code)
 * and builds the text returned to the agent. It never touches files or processes — that is `scripts/hook.ts`'s job.
 * The first scope is read-only: it never fixes files and reports only new alarms.
 */
import type { Report, ReportAlarm } from "./report.ts";

/** Fields used from the input the host passes to the hook (Claude Code PreToolUse / PostToolUse). */
export interface HookInput {
	readonly session_id?  : string                                                     ;
	readonly cwd?         : string                                                     ;
	readonly tool_name?   : string                                                     ;
	readonly tool_use_id? : string                                                     ;
	readonly tool_input?  : { readonly file_path?: string; readonly content?: string } ;
}

export interface HookTarget {
	readonly file     : string ;
	readonly language : string ;
}

const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit"]);

const LANGUAGES: readonly (readonly [RegExp, string])[] = [
	[/\.[cm]?ts$/u, "typescript"],
	[/\.py$/u     , "python"    ],
];

/** Whether the hook should look at it: a write tool, a first-scope language, and not a .d.ts file or a file inside .xxx. */
export function hookTarget(input: HookInput): HookTarget | undefined {
	const file = input.tool_input?.file_path;
	if (!file || !WRITE_TOOLS.has(input.tool_name ?? "")) return undefined;
	if (file.endsWith(".d.ts") || /[\\/]\.xxx[\\/]/u.test(file)) return undefined;

	const found = LANGUAGES.find(([extension]) => extension.test(file));

	return found ? { file, language: found[1] } : undefined;
}

/** The charter's core lines (between `<!-- xxx:core:begin -->` and `<!-- xxx:core:end -->`). */
export function coreLines(charter: string): string {
	const begin = charter.indexOf("<!-- xxx:core:begin -->") ;
	const end   = charter.indexOf("<!-- xxx:core:end -->"  ) ;
	if (begin < 0 || end < begin) throw new Error("charter core markers are missing");

	return charter.slice(begin + "<!-- xxx:core:begin -->".length, end).trim();
}

/** Guidance injected once at session start. */
export function sessionGuide(core: string): string {
	return [`[xxx] Code readability principles for this project:`, core, "After a file is written, only newly introduced alarms are reported."].join("\n");
}

/** Short guidance injected once per language right before a new file is written. */
export function newFileGuide(language: string): string {
	return [
		`[xxx] New ${language} file: write same-role lines in the same pattern, and separate them with a blank line when the property (pattern, declaration kind) changes.`,
		"Three or more consecutive lines of the same pattern are aligned into a table. If one long exceptional element widens everything, simplify before aligning.",
		"Keep statements in their original execution order. Grammar: skills/xxx/references/grammar.md",
	].join("\n");
}

const renderAlarm = (alarm: ReportAlarm): string => {
	const where = alarm.startLine === alarm.endLine ? `line ${alarm.startLine}` : `lines ${alarm.startLine}–${alarm.endLine}`;

	return `- ${alarm.id} ${alarm.label} ${where}: ${alarm.detail} → ${alarm.hint}`;
};

/**
 * Alarms the agent can fix itself in this edit. A2 (soft limit, an allowed range) is not reported, and A5 (ambiguous pattern), A6 (two-row pair) and A8 (no mapping)
 * are for the engine or a human to judge, so they are not sent to the agent (they belong to the review queue).
 */
export const AGENT_ALARMS: ReadonlySet<string> = new Set(["A0", "A1", "A3", "A4", "A7", "A9", "A12"]);

/** Text to tell the agent from the post-write report. undefined (print nothing) when there are no new alarms and no failed safety checks. */
export function postMessage(report: Report, limit = 12): string | undefined {
	const failed = report.checks.filter(check => check.status === "fail")                                      ;
	const fresh  = (report.comparison?.newAlarms ?? report.alarms).filter(alarm => AGENT_ALARMS.has(alarm.id)) ;
	if (failed.length === 0 && fresh.length === 0) return undefined;

	const existing = report.comparison?.existingAlarms.length ?? 0                                                                                                                          ;
	const lines    = [`[xxx] ${report.file}: ${fresh.length} alarm(s) introduced by this edit${existing > 0 ? ` (${existing} existing alarm(s) are not this edit's responsibility)` : ""}`] ;
	for (const check of failed) lines.push(`- Safety check failed ${check.id} ${check.label}: ${check.detail}`);
	lines.push(...fresh.slice(0, limit).map(renderAlarm));
	if (fresh.length > limit) lines.push(`- … and ${fresh.length - limit} more (bun <SKILL>/scripts/report.ts --file ${report.file})`);

	return lines.join("\n");
}
