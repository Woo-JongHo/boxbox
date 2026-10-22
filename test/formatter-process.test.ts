import      { afterEach, describe, expect, test                 } from "bun:test"                      ;
import      { chmodSync, existsSync, mkdtempSync                } from "node:fs"                       ;
import      { readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"                       ;
import      { tmpdir                                            } from "node:os"                       ;
import      { basename, dirname, join                           } from "node:path"                     ;

import      { resolveFormatterExecutable, runFormatterProcess   } from "@/common/formatter-process.ts" ;

const roots: string[] = []                  ;
const initialPath     = process.env.PATH    ;
const initialExt      = process.env.PATHEXT ;

afterEach(() => {
	process.env.PATH = initialPath;
	if (initialExt === undefined) delete process.env.PATHEXT;
	else process.env.PATHEXT = initialExt;

	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function workspace(): string {
	const root = mkdtempSync(join(tmpdir(), "boxbox-process-"));
	roots.push(root);

	return root;
}

function script(root: string, source: string, name = "formatter.cjs"): string {
	const file = join(root, name);
	writeFileSync(file, source);

	return file;
}

describe("formatter process execution", () => {
	test("resolves the actual runtime through PATH and explicit paths", () => {
		const root = workspace();
		process.env.PATH = dirname(process.execPath);
		if (process.platform === "win32") process.env.PATHEXT = ".EXE;.CMD";

		const command = process.platform === "win32" ? basename(process.execPath).replace(/\.exe$/iu, "") : basename(process.execPath) ;
		const direct  = resolveFormatterExecutable(process.execPath, root)                                                             ;

		expect(resolveFormatterExecutable(command, root)                         ).toEqual(direct                        ) ;
		expect(direct.path                                                       ).toBe   (realpathSync(process.execPath)) ;
		expect(direct.fingerprint                                                ).toMatch(/^[a-f0-9]{64}$/u             ) ;
		expect(() => resolveFormatterExecutable("boxbox-missing-formatter", root)).toThrow("executable not found"        ) ;
	});

	test("detects replacement of a resolved formatter", () => {
		const root = workspace()                                                ;
		const file = script   (root, "#!/usr/bin/env node\nprocess.exit(0);\n") ;
		chmodSync(file, 0o755);

		const first = resolveFormatterExecutable(file, root);
		writeFileSync(file, "#!/usr/bin/env node\nprocess.exit(12);\n");

		expect(resolveFormatterExecutable(file, root).fingerprint).not.toBe(first.fingerprint);
	});

	test("passes spaces and shell metacharacters as literal arguments", async () => {
		const root   = workspace()                                                                                                                          ;
		const file   = join(root, "source & echo injected.py")                                                                                              ;
		const runner = script(root, "require('node:fs').writeFileSync(process.argv[2], JSON.stringify(process.argv.slice(2)));", "formatter & literal.cjs") ;
		const args   = [runner, "{file}", "$(touch injected)", "a&b|c", "quotes\"'", "C:\\path with spaces\\"]                                              ;
		const result = await runFormatterProcess(process.execPath, { command: process.execPath, args, timeoutMs: 5_000 }, file, root)                       ;

		expect(result.exitCode                       ).toBe   (0                       ) ;
		expect(result.timedOut                       ).toBe   (false                   ) ;
		expect(JSON.parse(readFileSync(file, "utf8"))).toEqual([file, ...args.slice(2)]) ;
		expect(existsSync(join(root, "injected"))    ).toBe   (false                   ) ;
	});

	test("bounds each output stream and retains nonzero exit status", async () => {
		const root   = workspace()                                                                                                                                           ;
		const runner = script(root, "process.stdout.write('o'.repeat(100000)); process.stderr.write('e'.repeat(100000)); process.exitCode = 7;")                             ;
		const result = await runFormatterProcess(process.execPath, { command: process.execPath, args: [runner, "{file}"], timeoutMs: 5_000 }, join(root, "sample.py"), root) ;

		expect(result.exitCode     ).toBe(7        ) ;
		expect(result.stdout.length).toBe(64 * 1024) ;
		expect(result.stderr.length).toBe(64 * 1024) ;
		expect(result.truncated    ).toBe(true     ) ;
	});

	test("a timeout kills descendants before a delayed write can reach the working file", async () => {
		const root   = workspace()                                                                                                                                                                                                                                   ;
		const file   = join(root, "working.py")                                                                                                                                                                                                                      ;
		const ready  = join(root, "descendant-ready")                                                                                                                                                                                                                ;
		const child  = script(root, `const fs = require('node:fs'); fs.writeFileSync(process.argv[3], 'ready'); process.on('SIGTERM', () => {}); setTimeout(() => fs.writeFileSync(process.argv[2], 'late'), 1800); setInterval(() => {}, 1000);`, "descendant.cjs") ;
		const runner = script(root, `require('node:child_process').spawn(process.execPath, [${JSON.stringify(child)}, process.argv[2], ${JSON.stringify(ready)}], { stdio: 'inherit' }); setInterval(() => {}, 1000);`)                                              ;
		const result = await runFormatterProcess(process.execPath, { command: process.execPath, args: [runner, "{file}"], timeoutMs: 1_000 }, file, root)                                                                                                            ;

		expect(existsSync(ready)).toBe(true);
		expect(result.timedOut).toBe(true);

		await new Promise(accept => setTimeout(accept, 1_100));

		expect(existsSync(file)).toBe(false);
	}, 15_000);

	test("spawn errors reject rather than reporting formatter success", async () => {
		const root = workspace();

		await expect(runFormatterProcess(join(root, "missing-executable"), { command: "missing-executable", args: ["{file}"], timeoutMs: 500 }, "sample.py", root)).rejects.toThrow();
	});
});

// These cases run on a native Windows runner; POSIX test results do not establish Windows acceptance.
if (process.platform === "win32") {
	describe("native Windows formatter commands", () => {
		test("executes an explicit Node entry without a shell or executable permission bit", async () => {
			const root       = workspace()                                                                                                    ;
			const file       = join(root, "literal & sample.py")                                                                              ;
			const entry      = script(root, "require('node:fs').writeFileSync(process.argv[2], 'native-node-entry');")                        ;
			const executable = resolveFormatterExecutable(entry, root)                                                                        ;
			const result     = await runFormatterProcess(executable.path, { command: entry, args: ["{file}"], timeoutMs: 5_000 }, file, root) ;

			expect(result.exitCode).toBe(0);
			expect(readFileSync(file, "utf8")).toBe("native-node-entry");
		});

		test("refuses batch shims with an actionable alternative", () => {
			const root  = workspace()                                                                  ;
			const entry = script   (root, "@echo off\r\necho should-not-execute\r\n", "formatter.cmd") ;
			process.env.PATH = root;
			process.env.PATHEXT = ".CMD;.EXE";

			expect(() => resolveFormatterExecutable(entry, root)).toThrow("configure node.exe");
			expect(() => resolveFormatterExecutable("formatter", root)).toThrow("configure node.exe");
		});
	});
}
