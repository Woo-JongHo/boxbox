import      { afterAll, beforeAll, describe, expect, test } from "bun:test"                   ;
import      {
              chmodSync                                 ,
              existsSync                                ,
              mkdirSync                                 ,
              mkdtempSync                               ,
              readFileSync                              ,
              rmSync                                    ,
              writeFileSync                             ,
                                                          } from "node:fs"                    ;
import      { tmpdir                                      } from "node:os"                    ;
import      { join, resolve                               } from "node:path"                  ;
import      { parserAvailable                             } from "@/common/08_parse-check.ts" ;

const ROOT   = resolve(import.meta.dir, "..")                                     ;
const BUN    = process.execPath                                                   ;
const SCRIPT = join(ROOT, "product/engine/python/02_align-tables.ts")             ;
const MODULE = join(ROOT, "product/engine/common/08_parse-check.ts")              ;
const SOURCE = readFileSync(join(ROOT, "test/fixtures/python/tables.py"), "utf8") ;

let scratch = "";

beforeAll(() => {
	scratch = mkdtempSync(join(tmpdir(), "boxbox-parser-fault-"));
});

afterAll(() => {
	rmSync(scratch, { recursive: true, force: true });
});

function fakePath(mode: string, tool = "python3"): string {
	const directory  = join(scratch  , mode) ;
	const executable = join(directory, tool) ;
	mkdirSync(directory, { recursive: true });
	writeFileSync(executable, `#!${BUN}\nimport { unlinkSync } from "node:fs";\nif (process.argv.includes("--version")) {\n if (process.env.FAKE_MODE === "probe-timeout") { const end = Date.now() + 5_000; while (Date.now() < end) { /* spin past the probe timeout */ } }\n if (process.env.FAKE_MODE === "vanish") unlinkSync(process.argv[1]);\n process.exit(0);\n}\nswitch (process.env.FAKE_MODE) {\n case "failure": console.error("internal failure"); process.exit(2);\n case "failure-error": console.error("1: error: internal failure"); process.exit(2);\n case "signal": process.kill(process.pid, "SIGTERM"); break;\n case "timeout": setInterval(() => {}, 1_000); break;\n case "output": process.stdout.write("x".repeat(2_000_000)); break;\n default: process.exit(0);\n}\n`);
	chmodSync(executable, 0o755);
	return directory;
}

function runCompare(mode: string, timeoutMs = 60_000, language = "python", tool = "python3"): ReturnType<typeof Bun.spawnSync> {
	const path    = fakePath(mode, tool)                                                                                                                                                                                                                                                          ;
	const program = `import { compareParse } from ${JSON.stringify(MODULE)};\ntry { compareParse(${JSON.stringify(language)}, "a = 1\\n", "a  = 1\\n", { timeoutMs: ${timeoutMs} }); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exit(7); }` ;
	return Bun.spawnSync([BUN, "-e", program], {
		env    : { ...process.env, FAKE_MODE: mode, PATH: path, BOXBOX_REQUIRE_PARSERS: "0" } ,
		stderr : "pipe"                                                                       ,
		stdout : "pipe"                                                                       ,
	});
}

function runCli(path: string, target: string): ReturnType<typeof Bun.spawnSync> {
	return Bun.spawnSync([BUN, SCRIPT, "--file", target, "--write"], {
		cwd    : ROOT                                                                              ,
		env    : { ...process.env, FAKE_MODE: "failure", PATH: path, BOXBOX_REQUIRE_PARSERS: "0" } ,
		stderr : "pipe"                                                                            ,
		stdout : "pipe"                                                                            ,
	});
}

describe("parser faults close before writing", () => {
	for (const [mode, message, timeout] of [
		["empty", "invalid response", 60_000],
		["failure", "unrecognized status", 60_000],
		["failure-error", "unrecognized status", 60_000],
		["signal" , "signal"             , 60_000],
		["timeout", "execution failed"   , 2_000 ],
		["probe-timeout", "parser unavailable", 50],
		["output" , "execution failed"   , 60_000],
		["vanish" , "execution failed"   , 60_000],
	] as const) {
		test(`${mode}: reports an execution fault as an error`, () => {
			const run = runCompare(mode, timeout);
			expect(run.exitCode).toBe(7);
			expect(run.stderr?.toString()).toContain(message);
		});
	}

	test("BOXBOX_REQUIRE_PARSERS=0 cannot bypass writing without a parser", () => {
		const target = join(scratch, "missing.py") ;
		const empty  = join(scratch, "empty-path") ;
		mkdirSync(empty);
		writeFileSync(target, SOURCE);

		const run = runCli(empty, target);
		expect(run.exitCode                ).not.toBe     (0                              ) ;
		expect(run.stderr?.toString()      )    .toContain("Python source analysis failed") ;
		expect(readFileSync(target, "utf8"))    .toBe     (SOURCE                         ) ;
	});

	test("when the parser exits abnormally, the real Python CLI preserves the original bytes", () => {
		const target = join(scratch, "failure.py");
		writeFileSync(target, SOURCE);

		const run = runCli(fakePath("failure-cli"), target);
		expect(run.exitCode                ).not.toBe     (0                              ) ;
		expect(run.stderr?.toString()      )    .toContain("Python source analysis failed") ;
		expect(readFileSync(target, "utf8"))    .toBe     (SOURCE                         ) ;
	});

	test("the real Python parser lets successful output be written", () => {
		expect(parserAvailable("python")).toBe(true);
		const target = join(scratch, "success.py");
		writeFileSync(target, SOURCE);

		const run = Bun.spawnSync([BUN, SCRIPT, "--file", target, "--write"], { cwd: ROOT, stderr: "pipe", stdout: "pipe" });
		expect(run.exitCode).toBe(0);
		expect(readFileSync(target, "utf8")).not.toBe(SOURCE);
	});
});

test("a silent syntax-parser success closes public check before analysis", () => {
	const directory = join(scratch, "silent-syntax");
	mkdirSync(directory, { recursive: true });
	const python = Bun.which("python3");
	expect(python).not.toBeNull();
	const executable = join(directory, "python3");
	writeFileSync(executable, `#!${BUN}\nimport { readFileSync } from "node:fs";\nconst args=process.argv.slice(2);if(args.some(arg=>arg.includes("except SyntaxError as e:")))process.exit(0);const child=Bun.spawnSync([${JSON.stringify(python)},...args],{stdin:readFileSync(0),stdout:"pipe",stderr:"pipe"});process.stdout.write(child.stdout);process.stderr.write(child.stderr);process.exit(child.exitCode);\n`);
	chmodSync(executable, 0o755);
	const target = join(directory, "sample.py");
	for (const source of ["if:\n", "pass\n"]) {
		writeFileSync(target, source);
		const run = Bun.spawnSync([BUN, join(ROOT, "product/packages/cli/entry.ts"), "check", "--source", "--file", "sample.py", "--json"], {
			cwd: directory, env: { ...process.env, PATH: directory }, stdout: "pipe", stderr: "pipe",
		});
		expect(run.exitCode, run.stderr.toString()).toBe(2);
		const report = JSON.parse(run.stdout.toString());
		expect(report.syntax.status                ).toBe     ("error"           ) ;
		expect(report.syntax.diagnostics.join("\n")).toContain("invalid response") ;
		expect(report.results[0].parse.status      ).toBe     ("not-run"         ) ;
		expect(readFileSync(target, "utf8")        ).toBe     (source            ) ;
	}
});

for (const fault of ["parse", "ast"] as const) test(`raw CLI preserves bytes when the ${fault} write gate fails after analysis`, () => {
	const directory = join(scratch, `stage-${fault}`);
	mkdirSync(directory, { recursive: true });
	const executable = join     (directory, "python3"           ) ;
	const target     = join     (directory, `target-${fault}.py`) ;
	const log        = join     (directory, "stages.log"        ) ;
	const python     = Bun.which("python3"                      ) ;
	expect(python).not.toBeNull();
	const wrapper = `#!${BUN}\nimport { appendFileSync, readFileSync } from "node:fs";\nconst args=process.argv.slice(2); const code=args.join(" "); const stage=code.includes("tokenize.generate_tokens") ? "analysis" : code.includes("BOXBOX_AST_EQUAL") ? "ast" : code.includes("except SyntaxError as e:") ? "parse" : "other"; appendFileSync(process.env.STAGE_LOG,stage+"\\n"); if(stage===process.env.FAIL_STAGE){console.error("INJECTED_"+stage);process.exit(2)} const child=Bun.spawnSync([${JSON.stringify(python)},...args],{stdin:readFileSync(0),stdout:"pipe",stderr:"pipe"});process.stdout.write(child.stdout);process.stderr.write(child.stderr);process.exit(child.exitCode);\n`;
	writeFileSync(executable, wrapper);
	chmodSync(executable, 0o755);
	writeFileSync(target, "a=1\nlonger=2\nthird=3\n");
	const result = Bun.spawnSync([BUN, SCRIPT, "--file", target, "--write"], { cwd: directory, env: { ...process.env, PATH: directory, STAGE_LOG: log, FAIL_STAGE: fault }, stdout: "pipe", stderr: "pipe" }) ;
	const calls  = readFileSync(log, "utf8").trim().split("\n")                                                                                                                                               ;
	expect(result.exitCode             ).not.toBe     (0                                                                                              ) ;
	expect(calls[0]                    )    .toBe     ("analysis"                                                                                     ) ;
	expect(calls                       )    .toContain(fault                                                                                          ) ;
	expect(result.stderr.toString()    )    .toContain(fault === "parse" ? "parser exited with unrecognized status" : "Python structure parser failed") ;
	expect(readFileSync(target, "utf8"))    .toBe     ("a=1\nlonger=2\nthird=3\n"                                                                     ) ;
});

test("Python parser stages do not import project-owned stdlib shadow files", () => {
	const directory = join(scratch, "shadow-project");
	mkdirSync(directory, { recursive: true });
	for (const name of ["ast", "json", "token", "tokenize"]) {
		const marker = join(directory, `marker-${name}`);
		writeFileSync(join(directory, `${name}.py`), `open(${JSON.stringify(marker)}, 'w').write('loaded')\nraise RuntimeError('shadow imported')\n`);
	}
	const target = join(directory, "sample.py");
	writeFileSync(target, "a=1\nlonger=2\nthird=3\n");
	const raw = Bun.spawnSync([BUN, SCRIPT, "--file", target, "--write", "--json"], { cwd: directory, stdout: "pipe", stderr: "pipe" });
	expect(raw.exitCode).toBe(0);
	const publicEntry = join         (ROOT, "product/packages/cli/entry.ts"                                                                           ) ;
	const check       = Bun.spawnSync([BUN, publicEntry, "check", "--file", "sample.py", "--json"], { cwd: directory, stdout: "pipe", stderr: "pipe" }) ;
	expect(check.exitCode).toBe(0);
	for (const name of ["ast", "json", "token", "tokenize"]) expect(existsSync(join(directory, `marker-${name}`))).toBe(false);
});

test("NUL source returns raw and public syntax results without writing", () => {
	const directory = join(scratch, "nul-project");
	mkdirSync(directory, { recursive: true });
	const target = join       (directory, "sample.py") ;
	const bytes  = Buffer.from("a=1\n\u0000\n"       ) ;
	writeFileSync(target, bytes);
	const raw = Bun.spawnSync([BUN, SCRIPT, "--file", target, "--write", "--json"], { cwd: directory, stdout: "pipe", stderr: "pipe" });
	expect(raw.exitCode).toBe(1);
	expect(JSON.parse(raw.stdout.toString()).results[0].parse.status).toBe("changed");
	const entry = join         (ROOT, "product/packages/cli/entry.ts"                                                                     ) ;
	const check = Bun.spawnSync([BUN, entry, "check", "--file", "sample.py", "--json"], { cwd: directory, stdout: "pipe", stderr: "pipe" }) ;
	expect(check.exitCode                                   ).toBe(2        ) ;
	expect(JSON.parse(check.stdout.toString()).syntax.status).toBe("invalid") ;
	expect(readFileSync(target).equals(bytes)               ).toBe(true     ) ;
});
