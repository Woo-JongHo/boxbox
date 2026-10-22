import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { assertAlignmentOnly } from "@/common/alignment-only.ts";
import { APPROVAL_VERSIONS, documentResolver, loadApprovalRegistry } from "@/common/approval-gate.ts";
import type { ApprovalRegistry } from "@/common/approval-gate.ts";
import { contentHashOf, sectionHash } from "@/common/examples.ts";
import type { Example } from "@/common/examples.ts";
import { runFormatPipeline } from "@/common/format-pipeline.ts";

const roots: string[] = []                                                            ;
const preset          = join(import.meta.dir, "../product/rules/presets/recommended") ;

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(language: "typescript" | "python", source: string) {
	const root     = mkdtempSync(join(tmpdir(), "boxbox-alignment-only-"))     ;
	const file     = language === "typescript" ? "sample.ts" : "sample.py"     ;
	const target   = join(root, file)                                          ;
	const registry = loadApprovalRegistry([{ root: preset, layer: "preset" }]) ;

	roots.push(root);
	writeFileSync(target, source);
	return { target, options: { root, file, language, registry, resolveDocument: documentResolver({ preset }), alignmentOnly: true } };
}

for (const language of ["typescript", "python"] as const) {
	test(`${language} alignment permits code gaps while preserving strings and physical layout`, () => {
		const source = '\uFEFF\tvalue="a b";\r\n'    ;
		const output = '\uFEFF\tvalue = "a b" ;\r\n' ;

		expect(() => assertAlignmentOnly(Buffer.from(source), Buffer.from(output), language)).not.toThrow();
	});

	for (const [name, source, output] of [
		["inserted newline", "x=1\n", "x=\n1\n"],
		["CRLF normalization", "x=1\r\n", "x = 1\n"],
		["removed final newline", "x=1\n", "x = 1"],
		["BOM removal", "\uFEFFx=1\n", "x = 1\n"],
		["indentation change", "\tx=1\n", "    x = 1\n"],
		["indentation after BOM", "\uFEFF\tx=1\n", "\uFEFF    x = 1\n"],
		["trailing whitespace removal", "x=1 \n", "x = 1\n"],
		["blank line whitespace", "x=1\n \nx=2\n", "x = 1\n\nx = 2\n"],
		["string space change", 'x="a b"\n', 'x = "a  b"\n'],
		["value change", "x=1\n", "x = 2\n"],
		["non-horizontal whitespace", "x=1\n", "x\f=1\n"],
	] as const) test(`${language} alignment refuses ${name}`, () => {
		expect(() => assertAlignmentOnly(Buffer.from(source), Buffer.from(output), language)).toThrow("alignment-only refusal");
	});
}

for (const [language, source, output] of [
	["typescript", "const x=1; // a b\n", "const x = 1; // a  b\n"],
	["typescript", "const x=/a b/;\n", "const x = /a  b/;\n"],
	["typescript", "const x=`a b`;\n", "const x = `a  b`;\n"],
	["python", "x=1 # a b\n", "x = 1 # a  b\n"],
	["python", 'x="""a b\nc d"""\n', 'x = """a  b\nc d"""\n'],
] as const) test(`${language} alignment preserves protected text: ${source.trim()}`, () => {
	expect(() => assertAlignmentOnly(Buffer.from(source), Buffer.from(output), language)).toThrow("alignment-only refusal");
});

test("alignment refuses invalid UTF-8 rather than hiding changed bytes", () => {
	expect(() => assertAlignmentOnly(Buffer.from([0xff]), Buffer.from([0xfe]), "typescript")).toThrow("alignment-only refusal");
});

for (const [language, source] of [
	["typescript", "const a=fn(1);\nconst longer=fn(22);\nconst mid=fn(333);\n"],
	["python", "a=1\nlonger=22\nmid=333\n"],
] as const) test(`${language} Align previews, applies and reaches a fixed point through the real pipeline`, async () => {
	const { target, options } = fixture(language, source);
	const preview = await runFormatPipeline({ ...options, dryRun: true });

	expect(preview).toMatchObject({ boxboxChanged: true, written: false, formatterExecuted: false });
	expect(preview.alignmentEdits?.length).toBeGreaterThan(0);
	const reconstructed = source.split("\n");

	for (const edit of preview.alignmentEdits!) {
		expect(reconstructed[edit.line - 1]).toBe(edit.before);
		reconstructed[edit.line - 1] = edit.after;
	}
	expect(readFileSync(target, "utf8")).toBe(source);
	const applied = await runFormatPipeline(options) ;
	const output  = readFileSync(target)             ;

	expect(applied).toMatchObject({ written: true, formatterChanged: false, fixedPoint: true, safety: { parserChecked: true, approvalChecked: true } });
	expect(applied.alignmentEdits).toBeUndefined();
	expect(output.toString("utf8")).toBe(reconstructed.join("\n"));
	expect(() => assertAlignmentOnly(Buffer.from(source), output, language)).not.toThrow();
	expect((await runFormatPipeline(options)).written).toBe   (false         ) ;
	expect(readFileSync(target).equals(output)       ).toBe   (true          ) ;
	expect(readdirSync(options.root)                 ).toEqual([options.file]) ;
}, 60_000);

test("Align rejects a supplied formatter before it can produce side effects", async () => {
	const source = "a=1\nlonger=22\nmid=333\n";
	const { target, options } = fixture("python", source);
	const marker    = join(options.root, "formatter-ran")                                                                                                         ;
	const formatter = { command: process.execPath, args: ["-e", "require('node:fs').writeFileSync(process.argv[1], 'ran')", marker, "{file}"], timeoutMs: 2_000 } ;

	await expect(runFormatPipeline({ ...options, formatter })).rejects.toThrow("cannot execute an external formatter");
	expect(existsSync(marker)          ).toBe   (false         ) ;
	expect(readFileSync(target, "utf8")).toBe   (source        ) ;
	expect(readdirSync(options.root)   ).toEqual([options.file]) ;
});

test("Align retains approval, parser and commit-time configuration safeguards", async () => {
	const source = "a=1\nlonger=22\nmid=333\n";
	const { target, options } = fixture("python", source);

	await expect(runFormatPipeline({ ...options, registry: { ...options.registry, conventions: [] } })).rejects.toThrow("approval denied");
	let revision = "one";

	await expect(runFormatPipeline({ ...options, provenance: () => revision, beforeCommit: () => { revision = "two"; } })).rejects.toThrow("provenance changed");
	expect(readFileSync(target, "utf8")).toBe(source);
	writeFileSync(target, "def invalid(:\n");
	await expect(runFormatPipeline(options)).rejects.toThrow("does not parse");
	expect(readFileSync(target, "utf8")).toBe("def invalid(:\n");
	expect(readdirSync(options.root)).toEqual([options.file]);
});

function verticalRegistry(root: string): ApprovalRegistry {
	const rule     = "synthetic-vertical-test"                                                    ;
	const document = "# Synthetic rule\n\nTest-only approval for a multi-argument declaration.\n" ;
	const examples: Example[] = (["after-better", "bad"] as const).map(verdict => ({
		schemaVersion: 1, id: `${rule}-${verdict}`, status: "approved", versions: APPROVAL_VERSIONS,
		language: "typescript", regime: "table", patterns: ["DEFINE"], rules: [rule],
		before: "synthetic before", after: "synthetic after", contentHash: contentHashOf("synthetic before", "synthetic after"),
		verdict, asserts: { after: {} }, source: { kind: "synthetic", license: "test" }, approvedBy: "synthetic-test-approver", date: "2026-10-21",
	}));
	const ids = examples.map(example => example.id);

	mkdirSync(join(root, "docs"));
	writeFileSync(join(root, "docs/rules.md"), document);
	return {
		conventions : [{ schemaVersion: 1, id: rule, key: "v1|typescript|SourceFile|declaration-equals|equals>call-open-paren>call-comma{i}>call-arg{i}>call-comma{i}>call-arg{i}>call-close-paren>semicolon", pattern: "DEFINE", status: "approved", scope: "**/*.ts", examples: ids, versions: APPROVAL_VERSIONS, approvedBy: "synthetic-test-approver", date: "2026-10-21", layer: "project" }],
		examples    : new Map(examples.map(example => [example.id, example])),
		decisions   : new Map([[rule, { schemaVersion: 1, id: rule, kind: "rule", layer: "convention", ref: "docs/rules.md#Synthetic rule", docHash: sectionHash(document, "Synthetic rule"), examples: ids, approvedBy: "synthetic-test-approver", date: "2026-10-21" }]]),
	};
}

test("real vertical candidates are refused by Align preview and apply, while legacy format retains its behavior", () => {
	const source = "const a = pair(alpha, tiny, gamma);\nconst bb = pair(alpha, small, gamma);\nconst cc = pair(alpha, short, gamma);\nconst dd = pair(alpha, veryLongSecondArgumentHereForVerticalLayout, gamma);\n";
	const { target, options } = fixture("typescript", source);
	const registry = verticalRegistry(options.root);
	// Isolate TypeScript server state, as separate CLI invocations do.
	const script = `
		import { runFormatPipeline } from ${JSON.stringify(join(import.meta.dir, "../product/engine/common/format-pipeline.ts"))};
		import { documentResolver } from ${JSON.stringify(join(import.meta.dir, "../product/engine/common/approval-gate.ts"))};
		const options = JSON.parse(process.argv[1]);
		options.registry.examples = new Map(options.registry.examples);
		options.registry.decisions = new Map(options.registry.decisions);
		options.resolveDocument = documentResolver(options.root);
		try { console.log(JSON.stringify(await runFormatPipeline(options))); }
		catch (error) { console.error(error.message); process.exitCode = 1; }
	`;
	const invoke = (alignmentOnly: boolean, dryRun: boolean) => Bun.spawnSync([
		process.execPath, "--eval", script, JSON.stringify({
			...options, alignmentOnly, dryRun,
			registry: { ...registry, examples: [...registry.examples], decisions: [...registry.decisions] },
		}),
	], { timeout: 20_000 });

	for (const dryRun of [true, false]) {
		const child = invoke(true, dryRun);

		expect(child.exitCode                                                    ).toBe     (1                       ) ;
		expect(child.stderr.toString()                                           ).toContain("alignment-only refusal") ;
		expect(readFileSync(target, "utf8")                                      ).toBe     (source                  ) ;
		expect(readdirSync(options.root).filter(name => name.includes("boxbox-"))).toEqual  ([]                      ) ;
	}
	const preview = invoke(false, true);

	expect(preview.stderr.toString()).toBe("");
	expect(preview.exitCode).toBe(0);
	expect(JSON.parse(preview.stdout.toString()).alignmentEdits).toBeUndefined();
	expect(readFileSync(target, "utf8")).toBe(source);
	const applied = invoke(false, false);

	expect(applied.stderr.toString()                      ).toBe           (""                       ) ;
	expect(applied.exitCode                               ).toBe           (0                        ) ;
	expect(readFileSync(target, "utf8").split("\n").length).toBeGreaterThan(source.split("\n").length) ;
}, 60_000);
