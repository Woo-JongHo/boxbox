import { afterAll, expect, test                                                  } from "bun:test"           ;
import { spawnSync                                                               } from "node:child_process" ;
import {
         copyFileSync                                                            ,
         existsSync                                                              ,
         mkdtempSync                                                             ,
         readFileSync                                                            ,
         rmSync                                                                  ,
         writeFileSync                                                           ,
                                                                                   } from "node:fs"            ;
import { tmpdir                                                                  } from "node:os"            ;
import { join, resolve                                                           } from "node:path"          ;
import { pathToFileURL                                                           } from "node:url"           ;

const READINESS       = pathToFileURL(resolve(import.meta.dir, "../product/installer/readiness.mjs")).href                ;
const NODE            = spawnSync("node", ["-p", "process.execPath"], { encoding: "utf8", timeout: 5_000 }).stdout.trim() ;
const SOURCE          = "a = 1\nlonger = 22\nmid = 333\n"                                                                 ;
const roots: string[] = []                                                                                                ;

const DOCTOR = {
	schemaVersion    : 1        ,
	tool             : "boxbox" ,
	command          : "doctor" ,
	ok               : true     ,
	runtimeUsable    : true     ,
	formatConfigured : true     ,
	checks           : {
		runtime   : { ok: true, detail: "supported Node" }                     ,
		python    : { ok: true, detail: "Python 3 fixture" }                   ,
		config    : { ok: true, detail: "schema 2 defaults" }                  ,
		approval  : { ok: true, detail: "approved convention records loaded" } ,
		formatter : { ok: true, detail: "standalone alignment" }               ,
	},
};
const CHECK = {
	schemaVersion   : 1                                                                                                        ,
	tool            : "boxbox"                                                                                                 ,
	results         : [{ language: "python", summary: { groups: 1, misaligned: 1 }, groups: [{ state: "FIXABLE", rows: 3 }] }] ,
	syntax          : { status: "valid", tool: "python3", diagnostics: [] }                                                    ,
	formatReadiness : { approvalEligible: true, approvedFixableGroups: 1 }                                                     ,
};

type Scenario = {
	doctor?      : unknown                                              ;
	doctorText?  : string                                               ;
	doctorExit?  : number                                               ;
	check?       : unknown                                              ;
	checkText?   : string                                               ;
	checkExit?   : number                                               ;
	checkAction? : "mutate" | "remove" | "signal" | "overflow" | "hang" ;
	missing?     : boolean                                              ;
	corrupt?     : boolean                                              ;
};
type Call = {
	args    : string[] ;
	cwd     : string   ;
	config  : string   ;
	source? : string   ;
};

afterAll(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }); });

function probe(scenario: Scenario = {}, environment: NodeJS.ProcessEnv = {}) {
	const root = mkdtempSync(join(tmpdir(), "boxbox readiness test "));

	roots.push(root);

	const cli    = join(root, "engine.mjs")                                                   ;
	const runner = join(root, "runner.mjs")                                                   ;
	const log    = join(root, "calls.jsonl")                                                  ;
	const config = { doctor: DOCTOR, check: CHECK, doctorExit: 0, checkExit: 1, ...scenario } ;

	if (!scenario.missing) writeFileSync(cli, scenario.corrupt ? "this is not JavaScript" : `
import { appendFileSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
const scenario = ${JSON.stringify(config)};
const args = process.argv.slice(2);
const file = args[args.indexOf('--file') + 1];
const entry = { args, cwd: process.cwd(), config: process.env.XDG_CONFIG_HOME };
if (args[0] === 'check') entry.source = readFileSync(file, 'utf8');
appendFileSync(${JSON.stringify(log)}, JSON.stringify(entry) + '\\n');
if (args[0] === 'doctor') {
	process.stdout.write(scenario.doctorText ?? JSON.stringify(scenario.doctor));
	process.exit(scenario.doctorExit);
}
if (args[0] !== 'check') throw new Error('unexpected command');
if (scenario.checkAction === 'mutate') writeFileSync(file, 'changed source\\n');
if (scenario.checkAction === 'remove') unlinkSync(file);
if (scenario.checkAction === 'signal') process.kill(process.pid, 'SIGTERM');
if (scenario.checkAction === 'overflow') await new Promise(resolve => process.stdout.write('x'.repeat(4 * 1024 * 1024), resolve));
if (scenario.checkAction === 'hang') await new Promise(() => setInterval(() => {}, 1000));
process.stderr.write('private engine diagnostic');
process.stdout.write(scenario.checkText ?? JSON.stringify(scenario.check));
process.exit(scenario.checkExit);
`);
	writeFileSync(runner, `
try {
	const { verifyRuntime } = await import(${JSON.stringify(READINESS)});
	process.stdout.write(JSON.stringify({ result: verifyRuntime(process.execPath, ${JSON.stringify(cli)}) }));
} catch (error) {
	process.stdout.write(JSON.stringify({ error: error.message }));
}
`);

	const child = spawnSync(NODE, [runner], {
		encoding  : "utf8"                             ,
		timeout   : 25_000                             ,
		maxBuffer : 128 * 1024                         ,
		env       : { ...process.env, ...environment } ,
	});

	expect(child.status, child.stderr).toBe(0);

	const output = JSON.parse(child.stdout) as { result?: { python: { status: string; detail: string } }; error?: string }   ;
	const calls  = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").map(line => JSON.parse(line) as Call) : [] ;

	for (const call of calls) expect(existsSync(call.cwd)).toBe(false);

	return { output, calls, child };
}

test("the installed CLI checks an approved Python finding in an owned disposable project without writing", () => {
	const { output, calls } = probe();

	expect(output.result?.python.status)    .toBe        ("verified"                                                        ) ;
	expect(output.result?.python.detail)    .toContain   ("Python"                                                          ) ;
	expect(calls                       )    .toHaveLength(2                                                                 ) ;
	expect(calls[0]!.args              )    .toEqual     (["doctor", "--json"]                                              ) ;
	expect(calls[1]!.args              )    .toEqual     (["check", "--file", join(calls[0]!.cwd, "readiness.py"), "--json"]) ;
	expect(calls[0]!.cwd               ).not.toBe        (process.cwd()                                                     ) ;
	expect(calls[1]!.cwd               )    .toBe        (calls[0]!.cwd                                                     ) ;
	expect(calls[1]!.source            )    .toBe        (SOURCE                                                            ) ;
	expect(calls[0]!.config            )    .toBe        (join(calls[0]!.cwd, "user-config")                                ) ;
});

test("missing python3 is reported as unavailable without claiming or running a Python check", () => {
	const doctor = {
		...DOCTOR, ok: false, runtimeUsable: false, formatConfigured: false,
		checks: { ...DOCTOR.checks, python: { ok: false, detail: "python3 is unavailable or failed to start" } },
	};
	const { output, calls } = probe({ doctor, doctorExit: 1 }, { PATH: "" });

	expect(output.result?.python.status   ).toBe     ("unavailable") ;
	expect(output.result?.python.detail   ).toContain("not run"    ) ;
	expect(calls.map(call => call.args[0])).toEqual  (["doctor"]   ) ;
});

test.each(["runtime", "config", "approval", "formatter"] as const)("doctor refuses a failed %s check before inspecting source", name => {
	const doctor = { ...DOCTOR, checks: { ...DOCTOR.checks, [name]: { ok: false, detail: "unhealthy fixture" } } };
	const { output, calls } = probe({ doctor });

	expect(output.error).toContain(`${name} health check failed`);
	expect(calls.map(call => call.args[0])).toEqual(["doctor"]);
});

test.each([
	["malformed JSON", { doctorText: "not JSON" }, "malformed JSON"],
	["JSON array", { doctor: [] }, "invalid JSON report"],
	["version-only engine", { doctorText: "0.2.6" }, "malformed JSON"],
	["missing health checks", { doctor: { ...DOCTOR, checks: {} } }, "invalid runtime check"],
	["inconsistent runtime", { doctor: { ...DOCTOR, runtimeUsable: false } }, "inconsistent runtime readiness"],
	["failed command", { doctorExit: 2 }, "doctor exited with status 2"],
	["missing engine", { missing: true }, "malformed JSON"],
	["corrupt engine", { corrupt: true }, "malformed JSON"],
] as const)("doctor rejects %s", (_name, scenario, message) => {
	const { output } = probe(scenario);

	expect(output.error).toContain(message);
	expect(output.error).toContain("Rerun the BoxBox installer");
});

test("a present python3 that fails doctor is unavailable without blocking other languages", () => {
	const directory = mkdtempSync(join(tmpdir(), "boxbox python candidate "));
	roots.push(directory);
	copyFileSync(NODE, join(directory, process.platform === "win32" ? "python3.exe" : "python3"));
	const doctor = {
		...DOCTOR, ok: false, runtimeUsable: false, formatConfigured: false,
		checks: { ...DOCTOR.checks, python: { ok: false, detail: "python3 failed to start" } },
	};
	const { output, calls } = probe({ doctor, doctorExit: 1 }, { PATH: directory });

	expect(output.result?.python.status).toBe("unavailable");
	expect(output.result?.python.detail).toContain("repair Python 3");
	expect(output.error).toBeUndefined();
	expect(calls.map(call => call.args[0])).toEqual(["doctor"]);
});

test("a reported Python parser failure is unavailable without claiming a verified check", () => {
	const check = { ...CHECK, syntax: { status: "error", tool: "python3", diagnostics: ["python3 failed"] } };
	const { output, calls } = probe({ check, checkExit: 2 });

	expect(output.result?.python.status).toBe("unavailable");
	expect(output.result?.python.detail).toContain("could not be verified");
	expect(output.error).toBeUndefined();
	expect(calls).toHaveLength(2);
});

const INVALID_CHECKS: readonly [string, unknown, string][] = [
	["invalid Python syntax", { ...CHECK, syntax: { status: "invalid", tool: "python3", diagnostics: ["SyntaxError"] } }, "Python syntax validation failed"],
	["inconsistent parser failure", { ...CHECK, syntax: { status: "error", tool: "python3", diagnostics: ["python3 failed"] } }, "Python syntax validation failed"],
	["skipped parser", { ...CHECK, syntax: { status: "valid", tool: "skipped", diagnostics: [] } }, "Python syntax validation failed"],
	["parser diagnostics", { ...CHECK, syntax: { status: "valid", tool: "python3", diagnostics: ["unexpected diagnostic"] } }, "Python syntax validation failed"],
	["wrong language", { ...CHECK, results: [{ ...CHECK.results[0]!, language: "typescript" }] }, "expected single FIXABLE"],
	["missing findings", { ...CHECK, results: [{ language: "python", summary: { groups: 0, misaligned: 0 }, groups: [] }] }, "expected single FIXABLE"],
	["inconsistent findings", { ...CHECK, results: [{ ...CHECK.results[0]!, groups: [{ state: "PASS", rows: 3 }] }] }, "expected single FIXABLE"],
	["unapproved findings", { ...CHECK, formatReadiness: { approvalEligible: false, approvedFixableGroups: 0 } }, "did not verify approval"],
	["wrong approved count", { ...CHECK, formatReadiness: { approvalEligible: true, approvedFixableGroups: 2 } }, "did not verify approval"],
	["malformed result shape", { ...CHECK, results: {} }, "expected single FIXABLE"],
];

test.each(INVALID_CHECKS)("Python check refuses %s", (_name, check, message) => {
	const { output, calls } = probe({ check });

	expect(output.error).toContain(message);
	expect(calls).toHaveLength(2);
});

test.each([
	["malformed JSON", { checkText: "not JSON" }, "check returned malformed JSON"],
	["JSON array", { check: [] }, "check returned an invalid JSON report"],
	["unexpected clean exit", { checkExit: 0 }, "expected single FIXABLE"],
	["failed command", { checkExit: 2 }, "check exited with status 2"],
	["source mutation", { checkAction: "mutate" }, "changed or removed"],
	["source deletion", { checkAction: "remove" }, "changed or removed"],
	["terminated child", { checkAction: "signal" }, "check"],
	["overflowing child", { checkAction: "overflow" }, "check could not complete"],
] as const)("Python check refuses %s and cleans its project", (_name, scenario, message) => {
	const { output, child } = probe(scenario);

	expect(output.error)    .toContain(message                    ) ;
	expect(output.error).not.toContain("private engine diagnostic") ;
	expect(child.stderr)    .toBe     (""                         ) ;
});

test("a stuck installed CLI is terminated within the verification deadline", () => {
	const { output, calls } = probe({ checkAction: "hang" });

	expect(output.error).toContain("check could not complete (ETIMEDOUT)");
	expect(calls).toHaveLength(2);
}, 20_000);
