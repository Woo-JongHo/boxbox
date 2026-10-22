/**
 * Check report (M1.8 S3.5): from the aligner's result (one file of the Result JSON) and the file body,
 * builds pass/fail for safety checks S1–S4 and alarms A1–A9. It is a pure function: the same input yields the same report.
 * Alarms are not failures but "places for a human or an AI to look". Deciding (whether to fix, whether to change a rule) is not this module's job.
 */
import      { displayWidth            } from "@/common/display-width.ts" ;
import type { FileResult, GroupState, ResultGroup } from "@/common/result-json.ts"   ;
import      { patternOf               } from "@/common/surface.ts"       ;
import      {
              lookup                ,
              type ConventionDb     ,
              type LookupResult     ,
                                      } from "@/common/conventions.ts"   ;
import      { lookupKeyOf             } from "@/common/signature.ts"     ;

export const REPORT_SCHEMA_VERSION = 1;

/** Alarm thresholds. The numbers are layer-3 convention defaults the user can change. hard/soft are estimates before measurement. */
export interface ReportLimits {
	/** Hard limit: the last column before horizontal scrolling starts in the reference environment (docs/development/research/column-width.md, measurement pending) */
	readonly hard         : number ;
	/** Soft limit: exceeding it only produces a suggestion */
	readonly soft         : number ;
	/** Outlier: alarm when the longest row is this much wider than the second longest (20, same as import rule B) */
	readonly outlierGap   : number ;
	/** Wasted padding: alarm when alignment spaces ÷ content characters in a table exceed this ratio */
	readonly paddingRatio : number;
	/** Large change: alarm when one group has at least this many pending edits */
	readonly largeEdits   : number ;
}

/** Display column of a trailing `;`. undefined if the line does not end with `;`. */
const semicolonColumn = (line: string): number | undefined => /;\r?$/u.test(line) ? displayWidth(line.replace(/\r?$/u, "")) : undefined;

/** The lines directly above and below with the same indentation. */
const indentOf = (line: string): string => /^[ \t]*/u.exec(line)![0];

/**
 * If the line is a target of out-of-table padding (A12), returns the number of spaces before `;`. These are statement-regime lines the engine did not treat as a table,
 * with spaces only before the trailing `;` and no other alignment spaces, and without forming a `;` column with a neighbor (same indentation). Lines aligned by hand
 * into several columns, or that form a column with a neighbor, may be tables the engine does not know yet, so they are left alone (only when certain). Comments and import lines
 * (handled by 00_normalize-imports.ts) are excluded. `development/tools/strip-stray-padding.ts` also uses this function.
 */
export function straySemicolonPadding(lines: readonly string[], index: number): number | undefined {
	const line = lines[index] ?? "";
	if (/^\s*(\/\/|\*|\/\*|import\b|export\s.*\bfrom\b|\}\s*from\b)/u.test(line)) return undefined;

	const padding = /\S([ \t]+);\r?$/u.exec(line);
	if (!padding)                                                                 return undefined;

	const body = line.slice(0, padding.index + 1).replace(/^[ \t]*/u, "");
	if (/ {2,}|\t/u.test(body))                                                   return undefined;

	const column    = semicolonColumn(line)                                                                                                              ;
	const neighbors = [lines[index - 1], lines[index + 1]].filter((other): other is string => other !== undefined && indentOf(other) === indentOf(line)) ;
	if (neighbors.some(other => semicolonColumn(other) === column))               return undefined;

	return padding[1]!.length;
}

export const DEFAULT_LIMITS: ReportLimits = {
	hard         : 118 ,
	soft         : 100 ,
	outlierGap   : 20  ,
	paddingRatio : 0.5 ,
	largeEdits   : 20  ,
};

/** Kinds allowed to be fixed automatically from two rows (user approval, charter invariant 4) */
const TWO_ROW_KINDS = new Set(["declaration-equals", "declaration-call-envelope", "import-declarations"]);

export type CheckStatus = "pass" | "fail" | "not-run" | "skipped";

export interface ReportCheck {
	readonly id     : "S1" | "S2" | "S3" | "S4" ;
	readonly label  : string                    ;
	readonly status : CheckStatus               ;
	readonly detail : string                    ;
}

export type AlarmId = "A0" | "A1" | "A2" | "A3" | "A4" | "A5" | "A6" | "A7" | "A8" | "A9" | "A12";

export interface ReportAlarm {
	readonly id        : AlarmId ;
	readonly label     : string  ;
	readonly startLine : number  ;
	readonly endLine   : number  ;
	readonly detail    : string  ;
	readonly hint      : string  ;
	/** Target used to pair with the baseline: the content of the alarm's first line (whitespace collapsed). Stays the same when line numbers or alignment spaces change. */
	readonly anchor    : string  ;
}

/** Alarm comparison against the baseline (docs/development/authoring-flow.md section 3): paired by kind and target, never compared by count. */
export interface AlarmComparison {
	readonly newAlarms      : readonly ReportAlarm[] ;
	readonly existingAlarms : readonly ReportAlarm[] ;
	readonly resolvedAlarms : readonly ReportAlarm[] ;
}

export interface Report {
	readonly schemaVersion : number                           ;
	readonly file          : string                           ;
	readonly language      : string                           ;
	readonly mode          : "check" | "write"                ;
	readonly limits        : ReportLimits                     ;
	readonly states        : Readonly<Record<string, number>> ;
	readonly checks        : readonly ReportCheck[]           ;
	readonly alarms        : readonly ReportAlarm[]           ;
	/** false if any safety check fails. Alarms do not count as failures. */
	readonly ok            : boolean                ;
	/** Present only when --baseline was given. */
	readonly comparison?   : AlarmComparison        ;
	/** Pattern DB lookup result (S5a, report only). Absent when no DB is given. */
	readonly conventions?  : ConventionSummary      ;
}

/** Pattern DB lookup result for one table. */
export interface ConventionLookup extends LookupResult {
	readonly startLine : number ;
	readonly endLine   : number ;
	readonly kind      : string ;
	readonly key       : string ;
}

export interface ConventionSummary {
	readonly counts  : Readonly<Record<LookupResult["status"], number>> ;
	readonly lookups : readonly ConventionLookup[]                      ;
	readonly records : number                                           ;
}

export interface ReportInput {
	readonly result     : FileResult          ;
	/** Current body of the checked file (after --write, the written body) */
	readonly text       : string              ;
	/** Check result rerun after --write. Used only for the idempotence check (S3) */
	readonly recheck?   : FileResult          ;
	readonly limits?    : ReportLimits        ;
	/** Pattern DB. When given, each table is looked up (report only, behavior unchanged). */
	readonly db?        : ConventionDb        ;
}

const ALARM_LABELS: Readonly<Record<AlarmId, string>> = {
	A0  : "pending alignment"    ,
	A1  : "over hard limit"      ,
	A2  : "over soft limit"      ,
	A3  : "outlier row"          ,
	A4  : "cannot decompose"     ,
	A5  : "ambiguous pattern"    ,
	A6  : "two-row pair"         ,
	A7  : "wasted padding"       ,
	A8  : "no pattern mapping"   ,
	A9  : "large change"         ,
	A12 : "out-of-table padding" ,
};

function patternName(language: string, group: ResultGroup): string | undefined {
	const match = patternOf(language, { kind: language === "typescript" ? group.kind : undefined, axes: group.axes });
	return match ? [match.pattern, ...match.alternatives].join("|") : undefined;
}

const PARSE_DETAIL: Readonly<Record<FileResult["parse"]["status"], (tool: string) => string>> = {
	"ok"      : tool => `re-read with the ${tool} parser; diagnostics unchanged`     ,
	"changed" : tool => `${tool} parser diagnostics changed; the write was reverted` ,
	"skipped" : tool => `${tool} parser is not installed`                            ,
	"not-run" : ()   => "check mode does not write files; checked only with --write" ,
};

function checksOf(input: ReportInput): readonly ReportCheck[] {
	const { result, recheck } = input;
	const refused     = result.groups.filter(group => group.state === "REFUSE").length                                               ;
	const floorBreaks = result.groups.filter(group => group.state === "FIXABLE" && group.rows < 3 && !TWO_ROW_KINDS.has(group.kind)) ;
	const parse       = result.parse.status                                                                                          ;
	const idempotent  = recheck === undefined ? undefined : recheck.summary.edits === 0 && recheck.summary.misaligned === 0          ;
	const details = {
		S1 : `the engine verifies token, string and comment preservation per edit and never writes a failing edit (refused groups ${refused})`                                                 ,
		S2 : PARSE_DETAIL[parse](result.parse.tool || result.language)                                                                                                                         ,
		S3 : idempotent === undefined ? "checked only when rechecking after --write" : `pending edits on recheck ${recheck!.summary.edits}`                                                    ,
		S4 : floorBreaks.length === 0 ? "two-row exceptions: declarations, call envelopes, imports" : floorBreaks.map(group => `${group.startLine}-${group.endLine} ${group.kind}`).join(", ") ,
	};

	return [
		{ id : "S1" , label : "whitespace-only change"    , status : "pass"                                                              , detail : details.S1 },
		{ id : "S2" , label : "same re-parse diagnostics" , status : parse === "ok" ? "pass" : parse === "changed" ? "fail" : parse      , detail : details.S2 },
		{ id : "S3" , label : "idempotent"                , status : idempotent === undefined ? "not-run" : idempotent ? "pass" : "fail" , detail : details.S3 },
		{ id : "S4" , label : "auto-fix needs 3+ rows"    , status : floorBreaks.length === 0 ? "pass" : "fail"                          , detail : details.S4 },
	];
}

/** Spaces that look like alignment inside a table (2+ consecutive, excluding indentation) and the number of content characters. */
function paddingOf(line: string): { readonly padding: number; readonly content: number } {
	const body    = line.replace(/^[ \t]*/u, "")                                                       ;
	const padding = [...body.matchAll(/ {2,}/gu)].reduce((sum, match) => sum + match[0].length - 1, 0) ;
	const content = body.replace(/\s/gu, "").length                                                    ;
	return { padding, content };
}

/** Noncontiguous table spans describe their extent, not ownership of every line inside that extent. */
function rowLinesOf(group: ResultGroup): readonly number[] {
	return group.rowLines ?? Array.from({ length: group.endLine - group.startLine + 1 }, (_, index) => group.startLine + index);
}

function alarmsOf(input: ReportInput, limits: ReportLimits): readonly ReportAlarm[] {
	const { result, text } = input;
	const lines                 = text.split("\n").map(line => line.replace(/\r$/u, ""))                    ;
	const widthOf               = (lineNumber: number): number => displayWidth(lines[lineNumber - 1] ?? "") ;
	const alarms: ReportAlarm[] = []                                                                        ;
	const push = (id: AlarmId, startLine: number, endLine: number, detail: string, hint: string): void => {
		const anchor = (lines[startLine - 1] ?? "").trim().replace(/\s+/gu, " ");
		alarms.push({ id, label: ALARM_LABELS[id], startLine, endLine, detail, hint, anchor });
	};
	const groupAt = (lineNumber: number): ResultGroup | undefined =>
		result.groups.find(group => group.rowLines !== undefined
			? group.rowLines.includes(lineNumber) : group.startLine <= lineNumber && lineNumber <= group.endLine);

	// ① Screen axis: lines that cause horizontal scrolling. Lines in the same table are grouped into one alarm, noting the pattern and column count (density axis).
	const reported = new Set<ResultGroup>();
	for (let lineNumber = 1; lineNumber <= lines.length; lineNumber += 1) {
		const width = widthOf(lineNumber)                                                                            ;
		if (width <= limits.hard) continue                                                                           ;
		const group = groupAt(lineNumber)                                                                  ;
		const hint  = "make only the overflowing rows vertical, or simplify the exceptional element first" ;
		if (!group) {
			push("A1", lineNumber, lineNumber, `${width} cols > hard ${limits.hard} · outside table`, hint);
			continue;
		}
		if (reported.has(group)) continue                                                                            ;
		reported.add(group)                                                                                          ;
		const rows   = rowLinesOf (group                            ) ;
		const over   = rows.filter(row => widthOf(row) > limits.hard) ;
		const widest = Math.max   (...over.map(widthOf)             ) ;
		push("A1", group.startLine, group.endLine, `${over.length} row(s) over hard ${limits.hard} (max ${widest} cols) · pattern ${patternName(result.language, group) ?? "?"} · columns ${group.axes.length}`, hint);
	}

	// Out-of-table padding: with no rows to compare there must be no columns either (grammar section 1, statement regime).
	for (let lineNumber = 1; lineNumber <= lines.length; lineNumber += 1) {
		if (groupAt(lineNumber)) continue;

		const padding = straySemicolonPadding(lines, lineNumber - 1);
		if (padding !== undefined) push("A12", lineNumber, lineNumber, `${padding} space(s) before ;`, "do not align columns outside a table: remove the spaces");
	}

	for (const group of result.groups) {
		const rows    = rowLinesOf(group)                         ;
		const widths  = rows.map(widthOf)                         ;
		const widest  = Math.max(...widths)                       ;
		const pattern = patternName(result.language, group)       ;
		const span    = [group.startLine, group.endLine] as const ;

		if (widest > limits.soft && widest <= limits.hard) push("A2", ...span, `table width ${widest} > soft ${limits.soft}`, "allowed range; check whether it can be simplified");

		const sorted = [...widths].sort((left, right) => right - left);
		if (sorted.length >= 3 && sorted[0]! - sorted[1]! >= limits.outlierGap) {
			const row = rows[widths.indexOf(sorted[0]!)]!;
			push("A3", row, row, `longest row is ${sorted[0]! - sorted[1]!} cols wider than the second`, "simplify that row's exceptional element first");
		}

		const byState: Readonly<Partial<Record<GroupState, readonly [AlarmId, string, string]>>> = {
			FIXABLE : ["A0", `${group.kind} ${group.rows} rows, pending edits ${group.edits}`, "fixable by whitespace alignment (safe): 06_align-tables.ts --file <file> --write"] ,
			REFUSE  : ["A4", `${group.kind}: cannot split losslessly`                       , "check the row structure; if it is an engine bug, add a fixture"                ]    ,
			SUGGEST : ["A6", `${group.kind} ${group.rows} rows`                              , "a human decides whether to make it a table"                                   ]    ,
		};
		const stateAlarm = byState[group.state];
		if (stateAlarm) push(stateAlarm[0], ...span, stateAlarm[1], stateAlarm[2]);

		if (pattern === undefined) push("A8", ...span, `${group.kind} (axes ${group.axes.map(axis => axis.split("=")[0]).join(">")})`, "add a mapping to the surface-form data");
		else if (pattern.includes("|")) push("A5", ...span, `${pattern}`, "pattern the engine cannot distinguish; decided by verdict");

		const padding = rows.map(row => paddingOf(lines[row - 1] ?? "")).reduce((sum, cell) => ({ padding: sum.padding + cell.padding, content: sum.content + cell.content }), { padding: 0, content: 0 });
		if (padding.content > 0 && padding.padding / padding.content > limits.paddingRatio) {
			push("A7", ...span, `alignment spaces ${padding.padding} / content ${padding.content}`, "check whether the spaces pull semantic units apart");
		}

		if (group.state === "FIXABLE" && group.edits >= limits.largeEdits) push("A9", ...span, `pending edits ${group.edits}`, "a human reviews the before and after");
	}
	return alarms.sort((left, right) => left.startLine - right.startLine || left.id.localeCompare(right.id));
}

/** Looks up the pattern DB with each table's lookup key. A two-row pair is not a table, so it is not looked up. */
function conventionsOf(result: FileResult, db: ConventionDb): ConventionSummary {
	const counts                       = { approved: 0, rejected: 0, unknown: 0, conflict: 0 } ;
	const lookups : ConventionLookup[] = []                                                    ;

	for (const group of result.groups) {
		if (group.kind === "pair") continue;

		const key   = lookupKeyOf(result.language, group.context, group.kind, group.axes) ;
		const found = lookup     (db, key, result.file                                  ) ;
		counts[found.status] += 1;
		lookups.push({ startLine: group.startLine, endLine: group.endLine, kind: group.kind, key, ...found });
	}
	return { counts, lookups, records: db.total };
}

export function buildReport(input: ReportInput): Report {
	const limits                         = input.limits ?? DEFAULT_LIMITS ;
	const checks                         = checksOf(input)                ;
	const states: Record<string, number> = {}                             ;
	for (const group of input.result.groups) states[group.state] = (states[group.state] ?? 0) + 1;
	return {
		schemaVersion : REPORT_SCHEMA_VERSION                          ,
		file          : input.result.file                              ,
		language      : input.result.language                          ,
		mode          : input.result.mode                              ,
		limits        : limits                                         ,
		states        : states                                         ,
		checks        : checks                                         ,
		alarms        : alarmsOf(input, limits)                        ,
		ok            : checks.every(check => check.status !== "fail") ,
		...(input.db ? { conventions: conventionsOf(input.result, input.db) } : {}),
	};
}

const alarmKey = (alarm: ReportAlarm): string => `${alarm.id}|${alarm.anchor}`;

/** Pairs the result's alarms one by one with the baseline's alarms by kind and target. With several identical keys, only as many as exist are paired. */
export function compareAlarms(current: readonly ReportAlarm[], baseline: readonly ReportAlarm[]): AlarmComparison {
	const unmatched = new Map<string, ReportAlarm[]>();

	for (const alarm of baseline) {
		const bucket = unmatched.get(alarmKey(alarm)) ?? [];

		bucket.push(alarm);
		unmatched.set(alarmKey(alarm), bucket);
	}

	const newAlarms      : ReportAlarm[] = [] ;
	const existingAlarms : ReportAlarm[] = [] ;

	for (const alarm of current) {
		const match = unmatched.get(alarmKey(alarm))?.shift();

		if (match) existingAlarms.push(alarm);
		else newAlarms.push(alarm);
	}

	return { newAlarms, existingAlarms, resolvedAlarms: [...unmatched.values()].flat() };
}

/** Attaches the baseline comparison to the report. Safety checks and the exit code stay the same. */
export function withBaseline(report: Report, baseline: Report): Report {
	return { ...report, comparison: compareAlarms(report.alarms, baseline.alarms) };
}

/** Pads on the right by display width (CJK characters take 2 columns). */
const padDisplay = (value: string, width: number): string => value + " ".repeat(Math.max(0, width - displayWidth(value)));

const STATUS_TEXT: Readonly<Record<CheckStatus, string>> = {
	"pass"    : "pass"                   ,
	"fail"    : "fail"                   ,
	"not-run" : "not applicable"         ,
	"skipped" : "skipped (tool missing)" ,
};

/** Human-readable report. */
export function renderReport(report: Report): string {
	const lines = [`boxbox report ${report.file}  (${report.language}, ${report.mode})`, "", "Safety checks"] ;
	for (const check of report.checks) lines.push(`  ${check.id} ${padDisplay(check.label, 26)} ${padDisplay(STATUS_TEXT[check.status], 20)} ${check.detail}`) ;
	const states = Object.entries(report.states).map(([state, count]) => `${state} ${count}`).join(" · ")                                        ;
	lines.push("", `${Object.values(report.states).reduce((sum, count) => sum + count, 0)} group(s): ${states || "none"}`, "") ;
	if (report.conventions) {
		const { counts, records } = report.conventions;
		lines.push(`Pattern DB: approved ${counts.approved} · rejected ${counts.rejected} · unknown ${counts.unknown} · conflict ${counts.conflict}  (${records} record(s), report only)`, "");
	}
	const renderAlarm = (alarm: ReportAlarm): string => {
		const where = alarm.startLine === alarm.endLine ? `line ${alarm.startLine}` : `lines ${alarm.startLine}–${alarm.endLine}`;
		return `  ${alarm.id} ${padDisplay(alarm.label, 22)} ${padDisplay(where, 14)} ${alarm.detail}  → ${alarm.hint}`   ;
	};
	const limits = `(hard ${report.limits.hard} · soft ${report.limits.soft}: estimates, measurement pending)`;
	const { comparison } = report;
	if (!comparison) {
		lines.push(`${report.alarms.length} alarm(s)  ${limits}`, ...report.alarms.map(renderAlarm)) ;
	} else {
		lines.push(`${comparison.newAlarms.length} new alarm(s)  ${limits}`, ...comparison.newAlarms.map(renderAlarm)) ;
		lines.push("", `${comparison.existingAlarms.length} existing alarm(s) (also in the baseline; not this edit's responsibility)`);
		lines.push(...comparison.existingAlarms.map(renderAlarm));
		lines.push("", `${comparison.resolvedAlarms.length} resolved alarm(s)`);
		lines.push(...comparison.resolvedAlarms.map(alarm => `  ${alarm.id} ${padDisplay(alarm.label, 22)} baseline line ${alarm.startLine}: ${alarm.anchor}`)) ;
	}
	lines.push("", report.ok ? "Result: safety checks passed (alarms do not count as failures)" : "Result: safety checks failed");
	return lines.join("\n");
}
