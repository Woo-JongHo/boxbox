import      { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs"          ;
import      { isAbsolute, relative, resolve                     } from "node:path"        ;

import      {
              CONVENTION_SCHEMA_VERSION                       ,
              globToRegExp                                    ,
              parseConventions                                ,
              type ConventionLayer                            ,
              type LoadedConvention                           ,
                                                                } from "./conventions.ts" ;
import      {
              DECISION_SCHEMA_VERSION                         ,
              EXAMPLE_SCHEMA_VERSION                          ,
              contentHashOf                                   ,
              parseRecords                                    ,
              sectionHash                                     ,
              validateDecision                                ,
              validateExample                                 ,
              type Decision                                   ,
              type Example                                    ,
                                                                } from "./examples.ts"    ;
import      { LOOKUP_KEY_VERSION, lookupKeyOf                   } from "./signature.ts"   ;

export const APPROVAL_VERSIONS = {
	lookupKey        : LOOKUP_KEY_VERSION         ,
	conventionSchema : CONVENTION_SCHEMA_VERSION ,
	exampleSchema    : EXAMPLE_SCHEMA_VERSION     ,
	decisionSchema   : DECISION_SCHEMA_VERSION    ,
} as const;

export interface RegistrySource {
	readonly root         : string          ;
	readonly layer        : ConventionLayer ;
	readonly conventions? : string          ;
	readonly examples?    : string          ;
	readonly decisions?   : string          ;
}

export interface ApprovalRegistry {
	readonly conventions : readonly LoadedConvention[]   ;
	readonly examples    : ReadonlyMap<string, Example>  ;
	readonly decisions   : ReadonlyMap<string, Decision> ;
}

export interface ApprovalQuery {
	readonly key  : string ;
	readonly file : string ;
}

export interface DetectedApproval {
	readonly language : string            ;
	readonly context? : string            ;
	readonly kind     : string            ;
	readonly axes     : readonly string[] ;
	readonly file     : string            ;
}

export interface EvaluatedApproval {
	readonly query  : ApprovalQuery  ;
	readonly result : ApprovalResult ;
}

export interface GuideExample {
	readonly id     : string ;
	readonly before : string ;
	readonly after  : string ;
}

export interface ApprovalResult {
	readonly status        : "approved" | "rejected" | "unknown" | "conflict" ;
	readonly writable      : boolean                                          ;
	readonly conventionId? : string                                           ;
	readonly layer?        : ConventionLayer                                  ;
	readonly reasons       : readonly string[]                                ;
	readonly guide         : readonly GuideExample[]                          ;
	readonly text          : string                                           ;
}

export type DocumentResolver = (ref: string, layer?: ConventionLayer) => { readonly document: string; readonly heading: string };
export type DocumentRoots = string | Readonly<Partial<Record<ConventionLayer, string>>>;

const LAYER_ORDER: readonly ConventionLayer[] = ["project", "user", "preset"];

const specificity = (scope: string): number => scope.replace(/[*?]/gu, "").length;

function readOptional(root: string, name: string | undefined, fallback: string): { readonly text: string; readonly where: string } {
	const physicalRoot = realpathSync(root)                      ;
	const where        = resolve(physicalRoot, name ?? fallback) ;
	const lexical      = relative(physicalRoot, where)           ;
	if (lexical === ".." || lexical.startsWith("../") || lexical.startsWith("..\\") || isAbsolute(lexical)) throw new Error(`registry file escapes root: ${where}`);
	if (!existsSync(where)) return { text: "", where };
	const metadata = lstatSync(where);
	if (metadata.isSymbolicLink() || !metadata.isFile()) throw new Error(`registry file must be a regular non-symbolic file: ${where}`);
	const physical = realpathSync(where)              ;
	const inside   = relative(physicalRoot, physical) ;
	if (inside === ".." || inside.startsWith("../") || inside.startsWith("..\\") || isAbsolute(inside)) throw new Error(`registry file escapes root: ${where}`);
	return { text: readFileSync(physical, "utf8"), where: physical };
}

/** 명시한 registry root만 읽는다. package URL이나 암묵적 preset 위치를 사용하지 않는다. */
export function loadApprovalRegistry(sources: readonly RegistrySource[]): ApprovalRegistry {
	const conventions: LoadedConvention[] = []                          ;
	const examples                        = new Map<string, Example>()  ;
	const decisions                       = new Map<string, Decision>() ;

	for (const source of sources) {
		const conventionFile = readOptional(source.root, source.conventions, "conventions.jsonl") ;
		const exampleFile    = readOptional(source.root, source.examples   , "examples.jsonl"   ) ;
		const decisionFile   = readOptional(source.root, source.decisions  , "decisions.jsonl"  ) ;
		conventions.push(...parseConventions(conventionFile.text, source.layer, conventionFile.where));
		for (const example of parseRecords(exampleFile.text, exampleFile.where, validateExample)) {
			if (examples.has(example.id)) throw new Error(`${exampleFile.where}: duplicate proof example ${example.id}`);
			examples.set(example.id, example);
		}
		for (const decision of parseRecords(decisionFile.text, decisionFile.where, validateDecision)) {
			if (decisions.has(decision.id)) throw new Error(`${decisionFile.where}: duplicate proof decision ${decision.id}`);
			decisions.set(decision.id, decision);
		}
	}
	return { conventions, examples, decisions };
}

/** ref의 실제 문서가 해당 convention 층의 허용 root 안에 있을 때만 절 본문을 돌려준다. */
export function documentResolver(roots: DocumentRoots): DocumentResolver {
	return (ref, layer) => {
		const root = typeof roots === "string" ? roots : layer ? roots[layer] : undefined;
		if (!root) throw new Error(`document root is missing for layer: ${layer ?? "unspecified"}`);
		const physicalRoot = realpathSync(root) ;
		const marker       = ref.indexOf("#")   ;
		if (marker <= 0 || marker === ref.length - 1) throw new Error(`invalid document ref: ${ref}`);
		const path    = ref.slice(0, marker)  ;
		const heading = ref.slice(marker + 1) ;
		if (isAbsolute(path)) throw new Error(`document ref escapes root: ${ref}`);

		const physical = realpathSync(resolve(physicalRoot, path)) ;
		const inside   = relative(physicalRoot, physical)          ;
		if (inside === ".." || inside.startsWith("../") || inside.startsWith("..\\") || isAbsolute(inside)) throw new Error(`document ref escapes root: ${ref}`);
		return { document: readFileSync(physical, "utf8"), heading };
	};
}

function resolveConvention(registry: ApprovalRegistry, query: ApprovalQuery): { readonly status: ApprovalResult["status"]; readonly convention?: LoadedConvention; readonly reasons: readonly string[] } {
	if (!query.key.startsWith(`v${LOOKUP_KEY_VERSION}|`)) return { status: "unknown", reasons: ["stale lookup key"] };
	const path       = query.file.replaceAll("\\", "/").replace(/^\.\//u, "")                                                   ;
	const candidates = registry.conventions.filter(record => record.key === query.key && globToRegExp(record.scope).test(path)) ;
	for (const layer of LAYER_ORDER) {
		const inLayer = candidates.filter(record => record.layer === layer);
		if (inLayer.length === 0) continue;
		const top     = Math.max(...inLayer.map(record => specificity(record.scope))) ;
		const winners = inLayer.filter(record => specificity(record.scope) === top)   ;
		if (winners.length !== 1) return { status: "conflict", reasons: [`ambiguous conventions: ${winners.map(record => record.id).sort().join(",")}`] };
		const convention = winners[0]!;
		if (convention.status === "candidate") return { status: "unknown", convention, reasons: ["convention is candidate"] };
		if (convention.status === "rejected") return { status: "rejected", convention, reasons: ["convention is rejected"] };
		return { status: "approved", convention, reasons: [] };
	}
	return { status: "unknown", reasons: ["no matching convention"] };
}

function versionsMatch(versions: Readonly<Record<string, number>>): boolean {
	return Object.entries(APPROVAL_VERSIONS).every(([name, version]) => versions[name] === version);
}

function verifyProof(registry: ApprovalRegistry, convention: LoadedConvention, resolveDocument: DocumentResolver): { readonly reasons: readonly string[]; readonly guide: readonly GuideExample[] } {
	const reasons: string[] = []                                    ;
	const decision          = registry.decisions.get(convention.id) ;
	if (!decision) return { reasons: ["matching decision is missing"], guide: [] };
	if (decision.id !== convention.id) reasons.push("decision id does not match convention id");
	if (!((decision.kind === "rule" || decision.kind === "exception") && decision.layer === "convention")) reasons.push("decision kind/layer is not an approved convention rule");
	if (convention.approvedBy.trim() === "" || convention.date.trim() === "" || decision.approvedBy.trim() === "" || decision.date.trim() === "") reasons.push("human approval receipt is missing");
	if (!versionsMatch(convention.versions)) reasons.push("convention versions are unsupported");

	try {
		const resolved = resolveDocument(decision.ref, convention.layer);
		if (sectionHash(resolved.document, resolved.heading) !== decision.docHash) reasons.push("decision document hash is stale");
	} catch (error) {
		reasons.push(`decision document is invalid: ${error instanceof Error ? error.message : String(error)}`);
	}

	const conventionLinks = new Set(convention.examples ?? [])                          ;
	const decisionLinks   = new Set(decision.examples ?? [])                            ;
	const linkedIds       = [...new Set([...conventionLinks, ...decisionLinks])].sort() ;
	if (linkedIds.length === 0) reasons.push("proof examples are missing");
	for (const id of linkedIds) if (!conventionLinks.has(id) || !decisionLinks.has(id)) reasons.push(`example link differs between convention and decision: ${id}`);

	const keyLanguage       = convention.key.split("|")[1] ;
	const linked: Example[] = []                           ;
	for (const id of linkedIds) {
		const example = registry.examples.get(id);
		if (!example) { reasons.push(`linked example is missing: ${id}`); continue; }
		linked.push(example);
		if (example.status !== "approved") reasons.push(`example is not approved: ${id}`);
		if (example.approvedBy.trim() === "" || example.date.trim() === "") reasons.push(`example human approval receipt is missing: ${id}`);
		if (!versionsMatch(example.versions)) reasons.push(`example versions are unsupported: ${id}`);
		if (example.contentHash !== contentHashOf(example.before, example.after)) reasons.push(`example content hash is stale: ${id}`);
		if (example.language !== keyLanguage || !example.patterns.includes(convention.pattern) || !example.rules.includes(convention.id)) reasons.push(`example is not relevant to convention: ${id}`);
	}

	const positives = linked.filter(example => example.status === "approved" && example.verdict === "after-better" && example.rules.includes(convention.id))                                 ;
	const counters  = linked.filter(example => example.status === "approved" && (example.verdict === "bad" || example.verdict === "before-better") && example.rules.includes(convention.id)) ;
	if (positives.length === 0) reasons.push("approved after-better example is missing");
	if (counters.length === 0) reasons.push("relevant counterexample is missing");

	const guide = reasons.length === 0
		? positives.sort((left, right) => left.id.localeCompare(right.id)).map(example => ({ id: example.id, before: example.before, after: example.after }))
		: [];
	return { reasons, guide };
}

/** exact key 조회와 승인 증명을 함께 검사한다. writable은 모든 증명이 검증된 approved에서만 true다. */
export function evaluateApproval(registry: ApprovalRegistry, query: ApprovalQuery, resolveDocument: DocumentResolver): ApprovalResult {
	const found = resolveConvention(registry, query);
	if (found.status !== "approved" || !found.convention) {
		return { status: found.status, writable: false, conventionId: found.convention?.id, layer: found.convention?.layer, reasons: found.reasons, guide: [], text: `승인 거부: ${found.reasons.join("; ")}` };
	}

	const proof = verifyProof(registry, found.convention, resolveDocument);
	if (proof.reasons.length > 0) return { status: "unknown", writable: false, conventionId: found.convention.id, layer: found.convention.layer, reasons: proof.reasons, guide: [], text: `승인 거부: ${proof.reasons.join("; ")}` };
	return { status: "approved", writable: true, conventionId: found.convention.id, layer: found.convention.layer, reasons: [], guide: proof.guide, text: `승인됨: ${found.convention.id}\n${proof.guide.map(example => `[${example.id}]\n${example.after}`).join("\n")}` };
}

/** 엔진이 검출한 표 설명을 현재 exact lookup key로 바꿔 입력 순서대로 평가한다. */
export function evaluateDetected(registry: ApprovalRegistry, detected: readonly DetectedApproval[], resolveDocument: DocumentResolver): readonly EvaluatedApproval[] {
	return detected.map(group => {
		const query = { key: lookupKeyOf(group.language, group.context, group.kind, group.axes), file: group.file };
		return { query, result: evaluateApproval(registry, query, resolveDocument) };
	});
}
