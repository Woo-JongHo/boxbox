import      { afterEach, describe, expect, test                          } from "bun:test"                  ;
import      { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"                   ;
import      { join                                                       } from "node:path"                 ;

import      {
              APPROVAL_VERSIONS                                        ,
              documentResolver                                         ,
              evaluateApproval                                         ,
              evaluateDetected                                         ,
              loadApprovalRegistry                                     ,
              type ApprovalRegistry                                    ,
                                                                         } from "@/common/approval-gate.ts" ;
import      { sectionHash, contentHashOf, type Decision, type Example    } from "@/common/examples.ts"      ;
import      { type LoadedConvention                                      } from "@/common/conventions.ts"   ;
import      { lookupKeyOf                                                } from "@/common/signature.ts"     ;

const KEY                  = lookupKeyOf("typescript", "SourceFile", "declaration-equals", ["equals", "semicolon"]) ;
const workspaces: string[] = []                                                                                     ;

function workspace(): string {
	const root = mkdtempSync(join(import.meta.dir, "approval-gate-"));
	workspaces.push(root);
	mkdirSync(join(root, "docs"));
	writeFileSync(join(root, "docs", "rules.md"), "# 규칙\n\n## 표 정렬\n승인된 문장\n");
	return root;
}

function convention(partial: Partial<LoadedConvention> = {}): LoadedConvention {
	return {
		schemaVersion: 1, id: "ts-rule", key: KEY, pattern: "DEFINE", status: "approved", scope: "**", examples: ["ts-rule-positive", "ts-rule-counter"],
		versions: APPROVAL_VERSIONS, approvedBy: "human", date: "2026-10-04", layer: "preset", ...partial,
	};
}

function example(id: string, verdict: Example["verdict"], partial: Partial<Example> = {}): Example {
	const before = `${id} before` ;
	const after  = `${id} after`  ;
	return {
		schemaVersion: 1, id, status: "approved", versions: APPROVAL_VERSIONS, language: "typescript", regime: "table", patterns: ["DEFINE"], rules: ["ts-rule"],
		before, after, contentHash: contentHashOf(before, after), verdict, asserts: { after: {} }, source: { kind: "synthetic", license: "test" }, approvedBy: "human", date: "2026-10-04", ...partial,
	};
}

function decision(root: string, partial: Partial<Decision> = {}): Decision {
	const document = "# 규칙\n\n## 표 정렬\n승인된 문장\n";
	return {
		schemaVersion: 1, id: "ts-rule", kind: "rule", layer: "convention", ref: "docs/rules.md#표 정렬", docHash: sectionHash(document, "표 정렬"),
		examples: ["ts-rule-positive", "ts-rule-counter"], approvedBy: "human", date: "2026-10-04", ...partial,
	};
}

function registry(root: string, partial: Partial<ApprovalRegistry> = {}): ApprovalRegistry {
	return {
		conventions: [convention()],
		examples: new Map([
			["ts-rule-positive", example("ts-rule-positive", "after-better")],
			["ts-rule-counter", example("ts-rule-counter", "bad")],
		]),
		decisions: new Map([["ts-rule", decision(root)]]),
		...partial,
	};
}

afterEach(() => {
	for (const root of workspaces.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("승인 쓰기 gate", () => {
	test("정확한 키와 완전한 사람 승인 증명만 쓰기를 허용하고 GUIDE에는 after-better만 넣는다", () => {
		const root = workspace();
		const data = registry(root, { examples: new Map([
			["ts-rule-positive", example("ts-rule-positive", "after-better")],
			["ts-rule-counter", example("ts-rule-counter", "bad")],
			["unlinked-taste", example("unlinked-taste", "taste")],
			["unlinked-candidate", example("unlinked-candidate", "after-better", { status: "candidate" })],
			["unlinked-deprecated", example("unlinked-deprecated", "after-better", { status: "deprecated" })],
			["unlinked-unverified", example("unlinked-unverified", "after-better", { approvedBy: "" })],
		]) });

		const result = evaluateApproval(data, { key: KEY, file: "src/a.ts" }, documentResolver(root));

		expect(result.status  )    .toBe     ("approved"                                                                                      ) ;
		expect(result.writable)    .toBe     (true                                                                                            ) ;
		expect(result.guide   )    .toEqual  ([{ id: "ts-rule-positive", before: "ts-rule-positive before", after: "ts-rule-positive after" }]) ;
		expect(result.text    )    .toContain("ts-rule-positive after"                                                                        ) ;
		expect(result.text    ).not.toContain("unlinked-taste"                                                                                ) ;
		expect(result.text    ).not.toContain("unlinked-candidate"                                                                            ) ;
		expect(result.text    ).not.toContain("unlinked-deprecated"                                                                           ) ;
		expect(result.text    ).not.toContain("unlinked-unverified"                                                                           ) ;
	});

	test("detected descriptor를 현재 exact key로 바꾸고 원래 파일 경로를 보존한다", () => {
		const root = workspace();
		const [evaluated] = evaluateDetected(registry(root), [{ language: "typescript", context: "SourceFile", kind: "declaration-equals", axes: ["equals=12", "semicolon=40"], file: "src/original.ts" }], documentResolver(root));

		expect(evaluated?.query).toEqual({ key: KEY, file: "src/original.ts" }) ;
		expect(evaluated?.result.writable).toBe(true)                           ;
	});

	for (const [status, expected] of [["candidate", "unknown"], ["rejected", "rejected"]] as const) {
		test(`${status} convention은 쓰기를 거절한다`, () => {
			const root   = workspace()                                                                                                                     ;
			const result = evaluateApproval(registry(root, { conventions: [convention({ status })] }), { key: KEY, file: "a.ts" }, documentResolver(root)) ;
			expect(result.status  ).toBe(expected) ;
			expect(result.writable).toBe(false)    ;
		});
	}

	test("unknown 키와 같은 우선순위의 중복 convention은 각각 unknown/conflict다", () => {
		const root = workspace()                                                                  ;
		const data = registry(root, { conventions: [convention(), convention({ id: "other" })] }) ;

		expect(evaluateApproval(data, { key: lookupKeyOf("typescript", "Block", "x", []), file: "a.ts" }, documentResolver(root)).status).toBe("unknown")  ;
		expect(evaluateApproval(data, { key: KEY, file: "a.ts" }, documentResolver(root)).status).toBe("conflict") ;
	});

	test("project → user → preset 순으로 가장 높은 층을 고른다", () => {
		const root    = workspace()                                                          ;
		const preset  = convention({ id: "preset", layer: "preset", status: "rejected" })    ;
		const user    = convention({ id: "user", layer: "user", status: "rejected" })        ;
		const project = convention({ id: "project", layer: "project", status: "candidate" }) ;

		const result = evaluateApproval(registry(root, { conventions: [preset, user, project] }), { key: KEY, file: "a.ts" }, documentResolver(root));
		expect(result.conventionId).toBe("project") ;
		expect(result.layer       ).toBe("project") ;
	});

	test("결정 누락·낡은 문서 hash·잘못된 버전·사람 승인 누락을 모두 막는다", () => {
		const root     = workspace()            ;
		const resolver = documentResolver(root) ;

		expect(evaluateApproval(registry(root, { decisions: new Map() }), { key: KEY, file: "a.ts" }, resolver).reasons                                                           ).toContain("matching decision is missing"       ) ;
		expect(evaluateApproval(registry(root, { decisions: new Map([["ts-rule", decision(root, { docHash: "sha256:stale" })]]) }), { key: KEY, file: "a.ts" }, resolver).reasons ).toContain("decision document hash is stale"    ) ;
		expect(evaluateApproval(registry(root, { conventions: [convention({ versions: { ...APPROVAL_VERSIONS, lookupKey: 0 } })] }), { key: KEY, file: "a.ts" }, resolver).reasons).toContain("convention versions are unsupported") ;
		expect(evaluateApproval(registry(root, { conventions: [convention({ approvedBy: "" })] }), { key: KEY, file: "a.ts" }, resolver).reasons                                  ).toContain("human approval receipt is missing"  ) ;
	});

	test("positive·counterexample·양쪽 링크·내용 hash·규칙 관련성이 하나라도 없으면 막는다", () => {
		const root      = workspace()                                                                  ;
		const resolver  = documentResolver(root)                                                       ;
		const noCounter = new Map([["ts-rule-positive", example("ts-rule-positive", "after-better")]]) ;
		const stale     = example("ts-rule-positive", "after-better", { contentHash: "sha256:stale" }) ;
		const unrelated = example("ts-rule-positive", "after-better", { rules: ["other"] })            ;
		const noReceipt = example("ts-rule-positive", "after-better", { approvedBy: "" })              ;

		expect(evaluateApproval(registry(root, { examples: noCounter }), { key: KEY, file: "a.ts" }, resolver).reasons                                                                                   ).toContain("relevant counterexample is missing"                                   ) ;
		expect(evaluateApproval(registry(root, { examples: new Map([[stale.id, stale], ["ts-rule-counter", example("ts-rule-counter", "bad")]]) }), { key: KEY, file: "a.ts" }, resolver).reasons        ).toContain("example content hash is stale: ts-rule-positive"                      ) ;
		expect(evaluateApproval(registry(root, { examples: new Map([[unrelated.id, unrelated], ["ts-rule-counter", example("ts-rule-counter", "bad")]]) }), { key: KEY, file: "a.ts" }, resolver).reasons).toContain("example is not relevant to convention: ts-rule-positive"              ) ;
		expect(evaluateApproval(registry(root, { examples: new Map([[noReceipt.id, noReceipt], ["ts-rule-counter", example("ts-rule-counter", "bad")]]) }), { key: KEY, file: "a.ts" }, resolver).reasons).toContain("example human approval receipt is missing: ts-rule-positive"          ) ;
		expect(evaluateApproval(registry(root, { decisions: new Map([["ts-rule", decision(root, { examples: ["ts-rule-positive"] })]]) }), { key: KEY, file: "a.ts" }, resolver).reasons                 ).toContain("example link differs between convention and decision: ts-rule-counter") ;
	});

	test("문서 ref의 root 탈출을 거절한다", () => {
		const root   = workspace()                                                                                                                                                                   ;
		const result = evaluateApproval(registry(root, { decisions: new Map([["ts-rule", decision(root, { ref: "../outside.md#표 정렬" })]]) }), { key: KEY, file: "a.ts" }, documentResolver(root)) ;
		expect(result.writable  ).toBe(false)                    ;
		expect(result.reasons[0]).toContain("document is invalid") ;
	});

	test("같은 상대 ref를 convention 층에 맞는 문서 root에서 해석한다", () => {
		const base    = workspace()           ;
		const project = join(base, "project") ;
		const user    = join(base, "user")    ;
		mkdirSync(join(project, "docs"), { recursive: true });
		mkdirSync(join(user, "docs"), { recursive: true });
		writeFileSync(join(project, "docs", "rules.md"), "# 규칙\n\n## 표 정렬\nproject 문장\n");
		writeFileSync(join(user, "docs", "rules.md"), "# 규칙\n\n## 표 정렬\nuser 문장\n");
		const userDocument = "# 규칙\n\n## 표 정렬\nuser 문장\n";
		const data = registry(base, {
			conventions: [convention({ layer: "user" })],
			decisions: new Map([["ts-rule", decision(base, { docHash: sectionHash(userDocument, "표 정렬") })]]),
		});

		const result = evaluateApproval(data, { key: KEY, file: "a.ts" }, documentResolver({ project, user }));
		expect(result.writable).toBe(true);
	});
});

describe("registry loader", () => {
	test("명시한 root와 층에서 JSONL을 읽고 malformed와 중복 proof를 거절한다", () => {
		const root = workspace();
		writeFileSync(join(root, "conventions.jsonl"), `${JSON.stringify(convention({ layer: "preset" }))}\n`);
		writeFileSync(join(root, "examples.jsonl"), `${JSON.stringify(example("ts-rule-positive", "after-better"))}\n${JSON.stringify(example("ts-rule-counter", "bad"))}\n`);
		writeFileSync(join(root, "decisions.jsonl"), `${JSON.stringify(decision(root))}\n`);

		const loaded = loadApprovalRegistry([{ root, layer: "user" }]);
		expect(loaded.conventions[0]?.layer).toBe("user");

		writeFileSync(join(root, "decisions.jsonl"), "{}\n");
		expect(() => loadApprovalRegistry([{ root, layer: "user" }])).toThrow("schemaVersion");

		writeFileSync(join(root, "decisions.jsonl"), `${JSON.stringify(decision(root))}\n`);
		expect(() => loadApprovalRegistry([{ root, layer: "user" }, { root, layer: "preset" }])).toThrow("duplicate proof example");
	});

	test("registry override의 root 탈출과 symbolic/non-regular 파일을 거절한다", () => {
		const base     = workspace()                 ;
		const registry = join(base, "registry")      ;
		const outside  = join(base, "outside.jsonl") ;
		mkdirSync(registry);
		writeFileSync(outside, "");
		symlinkSync(outside, join(registry, "linked.jsonl"));
		mkdirSync(join(registry, "directory.jsonl"));

		expect(() => loadApprovalRegistry([{ root: registry, layer: "project", conventions: "../outside.jsonl" }])).toThrow("escapes root"        ) ;
		expect(() => loadApprovalRegistry([{ root: registry, layer: "project", conventions: "linked.jsonl" }])    ).toThrow("regular non-symbolic") ;
		expect(() => loadApprovalRegistry([{ root: registry, layer: "project", conventions: "directory.jsonl" }]) ).toThrow("regular non-symbolic") ;
	});
});
