import      { realpathSync                           } from "node:fs"     ;
import      { Database                               } from "bun:sqlite"  ;
import      { createHash                             } from "node:crypto" ;
import      {
              existsSync                           ,
              lstatSync                            ,
              mkdirSync                            ,
              readFileSync                         ,
              renameSync                           ,
              rmSync                               ,
                                                     } from "node:fs"     ;
import      { dirname, isAbsolute, relative, resolve } from "node:path"   ;

export const FAMILY_IDS = [
	"imports", "declarations", "function-signatures", "calls-and-chains", "branches-and-exits",
	"object-and-type-members", "arrays-and-records", "operators-and-expressions", "structured-documents",
] as const;
export const CASE_KINDS = ["comparable", "different-role", "unsupported", "nested", "separation"] as const ;
const LANGUAGES         = ["typescript", "python", "json", "yaml"]                                         ;

export interface PatternCase {
	readonly verification : "design-only"             ;
	readonly evidence     : readonly string[]         ;
	readonly id           : string                    ;
	readonly kind         : typeof CASE_KINDS[number] ;
	readonly language     : string                    ;
	readonly source       : string                    ;
	readonly expectation  : string                    ;
}

export interface PatternFamily {
	readonly id         : typeof FAMILY_IDS[number] ;
	readonly title      : string                    ;
	readonly languages  : readonly string[]         ;
	readonly row        : string                    ;
	readonly columns    : readonly string[]         ;
	readonly grouping   : string                    ;
	readonly nesting    : string                    ;
	readonly separation : string                    ;
	readonly exclusions : readonly string[]         ;
	readonly evidence   : readonly string[]         ;
	readonly cases      : readonly PatternCase[]    ;
}

export interface PatternCatalog {
	readonly schemaVersion: 1;
	readonly families: readonly PatternFamily[];
}

function object(value: unknown, fields: readonly string[], where: string): Record<string, unknown> {
	if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${where}: object required`);
	const record = value as Record<string, unknown>;
	for (const field of Object.keys(record)) if (!fields.includes(field)) throw new Error(`${where}.${field}: unknown field`);
	for (const field of fields) if (!(field in record)) throw new Error(`${where}.${field}: required`);
	return record;
}

function text(value: unknown, where: string): string {
	if (typeof value !== "string" || value.trim() === "") throw new Error(`${where}: nonempty string required`);
	return value;
}

function strings(value: unknown, where: string): readonly string[] {
	if (!Array.isArray(value) || value.length === 0) throw new Error(`${where}: nonempty array required`);
	const result = value.map((item, index) => text(item, `${where}[${index}]`));
	if (new Set(result).size !== result.length) throw new Error(`${where}: duplicate value`);
	return result;
}

/** Catalog cases are advisory design evidence, never an approval registry. */
export function validatePatternCatalog(value: unknown): PatternCatalog {
	const catalog = object(value, ["schemaVersion", "families"], "catalog");
	if (catalog.schemaVersion !== 1) throw new Error("catalog.schemaVersion: expected 1");
	if (!Array.isArray(catalog.families)) throw new Error("catalog.families: array required");
	const ids = new Set<string>();
	for (const [index, item] of catalog.families.entries()) {
		const where  = `families[${index}]`                                                                                                                        ;
		const family = object(item, ["id", "title", "languages", "row", "columns", "grouping", "nesting", "separation", "exclusions", "evidence", "cases"], where) ;
		const id     = text(family.id, `${where}.id`)                                                                                                              ;
		if (!(FAMILY_IDS as readonly string[]).includes(id) || ids.has(id)) throw new Error(`${where}.id: unknown or duplicate family`);
		ids.add(id);
		for (const field of ["title", "row", "grouping", "nesting", "separation"]) text(family[field], `${where}.${field}`);
		for (const field of ["columns", "exclusions", "evidence"]) strings(family[field], `${where}.${field}`);
		const languages = strings(family.languages, `${where}.languages`);
		if (languages.some(language => !LANGUAGES.includes(language))) throw new Error(`${where}.languages: unsupported language`);
		if (!Array.isArray(family.cases)) throw new Error(`${where}.cases: array required`);
		const kinds   = new Set<string>() ;
		const caseIds = new Set<string>() ;
		for (const [caseIndex, entry] of family.cases.entries()) {
			const location = `${where}.cases[${caseIndex}]`                                                                           ;
			const example  = object(entry, ["id", "kind", "language", "source", "expectation", "verification", "evidence"], location) ;
			for (const field of ["id", "kind", "language", "source", "expectation"]) text(example[field], `${location}.${field}`);
			if (example.verification !== "design-only") throw new Error(`${location}.verification: expected design-only`);
			strings(example.evidence, `${location}.evidence`);
			if (!(CASE_KINDS as readonly unknown[]).includes(example.kind)) throw new Error(`${location}.kind: unsupported kind`);
			if (!languages.includes(example.language as string)) throw new Error(`${location}.language: absent from family`);
			if (caseIds.has(example.id as string)) throw new Error(`${location}.id: duplicate case`);
			caseIds.add(example.id as string);
			kinds.add(example.kind as string);
		}
		for (const kind of CASE_KINDS) if (!kinds.has(kind)) throw new Error(`${where}.cases: missing ${kind}`);
	}
	if (ids.size !== FAMILY_IDS.length) throw new Error("catalog.families: all nine families required");
	return value as PatternCatalog;
}

export function readPatternCatalog(root: string): PatternCatalog {
	const path         = resolve               (root, "product/rules/patterns/catalog.json") ;
	const catalog      = validatePatternCatalog(JSON.parse(readFileSync(path, "utf8"))     ) ;
	const physicalRoot = realpathSync          (root                                       ) ;
	for (const family of catalog.families) for (const evidence of [...family.evidence, ...family.cases.flatMap(entry => entry.evidence)]) {
		const target  = resolve(root, evidence)                                                              ;
		const local   = relative(root, target)                                                               ;
		const invalid = (): never => { throw new Error(`${family.id}: invalid evidence path ${evidence}`); } ;
		if (isAbsolute(evidence) || local === ".." || local.startsWith("../") || evidence.includes("\\") || !existsSync(target)) invalid();
		let cursor = target;
		while (cursor !== resolve(root)) {
			if (lstatSync(cursor).isSymbolicLink()) invalid();
			cursor = dirname(cursor);
		}
		const physical = relative(physicalRoot, realpathSync(target));
		if (physical === ".." || physical.startsWith("../") || isAbsolute(physical) || !lstatSync(target).isFile()) invalid();
	}
	return catalog;
}

/** Builds only a derived development index; no import path can write canonical rules or approvals. */
export function buildPatternIndex(root: string, output = resolve(root, ".boxbox/cache/patterns.sqlite")) {
	const catalog = readPatternCatalog(root)                          ;
	const source  = JSON.stringify(catalog)                           ;
	const hash    = createHash("sha256").update(source).digest("hex") ;
	mkdirSync(dirname(output), { recursive: true });
	const existing = lstatSync(output, { throwIfNoEntry: false });
	if (existing) {
		if (!existing.isFile() || existing.isSymbolicLink()) throw new Error("index output must be a regular managed file");
		const old = new Database(output, { readonly: true });
		try {
			if ((old.query("SELECT value FROM metadata WHERE key = 'owner'").get() as { value?: string } | null)?.value !== "boxbox-pattern-index") {
				throw new Error("refusing to replace an unmanaged database");
			}
		} finally { old.close(); }
	}
	const temporary = `${output}.${process.pid}.${crypto.randomUUID()}.tmp` ;
	const db        = new Database(temporary, { strict: true })             ;
	try {
		db.exec("PRAGMA foreign_keys = ON");
		if ((db.query("PRAGMA foreign_keys").get() as { foreign_keys: number }).foreign_keys !== 1) throw new Error("foreign-key enforcement unavailable");
		db.exec("CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE families (id TEXT PRIMARY KEY, title TEXT NOT NULL, policy TEXT NOT NULL); CREATE TABLE cases (family_id TEXT NOT NULL REFERENCES families(id), id TEXT NOT NULL, kind TEXT NOT NULL, language TEXT NOT NULL, source TEXT NOT NULL, expectation TEXT NOT NULL, PRIMARY KEY(family_id, id));");
		db.transaction(() => {
			const metadata = db.query("INSERT INTO metadata VALUES (?, ?)");
			for (const [key, value] of [["owner", "boxbox-pattern-index"], ["schemaVersion", "1"], ["catalogHash", hash], ["authority", "advisory-only"]]) metadata.run(key!, value!);
			const familyInsert = db.query("INSERT INTO families VALUES (?, ?, ?)"      ) ;
			const caseInsert   = db.query("INSERT INTO cases VALUES (?, ?, ?, ?, ?, ?)") ;
			for (const family of [...catalog.families].sort((a, b) => a.id.localeCompare(b.id))) {
				familyInsert.run(family.id, family.title, JSON.stringify(family));
				for (const entry of [...family.cases].sort((a, b) => a.id.localeCompare(b.id))) caseInsert.run(family.id, entry.id, entry.kind, entry.language, entry.source, entry.expectation);
			}
		})();
		const integrity = db.query("PRAGMA integrity_check").all();
		if (JSON.stringify(integrity) !== '[{"integrity_check":"ok"}]' || db.query("PRAGMA foreign_key_check").all().length !== 0) throw new Error("derived index integrity check failed");
		db.close();
		renameSync(temporary, output);
		return { output, catalogHash: hash, families: catalog.families.length, cases: catalog.families.reduce((sum, family) => sum + family.cases.length, 0), authority: "advisory-only" };
	} finally {
		db.close();
		rmSync(temporary, { force: true });
	}
}

if (import.meta.main) {
	const root = resolve           (import.meta.dir, "../..") ;
	const args = process.argv.slice(2                       ) ;
	if (args.length !== 1 || !["check", "index"].includes(args[0]!)) throw new Error("usage: bun development/tools/pattern-catalog.ts check|index");
	console.log(JSON.stringify(args[0] === "index" ? buildPatternIndex(root) : { families: readPatternCatalog(root).families.length, authority: "advisory-only" }));
}
