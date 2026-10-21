import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { APPROVAL_VERSIONS } from "@/common/approval-gate.ts";

const repository           = resolve(import.meta.dir, "..")            ;
const cli                  = join(repository, "product/engine/cli.ts") ;
const workspaces: string[] = []                                        ;

function workspace(): string {
	const root = mkdtempSync(join(tmpdir(), "boxbox-authoring-modes-"));
	workspaces.push(root);
	return root;
}

function invoke(root: string, args: string[]) {
	const source = `import { runCli } from ${JSON.stringify(cli)}; process.exitCode = await runCli(JSON.parse(process.env.BOXBOX_TEST_ARGS!), process.cwd());`;
	const result = Bun.spawnSync([process.execPath, "-e", source], {
		cwd: root, env: { ...process.env, XDG_CONFIG_HOME: join(root, "user-config"), BOXBOX_TEST_ARGS: JSON.stringify(args) },
		stdout: "pipe", stderr: "pipe",
	});
	const output = result.stdout.toString();
	expect(output.trim().split("\n"), result.stderr.toString()).toHaveLength(1);
	return { code: result.exitCode, value: JSON.parse(output), output };
}

afterEach(() => {
	for (const root of workspaces.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("matrix authoring and alignment modes", () => {
	test("new-file guidance includes only scoped proved rules with their exact contracts and counterexamples", () => {
		for (const [file, language, id] of [["new/deep/code.ts", "typescript", "ts-sourcefile-call-declarations"], ["new/deep/code.py", "python", "py-simple-assignments"]]) {
			const root   = workspace()                                                       ;
			const result = invoke(root, ["guide", "--file", file!, "--authoring", "--json"]) ;

			expect(result.code                                     ).toBe         (0                                                                                ) ;
			expect(result.value                                    ).toMatchObject({ basis: "authoring", language, verification: "not-run", writeAuthorized: false }) ;
			expect(result.value.rules                              ).toHaveLength (1                                                                                ) ;
			expect(result.value.rules[0]                           ).toMatchObject({ id, scope: language === "python" ? "**/*.py" : "**/*.ts" }                     ) ;
			expect(result.value.rules[0].examples                  ).toHaveLength (1                                                                                ) ;
			expect(result.value.rules[0].counterexamples[0].verdict).toBe         ("bad"                                                                            ) ;
			expect(result.value.rules[0].contract                  ).toContain    (language === "python" ? "Three or more" : "Two or more"                          ) ;
			expect(existsSync(join(root, "new"))                   ).toBe         (false                                                                            ) ;
			expect(existsSync(join(root, ".boxbox"))               ).toBe         (false                                                                            ) ;
		}
	});

	test("authoring guidance is read-only advice even for empty or invalid existing source", () => {
		const root = workspace();
		for (const source of ["", "def broken(:\n"]) {
			writeFileSync(join(root, "code.py"), source);
			const result = invoke(root, ["guide", "--file", "code.py", "--authoring", "--json"]);

			expect(result.code                                ).toBe(0        ) ;
			expect(result.value.verification                  ).toBe("not-run") ;
			expect(result.value.writeAuthorized               ).toBe(false    ) ;
			expect(readFileSync(join(root, "code.py"), "utf8")).toBe(source   ) ;
		}
		writeFileSync(join(root, "code.py"), "");
		const detected = invoke(root, ["guide", "--file", "code.py", "--json"]);

		expect(detected.code).toBe(1);
		expect(detected.value.guides).toEqual([]);
	});

	test("authoring scope and project rejection override the shipped rule without falling back", () => {
		const root = workspace();
		mkdirSync(join(root, ".boxbox"));
		const preset = JSON.parse(readFileSync(join(repository, "product/rules/presets/recommended/conventions.jsonl"), "utf8").trim().split("\n")[1]!) ;
		const record = { ...preset, id: "local-python", scope: "blocked/**", versions: APPROVAL_VERSIONS }                                              ;
		for (const status of ["rejected", "candidate", "approved"]) {
			writeFileSync(join(root, ".boxbox/conventions.jsonl"), JSON.stringify({ ...record, status }) + "\n");
			const denied  = invoke(root, ["guide", "--file", "blocked/code.py", "--authoring", "--json"]) ;
			const allowed = invoke(root, ["guide", "--file", "allowed/code.py", "--authoring", "--json"]) ;

			expect(denied.code, status).toBe(1);
			expect(denied.value.rules                        ).toEqual        ([]                     ) ;
			expect(denied.value.unavailable[0].reasons.length).toBeGreaterThan(0                      ) ;
			expect(allowed.code                              ).toBe           (0                      ) ;
			expect(allowed.value.rules[0].id                 ).toBe           ("py-simple-assignments") ;
		}
		const outsideScope = invoke(root, ["guide", "--file", "new.tsx", "--authoring", "--json"]);

		expect(outsideScope.code).toBe(1);
		expect(outsideScope.value.rules).toEqual([]);
	});

	test("new-file guidance rejects unsafe paths, unsupported formats and disabled languages", () => {
		const root    = workspace() ;
		const outside = workspace() ;
		symlinkSync(outside, join(root, "linked"));
		symlinkSync(join(outside, "absent"), join(root, "dangling"));
		mkdirSync(join(root, "directory.py"));
		for (const file of ["../escape.py", "linked/new.py", "dangling/new.py", "directory.py", "file.toml", "file.xml"]) {
			const result = invoke(root, ["guide", "--file", file, "--authoring", "--json"]);

			expect(result.code, file).toBe(2);
			expect(result.value.ok).toBe(false);
		}
		mkdirSync(join(root, ".boxbox"));
		writeFileSync(join(root, ".boxbox/config.json"), JSON.stringify({ schemaVersion: 2, languages: ["typescript"] }));
		const disabled = invoke(root, ["guide", "--file", "new.py", "--authoring", "--json"]);

		expect(disabled.code                      ).toBe(2                  ) ;
		expect(disabled.value.error.code          ).toBe("LANGUAGE_DISABLED") ;
		expect(existsSync(join(outside, "new.py"))).toBe(false              ) ;
	});

	test("only authoring GUIDE accepts nonexistent files; mode and language errors stay explicit", () => {
		const root = workspace();
		for (const args of [
			["guide", "--file", "new.py"], ["align", "--file", "new.py"],
			["check", "--file", "new.py", "--authoring"],
			["guide", "--file", "new.py", "--authoring", "--language", "typescript"],
			["guide", "--file", "new.py", "--authoring", "--authoring"],
			["write", "--file", "new.py"], ["refactor", "--file", "new.py"],
		]) {
			expect(invoke(root, [...args, "--json"]).code, args.join(" ")).toBe(2);
		}
	});

	test("align previews and applies approved whitespace changes without executing a configured formatter", () => {
		const root      = workspace()                                                           ;
		const path      = join(root, "code.py")                                                 ;
		const before    = "if enabled:\r\n  alpha = 1\r\n  much_longer = 22\r\n  mid = 333\r\n" ;
		const formatter = join(root, "formatter.mjs")                                           ;
		const marker    = join(root, "formatter-ran")                                           ;
		mkdirSync(join(root, ".boxbox"));
		writeFileSync(path, before);
		writeFileSync(formatter, `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'ran'); process.exit(7);`);
		writeFileSync(join(root, ".boxbox/config.json"), JSON.stringify({ schemaVersion: 2, formatters: { python: { command: process.execPath, args: [formatter, "{file}"], timeoutMs: 5000 } } }));
		const preview = invoke(root, ["align", "--file", "code.py", "--dry-run", "--json"]);

		expect(preview.code, preview.output).toBe(0);
		expect(preview.value).toMatchObject({ command: "align", mode: "align", horizontalWhitespaceOnly: true, formatterExecuted: false, formatter: null, written: false, fixedPoint: true });
		expect(preview.value.alignmentEdits).toEqual([
			{ line: 2, before: "  alpha = 1", after: "  alpha       = 1" },
			{ line: 4, before: "  mid = 333", after: "  mid         = 333" },
		]);
		expect(readFileSync(path, "utf8")).toBe(before);
		expect(existsSync(marker)).toBe(false);
		const applied = invoke(root, ["align", "--file", "code.py", "--json"]);

		expect(applied.code, applied.output).toBe(0);
		expect(applied.value.written                                               ).toBe(true                                                                               ) ;
		expect(readFileSync(path, "utf8")                                          ).toBe("if enabled:\r\n  alpha       = 1\r\n  much_longer = 22\r\n  mid         = 333\r\n") ;
		expect(existsSync(marker)                                                  ).toBe(false                                                                              ) ;
		expect(invoke(root, ["align", "--file", "code.py", "--json"]).value.written).toBe(false                                                                              ) ;
		const legacy = invoke(root, ["format", "--file", "code.py", "--dry-run", "--json"]);

		expect(legacy.code).toBe(2);
		expect(existsSync(marker)).toBe(true);
	});

	test("align refuses a file without applicable groups rather than reporting completed authoring", () => {
		const root = workspace();
		writeFileSync(join(root, "code.py"), "single = 1\n");
		const result = invoke(root, ["align", "--file", "code.py", "--json"]);

		expect(result.code                                ).toBe(2                   ) ;
		expect(result.value.error.code                    ).toBe("ALIGN_NOT_ELIGIBLE") ;
		expect(readFileSync(join(root, "code.py"), "utf8")).toBe("single = 1\n"      ) ;
	});
});
