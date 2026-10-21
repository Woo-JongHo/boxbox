import { afterEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const { collectStatus, renderStatus } = await import(resolve(import.meta.dir, "../product/hud/status.mjs"));
const scratch: string[] = []                                                                  ;
const hash              = (value: string) => createHash("sha256").update(value).digest("hex") ;

afterEach(() => {
	for (const path of scratch.splice(0)) rmSync(path, { recursive: true, force: true });
});

function fixture() {
	const root = realpathSync(mkdtempSync(join(tmpdir(), "boxbox-product-hud-")));
	scratch.push(root);

	const pluginRoot  = join(root, "plugin")                                                                                                                                                                        ;
	const hudData     = join(root, "hud-data")                                                                                                                                                                      ;
	const sessionId   = "fixture-session"                                                                                                                                                                           ;
	const sessionHash = hash(sessionId)                                                                                                                                                                             ;
	const directory   = join(root, "data", "hooks", hash(root).slice(0, 16), sessionHash)                                                                                                                           ;
	const pointerPath = join(hudData, `${hash(root).slice(0, 16)}.json`)                                                                                                                                            ;
	const cli         = join(root, "doctor.mjs")                                                                                                                                                                    ;
	const doctor      = { tool: "boxbox", command: "doctor", runtimeUsable: true, formatConfigured: true, checks: { approval: { detail: "2 approved convention record(s) loaded; proof remains file-specific" } } } ;

	for (const host of ["codex", "claude"]) {
		mkdirSync(join(pluginRoot, `.${host}-plugin`), { recursive: true });
		writeFileSync(join(pluginRoot, `.${host}-plugin`, "plugin.json"), JSON.stringify({ name: "boxbox", version: "0.2.2" }));
	}
	mkdirSync(hudData, { recursive: true });
	mkdirSync(directory, { recursive: true });
	writeFileSync(cli, `console.log(${JSON.stringify(JSON.stringify(doctor))});`);
	writeFileSync(join(pluginRoot, "runtime.json"), JSON.stringify({ node: process.execPath, cli, hudData }));
	writeFileSync(pointerPath, JSON.stringify({ schemaVersion: 1, root, sessionHash, directory, observedAt: new Date().toISOString() }));

	const run     = () => ({ status: 0, stdout: JSON.stringify(doctor) })                                                                                                                                                                 ;
	const receipt = (state = "PASS", age = 0, name = "receipt.json") => writeFileSync(join(directory, name), JSON.stringify({ event: "PostToolUse", state, automaticFixPerformed: false, at: new Date(Date.now() - age).toISOString() })) ;
	return { root, pluginRoot, hudData, sessionId, sessionHash, directory, pointerPath, cli, doctor, run, receipt };
}

test("collector uses only the explicitly installed engine and bounded doctor probe", () => {
	const data = fixture() ;
	let calls  = 0         ;
	const report = collectStatus({ ...data, run: (node: string, args: string[], options: any) => {
		calls++;
		expect(node             ).toBe               (process.execPath              ) ;
		expect(args             ).toEqual            ([data.cli, "doctor", "--json"]) ;
		expect(options.cwd      ).toBe               (data.root                     ) ;
		expect(options.timeout  ).toBeLessThanOrEqual(5_000                         ) ;
		expect(options.maxBuffer).toBe               (256 * 1024                    ) ;
		return data.run();
	} });

	expect(calls                       ).toBe   (1                                                                               ) ;
	expect(report.plugin               ).toEqual({ state: "installed", version: "0.2.2", enabled: "unknown", trusted: "unknown" }) ;
	expect(report.runtime.state        ).toBe   ("ready"                                                                         ) ;
	expect(report.runtime.approvedCount).toBe   (2                                                                               ) ;
	expect(report.hooks.state          ).toBe   ("not-observed"                                                                  ) ;

	rmSync(join(data.pluginRoot, "runtime.json"));
	const missing = collectStatus({ ...data, run: () => { throw new Error("Must not fall back"); } });
	expect(missing.runtime.state).toBe("unknown");
	expect(missing.errors.length).toBe(1);
});

test("missing manifests and malformed, oversized or symlinked runtime data fail closed", () => {
	const data    = fixture()                                ;
	const runtime = join   (data.pluginRoot, "runtime.json") ;
	for (const content of ["{", " ".repeat(256 * 1024 + 1), JSON.stringify({ node: "node", cli: data.cli })]) {
		writeFileSync(runtime, content);
		const report = collectStatus({ ...data, run: () => { throw new Error("Unexpected engine probe"); } });
		expect(report.runtime.state).toBe("unknown");
		expect(report.errors.length).toBe(1);
	}
	rmSync(runtime);
	symlinkSync(data.cli, runtime);
	expect(collectStatus(data).runtime.state).toBe("unknown");
	rmSync(join(data.pluginRoot, ".codex-plugin", "plugin.json"));
	expect(collectStatus(data).plugin.state).toBe("unknown");
});

test("doctor errors and invalid payloads never become ready; a valid negative doctor is not-ready", () => {
	const data = fixture();
	for (const child of [{ status: 0, stdout: "{}" }, { status: null, error: new Error("timeout") }, { status: 2, stdout: JSON.stringify(data.doctor) }, { status: 0, stdout: "x".repeat(256 * 1024 + 1) }]) {
		expect(collectStatus({ ...data, run: () => child }).runtime.state).toBe("unknown");
	}
	const report = collectStatus({ ...data, run: () => ({ status: 1, stdout: JSON.stringify({ ...data.doctor, runtimeUsable: false }) }) });
	expect(report.runtime.state).toBe("not-ready");
});

test("session filtering never borrows a different session's PASS and project history is explicit", () => {
	const data = fixture();
	data.receipt();
	const own = collectStatus(data);
	expect(own.hooks.state         ).toBe("recorded"       ) ;
	expect(own.hooks.scope         ).toBe("current-session") ;
	expect(own.hooks.hostAcceptance).toBe("unverified"     ) ;
	const other = collectStatus({ ...data, sessionId: "another-session" });
	expect(other.hooks.state).toBe("session-mismatch");
	expect(other.hooks.latest).toBeNull();
	const project = collectStatus({ ...data, sessionId: undefined });
	expect(renderStatus(project)).toContain("project history (not current session)");
	expect(renderStatus(project, { compact: true })).toContain("not current session");
	const watch = renderStatus(project, { compact: true, showProject: true, columns: 200 });
	expect(watch                                                  ).toContain(`Pinned project: ${basename(data.root)} (${data.root})`) ;
	expect(watch.split("\n").length                               ).toBe     (3                                                      ) ;
	expect(renderStatus(own, { compact: true }).split("\n").length).toBe     (2                                                      ) ;
	expect(renderStatus(own, { compact: true })                   ).toContain("session receipt: PASS"                                ) ;
	expect(renderStatus(own, { compact: true })                   ).toContain("file not run | host unverified"                       ) ;
});

test("stale receipts are historical and invalid newer records cannot reveal a misleading PASS", () => {
	const data = fixture();
	data.receipt("PASS", 600_000);
	const stale = collectStatus(data);
	expect(stale.hooks.state     ).toBe                  ("stale"          ) ;
	expect(stale.hooks.ageSeconds).toBeGreaterThanOrEqual(600              ) ;
	expect(renderStatus(stale)   ).toContain             ("historical PASS") ;
	writeFileSync(join(data.directory, "new.json"), "{}");
	const invalid = collectStatus(data);
	expect(invalid.hooks.state).toBe("unknown");
	expect(invalid.hooks.latest).toBeNull();
	expect(renderStatus(invalid)).not.toContain("PASS");
});

test("receipt scanning rejects symlinks, invalid events and future dates while bounding long sessions", () => {
	const data = fixture();
	data.receipt();
	symlinkSync(join(data.directory, "receipt.json"), join(data.directory, "linked.json"));
	expect(collectStatus(data).hooks.state).toBe("unknown");
	rmSync(join(data.directory, "linked.json"));
	for (const override of [{ event: "SessionStart" }, { state: "GREEN" }, { at: "garbage" }, { at: new Date(Date.now() + 3_600_000).toISOString() }]) {
		writeFileSync(join(data.directory, "receipt.json"), JSON.stringify({ event: "Stop", state: "PASS", at: new Date().toISOString(), automaticFixPerformed: false, ...override }));
		expect(collectStatus(data).hooks.latest).toBeNull();
	}
	data.receipt("FAIL", 600_000);
	for (let index = 0; index < 300; index++) {
		const at = Date.now() - (300 - index) * 1_000;
		writeFileSync(join(data.directory, `${at}-${index.toString().padStart(8, "0")}-0000-4000-8000-000000000000.json`), JSON.stringify({ event: "PostToolUse", state: index === 299 ? "PASS" : "FAIL", automaticFixPerformed: false, at: new Date(at).toISOString() }));
	}
	const bounded = collectStatus(data);
	expect(bounded.hooks.state       ).toBe("recorded") ;
	expect(bounded.hooks.latest.state).toBe("PASS"     ) ;
	const newest = Date.now() + 1_000;
	writeFileSync(join(data.directory, `${newest}-ffffffff-ffff-4fff-8fff-ffffffffffff.json`), "{}");
	expect(collectStatus(data).hooks.state).toBe("unknown");
});

test("invalid project pointers cannot select another project or mismatching directory", () => {
	const data = fixture();
	for (const override of [{ root: join(data.root, "other") }, { schemaVersion: 2 }, { directory: data.root }, { sessionHash: "invalid" }]) {
		writeFileSync(data.pointerPath, JSON.stringify({ schemaVersion: 1, root: data.root, sessionHash: data.sessionHash, directory: data.directory, observedAt: new Date().toISOString(), ...override }));
		expect(collectStatus(data).hooks.latest).toBeNull();
		expect(collectStatus(data).hooks.state).toBe("unknown");
	}
});

test("receipt timestamps order checks and ambiguous ties never claim PASS", () => {
	const data = fixture();
	data.receipt("PASS", 60_000, "old.json");
	data.receipt("FAIL", 0, "new.json");
	expect(collectStatus(data).hooks.latest.state).toBe("FAIL");
	const at = new Date().toISOString();
	for (const state of ["PASS", "FAIL"]) writeFileSync(join(data.directory, `${state}.json`), JSON.stringify({ event: "Stop", state, at, automaticFixPerformed: false }));
	expect(collectStatus(data).hooks.latest).toBeNull();
	expect(collectStatus(data).hooks.state).toBe("unknown");
});

test("renderer strips terminal and directional controls and bounds every line", () => {
	const data   = fixture      ()     ;
	const report = collectStatus(data) ;
	report.errors = ["\u001b[2J\u0007\n\r\u202etest\u009b31m"];
	const output = renderStatus(report, { columns: 35 });
	expect(output).not.toMatch(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u202a-\u202e]/u);
	expect(output.split("\n").every((line: string) => Array.from(line).length <= 35)).toBe(true);
});

test("CLI supports real installed doctor, non-TTY watch once, and bounded Claude JSON input", () => {
	const data   = fixture()                                                                               ;
	const script = resolve(import.meta.dir, "../product/hud/status.mjs")                                   ;
	const args   = [script, "--plugin-root", data.pluginRoot, "--root", data.root]                         ;
	const json   = spawnSync(process.execPath, [...args, "--json"], { encoding: "utf8", timeout: 10_000 }) ;
	expect(json.status).toBe(0);
	expect(JSON.parse(json.stdout).runtime.state).toBe("ready");
	const once = spawnSync(process.execPath, [...args, "--watch"], { encoding: "utf8", timeout: 10_000 });
	expect(once.status)    .toBe     (0             ) ;
	expect(once.stdout)    .toContain("BoxBox 0.2.2") ;
	expect(once.stdout).not.toContain("\u001b"      ) ;
	data.receipt();
	const status = spawnSync(process.execPath, [...args, "--claude-statusline"], { encoding: "utf8", input: JSON.stringify({ cwd: data.root, session_id: data.sessionId, model: { display_name: "Claude" } }), timeout: 10_000 });
	expect(status.status).toBe     (0                               ) ;
	expect(status.stdout).toContain("session receipt: PASS"         ) ;
	expect(status.stdout).toContain("file not run | host unverified") ;
	for (const input of ["{}", "{", " ".repeat(256 * 1024 + 1)]) {
		const invalid = spawnSync(process.execPath, [...args, "--claude-statusline"], { encoding: "utf8", input, timeout: 10_000 });
		expect(invalid.status).toBe(1);
		expect(invalid.stdout).toContain("BoxBox unknown");
	}
});

test("CLI direct execution accepts a symlinked entry path while module imports stay inert", () => {
	const data   = fixture()                                             ;
	const linked = join   (data.root, "linked-status.mjs"              ) ;
	const script = resolve(import.meta.dir, "../product/hud/status.mjs") ;
	symlinkSync(script, linked);
	const direct = spawnSync(process.execPath, [linked, "--plugin-root", data.pluginRoot, "--root", data.root, "--host", "codex"], { encoding: "utf8", timeout: 10_000 });
	expect(direct.status).toBe(0);
	expect(direct.stdout).toContain("BoxBox 0.2.2");
	const imported = spawnSync(process.execPath, ["--input-type=module", "--eval", `await import(${JSON.stringify(script)});`], { encoding: "utf8", timeout: 10_000 });
	expect(imported.status).toBe(0);
	expect(imported.stdout).toBe("");
	const modules = [script, resolve("product/hud/setup.mjs"), resolve("product/hud/codex.mjs")]                                                                                                                                                   ;
	const missing = spawnSync(process.execPath, ["--input-type=module", "--eval", `process.argv[1]='/missing/boxbox-entry.mjs'; await Promise.all(${JSON.stringify(modules)}.map(path => import(path)));`], { encoding: "utf8", timeout: 10_000 }) ;
	expect(missing.status).toBe(0);
	expect(missing.stdout).toBe("");
});
