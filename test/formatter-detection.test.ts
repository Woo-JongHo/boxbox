import      { afterEach, describe, expect, test                       } from "bun:test"                           ;
import      { spawnSync                                               } from "node:child_process"                 ;
import      {
              mkdirSync                                             ,
              mkdtempSync                                           ,
              readdirSync                                           ,
              rmSync                                                ,
              symlinkSync                                           ,
              writeFileSync
                                                                      } from "node:fs"                            ;
import      { tmpdir                                                  } from "node:os"                            ;
import      { join, resolve                                           } from "node:path"                          ;

import      { detectFormatters, formatterConfigured, formatterWarning } from "@/common/33_formatter-detection.ts" ;

const ENTRY           = resolve(import.meta.dir, "../product/packages/cli/entry.ts")                                    ;
const RUFF_HOOK       = { ".pre-commit-config.yaml": "repos:\n  - repo: local\n    hooks:\n      - id: ruff-format\n" } ;
const roots: string[] = []                                                                                              ;

function project(files: Readonly<Record<string, string>> = {}): string {
	const root = mkdtempSync(join(tmpdir(), "boxbox-formatter-"));
	roots.push(root);
	mkdirSync(join(root, ".git"));
	for (const [name, text] of Object.entries(files)) writeFileSync(join(root, name), text);
	return root;
}

function invoke(root: string, args: readonly string[]): { readonly status: number | null; readonly stdout: string } {
	const run = spawnSync(process.execPath, [ENTRY, ...args], { cwd: root, encoding: "utf8", env: { ...process.env, XDG_CONFIG_HOME: join(root, "xdg") } });
	return { status: run.status, stdout: run.stdout };
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("detectFormatters", () => {
	const hook = (body: string): Readonly<Record<string, string>> => ({ ".pre-commit-config.yaml": `repos:\n  - repo: local\n    hooks:\n${body}` });
	const cases: readonly (readonly [string, Readonly<Record<string, string>>, readonly (readonly [string, string, string])[]])[] = [
		["nothing"                     , {}                                                                       , []],
		["a prettier config"           , { ".prettierrc": "{}" }                                                  , [["prettier", ".prettierrc", "possible"]]],
		["a prettier dependency"       , { "package.json": '{"devDependencies":{"prettier":"3.0.0"}}' }           , [["prettier", "package.json", "possible"]]],
		["a prettier package key"      , { "package.json": '{"prettier":{}}' }                                    , [["prettier", "package.json", "possible"]]],
		["a prettier write script"     , { "package.json": '{"scripts":{"format":"npx --yes prettier@3 --write ."}}' }, [["prettier", "package.json", "runs"]]],
		["a prettier check script"     , { "package.json": '{"devDependencies":{"prettier":"3"},"scripts":{"c":"prettier --check ."}}' }, [["prettier", "package.json", "possible"]]],
		["an unrelated package"        , { "package.json": '{"dependencies":{"not-prettier":"1"},"scripts":{"a":"echo prettier-ish"}}' }, []],
		["a malformed package"         , { "package.json": "{" }                                                  , []],
		["black config"                , { "pyproject.toml": "[tool.black]\nline-length = 88\n" }                 , [["black", "pyproject.toml", "possible"]]],
		["a black hook"                , hook("      - id: black\n")                                              , [["black", ".pre-commit-config.yaml", "runs"]]],
		["a black check hook"          , hook("      - id: black\n        args: [--check]\n")                     , [["black", ".pre-commit-config.yaml", "possible"]]],
		["a local black hook"          , hook("      - id: python-format\n        entry: uv run black\n")         , [["black", ".pre-commit-config.yaml", "runs"]]],
		["a ruff-format hook"          , hook("      - id: ruff-format\n")                                        , [["ruff format", ".pre-commit-config.yaml", "runs"]]],
		["a ruff-format check hook"    , hook("      - id: ruff-format\n        args: [--check]\n")               , [["ruff format", ".pre-commit-config.yaml", "possible"]]],
		["a local ruff format hook"    , hook("      - id: local\n        entry: uv run ruff format --force-exclude\n"), [["ruff format", ".pre-commit-config.yaml", "runs"]]],
		["a prettier hook"             , hook("      - id: prettier\n")                                           , [["prettier", ".pre-commit-config.yaml", "runs"]]],
		["a local prettier hook"       , hook("      - id: fmt\n        entry: prettier --write\n")               , [["prettier", ".pre-commit-config.yaml", "runs"]]],
		["a commented-out hook"        , hook("      # - id: ruff-format\n      # - id: black\n      - id: other\n"), []],
		["a ruff check hook only"      , hook("      - id: ruff-check\n")                                         , []],
		["ruff format in a comment"    , hook("      - id: lint\n        entry: ruff check # consider ruff format later\n"), []],
		["ruff format in a name"       , hook("      - id: lint\n        name: ruff format is disabled\n        entry: ruff check\n"), []],
		["ruff format in an exclude"   , hook('      - id: lint\n        entry: ruff check\n        exclude: "ruff format"\n'), []],
		["ruff format in an echo arg"  , hook('      - id: lint\n        entry: echo\n        args: ["ruff format"]\n'), []],
		["a similar hook id"           , hook("      - id: blackish\n")                                           , []],
		["malformed hooks"             , { ".pre-commit-config.yaml": "repos: [\n" }                              , []],
		["a ruff format section"       , { "pyproject.toml": "[tool.ruff.format]\nquote-style = 'double'\n" }     , [["ruff format", "pyproject.toml", "possible"]]],
		["a bare ruff section"         , { "pyproject.toml": "[tool.ruff]\nline-length = 88\n" }                  , [["ruff format", "pyproject.toml", "possible"]]],
		["a ruff lint section"         , { "pyproject.toml": "[tool.ruff.lint]\nselect = ['E']\n" }               , [["ruff format", "pyproject.toml", "possible"]]],
		["a ruff.toml"                 , { "ruff.toml": "line-length = 88\n" }                                    , [["ruff format", "ruff.toml", "possible"]]],
		["a similar section name"      , { "pyproject.toml": "[tool.blackish]\n[tool.ruffle]\n" }                 , []],
		["headers in a toml string"    , { "pyproject.toml": 'sample = """\n[tool.black]\n[tool.ruff.format]\n"""\n' }, []],
		["headers in a toml comment"   , { "pyproject.toml": "# [tool.black]\n" }                                 , []],
		["prettier in a quoted echo"   , { "package.json": '{"scripts":{"a":"echo \\"done; prettier --write .\\""}}' }, []],
		["ruff format after a comment" , { "package.json": '{"scripts":{"a":"echo done # ; ruff format ."}}' }, []],
		["a quoted prettier"           , { "package.json": '{"scripts":{"a":"\\"prettier\\" --write ."}}' }, [["prettier", "package.json", "runs"]]],
		["a chained formatter"         , { "package.json": '{"scripts":{"a":"tsc && prettier --write ."}}' }, [["prettier", "package.json", "runs"]]],
		["an escaped shell separator"  , { "package.json": JSON.stringify({ scripts: { a: String.raw`echo done \; prettier --write .` } }) }, []],
		["a newline-separated command", { "package.json": JSON.stringify({ scripts: { a: "echo done\nprettier --write ." } }) }, [["prettier", "package.json", "runs"]]],
		["a command after a comment"   , { "package.json": JSON.stringify({ scripts: { a: "echo done # note\nprettier --write ." } }) }, [["prettier", "package.json", "runs"]]],
		["a continued echo command"    , { "package.json": JSON.stringify({ scripts: { a: "echo done \\\nprettier --write ." } }) }, []],
		["a continued formatter name"  , { "package.json": JSON.stringify({ scripts: { a: "prett\\\nier --write ." } }) }, [["prettier", "package.json", "runs"]]],
		["an escaped double quote"     , { "package.json": JSON.stringify({ scripts: { a: String.raw`echo "done \"; prettier --write ."` } }) }, []],
		["a backslash in single quotes", { "package.json": JSON.stringify({ scripts: { a: String.raw`echo 'done \'; prettier --write .` } }) }, [["prettier", "package.json", "runs"]]],
		["an escaped toml quote"       , { "pyproject.toml": 'sample = """\n\\"""\n[tool.black]\n"""\n' }, []],
		["a quote in a toml comment"   , { "pyproject.toml": '# """\n[tool.black]\n' }                    , [["black", "pyproject.toml", "possible"]]],
		["an inherited hook id"        , hook("      - id: toString\n      - id: __proto__\n")            , []],
		["a hook beating a section"    , { "pyproject.toml": "[tool.ruff]\n", ...hook("      - id: ruff-format\n") }, [["ruff format", ".pre-commit-config.yaml", "runs"]]],
	];
	for (const [name, files, expected] of cases) {
		test(name, () => {
			expect(detectFormatters(project(files)).map(entry => [entry.name, entry.evidence, entry.certainty])).toEqual(expected.map(row => [...row]));
		});
	}

	test("a linked config is not followed", () => {
		const root = project();
		symlinkSync("/etc/hosts", join(root, ".prettierrc"));
		expect(detectFormatters(root)).toEqual([]);
	});

	test("oversized and blank-heavy configs are handled quickly", () => {
		const root = project        ({ ".pre-commit-config.yaml": `${"\n".repeat(200_000)}repos: []\n`, "pyproject.toml": "[tool.black]\n".padEnd(300 * 1024, " ") }) ;
		const from = performance.now()                                                                                                                                ;

		expect(detectFormatters(root)      ).toEqual   ([]  ) ;
		expect(performance.now() - from    ).toBeLessThan(1000) ;
	});

	test("the possible wording does not claim that ruff format runs", () => {
		const possible = formatterWarning({ name: "ruff format", evidence: "pyproject.toml", certainty: "possible"}) ;
		const runs     = formatterWarning({ name: "ruff format", evidence: "pyproject.toml", certainty: "runs"    }) ;

		expect(possible).toContain("may be in use"         ) ;
		expect(possible).toContain("If the project runs it") ;
		expect(runs    ).toContain("ruff format runs from" ) ;
		expect(runs    ).toContain("--directory"           ) ;
	});

	test("matches only a recognizable configured invocation of the detected formatter", () => {
		const cases = [
			["prettier", join("tools", "prettier"), ["--write", "{file}"], true],
			["ruff format", join("tools", "ruff.exe"), ["format", "{file}"], true],
			["black", join("tools", "python3"), ["-m", "black", "{file}"], true],
			["ruff format", join("tools", "bun"), [join("tools", "ruff"), "format", "{file}"], true],
			["ruff format", "black", ["{file}"], false],
			["black", "python3", ["-m", "ruff", "format", "{file}"], false],
			["prettier", "node", ["unknown-wrapper.mjs", "{file}"], false],
			["black", "echo", ["black", "{file}"], false],
		] as const;
		for (const [name, command, args, expected] of cases) {
			expect(formatterConfigured({ name, evidence: "synthetic", certainty: "possible" }, { command, args, timeoutMs: 2_000 })).toBe(expected);
		}
		expect(formatterConfigured({ name: "black", evidence: "pyproject.toml", certainty: "possible" }, undefined)).toBe(false);
	});
});

describe("doctor and init", () => {
	test("doctor warns about a detected formatter without changing its result", () => {
		const root  = project   (RUFF_HOOK                 ) ;
		const run   = invoke    (root, ["doctor", "--json"]) ;
		const value = JSON.parse(run.stdout                ) ;

		expect(run.status                     )    .toBe     (0                                                                                       ) ;
		expect(value.ok                       )    .toBe     (true                                                                                    ) ;
		expect(value.detectedFormatters       )    .toEqual  ([{ name: "ruff format", evidence: ".pre-commit-config.yaml", certainty: "runs" }]       ) ;
		expect(value.warnings[0]              )    .toContain("reverts BoxBox alignment"                                                              ) ;
		expect(value.checks.formatter.detail  ).not.toContain("no external formatter required"                                                        ) ;
		expect(invoke(root, ["doctor"]).stdout)    .toContain("warning: ruff format runs from"                                                        ) ;
	}, 60_000);

	test("align warns when writing a language the detected formatter rewrites, and only then", () => {
		const python  = project({ ...RUFF_HOOK, "a.py": "alpha = 1\nmuch_longer = 22\nmid = 333\n", "b.ts": "const a = 1;\nconst bb = 2;\n" }) ;
		const written = invoke (python, ["align", "--file", "a.py"]                                                                          ) ;

		expect(written.status                                                                                ).toBe        (0                               ) ;
		expect(written.stdout                                                                                ).toContain   ("warning: ruff format runs from") ;
		expect(JSON.parse(invoke(python, ["align", "--file", "a.py", "--dry-run", "--json"]).stdout).warnings).toHaveLength(1                               ) ;
		expect(JSON.parse(invoke(python, ["align", "--file", "b.ts", "--dry-run", "--json"]).stdout).warnings).toEqual     ([]                              ) ;

		const typescript = project({ ".prettierrc": "{}", "b.ts": "const a = 1;\nconst bb = 2;\n", "a.py": "alpha = 1\nmuch_longer = 22\nmid = 333\n" });
		expect(JSON.parse(invoke(typescript, ["align", "--file", "b.ts", "--dry-run", "--json"]).stdout).warnings).toHaveLength(1);
		expect(JSON.parse(invoke(typescript, ["align", "--file", "a.py", "--dry-run", "--json"]).stdout).warnings).toEqual([]);
	}, 60_000);

	test("doctor stays quiet without a formatter", () => {
		const value = JSON.parse(invoke(project(), ["doctor", "--json"]).stdout);

		expect(value.warnings              ).toEqual  ([]                                ) ;
		expect(value.checks.formatter.detail).toContain("no external formatter required") ;
	}, 60_000);

	test("init warns, and detection writes nothing else", () => {
		const root = project({ "pyproject.toml": "[tool.black]\n" }) ;
		const run  = invoke (root, ["init"]                        ) ;

		expect(run.status                                                  ).toBe        (0                                              ) ;
		expect(run.stdout                                                  ).toContain   ("created .boxbox/config.json"                  ) ;
		expect(run.stdout                                                  ).toContain   ("warning: black may be in use (pyproject.toml)") ;
		expect(readdirSync(root).sort()                                    ).toEqual     ([".boxbox", ".git", "pyproject.toml"]          ) ;
		expect(JSON.parse(invoke(root, ["init", "--json"]).stdout).warnings).toHaveLength(1                                              ) ;
	}, 60_000);
});
