import      { lstatSync, readFileSync, realpathSync } from "node:fs"                   ;
import      { isAbsolute, relative, resolve         } from "node:path"                 ;

import      { parseConventions                      } from "@/common/conventions.ts"   ;
import      { APPROVAL_VERSIONS                     } from "@/common/approval-gate.ts" ;
import      {
              parseRecords                        ,
              sectionHash                         ,
              validateDecision                    ,
              validateExample                     ,
                                                    } from "@/common/examples.ts"      ;
import type { Decision, Example                     } from "@/common/examples.ts"      ;

export interface PublicPresetFile {
	readonly path : string ;
	readonly text : string ;
}

const JSONL_NAMES   = ["conventions.jsonl", "examples.jsonl", "decisions.jsonl"] as const                    ;
const SAFE_SCOPES   = new Set(["**", "**/*.ts", "**/*.py", "*.ts", "*.py"])                                  ;
const SAFE_LICENSES = new Set(["Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "CC0-1.0", "MIT", "Unlicense"]) ;
const MAINTAINER    = "maintainer"                                                                           ;

function fail(where: string, reason: string): never {
	throw new Error(`public preset rejected at ${where}: ${reason}`);
}

function objectKeys(value: unknown, allowed: readonly string[], where: string): void {
	if (typeof value !== "object" || value === null || Array.isArray(value)) fail(where, "must be a JSON object");
	const unexpected = Object.keys(value).filter(key => !allowed.includes(key));
	if (unexpected.length > 0) fail(where, `unexpected fields: ${unexpected.join(", ")}`);
}

function safeId(value: string, where: string): void {
	if (!/^[a-z0-9][a-z0-9._-]{0,63}$/u.test(value)) fail(where, "id must be a short generic identifier");
}

function safeLookupKey(value: string, where: string): void {
	const [version, language, context, kind, axes, extra] = value.split("|");
	if (extra !== undefined || version !== `v${APPROVAL_VERSIONS.lookupKey}` || !["typescript", "python"].includes(language ?? "")) fail(where, "key must use the current TypeScript or Python lookup format");
	if (!/^(?:-|[A-Za-z][A-Za-z0-9]*)$/u.test(context ?? "") || !/^[a-z][a-z0-9-]{0,63}$/u.test(kind ?? "")) fail(where, "key context and kind must be generic identifiers");
	if (!/^[a-z0-9][a-z0-9._:*?{}-]*(?:>[a-z0-9][a-z0-9._:*?{}-]*)*$/u.test(axes ?? "")) fail(where, "key axes must be generic axis identifiers");
}

function approvedBy(value: string, where: string): void {
	if (value !== MAINTAINER) fail(where, `approvedBy must use the anonymous role ${MAINTAINER}`);
}

function isoDate(value: string, where: string): void {
	if (!/^\d{4}-\d{2}-\d{2}$/u.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) fail(where, "date must be YYYY-MM-DD");
}

function inside(root: string, path: string, where: string): string {
	if (isAbsolute(path)) fail(where, "absolute paths are not allowed");
	const absolute = resolve(root, path)      ;
	const lexical  = relative(root, absolute) ;
	if (lexical === ".." || lexical.startsWith("../") || lexical.startsWith("..\\") || isAbsolute(lexical)) fail(where, "path escapes preset root");
	return absolute;
}

function readRegularFile(root: string, path: string, where: string): string {
	const absolute = inside(root, path, where) ;
	const status   = lstatSync(absolute)       ;
	if (!status.isFile() || status.isSymbolicLink()) fail(where, "must reference a regular file, not a symlink");
	const physical   = realpathSync(absolute)                 ;
	const realInside = relative(realpathSync(root), physical) ;
	if (realInside === ".." || realInside.startsWith("../") || realInside.startsWith("..\\") || isAbsolute(realInside)) fail(where, "physical path escapes preset root");
	return readFileSync(physical, "utf8");
}

function readPublicDocument(root: string, path: string, where: string): string {
	const segments = path.split("/");
	if (path.includes("\\") || segments.length < 3 || segments[0] !== "docs" || segments[1] !== "public" || segments.some(segment => segment === "" || segment === "." || segment === "..")) {
		fail(where, "document ref must be a normalized path below docs/public");
	}
	let current = root;
	for (const [index, segment] of segments.entries()) {
		current = resolve(current, segment);
		const status = lstatSync(current);
		if (status.isSymbolicLink()) fail(where, "public document path components may not be symlinks");
		if (index < segments.length - 1 && !status.isDirectory()) fail(where, "public document parent must be a directory");
		if (index === segments.length - 1 && !status.isFile()) fail(where, "public document must be a regular file");
	}
	const publicRoot = realpathSync(resolve(root, "docs/public")) ;
	const physical   = realpathSync(current)                      ;
	const within     = relative(publicRoot, physical)             ;
	if (within === ".." || within.startsWith("../") || within.startsWith("..\\") || isAbsolute(within)) fail(where, "public document resolves outside docs/public");
	return readFileSync(physical, "utf8");
}

function validateVersions(value: Readonly<Record<string, number>>, where: string): void {
	const expected = Object.keys(APPROVAL_VERSIONS);
	objectKeys(value, expected, where);
	if (expected.some(name => value[name] !== APPROVAL_VERSIONS[name as keyof typeof APPROVAL_VERSIONS])) fail(where, "versions must exactly match the shipped approval schema");
}

function validateAsserts(value: Example["asserts"], where: string): void {
	objectKeys(value, ["before", "after"], where);
	for (const side of ["before", "after"] as const) {
		const assertion = value[side];
		if (!assertion) continue;
		objectKeys(assertion, ["has", "lacks", "fixedPoint"], `${where}.${side}`);
		for (const key of ["has", "lacks"] as const) {
			const ids = assertion[key];
			if (ids !== undefined && (!Array.isArray(ids) || ids.length > 32 || !ids.every(id => typeof id === "string" && /^(?:A|S)\d{1,2}$/u.test(id)))) {
				fail(`${where}.${side}.${key}`, "must contain only short alarm IDs");
			}
		}
		if (assertion.fixedPoint !== undefined && typeof assertion.fixedPoint !== "boolean") fail(`${where}.${side}.fixedPoint`, "must be a boolean");
	}
}

function sourceRecords(text: string, where: string): readonly unknown[] {
	return text.split("\n").flatMap((line, index) => {
		if (line.trim() === "") return [];
		try { return [JSON.parse(line) as unknown]; }
		catch (error) { fail(`${where}:${index + 1}`, `invalid JSON: ${error instanceof Error ? error.message : String(error)}`); }
	});
}

function normalizedJsonl(records: readonly unknown[]): string {
	return records.length === 0 ? "" : `${records.map(record => JSON.stringify(record)).join("\n")}\n`;
}

interface PreparedDecision {
	readonly record : Decision          ;
	readonly file   : PublicPresetFile ;
}

function publicDecisionDocument(root: string, decision: Decision): PreparedDecision {
	const marker  = decision.ref.indexOf("#")      ;
	const path    = decision.ref.slice(0, marker)  ;
	const heading = decision.ref.slice(marker + 1) ;
	if (!path.startsWith("docs/public/") || !heading) fail(decision.id, "decision ref must point to docs/public/<file>#<heading>");
	const text = readPublicDocument(root, path, decision.id);
	if (sectionHash(text, heading) !== decision.docHash) fail(decision.id, "decision document section hash is stale");
	const lines = text.split("\n")                                                                                   ;
	const start = lines.findIndex(line => /^#+ /u.test(line) && line.replace(/^#+ /u, "").trim() === heading.trim()) ;
	if (start < 0) fail(decision.id, "decision heading was not found");
	const level   = /^#+/u.exec(lines[start]!)![0].length                                                                          ;
	const end     = lines.findIndex((line, index) => index > start && /^#+ /u.test(line) && /^#+/u.exec(line)![0].length <= level) ;
	const section = lines.slice(start, end < 0 ? undefined : end).join("\n")                                                       ;
	if (/```/u.test(section)) fail(decision.id, "public decision sections must not embed source-code blocks; put short synthetic examples in examples.jsonl");
	if (/(?:\/Users\/|\/home\/|[A-Z]:\\Users\\|github\.com\/[^\s/]+\/[^\s/]+\/commit\/)/iu.test(section)) fail(decision.id, "public decision section contains a local path or source-repository permalink");
	const publicPath = `docs/public/decisions/${decision.id}.md`;
	return {
		record : { ...decision, ref: `${publicPath}#${heading}` },
		file   : { path: publicPath, text: section },
	};
}

/** 배포 preset은 승인된 범용 규칙과 새로 작성한 synthetic 예문만 통과시킨다. */
export function preparePublicPreset(presetRoot: string): readonly PublicPresetFile[] {
	const rootStatus  = lstatSync(presetRoot)                                                                                                                ;
	if (!rootStatus.isDirectory() || rootStatus.isSymbolicLink()) fail("preset root", "must be a real directory, not a symlink");
	const root        = realpathSync(presetRoot)                                                                                                             ;
	const text        = Object.fromEntries(JSONL_NAMES.map(name => [name, readRegularFile(root, name, name)])) as Record<typeof JSONL_NAMES[number], string> ;
	const conventions = parseConventions(text["conventions.jsonl"], "preset", "conventions.jsonl")                                                           ;
	const examples    = parseRecords(text["examples.jsonl"], "examples.jsonl", validateExample)                                                              ;
	const decisions   = parseRecords(text["decisions.jsonl"], "decisions.jsonl", validateDecision)                                                           ;
	for (const [index, record] of sourceRecords(text["conventions.jsonl"], "conventions.jsonl").entries()) {
		if (typeof record !== "object" || record === null || Array.isArray(record)) fail(`conventions.jsonl:${index + 1}`, "record must be an object");
		objectKeys(record, ["schemaVersion", "id", "key", "pattern", "status", "scope", "examples", "versions", "approvedBy", "date"], `conventions.jsonl:${index + 1}`);
	}
	const exampleById                          = new Map(examples.map(example => [example.id, example]))             ;
	const decisionById                         = new Map(decisions.map(decision => [decision.id, decision]))         ;
	const conventionById                       = new Map(conventions.map(convention => [convention.id, convention])) ;
	const referencedExamples                   = new Set<string>()                                                   ;
	const publicDecisions : Decision[]         = []                                                                  ;
	const publicDocuments : PublicPresetFile[] = []                                                                  ;

	for (const convention of conventions) {
		const where = `conventions.jsonl:${convention.id}`;
		safeId(convention.id, where);
		if (convention.status !== "approved") fail(where, "only human-approved conventions may ship");
		if (!SAFE_SCOPES.has(convention.scope)) fail(where, "scope must be generic and must not identify a repository path");
		approvedBy(convention.approvedBy, where);
		isoDate(convention.date, where);
		validateVersions(convention.versions, `${where}.versions`);
		if (convention.examples !== undefined && (!Array.isArray(convention.examples) || !convention.examples.every(id => typeof id === "string"))) fail(where, "examples must be an array of ids");
		if (!decisionById.has(convention.id)) fail(where, "matching decision record is missing");
		safeLookupKey(convention.key, `${where}.key`);
		const keyLanguage    = convention.key.split("|")[1]                                                                                              ;
		const linkedExamples = (convention.examples ?? []).map(id => exampleById.get(id)).filter((example): example is Example => example !== undefined) ;
		if (linkedExamples.filter(example => example.verdict === "after-better").length === 0) fail(where, "approved positive example is required");
		if (linkedExamples.filter(example => example.verdict === "bad" || example.verdict === "before-better").length === 0) fail(where, "approved counterexample is required");
		for (const id of convention.examples ?? []) {
			const example = exampleById.get(id);
			if (!example) fail(where, `referenced example ${id} is missing`);
			referencedExamples.add(id);
			if (!example.rules.includes(convention.id)) fail(where, `example ${id} does not link back to this convention`);
			if (example.language !== keyLanguage || !example.patterns.includes(convention.pattern)) fail(where, `example ${id} does not match the convention language and pattern`);
		}
	}

	for (const example of examples) {
		const where = `examples.jsonl:${example.id}`;
		objectKeys(example, ["schemaVersion", "id", "status", "versions", "language", "regime", "patterns", "rules", "before", "after", "contentHash", "verdict", "asserts", "source", "approvedBy", "date"], where);
		safeId(example.id, where);
		if (example.status !== "approved") fail(where, "only approved examples may ship");
		if (example.source.kind !== "synthetic") fail(where, "only newly authored synthetic examples may ship");
		objectKeys(example.source, ["kind", "license"], where);
		if (!SAFE_LICENSES.has(example.source.license)) fail(where, "source.license must be an approved SPDX identifier");
		if (example.language !== "typescript" && example.language !== "python") fail(where, "language must be TypeScript or Python");
		if (example.before.length > 1_600 || example.after.length > 1_600) fail(where, "synthetic example exceeds the 1,600-character public limit");
		approvedBy(example.approvedBy, where);
		isoDate(example.date, where);
		validateVersions(example.versions, `${where}.versions`);
		validateAsserts(example.asserts, `${where}.asserts`);
		if (typeof example.before !== "string" || typeof example.after !== "string") fail(where, "before and after must be strings");
		if (!Array.isArray(example.rules) || example.rules.length > 32 || !example.rules.every(id => typeof id === "string")) fail(where, "rules must be an array of short rule ids");
		for (const id of example.rules) safeId(id, `${where}.rules`);
		for (const id of example.rules) {
			const convention = conventionById.get(id);
			if (!convention || !(convention.examples ?? []).includes(example.id)) fail(where, `rule ${id} does not link back to this example`);
		}
		if (!referencedExamples.has(example.id)) fail(where, "unreferenced examples may not ship");
	}

	for (const decision of decisions) {
		const where = `decisions.jsonl:${decision.id}`;
		objectKeys(decision, ["schemaVersion", "id", "kind", "layer", "ref", "docHash", "examples", "approvedBy", "date"], where);
		safeId(decision.id, where);
		if (decision.kind !== "rule" && decision.kind !== "exception") fail(where, "only rule and exception decisions may ship");
		if (decision.layer !== "convention") fail(where, "only convention-layer decisions may ship");
		approvedBy(decision.approvedBy, where);
		isoDate(decision.date, where);
		if (!Array.isArray(decision.examples) || !decision.examples.every(id => typeof id === "string")) fail(where, "examples must be an array of ids");
		const convention = conventions.find(record => record.id === decision.id);
		if (!convention) fail(where, "matching approved convention is missing");
		if ([...(convention.examples ?? [])].sort().join("\n") !== [...decision.examples].sort().join("\n")) fail(where, "decision examples do not match the convention");
		const prepared = publicDecisionDocument(root, decision);
		publicDecisions.push(prepared.record);
		publicDocuments.push(prepared.file);
	}

	return [
		{ path: "conventions.jsonl", text: normalizedJsonl(sourceRecords(text["conventions.jsonl"], "conventions.jsonl")) },
		{ path: "examples.jsonl", text: normalizedJsonl(examples) },
		{ path: "decisions.jsonl", text: normalizedJsonl(publicDecisions) },
		...publicDocuments,
	];
}
