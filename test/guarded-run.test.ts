import      { afterEach, expect, test } from "bun:test"                 ;
import      { spawn, spawnSync        } from "node:child_process"       ;
import      { createHash              } from "node:crypto"              ;
import      {
              existsSync            ,
              mkdtempSync           ,
              mkdirSync             ,
              readFileSync          ,
              readdirSync           ,
              rmSync                ,
              writeFileSync         ,
              symlinkSync           ,
              utimesSync            ,
                                      } from "node:fs"                  ;
import      { tmpdir                  } from "node:os"                  ;
import      { basename, dirname, join } from "node:path"                ;
import      {
              guardedRun            ,
              guardStatus           ,
              loadLatestRun         ,
              lockDirectory         ,
              snapshot              ,
                                      } from "@/common/guarded-run.ts"  ;
import      { acquireProcessLock      } from "@/common/process-lock.ts" ;

const roots: string[] = []                                                                                                                                                                                                                                       ;
const root            = () => { const path = mkdtempSync(join(tmpdir(), "boxbox-guard-")); roots.push(path); return path; }                                                                                                                                      ;
const preflight       = () => ({ runtimeUsable: true })                                                                                                                                                                                                          ;
const inspect         = async (root: string, file: string) => ({ file, language: "python", mode: "check" as const, summary: { groups: 0, misaligned: 0, edits: 0, refused: 0, suggested: 0 }, groups: [], parse: { status: "not-run" as const, tool: "test" } }) ;
const latest          = (path: string) => JSON.parse(readFileSync(join(path, ".boxbox/runs", readdirSync(join(path, ".boxbox/runs"))[0]!), "utf8"))                                                                                                              ;

afterEach(() => { for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true }); });

test("distinguishes a successful check, no changes and not storing arguments", async () => {
	const path   = root()                    ;
	const secret = "SECRET_COMMAND_ARGUMENT" ;
	expect(await guardedRun(["--root", path, "--json", "--", "python3", "-c", "open('one.py','w').write('x=1\\n')", secret], preflight, inspect, "test"))    .toBe     (0       ) ;
	expect(latest(path).state                                                                                                                           )    .toBe     ("PASS"  ) ;
	expect(JSON.stringify(latest(path))                                                                                                                 ).not.toContain(secret  ) ;
	expect(latest(path).checked[0].file                                                                                                                 )    .toBe     ("one.py") ;
});

test("a preflight failure ends before running and is recorded", async () => {
	const path = root();
	expect(await guardedRun(["--root", path, "--", "python3", "-c", "raise Exception()"], () => ({ runtimeUsable: false }), inspect, "test")).toBe(2);
	expect(latest(path)).toMatchObject({ state: "TOOL_ERROR", errorCode: "PREFLIGHT_FAILED", childExitCode: null });
});

test("child failure, unsupported and unchanged are not PASS", async () => {
	for (const [script, state, code] of [["raise SystemExit(7)", "CHILD_FAILED", 2], ["open('one.js','w').write('x=1')", "UNSUPPORTED", 2], ["pass", "NO_CHANGES", 0]] as const) {
		const path = root();
		expect(await guardedRun(["--root", path, "--", "python3", "-c", script], preflight, inspect, "test")).toBe(code);
		expect(latest(path).state).toBe(state);
	}
});

test("check errors and non-runnable commands leave an end record", async () => {
	const path = root();
	expect(await guardedRun(["--root", path, "--", "boxbox-missing-executable"], preflight, inspect, "test")).toBe(2);
	expect(latest(path)).toMatchObject({ state: "TOOL_ERROR", errorCode: "CHILD_START_ERROR" });
	expect(latest(path).finishedAt).toBeTruthy();
});

test("a changed symbolic code file is not approved by the check", async () => {
	const path    = root() ;
	const outside = root() ;
	writeFileSync(join(outside, "target.py"), "x=1");
	symlinkSync(join(outside, "target.py"), join(path, "escape.py"));
	expect(await guardedRun(["--root", path, "--", "python3", "-c", "open('escape.py','w').write('x=2')"], preflight, inspect, "test")).toBe(2);
	expect(latest(path).state).toBe("TOOL_ERROR");
});

test("status marks changes made outside a run as STALE", async () => {
	const path = root();
	await guardedRun(["--root", path, "--", "python3", "-c", "pass"], preflight, inspect, "test");
	writeFileSync(join(path, "outside.py"), "x=1\n");
	const captured: string[] = []          ;
	const original           = console.log ;
	try {
		console.log = value => captured.push(String(value));
		guardStatus(["--root", path, "--json"], false);
	} finally { console.log = original; }
	expect(JSON.parse(captured[0]!)).toMatchObject({ state: "STALE", changesSinceRun: ["outside.py"] });
});

test("status reads only bounded headers before loading the latest run", () => {
	const names               = Array.from({ length: 128 }, (_, index) => `${String(index).padStart(8, "0")}-0000-0000-0000-000000000000.json`) ;
	const fullReads: string[] = []                                                                                                              ;
	const result = loadLatestRun("/evidence", {
		list       : () => names,
		isSafeFile : () => true,
		readHeader : path => Buffer.from(`{\n  "startedAt": "2026-10-16T12:${path.includes("00000127") ? "59" : "00"}:00.000Z",\n  "padding": "`),
		readFull   : path => { fullReads.push(path); return JSON.stringify({ startedAt: "2026-10-16T12:59:00.000Z", state: "NO_CHANGES" }); },
	});
	expect(result.runs  ).toBe         (128                    ) ;
	expect(result.latest).toMatchObject({ state: "NO_CHANGES" }) ;
	expect(fullReads    ).toHaveLength (1                      ) ;
	expect(fullReads[0] ).toContain    ("00000127"             ) ;
});

test("snapshot streams source files larger than the former size cap", () => {
	const path    = root()                         ;
	const content = Buffer.alloc(17 * 1024 * 1024) ;
	writeFileSync(join(path, "large.py"), content);
	expect(snapshot(path)["large.py"]).toBe(createHash("sha256").update(content).digest("hex"));
});

test("macOS status lock canonicalizes aliases and ignores TMPDIR", () => {
	if (process.platform !== "darwin") return;
	const path      = root()                    ;
	const container = root()                    ;
	const alias     = join(container, "parent") ;
	const previous  = process.env.TMPDIR        ;
	symlinkSync(dirname(path), alias);
	try {
		const expected = lockDirectory(path);
		process.env.TMPDIR = join(container, "different-tmp");
		expect(lockDirectory(join(alias, basename(path)))).toBe(expected);
		const caseAlias = join(dirname(path), basename(path).toUpperCase());
		if (existsSync(caseAlias)) expect(lockDirectory(caseAlias)).toBe(expected);
		expect(expected.startsWith("/private/tmp/boxbox-locks-")).toBe(true);
	} finally {
		if (previous === undefined) delete process.env.TMPDIR;
		else process.env.TMPDIR = previous;
	}
});

test("direct status rejects a concurrent status process", () => {
	const path    = root()                                            ;
	const release = acquireProcessLock(lockDirectory(path), "status") ;
	expect(release).not.toBeNull();
	try {
		expect(() => guardStatus(["--root", path, "--json"], false)).toThrow("CONCURRENT_OPERATION");
	} finally { release?.(); }
});

test("macOS status uses the operating system advisory lock", async () => {
	if (process.platform !== "darwin") return;
	const path      = root()              ;
	const directory = lockDirectory(path) ;
	mkdirSync(directory, { recursive: true });
	const lockPath = join(directory, "status.advisory.lock")                                 ;
	const holder   = spawn("/usr/bin/lockf", ["-k", "-t", "0", lockPath, "/bin/sleep", "2"]) ;
	const finished = new Promise<void>(resolve => holder.once("close", () => resolve()))     ;
	await new Promise(resolve => setTimeout(resolve, 100));
	const captured: string[] = []          ;
	const original           = console.log ;
	try {
		console.log = value => captured.push(String(value));
		expect(guardStatus(["--root", path, "--json"])).toBe(2);
	} finally {
		console.log = original;
		holder.kill("SIGTERM");
	}
	await finished;
	expect(JSON.parse(captured[0]!).errorCode).toBe("CONCURRENT_OPERATION");
	expect(existsSync(lockPath)).toBe(true);
});

test("macOS production status enters the uncontended lockf child", () => {
	if (process.platform !== "darwin") return;
	const path  = root()                                                                                         ;
	const entry = join(process.cwd(), "product/packages/cli/entry.ts")                                           ;
	const child = spawnSync(process.execPath, [entry, "status", "--root", path, "--json"], { encoding: "utf8" }) ;
	expect(child.status).toBe(0);
	expect(JSON.parse(child.stdout)).toMatchObject({ command: "status", state: "NOT_INVOKED", root: path });
});

test("status lock does not steal a fresh partial owner and recovers an old malformed owner", () => {
	const path      = root()                         ;
	const directory = lockDirectory(path)            ;
	const lock      = join(directory, "status.lock") ;
	mkdirSync(lock, { recursive: true });
	expect(acquireProcessLock(directory, "status")).toBeNull();
	const old = new Date(Date.now() - 10_000);
	utimesSync(lock, old, old);
	const release = acquireProcessLock(directory, "status");
	expect(release).not.toBeNull();
	release?.();
});

test("status rejects a symbolic .boxbox directory before reading receipts", () => {
	const path    = root() ;
	const outside = root() ;
	symlinkSync(outside, join(path, ".boxbox"));
	expect(() => guardStatus(["--root", path, "--json"], false)).toThrow("Unsafe .boxbox directory");
});


test("distinguishes check failures from check exceptions and preserves the child result", async () => {
	for (const failure of [false, true]) {
		const path = root();
		const checker = async (project: string, file: string) => {
			if (failure) throw new Error("private diagnostics must not be stored");
			const result = await inspect(project, file);
			return { ...result, summary: { ...result.summary, misaligned: 1 } };
		};
		expect(await guardedRun(["--root", path, "--json", "--", "python3", "-c", "open('bad.py','w').write('x=1')"], preflight, checker, "test"))    .toBe     (failure ? 2 : 1                ) ;
		expect(latest(path).state                                                                                                                )    .toBe     (failure ? "TOOL_ERROR" : "FAIL") ;
		expect(latest(path).childExitCode                                                                                                        )    .toBe     (0                              ) ;
		expect(JSON.stringify(latest(path))                                                                                                      ).not.toContain("private diagnostics"          ) ;
	}
});
