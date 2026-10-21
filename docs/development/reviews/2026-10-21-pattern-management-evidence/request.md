# Independent architectural critique: managing diverse code patterns

The user explicitly requested a GLM review. Read-only critique of this frozen brief, not implementation or release approval. Output English Markdown, at most 1400 words. No tools or file changes. Distinguish supplied implementation facts from hypotheses and recommendations. Do not simply endorse the proposal.

## User intent
BoxBox is an open-source plugin for Codex and Claude. The user reads code like a spreadsheet: meaningful rows, corresponding syntax boundaries as columns, minimum widths. They want consistency across many situations and languages without changing program behavior or degrading performance. Public execution currently supports TypeScript/Python; JSON/YAML are requested targets. Write/Refactor are agent workflows; Align is deterministic horizontal-whitespace-only; Check is read-only. Performance and behavior of agent refactors require separate evidence.

Recent requests: align guard return starts across intervening statements; share outer parentheses across different function names/arities; terminal receiver/method dot as a column; separate long nested type fields into their own tables; normalize configured import aliases in Refactor only. Do not move executable statements to make a table. A one-word 'blank line' message was not clarified: it DOES NOT authorize universal blank-line grouping or a new approved rule.

The user initially imagined SQLite as the source of judgment about how code should be written, not just a corpus archive. They now ask whether the objective should be: 'How do we manage standardized patterns across genuinely diverse situations?'

## Current verified implementation facts
- SQLite is not integrated; JSON/JSONL files hold conventions, examples and decisions.
- Engine AST/line adapters define row extraction, grouping, axes, row floors and actual alignment mechanics largely in code. Built-in grammar/form data also exists.
- Exact versioned lookup key: language + container context + kind + normalized ordered axes; lookup drops nesting depth. Diagnostic signatures retain depth. Exact lookup, not nearest-neighbor automatic fixes.
- Approval registry uses project > user > preset, exact key/scope, human decisions and example/document hashes. Observations never auto-approve. The report-only loader does not currently load user records, a known divergence.
- Two shipped approved rules: TypeScript top-level same-call declarations (2+ rows) and Python simple assignment tables (3+ rows). Guard/call-envelope/dot support was added but its new keys are not approved by those old rules.
- Guide returns approved rule text, positive examples and counterexamples. The engine's grouping/axis behavior is not yet selected by declarative recipes in the registry.
- Read-only check currently does not validate syntax; runtime record validation gaps remain. Passing a layout check is not a proof of safe writing.
- Existing conservative docs say SQLite only as optional derived index; user discussion now considers a broader role. No SQL schema, driver or approval-authority migration has been chosen. No implementation is authorized by this review request.

## Proposal to critique, not a settled decision
1. Model a pattern as context + row relationship + supported columns + applicability + exclusions + examples/counterexamples + verification + version/decision history.
2. Engine supplies bounded, tested structural operations. Rules may select safe grouping and column policies; parser/safety invariants cannot be weakened by data. Unknown structures require a new adapter/primitive rather than an executable script stored in a DB.
3. A central knowledge store supports evidence collection, candidate review and approved rule lookup. SQLite might be development-only, a runtime DB, or both with different payloads. Review these options against actual needs, not a blanket preference.
4. Public artifacts contain approved rules and necessary examples, not private corpus or full development history. JSON/JSONL may remain the first distribution format. Do not allow two independently writable approval authorities. Who authors, approves, exports and imports must be explicit.
5. Begin with a decision table for return-guard scenarios to expose ambiguity; trial data-driven execution on one existing approved rule without widening its authority. More rules/SQL implementation follow evidence, not speculative framework building.

## Required review output
- Verdict: sound direction / revise / reject, with reasons.
- Sharpen the actual product objective and measurable success; differentiate visual uniformity from equivalence of role.
- Biggest 3-5 risks, including combinatorial rule explosion, semantic role ambiguity, overlapping rules, grouping-before-lookup circularity, and false confidence from approval.
- Minimal conceptual data model: what belongs in engine, rule data, evidence, approval and history. Explicitly address blank lines and nested syntax as contextual policy, not universal punctuation rules.
- Compare development-only SQLite, SQLite in the distributed runtime, and JSON/JSONL-first. Recommend one initial path and concrete triggers for changing it. State canonical authority and deterministic export/update behavior.
- Smallest useful experiment, representative positive/negative scenarios, measurable acceptance, migration/rejection behavior, and no overbuilt arbitrary rule DSL.
- At most three decisions genuinely needed from the user now; defer technical details where possible.

## Frozen source excerpts

### product/engine/common/signature.ts
```
/**
 * Pattern identity (design §4.1, plan M1.7 P1): the key under which a table's pattern is judged, approved and looked
 * up. The key is (language, container context, kind, ordered axis ids, nesting depth) — never the result state, so a
 * table keeps its key before and after it is aligned. The key format is a public contract: any change to it bumps
 * SIGNATURE_VERSION, and stored records keyed by an older version must be migrated, never matched loosely.
 */
export const SIGNATURE_VERSION = 1;

/** Normalizes one axis id for typing: `axis=target` loses its column, digit runs become `{i}`, a callee becomes `call:*`. */
export function normalizeAxis(axis: string): string {
	const bare  = axis.split("=")[0]!                  ;
	const typed = bare.replace(/^call:.+$/u, "call:*") ;
	return typed.replace(/\d+/gu, "{i}")               ;
}

/** The identity key of one table: `language|context|kind|axis>axis|d<depth>`. */
export function signatureOf(language: string, context: string, kind: string, axes: readonly string[], depth: number): string {
	return `${language}|${context}|${kind}|${axes.map(normalizeAxis).join(">")}|d${depth}`;
}

/** Nesting depth of a line-engine table from its shared indentation (a tab counts as four columns). */
export function indentDepth(indent: string): number {
	return Math.floor(indent.replaceAll("\t", "    ").length / 4) ;
}

/**
 * Pattern DB lookup key (M1.8 S5a, docs/development/reviews/2026-09-30-codex-lookup-review.md). Unlike the diagnostic signature it drops depth,
 * so tables of the same shape group into one pattern regardless of indentation. The version is prefixed, so old keys are not looked up after a format change
 * (explicit migration only). An empty context (line engine) is written as `-`.
 */
export const LOOKUP_KEY_VERSION = 1;

export function lookupKeyOf(language: string, context: string | undefined, kind: string, axes: readonly string[]): string {
	return `v${LOOKUP_KEY_VERSION}|${language}|${context || "-"}|${kind}|${axes.map(normalizeAxis).join(">")}`;
}

```

### product/rules/presets/recommended/conventions.jsonl
```
{"schemaVersion":1,"id":"ts-sourcefile-call-declarations","key":"v1|typescript|SourceFile|declaration-equals|equals>call-open-paren>call-close-paren>semicolon","pattern":"DEFINE","status":"approved","scope":"**/*.ts","examples":["ts-sourcefile-call-declarations-positive","ts-sourcefile-call-declarations-single-row-counterexample"],"versions":{"lookupKey":1,"conventionSchema":1,"exampleSchema":1,"decisionSchema":1},"approvedBy":"maintainer","date":"2026-10-21"}
{"schemaVersion":1,"id":"py-simple-assignments","key":"v1|python|-|table|name>equal>value","pattern":"DEFINE","status":"approved","scope":"**/*.py","examples":["py-simple-assignments-positive","py-simple-assignments-two-row-counterexample"],"versions":{"lookupKey":1,"conventionSchema":1,"exampleSchema":1,"decisionSchema":1},"approvedBy":"maintainer","date":"2026-10-21"}

```

### Current Convention shape
```ts
export interface Convention {
	readonly schemaVersion : number                           ;
	readonly id            : string                           ;
	readonly key           : string                           ;
	readonly pattern       : Pattern                          ;
	readonly status        : ConventionStatus                 ;
	readonly scope         : string                           ;
	readonly examples?     : readonly string[]                ;
	readonly evidence?     : Readonly<Record<string, number>> ;
	readonly versions      : Readonly<Record<string, number>> ;
	readonly approvedBy    : string                           ;
	readonly date          : string                           ;
}


```

### Current grouping policy example
```ts
export const ROW_KINDS: readonly RowKind[] = [
	{
		name       : "declaration",
		gap        : "blank",
		containers : node => (isSourceFile(node) || isBlock(node)) ? node.statements : undefined,
		detect     : detectDeclaration,
		groupName  : declarationGroupName,
		minRows    : run => run.every(row => row.boundaries.some(boundary => boundary.axis === "equals")) ? 2 : undefined,
		layerCall  : node => kindLayerCall("declaration", node),
	},
	{
		name       : "type-alias",
		gap        : "blank",
		containers : node => (isSourceFile(node) || isBlock(node)) ? node.statements : undefined,
		detect     : detectTypeAlias,
	},
	{
		name       : "type-members",
		gap        : "blank",
		containers : node => isTypeLiteralNode(node) ? node.members : undefined,
		detect     : detectMember,
	},
	{

```
