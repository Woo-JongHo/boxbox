import      { afterEach, expect, test    } from "bun:test"                     ;
import      {
              mkdirSync                ,
              mkdtempSync              ,
              readFileSync             ,
              rmSync                   ,
              writeFileSync
                                         } from "node:fs"                      ;
import      { tmpdir                     } from "node:os"                      ;
import      { join, resolve              } from "node:path"                    ;
import      { APPROVAL_VERSIONS          } from "@/common/18_approval-gate.ts" ;
import      { contentHashOf, sectionHash } from "@/common/17_examples.ts"      ;

const roots: string[] = []                                                                                              ;
const cli             = resolve(import.meta.dir, "../product/engine/00_cli.ts")                                         ;
const key             = "v1|typescript|SourceFile|declaration-equals|equals>call-open-paren>call-close-paren>semicolon" ;
const control         = "const a=fn(1);\nconst longer=fn(22);\nconst mid=fn(333);\n"                                    ;
const source          = control + "interface Compact { a: string; b: number; c: boolean }\n"                            ;

function workspace(): string {
	const root      = mkdtempSync(join(tmpdir(), "boxbox-cli-recovery-"))              ;
	const directory = join(root, ".boxbox")                                            ;
	const document  = "# Rules\n\n## Test declaration\nSynthetic test approval only\n" ;
	roots.push(root);
	mkdirSync(directory);
	writeFileSync(join(root, "sample.ts"), source);
	writeFileSync(join(directory, "config.json"), JSON.stringify({ schemaVersion: 2, languages: ["typescript"] }));
	writeFileSync(join(root, "rules.md"), document);
	const examples = ["after-better", "bad"].map((verdict, index) => {
		const before = `before ${index}` ;
		const after  = `after ${index}`  ;
		return { schemaVersion: 1, id: `example-${index}`, status: "approved", versions: APPROVAL_VERSIONS, language: "typescript", regime: "table", patterns: ["DEFINE"], rules: ["test-rule"], before, after, contentHash: contentHashOf(before, after), verdict, asserts: { after: {} }, source: { kind: "synthetic", license: "test" }, approvedBy: "synthetic-test-approver", date: "2026-11-16" };
	});
	const ids        = examples.map(example => example.id)                                                                                                                                                                                                      ;
	const convention = { schemaVersion: 1, id: "test-rule", key, pattern: "DEFINE", status: "approved", scope: "**", examples: ids, versions: APPROVAL_VERSIONS, approvedBy: "synthetic-test-approver", date: "2026-11-16" }                                    ;
	const decision   = { schemaVersion: 1, id: "test-rule", kind: "rule", layer: "convention", ref: "rules.md#Test declaration", docHash: sectionHash(document, "Test declaration"), examples: ids, approvedBy: "synthetic-test-approver", date: "2026-11-16" } ;
	for (const [name, records] of [["conventions", [convention]], ["examples", examples], ["decisions", [decision]]] as const) writeFileSync(join(directory, `${name}.jsonl`), records.map(record => JSON.stringify(record)).join("\n") + "\n");
	return root;
}

function invoke(root: string, args: readonly string[]) {
	return Bun.spawnSync([process.execPath, "-e", `import { runCli } from ${JSON.stringify(cli)}; process.exitCode=await runCli(JSON.parse(process.env.BOXBOX_TEST_ARGS!));`], {
		cwd: root, env: { ...process.env, XDG_CONFIG_HOME: join(root, "user"), BOXBOX_TEST_ARGS: JSON.stringify(args) }, stdout: "pipe", stderr: "pipe",
	});
}

afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

test("public Align returns the approved compressed-member cause and structural owner without writing", () => {
	const root    = workspace ()                                                             ;
	const checked = invoke    (root, ["check", "--source", "--file", "sample.ts", "--json"]) ;
	const check   = JSON.parse(checked.stdout.toString()                                   ) ;
	expect(check.formatReadiness.approvalEligible).toBe(true);
	expect(check.formatReadiness.recovery.issues.some((issue: { category: string }) => issue.category === "structural-prerequisite")).toBe(true);
	for (const flags of [["--dry-run"], []]) {
		const preview = invoke    (root, ["align", "--file", "sample.ts", ...flags, "--json"]) ;
		const value   = JSON.parse(preview.stdout.toString()                                 ) ;
		expect(preview.exitCode                             )    .toBe         (2                                                                                                                             ) ;
		expect(value.error.code                             )    .toBe         ("ALIGN_NOT_ELIGIBLE"                                                                                                          ) ;
		expect(value.error.message                          )    .toContain    ("Write/Refactor"                                                                                                              ) ;
		expect(value.error.recovery                         )    .toMatchObject({ issues: [{ file: "sample.ts", startLine: 4, endLine: 4, category: "structural-prerequisite", owner: "agent" }], omitted: 0 }) ;
		expect(value.error.message                          ).not.toContain    ("boxbox-stage"                                                                                                                ) ;
		expect(readFileSync(join(root, "sample.ts"), "utf8"))    .toBe         (source                                                                                                                        ) ;
	}
	writeFileSync(join(root, "sample.ts"), control);
	const aligned = invoke(root, ["align", "--file", "sample.ts", "--json"]);
	expect(aligned.exitCode).toBe(0);
	expect(JSON.parse(aligned.stdout.toString()).written).toBe(true);
	const fixed = invoke(root, ["align", "--file", "sample.ts", "--json"]);
	expect(fixed.exitCode).toBe(0);
	expect(JSON.parse(fixed.stdout.toString()).written).toBe(false);
}, 60_000);

test("rejected automatic approval reports its exact location and key while authoring stays independently authorized", () => {
	const root       = workspace ()                                                              ;
	const convention = JSON.parse(readFileSync(join(root, ".boxbox/conventions.jsonl"), "utf8")) ;
	writeFileSync(join(root, ".boxbox/conventions.jsonl"), JSON.stringify({ ...convention, status: "rejected" }) + "\n");
	const preview = invoke    (root, ["align", "--file", "sample.ts", "--dry-run", "--json"]) ;
	const value   = JSON.parse(preview.stdout.toString()                                    ) ;
	expect(preview.exitCode                             ).toBe         (2                                                                      ) ;
	expect(value.error.recovery.issues[0].next          ).toContain    ("Continue independently authorized Write/Refactor"                     ) ;
	expect(value.error.recovery.issues[0]               ).toMatchObject({ category: "approval", key, startLine: 1, endLine: 3, owner: "human" }) ;
	expect(readFileSync(join(root, "sample.ts"), "utf8")).toBe         (source                                                                 ) ;
}, 60_000);

test("batch formatting and canonical Check preserve structured recovery and completed per-file writes", () => {
	const root = workspace();
	writeFileSync(join(root, "control.ts"), control);
	const batch = invoke    (root, ["format", "--file", "control.ts", "--file", "sample.ts", "--json"]) ;
	const value = JSON.parse(batch.stdout.toString()                                                  ) ;
	expect(batch.exitCode                               ).toBe         (2                                                                       ) ;
	expect(value.results[0].result.written              ).toBe         (true                                                                    ) ;
	expect(value.results[1].recovery.issues[0]          ).toMatchObject({ file: "sample.ts", startLine: 4, category: "structural-prerequisite" }) ;
	expect(readFileSync(join(root, "sample.ts"), "utf8")).toBe         (source                                                                  ) ;
	const formatter = join(root, "formatter.mjs");
	writeFileSync(formatter, "process.exit(0);\n");
	writeFileSync(join(root, ".boxbox/config.json"), JSON.stringify({ schemaVersion: 2, languages: ["typescript"], formatters: { typescript: { command: process.execPath, args: [formatter, "{file}"], timeoutMs: 5000 } } }));
	const checked = invoke    (root, ["check", "--file", "sample.ts", "--json"]) ;
	const report  = JSON.parse(checked.stdout.toString()                       ) ;
	expect(checked.exitCode                             ).toBe         (2                                                                       ) ;
	expect(report.canonical.verification                ).toBe         ("failed"                                                                ) ;
	expect(report.canonical.recovery.issues[0]          ).toMatchObject({ file: "sample.ts", startLine: 4, category: "structural-prerequisite" }) ;
	expect(readFileSync(join(root, "sample.ts"), "utf8")).toBe         (source                                                                  ) ;
}, 60_000);
