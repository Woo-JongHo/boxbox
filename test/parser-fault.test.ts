import      { afterAll, beforeAll, describe, expect, test } from "bun:test"                ;
import      {
              chmodSync                                 ,
              mkdirSync                                 ,
              mkdtempSync                               ,
              readFileSync                              ,
              rmSync                                    ,
              writeFileSync                             ,
                                                          } from "node:fs"                 ;
import      { tmpdir                                      } from "node:os"                 ;
import      { join, resolve                               } from "node:path"               ;
import      { parserAvailable                             } from "@/common/parse-check.ts" ;

const ROOT   = resolve(import.meta.dir, "..")                                     ;
const BUN    = process.execPath                                                   ;
const SCRIPT = join(ROOT, "product/engine/python/06_align-tables.ts")             ;
const MODULE = join(ROOT, "product/engine/common/parse-check.ts")                 ;
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
	writeFileSync(executable, `#!${BUN}\nimport { unlinkSync } from "node:fs";\nif (process.argv.includes("--version")) {\n if (process.env.FAKE_MODE === "probe-timeout") { const end = Date.now() + 5_000; while (Date.now() < end) { /* spin past the probe timeout */ } }\n if (process.env.FAKE_MODE === "vanish") unlinkSync(process.argv[1]);\n process.exit(0);\n}\nswitch (process.env.FAKE_MODE) {\n case "failure": console.error("internal failure"); process.exit(2);\n case "failure-error": console.error("1: error: internal failure"); process.exit(2);\n case "rust-empty": process.exit(1);\n case "rust-source-failure": console.log("error_macro!();"); process.exit(1);\n case "signal": process.kill(process.pid, "SIGTERM"); break;\n case "timeout": setInterval(() => {}, 1_000); break;\n case "output": process.stdout.write("x".repeat(2_000_000)); break;\n default: process.exit(0);\n}\n`);
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

	test("refuses rustfmt status 1 without a recognized diagnostic", () => {
		const run = runCompare("rust-empty", 60_000, "rust", "rustfmt");
		expect(run.exitCode).toBe(7);
		expect(run.stderr?.toString()).toContain("unrecognized status");
	});

	test("formatted Rust source cannot disguise an unexplained parser failure", () => {
		const run = runCompare("rust-source-failure", 60_000, "rust", "rustfmt");
		expect(run.exitCode).toBe(7);
		expect(run.stderr?.toString()).toContain("unrecognized status");
	});

	test("BOXBOX_REQUIRE_PARSERS=0 cannot bypass writing without a parser", () => {
		const target = join(scratch, "missing.py") ;
		const empty  = join(scratch, "empty-path") ;
		mkdirSync(empty);
		writeFileSync(target, SOURCE);

		const run = runCli(empty, target);
		expect(run.exitCode                ).not.toBe     (0                            ) ;
		expect(run.stderr?.toString()      )    .toContain("parser unavailable: python3") ;
		expect(readFileSync(target, "utf8"))    .toBe     (SOURCE                       ) ;
	});

	test("when the parser exits abnormally, the real Python CLI preserves the original bytes", () => {
		const target = join(scratch, "failure.py");
		writeFileSync(target, SOURCE);

		const run = runCli(fakePath("failure-cli"), target);
		expect(run.exitCode                ).not.toBe     (0                    ) ;
		expect(run.stderr?.toString()      )    .toContain("unrecognized status") ;
		expect(readFileSync(target, "utf8"))    .toBe     (SOURCE               ) ;
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
