import      { afterEach, describe, expect, test   } from "bun:test"                          ;
import      {
              existsSync                        ,
              mkdirSync                         ,
              readFileSync                      ,
              realpathSync                      ,
              rmSync                            ,
              symlinkSync                       ,
              writeFileSync                     ,
                                                  } from "node:fs"                           ;
import      { dirname, join                       } from "node:path"                         ;
import      { version as typescriptVersion        } from "typescript"                        ;

import      { observeShapes, SHAPE_PARSER_VERSION } from "@/typescript/09_observe-shapes.ts" ;

const roots: string[] = [];

function fixture(files: Readonly<Record<string, string>>): string {
	const root = `${process.cwd()}/.tmp-shape-${crypto.randomUUID()}`;
	mkdirSync(root);
	writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "esnext" }, include: ["*.ts"] }));
	for (const [name, text] of Object.entries(files)) {
		mkdirSync(dirname(join(root, name)), { recursive: true });
		writeFileSync(join(root, name), text);
	}
	roots.push(root);
	return root;
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("code shape observation", () => {
	test("produces the same JSONL regardless of file order and repeated runs", async () => {
		const root   = fixture({ "a.ts": "function a() { const x = 1; return x; }\n", "b.ts": "function b() { run(); }\n" }) ;
		const first  = await observeShapes({ root, files: ["b.ts", "a.ts"], writeCache: false })                             ;
		const second = await observeShapes({ root, files: ["a.ts", "b.ts"], writeCache: false })                             ;
		expect(first.jsonl).toBe(second.jsonl);
	});

	test("the real parser version and config fingerprint are part of the snapshot invalidation input", async () => {
		const root  = fixture({ "a.ts": "function a() {}\n" })                                                                    ;
		const left  = await observeShapes({ root, files: ["a.ts"], fingerprints: { config: "sha256:left" }, writeCache: false })  ;
		const right = await observeShapes({ root, files: ["a.ts"], fingerprints: { config: "sha256:right" }, writeCache: false }) ;
		expect(SHAPE_PARSER_VERSION           )    .toContain(typescriptVersion) ;
		expect(left.header.fingerprints.config)    .toBe     ("sha256:left"    ) ;
		expect(left.jsonl                     ).not.toBe     (right.jsonl      ) ;
	});

	test("assignment is CHANGE, comparison and control flow are unknown, and debugger is notApplicable", async () => {
		const root   = fixture({ "a.ts": "function sample(x: number) { x = 1; x === 1; if (x) run(); debugger; }\n" }) ;
		const result = await observeShapes({ root, files: ["a.ts"], writeCache: false })                               ;
		expect(result.units[0]!.segments.map(segment => segment.classification)).toEqual(["CHANGE", "unknown", "notApplicable"]);
		expect(result.units[0]!.segments[1]!.count).toBe(2);
	});

	test("missing files and JavaScript files do not stop collecting other files", async () => {
		const root   = fixture({ "a.ts": "function kept() {}\n", "b.js": "function unsupported() {}\n" })      ;
		const result = await observeShapes({ root, files: ["a.ts", "missing.ts", "b.js"], writeCache: false }) ;
		expect(result.header.completion).toMatchObject({ complete: false, requested: 3, succeeded: 1, failed: 2 });
		expect(result.files.map(file => file.status)).toEqual(["ok", "failed", "failed"]);
	});

	test("distinguishes same-named, nested and same-line functions by range and parent", async () => {
		const root   = fixture({ "a.ts": "function same(){ function same(){ return 1; } return 2; } function same(){ return 3; }\n" }) ;
		const result = await observeShapes({ root, files: ["a.ts"], writeCache: false })                                               ;
		expect(result.units                                                       ).toHaveLength(3                  ) ;
		expect(new Set(result.units.map(unit => unit.id)).size                    ).toBe        (3                  ) ;
		expect(result.units[1]!.parentUnitId                                      ).toBe        (result.units[0]!.id) ;
		expect(new Set(result.units.map(unit => `${unit.start}:${unit.end}`)).size).toBe        (3                  ) ;
	});

	test("reports a broken file as partial and keeps the last completed cache", async () => {
		const root     = fixture({ "a.ts": "function ok() { return 1; }\n" }) ;
		const complete = await observeShapes({ root, files: ["a.ts"] })       ;
		const cache    = join(root, ".boxbox/cache/shape.jsonl")              ;
		expect(readFileSync(cache, "utf8")).toBe(complete.jsonl);
		expect(readFileSync(join(root, ".boxbox/cache/.gitignore"), "utf8")).toBe("*\n");
		writeFileSync(join(root, "a.ts"), "function broken( {\n");
		const partial = await observeShapes({ root, files: ["a.ts"] });
		expect(partial.header.completion.complete).toBe(false         ) ;
		expect(partial.files[0]!.status          ).toBe("malformed"   ) ;
		expect(readFileSync(cache, "utf8")       ).toBe(complete.jsonl) ;
	});

	test("keeps only the current and previous completed snapshot and does not rotate for the same run", async () => {
		const root  = fixture({ "a.ts": "function first() {}\n" })   ;
		const first = await observeShapes({ root, files: ["a.ts"] }) ;
		await observeShapes({ root, files: ["a.ts"] });
		expect(existsSync(join(root, ".boxbox/cache/shape.previous.jsonl"))).toBe(false);
		writeFileSync(join(root, "a.ts"), "function second() {}\n");
		await observeShapes({ root, files: ["a.ts"] });
		expect(readFileSync(join(root, ".boxbox/cache/shape.previous.jsonl"), "utf8")).toBe(first.jsonl);
		expect(existsSync(join(root, ".boxbox/cache/shape.lock"))).toBe(false);
	});

	test("arrows and bodiless declarations do not become units and are counted as unsupported", async () => {
		const root   = fixture({ "a.ts": "declare function external(): void;\nconst arrow = () => 1;\nfunction kept() {}\n" }) ;
		const result = await observeShapes({ root, files: ["a.ts"], writeCache: false })                                       ;
		expect(result.units.map(unit => unit.displayName)).toEqual(["kept"]) ;
		expect(result.files[0]!.unsupportedArrows        ).toBe   (1       ) ;
		expect(result.files[0]!.unsupportedNoBody        ).toBe   (1       ) ;
	});

	test("only reads the source and approval DB and refuses paths outside the root and cache symbolic links", async () => {
		const root           = fixture({ "a.ts": "function kept() {}\n", ".boxbox/conventions.jsonl": "convention\n", ".boxbox/examples.jsonl": "example\n", ".boxbox/decisions.jsonl": "decision\n" }) ;
		const sourceBefore   = readFileSync(join(root, "a.ts"), "utf8")                                                                                                                                 ;
		const approvedBefore = ["conventions.jsonl", "examples.jsonl", "decisions.jsonl"].map(name => readFileSync(join(root, ".boxbox", name), "utf8"))                                                ;
		await expect(observeShapes({ root, files: ["../outside.ts"], writeCache: false })).rejects.toThrow("inside the repository");
		symlinkSync(realpathSync(root), join(root, ".boxbox/cache"));
		await expect(observeShapes({ root, files: ["a.ts"] })).rejects.toThrow("not a real directory");
		expect(readFileSync(join(root, "a.ts"), "utf8")                                                                                 ).toBe   (sourceBefore  ) ;
		expect(["conventions.jsonl", "examples.jsonl", "decisions.jsonl"].map(name => readFileSync(join(root, ".boxbox", name), "utf8"))).toEqual(approvedBefore) ;
		expect(existsSync(join(root, ".boxbox/cache/shape.jsonl"))                                                                      ).toBe   (false         ) ;
	});
});
