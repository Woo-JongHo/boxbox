import      { symlinkSync              } from "node:fs"                                 ;
import      { afterEach, expect, test  } from "bun:test"                                ;
import      { Database                 } from "bun:sqlite"                              ;
import      {
              copyFileSync           ,
              mkdirSync              ,
              mkdtempSync            ,
              readFileSync           ,
              readdirSync            ,
              rmSync                 ,
              writeFileSync          ,
                                       } from "node:fs"                                 ;
import      { tmpdir                   } from "node:os"                                 ;
import      { dirname, join, resolve   } from "node:path"                               ;
import      {
              buildPatternIndex      ,
              CASE_KINDS             ,
              FAMILY_IDS             ,
              readPatternCatalog     ,
              validatePatternCatalog ,
                                       } from "../development/tools/pattern-catalog.ts" ;

const repository          = resolve(import.meta.dir, "..") ;
const temporary: string[] = []                             ;

afterEach(() => {
	for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function workspace() {
	const root = mkdtempSync(join(tmpdir(), "boxbox-pattern-catalog-"));
	temporary.push(root);
	const catalog = readPatternCatalog(repository                                 ) ;
	const path    = join              (root, "product/rules/patterns/catalog.json") ;
	mkdirSync(dirname(path), { recursive: true });
	copyFileSync(join(repository, "product/rules/patterns/catalog.json"), path);
	for (const family of catalog.families) for (const evidence of [...family.evidence, ...family.cases.flatMap(entry => entry.evidence)]) {
		const target = join(root, evidence);
		mkdirSync(dirname(target), { recursive: true });
		writeFileSync(target, "fixture evidence\n");
	}
	return { root, path, catalog };
}

test("all nine families expose comparable, different-role, unsupported, nested and separation cases", () => {
	const catalog = readPatternCatalog(repository);
	expect(catalog.families.map(family => family.id).sort()).toEqual([...FAMILY_IDS].sort());
	for (const family of catalog.families) {
		expect(new Set(family.cases.map(entry => entry.kind))).toEqual(new Set(CASE_KINDS));
		expect(family.evidence.length).toBeGreaterThan(0);
	}
});

test("catalog rejects malformed records, missing coverage and accidental approval fields", () => {
	const catalog = readPatternCatalog(repository);
	for (const value of [null, [], { ...catalog, schemaVersion: 2 }, { ...catalog, approved: true }]) expect(() => validatePatternCatalog(value)).toThrow();
	const invalid = structuredClone(catalog) as any;
	invalid.families[0].cases = invalid.families[0].cases.filter((entry: any) => entry.kind !== "unsupported");
	expect(() => validatePatternCatalog(invalid)).toThrow("missing unsupported");
	const duplicate = structuredClone(catalog) as any;
	duplicate.families[1].id = duplicate.families[0].id;
	expect(() => validatePatternCatalog(duplicate)).toThrow("duplicate family");
	const wrongLanguage = structuredClone(catalog) as any;
	wrongLanguage.families[0].cases[0].language = "unimplemented-language";
	expect(() => validatePatternCatalog(wrongLanguage)).toThrow("absent from family");
});

test("SQLite supports cross-family case queries and deterministic rebuild without altering source authority", () => {
	const { root, path, catalog } = workspace();
	const before = readFileSync(path)                             ;
	const first  = buildPatternIndex(root)                        ;
	const bytes  = readFileSync(first.output)                     ;
	const db     = new Database(first.output, { readonly: true }) ;
	try {
		const cases = db.query("SELECT family_id, id, source FROM cases WHERE kind = ? ORDER BY family_id, id").all("unsupported");
		expect(cases                                                               ).toHaveLength(9                                                                                ) ;
		expect(db.query("SELECT COUNT(*) AS count FROM cases").get()               ).toEqual     ({ count: catalog.families.reduce((sum, family) => sum + family.cases.length, 0) }) ;
		expect(db.query("SELECT value FROM metadata WHERE key = 'authority'").get()).toEqual     ({ value: "advisory-only" }                                                       ) ;
		expect(db.query("PRAGMA foreign_key_check").all()                          ).toEqual     ([]                                                                               ) ;
	} finally { db.close(); }
	const second = buildPatternIndex(root);
	expect(second.catalogHash                ).toBe   (first.catalogHash  ) ;
	expect(readFileSync(second.output)       ).toEqual(bytes              ) ;
	expect(readFileSync(path)                ).toEqual(before             ) ;
	expect(readdirSync(dirname(first.output))).toEqual(["patterns.sqlite"]) ;
});

test("invalid source cannot replace a valid index and unmanaged databases are preserved", () => {
	const { root, path, catalog } = workspace();
	const built  = buildPatternIndex(root        ) ;
	const before = readFileSync     (built.output) ;
	writeFileSync(path, JSON.stringify({ ...catalog, families: [] }));
	expect(() => buildPatternIndex(root)).toThrow("all nine families");
	expect(readFileSync(built.output)).toEqual(before);
	writeFileSync(path, JSON.stringify(catalog));
	const unmanaged = join(root, "unmanaged.sqlite") ;
	const db        = new Database(unmanaged)        ;
	db.exec("CREATE TABLE private_data (value TEXT)");
	db.close();
	const unmanagedBefore = readFileSync(unmanaged);
	expect(() => buildPatternIndex(root, unmanaged)).toThrow();
	expect(readFileSync(unmanaged)).toEqual(unmanagedBefore);
});

test("evidence references must exist inside the repository", () => {
	const { root, path, catalog } = workspace();
	const invalid = structuredClone(catalog) as any;
	invalid.families[0].evidence = ["../external-private.ts"];
	writeFileSync(path, JSON.stringify(invalid));
	expect(() => readPatternCatalog(root)).toThrow("invalid evidence path");
});


test("catalog rejects hidden authority, duplicate dimensions and missing case fields", () => {
	const mutations: ((value: any) => void)[] = [
		value => { value.families[0].approved = true; },
		value => { value.families[0].cases[0].authority = "approved"; },
		value => { value.families[0].cases[0].verification = "tested"; },
		value => { value.families[0].cases[1].id = value.families[0].cases[0].id; },
		value => { value.families[0].languages.push(value.families[0].languages[0]); },
		value => { value.families[0].columns.push(value.families[0].columns[0]); },
		value => { value.families[0].cases[0].kind = "unregistered"; },
		value => { delete value.families[0].cases[0].expectation; },
	];
	for (const mutate of mutations) {
		const value = structuredClone(readPatternCatalog(repository));
		mutate(value);
		expect(() => validatePatternCatalog(value)).toThrow();
	}
});

test("wrong owners, non-databases and output symlinks survive index rebuild attempts", () => {
	const { root } = workspace();
	const path = join(root, "wrong-owner.sqlite") ;
	const db   = new Database(path)               ;
	db.exec("CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT); INSERT INTO metadata VALUES ('owner', 'another-application')");
	db.close();
	const original = readFileSync(path);
	expect(() => buildPatternIndex(root, path)).toThrow("unmanaged database");
	expect(readFileSync(path)).toEqual(original);
	for (const content of ["unrelated text", ""]) {
		const target = join(root, "not-an-index");
		writeFileSync(target, content);
		expect(() => buildPatternIndex(root, target)).toThrow();
		expect(readFileSync(target, "utf8")).toBe(content);
	}
	const link = join(root, "index-link");
	symlinkSync(path, link);
	expect(() => buildPatternIndex(root, link)).toThrow("regular managed file");
	expect(readFileSync(path)).toEqual(original);
	const dangling = join(root, "dangling-index-link");
	symlinkSync(join(root, "missing-index"), dangling);
	expect(() => buildPatternIndex(root, dangling)).toThrow("regular managed file");
});

test("absolute, missing, backslash and symbolic evidence paths are rejected", () => {
	const { root, path, catalog } = workspace();
	const external = join(tmpdir(), "boxbox-never-read-evidence") ;
	const link     = join(root    , "linked-evidence"           ) ;
	symlinkSync(path, link);
	for (const evidence of [external, "missing.ts", "test\\outside.ts", "linked-evidence"]) {
		const value = structuredClone(catalog) as any;
		value.families[0].cases[0].evidence = [evidence];
		writeFileSync(path, JSON.stringify(value));
		expect(() => readPatternCatalog(root)).toThrow("invalid evidence path");
	}
});
