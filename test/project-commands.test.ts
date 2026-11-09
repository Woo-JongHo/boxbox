import      { afterEach, describe, expect, test                       } from "bun:test"                        ;
import      {
              chmodSync                                             ,
              lstatSync                                             ,
              mkdirSync                                             ,
              mkdtempSync                                           ,
              readFileSync                                          ,
              rmSync                                                ,
              symlinkSync                                           ,
              unlinkSync                                            ,
              writeFileSync
                                                                      } from "node:fs"                         ;
import      { join, resolve                                           } from "node:path"                       ;

import      { documentResolver, loadApprovalRegistry                  } from "@/common/18_approval-gate.ts"    ;
import      { runAlignCli                                             } from "@/common/22_align-cli.ts"        ;
import      { runProjectCommand, selectProjectTargets                 } from "@/common/34_project-commands.ts" ;
import type { ProjectCommandOptions, ProjectInspection, ProjectTarget } from "@/common/34_project-commands.ts" ;
import type { FormatPipelineResult                                    } from "@/common/21_format-pipeline.ts"  ;
import type { FormatterConfig                                         } from "@/common/15_project-config.ts"   ;
import type { ResultEnvelope                                          } from "@/common/24_result-json.ts"      ;
import      { PYTHON_ALIGNER                                          } from "@/python/03_profile.ts"          ;

const roots: string[] = []                                                               ;
const PRESET          = resolve(import.meta.dir, "../product/rules/presets/recommended") ;
const SOURCE          = "a=1\nlonger=22\nmid=333\n"                                      ;

function workspace(): string {
	const root = mkdtempSync(join(import.meta.dir, "boxbox-project-command-"));
	roots.push(root);
	mkdirSync(join(root, "src"));
	return root;
}

function file(root: string, path: string, source = SOURCE): string {
	const absolute = join(root, path);
	writeFileSync(absolute, source);
	return absolute;
}

function formatter(root: string, body = ""): FormatterConfig {
	const script = file(root, `formatter-${Math.random().toString(16).slice(2)}.js`, `import { readFileSync, writeFileSync } from "node:fs"; const p=process.argv[2]; ${body} writeFileSync(p,readFileSync(p,"utf8").replace(/[ \\t]*=[ \\t]*/gu," = "));`);
	return { command: process.execPath, args: [script, "{file}"], timeoutMs: 2_000 };
}

function options(root: string, inputs: readonly string[], command: "check" | "format", configured?: FormatterConfig): ProjectCommandOptions {
	const registry = loadApprovalRegistry([{ root: PRESET, layer: "preset" }]);
	return {
		root, inputs, command, formatters: configured ? { python: configured } : {},
		inspect: (target: ProjectTarget): ProjectInspection => {
			const checked = runAlignCli(PYTHON_ALIGNER, ["--file", join(root, target.file), "--json"]) ;
			const result  = (JSON.parse(checked.report) as ResultEnvelope).results[0]!                 ;
			return { result, exitCode: result.summary.refused > 0 ? 2 : result.summary.misaligned > 0 ? 1 : 0 };
		},
		pipelineContext: () => ({ registry, resolveDocument: documentResolver({ preset: PRESET }) }),
	};
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("project target selection", () => {
	test("walks supported files in lexical order and skips generated, host and dependency directories", () => {
		const root = workspace();
		mkdirSync(join(root, "src/nested"));
		for (const directory of [".git", ".boxbox", "node_modules", "dist"]) {
			mkdirSync(join(root, directory));
			file(root, `${directory}/ignored.ts`);
		}
		for (const path of ["src/z.py", "src/a.ts", "src/nested/space name.YAML", "src/readme.md", "formatter.js"]) file(root, path);

		expect(selectProjectTargets(root, ["."])).toEqual([
			{ file : "src/a.ts"                   , language : "typescript" },
			{ file : "src/nested/space name.YAML" , language : "yaml"       },
			{ file : "src/z.py"                   , language : "python"     },
		]);
		expect(selectProjectTargets(root, ["src/z.py", "src/a.ts"]).map(target => target.file)).toEqual(["src/z.py", "src/a.ts"]);
	});

	test("recognizes the same public extensions as the single-file CLI", () => {
		const root = workspace();
		for (const extension of [".ts", ".tsx", ".mts", ".cts", ".py", ".json", ".yaml", ".yml"]) file(root, `src/input${extension}`);

		expect(selectProjectTargets(root, ["src"]).map(target => target.language)).toEqual([
			"typescript", "json", "typescript", "python", "typescript", "typescript", "yaml", "yaml",
		]);
	});

	test("rejects duplicate paths and overlapping directory selections consistently", () => {
		const root = workspace();
		file(root, "src/a.py");

		for (const paths of [["src/a.py", "./src/a.py"], ["src", "src/a.py"], ["src/a.py", "src"]]) {
			expect(() => selectProjectTargets(root, paths)).toThrow("duplicate project target");
		}
	});

	test("refuses POSIX literal-backslash targets without confusing the nested file in the Node runtime", () => {
		if (process.platform === "win32") return;
		const root = workspace();
		mkdirSync(join(root, "src/a"));
		file(root, "src/a\\b.py");
		file(root, "src/a/b.py");
		const node = Bun.which("node");
		if (!node) throw new Error("The public Node runtime is required for the POSIX filename regression");
		const engine = resolve(import.meta.dir, "../product/engine")                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      ;
		const loader = file(root, "alias-loader.mjs", `import { pathToFileURL } from 'node:url'; export function resolve(name,context,next){return next(name.startsWith('@/')?pathToFileURL(${JSON.stringify(engine)}+'/'+name.slice(2)).href:name,context);}`)                                                                                                                                                                                                                                                                                                                                                                           ;
		const source = `import { selectProjectTargets } from ${JSON.stringify(join(engine, "common/34_project-commands.ts"))}; const root=process.env.BOXBOX_TEST_ROOT; let unsupported=false,duplicate=false; try { selectProjectTargets(root,['src']); } catch(error) { unsupported=error.message.includes('literal backslashes are unsupported'); } try { selectProjectTargets(root,['src/a/b.py','./src/a/b.py']); } catch(error) { duplicate=error.message.includes('duplicate project target'); } console.log(JSON.stringify({targets:selectProjectTargets(root,['src/a/b.py']).map(target=>target.file),unsupported,duplicate}));` ;
		// Bun realpathSync currently treats a POSIX backslash as a separator; run this filesystem contract on the shipped Node runtime.
		const result = Bun.spawnSync([node, "--experimental-strip-types", "--no-warnings", "--experimental-loader", loader, "--input-type=module", "-e", source], { env: { ...process.env, BOXBOX_TEST_ROOT: root }, stdout: "pipe", stderr: "pipe" });

		expect(result.stderr.toString()            ).toBe   (""                                                             ) ;
		expect(result.exitCode                     ).toBe   (0                                                              ) ;
		expect(JSON.parse(result.stdout.toString())).toEqual({ targets: ["src/a/b.py"], unsupported: true, duplicate: true }) ;
	});

	test("rejects file links, linked parents and paths outside the root", () => {
		const root    = workspace() ;
		const outside = workspace() ;
		file(root, "src/a.py");
		file(outside, "src/external.py");
		symlinkSync(join(root, "src/a.py"), join(root, "linked.py"));
		symlinkSync(join(root, "src"), join(root, "inside"));
		symlinkSync(join(outside, "src"), join(root, "outside"));

		for (const path of ["linked.py", "inside/a.py", "outside/external.py"]) expect(() => selectProjectTargets(root, [path])).toThrow("symbolic link");
		expect(() => selectProjectTargets(root, [join(outside, "src/external.py")])).toThrow("escapes root");
		expect(() => selectProjectTargets(root, ["."])).toThrow("symbolic link");
	});

	test("fails closed on empty, missing, excluded or unsupported explicit selections", () => {
		const root = workspace();
		mkdirSync(join(root, "dist"));
		file(root, "dist/ignored.py");
		file(root, "README.md");

		for (const [paths, reason] of [
			[[], "at least one"],
			[[""], "must not be empty"],
			[["missing.py"], "ENOENT"],
			[["README.md"], "unsupported"],
			[["src"], "no supported"],
			[["dist/ignored.py"], "excluded directory"],
		] as const) expect(() => selectProjectTargets(root, paths)).toThrow(reason);
	});

	test("bounds recursive directory depth without rejecting the last permitted file", () => {
		const root    = workspace() ;
		let directory = root        ;
		for (let depth = 0; depth < 32; depth += 1) {
			directory = join(directory, "nested");
			mkdirSync(directory);
		}
		writeFileSync(join(directory, "last.py"), SOURCE);
		expect(selectProjectTargets(root, ["."])).toHaveLength(1);
		mkdirSync(join(directory, "too-deep"));
		expect(() => selectProjectTargets(root, ["."])).toThrow("32 directory levels");
	});
});

describe("project command orchestration", () => {
	test("selects each language's explicitly configured formatter in a mixed batch", async () => {
		const root = workspace();
		file(root, "src/a.py");
		file(root, "src/b.ts", "const a=fn(1);\nconst longer=fn(22);\nconst mid=fn(333);\n");
		const python     = formatter(root, 'if(!p.endsWith(".py")) process.exit(7);')                                          ;
		const typescript = formatter(root, 'if(!p.endsWith(".ts")) process.exit(8);')                                          ;
		const result     = await runProjectCommand({ ...options(root, ["src"], "check"), formatters: { python, typescript } }) ;

		expect(result.exitCode).toBe(1);
		expect(result.results.map(entry => entry.exitCode)).toEqual([1, 1]);
		for (const entry of result.results) expect(entry.result).toMatchObject({ formatterExecuted: true, canonicalChanged: true, written: false });
	}, 60_000);

	test("preserves ordinary inspection output when no formatter is configured", async () => {
		const root = workspace();
		file(root, "src/a.py");
		file(root, "src/b.py", "a      = 1\nlonger = 22\nmid    = 333\n");
		const result = await runProjectCommand(options(root, ["src"], "check"));

		expect(result.exitCode                             )    .toBe          (1                 ) ;
		expect(result.results.map(entry => entry.exitCode) )    .toEqual       ([1, 0]            ) ;
		expect(result.results[0]!.result                   )    .toHaveProperty("groups"          ) ;
		expect(result.results[0]!.result                   ).not.toHaveProperty("canonicalChanged") ;
		expect(readFileSync(join(root, "src/a.py"), "utf8"))    .toBe          (SOURCE            ) ;
	});

	test("checks canonical formatter output without writing, then formats every file to a fixed point", async () => {
		const root  = workspace()                       ;
		const paths = ["src/a.py", "src/space name.py"] ;
		for (const path of paths) chmodSync(file(root, path), 0o640);
		const configured = formatter(root)                                                                                                                              ;
		const before     = paths.map(path => ({ bytes: readFileSync(join(root, path)), mode: lstatSync(join(root, path)).mode, ino: lstatSync(join(root, path)).ino })) ;
		const checked    = await runProjectCommand(options(root, paths, "check", configured))                                                                           ;
		const preview    = await runProjectCommand({ ...options(root, paths, "format", configured), dryRun: true })                                                     ;

		expect(checked.exitCode).toBe(1);
		expect(preview.exitCode).toBe(0);
		for (const [index, path] of paths.entries()) {
			expect(readFileSync(join(root, path)).equals(before[index]!.bytes)).toBe         (true                                                               ) ;
			expect(lstatSync(join(root, path)).mode                           ).toBe         (before[index]!.mode                                                ) ;
			expect(lstatSync(join(root, path)).ino                            ).toBe         (before[index]!.ino                                                 ) ;
			expect(checked.results[index]!.result                             ).toMatchObject({ formatterExecuted: true, canonicalChanged: true, written: false }) ;
			expect(preview.results[index]!.result                             ).toMatchObject({ canonicalChanged: true, written: false }                         ) ;
		}
		const applied   = await runProjectCommand(options(root, paths, "format", configured)) ;
		const canonical = paths.map(path => readFileSync(join(root, path)))                   ;
		const rechecked = await runProjectCommand(options(root, paths, "check", configured))  ;
		const repeated  = await runProjectCommand(options(root, paths, "format", configured)) ;

		expect(applied.exitCode  ).toBe(0) ;
		expect(rechecked.exitCode).toBe(0) ;
		expect(repeated.exitCode ).toBe(0) ;
		for (const [index, entry] of rechecked.results.entries()) {
			expect(entry.result                                                     ).toMatchObject({ formatterChanged: true, boxboxChanged: true, canonicalChanged: false, written: false }) ;
			expect((repeated.results[index]!.result as FormatPipelineResult).written).toBe         (false                                                                                   ) ;
			expect(readFileSync(join(root, paths[index]!)).equals(canonical[index]!)).toBe         (true                                                                                    ) ;
		}
	}, 60_000);

	test("records completed writes and continues when a later formatter fails", async () => {
		const root  = workspace()                                   ;
		const paths = ["src/first.py", "src/bad.py", "src/last.py"] ;
		for (const path of paths) file(root, path);
		const result = await runProjectCommand(options(root, paths, "format", formatter(root, 'if(p.endsWith("bad.py")) process.exit(7);')));

		expect(result.atomicity                                           ).toBe     ("per-file"   ) ;
		expect(result.exitCode                                            ).toBe     (2            ) ;
		expect(result.results.map(entry => entry.exitCode)                ).toEqual  ([0, 2, 0]    ) ;
		expect(result.results[1]!.error                                   ).toContain("exit code 7") ;
		expect((result.results[0]!.result as FormatPipelineResult).written).toBe     (true         ) ;
		expect((result.results[2]!.result as FormatPipelineResult).written).toBe     (true         ) ;
		expect(readFileSync(join(root, "src/bad.py"), "utf8")             ).toBe     (SOURCE       ) ;
	}, 60_000);

	test("keeps the whole-file approval gate for canonical checks and format writes", async () => {
		const root       = workspace()                                                                     ;
		const source     = 'a=1\nlonger=22\nmid=333\n\nvalues={\n "a":1,\n "longer":22,\n "mid":333,\n}\n' ;
		const target     = file(root, "src/unapproved.py", source)                                         ;
		const configured = formatter(root)                                                                 ;
		for (const command of ["check", "format"] as const) {
			const result = await runProjectCommand(options(root, ["src/unapproved.py"], command, configured));
			expect(result.exitCode             ).toBe     (2                ) ;
			expect(result.results[0]!.error    ).toContain("approval denied") ;
			expect(readFileSync(target, "utf8")).toBe     (source           ) ;
		}
	}, 60_000);

	test("validates the entire selection before any format write", async () => {
		const root   = workspace()                 ;
		const target = file     (root, "src/a.py") ;

		await expect(runProjectCommand(options(root, ["src/a.py", "missing.py"], "format"))).rejects.toThrow("ENOENT");
		await expect(runProjectCommand(options(root, ["src/a.py", "src"], "format"))).rejects.toThrow("duplicate");
		expect(readFileSync(target, "utf8")).toBe(SOURCE);
	});

	test("revalidates each path when an earlier callback swaps a later target for a link", async () => {
		const root = workspace();
		file(root, "src/a.py");
		file(root, "src/b.py");
		const base = options(root, ["src/a.py", "src/b.py"], "check") ;
		let calls  = 0                                                ;
		const result = await runProjectCommand({ ...base, inspect: target => {
			calls += 1;
			unlinkSync(join(root, "src/b.py"));
			symlinkSync(join(root, "src/a.py"), join(root, "src/b.py"));
			return base.inspect(target);
		} });

		expect(calls                   ).toBe     (1              ) ;
		expect(result.exitCode         ).toBe     (2              ) ;
		expect(result.results[1]!.error).toContain("symbolic link") ;
	});
});
