import      { afterEach, expect, test } from "bun:test"           ;
import      { createHash              } from "node:crypto"        ;
import      { spawnSync               } from "node:child_process" ;
import      {
              mkdirSync             ,
              mkdtempSync           ,
              readFileSync          ,
              rmSync                ,
              writeFileSync         ,
                                      } from "node:fs"            ;
import      { tmpdir                  } from "node:os"            ;
import      { join, resolve           } from "node:path"          ;

const { collectHud, renderHud } = await import(resolve(import.meta.dir, "../development/tools/hud.mjs"));
const temporary: string[] = [];

afterEach(() => {
	for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});

function installed() {
	const root = mkdtempSync(join(tmpdir(), "boxbox-hud-"));
	temporary.push(root);
	writeFileSync(join(root, "runtime.json"), JSON.stringify({ node: process.execPath, cli: process.execPath }));

	const list   = { installed: [{ pluginId: "boxbox@boxbox-plugins", installed: true, enabled: true, version: "0.2.1", source: { path: root } }] }                                                                      ;
	const doctor = { tool: "boxbox", command: "doctor", runtimeUsable: true, formatConfigured: true, checks: { approval: { detail: "2 approved rules; proof is file-specific" }, formatter: { detail: "standalone" } } } ;

	return { root, list, doctor };
}

test("HUD never runs a checkout engine when the host plugin is absent or its discovery fails", () => {
	let probes    = 0                                                                  ;
	const missing = collectHud({ run: () => { probes++; return { installed: [] }; } }) ;

	expect(probes               ).toBe(1              ) ;
	expect(missing.plugin.state ).toBe("not-installed") ;
	expect(missing.runtime.state).toBe("unknown"      ) ;

	const broken = collectHud({ run: () => { throw new Error("plugin discovery timed out"); } });

	expect(broken.plugin.state).toBe("unknown");
	expect(broken.error).toContain("timed out");
});

test("HUD keeps disabled host state, runtime readiness and unobserved hook delivery separate", () => {
	const { root, list, doctor } = installed();
	list.installed[0]!.enabled = false;
	const original = readFileSync(join(root, "runtime.json"), "utf8")                                                                           ;
	const report   = collectHud({ root, pluginData: undefined, run: (_tool: unknown, args: string[]) => args[0] === "plugin" ? list : doctor }) ;

	expect(report.plugin.state                             ).toBe("disabled"  ) ;
	expect(report.runtime.state                            ).toBe("ready"     ) ;
	expect(report.runtime.fileVerification                 ).toBe("not-run"   ) ;
	expect(report.hooks.hostAcceptance                     ).toBe("unverified") ;
	expect(report.releaseReady                             ).toBe(false       ) ;
	expect(readFileSync(join(root, "runtime.json"), "utf8")).toBe(original    ) ;
});

test("HUD reports malformed receipts and actual latest outcomes without turning receipts into host acceptance", () => {
	const { root, list, doctor } = installed();
	const data      = join(root, "data")                                                                           ;
	const directory = join(data, "hooks", createHash("sha256").update(root).digest("hex").slice(0, 16), "session") ;
	mkdirSync(directory, { recursive: true });
	writeFileSync(join(directory, "baseline.json"), "{}");
	writeFileSync(join(directory, "old.json"), JSON.stringify({ event: "PostToolUse", state: "PASS", at: "2026-10-20T00:00:00Z" }));
	writeFileSync(join(directory, "latest.json"), JSON.stringify({ event: "Stop", state: "FAIL", at: "2026-10-21T00:00:00Z" }));
	writeFileSync(join(directory, "broken.json"), "{");

	const report = collectHud({ root, pluginData: data, run: (_tool: unknown, args: string[]) => args[0] === "plugin" ? list : doctor });

	expect(report.hooks.state         ).toBe     ("incomplete") ;
	expect(report.hooks.latest.state  ).toBe     ("FAIL"      ) ;
	expect(report.hooks.unreadable    ).toBe     (1           ) ;
	expect(report.hooks.hostAcceptance).toBe     ("unverified") ;
	expect(renderHud(report)          ).toContain("FAIL"      ) ;
});

test("HUD reads a receipt from the real hook writer and marks inaccessible receipt roots incomplete", () => {
	const { root, list, doctor } = installed();
	const data           = join(root, "plugin-data")                                                ;
	const entry          = resolve(import.meta.dir, "../product/packages/cli/entry.ts")             ;
	const run            = (_tool: unknown, args: string[]) => args[0] === "plugin" ? list : doctor ;
	let receiptDirectory = ""                                                                       ;
	for (const mode of ["session", "post"]) {
		const child = spawnSync(process.execPath, [entry, "hook", mode], {
			cwd: root, input: JSON.stringify({ cwd: root, session_id: "hud-writer", tool_name: "apply_patch" }),
			encoding: "utf8", env: { ...process.env, PLUGIN_DATA: data, CLAUDE_PLUGIN_DATA: data },
		});

		expect(child.status).toBe(0);
		if (mode === "session") receiptDirectory = JSON.parse(child.stdout).hookSpecificOutput.additionalContext.match(/Results are recorded in (.*)\.$/u)[1];
	}
	const recorded = collectHud({ root, pluginData: data, run });

	expect(recorded.hooks.state         ).toBe("recorded"   ) ;
	expect(recorded.hooks.latest.event  ).toBe("PostToolUse") ;
	expect(recorded.hooks.latest.state  ).toBe("NO_CHANGES" ) ;
	expect(recorded.hooks.hostAcceptance).toBe("unverified" ) ;

	const projectKey = createHash("sha256").update(root).digest("hex").slice(0, 16);

	expect(collectHud({ root, pluginData: receiptDirectory, run }).hooks.latest.state).toBe("NO_CHANGES");
	expect(collectHud({ root, pluginData: receiptDirectory.replace(projectKey, "0".repeat(16)), run }).hooks.state).toBe("location-mismatch");

	const previousClaude = process.env.CLAUDE_PLUGIN_DATA ;
	const previousCodex  = process.env.PLUGIN_DATA        ;
	try {
		process.env.CLAUDE_PLUGIN_DATA = data;
		process.env.PLUGIN_DATA = join(root, "other-plugin-data");

		expect(collectHud({ root, run }).hooks.latest.state).toBe("NO_CHANGES");
	} finally {
		if (previousClaude === undefined) delete process.env.CLAUDE_PLUGIN_DATA;
		else process.env.CLAUDE_PLUGIN_DATA = previousClaude;
		if (previousCodex === undefined) delete process.env.PLUGIN_DATA;
		else process.env.PLUGIN_DATA = previousCodex;
	}

	rmSync(join(data, "hooks", projectKey), { recursive: true });
	writeFileSync(join(data, "hooks", projectKey), "not a directory");

	expect(collectHud({ root, pluginData: data, run }).hooks.state).toBe("incomplete");
});
