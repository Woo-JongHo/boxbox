import      {
              afterAll      ,
              beforeAll     ,
              describe      ,
              expect        ,
              test
                              } from "bun:test"                ;
import      {
              chmodSync     ,
              cpSync        ,
              existsSync    ,
              mkdirSync     ,
              mkdtempSync   ,
              readFileSync  ,
              readdirSync   ,
              rmSync        ,
              writeFileSync ,
                              } from "node:fs"                 ;
import      { spawnSync       } from "node:child_process"      ;
import      { tmpdir          } from "node:os"                 ;
import      { join, resolve   } from "node:path"               ;

import type { FileResult      } from "@/common/result-json.ts" ;

interface CheckReport {
	readonly schemaVersion : number                                                                                      ;
	readonly results       : readonly FileResult[]                                                                       ;
	readonly syntax        : { readonly status: string; readonly tool: string; readonly diagnostics: readonly string[] } ;
	readonly formatReadiness : {
		readonly approvalEligible : boolean                                                                                                                       ;
		readonly verification     : string                                                                                                                        ;
		readonly approvalFacts    : readonly { readonly key: string; readonly status: string; readonly proofComplete: boolean; readonly conventionId?: string }[] ;
		readonly reasons          : readonly string[]                                                                                                             ;
	} ;
}

interface AlignReport {
	readonly written                  : boolean                                                                               ;
	readonly fixedPoint               : boolean                                                                               ;
	readonly boxboxChanged            : boolean                                                                               ;
	readonly horizontalWhitespaceOnly : boolean                                                                               ;
	readonly formatterExecuted        : boolean                                                                               ;
	readonly approvals                : readonly string[]                                                                     ;
	readonly alignmentEdits           : readonly { readonly line: number; readonly before: string; readonly after: string }[] ;
}

const root       = resolve(import.meta.dir, "..")                                                              ;
const sandbox    = mkdtempSync(join(tmpdir(), "boxbox-python-journeys-"))                                      ;
const artifact   = join(sandbox, "artifact")                                                                   ;
const executable = join(artifact, "dist/cli.js")                                                               ;
const source     = "first = 7\nlonger_name = 11\nmid = 13\n\nprint(first + longer_name + mid)\n"               ;
const aligned    = "first       = 7\nlonger_name = 11\nmid         = 13\n\nprint(first + longer_name + mid)\n" ;
let node: string                                                                                               ;

function run(command: string, args: readonly string[], cwd: string, env: NodeJS.ProcessEnv = {}, input?: string) {
	return spawnSync(command, args, {
		cwd   ,
		input ,
		env      : { ...process.env, XDG_CONFIG_HOME: join(sandbox, "user-config"), CLAUDE_PLUGIN_DATA: "", PLUGIN_DATA: "", ...env } ,
		encoding : "utf8"                                                                                                             ,
		timeout  : 30_000                                                                                                             ,
	});
}

function expectStatus(result: ReturnType<typeof run>, status: number): void {
	expect(result.error).toBeUndefined();
	expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(status);
}

function cli<T>(project: string, args: readonly string[], status: number, env: NodeJS.ProcessEnv = {}): T {
	const result = run(node, [executable, ...args, "--json"], project, env);

	expectStatus(result, status);
	return JSON.parse(result.stdout) as T;
}

function projectWith(name: string, content: string): string {
	const project = mkdtempSync(join(sandbox, "project-"));

	writeFileSync(join(project, name), content);
	return project;
}

function executePython(project: string, file: string): string {
	const result = run("python3", ["-I", file], project);

	expectStatus(result, 0);
	return result.stdout;
}

beforeAll(() => {
	const runtime = run("node", ["-p", "process.execPath"], root);

	expectStatus(runtime, 0);
	node = runtime.stdout.trim();
	expectStatus(run(process.execPath, ["run", "development/tools/build-cli-artifact.ts"], root), 0);
	cpSync(join(root, "dist/cli"), artifact, { recursive: true });
	mkdirSync(join(artifact, "node_modules"));
	cpSync(join(root, "node_modules/typescript"), join(artifact, "node_modules/typescript"), { recursive: true, dereference: true });
	expectStatus(run(node, ["-e", "if (process.versions.bun) process.exit(1)"], sandbox), 0);
}, 60_000);

afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

describe("Python public Node CLI user journeys", () => {
	test("first Check reports real findings without init, then preview, apply and recheck preserve execution", () => {
		const project = projectWith("invoice.py", source)                                                                                                ;
		const target  = join(project, "invoice.py")                                                                                                      ;
		const before  = executePython(project, "invoice.py")                                                                                             ;
		const doctor  = cli<{ readonly runtimeUsable: boolean; readonly checks: { readonly python: { readonly ok: boolean } } }>(project, ["doctor"], 0) ;
		const checked = cli<CheckReport>(project, ["check", "--file", "invoice.py"], 1)                                                                  ;

		expect(doctor.runtimeUsable   ).toBe   (true                                                 ) ;
		expect(doctor.checks.python.ok).toBe   (true                                                 ) ;
		expect(checked.schemaVersion  ).toBe   (1                                                    ) ;
		expect(checked.syntax         ).toEqual({ status: "valid", tool: "python3", diagnostics: [] }) ;
		expect(checked.results[0]).toMatchObject({
			language: "python", mode: "check", summary: { groups: 1, misaligned: 1, refused: 0 },
			groups: [{ startLine: 1, endLine: 3, rows: 3, axes: ["name", "equal", "value"], state: "FIXABLE" }],
			parse: { status: "not-run" },
		});
		expect(checked.formatReadiness).toMatchObject({
			approvalEligible: true, verification: "not-run",
			approvalFacts: [{ conventionId: "py-simple-assignments", status: "approved", proofComplete: true }],
		});
		expect(readFileSync(target, "utf8")).toBe(source);
		expect(readdirSync(project)).toEqual(["invoice.py"]);

		const preview = cli<AlignReport>(project, ["align", "--file", "invoice.py", "--dry-run"], 0);

		expect(preview).toMatchObject({ written: false, fixedPoint: true, horizontalWhitespaceOnly: true, formatterExecuted: false, approvals: ["py-simple-assignments"] });
		expect(preview.alignmentEdits).toEqual([
			{ line: 1, before: "first = 7", after: "first       = 7" },
			{ line: 3, before: "mid = 13", after: "mid         = 13" },
		]);
		expect(readFileSync(target, "utf8")).toBe(source);

		const applied = cli<AlignReport>(project, ["align", "--file", "invoice.py"], 0) ;
		const recheck = cli<CheckReport>(project, ["check", "--file", "invoice.py"], 0) ;

		expect(applied                                                        ).toMatchObject({ written: true, fixedPoint: true, horizontalWhitespaceOnly: true }               ) ;
		expect(readFileSync(target, "utf8")                                   ).toBe         (aligned                                                                           ) ;
		expect(recheck.results[0]                                             ).toMatchObject({ summary: { groups: 1, misaligned: 0, refused: 0 }, groups: [{ state: "PASS" }] }) ;
		expect(executePython(project, "invoice.py")                           ).toBe         (before                                                                            ) ;
		expect(before                                                         ).toBe         ("31\n"                                                                            ) ;
		expect(cli<AlignReport>(project, ["align", "--file", "invoice.py"], 0)).toMatchObject({ written: false, boxboxChanged: false, fixedPoint: true }                        ) ;
		expect(readFileSync(target, "utf8")                                   ).toBe         (aligned                                                                           ) ;
		expect(existsSync(join(project, ".boxbox"))                           ).toBe         (false                                                                             ) ;
	});

	test("dictionary and annotation findings do not inherit simple-assignment write approval", () => {
		const cases = [
			{ name: "dictionary.py", content: 'options = {\n    "a":1,\n    "longer":2,\n    "mid":3,\n}\n', axes: ["key", "colon", "value", "comma"] },
			{ name: "annotations.py", content: "a: int = 1\nlonger: int = 2\nmid: int = 3\n", axes: ["name", "colon", "type", "equal", "value"] },
		];
		for (const { name, content, axes } of cases) {
			const project = projectWith(name, content)                              ;
			const checked = cli<CheckReport>(project, ["check", "--file", name], 1) ;

			expect(checked.syntax.status, name).toBe("valid");
			expect(checked.results[0]!.groups, name).toHaveLength(1);
			expect(checked.results[0]!.groups[0], name).toMatchObject({ state: "FIXABLE", rows: 3, axes });
			expect(checked.formatReadiness, name).toMatchObject({ approvalEligible: false, verification: "not-run", approvalFacts: [{ status: "unknown", proofComplete: false }] });
			for (const extra of [["--dry-run"], []]) {
				const denied = cli<{ readonly ok: boolean; readonly error: { readonly code: string } }>(project, ["align", "--file", name, ...extra], 2);

				expect(denied, name).toMatchObject({ ok: false, error: { code: "ALIGN_NOT_ELIGIBLE" } });
				expect(readFileSync(join(project, name), "utf8"), name).toBe(content);
			}
		}
	});

	test("no-group syntax acceptance, invalid syntax and parser failure have distinct honest outcomes", () => {
		for (const [name, content, status, exit] of [
			["no-groups.py", "print('ordinary code')\n", "valid", 0],
			["invalid.py", "if:\n", "invalid", 2],
		] as const) {
			const project = projectWith(name, content)                                 ;
			const checked = cli<CheckReport>(project, ["check", "--file", name], exit) ;

			expect(checked.syntax.status, name).toBe(status);
			expect(checked.formatReadiness, name).toMatchObject({ approvalEligible: false, verification: "not-run", approvalFacts: [] });
			if (status === "valid") {
				expect(checked.results[0]!.groups).toEqual([]);
				expect(checked.formatReadiness.reasons).toContain("no verified approval rule applies to this file");
			} else {
				expect(checked.syntax.diagnostics.length).toBeGreaterThan(0);
				expect(checked.results[0]!.groups).toEqual([]);
			}
			cli(project, ["align", "--file", name], 2);
			expect(readFileSync(join(project, name), "utf8"), name).toBe(content);
		}
		for (const scenario of ["missing", "fault"] as const) {
			const project = projectWith("invoice.py", source) ;
			const bin     = join       (project, "bin"      ) ;

			mkdirSync(bin);
			if (scenario === "fault") {
				const parser = join(bin, "python3");

				writeFileSync(parser, `#!${node}\nprocess.exit(7);\n`);
				chmodSync(parser, 0o755);
			}
			const checked = cli<CheckReport>(project, ["check", "--file", "invoice.py"], 2, { PATH: bin });

			expect(checked.syntax, scenario).toMatchObject({ status: "error", tool: "python3" });
			expect(checked.syntax.diagnostics.join(" "), scenario).toContain(scenario === "missing" ? "unavailable" : "unrecognized status");
			expect(checked.formatReadiness.approvalEligible, scenario).toBe(false);
			expect(checked.results[0]!.groups, scenario).toEqual([]);
			cli(project, ["align", "--file", "invoice.py"], 2, { PATH: bin });
			expect(readFileSync(join(project, "invoice.py"), "utf8"), scenario).toBe(source);
		}
	});

	test("unsupported lone-CR source fails explicitly and remains byte-identical", () => {
		const content = "a=1\rb=2\rc=3\r"                                                                                                         ;
		const project = projectWith("legacy.py", content)                                                                                         ;
		const checked = cli<{ readonly ok: boolean; readonly error: { readonly message: string } }>(project, ["check", "--file", "legacy.py"], 2) ;
		expect(checked.ok                                                           ).toBe     (false         ) ;
		expect(checked.error.message                                                ).toContain("line endings") ;
		expect(readFileSync(join(project, "legacy.py")).equals(Buffer.from(content))).toBe     (true          ) ;
		cli(project, ["align", "--file", "legacy.py", "--dry-run"], 2);
		expect(readFileSync(join(project, "legacy.py")).equals(Buffer.from(content))).toBe(true);
	});

	test("approved alignment preserves CRLF, Unicode data, indentation and comment bytes", () => {
		const content = [
			"def labels():",
			'    first="café 😀" # keep  spacing  ',
			'    longer_name="naïve" # another  comment  ',
			'    mid="résumé" # final  comment  ',
			"    return first, longer_name, mid",
			"print(labels())",
			"",
		].join("\r\n");
		const expected = content
			.replace('first="', 'first       = "')
			.replace('longer_name="', 'longer_name = "')
			.replace('mid="', 'mid         = "')
			.replace('"naïve" #', '"naïve"  #');
		const project = projectWith  ("labels.py", content) ;
		const target  = join         (project, "labels.py") ;
		const before  = executePython(project, "labels.py") ;

		cli<CheckReport>(project, ["check", "--file", "labels.py"], 1);
		cli<AlignReport>(project, ["align", "--file", "labels.py", "--dry-run"], 0);
		expect(readFileSync(target).equals(Buffer.from(content))                     ).toBe(true  ) ;
		expect(cli<AlignReport>(project, ["align", "--file", "labels.py"], 0).written).toBe(true  ) ;
		expect(readFileSync(target).equals(Buffer.from(expected))                    ).toBe(true  ) ;
		expect(executePython(project, "labels.py")                                   ).toBe(before) ;
		cli<CheckReport>(project, ["check", "--file", "labels.py"], 0);
		expect(cli<AlignReport>(project, ["align", "--file", "labels.py"], 0).written).toBe(false);
	});

	test("partial coverage stays visible and guarded runs cannot certify indexed assignments", () => {
		const indexed = "items[0]=1\nitems[1]=2\nitems[2]=3\n"                        ;
		const content = "a      = 1\nlonger = 2\nmid    = 3\n\n" + indexed            ;
		const project = projectWith("mixed.py", content)                              ;
		const checked = cli<CheckReport>(project, ["check", "--file", "mixed.py"], 0) ;

		expect(checked.syntax.status                                                             ).toBe         ("valid"                                            ) ;
		expect(checked.results[0]!.groups                                                        ).toMatchObject([{ state: "PASS", startLine: 1, endLine: 3 }]      ) ;
		expect(checked.results[0]!.unsupported?.map(row => row.line)                             ).toEqual      ([5, 6, 7]                                          ) ;
		expect(checked.formatReadiness                                                           ).toMatchObject({ approvalEligible: true, verification: "not-run" }) ;
		expect(readFileSync(join(project, "mixed.py"), "utf8")                                   ).toBe         (content                                            ) ;
		expect(cli<AlignReport>(project, ["align", "--file", "mixed.py", "--dry-run"], 0).written).toBe         (false                                              ) ;
		expect(readFileSync(join(project, "mixed.py"), "utf8")                                   ).toBe         (content                                            ) ;

		const unaligned = "a=1\nlonger=2\nmid=3\n\n" + indexed;
		writeFileSync(join(project, "mixed.py"), unaligned);
		cli<CheckReport>(project, ["check", "--file", "mixed.py"], 1);
		expect(cli<AlignReport>(project, ["align", "--file", "mixed.py"], 0).written).toBe(true);
		expect(readFileSync(join(project, "mixed.py"), "utf8")).toBe(content);
		const rechecked = cli<CheckReport>(project, ["check", "--file", "mixed.py"], 0);
		expect(rechecked.results[0]!.groups.map(group => group.state)).toEqual(["PASS"]);
		expect(rechecked.results[0]!.unsupported?.map(row => row.line)).toEqual([5, 6, 7]);

		const child   = `require("node:fs").writeFileSync("indexed.py", ${JSON.stringify(indexed)})`                  ;
		const guarded = run(node, [executable, "run", "--root", project, "--json", "--", node, "-e", child], project) ;

		expectStatus(guarded, 2);
		const receipt = JSON.parse(guarded.stdout) as { readonly state: string; readonly checked: readonly { readonly file: string; readonly result: FileResult }[] };

		expect(receipt.state                                                                   ).toBe        ("UNSUPPORTED") ;
		expect(receipt.checked                                                                 ).toHaveLength(1            ) ;
		expect(receipt.checked[0]!.file                                                        ).toBe        ("indexed.py" ) ;
		expect(receipt.checked[0]!.result.groups                                               ).toEqual     ([]           ) ;
		expect(receipt.checked[0]!.result.unsupported?.map(row => row.line)                    ).toEqual     ([1, 2, 3]    ) ;
		expect(cli<{ readonly state: string }>(project, ["status", "--root", project], 0).state).toBe        ("UNSUPPORTED") ;
		expect(readFileSync(join(project, "indexed.py"), "utf8")                               ).toBe        (indexed      ) ;

		const failingChild = `require("node:fs").writeFileSync("failure.py", ${JSON.stringify(unaligned)})`                       ;
		const failing      = run(node, [executable, "run", "--root", project, "--json", "--", node, "-e", failingChild], project) ;
		expectStatus(failing, 1);
		const failed = JSON.parse(failing.stdout) as typeof receipt;
		expect(failed.state                                               ).toBe           ("FAIL"   ) ;
		expect(failed.checked[0]!.result.summary.misaligned               ).toBeGreaterThan(0        ) ;
		expect(failed.checked[0]!.result.unsupported?.map(row => row.line)).toEqual        ([5, 6, 7]) ;
		expect(readFileSync(join(project, "failure.py"), "utf8")          ).toBe           (unaligned) ;
	});

	test("bundled post-edit hook records unsupported Python without blocking or changing it", () => {
		const project = projectWith("indexed.py", "items[0]=0\n")                                ;
		const target  = join(project, "indexed.py")                                              ;
		const content = "items[0]=1\nitems[1]=2\nitems[2]=3\n"                                   ;
		const session = JSON.stringify({ session_id: "python-unsupported", tool_name: "Write" }) ;

		expectStatus(run(node, [executable, "hook", "session", "--root", project], project, {}, session), 0);
		writeFileSync(target, content);
		const post = run(node, [executable, "hook", "post", "--root", project], project, {}, session);

		expectStatus(post, 0);
		const output      = JSON.parse(post.stdout) as { readonly decision?: string; readonly hookSpecificOutput: { readonly additionalContext: string } } ;
		const context     = output.hookSpecificOutput.additionalContext                                                                                    ;
		const receiptPath = /\[boxbox\] PostToolUse: UNSUPPORTED\. (.+\.json)$/u.exec(context)?.[1]                                                        ;

		expect(output.decision).toBeUndefined();
		expect(receiptPath, context).toBeDefined();
		const receipt = JSON.parse(readFileSync(receiptPath!, "utf8")) as { readonly state: string; readonly checked: readonly { readonly result: FileResult }[] };

		expect(receipt.state                                               ).toBe        ("UNSUPPORTED") ;
		expect(receipt.checked                                             ).toHaveLength(1            ) ;
		expect(receipt.checked[0]!.result.groups                           ).toEqual     ([]           ) ;
		expect(receipt.checked[0]!.result.unsupported?.map(row => row.line)).toEqual     ([1, 2, 3]    ) ;
		expect(readFileSync(target, "utf8")                                ).toBe        (content      ) ;
	});

	test("nested formatted literals never emit assignments from their string contents", () => {
		const version = run("python3", ["-I", "-c", "import sys; print(sys.version_info.minor)"], sandbox);

		expectStatus(version, 0);
		const quote   = Number(version.stdout.trim()) >= 12 ? '"""' : "'''"                                         ;
		const literal = `message = f"""prefix {${quote}\nfake = 1\nlong_fake = 2\nthird = 3\n${quote}} suffix"""\n` ;
		const project = projectWith("message.py", literal)                                                          ;
		const checked = cli<CheckReport>(project, ["check", "--file", "message.py"], 0)                             ;

		expect(checked.syntax.status     ).toBe         ("valid"                                       ) ;
		expect(checked.results[0]!.groups).toEqual      ([]                                            ) ;
		expect(checked.formatReadiness   ).toMatchObject({ approvalEligible: false, approvalFacts: [] }) ;
		cli(project, ["align", "--file", "message.py", "--dry-run"], 2);
		expect(readFileSync(join(project, "message.py"), "utf8")).toBe(literal);
	});

	test("inspection and preview cannot import project or PYTHONPATH parser lookalikes or execute the target", () => {
		for (const location of ["project", "PYTHONPATH"] as const) {
			const content = 'raise RuntimeError("inspection must not execute source")\n' + source ;
			const project = projectWith("invoice.py", content)                                    ;
			const poison  = location === "project" ? project : join(project, "injected")          ;
			const marker  = join(project, "parser-imported")                                      ;

			mkdirSync(poison, { recursive: true });
			for (const module of ["ast", "tokenize"]) {
				writeFileSync(join(poison, `${module}.py`), `open(${JSON.stringify(marker)}, "w").write("${module}")\nraise RuntimeError("untrusted module imported")\n`);
			}
			const environment = location === "PYTHONPATH" ? { PYTHONPATH: poison } : {}                      ;
			const checked     = cli<CheckReport>(project, ["check", "--file", "invoice.py"], 1, environment) ;

			expect(checked.syntax.status, location).toBe("valid");
			expect(checked.results[0]!.groups[0], location).toMatchObject({ startLine: 2, endLine: 4, axes: ["name", "equal", "value"] });
			expect(checked.formatReadiness.approvalEligible, location).toBe(true);
			cli(project, ["align", "--file", "invoice.py", "--dry-run"], 0, environment);
			expect(existsSync(marker), location).toBe(false);
			expect(existsSync(join(poison, "__pycache__")), location).toBe(false);
			expect(readFileSync(join(project, "invoice.py"), "utf8"), location).toBe(content);
		}
	});
});
