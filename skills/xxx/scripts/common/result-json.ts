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
	readonly tool          : "xxx"                 ;
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

export const envelope = (results: readonly FileResult[]): ResultEnvelope => ({ schemaVersion: RESULT_SCHEMA_VERSION, tool: "xxx", results });
