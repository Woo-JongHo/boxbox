import      { expect, test } from "bun:test"           ;
import      { spawnSync    } from "node:child_process" ;
import      { resolve      } from "node:path"          ;

const platform = await import(resolve(import.meta.dir, "../product/installer/platform.mjs"));

const node       = "C:\\Program Files\\nodejs\\node.exe"                        ;
const shadowRoot = "C:\\Users\\woo\\node_modules\\.bin"                         ;
const globalRoot = "C:\\Users\\woo\\AppData\\Roaming\\npm"                      ;
const shadow     = `${shadowRoot}\\codex.exe`                                   ;
const globalExe  = `${globalRoot}\\codex.exe`                                   ;
const globalJs   = `${globalRoot}\\node_modules\\@openai\\codex\\bin\\codex.js` ;

type ProbeOptions = Parameters<typeof spawnSync>[2]                                                                                           ;
type ProbeResult  = Pick<ReturnType<typeof spawnSync>, "status"> & Partial<Pick<ReturnType<typeof spawnSync>, "stdout" | "error" | "signal">> ;
type VersionProbe = (executable: string, args: string[], options: ProbeOptions) => ProbeResult                                                ;

function discovery(files: readonly string[], probe: VersionProbe) {
	return { windows: true, node, path: `${shadowRoot};${globalRoot}`, exists: (candidate: string) => files.includes(candidate), probe };
}

test("Windows discovery skips an unrelated codex.exe shadow before the standard OpenAI npm entry", () => {
	const calls: unknown[][] = [];
	const options = discovery([shadow, globalJs], (...args) => {
		calls.push(args);

		return { status: 0, stdout: "0.2.3\r\n" };
	});

	expect(platform.findCommand("codex", options)).toEqual({ executable: node, args: [globalJs] });
	expect(calls).toHaveLength(1);
	expect(calls[0]).toEqual([shadow, ["--version"], {
		encoding: "utf8", shell: false, windowsHide: true,
		timeout: 3_000, maxBuffer: 4_096, killSignal: "SIGKILL", stdio: ["ignore", "pipe", "pipe"],
	}]);
});

test("Windows discovery preserves a verified native Codex ahead of a later npm entry", () => {
	const calls: string[] = [];
	const options = discovery([shadow, globalJs], (executable: string) => {
		calls.push(executable);

		return { status: 0, stdout: "codex-cli 0.163.0-alpha.2\r\n", signal: null };
	});

	expect(platform.findCommand("codex", options)).toEqual({ executable: shadow, args: [] });
	expect(calls).toEqual([shadow]);
});

test("Windows native candidates fail closed on errors, signals, nonzero status and ambiguous identities", () => {
	const failures: ProbeResult[] = [
		{ status : 1    , stdout : "codex-cli 0.163.0"                                 },
		{ status : 0    , stdout : "codex-cli 0.163.0" , error  : new Error("timeout") },
		{ status : 0    , stdout : "codex-cli 0.163.0" , signal : "SIGKILL"            },
		{ status : 0    , stdout : "not-codex-cli 0.163.0"                             },
		{ status : 0    , stdout : "codex-cli 0.163.0\nextra-output"                   },
		{ status : 0    , stdout : "codex-cli 0.163"                                   },
		{ status : null , stdout : ""                                                  },
	];
	for (const failure of failures) {
		expect(platform.findCommand("codex", discovery([shadow, globalJs], () => failure))).toEqual({ executable: node, args: [globalJs] });
	}

	expect(platform.findCommand("codex", discovery([shadow, globalJs], () => { throw new Error("spawn failed"); }))).toEqual({ executable: node, args: [globalJs] });
	expect(platform.findCommand("codex", discovery([shadow], () => ({ status: 0, stdout: "0.2.3" })))).toBeUndefined();
});

test("Windows discovery can continue to a later verified native executable using real bounded process probes", () => {
	const calls: string[] = [];
	const options = discovery([shadow, globalExe], (executable: string, args: string[], settings: Parameters<typeof spawnSync>[2]) => {
		calls.push(executable);

		const output = executable === shadow ? "0.2.3\n" : "codex-cli 0.163.0\n";

		return spawnSync(process.execPath, ["-e", `process.stdout.write(${JSON.stringify(output)})`, "--", ...args], settings);
	});

	expect(platform.findCommand("codex", options)).toEqual({ executable: globalExe, args: [] });
	expect(calls).toEqual([shadow, globalExe]);
});

test("real overflowing and timed-out identity probes continue to the known npm entry", () => {
	for (const source of ["process.stdout.write('x'.repeat(100000));", "setInterval(() => {}, 1000);"]) {
		const options = discovery([shadow, globalJs], (_executable, _args, settings) => spawnSync(process.execPath, ["-e", source], settings));

		expect(platform.findCommand("codex", options)).toEqual({ executable: node, args: [globalJs] });
	}
}, 15_000);

test("other native hosts retain discovery without the Codex identity probe", () => {
	const claude  = `${shadowRoot}\\claude.exe`                                         ;
	const options = discovery([claude], () => { throw new Error("unexpected probe"); }) ;

	expect(platform.findCommand("claude", options)).toEqual({ executable: claude, args: [] });
});
