import      { afterEach, describe, expect, test } from "bun:test"                  ;
import      {
              existsSync                      ,
              lstatSync                       ,
              mkdirSync                       ,
              mkdtempSync                     ,
              readFileSync                    ,
              rmSync                          ,
              symlinkSync                     ,
              writeFileSync                   ,
                                                } from "node:fs"                   ;
import      { join, resolve                     } from "node:path"                 ;

import      { APPROVAL_VERSIONS                 } from "@/common/approval-gate.ts" ;
import      { contentHashOf, sectionHash        } from "@/common/examples.ts"      ;
import      { lookupKeyOf                       } from "@/common/signature.ts"     ;

const repository           = resolve(import.meta.dir, "..")               ;
const cli                  = resolve(repository, "product/engine/cli.ts") ;
const workspaces: string[] = []                                           ;

interface Invocation {
	readonly status : number ;
	readonly stdout : string ;
	readonly stderr : string ;
}

afterEach(() => {
	for (const workspace of workspaces.splice(0)) rmSync(workspace, { recursive: true, force: true });
});

function workspace(): string {
	const path = mkdtempSync(join(import.meta.dir, "cli-"));
	workspaces.push(path);
	return path;
}

function invoke(root: string, args: readonly string[], environment: Record<string, string> = {}): Invocation {
	const source = `import { runCli } from ${JSON.stringify(cli)}; process.exitCode = await runCli(JSON.parse(process.env.BOXBOX_TEST_ARGS!), process.cwd());`;
	const result = Bun.spawnSync([process.execPath, "-e", source], {
		cwd    : root,
		env    : { ...process.env, ...environment, BOXBOX_TEST_ARGS: JSON.stringify(args) },
		stdout : "pipe",
		stderr : "pipe",
	});
	return { status: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

function pythonFixture(root: string): string {
	const path = join(root, "table.py");
	writeFileSync(path, "short = 1\nlong_name = 2\nx = 3\n");
	return path;
}

function approvedPythonProject(root: string): void {
	const directory = join(root     , ".boxbox"      ) ;
	const docs      = join(directory, "docs"         ) ;
	const formatter = join(root     , "formatter.mjs") ;
	mkdirSync(docs, { recursive: true });
	writeFileSync(formatter, `import { readFileSync, writeFileSync } from "node:fs"; const file=process.argv[2]; writeFileSync(file, readFileSync(file,"utf8").replace(/\\s*=\\s*/gu," = "));\n`);
	writeFileSync(join(directory, "config.json"), `${JSON.stringify({
		schemaVersion : 2,
		languages     : ["python"],
		formatters    : { python: { command: process.execPath, args: [formatter, "{file}"], timeoutMs: 5_000 } },
	}, null, 2)}\n`);
	const key            = lookupKeyOf("python", undefined, "table", ["name", "equal", "value"]) ;
	const document       = "# Test rules\n\n## Python table\nTest approval rule\n"               ;
	const positiveBefore = "a = 1\nlonger = 2\nmid = 3"                                          ;
	const positiveAfter  = "a      = 1\nlonger = 2\nmid    = 3"                                  ;
	const counterBefore  = "single = 1"                                                          ;
	const counterAfter   = "single       = 1"                                                    ;
	const example = (id: string, before: string, after: string, verdict: "after-better" | "bad") => ({
		schemaVersion: 1, id, status: "approved", versions: APPROVAL_VERSIONS, language: "python", regime: "table", patterns: ["DEFINE"], rules: ["test-python-table"],
		before, after, contentHash: contentHashOf(before, after), verdict, asserts: { after: {} }, source: { kind: "synthetic", license: "test" }, approvedBy: "test-approver", date: "2026-10-04",
	});
	const convention = {
		schemaVersion: 1, id: "test-python-table", key, pattern: "DEFINE", status: "approved", scope: "**", examples: ["test-positive", "test-counter"],
		versions: APPROVAL_VERSIONS, approvedBy: "test-approver", date: "2026-10-04",
	};
	const decision = {
		schemaVersion: 1, id: "test-python-table", kind: "rule", layer: "convention", ref: ".boxbox/docs/rules.md#Python table", docHash: sectionHash(document, "Python table"),
		examples: ["test-positive", "test-counter"], approvedBy: "test-approver", date: "2026-10-04",
	};
	writeFileSync(join(docs, "rules.md"), document);
	writeFileSync(join(directory, "conventions.jsonl"), `${JSON.stringify(convention)}\n`);
	writeFileSync(join(directory, "examples.jsonl"), `${JSON.stringify(example("test-positive", positiveBefore, positiveAfter, "after-better"))}\n${JSON.stringify(example("test-counter", counterBefore, counterAfter, "bad"))}\n`);
	writeFileSync(join(directory, "decisions.jsonl"), `${JSON.stringify(decision)}\n`);
}

describe("public CLI", () => {
	test("help and version work through the real entry API", () => {
		const root    = workspace()                 ;
		const help    = invoke(root, ["--help"])    ;
		const version = invoke(root, ["--version"]) ;
		expect(help.status          ).toBe     (0               ) ;
		expect(help.stdout          ).toContain("Usage: boxbox" ) ;
		expect(help.stdout          ).toContain("exactly one"   ) ;
		expect(version.status       ).toBe     (0               ) ;
		expect(version.stdout.trim()).toBe     ("0.2.2"         ) ;
	});

	test("init preserves existing user files and never overwrites the config when rerun", () => {
		const root = workspace();
		mkdirSync(join(root, ".boxbox"));
		writeFileSync(join(root, ".boxbox", "notes.txt"), "mine\n");
		const first      = invoke(root, ["init", "--json"])     ;
		const configPath = join(root, ".boxbox", "config.json") ;
		const initial    = readFileSync(configPath, "utf8")     ;
		const second     = invoke(root, ["init", "--json"])     ;
		expect(first.status                                            ).toBe(0         ) ;
		expect(second.status                                           ).toBe(0         ) ;
		expect(JSON.parse(first.stdout).created                        ).toBe(true      ) ;
		expect(JSON.parse(second.stdout).created                       ).toBe(false     ) ;
		expect(readFileSync(configPath, "utf8")                        ).toBe(initial   ) ;
		expect(readFileSync(join(root, ".boxbox", "notes.txt"), "utf8")).toBe("mine\n"  ) ;
	});

	test("a corrupt or unknown config fails explicitly and is preserved", () => {
		const root = workspace();
		mkdirSync(join(root, ".boxbox"));
		const config = join(root, ".boxbox", "config.json");
		writeFileSync(config, "{broken\n");
		const malformed = invoke(root, ["init", "--json"]);
		expect(malformed.status                          ).toBe     (2               ) ;
		expect(JSON.parse(malformed.stdout).error.message).toContain("malformed JSON") ;
		expect(readFileSync(config, "utf8")              ).toBe     ("{broken\n"     ) ;
		writeFileSync(config, JSON.stringify({ schemaVersion: 1, languages: ["python"], future: true }));
		const unknown = invoke(root, ["doctor", "--json"]);
		expect(unknown.status).toBe(1);
		expect(JSON.parse(unknown.stdout).checks.config.detail).toContain("unsupported config option");
	});

	test("check inspects one Python file read-only without init and returns 1 when misaligned", () => {
		const root   = workspace()                                             ;
		const path   = pythonFixture(root)                                     ;
		const before = readFileSync(path, "utf8")                              ;
		const result = invoke(root, ["check", "--file", "table.py", "--json"]) ;
		const value  = JSON.parse(result.stdout)                               ;
		expect(result.status                      ).toBe           (1       ) ;
		expect(value.results[0].language          ).toBe           ("python") ;
		expect(value.results[0].summary.misaligned).toBeGreaterThan(0       ) ;
		expect(readFileSync(path, "utf8")         ).toBe           (before  ) ;
		expect(existsSync(join(root, ".boxbox"))  ).toBe           (false   ) ;
	});

	test("a clean project previews and formats with the bundled approval and no formatter", () => {
		const root    = workspace()                                             ;
		const path    = pythonFixture(root)                                     ;
		const before  = readFileSync(path)                                      ;
		const checked = invoke(root, ["check", "--file", "table.py", "--json"]) ;
		expect(JSON.parse(checked.stdout).formatReadiness).toMatchObject({ mode: "standalone", approvalEligible: true, verification: "not-run" });
		const preview = invoke(root, ["format", "--file", "table.py", "--dry-run", "--json"]);
		expect(preview.status                   ).toBe         (0                                                                                                                            ) ;
		expect(JSON.parse(preview.stdout)       ).toMatchObject({ formatMode: "standalone", formatterExecuted: false, formatter: null, written: false, approvals: ["py-simple-assignments"] }) ;
		expect(readFileSync(path).equals(before)).toBe         (true                                                                                                                         ) ;
		const formatted = invoke(root, ["format", "--file", "table.py", "--json"]);
		expect(formatted.status                    ).toBe(0    ) ;
		expect(JSON.parse(formatted.stdout).written).toBe(true ) ;
		expect(existsSync(join(root, ".boxbox"))   ).toBe(false) ;
	});

	test("with a verified test approval and formatter, GUIDE, dry-run and the real format use the same pipeline", () => {
		const root = workspace()         ;
		const path = pythonFixture(root) ;
		approvedPythonProject(root);
		const before     = readFileSync(path, "utf8")                              ;
		const guide      = invoke(root, ["guide", "--file", "table.py", "--json"]) ;
		const guideValue = JSON.parse(guide.stdout)                                ;
		expect(guide.status          )    .toBe        (0                    ) ;
		expect(guideValue.conventions)    .toEqual     (["test-python-table"]) ;
		expect(guideValue.guides     )    .toHaveLength(1                    ) ;
		expect(guide.stdout          ).not.toContain   ("test-counter"       ) ;
		const preview      = invoke(root, ["format", "--file", "table.py", "--dry-run", "--json"]) ;
		const previewValue = JSON.parse(preview.stdout)                                            ;
		expect(preview.status                ).toBe(0     ) ;
		expect(previewValue.formatterExecuted).toBe(true  ) ;
		expect(previewValue.formatEligible   ).toBe(true  ) ;
		expect(previewValue.fixedPoint       ).toBe(true  ) ;
		expect(previewValue.written          ).toBe(false ) ;
		expect(readFileSync(path, "utf8")    ).toBe(before) ;
		const formatted      = invoke(root, ["format", "--file", "table.py", "--json"]) ;
		const formattedValue = JSON.parse(formatted.stdout)                             ;
		expect(formatted.status          )    .toBe   (0                    ) ;
		expect(formattedValue.written    )    .toBe   (true                 ) ;
		expect(formattedValue.approvals  )    .toEqual(["test-python-table"]) ;
		expect(readFileSync(path, "utf8")).not.toBe   (before               ) ;
		const check = invoke(root, ["check", "--file", "table.py", "--json"]);
		expect(check.status).toBe(0);
	});

	test("standalone CLI alignment needs approval but no external formatter", () => {
		const root = workspace()         ;
		const path = pythonFixture(root) ;
		approvedPythonProject(root);
		writeFileSync(join(root, ".boxbox/config.json"), JSON.stringify({ schemaVersion: 2 }));
		const checked = invoke(root, ["check", "--file", "table.py", "--json"]);
		expect(JSON.parse(checked.stdout).formatReadiness).toMatchObject({ mode: "standalone", approvalEligible: true, verification: "not-run", reasons: [] });
		const before  = readFileSync(path)                                                    ;
		const preview = invoke(root, ["format", "--file", "table.py", "--dry-run", "--json"]) ;
		expect(preview.status                   ).toBe         (0                                                                                                           ) ;
		expect(JSON.parse(preview.stdout)       ).toMatchObject({ formatterExecuted: false, formatter: null, formatMode: "standalone", written: false, boxboxChanged: true }) ;
		expect(readFileSync(path).equals(before)).toBe         (true                                                                                                        ) ;
		const formatted = invoke(root, ["format", "--file", "table.py", "--json"]);
		expect(formatted.status).toBe(0);
		expect(JSON.parse(formatted.stdout).written).toBe(true);
		const second = invoke(root, ["format", "--file", "table.py", "--json"]);
		expect(second.status).toBe(0);
		expect(JSON.parse(second.stdout).written).toBe(false);
		writeFileSync(join(root, ".boxbox/config.json"), JSON.stringify({ schemaVersion: 2, formatters: { python: { command: "boxbox-missing-formatter", args: ["{file}"] } } }));
		const output = readFileSync(path)                                       ;
		const broken = invoke(root, ["format", "--file", "table.py", "--json"]) ;
		expect(broken.status                          ).toBe     (2                     ) ;
		expect(JSON.parse(broken.stdout).error.message).toContain("executable not found") ;
		expect(readFileSync(path).equals(output)      ).toBe     (true                  ) ;
		const diagnostic = JSON.parse(invoke(root, ["doctor", "--json"]).stdout);
		expect(diagnostic.runtimeUsable          ).toBe     (true                  ) ;
		expect(diagnostic.formatConfigured       ).toBe     (false                 ) ;
		expect(diagnostic.checks.formatter.ok    ).toBe     (false                 ) ;
		expect(diagnostic.checks.formatter.detail).toContain("executable not found") ;
	});

	test("GUIDE uses the bundled preset but never exposes candidate overrides as guidance", () => {
		const root = workspace();
		pythonFixture(root);
		const empty = invoke(root, ["guide", "--file", "table.py", "--json"]);
		expect(empty.status).toBe(0);
		expect(JSON.parse(empty.stdout).conventions).toEqual(["py-simple-assignments"]);
		mkdirSync(join(root, ".boxbox"));
		writeFileSync(join(root, ".boxbox", "conventions.jsonl"), `${JSON.stringify({ schemaVersion: 1, id: "candidate-secret", key: lookupKeyOf("python", undefined, "table", ["name", "equal", "value"]), pattern: "DEFINE", status: "candidate", scope: "**", versions: APPROVAL_VERSIONS, approvedBy: "", date: "" })}\n`);
		const candidate = invoke(root, ["guide", "--file", "table.py", "--json"]);
		expect(candidate.status                   )    .toBe     (1                 ) ;
		expect(candidate.stdout                   ).not.toContain("candidate-secret") ;
		expect(JSON.parse(candidate.stdout).guides)    .toEqual  ([]                ) ;
	});

	test("candidate, rejected, conflict and stale approvals refuse format and preserve the original", () => {
		for (const scenario of ["candidate", "rejected", "conflict", "stale"] as const) {
			const root = workspace()         ;
			const path = pythonFixture(root) ;
			approvedPythonProject(root);
			const conventionPath = join(root, ".boxbox", "conventions.jsonl")                                  ;
			const decisionPath   = join(root, ".boxbox", "decisions.jsonl")                                    ;
			const convention     = JSON.parse(readFileSync(conventionPath, "utf8")) as Record<string, unknown> ;
			if (scenario === "candidate") convention.status = "candidate";
			if (scenario === "rejected") convention.status = "rejected";
			if (scenario === "conflict") writeFileSync(conventionPath, `${JSON.stringify(convention)}\n${JSON.stringify({ ...convention, id: "test-python-table-conflict" })}\n`);
			else writeFileSync(conventionPath, `${JSON.stringify(convention)}\n`);
			if (scenario === "stale") {
				const decision = JSON.parse(readFileSync(decisionPath, "utf8")) as Record<string, unknown>;
				writeFileSync(decisionPath, `${JSON.stringify({ ...decision, docHash: "sha256:stale" })}\n`);
			}
			const before = readFileSync(path, "utf8")                               ;
			const result = invoke(root, ["format", "--file", "table.py", "--json"]) ;
			expect(result.status, scenario).toBe(2);
			expect(JSON.parse(result.stdout).error.code).toBe("FORMAT_NOT_ELIGIBLE");
			expect(readFileSync(path, "utf8"), scenario).toBe(before);
		}
	});

	test("doctor refuses a missing Python even when the bundled approval data is present", () => {
		const root   = workspace()                                                               ;
		const result = invoke(root, ["doctor", "--json"], { PATH: "/definitely/no/tools/here" }) ;
		const value  = JSON.parse(result.stdout)                                                 ;
		expect(result.status                  ).toBe           (1                   ) ;
		expect(value.checks.python.ok         ).toBe           (false               ) ;
		expect(value.checks.config.ok         ).toBe           (true                ) ;
		expect(value.checks.config.detail     ).toContain      ("inherited defaults") ;
		expect(value.checks.config.fingerprint).toMatch        (/^sha256:/          ) ;
		expect(value.checks.config.layers     ).toHaveLength   (4                   ) ;
		expect(value.checks.approval.ok       ).toBe           (true                ) ;
		expect(value.limitations.length       ).toBeGreaterThan(0                   ) ;
	});

	test("doctor separates runnable state, format configuration and overall release readiness", () => {
		const root   = workspace()                        ;
		const result = invoke(root, ["doctor", "--json"]) ;
		const value  = JSON.parse(result.stdout)          ;
		expect(result.status         ).toBe(0    ) ;
		expect(value.ok              ).toBe(true ) ;
		expect(value.runtimeUsable   ).toBe(true ) ;
		expect(value.formatConfigured).toBe(true ) ;
		expect(value.releaseReady    ).toBe(false) ;
	});

	test("usage errors still print exactly one JSON to stdout and refuse unknown languages and options", () => {
		const root = workspace();
		pythonFixture(root);
		for (const args of [
			["check", "--file", "--json"],
			["check", "--file", "table.py", "--language", "ruby", "--json"],
			["check", "--file", "table.py", "--write", "--json"],
		]) {
			const result = invoke(root, args);
			expect(result.status).toBe(2);
			expect(() => JSON.parse(result.stdout)).not.toThrow();
			expect(result.stdout.trim().split("\n")).toHaveLength(1);
		}
	});

	test("refuses path escapes and symbolic links for init writes", () => {
		const root    = workspace() ;
		const outside = workspace() ;
		writeFileSync(join(outside, "outside.py"), "a = 1\n");
		const escaped = invoke(root, ["check", "--file", "../outside.py", "--json"]);
		expect(escaped.status).toBe(2);
		expect(JSON.parse(escaped.stdout).error.code).toBe("PATH_ESCAPE");
		mkdirSync(join(outside, "real-boxbox"));
		symlinkSync(join(outside, "real-boxbox"), join(root, ".boxbox"));
		const linked = invoke(root, ["init", "--json"]);
		expect(linked.status                                    ).toBe     (2        ) ;
		expect(JSON.parse(linked.stdout).error.message          ).toContain("symlink") ;
		expect(lstatSync(join(root, ".boxbox")).isSymbolicLink()).toBe     (true     ) ;
	});

	test("refuses parent-directory symbolic link escapes and languages disabled in the config", () => {
		const root    = workspace() ;
		const outside = workspace() ;
		writeFileSync(join(outside, "outside.py"), "a = 1\n");
		symlinkSync(outside, join(root, "linked"));
		const escaped = invoke(root, ["check", "--file", "linked/outside.py", "--json"]);
		expect(escaped.status).toBe(2);
		expect(JSON.parse(escaped.stdout).error.code).toBe("PATH_ESCAPE");
		mkdirSync(join(root, ".boxbox"));
		writeFileSync(join(root, ".boxbox", "config.json"), JSON.stringify({ schemaVersion: 1, languages: ["typescript"] }));
		writeFileSync(join(root, "local.py"), "a = 1\n");
		const disabled = invoke(root, ["check", "--file", "local.py", "--json"]);
		expect(disabled.status).toBe(2);
		expect(JSON.parse(disabled.stdout).error.code).toBe("LANGUAGE_DISABLED");
	});

	test("fails when the explicit language differs from the extension and infers the language for TS files", () => {
		const root = workspace();
		writeFileSync(join(root, "a.ts"), "const a = 1;\n");
		const mismatch = invoke(root, ["check", "--file", "a.ts", "--language", "python", "--json"]);
		expect(mismatch.status).toBe(2);
		expect(JSON.parse(mismatch.stdout).error.code).toBe("LANGUAGE_MISMATCH");
		const inferred = invoke(root, ["check", "--file", "a.ts", "--json"]);
		expect(inferred.status).toBe(0);
		expect(JSON.parse(inferred.stdout).results[0].language).toBe("typescript");
	});
});
