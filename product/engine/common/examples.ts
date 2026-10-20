/**
 * Example and decision records (M1.8 S5b, docs/development/reviews/2026-09-30-codex-learning-db-review.md). They are the evidence and the tests of the pattern DB.
 * The DB stores code; natural language is never a lookup key. An example's `asserts` lists only the alarms that example verifies as present/absent,
 * so unrelated examples do not break when limits are measured or new alarms are added. A decision record never copies the rule text; it points at a document
 * section, and a change in that section's hash requires re-approval. `taste` is only recorded and never used by tests, GUIDE or REVIEW.
 */
import      { createHash              } from "node:crypto"      ;
import      { isPattern, type Pattern } from "./grammar-ids.ts" ;

export const EXAMPLE_SCHEMA_VERSION  = 1 ;
export const DECISION_SCHEMA_VERSION = 1 ;

export type ExampleVerdict = "after-better" | "before-better" | "bad" | "preferred-variant" | "taste" ;
export type RecordStatus   = "candidate" | "approved" | "deprecated"                                  ;

export interface AlarmAssert {
	readonly has?        : readonly string[] ;
	readonly lacks?      : readonly string[] ;
	readonly fixedPoint? : boolean           ;
}

export interface Example {
	readonly schemaVersion : number                                                                                                                                    ;
	readonly id            : string                                                                                                                                    ;
	readonly status        : RecordStatus                                                                                                                              ;
	readonly versions      : Readonly<Record<string, number>>                                                                                                          ;
	readonly language      : string                                                                                                                                    ;
	readonly regime        : "table" | "sentence"                                                                                                                      ;
	readonly patterns      : readonly Pattern[]                                                                                                                        ;
	readonly rules         : readonly string[]                                                                                                                         ;
	readonly before        : string                                                                                                                                    ;
	readonly after         : string                                                                                                                                    ;
	readonly contentHash   : string                                                                                                                                    ;
	readonly verdict       : ExampleVerdict                                                                                                                            ;
	readonly asserts       : { readonly before?: AlarmAssert; readonly after?: AlarmAssert }                                                                           ;
	readonly source        : { readonly kind: "own-code" | "synthetic" | "public-corpus"; readonly license: string; readonly commit?: string; readonly path?: string } ;
	readonly supersedes?   : string                                                                                                                                    ;
	readonly approvedBy    : string                                                                                                                                    ;
	readonly date          : string                                                                                                                                    ;
	readonly note?         : string                                                                                                                                    ;
}

export interface Decision {
	readonly schemaVersion : number                                                      ;
	readonly id            : string                                                      ;
	readonly kind          : "rule" | "exception" | "policy" | "deferred"                ;
	readonly layer         : "charter" | "grammar" | "surface" | "convention" | "agents" ;
	readonly ref           : string                                                      ;
	readonly docHash       : string                                                      ;
	readonly examples      : readonly string[]                                           ;
	readonly approvedBy    : string                                                      ;
	readonly date          : string                                                      ;
}

const VERDICTS : readonly string[] = ["after-better", "before-better", "bad", "preferred-variant", "taste"] ;
const STATUSES : readonly string[] = ["candidate", "approved", "deprecated"]                                ;
const SOURCES  : readonly string[] = ["own-code", "synthetic", "public-corpus"]                             ;
const KINDS    : readonly string[] = ["rule", "exception", "policy", "deferred"]                            ;
const LAYERS   : readonly string[] = ["charter", "grammar", "surface", "convention", "agents"]              ;

const sha256 = (text: string): string => `sha256:${createHash("sha256").update(text).digest("hex")}`;

/** Example content hash: before and after joined with NUL. Used to recognize duplicate examples (never merged automatically). */
export const contentHashOf = (before: string, after: string): string => sha256(`${before}\u0000${after}`);

/** Document section hash: from a `# …`/`## …` heading up to the next heading of the same or higher level. A missing heading is an error. */
export function sectionHash(document: string, heading: string): string {
	const lines = document.split("\n")                                                                               ;
	const start = lines.findIndex(line => /^#+ /u.test(line) && line.replace(/^#+ /u, "").trim() === heading.trim()) ;
	if (start < 0) throw new Error(`heading not found: ${heading}`);

	const level = /^#+/u.exec(lines[start]!)![0].length                                                                          ;
	const end   = lines.findIndex((line, index) => index > start && /^#+ /u.test(line) && /^#+/u.exec(line)![0].length <= level) ;

	return sha256(lines.slice(start, end < 0 ? undefined : end).join("\n"));
}

export function validateExample(value: unknown, where: string): Example {
	const example = value as Example;
	if (example?.schemaVersion !== EXAMPLE_SCHEMA_VERSION) throw new Error(`${where}: schemaVersion must be ${EXAMPLE_SCHEMA_VERSION}`);
	if (typeof example.id !== "string" || example.id === "") throw new Error(`${where}: id is required`);
	if (!STATUSES.includes(example.status)) throw new Error(`${where}: status must be candidate, approved or deprecated`);
	if (!VERDICTS.includes(example.verdict)) throw new Error(`${where}: unknown verdict ${String(example.verdict)}`);
	if (example.regime !== "table" && example.regime !== "sentence") throw new Error(`${where}: regime must be table or sentence`);
	if (!Array.isArray(example.patterns) || !example.patterns.every(isPattern)) throw new Error(`${where}: patterns must be grammar IDs`);
	if (!SOURCES.includes(example.source?.kind) || typeof example.source.license !== "string") throw new Error(`${where}: source needs kind and license`);
	if (example.contentHash !== contentHashOf(example.before, example.after)) throw new Error(`${where}: contentHash does not match before/after`);
	if (example.verdict !== "taste" && !example.asserts?.before && !example.asserts?.after) throw new Error(`${where}: asserts are required unless the verdict is taste`);

	return example;
}

export function validateDecision(value: unknown, where: string): Decision {
	const decision = value as Decision;
	if (decision?.schemaVersion !== DECISION_SCHEMA_VERSION) throw new Error(`${where}: schemaVersion must be ${DECISION_SCHEMA_VERSION}`);
	if (typeof decision.id !== "string" || decision.id === "") throw new Error(`${where}: id is required`);
	if (!KINDS.includes(decision.kind)) throw new Error(`${where}: unknown kind ${String(decision.kind)}`);
	if (!LAYERS.includes(decision.layer)) throw new Error(`${where}: unknown layer ${String(decision.layer)}`);
	if (typeof decision.ref !== "string" || !decision.ref.includes("#")) throw new Error(`${where}: ref must be <path>#<heading>`);
	if (typeof decision.docHash !== "string" || !decision.docHash.startsWith("sha256:")) throw new Error(`${where}: docHash is required`);

	return decision;
}

/** Reads and validates JSONL. Blank lines are skipped; a duplicate id is an error. */
export function parseRecords<T extends { readonly id: string }>(text: string, where: string, validate: (value: unknown, where: string) => T): readonly T[] {
	const records: T[] = []                ;
	const ids          = new Set<string>() ;

	for (const [index, line] of text.split("\n").entries()) {
		if (line.trim() === "") continue;

		const record = validate(JSON.parse(line), `${where}:${index + 1}`);
		if (ids.has(record.id)) throw new Error(`${where}:${index + 1}: duplicate id ${record.id}`);

		ids.add(record.id);
		records.push(record);
	}
	return records;
}

/**
 * Picks the examples to put in GUIDE (deterministic): only approved `after-better` examples with the same language and regime and at least one shared pattern.
 * Sorted by most shared patterns → most recent approval date → id, up to `limit`.
 */
export function selectGuideExamples(examples: readonly Example[], want: { readonly language: string; readonly regime: Example["regime"]; readonly patterns: readonly string[] }, limit = 3): readonly Example[] {
	const overlap = (example: Example): number => example.patterns.filter(pattern => want.patterns.includes(pattern)).length;

	return examples
		.filter(example => example.status === "approved" && example.verdict === "after-better" && example.language === want.language && example.regime === want.regime && overlap(example) > 0)
		.sort((left, right) => overlap(right) - overlap(left) || right.date.localeCompare(left.date) || left.id.localeCompare(right.id))
		.slice(0, limit);
}
