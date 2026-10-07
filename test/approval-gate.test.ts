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
	writeFileSync(join(root, "docs", "rules.md"), "# Rules\n\n## Table alignment\nApproved text\n");
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
	const document = "# Rules\n\n## Table alignment\nApproved text\n";
	return {
		schemaVersion: 1, id: "ts-rule", kind: "rule", layer: "convention", ref: "docs/rules.md#Table alignment", docHash: sectionHash(document, "Table alignment"),
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

describe("approval write gate", () => {
	test("only an exact key with complete human approval proof allows writing, and GUIDE gets only after-better", () => {
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

	test("turns a detected descriptor into the current exact key and keeps the original file path", () => {
		const root = workspace();
		const [evaluated] = evaluateDetected(registry(root), [{ language: "typescript", context: "SourceFile", kind: "declaration-equals", axes: ["equals=12", "semicolon=40"], file: "src/original.ts" }], documentResolver(root));

		expect(evaluated?.query).toEqual({ key: KEY, file: "src/original.ts" }) ;
		expect(evaluated?.result.writable).toBe(true)                           ;
	});

	for (const [status, expected] of [["candidate", "unknown"], ["rejected", "rejected"]] as const) {
		test(`a ${status} convention refuses writing`, () => {
			const root   = workspace()                                                                                                                     ;
			const result = evaluateApproval(registry(root, { conventions: [convention({ status })] }), { key: KEY, file: "a.ts" }, documentResolver(root)) ;
			expect(result.status  ).toBe(expected) ;
			expect(result.writable).toBe(false)    ;
		});
	}

	test("an unknown key and duplicate conventions of equal priority are unknown/conflict respectively", () => {
		const root = workspace()                                                                  ;
		const data = registry(root, { conventions: [convention(), convention({ id: "other" })] }) ;

		expect(evaluateApproval(data, { key: lookupKeyOf("typescript", "Block", "x", []), file: "a.ts" }, documentResolver(root)).status).toBe("unknown")  ;
		expect(evaluateApproval(data, { key: KEY, file: "a.ts" }, documentResolver(root)).status).toBe("conflict") ;
	});

	test("picks the highest layer in project → user → preset order", () => {
		const root    = workspace()                                                          ;
		const preset  = convention({ id: "preset", layer: "preset", status: "rejected" })    ;
		const user    = convention({ id: "user", layer: "user", status: "rejected" })        ;
		const project = convention({ id: "project", layer: "project", status: "candidate" }) ;

		const result = evaluateApproval(registry(root, { conventions: [preset, user, project] }), { key: KEY, file: "a.ts" }, documentResolver(root));
		expect(result.conventionId).toBe("project") ;
		expect(result.layer       ).toBe("project") ;
	});

	test("blocks a missing decision, a stale document hash, a wrong version and a missing human approval", () => {
		const root     = workspace()            ;
		const resolver = documentResolver(root) ;

		expect(evaluateApproval(registry(root, { decisions: new Map() }), { key: KEY, file: "a.ts" }, resolver).reasons                                                           ).toContain("matching decision is missing"       ) ;
		expect(evaluateApproval(registry(root, { decisions: new Map([["ts-rule", decision(root, { docHash: "sha256:stale" })]]) }), { key: KEY, file: "a.ts" }, resolver).reasons ).toContain("decision document hash is stale"    ) ;
		expect(evaluateApproval(registry(root, { conventions: [convention({ versions: { ...APPROVAL_VERSIONS, lookupKey: 0 } })] }), { key: KEY, file: "a.ts" }, resolver).reasons).toContain("convention versions are unsupported") ;
		expect(evaluateApproval(registry(root, { conventions: [convention({ approvedBy: "" })] }), { key: KEY, file: "a.ts" }, resolver).reasons                                  ).toContain("human approval receipt is missing"  ) ;
	});

	test("blocks when any of positive, counterexample, both links, content hash or rule relevance is missing", () => {
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

	test("refuses a document ref that escapes the root", () => {
		const root   = workspace()                                                                                                                                                                           ;
		const result = evaluateApproval(registry(root, { decisions: new Map([["ts-rule", decision(root, { ref: "../outside.md#Table alignment" })]]) }), { key: KEY, file: "a.ts" }, documentResolver(root)) ;
		expect(result.writable  ).toBe(false)                    ;
		expect(result.reasons[0]).toContain("document is invalid") ;
	});

	test("resolves the same relative ref in the document root matching the convention layer", () => {
		const base    = workspace()           ;
		const project = join(base, "project") ;
		const user    = join(base, "user")    ;
		mkdirSync(join(project, "docs"), { recursive: true });
		mkdirSync(join(user, "docs"), { recursive: true });
		writeFileSync(join(project, "docs", "rules.md"), "# Rules\n\n## Table alignment\nproject text\n");
		writeFileSync(join(user, "docs", "rules.md"), "# Rules\n\n## Table alignment\nuser text\n");
		const userDocument = "# Rules\n\n## Table alignment\nuser text\n";
		const data = registry(base, {
			conventions: [convention({ layer: "user" })],
			decisions: new Map([["ts-rule", decision(base, { docHash: sectionHash(userDocument, "Table alignment") })]]),
		});

		const result = evaluateApproval(data, { key: KEY, file: "a.ts" }, documentResolver({ project, user }));
		expect(result.writable).toBe(true);
	});
});

describe("registry loader", () => {
	test("reads JSONL from the given roots and layers and refuses malformed and duplicate proofs", () => {
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

	test("refuses registry override root escapes and symbolic/non-regular files", () => {
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
