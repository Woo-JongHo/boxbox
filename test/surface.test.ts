import      { describe, expect, test                } from "bun:test"                                       ;
import      { readdirSync, readFileSync             } from "node:fs"                                        ;
import      { join                                  } from "node:path"                                      ;
import      { alignSource                           } from "../skills/xxx/scripts/common/table-engine.ts"   ;
import      {
              GENRES                              ,
              PARAGRAPH_PURPOSES                  ,
              PATTERNS                            ,
              ROLES                               ,
              UNITS                               ,
                                                    } from "../skills/xxx/scripts/common/grammar-ids.ts"    ;
import      { patternOf, surfaceOf, validateSurface } from "../skills/xxx/scripts/common/surface.ts"        ;
import      { PYTHON_ALIGNER                        } from "../skills/xxx/scripts/python/profile.ts"        ;
import      { KIND_AXES                             } from "../skills/xxx/scripts/typescript/grid-kinds.ts" ;

const ROOT    = join(import.meta.dir, "..")                                          ;
const GRAMMAR = readFileSync(join(ROOT, "skills/xxx/references/grammar.md"), "utf8") ;

/** grammar.md의 `## <n>.` 절에서 표 첫 칸의 `ID`들을 순서대로 읽는다. */
function idsInSection(number: number): readonly string[] {
	const start = GRAMMAR.indexOf(`\n## ${number}. `)             ;
	const end   = GRAMMAR.indexOf("\n## ", start + 1)             ;
	const body  = GRAMMAR.slice(start, end < 0 ? undefined : end) ;
	return [...body.matchAll(/^\| `([A-Z]+)` \|/gmu)].map(match => match[1]!)                            ;
}

describe("문법 ID 레지스트리", () => {
	test("grammar.md의 표와 grammar-ids.ts의 목록이 같다", () => {
		expect(idsInSection(1)).toEqual([...UNITS             ]) ;
		expect(idsInSection(2)).toEqual([...ROLES             ]) ;
		expect(idsInSection(3)).toEqual([...PATTERNS          ]) ;
		expect(idsInSection(4)).toEqual([...PARAGRAPH_PURPOSES]) ;
		expect(idsInSection(5)).toEqual([...GENRES            ]) ;
	});
});

describe("표현형 — TypeScript", () => {
	test("엔진의 모든 kind가 문형에 대응된다", () => {
		for (const kind of Object.keys(KIND_AXES)) {
			expect(patternOf("typescript", { kind, axes: [] }), kind).toBeDefined() ;
		}
	});

	test("값이 붙은 enum은 MAP, 이름만 있으면 LIST", () => {
		expect(patternOf("typescript", { kind: "enum-member", axes: ["equals=12", "comma=20"] })?.pattern).toBe("MAP" ) ;
		expect(patternOf("typescript", { kind: "enum-member", axes: ["comma=9"              ] })?.pattern).toBe("LIST") ;
	});

	test("선언과 대입은 서로 다른 문형이고 모호하지 않다", () => {
		expect(patternOf("typescript", { kind: "declaration-equals", axes: [] })).toEqual({ pattern: "DEFINE", alternatives: [] }) ;
		expect(patternOf("typescript", { kind: "assignments"       , axes: [] })).toEqual({ pattern: "CHANGE", alternatives: [] }) ;
	});

	test("모르는 kind는 대응되지 않는다 (알람 A8의 대상)", () => {
		expect(patternOf("typescript", { kind: "not-a-kind", axes: [] })).toBeUndefined() ;
	});
});

describe("표현형 — Python", () => {
	test("fixture의 모든 표가 문형에 대응된다", () => {
		const dirs = [join(ROOT, "skills/xxx/fixtures/python"), join(ROOT, "skills/xxx/fixtures/python/corpus")] ;
		let tables = 0                                                                                           ;
		for (const dir of dirs) {
			for (const file of readdirSync(dir, { recursive: true }).map(String).filter(name => name.endsWith(".py"))) {
				const result = alignSource(readFileSync(join(dir, file), "utf8"), PYTHON_ALIGNER, { minRows: 3, apply: false }) ;
				for (const table of [...result.details, ...result.refused]) {
					tables += 1                                                                                            ;
					expect(patternOf("python", { axes: table.axes }), `${file}:${table.startLine}`).toBeDefined()         ;
				}
			}
		}
		expect(tables).toBeGreaterThan(0) ;
	});

	test("선언과 대입이 같은 문법인 `a = v`는 모호로 표시된다", () => {
		expect(patternOf("python", { axes: ["name", "equal=6", "value"         ] })         ).toEqual({ pattern: "DEFINE"  , alternatives: ["CHANGE"] }) ;
		expect(patternOf("python", { axes: ["name", "colon", "type", "equal", "value"] })   ).toEqual({ pattern: "DESCRIBE", alternatives: ["DEFINE"] }) ;
		expect(patternOf("python", { axes: ["name", "colon", "type"            ] })         ).toEqual({ pattern: "DESCRIBE", alternatives: [        ] }) ;
		expect(patternOf("python", { axes: ["key", "colon", "value", "comma"   ] })?.pattern).toBe   ("MAP"                                            ) ;
		expect(patternOf("python", { axes: ["open[", "cell", "comma", "close]" ] })?.pattern).toBe   ("LIST"                                           ) ;
	});
});

describe("표현형 데이터 검증", () => {
	test("배포되는 데이터 파일은 모두 유효하다", () => {
		expect(surfaceOf("typescript")?.forms.length).toBeGreaterThan(0) ;
		expect(surfaceOf("python"    )?.forms.length).toBeGreaterThan(0) ;
		expect(surfaceOf("cobol"     )               ).toBeUndefined()   ;
	});

	test("문법에 없는 ID, 찾는 방법이 없거나 둘인 형태, 다른 언어 이름은 거부된다", () => {
		const base = { schemaVersion: 1, language: "python" }                                                                                  ;
		expect(() => validateSurface({ ...base, forms: [{ kind: "x", pattern: "ASSIGN" }] }, "python")                     ).toThrow("unknown pattern"    ) ;
		expect(() => validateSurface({ ...base, forms: [{ kind: "x", pattern: "MAP", alternatives: ["BIND"] }] }, "python")).toThrow("unknown alternative") ;
		expect(() => validateSurface({ ...base, forms: [{ pattern: "MAP" }] }, "python")                                   ).toThrow("exactly one"        ) ;
		expect(() => validateSurface({ ...base, forms: [{ kind: "x", axesPrefix: ["key"], pattern: "MAP" }] }, "python")   ).toThrow("exactly one"        ) ;
		expect(() => validateSurface({ ...base, forms: [{ kind: "x", pattern: "MAP" }] }, "typescript")                    ).toThrow("language field"     ) ;
		expect(() => validateSurface({ ...base, schemaVersion: 2, forms: [] }, "python")                                   ).toThrow("schemaVersion"      ) ;
	});
});
