import      { describe, expect, test                             } from "bun:test"                   ;
import      { readdirSync, readFileSync                          } from "node:fs"                    ;
import      { join                                               } from "node:path"                  ;
import      { alignSource                                        } from "@/common/table-engine.ts"   ;
import      { GENRES, PARAGRAPH_PURPOSES, PATTERNS, ROLES, UNITS } from "@/common/grammar-ids.ts"    ;
import      { patternOf, surfaceOf, validateSurface              } from "@/common/surface.ts"        ;
import      { PYTHON_ALIGNER                                     } from "@/python/profile.ts"        ;
import      { KIND_AXES                                          } from "@/typescript/grid-kinds.ts" ;

const ROOT    = join(import.meta.dir, "..")                                             ;
const GRAMMAR = readFileSync(join(ROOT, "product/rules/references/grammar.md"), "utf8") ;

/** Reads the `ID`s in the first column of the tables in grammar.md's `## <n>.` sections, in order. */
function idsInSection(number: number): readonly string[] {
	const start = GRAMMAR.indexOf(`\n## ${number}. `)             ;
	const end   = GRAMMAR.indexOf("\n## ", start + 1)             ;
	const body  = GRAMMAR.slice(start, end < 0 ? undefined : end) ;
	return [...body.matchAll(/^\| `([A-Z]+)` \|/gmu)].map(match => match[1]!);
}

describe("grammar ID registry", () => {
	test("the tables in grammar.md match the list in grammar-ids.ts", () => {
		expect(idsInSection(1)).toEqual([...UNITS             ]) ;
		expect(idsInSection(2)).toEqual([...ROLES             ]) ;
		expect(idsInSection(3)).toEqual([...PATTERNS          ]) ;
		expect(idsInSection(4)).toEqual([...PARAGRAPH_PURPOSES]) ;
		expect(idsInSection(5)).toEqual([...GENRES            ]) ;
	});
});

describe("surface forms — TypeScript", () => {
	test("every engine kind maps to a pattern", () => {
		for (const kind of Object.keys(KIND_AXES)) {
			expect(patternOf("typescript", { kind, axes: [] }), kind).toBeDefined();
		}
	});

	test("an enum with values is MAP, names only is LIST", () => {
		expect(patternOf("typescript", { kind: "enum-member", axes: ["equals=12", "comma=20"] })?.pattern).toBe("MAP" ) ;
		expect(patternOf("typescript", { kind: "enum-member", axes: ["comma=9"              ] })?.pattern).toBe("LIST") ;
	});

	test("declaration and assignment are different patterns and not ambiguous", () => {
		expect(patternOf("typescript", { kind: "declaration-equals", axes: [] })).toEqual({ pattern: "DEFINE", alternatives: [] }) ;
		expect(patternOf("typescript", { kind: "assignments"       , axes: [] })).toEqual({ pattern: "CHANGE", alternatives: [] }) ;
	});

	test("an unknown kind is not mapped (target of alarm A8)", () => {
		expect(patternOf("typescript", { kind: "not-a-kind", axes: [] })).toBeUndefined();
	});
});

describe("surface forms — Python", () => {
	test("every table in the fixture maps to a pattern", () => {
		const dirs = [join(ROOT, "test/fixtures/python")] ;
		let tables = 0                                    ;
		for (const dir of dirs) {
			for (const file of readdirSync(dir, { recursive: true }).map(String).filter(name => name.endsWith(".py"))) {
				const result = alignSource(readFileSync(join(dir, file), "utf8"), PYTHON_ALIGNER, { minRows: 3, apply: false });
				for (const table of [...result.details, ...result.refused]) {
					tables += 1;
					expect(patternOf("python", { axes: table.axes }), `${file}:${table.startLine}`).toBeDefined();
				}
			}
		}
		expect(tables).toBeGreaterThan(0);
	});

	test("`a = v`, where declaration and assignment share syntax, is marked ambiguous", () => {
		expect(patternOf("python", { axes: ["name", "equal=6", "value"         ] })         ).toEqual({ pattern: "DEFINE"  , alternatives: ["CHANGE"] }) ;
		expect(patternOf("python", { axes: ["name", "colon", "type", "equal", "value"] })   ).toEqual({ pattern: "DESCRIBE", alternatives: ["DEFINE"] }) ;
		expect(patternOf("python", { axes: ["name", "colon", "type"            ] })         ).toEqual({ pattern: "DESCRIBE", alternatives: [        ] }) ;
		expect(patternOf("python", { axes: ["key", "colon", "value", "comma"   ] })?.pattern).toBe   ("MAP"                                            ) ;
		expect(patternOf("python", { axes: ["open[", "cell", "comma", "close]" ] })?.pattern).toBe   ("LIST"                                           ) ;
	});
});

describe("surface-form data validation", () => {
	test("every shipped data file is valid", () => {
		expect(surfaceOf("typescript")?.forms.length).toBeGreaterThan(0) ;
		expect(surfaceOf("python"    )?.forms.length).toBeGreaterThan(0) ;
		expect(surfaceOf("cobol"     )               ).toBeUndefined()   ;
	});

	test("refuses IDs missing from the grammar, forms with no matcher or two, and other language names", () => {
		const base = { schemaVersion: 1, language: "python" };

		expect(() => validateSurface({ ...base, forms: [{ kind: "x", pattern: "ASSIGN" }] }, "python")                     ).toThrow("unknown pattern"    ) ;
		expect(() => validateSurface({ ...base, forms: [{ kind: "x", pattern: "MAP", alternatives: ["BIND"] }] }, "python")).toThrow("unknown alternative") ;
		expect(() => validateSurface({ ...base, forms: [{ pattern: "MAP" }] }, "python")                                   ).toThrow("exactly one"        ) ;
		expect(() => validateSurface({ ...base, forms: [{ kind: "x", axesPrefix: ["key"], pattern: "MAP" }] }, "python")   ).toThrow("exactly one"        ) ;
		expect(() => validateSurface({ ...base, forms: [{ kind: "x", pattern: "MAP" }] }, "typescript")                    ).toThrow("language field"     ) ;
		expect(() => validateSurface({ ...base, schemaVersion: 2, forms: [] }, "python")                                   ).toThrow("schemaVersion"      ) ;
	});
});
