import { afterEach, expect, test } from "bun:test";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { preparedPipelineContext } from "@/00_cli.ts";
import { APPROVAL_VERSIONS } from "@/common/18_approval-gate.ts";
import { contentHashOf, sectionHash } from "@/common/17_examples.ts";
import { runFormatPipeline } from "@/common/21_format-pipeline.ts";

const roots: string[] = []                                                             ;
const SOURCE          = "a=1\nlonger=22\nmid=333\n"                                    ;
const PROOF           = "# Rules\n\n## Table alignment\nRule approved only in tests\n" ;

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(mutate: boolean) {
	const root = mkdtempSync(join(tmpdir(), "boxbox-proof-snapshot-"));
	roots.push(root);
	for (const name of ["src", "docs", ".boxbox"]) mkdirSync(join(root, name));
	writeFileSync(join(root, "docs/rules.md"), PROOF);
	writeFileSync(join(root, "src/a.py"), SOURCE);
	chmodSync(join(root, "src/a.py"), 0o640);

	const id    = "snapshot-test-rule"                                      ;
	const human = { approvedBy: "synthetic-test-only", date: "2026-11-16" } ;
	const examples = ["after-better", "bad"].map((verdict, index) => ({
		schemaVersion: 1, id: `${id}-${index}`, status: "approved", versions: APPROVAL_VERSIONS,
		language: "python", regime: "table", patterns: ["DEFINE"], rules: [id], before: "a=1", after: "a = 1",
		contentHash: contentHashOf("a=1", "a = 1"), verdict, asserts: { after: {} }, source: { kind: "synthetic", license: "test" }, ...human,
	}));
	const links      = examples.map(example => example.id)                                                                                                                                                   ;
	const convention = { schemaVersion: 1, id, key: "v1|python|-|table|name>equal>value", pattern: "DEFINE", status: "approved", scope: "src/a.py", examples: links, versions: APPROVAL_VERSIONS, ...human } ;
	const decision   = { schemaVersion: 1, id, kind: "rule", layer: "convention", ref: "docs/rules.md#Table alignment", docHash: sectionHash(PROOF, "Table alignment"), examples: links, ...human }          ;

	for (const [name, records] of [["conventions", [convention]], ["decisions", [decision]], ["examples", examples]] as const) {
		writeFileSync(join(root, `.boxbox/${name}.jsonl`), records.map(record => JSON.stringify(record)).join("\n") + "\n");
	}

	const script = join(root, "formatter.mjs");
	writeFileSync(script, `import { appendFileSync, readFileSync, statSync, utimesSync, writeFileSync } from "node:fs";
const file = process.argv[2];
appendFileSync(${JSON.stringify(join(root, "formatter-calls"))}, "called\\n");
if (${mutate}) {
 const proof = ${JSON.stringify(join(root, "docs/rules.md"))};
 const before = statSync(proof);
 writeFileSync(proof, readFileSync(proof, "utf8").replace("approved", "rejected"));
 utimesSync(proof, before.atime, before.mtime);
}
writeFileSync(file, readFileSync(file, "utf8").replace(/[ \\t]*=[ \\t]*/gu, " = "));
`);
	return { root, formatter: { command: process.execPath, args: [script, "{file}"], timeoutMs: 5_000 } };
}

test("a stable captured proof still permits the complete formatter and alignment pipeline", async () => {
	const { root, formatter } = fixture(false);
	const result = await runFormatPipeline({ ...preparedPipelineContext(root), root, file: "src/a.py", language: "python", formatter });

	expect(result.written                              )    .toBe(true  ) ;
	expect(result.fixedPoint                           )    .toBe(true  ) ;
	expect(readFileSync(join(root, "src/a.py"), "utf8")).not.toBe(SOURCE) ;
});

test("a proof changed before pipeline entry is rejected before the formatter runs", async () => {
	const { root, formatter } = fixture(false);
	const context = preparedPipelineContext(root);

	writeFileSync(join(root, "docs/rules.md"), PROOF.replace("approved", "rejected"));

	await expect(runFormatPipeline({ ...context, root, file: "src/a.py", language: "python", formatter })).rejects.toThrow("provenance changed after preparation");

	expect(existsSync(join(root, "formatter-calls"))).toBe(false);
	expect(readFileSync(join(root, "src/a.py"), "utf8")).toBe(SOURCE);
});

test("the atomic commit boundary revalidates proof changed after both formatter cycles", async () => {
	const { root, formatter } = fixture(false);
	const target  = join(root, "src/a.py")        ;
	const before  = lstatSync(target)             ;
	const context = preparedPipelineContext(root) ;
	let commits   = 0                             ;

	await expect(runFormatPipeline({ ...context, root, file: "src/a.py", language: "python", formatter, beforeCommit: () => {
		commits += 1;
		writeFileSync(join(root, "docs/rules.md"), PROOF.replace("approved", "rejected"));
	} })).rejects.toThrow("provenance changed after preparation");

	expect(commits                                                               ).toBe        (1          ) ;
	expect(readFileSync(join(root, "formatter-calls"), "utf8").trim().split("\n")).toHaveLength(2          ) ;
	expect(readFileSync(target, "utf8")                                          ).toBe        (SOURCE     ) ;
	expect(lstatSync(target).ino                                                 ).toBe        (before.ino ) ;
	expect(lstatSync(target).mode                                                ).toBe        (before.mode) ;
	expect(readdirSync(join(root, "src"))                                        ).toEqual     (["a.py"]   ) ;
});

test("fresh provenance covers a winning user proof when a project convention has the same id", async () => {
	const { root, formatter } = fixture(false);
	const configHome   = join(root, "user-config")                      ;
	const userRoot     = join(configHome, "boxbox")                     ;
	const userProof    = join(userRoot, "docs/rules.md")                ;
	const registryFile = join(root, ".boxbox/conventions.jsonl")        ;
	const convention   = JSON.parse(readFileSync(registryFile, "utf8")) ;
	const previous     = process.env.XDG_CONFIG_HOME                    ;

	mkdirSync(join(userRoot, "docs"), { recursive: true });
	writeFileSync(join(userRoot, "config.json"), JSON.stringify({ schemaVersion: 2 }));
	writeFileSync(userProof, PROOF);
	writeFileSync(registryFile, JSON.stringify({ ...convention, scope: "src/other.py" }) + "\n");
	writeFileSync(join(userRoot, "conventions.jsonl"), JSON.stringify(convention) + "\n");
	const script = formatter.args[0]!                            ;
	const marker = JSON.stringify(join(root, "formatter-calls")) ;
	writeFileSync(script, readFileSync(script, "utf8")
		.replace("if (false) {", `if (readFileSync(${marker}, "utf8").trim().split("\\n").length === 2) {`)
		.replace(JSON.stringify(join(root, "docs/rules.md")), JSON.stringify(userProof)));
	process.env.XDG_CONFIG_HOME = configHome;
	try {
		const context = preparedPipelineContext(root);

		await expect(runFormatPipeline({ ...context, root, file: "src/a.py", language: "python", formatter })).rejects.toThrow("provenance changed after preparation");

		expect(readFileSync(userProof, "utf8")).toBe(PROOF.replace("approved", "rejected"));
		expect(readFileSync(join(root, "src/a.py"), "utf8")).toBe(SOURCE);
	} finally {
		if (previous === undefined) delete process.env.XDG_CONFIG_HOME;
		else process.env.XDG_CONFIG_HOME = previous;
	}
});

for (const dryRun of [false, true]) test(`fresh provenance rejects same-size proof drift during formatter execution (dryRun=${dryRun})`, async () => {
	const { root, formatter } = fixture(true);
	const target  = join                   (root, "src/a.py") ;
	const before  = lstatSync              (target          ) ;
	const context = preparedPipelineContext(root            ) ;

	await expect(runFormatPipeline({ ...context, root, file: "src/a.py", language: "python", formatter, dryRun })).rejects.toThrow("provenance changed after preparation");

	expect(readFileSync(join(root, "formatter-calls"), "utf8").trim().split("\n")).toHaveLength(2                                    ) ;
	expect(readFileSync(join(root, "docs/rules.md"), "utf8")                     ).toBe        (PROOF.replace("approved", "rejected")) ;
	expect(readFileSync(target, "utf8")                                          ).toBe        (SOURCE                               ) ;
	expect(lstatSync(target).ino                                                 ).toBe        (before.ino                           ) ;
	expect(lstatSync(target).mode                                                ).toBe        (before.mode                          ) ;
	expect(readdirSync(join(root, "src"))                                        ).toEqual     (["a.py"]                             ) ;
});
