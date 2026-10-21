import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { APPROVAL_VERSIONS, documentResolver } from "@/common/approval-gate.ts";
import type { ApprovalRegistry } from "@/common/approval-gate.ts";
import { contentHashOf, sectionHash } from "@/common/examples.ts";
import type { Example } from "@/common/examples.ts";
import { runFormatPipeline } from "@/common/format-pipeline.ts";
import type { StructuredLanguage } from "@/structured/index.ts";

const roots: string[] = [];

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function workspace(language: StructuredLanguage, source: string) {
	const root = mkdtempSync(join(tmpdir(), "boxbox-structured-pipeline-")) ;
	const file = `document.${language === "json" ? "json" : "yaml"}`        ;
	mkdirSync(join(root, "docs"));
	writeFileSync(join(root, file), source);
	writeFileSync(join(root, "docs/rules.md"), "# Rules\n\n## Structured mapping\nSynthetic structured alignment approval.\n");
	roots.push(root);
	return { root, file, target: join(root, file) };
}

function registry(root: string, language: StructuredLanguage): ApprovalRegistry {
	const id = `test-${language}-mapping`;
	const examples: Example[] = (["after-better", "bad"] as const).map(verdict => {
		const before = `${id}-${verdict}-before`, after = `${id}-${verdict}-after`;
		return { schemaVersion: 1, id: `${id}-${verdict}`, status: "approved", versions: APPROVAL_VERSIONS, language, regime: "table", patterns: ["DEFINE"], rules: [id], before, after, contentHash: contentHashOf(before, after), verdict, asserts: { after: {} }, source: { kind: "synthetic", license: "test" }, approvedBy: "synthetic-test-approver", date: "2026-10-21" };
	});
	const exampleIds = examples.map(example => example.id              ) ;
	const document   = readFileSync(join(root, "docs/rules.md"), "utf8") ;
	return {
		conventions : [{ schemaVersion: 1, id, key: `v1|${language}|${language === "json" ? "object" : "block-map"}|mapping|key-colon>value`, pattern: "DEFINE", status: "approved", scope: `**/*.${language === "json" ? "json" : "yaml"}`, examples: exampleIds, versions: APPROVAL_VERSIONS, approvedBy: "synthetic-test-approver", date: "2026-10-21", layer: "project" }],
		examples    : new Map(examples.map(example => [example.id, example])),
		decisions   : new Map([[id, { schemaVersion: 1, id, kind: "rule", layer: "convention", ref: "docs/rules.md#Structured mapping", docHash: sectionHash(document, "Structured mapping"), examples: exampleIds, approvedBy: "synthetic-test-approver", date: "2026-10-21" }]]),
	};
}

for (const scenario of [
	{ language: "json" as const, source: "{\n  \"a\":1,  \n  \"longer\" : 2,\n  \"x\"  :3\n}\n", expected: "{\n  \"a\"     : 1,  \n  \"longer\": 2,\n  \"x\"     : 3\n}\n" },
	{ language: "yaml" as const, source: "a: 1\nlonger : 2\nx:  3\nblock: |2\n    keep:  exact\n", expected: "a     : 1\nlonger: 2\nx     : 3\nblock: |2\n    keep:  exact\n" },
]) test(`${scenario.language} previews, applies, preserves unsupported bytes, and reaches a fixed point`, async () => {
	const fixture = workspace(scenario.language, scenario.source)                                                                                                                                                      ;
	const options = { root: fixture.root, file: fixture.file, language: scenario.language, registry: registry(fixture.root, scenario.language), resolveDocument: documentResolver(fixture.root), alignmentOnly: true } ;
	const preview = await runFormatPipeline({ ...options, dryRun: true })                                                                                                                                              ;

	expect(preview                             ).toMatchObject({ written: false, boxboxChanged: true, fixedPoint: true, approvals: [`test-${scenario.language}-mapping`] }) ;
	expect(preview.alignmentEdits?.length      ).toBe         (3                                                                                                          ) ;
	expect(readFileSync(fixture.target, "utf8")).toBe         (scenario.source                                                                                            ) ;

	const applied = await runFormatPipeline(options);
	expect(applied.written                           ).toBe   (true                         ) ;
	expect(readFileSync(fixture.target, "utf8")      ).toBe   (scenario.expected            ) ;
	expect((await runFormatPipeline(options)).written).toBe   (false                        ) ;
	expect(readFileSync(fixture.target, "utf8")      ).toBe   (scenario.expected            ) ;
	expect(readdirSync(fixture.root).sort()          ).toEqual(["docs", fixture.file].sort()) ;
});

test("structured pipeline refuses missing approval without changing the source", async () => {
	const source                   = "{\n  \"a\":1,\n  \"longer\":2,\n  \"x\":3\n}\n"               ;
	const fixture                  = workspace("json", source)                                      ;
	const denied: ApprovalRegistry = { conventions: [], examples: new Map(), decisions: new Map() } ;
	await expect(runFormatPipeline({ root: fixture.root, file: fixture.file, language: "json", registry: denied, resolveDocument: documentResolver(fixture.root) })).rejects.toThrow("approval denied");
	expect(readFileSync(fixture.target, "utf8")).toBe(source);
});

test("invalid UTF-8 is refused before standalone or Align can replace the original bytes", async () => {
	const fixture = workspace  ("json", "{}\n"                                                          ) ;
	const invalid = Buffer.from([0x7b, 0x0a, 0x20, 0x20, 0x22, 0x61, 0x22, 0x3a, 0xff, 0x0a, 0x7d, 0x0a]) ;
	writeFileSync(fixture.target, invalid);
	const options = { root: fixture.root, file: fixture.file, language: "json" as const, registry: registry(fixture.root, "json"), resolveDocument: documentResolver(fixture.root) };
	for (const alignmentOnly of [false, true]) {
		await expect(runFormatPipeline({ ...options, alignmentOnly })).rejects.toThrow("not valid UTF-8");
		expect(readFileSync(fixture.target)).toEqual(invalid);
	}
	const marker = join(fixture.root, "formatter-ran");
	await expect(runFormatPipeline({ ...options, formatter: { command: process.execPath, args: ["-e", `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'ran')`, "{file}"], timeoutMs: 2_000 } })).rejects.toThrow("not valid UTF-8");
	expect(existsSync(marker)).toBe(false);
	expect(readFileSync(fixture.target)).toEqual(invalid);
});

for (const scenario of [
	{ language: "json" as const, source: '{"a": 1,}\n' },
	{ language: "yaml" as const, source: "a: one\na: two\n" },
]) test(`invalid ${scenario.language} refuses before approval and stays unchanged`, async () => {
	const fixture = workspace(scenario.language, scenario.source);
	await expect(runFormatPipeline({ root: fixture.root, file: fixture.file, language: scenario.language, registry: registry(fixture.root, scenario.language), resolveDocument: documentResolver(fixture.root) })).rejects.toThrow("does not parse");
	expect(readFileSync(fixture.target, "utf8")).toBe(scenario.source);
});
