import      {
              afterEach     ,
              describe      ,
              expect        ,
              test
                              } from "bun:test"  ;
import      {
              existsSync    ,
              lstatSync     ,
              mkdirSync     ,
              mkdtempSync   ,
              readFileSync  ,
              rmSync        ,
              symlinkSync   ,
              writeFileSync
                              } from "node:fs"   ;
import      { tmpdir          } from "node:os"   ;
import      { join, resolve   } from "node:path" ;

const CLI             = resolve(import.meta.dir, "../product/engine/00_cli.ts") ;
const roots: string[] = []                                                      ;
const SOURCE          = "a=1\nlonger=22\nmid=333\n"                             ;

function workspace(): string {
	const root = mkdtempSync(join(tmpdir(), "boxbox-cli-project-"));
	roots.push(root);
	mkdirSync(join(root, "src"));
	return root;
}

function invoke(root: string, args: readonly string[], environment: Record<string, string> = {}) {
	const source = `import { runCli } from ${JSON.stringify(CLI)}; process.exitCode=await runCli(JSON.parse(process.env.BOXBOX_TEST_ARGS!),process.cwd());`;
	const result = Bun.spawnSync([process.execPath, "-e", source], {
		cwd: root, env: { ...process.env, BOXBOX_TEST_ARGS: JSON.stringify(args), XDG_CONFIG_HOME: join(root, "xdg"), ...environment }, stdout: "pipe", stderr: "pipe",
	});
	return { status: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

function configure(root: string, languages = ["python", "typescript", "json", "yaml"], failure = ""): string {
	const marker = join(root, "formatter-calls") ;
	const script = join(root, "formatter.mjs"  ) ;
	mkdirSync(join(root, ".boxbox"));
	writeFileSync(script, `import { appendFileSync,readFileSync,writeFileSync } from "node:fs";const p=process.argv[2];appendFileSync(${JSON.stringify(marker)},p+"\\n");${failure}writeFileSync(p,readFileSync(p,"utf8").replace(/[ \\t]*=[ \\t]*/gu," = "));`);
	const formatter = { command: process.execPath, args: [script, "{file}"], timeoutMs: 5_000 };
	writeFileSync(join(root, ".boxbox/config.json"), JSON.stringify({ schemaVersion: 2, languages, formatters: { python: formatter, typescript: formatter } }));
	return marker;
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("public project commands", () => {
	test("source inspection bypasses the configured formatter without changing bytes, inode or mode", () => {
		const root   = workspace()                 ;
		const marker = configure(root            ) ;
		const target = join     (root, "src/a.py") ;
		writeFileSync(target, SOURCE);
		const before = lstatSync (target                                                                               ) ;
		const result = invoke    (root, ["check", "--source", "--file", "src/a.py", "--expect-axis", "equal", "--json"]) ;
		const value  = JSON.parse(result.stdout                                                                        ) ;

		expect(result.status                                                 )    .toBe           (1                                               ) ;
		expect(value                                                         )    .toMatchObject  ({ basis: "source", syntax: { status: "valid" } }) ;
		expect(value.results[0].summary.misaligned                           )    .toBeGreaterThan(0                                               ) ;
		expect(value.formatReadiness                                         )    .toHaveProperty ("approvalFacts"                                 ) ;
		expect(value.axisExpectation.requested                               )    .toEqual        (["equal"]                                       ) ;
		expect(value                                                         ).not.toHaveProperty ("canonical"                                     ) ;
		expect(existsSync(marker)                                            )    .toBe           (false                                           ) ;
		expect(readFileSync(target, "utf8")                                  )    .toBe           (SOURCE                                          ) ;
		expect(lstatSync(target).ino                                         )    .toBe           (before.ino                                      ) ;
		expect(lstatSync(target).mode                                        )    .toBe           (before.mode                                     ) ;
		expect(invoke(root, ["check", "--file", "src/a.py", "--json"]).status)    .toBe           (1                                               ) ;
		expect(existsSync(marker)                                            )    .toBe           (true                                            ) ;
	}, 60_000);

	test("source batch inspection and invalid input stay read-only with an unusable TMPDIR", () => {
		const root   = workspace()     ;
		const marker = configure(root) ;
		writeFileSync(join(root, "src/a.py"), SOURCE);
		writeFileSync(join(root, "src/b.py"), SOURCE);
		const invalidTemp = join(root, "not-a-directory");
		writeFileSync(invalidTemp, "no temporary files");
		const environment = { TMPDIR: invalidTemp, TMP: invalidTemp, TEMP: invalidTemp }                     ;
		const result      = invoke(root, ["check", "--source", "--directory", "src", "--json"], environment) ;
		const value       = JSON.parse(result.stdout)                                                        ;

		expect(result.status).toBe(1);
		expect(value.results).toHaveLength(2);
		for (const file of value.results) {
			expect(file.result.basis        )    .toBe          ("source"   ) ;
			expect(file.result.syntax.status)    .toBe          ("valid"    ) ;
			expect(file.result              ).not.toHaveProperty("canonical") ;
		}
		expect(existsSync(marker)).toBe(false);
		writeFileSync(join(root, "src/invalid.py"), "if:\n");
		const invalid = invoke(root, ["check", "--source", "--file", "src/invalid.py", "--json"], environment);
		expect(invalid.status                                    ).toBe(2        ) ;
		expect(JSON.parse(invalid.stdout).syntax.status          ).toBe("invalid") ;
		expect(existsSync(marker)                                ).toBe(false    ) ;
		expect(readFileSync(join(root, "src/invalid.py"), "utf8")).toBe("if:\n"  ) ;
	});

	test("source inspection is check-only and rejects duplicate source flags", () => {
		const root = workspace();
		writeFileSync(join(root, "src/a.py"), SOURCE);
		for (const args of [
			["check", "--source", "--source", "--file", "src/a.py"],
			["format", "--source", "--file", "src/a.py"],
			["align", "--source", "--file", "src/a.py"],
			["guide", "--source", "--file", "src/a.py"],
		]) expect(invoke(root, [...args, "--json"]).status).toBe(2);
		const source   = JSON.parse(invoke(root, ["check", "--source", "--file", "src/a.py", "--json"]).stdout) ;
		const ordinary = JSON.parse(invoke(root, ["check", "--file", "src/a.py", "--json"]).stdout            ) ;
		delete source.basis;
		expect(source).toEqual(ordinary);
	});

	test("canonical single check preserves source schema and bytes, then accepts a restored canonical fixed point", () => {
		const root   = workspace()                 ;
		const marker = configure(root            ) ;
		const path   = join     (root, "src/a.py") ;
		writeFileSync(path, SOURCE);
		const first = invoke    (root, ["check", "--file", "src/a.py", "--json"]) ;
		const value = JSON.parse(first.stdout                                   ) ;

		expect(first.status                                                   ).toBe           (1                                                                                                             ) ;
		expect(value.results[0].summary.misaligned                            ).toBeGreaterThan(0                                                                                                             ) ;
		expect(value.syntax.status                                            ).toBe           ("valid"                                                                                                       ) ;
		expect(value.formatReadiness                                          ).toHaveProperty ("approvalFacts"                                                                                               ) ;
		expect(value.basis                                                    ).toBe           ("source"                                                                                                      ) ;
		expect(value.canonical                                                ).toMatchObject  ({ basis: "formatter-then-boxbox", verification: "passed", result: { canonicalChanged: true, written: false } }) ;
		expect(readFileSync(path, "utf8")                                     ).toBe           (SOURCE                                                                                                        ) ;
		expect(existsSync(marker)                                             ).toBe           (true                                                                                                          ) ;
		expect(invoke(root, ["format", "--file", "src/a.py", "--json"]).status).toBe           (0                                                                                                             ) ;
		const canonical = readFileSync(path                                           ) ;
		const second    = invoke      (root, ["check", "--file", "src/a.py", "--json"]) ;

		expect(second.status                             ).toBe         (0                                                                                       ) ;
		expect(JSON.parse(second.stdout).canonical.result).toMatchObject({ formatterChanged: true, boxboxChanged: true, canonicalChanged: false, written: false }) ;
		expect(readFileSync(path).equals(canonical)      ).toBe         (true                                                                                    ) ;
	}, 60_000);

	test("accepts repeated files mixed with directories and reports mixed languages", () => {
		const root = workspace();
		writeFileSync(join(root, "separate.py"), SOURCE);
		writeFileSync(join(root, "src/a.py"), SOURCE);
		writeFileSync(join(root, "src/b.ts"), "const a=1;\nconst longer=22;\nconst mid=333;\n");
		const run    = invoke    (root, ["check", "--file", "separate.py", "--directory", "src", "--expect-axis", "equals", "--json"]) ;
		const output = JSON.parse(run.stdout                                                                                         ) ;

		expect(run.status                                                         ).toBe         (1                                                       ) ;
		expect(output                                                             ).toMatchObject({ command: "check", exitCode: 1, atomicity: "per-file" }) ;
		expect(output.results.map((entry: { file: string }) => entry.file)        ).toEqual      (["separate.py", "src/a.py", "src/b.ts"]                 ) ;
		expect(output.results.map((entry: { language: string }) => entry.language)).toEqual      (["python", "python", "typescript"]                      ) ;
		for (const entry of output.results) expect(entry.result.axisExpectation.requested).toEqual(["equals"]);
		const repeated = invoke(root, ["check", "--file", "src/a.py", "--file", "separate.py", "--json"]);
		expect(repeated.status).toBe(1);
		expect(JSON.parse(repeated.stdout).results).toHaveLength(2);
		configure(root);
		const formatted = invoke(root, ["check", "--directory", "src", "--expect-axis", "equals", "--json"]);
		expect(formatted.status).toBe(1);
		for (const entry of JSON.parse(formatted.stdout).results) {
			expect(entry.result.axisExpectation.requested).toEqual(["equals"]);
			expect(entry.result.canonical).toMatchObject({ verification: "passed", result: { canonicalChanged: true, written: false } });
		}
	}, 60_000);

	test("refuses POSIX literal-backslash paths before formatter execution or rejected-scope approval aliasing", () => {
		if (process.platform === "win32") return;
		const root   = workspace()     ;
		const marker = configure(root) ;
		mkdirSync(join(root, "src/a"));
		for (const file of ["src/a\\b.py", "src/a/b.py"]) writeFileSync(join(root, file), SOURCE);
		const before = ["src/a\\b.py", "src/a/b.py"].map(file => ({ file, bytes: readFileSync(join(root, file)), mode: lstatSync(join(root, file)).mode }))                                                                        ;
		const preset = readFileSync(resolve(import.meta.dir, "../product/rules/presets/recommended/conventions.jsonl"), "utf8").trim().split("\n").map(line => JSON.parse(line)).find(rule => rule.id === "py-simple-assignments") ;
		writeFileSync(join(root, ".boxbox/conventions.jsonl"), JSON.stringify({ ...preset, id: "literal-path-rejection", status: "rejected", scope: "src/a\\b.py", examples: [], approvedBy: "test", date: "2026-11-09" }) + "\n");
		const node = Bun.which("node");
		if (!node) throw new Error("The public Node runtime is required for the POSIX filename regression");
		const engine = resolve(import.meta.dir, "../product/engine") ;
		const loader = join   (root, "alias-loader.mjs"            ) ;
		writeFileSync(loader, `import { pathToFileURL } from 'node:url'; export function resolve(name,context,next){return next(name.startsWith('@/')?pathToFileURL(${JSON.stringify(engine)}+'/'+name.slice(2)).href:name,context);}`);
		const source = `import { runCli } from ${JSON.stringify(CLI)}; process.exitCode=await runCli(JSON.parse(process.env.BOXBOX_TEST_ARGS),process.cwd());`;
		const invokeNode = (args: readonly string[]) => {
			// The public runtime distinguishes the literal filename from the nested path; Bun realpathSync currently does not.
			const result = Bun.spawnSync([node, "--experimental-transform-types", "--no-warnings", "--experimental-loader", loader, "--input-type=module", "-e", source], { cwd: root, env: { ...process.env, BOXBOX_TEST_ARGS: JSON.stringify(args), XDG_CONFIG_HOME: join(root, "xdg") }, stdout: "pipe", stderr: "pipe" });
			return { status: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
		};
		for (const args of [
			["check", "--source", "--file", "src/a\\b.py"],
			["check", "--file", "src/a\\b.py"],
			["format", "--file", "src/a\\b.py"],
			["align", "--file", "src/a\\b.py"],
			["check", "--source", "--directory", "src"],
			["check", "--directory", "src"],
			["format", "--directory", "src"],
			["format", "--file", "src/a/b.py", "--file", "src/a\\b.py"],
		]) {
			const run = invokeNode([...args, "--json"]);
			expect(run.stderr                          ).toBe     (""                                   ) ;
			expect(run.status                          ).toBe     (2                                    ) ;
			expect(JSON.parse(run.stdout).error.message).toContain("literal backslashes are unsupported") ;
			expect(existsSync(marker)                  ).toBe     (false                                ) ;
			for (const file of before) {
				expect(readFileSync(join(root, file.file)).equals(file.bytes)).toBe(true);
				expect(lstatSync(join(root, file.file)).mode).toBe(file.mode);
			}
		}
		const normal = invokeNode(["check", "--file", "src/a/b.py", "--json"]);
		expect(normal.stderr            ).toBe         (""                                                                                     ) ;
		expect(normal.status            ).toBe         (1                                                                                      ) ;
		expect(JSON.parse(normal.stdout)).toMatchObject({ syntax: { status: "valid", tool: "python3" }, canonical: { verification: "passed" } }) ;
		expect(existsSync(marker)       ).toBe         (true                                                                                   ) ;
		for (const file of before) {
			expect(readFileSync(join(root, file.file)).equals(file.bytes)).toBe(true);
			expect(lstatSync(join(root, file.file)).mode).toBe(file.mode);
		}
	}, 60_000);

	test("format suppresses warnings only for the formatter configured for each selected language", () => {
		const root   = workspace()             ;
		const script = join     (root, "ruff") ;
		mkdirSync(join(root, ".boxbox"));
		writeFileSync(script, 'import { readFileSync,writeFileSync } from "node:fs";const p=process.argv.at(-1);writeFileSync(p,readFileSync(p,"utf8").replace(/[ \\t]*=[ \\t]*/gu," = "));');
		writeFileSync(join(root, ".boxbox/config.json"), JSON.stringify({ schemaVersion: 2, formatters: { python: { command: process.execPath, args: [script, "format", "{file}"], timeoutMs: 5_000 } } }));
		writeFileSync(join(root, ".pre-commit-config.yaml"), "repos:\n  - repo: local\n    hooks:\n      - id: ruff-format\n");
		writeFileSync(join(root, "src/a.py"), SOURCE);
		const single = invoke(root, ["format", "--file"     , "src/a.py", "--dry-run", "--json"]) ;
		const batch  = invoke(root, ["format", "--directory", "src"     , "--dry-run", "--json"]) ;

		expect(single.status                              ).toBe   (0   ) ;
		expect(batch.status                               ).toBe   (0   ) ;
		expect(JSON.parse(single.stdout).formatterExecuted).toBe   (true) ;
		expect(JSON.parse(single.stdout).warnings         ).toEqual([]  ) ;
		expect(JSON.parse(batch.stdout).warnings          ).toEqual([]  ) ;
		writeFileSync(join(root, "pyproject.toml"), "[tool.black]\n");
		const otherTool = JSON.parse(invoke(root, ["format", "--file", "src/a.py", "--dry-run", "--json"]).stdout);
		expect(otherTool.warnings).toHaveLength(1);
		expect(otherTool.warnings[0]).toContain("black may be in use");
		writeFileSync(join(root, ".prettierrc"), "{}");
		writeFileSync(join(root, "src/b.ts"), "const a=1;\nconst longer=22;\nconst mid=333;\n");
		const mixed = invoke(root, ["format", "--directory", "src", "--dry-run", "--json"]);
		expect(mixed.status).toBe(0);
		expect(JSON.parse(mixed.stdout).warnings.map((warning: string) => warning.split(" ")[0]).sort()).toEqual(["black", "prettier"]);
		const align = JSON.parse(invoke(root, ["align", "--file", "src/a.py", "--dry-run", "--json"]).stdout);
		expect(align.warnings.some((warning: string) => warning.startsWith("ruff format"))).toBe(true);
	}, 60_000);

	test("validates batch flags and retains single-file-only align and guide", () => {
		const root = workspace();
		writeFileSync(join(root, "src/a.py"), SOURCE);
		writeFileSync(join(root, "src/b.ts"), "const a=1;\nconst longer=22;\nconst mid=333;\n");
		for (const args of [
			["check", "--directory", "src", "--language", "python"],
			["check", "--directory", "src", "--dry-run"],
			["check", "--directory", "src", "--expect-axis", "not valid"],
			["format", "--directory", "src", "--expect-axis", "equals"],
			["align", "--file", "src/a.py", "--file", "src/b.ts"],
			["guide", "--directory", "src"],
		]) expect(invoke(root, [...args, "--json"]).status).toBe(2);
		expect(invoke(root, ["--help"]).stdout).toContain("--directory");
	}, 60_000);

	test("fails all path preselection errors before the first format write", () => {
		const root = workspace();
		writeFileSync(join(root, "src/a.py"), SOURCE);
		symlinkSync(join(root, "src/a.py"), join(root, "linked.py"));
		for (const args of [
			["format", "--file", "src/a.py", "--file", "missing.py"],
			["format", "--file", "src/a.py", "--directory", "src"],
			["format", "--file", "src/a.py", "--file", "linked.py"],
		]) {
			expect(invoke(root, [...args, "--json"]).status).toBe(2);
			expect(readFileSync(join(root, "src/a.py"), "utf8")).toBe(SOURCE);
		}
	});

	test("rejects invalid syntax and disabled languages before a formatter executes", () => {
		for (const command of ["check", "format"] as const) {
			const root   = workspace()                 ;
			const marker = configure(root, ["python"]) ;
			writeFileSync(join(root, "src/invalid.py"), "if:\n");
			writeFileSync(join(root, "src/disabled.ts"), "const a=1;\nconst longer=22;\nconst mid=333;\n");
			expect(invoke(root, [command, "--file", "src/invalid.py", "--json"]).status).toBe(2    ) ;
			expect(existsSync(marker)                                                  ).toBe(false) ;
			expect(invoke(root, [command, "--directory", "src", "--json"]).status      ).toBe(2    ) ;
			expect(existsSync(marker)                                                  ).toBe(false) ;
		}
	});

	test("reports canonical refusal with the existing single-file source result", () => {
		const root = workspace();
		configure(root);
		writeFileSync(join(root, "src/a.py"), "pass\n");
		const run   = invoke    (root, ["check", "--file", "src/a.py", "--json"]) ;
		const value = JSON.parse(run.stdout                                     ) ;

		expect(run.status                     ).toBe     (2                     ) ;
		expect(value.results[0].summary.groups).toBe     (0                     ) ;
		expect(value.syntax.status            ).toBe     ("valid"               ) ;
		expect(value.canonical.verification   ).toBe     ("failed"              ) ;
		expect(value.canonical.error          ).toContain("no verified approval") ;
	});

	test("rejects provenance drift between context preparation and pipeline entry before running the formatter", () => {
		const root   = workspace()     ;
		const marker = configure(root) ;
		writeFileSync(join(root, "src/a.py"), SOURCE);
		const pipeline = resolve(import.meta.dir, "../product/engine/common/21_format-pipeline.ts");
		const driver = `
import { preparedPipelineContext } from ${JSON.stringify(CLI)};
import { runFormatPipeline } from ${JSON.stringify(pipeline)};
import { readFileSync,writeFileSync } from "node:fs";
const root=process.cwd();
const context=preparedPipelineContext(root);
const path=root+"/.boxbox/config.json";
const config=JSON.parse(readFileSync(path,"utf8"));
writeFileSync(path,JSON.stringify({...config,languages:["python"]}));
try {
 await runFormatPipeline({...context,root,file:"src/a.py",language:"python",formatter:config.formatters.python,dryRun:true});
 console.log(JSON.stringify({error:null}));
} catch(error) { console.log(JSON.stringify({error:error.message})); }
`;
		const result = Bun.spawnSync([process.execPath, "-e", driver], { cwd: root, env: { ...process.env, XDG_CONFIG_HOME: join(root, "xdg") }, stdout: "pipe", stderr: "pipe" });

		expect(result.exitCode                             ).toBe     (0                                     ) ;
		expect(JSON.parse(result.stdout.toString()).error  ).toContain("provenance changed after preparation") ;
		expect(existsSync(marker)                          ).toBe     (false                                 ) ;
		expect(readFileSync(join(root, "src/a.py"), "utf8")).toBe     (SOURCE                                ) ;
	});

	test("keeps completed batch format writes visible when a later file fails", () => {
		const root = workspace();
		configure(root, ["python"], 'if(p.endsWith("bad.py"))process.exit(7);');
		for (const path of ["first.py", "bad.py", "last.py"]) writeFileSync(join(root, "src", path), SOURCE);
		const run   = invoke    (root, ["format", "--file", "src/first.py", "--file", "src/bad.py", "--file", "src/last.py", "--json"]) ;
		const value = JSON.parse(run.stdout                                                                                           ) ;

		expect(run.status                                                        ).toBe         (2                                                ) ;
		expect(value                                                             ).toMatchObject({ atomicity: "per-file", exitCode: 2, ok: false }) ;
		expect(value.results.map((entry: { exitCode: number }) => entry.exitCode)).toEqual      ([0, 2, 0]                                        ) ;
		expect(value.results[0].result.written                                   ).toBe         (true                                             ) ;
		expect(value.results[1].error                                            ).toContain    ("exit code 7"                                    ) ;
		expect(value.results[2].result.written                                   ).toBe         (true                                             ) ;
		expect(readFileSync(join(root, "src/bad.py"), "utf8")                    ).toBe         (SOURCE                                           ) ;
	}, 60_000);

	test("the project wideCharacters policy reaches the Python check", () => {
		const root = workspace();
		writeFileSync(join(root, "src/wide.py"), 'row = {\n    "\uc1a1\uae08": a,\n    "\uc785\uae08\uc99d": bb,\n    "\ud1b5": ccc,\n}\n');
		const states = () => JSON.parse(invoke(root, ["check", "--source", "--file", "src/wide.py", "--json"]).stdout).results[0].groups.map((group: { state: string }) => group.state);

		expect(states()).toEqual(["REFUSE"]);
		mkdirSync(join(root, ".boxbox"));
		writeFileSync(join(root, ".boxbox/config.json"), JSON.stringify({ schemaVersion: 2, wideCharacters: "east-asian-width" }));
		expect(states()).toEqual(["FIXABLE"]);
	});

	test("reads the nearest nested project layer when a single file is checked from a parent folder", () => {
		const root    = workspace()                 ;
		const project = join     (root, "team/app") ;
		mkdirSync(join(project, "src"), { recursive: true });
		configure(project, ["typescript"]);
		writeFileSync(join(project, "src/a.py"), SOURCE);
		writeFileSync(join(root   , "src/b.py"), SOURCE);
		const nested  = invoke    (root   , ["check", "--file", "team/app/src/a.py", "--json"]) ;
		const outside = invoke    (root   , ["check", "--file", "src/b.py"         , "--json"]) ;
		const escape  = invoke    (project, ["check", "--file", "../../src/b.py"   , "--json"]) ;

		expect(nested.status                             ).toBe         (2                            ) ;
		expect(JSON.parse(nested.stdout).error           ).toMatchObject({ code: "LANGUAGE_DISABLED" }) ;
		expect(outside.status                            ).toBe         (1                            ) ;
		expect(JSON.parse(outside.stdout).results[0].file).toBe         ("src/b.py"                   ) ;
		expect(JSON.parse(escape.stdout).error           ).toMatchObject({ code: "PATH_ESCAPE" }      ) ;
	});
});
