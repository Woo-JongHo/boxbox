Read-only targeted follow-up to the initial Sonnet review: exact row membership for noncontiguous guard reports. Review ONLY this diff and its tests; prior detector and dot changes reviewed separately. No commands or edits. Check metadata production in normal/refused paths, compatibility for ordinary groups, report A1/A2/A3/A7 and A12 group ownership. Finish PASS/BLOCKED and concrete defects. 44 relevant tests and tsc passed.

--- before/product/engine/typescript/align.ts
+++ product/engine/typescript/align.ts
@@ -37,6 +37,8 @@
 	readonly startLine : number ;
 	readonly endLine   : number ;
 	readonly rowCount  : number ;
+	/** Exact row membership for noncontiguous guard regions. */
+	readonly rowLines? : readonly number[];
 	/** Rows rendered as the declaration vertical form; their edits replace the whole row and may insert line breaks. */
 	readonly vertical : number            ;
 	readonly axes     : readonly string[] ;
@@ -134,6 +136,7 @@
 		startLine : source.getLineAndCharacterOfPosition(first.getStart(source)).line + 1,
 		endLine   : source.getLineAndCharacterOfPosition(last.getEnd() - 1).line + 1,
 		rowCount  : run.length,
+		...(kindName === "return-guards" ? { rowLines: run.map(row => source.getLineAndCharacterOfPosition(row.node.getStart(source)).line + 1) } : {}),
 		vertical  : marked.length,
 		context   : context,
 		depth     : depth,
@@ -333,8 +336,8 @@
 	const report = (parse: ResultParse): void => {
 		if (!json) return;
 		const resultGroups: ResultGroup[] = [
-			...groups.map(group => ({ kind: group.kind, startLine: group.startLine, endLine: group.endLine, rows: group.rowCount, axes: group.axes, state: group.edits.length > 0 ? "FIXABLE" as const : "PASS" as const, edits: group.edits.length, context: group.context, depth: group.depth })),
-			...refused.map(group => ({ kind: group.kind, startLine: group.startLine, endLine: group.endLine, rows: group.rowCount, axes: group.axes, state: "REFUSE" as const, edits: group.edits.length, context: group.context, depth: group.depth })),
+			...groups.map(group => ({ kind: group.kind, startLine: group.startLine, endLine: group.endLine, rows: group.rowCount, rowLines: group.rowLines, axes: group.axes, state: group.edits.length > 0 ? "FIXABLE" as const : "PASS" as const, edits: group.edits.length, context: group.context, depth: group.depth })),
+			...refused.map(group => ({ kind: group.kind, startLine: group.startLine, endLine: group.endLine, rows: group.rowCount, rowLines: group.rowLines, axes: group.axes, state: "REFUSE" as const, edits: group.edits.length, context: group.context, depth: group.depth })),
 			...result.compressed.map(entry => ({ kind: "interface-members-compressed", startLine: entry.line, endLine: entry.line, rows: entry.members, axes: [], state: "SUGGEST" as const, edits: 0 })),
 		].sort((left, right) => left.startLine - right.startLine);
 		emit(JSON.stringify(envelope([{ file: relative, language: "typescript", mode: write ? "write" : "check", summary: summarize(resultGroups), groups: resultGroups, parse }]), null, 2));


--- before/product/engine/common/report.ts
+++ product/engine/common/report.ts
@@ -182,6 +182,11 @@
 	return { padding, content };
 }
 
+/** Noncontiguous table spans describe their extent, not ownership of every line inside that extent. */
+function rowLinesOf(group: ResultGroup): readonly number[] {
+	return group.rowLines ?? Array.from({ length: group.endLine - group.startLine + 1 }, (_, index) => group.startLine + index);
+}
+
 function alarmsOf(input: ReportInput, limits: ReportLimits): readonly ReportAlarm[] {
 	const { result, text } = input;
 	const lines                 = text.split("\n").map(line => line.replace(/\r$/u, ""))                    ;
@@ -192,7 +197,8 @@
 		alarms.push({ id, label: ALARM_LABELS[id], startLine, endLine, detail, hint, anchor });
 	};
 	const groupAt = (lineNumber: number): ResultGroup | undefined =>
-		result.groups.find(group => group.startLine <= lineNumber && lineNumber <= group.endLine);
+		result.groups.find(group => group.rowLines !== undefined
+			? group.rowLines.includes(lineNumber) : group.startLine <= lineNumber && lineNumber <= group.endLine);
 
 	// ① Screen axis: lines that cause horizontal scrolling. Lines in the same table are grouped into one alarm, noting the pattern and column count (density axis).
 	const reported = new Set<ResultGroup>();
@@ -207,9 +213,9 @@
 		}
 		if (reported.has(group)) continue                                                                            ;
 		reported.add(group)                                                                                          ;
-		const rows   = Array.from  ({ length: group.endLine - group.startLine + 1 }, (_, index) => group.startLine + index) ;
-		const over   = rows .filter(row => widthOf(row) > limits.hard                                                     ) ;
-		const widest = Math .max   (...over.map(widthOf)                                                                  ) ;
+		const rows   = rowLinesOf (group                            ) ;
+		const over   = rows.filter(row => widthOf(row) > limits.hard) ;
+		const widest = Math.max   (...over.map(widthOf)             ) ;
 		push("A1", group.startLine, group.endLine, `${over.length} row(s) over hard ${limits.hard} (max ${widest} cols) · pattern ${patternName(result.language, group) ?? "?"} · columns ${group.axes.length}`, hint);
 	}
 
@@ -222,11 +228,11 @@
 	}
 
 	for (const group of result.groups) {
-		const rows    = Array.from({ length: group.endLine - group.startLine + 1 }, (_, index) => group.startLine + index) ;
-		const widths  = rows.map(widthOf)                                                                                  ;
-		const widest  = Math.max(...widths)                                                                                ;
-		const pattern = patternName(result.language, group)                                                                ;
-		const span    = [group.startLine, group.endLine] as const                                                          ;
+		const rows    = rowLinesOf(group)                         ;
+		const widths  = rows.map(widthOf)                         ;
+		const widest  = Math.max(...widths)                       ;
+		const pattern = patternName(result.language, group)       ;
+		const span    = [group.startLine, group.endLine] as const ;
 
 		if (widest > limits.soft && widest <= limits.hard) push("A2", ...span, `table width ${widest} > soft ${limits.soft}`, "allowed range; check whether it can be simplified");
 


--- before/test/report.test.ts
+++ test/report.test.ts
@@ -1,11 +1,11 @@
 import      { describe, expect, test                                   } from "bun:test"                  ;
 import      { spawnSync                                                } from "node:child_process"        ;
-import      { mkdtempSync, readFileSync, writeFileSync                 } from "node:fs"                   ;
+import      { mkdtempSync, readFileSync, rmSync, writeFileSync         } from "node:fs"                   ;
 import      { tmpdir                                                   } from "node:os"                   ;
 import      { join                                                     } from "node:path"                 ;
 import      { displayWidth                                             } from "@/common/display-width.ts" ;
 import      { buildReport, compareAlarms, DEFAULT_LIMITS, renderReport } from "@/common/report.ts"        ;
-import type { FileResult, ResultGroup                                  } from "@/common/result-json.ts"   ;
+import type { FileResult, ResultEnvelope, ResultGroup                  } from "@/common/result-json.ts"   ;
 
 const ROOT = join(import.meta.dir, "..");
 
@@ -127,6 +127,76 @@
 	});
 });
 
+describe("check report — exact noncontiguous row membership", () => {
+	test("intervening long padded preparation lines stay outside guard width and padding calculations", () => {
+		const guards      = group({ kind: "return-guards", startLine: 1, endLine: 5, rows: 3, rowLines: [1, 3, 5], axes: ["guard-return=12"] }) ;
+		const preparation = `prepare()${" ".repeat(200)};`                                                                                      ;
+		const report = buildReport({
+			result: fileResult([guards]),
+			text: text("if (a) return;", preparation, "if (b) return;", "const value = 1;", "if (c) return;"),
+		});
+		const hard  = report.alarms.filter(alarm => alarm.id === "A1" ) ;
+		const stray = report.alarms.filter(alarm => alarm.id === "A12") ;
+
+		expect(hard.map(alarm => [alarm.startLine, alarm.endLine]))    .toEqual  ([[2, 2]]       ) ;
+		expect(hard[0]!.detail                                    )    .toContain("outside table") ;
+		expect(stray.map(alarm => alarm.startLine)                )    .toEqual  ([2]            ) ;
+		expect(ids(report)                                        ).not.toContain("A2"           ) ;
+		expect(ids(report)                                        ).not.toContain("A3"           ) ;
+		expect(ids(report)                                        ).not.toContain("A7"           ) ;
+	});
+
+	test("nested groups own their rows even when an outer guard region spans the whole nested block", () => {
+		const outer = group({ kind: "return-guards", startLine: 1, endLine: 9, rows: 3, rowLines: [1, 7, 9], axes: ["guard-return=12"]}) ;
+		const inner = group({ kind: "return-guards", startLine: 3, endLine: 5, rows: 3, rowLines: [3, 4, 5], axes: ["guard-return=12"]}) ;
+		const report = buildReport({
+			result: fileResult([outer, inner]),
+			text: text("if (a) return;", "for (;;) {", "  if (b) return;", `  if (c) return "${"x".repeat(140)}";`, "  if (d) return;", "}", "if (e) return;", "observe();", "if (f) return;"),
+		});
+		const hard    = report.alarms.filter(alarm => alarm.id === "A1") ;
+		const outlier = report.alarms.filter(alarm => alarm.id === "A3") ;
+
+		expect(hard.map(alarm => [alarm.startLine, alarm.endLine])).toEqual  ([[3, 5]]            ) ;
+		expect(hard[0]!.detail                                    ).toContain("1 row(s) over hard") ;
+		expect(outlier.map(alarm => alarm.startLine)              ).toEqual  ([4]                 ) ;
+	});
+
+	test("CLI emits exact outer and inner guard lines while ordinary groups keep the legacy schema", () => {
+		const root = mkdtempSync(join(tmpdir(), "boxbox-row-lines-"));
+		const lines = [
+			"function inspect() {",
+			"  if (a) return undefined;",
+			"  for (;;) {",
+			"    if (x) return undefined;",
+			"    if (yyyy) return undefined;",
+			"    if (z) return undefined;",
+			"  }",
+			"  if (longer) return undefined;",
+			"  const a = 1;",
+			"  const bb = 2;",
+			"  if (b) return undefined;",
+			"}",
+		];
+
+		try {
+			writeFileSync(join(root, "sample.ts"), `${lines.join("\n")}\n`);
+
+			const run    = spawnSync(process.execPath, [join(ROOT, "product/engine/typescript/06_align-tables.ts"), "--file", "sample.ts", "--json"], { cwd: root, encoding: "utf8" }) ;
+			const result = JSON.parse(run.stdout) as ResultEnvelope                                                                                                                    ;
+			const groups = result.results[0]!.groups                                                                                                                                   ;
+			const guards = groups.filter(entry => entry.kind === "return-guards")                                                                                                      ;
+
+			expect(run.status                                                                                   ).toBe   (1                      ) ;
+			expect(result.schemaVersion                                                                         ).toBe   (1                      ) ;
+			expect(guards.map(entry => entry.rowLines)                                                          ).toEqual([[2, 8, 11], [4, 5, 6]]) ;
+			expect(groups.some(entry => entry.kind === "declaration-equals")                                    ).toBe   (true                   ) ;
+			expect(groups.filter(entry => entry.kind !== "return-guards").every(entry => !("rowLines" in entry))).toBe   (true                   ) ;
+		} finally {
+			rmSync(root, { recursive: true, force: true });
+		}
+	}, 60_000);
+});
+
 describe("check report — output", () => {
 	test("the description column of the safety-check lines lines up in one column by display width", () => {
 		const rendered = renderReport(buildReport({ result: fileResult([]), text: "" })).split("\n").filter(line => /^  S\d /u.test(line)) ;


/**
 * Versioned machine-readable result shared by every aligner (`--json`, design §3.3). The TypeScript aligner and all
 * line-engine aligners emit the same envelope, so agents, CI and the corpus tools read one format.
 */
export const RESULT_SCHEMA_VERSION = 1;

/** PASS aligned · FIXABLE whitespace edits pending · SUGGEST needs a person (pairs, compressed rows) · REFUSE unsafe. */
export type GroupState = "PASS" | "FIXABLE" | "SUGGEST" | "REFUSE";

export interface ResultGroup {
	readonly kind      : string            ;
	readonly startLine : number            ;
	readonly endLine   : number            ;
	readonly rows      : number            ;
	/** Exact 1-based row lines for noncontiguous tables; absent means the inclusive start/end span. */
	readonly rowLines? : readonly number[] ;
	readonly axes      : readonly string[] ;
	readonly state     : GroupState        ;
	readonly edits     : number            ;
	/** The immediate container of the table (TypeScript: the AST container kind); omitted where unknowable. */
	readonly context?  : string            ;
	/** How deeply nested the table's container is (0 = top level). */
	readonly depth?    : number            ;
}

export interface ResultParse {
	/** `not-run` in check mode; the re-parse gate runs only when writing. */
	readonly status  : "ok" | "changed" | "skipped" | "not-run" ;
	readonly tool    : string                                   ;
	readonly passes? : number                                   ;
}

export interface ResultSummary {
	readonly groups     : number ;
	readonly misaligned : number ;
	readonly edits      : number ;
	readonly refused    : number ;
	readonly suggested  : number ;
}

export interface FileResult {
	readonly file     : string                 ;
	readonly language : string                 ;
	readonly mode     : "check" | "write"      ;
	readonly summary  : ResultSummary          ;
	readonly groups   : readonly ResultGroup[] ;
	readonly parse    : ResultParse            ;
}

export interface ResultEnvelope {
	readonly schemaVersion : number                ;
	readonly tool          : "boxbox"              ;
	readonly results       : readonly FileResult[] ;
}

/** Builds the summary from the groups so the two can never disagree. */
export function summarize(groups: readonly ResultGroup[]): ResultSummary {
	return {
		groups     : groups.length,
		misaligned : groups.filter(group => group.state === "FIXABLE").length,
		edits      : groups.filter(group => group.state === "FIXABLE").reduce((count, group) => count + group.edits, 0),
		refused    : groups.filter(group => group.state === "REFUSE").length,
		suggested  : groups.filter(group => group.state === "SUGGEST").length,
	};
}

export const envelope = (results: readonly FileResult[]): ResultEnvelope => ({ schemaVersion: RESULT_SCHEMA_VERSION, tool: "boxbox", results });
