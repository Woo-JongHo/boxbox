import {
         spawnSync                                                               ,
                                                                                   } from "node:child_process" ;
import {
         existsSync                                                              ,
         mkdtempSync                                                             ,
         readFileSync                                                            ,
         realpathSync                                                            ,
         rmSync                                                                  ,
         writeFileSync                                                           ,
                                                                                   } from "node:fs"            ;
import { tmpdir                                                                  } from "node:os"            ;
import { join                                                                    } from "node:path"          ;

const PROCESS_OPTIONS = {
	encoding    : "utf8"                     ,
	shell       : false                      ,
	windowsHide : true                       ,
	timeout     : 15_000                     ,
	maxBuffer   : 1024 * 1024                ,
	killSignal  : "SIGKILL"                  ,
	stdio       : ["ignore", "pipe", "pipe"] ,
};
const PYTHON_SOURCE = Buffer.from("a = 1\nlonger = 22\nmid = 333\n");

function fail(message) {
	throw new Error(`Installed BoxBox runtime verification failed: ${message}. Rerun the BoxBox installer to repair the local engine and bundled rule data.`);
}

function jsonCommand(node, cli, args, options) {
	const child = spawnSync(node, [cli, ...args], { ...PROCESS_OPTIONS, ...options });
	if (child.error) fail(`${args[0]} could not complete (${child.error.code ?? "process error"})`);
	if (child.signal) fail(`${args[0]} was terminated by ${child.signal}`);
	if (child.status !== 0 && child.status !== 1 && !(args[0] === "check" && child.status === 2)) fail(`${args[0]} exited with status ${child.status ?? "unknown"}`);

	let value;

	try { value = JSON.parse(child.stdout); }
	catch { fail(`${args[0]} returned malformed JSON; the installed engine may be missing or corrupt`); }
	if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${args[0]} returned an invalid JSON report`);

	return { value, status: child.status };
}

/** Verifies the installed engine in an owned project without formatting a user file. */
export function verifyRuntime(node, cli) {
	const directory = mkdtempSync(join(tmpdir(), "boxbox-runtime-readiness-"));
	try {
		const root    = realpathSync(directory)                                                            ;
		const options = { cwd: root, env: { ...process.env, XDG_CONFIG_HOME: join(root, "user-config") } } ;
		const { value: doctor, status } = jsonCommand(node, cli, ["doctor", "--json"], options);
		if (doctor.schemaVersion !== 1 || doctor.tool !== "boxbox" || doctor.command !== "doctor") fail("doctor returned an invalid engine report");

		for (const name of ["runtime", "python", "config", "approval", "formatter"]) {
			const check = doctor.checks?.[name];
			if (typeof check?.ok !== "boolean" || typeof check.detail !== "string") fail(`doctor returned an invalid ${name} check`);
			if (name !== "python" && !check.ok) fail(`doctor ${name} health check failed`);
		}

		const pythonReady = doctor.checks.python.ok;
		if (doctor.ok !== pythonReady || doctor.runtimeUsable !== pythonReady || doctor.formatConfigured !== pythonReady || status !== (pythonReady ? 0 : 1)) fail("doctor returned inconsistent runtime readiness");
		if (!pythonReady) {
			return {
				python: { status: "unavailable", detail: "python3 is unavailable or failed its runtime check; Python checks were not run. Install or repair Python 3 and rerun the installer before using Python files." },
			};
		}

		const file = join(root, "readiness.py");

		writeFileSync(file, PYTHON_SOURCE, { flag: "wx" });

		let checked;

		try {
			checked = jsonCommand(node, cli, ["check", "--file", file, "--json"], options);
		} finally {
			if (!existsSync(file) || !readFileSync(file).equals(PYTHON_SOURCE)) fail("Python check changed or removed its disposable source file");
		}

		const { value: report } = checked;
		if (report.schemaVersion !== 1 || report.tool !== "boxbox") fail("check returned an invalid engine report");
		if (checked.status === 2 && report.syntax?.status === "error" && report.syntax.tool === "python3" && Array.isArray(report.syntax.diagnostics) && report.syntax.diagnostics.length > 0) return {
			python: { status: "unavailable", detail: "The installed Python parser could not be verified. Install or repair Python 3 and rerun the installer before using Python files." },
		};
		if (checked.status === 2) fail("check exited with status 2 without a valid Python parser error");
		if (report.syntax?.status !== "valid" || report.syntax.tool !== "python3" || !Array.isArray(report.syntax.diagnostics) || report.syntax.diagnostics.length !== 0) fail("Python syntax validation failed; verify that python3 can run the installed engine parser");

		const result = report.results?.[0];
		if (checked.status !== 1 || !Array.isArray(report.results) || report.results.length !== 1 || result?.language !== "python"
			|| result.summary?.groups !== 1 || result.summary.misaligned !== 1 || !Array.isArray(result.groups) || result.groups.length !== 1
			|| result.groups[0]?.state !== "FIXABLE" || result.groups[0].rows !== 3) fail("Python check did not find the expected single FIXABLE assignment group");
		if (report.formatReadiness?.approvalEligible !== true || report.formatReadiness.approvedFixableGroups !== 1) fail("Python check did not verify approval for its assignment group");

		return { python: { status: "verified", detail: "Installed CLI verified Python syntax and one approved FIXABLE assignment group without changing source." } };
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}
