import      { afterEach, describe, expect, test } from "bun:test"                    ;
import      {
              mkdirSync                       ,
              mkdtempSync                     ,
              readFileSync                    ,
              rmSync                          ,
              symlinkSync                     ,
              writeFileSync                   ,
                                                } from "node:fs"                     ;
import      { tmpdir                            } from "node:os"                     ;
import      { join                              } from "node:path"                   ;

import      { APPROVAL_VERSIONS                 } from "@/common/approval-gate.ts"   ;
import      { contentHashOf, sectionHash        } from "@/common/examples.ts"        ;
import      { preparePublicPreset               } from "../scripts/public-preset.ts" ;

const roots: string[] = [];

interface Fixture {
	readonly root     : string                    ;
	readonly examples : Record<string, unknown>[] ;
	readonly decision : Record<string, unknown>   ;
}

function fixture(): Fixture {
	const root = mkdtempSync(join(tmpdir(), "xxx-public-preset-"));
	roots.push(root);
	mkdirSync(join(root, "docs", "public"), { recursive: true });
	const rule          = "synthetic-rule"                                   ;
	const positiveId    = `${rule}-positive`                                 ;
	const counterId     = `${rule}-counter`                                  ;
	const before        = "const value = make(1);\nconst longer = make(2);"  ;
	const after         = "const value  = make(1);\nconst longer = make(2);" ;
	const counterBefore = "const single = make(1);"                          ;
	const counterAfter  = "const single = make(1);"                          ;
	const document      = "# Rule\n\nA generic synthetic layout rule.\n"     ;
	const examples = [
		{ schemaVersion: 1, id: positiveId, status: "approved", versions: APPROVAL_VERSIONS, language: "typescript", regime: "table", patterns: ["DEFINE"], rules: [rule], before, after, contentHash: contentHashOf(before, after), verdict: "after-better", asserts: { after: { has: ["A1"] } }, source: { kind: "synthetic", license: "MIT" }, approvedBy: "maintainer", date: "2026-10-04" },
		{ schemaVersion: 1, id: counterId, status: "approved", versions: APPROVAL_VERSIONS, language: "typescript", regime: "table", patterns: ["DEFINE"], rules: [rule], before: counterBefore, after: counterAfter, contentHash: contentHashOf(counterBefore, counterAfter), verdict: "bad", asserts: { after: { lacks: ["A1"] } }, source: { kind: "synthetic", license: "MIT" }, approvedBy: "maintainer", date: "2026-10-04" },
	];
	const decision   = { schemaVersion: 1, id: rule, kind: "rule", layer: "convention", ref: "docs/public/rules.md#Rule", docHash: sectionHash(document, "Rule"), examples: [positiveId, counterId], approvedBy: "maintainer", date: "2026-10-04" }                                               ;
	const convention = { schemaVersion: 1, id: rule, key: "v1|typescript|SourceFile|declaration-equals|equals>semicolon", pattern: "DEFINE", status: "approved", scope: "**/*.ts", examples: [positiveId, counterId], versions: APPROVAL_VERSIONS, approvedBy: "maintainer", date: "2026-10-04" } ;
	writeFileSync(join(root, "conventions.jsonl"), `${JSON.stringify(convention)}\n`);
	writeFileSync(join(root, "examples.jsonl"), `${examples.map(example => JSON.stringify(example)).join("\n")}\n`);
	writeFileSync(join(root, "decisions.jsonl"), `${JSON.stringify(decision)}\n`);
	writeFileSync(join(root, "docs", "public", "rules.md"), document);
	return { root, examples, decision };
}

function replaceExamples(root: string, examples: readonly Record<string, unknown>[]): void {
	writeFileSync(join(root, "examples.jsonl"), `${examples.map(example => JSON.stringify(example)).join("\n")}\n`);
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("공개 preset 배포 정책", () => {
	test("승인 synthetic 규칙은 참조한 public 문서와 함께 준비된다", () => {
		const { root } = fixture();
		expect(preparePublicPreset(root).map(file => file.path)).toEqual([
			"conventions.jsonl",
			"examples.jsonl",
			"decisions.jsonl",
			"docs/public/decisions/synthetic-rule.md",
		]);
	});

	test("참조한 승인 절만 추출하고 같은 원본 문서의 다른 절은 배포하지 않는다", () => {
		const { root, decision } = fixture();
		const approvedSection = readFileSync(join(root, "docs", "public", "rules.md"), "utf8");
		writeFileSync(join(root, "docs", "public", "rules.md"), `${approvedSection}\n# Internal notes\nPRIVATE_CODE_DO_NOT_SHIP\n`);
		const files          = preparePublicPreset(root)                                                                                 ;
		const publicDocument = files.find(file => file.path === "docs/public/decisions/synthetic-rule.md")!                              ;
		const publicDecision = JSON.parse(files.find(file => file.path === "decisions.jsonl")!.text) as { ref: string; docHash: string } ;
		expect(publicDocument.text                     )    .toBe     (approvedSection                               ) ;
		expect(files.map(file => file.text).join("\n") ).not.toContain("PRIVATE_CODE_DO_NOT_SHIP"                    ) ;
		expect(publicDecision.ref                      )    .toBe     ("docs/public/decisions/synthetic-rule.md#Rule") ;
		expect(publicDecision.ref                      ).not.toBe     (decision.ref                                  ) ;
		expect(sectionHash(publicDocument.text, "Rule"))    .toBe     (publicDecision.docHash                        ) ;
	});

	test("asserts 내부에 등록되지 않은 임의 필드를 넣으면 거절한다", () => {
		const { root, examples } = fixture();
		const leaked = { ...examples[0]!, asserts: { after: { privateSource: "내부 코드 조각" } } };
		replaceExamples(root, [leaked, examples[1]!]);
		expect(() => preparePublicPreset(root)).toThrow("unexpected fields: privateSource");
	});

	test("중복 JSON 키의 앞선 비공개 값은 정규화된 배포 JSONL에서 제거한다", () => {
		const { root, examples } = fixture();
		const records = [
			JSON.stringify(examples[0]!).replace('"before":', '"before":"PRIVATE_CODE_DO_NOT_SHIP","before":'),
			JSON.stringify(examples[1]!),
		];
		writeFileSync(join(root, "examples.jsonl"), `${records.join("\n")}\n`);
		const shipped = preparePublicPreset(root).find(file => file.path === "examples.jsonl")!;
		expect(shipped.text).not.toContain("PRIVATE_CODE_DO_NOT_SHIP");
		expect(JSON.parse(shipped.text.split("\n")[0]!).before).toBe(examples[0]!.before);
	});

	test("example.rules는 짧은 rule ID 배열이어야 한다", () => {
		const { root, examples } = fixture();
		const invalid = { ...examples[0]!, rules: "synthetic-rule" };
		replaceExamples(root, [invalid, examples[1]!]);
		expect(() => preparePublicPreset(root)).toThrow("rules must be an array");
	});

	test("versions 내부의 임의 필드도 거절한다", () => {
		const { root, examples } = fixture();
		const leaked = { ...examples[0]!, versions: { ...APPROVAL_VERSIONS, privateRepository: "internal" } };
		replaceExamples(root, [leaked, examples[1]!]);
		expect(() => preparePublicPreset(root)).toThrow("unexpected fields: privateRepository");
	});

	test("승인 synthetic 표기와 무관하게 source 경로와 비인가 license 값을 거절한다", () => {
		const { root, examples } = fixture();
		const sourced = { ...examples[0]!, source: { kind: "synthetic", license: "MIT", path: "src/private.ts" } };
		replaceExamples(root, [sourced, examples[1]!]);
		expect(() => preparePublicPreset(root)).toThrow("unexpected fields: path");
		const privateLicense = { ...examples[0]!, source: { kind: "synthetic", license: "private repository source" } };
		replaceExamples(root, [privateLicense, examples[1]!]);
		expect(() => preparePublicPreset(root)).toThrow("approved SPDX identifier");
	});

	test("docs/public 경로의 부모 symlink는 preset 내부를 가리켜도 거절한다", () => {
		const { root, decision } = fixture();
		rmSync(join(root, "docs", "public"), { recursive: true, force: true });
		mkdirSync(join(root, "docs", "private"), { recursive: true });
		writeFileSync(join(root, "docs", "private", "rules.md"), "# Rule\n\nPrivate document.\n");
		symlinkSync(join(root, "docs", "private"), join(root, "docs", "public"), "dir");
		writeFileSync(join(root, "decisions.jsonl"), `${JSON.stringify(decision)}\n`);
		expect(() => preparePublicPreset(root)).toThrow("may not be symlinks");
	});

	test("docs/public 바깥으로 정규화되는 경로는 거절한다", () => {
		const { root, decision } = fixture();
		writeFileSync(join(root, "private.md"), "# Rule\n");
		writeFileSync(join(root, "decisions.jsonl"), `${JSON.stringify({ ...decision, ref: "docs/public/../private.md#Rule" })}\n`);
		expect(() => preparePublicPreset(root)).toThrow("normalized path below docs/public");
	});
});
