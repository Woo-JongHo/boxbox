import type { ApprovalResult          } from "@/common/18_approval-gate.ts" ;
import type { FileResult, ResultGroup } from "@/common/24_result-json.ts"   ;

export type RecoveryCategory = "alignment" | "approval" | "structural-prerequisite" | "safety" | "syntax" | "unsupported" | "tool";

/** A finding routes work; it never grants approval or expands an authoring request. */
export interface RecoveryIssue {
	readonly file      : string                           ;
	readonly startLine : number                           ;
	readonly endLine   : number                           ;
	readonly kind      : string                           ;
	readonly category  : RecoveryCategory                 ;
	readonly reason    : string                           ;
	readonly owner     : "agent" | "human" | "maintainer" ;
	readonly next      : string                           ;
	/** Exact automatic-write lookup key, when approval was evaluated. */
	readonly key?: string;
}

export interface RecoveryReport {
	readonly issues: readonly RecoveryIssue[];
	readonly omitted: number;
}

const LIMIT = 20;

export function boundedRecovery(issues: readonly RecoveryIssue[]): RecoveryReport {
	return {
		issues: issues.slice(0, LIMIT).map(issue => ({ ...issue, reason: issue.reason.slice(0, 500) })),
		omitted: Math.max(0, issues.length - LIMIT),
	};
}

export function mergeRecovery(reports: readonly RecoveryReport[]): RecoveryReport {
	const bounded = boundedRecovery(reports.flatMap(report => report.issues));
	return { issues: bounded.issues, omitted: bounded.omitted + reports.reduce((sum, report) => sum + report.omitted, 0) };
}

export function groupRecovery(file: string, group: ResultGroup): RecoveryIssue | undefined {
	const location = { file, startLine: group.startLine, endLine: group.endLine, kind: group.kind };
	if (group.kind === "interface-members-compressed") return {
		...location, category: "structural-prerequisite", reason: "interface members share one physical line", owner: "agent",
		next: "Within an independently authorized Write/Refactor request, expand the members, verify behavior and source Check, then retry Align. An Align-only request needs structural-edit authorization first.",
	};
	if (group.kind === "syntax-validation-error") return {
		...location, category: "tool", reason: group.reason ?? "source parser failed", owner: "maintainer",
		next: "Repair the parser/runtime failure and rerun Check; do not treat unavailable syntax validation as a source pass.",
	};
	if (group.state === "REFUSE") return {
		...location, category: group.kind === "syntax" ? "syntax" : "safety", reason: group.reason ?? "lossless alignment could not be verified", owner: "agent",
		next: "Inspect the source and specific refusal; repair only within the authorized scope and rerun Check. Preserve the safety gate; escalate an isolated valid-source reproduction to the maintainer.",
	};
	if (group.state === "SUGGEST") return {
		...location, category: "unsupported", reason: group.reason ?? "advisory shape outside automatic alignment coverage", owner: "agent",
		next: "Review the reported shape within authorized Write/Refactor, verify it separately, or retain it unchanged. Detection does not grant automatic-write approval.",
	};
	if (group.state === "FIXABLE") return {
		...location, category: "alignment", reason: "detected rows require alignment", owner: "agent",
		next: "Continue independently authorized Write/Refactor and verify source Check; use automatic Align only after exact approval and a successful preview.",
	};
	return undefined;
}

export function approvalRecovery(file: string, group: ResultGroup, key: string, approval: ApprovalResult): RecoveryIssue {
	return {
		file, startLine: group.startLine, endLine: group.endLine, kind: group.kind, key,
		category: "approval", reason: `${approval.status}: ${approval.reasons.join("; ")}`, owner: "human",
		next: "For automatic Align, obtain or repair human proof for this exact key and scope. Continue independently authorized Write/Refactor with separate verification; never manufacture approval or widen Align.",
	};
}

export function resultRecovery(result: FileResult, file = result.file): RecoveryReport {
	const issues = result.groups.flatMap(group => {
		const issue = groupRecovery(file, group);
		return issue ? [issue] : [];
	});
	for (const entry of result.unsupported ?? []) issues.push({
		file, startLine: entry.line, endLine: entry.line, kind: "unsupported", category: "unsupported", reason: entry.reason, owner: "maintainer",
		next: "Retain the unsupported source or verify an independently authorized authoring change; report a minimized coverage case separately.",
	});
	return boundedRecovery(issues);
}

export function operationRecovery(file: string, category: "syntax" | "safety" | "tool", reason: string): RecoveryReport {
	return boundedRecovery([{
		file, startLine: 1, endLine: 1, kind: "operation", category, reason, owner: category === "tool" ? "maintainer" : "agent",
		next: category === "tool" ? "Inspect the tool/runtime failure and retry only after its cause is understood; preserve source bytes and approval requirements." : "Repair the reported source or safety precondition within the authorized scope, then rerun Check and preview without bypassing the gate.",
	}]);
}

export class PipelineError extends Error {
	readonly recovery: RecoveryReport;

	constructor(message: string, recovery: RecoveryReport) {
		super(`${message}${recovery.issues.length ? `; ${renderRecovery(recovery)}` : ""}`);
		this.recovery = recovery;
	}
}

/** A writer failure remains actionable even if a tool returns no usable JSON report. */
export function typeScriptWriteFailure(report: string, file: string, code: number): PipelineError {
	const message = `BoxBox alignment failed with exit code ${code}`;
	try {
		const result   = JSON.parse(report).results[0] as FileResult                                                                                       ;
		const recovery = resultRecovery({ ...result, groups: result.groups.filter(group => group.state === "SUGGEST" || group.state === "REFUSE") }, file) ;
		return new PipelineError(message, recovery.issues.length ? recovery : operationRecovery(file, "safety", `TypeScript writer verification failed with exit code ${code}`));
	} catch {
		return new PipelineError(message, operationRecovery(file, "tool", `TypeScript writer returned exit code ${code} without a readable result report`));
	}
}

export function renderRecovery(report: RecoveryReport): string {
	return report.issues.map(issue => `${issue.file}:${issue.startLine}-${issue.endLine} [${issue.category}] ${issue.reason}; owner=${issue.owner}; next=${issue.next}`).join("\n")
		+ (report.omitted ? `\n${report.omitted} further findings omitted; inspect the complete source report.` : "");
}
