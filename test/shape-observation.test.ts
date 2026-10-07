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

describe("코드 모양 관측", () => {
	test("파일 순서와 반복 실행에 관계없이 같은 JSONL을 만든다", async () => {
		const root   = fixture({ "a.ts": "function a() { const x = 1; return x; }\n", "b.ts": "function b() { run(); }\n" }) ;
		const first  = await observeShapes({ root, files: ["b.ts", "a.ts"], writeCache: false })                             ;
		const second = await observeShapes({ root, files: ["a.ts", "b.ts"], writeCache: false })                             ;
		expect(first.jsonl).toBe(second.jsonl);
	});

	test("실제 파서 버전과 설정 지문이 스냅샷 무효화 입력에 포함된다", async () => {
		const root  = fixture({ "a.ts": "function a() {}\n" })                                                                    ;
		const left  = await observeShapes({ root, files: ["a.ts"], fingerprints: { config: "sha256:left" }, writeCache: false })  ;
		const right = await observeShapes({ root, files: ["a.ts"], fingerprints: { config: "sha256:right" }, writeCache: false }) ;
		expect(SHAPE_PARSER_VERSION           )    .toContain(typescriptVersion) ;
		expect(left.header.fingerprints.config)    .toBe     ("sha256:left"    ) ;
		expect(left.jsonl                     ).not.toBe     (right.jsonl      ) ;
	});

	test("대입은 CHANGE이고 비교와 제어 흐름은 unknown이며 debugger는 notApplicable이다", async () => {
		const root   = fixture({ "a.ts": "function sample(x: number) { x = 1; x === 1; if (x) run(); debugger; }\n" }) ;
		const result = await observeShapes({ root, files: ["a.ts"], writeCache: false })                               ;
		expect(result.units[0]!.segments.map(segment => segment.classification)).toEqual(["CHANGE", "unknown", "notApplicable"]);
		expect(result.units[0]!.segments[1]!.count).toBe(2);
	});

	test("누락 파일과 JavaScript 파일은 다른 파일 수집을 중단하지 않는다", async () => {
		const root   = fixture({ "a.ts": "function kept() {}\n", "b.js": "function unsupported() {}\n" })      ;
		const result = await observeShapes({ root, files: ["a.ts", "missing.ts", "b.js"], writeCache: false }) ;
		expect(result.header.completion).toMatchObject({ complete: false, requested: 3, succeeded: 1, failed: 2 });
		expect(result.files.map(file => file.status)).toEqual(["ok", "failed", "failed"]);
	});

	test("동명·중첩·같은 줄의 함수를 범위와 부모로 구별한다", async () => {
		const root   = fixture({ "a.ts": "function same(){ function same(){ return 1; } return 2; } function same(){ return 3; }\n" }) ;
		const result = await observeShapes({ root, files: ["a.ts"], writeCache: false })                                               ;
		expect(result.units                                                       ).toHaveLength(3                  ) ;
		expect(new Set(result.units.map(unit => unit.id)).size                    ).toBe        (3                  ) ;
		expect(result.units[1]!.parentUnitId                                      ).toBe        (result.units[0]!.id) ;
		expect(new Set(result.units.map(unit => `${unit.start}:${unit.end}`)).size).toBe        (3                  ) ;
	});

	test("깨진 파일은 partial로 보고하고 마지막 완료 캐시를 보존한다", async () => {
		const root     = fixture({ "a.ts": "function ok() { return 1; }\n" }) ;
		const complete = await observeShapes({ root, files: ["a.ts"] })       ;
		const cache    = join(root, ".xxx/cache/shape.jsonl")                 ;
		expect(readFileSync(cache, "utf8")).toBe(complete.jsonl);
		expect(readFileSync(join(root, ".xxx/cache/.gitignore"), "utf8")).toBe("*\n");
		writeFileSync(join(root, "a.ts"), "function broken( {\n");
		const partial = await observeShapes({ root, files: ["a.ts"] });
		expect(partial.header.completion.complete).toBe(false         ) ;
		expect(partial.files[0]!.status          ).toBe("malformed"   ) ;
		expect(readFileSync(cache, "utf8")       ).toBe(complete.jsonl) ;
	});

	test("완료본은 현재와 직전 하나만 보존하고 같은 실행은 회전시키지 않는다", async () => {
		const root  = fixture({ "a.ts": "function first() {}\n" })   ;
		const first = await observeShapes({ root, files: ["a.ts"] }) ;
		await observeShapes({ root, files: ["a.ts"] });
		expect(existsSync(join(root, ".xxx/cache/shape.previous.jsonl"))).toBe(false);
		writeFileSync(join(root, "a.ts"), "function second() {}\n");
		await observeShapes({ root, files: ["a.ts"] });
		expect(readFileSync(join(root, ".xxx/cache/shape.previous.jsonl"), "utf8")).toBe(first.jsonl);
		expect(existsSync(join(root, ".xxx/cache/shape.lock"))).toBe(false);
	});

	test("화살표와 본문 없는 선언은 단위로 만들지 않고 미지원으로 센다", async () => {
		const root   = fixture({ "a.ts": "declare function external(): void;\nconst arrow = () => 1;\nfunction kept() {}\n" }) ;
		const result = await observeShapes({ root, files: ["a.ts"], writeCache: false })                                       ;
		expect(result.units.map(unit => unit.displayName)).toEqual(["kept"]) ;
		expect(result.files[0]!.unsupportedArrows        ).toBe   (1       ) ;
		expect(result.files[0]!.unsupportedNoBody        ).toBe   (1       ) ;
	});

	test("소스와 승인 DB는 읽기만 하고 루트 밖 경로와 캐시 심볼릭 링크를 거절한다", async () => {
		const root           = fixture({ "a.ts": "function kept() {}\n", ".xxx/conventions.jsonl": "convention\n", ".xxx/examples.jsonl": "example\n", ".xxx/decisions.jsonl": "decision\n" }) ;
		const sourceBefore   = readFileSync(join(root, "a.ts"), "utf8")                                                                                                                        ;
		const approvedBefore = ["conventions.jsonl", "examples.jsonl", "decisions.jsonl"].map(name => readFileSync(join(root, ".xxx", name), "utf8"))                                          ;
		await expect(observeShapes({ root, files: ["../outside.ts"], writeCache: false })).rejects.toThrow("inside the repository");
		symlinkSync(realpathSync(root), join(root, ".xxx/cache"));
		await expect(observeShapes({ root, files: ["a.ts"] })).rejects.toThrow("not a real directory");
		expect(readFileSync(join(root, "a.ts"), "utf8")                                                                              ).toBe   (sourceBefore  ) ;
		expect(["conventions.jsonl", "examples.jsonl", "decisions.jsonl"].map(name => readFileSync(join(root, ".xxx", name), "utf8"))).toEqual(approvedBefore) ;
		expect(existsSync(join(root, ".xxx/cache/shape.jsonl"))                                                                      ).toBe   (false         ) ;
	});
});
