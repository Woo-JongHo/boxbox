import      { afterEach, beforeEach, describe, expect, test } from "bun:test"                ;
import      { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"           ;
import      { join                                          } from "node:path"               ;
import      { tmpdir                                        } from "node:os"                 ;
import      { spawnSync                                     } from "node:child_process"      ;
import      { resolveMode, setMode                          } from "@/common/mode.ts"        ;
import      { compose, firstLine, RIGHT_MARGIN, segment     } from "@/common/statusline.ts"  ;
import      { CHECK_PERIOD_MS, checkForUpdate, compareVersions, latestTag, patchNotes, readUpdateCache, updateNotice } from "@/common/update.ts" ;

const CLI                   = join(import.meta.dir, "../product/packages/cli/entry.ts") ;
const workspaces : string[] = []                                                        ;
const saved                 = { ...process.env }                                        ;

function workspace(): string {
	const root = mkdtempSync(join(tmpdir(), "boxbox-mode-update-"));
	workspaces.push(root);
	return root;
}

beforeEach(() => {
	process.env.XDG_CONFIG_HOME = workspace();
	delete process.env.BOXBOX_MODE;
	delete process.env.BOXBOX_UPDATE_CHECK;
	delete process.env.BOXBOX_COLOR;
	delete process.env.NO_COLOR;
});

afterEach(() => {
	process.env = { ...saved };
	for (const root of workspaces.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("update check", () => {
	test("versions compare numerically and a pre-release sorts before its release", () => {
		expect(compareVersions("0.2.10"   , "0.2.9")).toBeGreaterThan(0) ;
		expect(compareVersions("v0.2.6"   , "0.2.6")).toBe           (0) ;
		expect(compareVersions("0.2.7-dev", "0.2.7")).toBeLessThan   (0) ;
		expect(compareVersions("0.2.7-dev", "0.2.6")).toBeGreaterThan(0) ;
	});

	test("the latest tag ignores peeled refs and non-version tags", () => {
		const listing = ["a\trefs/tags/v0.2.5", "b\trefs/tags/v0.2.10^{}", "c\trefs/tags/v0.2.6", "d\trefs/tags/nightly"].join("\n");
		expect(latestTag(listing)).toBe("0.2.6");
		expect(latestTag("")     ).toBeUndefined();
	});

	test("probes once per period, then answers from the cache", () => {
		let probes  = 0                                   ;
		const probe = () => { probes++; return "0.2.6"; } ;
		const now   = Date.parse("2026-10-27T00:00:00Z")  ;

		expect(checkForUpdate("0.2.5", { now, probe })                              ).toMatchObject({ latest: "0.2.6", available: true, probed: true }) ;
		expect(checkForUpdate("0.2.5", { now: now + 1000, probe }).probed           ).toBe         (false                                             ) ;
		expect(checkForUpdate("0.2.5", { now: now + CHECK_PERIOD_MS, probe }).probed).toBe         (true                                              ) ;
		expect(probes                                                               ).toBe         (2                                                 ) ;
	});

	test("an offline probe is silent, counts as a check, and keeps the last known version", () => {
		const now = Date.parse("2026-10-27T00:00:00Z");
		checkForUpdate("0.2.5", { now, probe: () => "0.2.6" });
		const status = checkForUpdate("0.2.5", { now: now + CHECK_PERIOD_MS, probe: () => undefined });

		expect(status                    ).toMatchObject({ latest: "0.2.6", available: true }) ;
		expect(readUpdateCache().checkedAt).toBe(new Date(now + CHECK_PERIOD_MS).toISOString()) ;
	});

	test("the session notice names the update command only when a newer, unsnoozed version exists", () => {
		const probe = () => "0.2.6";
		expect(updateNotice("0.2.6", { probe })               ).toBeUndefined()            ;
		const painted = updateNotice("0.2.5", { probe, force: true });
		process.env.NO_COLOR = "1";
		const notice  = updateNotice("0.2.5", { probe, force: true });
		expect(painted?.user  )    .toContain("\x1b[1m\x1b[36m! update boxbox") ;
		expect(notice?.user   )    .toContain("v0.2.5  →  v0.2.6"             ) ;
		expect(notice?.user   ).not.toContain("\x1b["                         ) ;
		expect(notice?.context)    .toContain("! update boxbox"               ) ;

		const snooze = spawnSync(process.execPath, [CLI, "update", "--snooze", "3", "--json"], { encoding: "utf8", env: process.env });
		expect(JSON.parse(snooze.stdout).ok                   ).toBe(true)                 ;
		expect(updateNotice("0.2.5", { probe })               ).toBeUndefined()            ;

		process.env.BOXBOX_UPDATE_CHECK = "0";
		writeFileSync(join(process.env.XDG_CONFIG_HOME!, "boxbox", "state", "update.json"), "{}");
		expect(updateNotice("0.2.5", { probe, force: true })  ).toBeUndefined()            ;
	});

	test("patch notes show each heading and the first sentence of up to three bullets, from [Unreleased] before the cut", () => {
		const changelog = ["## [Unreleased]", "", "### Added", "", "- One. More detail", "  continues here.", "- Two", "- Three", "- Four", "", "## [0.2.6]", "", "### Fixed", "", "- Old fix"].join("\n");
		expect(patchNotes(changelog    , "0.2.7")).toEqual(["  Added", "    • One.", "    • Two", "    • Three", "    … 1 more in CHANGELOG.md"]) ;
		expect(patchNotes(changelog    , "0.2.6")).toEqual(["  Fixed", "    • Old fix"]                                                         ) ;
		expect(patchNotes("# Changelog", "0.2.6")).toEqual([]                                                                                   ) ;
	});

	test("update without a source refuses with the setup instruction", () => {
		const run = spawnSync(process.execPath, [CLI, "update", "--json"], { encoding: "utf8", env: { ...process.env, PATH: "" } });
		expect(run.status).not.toBe(0);
	});
});

describe("modes", () => {
	test("project mode wins over the global default, and BOXBOX_MODE wins over both", () => {
		const one = workspace() ;
		const two = workspace() ;
		setMode("align", undefined);
		setMode("off"  , one);

		expect(resolveMode(one      )).toBe("off"  ) ;
		expect(resolveMode(two      )).toBe("align") ;
		expect(resolveMode(undefined)).toBe("align") ;
		process.env.BOXBOX_MODE = "refactor";
		expect(resolveMode(one)      ).toBe("refactor") ;
	});

	test("the CLI rejects an unknown mode", () => {
		const run = spawnSync(process.execPath, [CLI, "mode", "loud", "--json"], { cwd: workspace(), encoding: "utf8", env: process.env });
		expect(run.status).not.toBe(0);
	});
});

describe("status line", () => {
	test("the segment is one short line and marks an available update", () => {
		expect(segment("align", "0.2.5", "0.2.6"  , false))    .toBe     ("▣ BB·ALIGN ↑") ;
		expect(segment("check", "0.2.6", "0.2.6"  , false))    .toBe     ("▣ BB·CHECK"  ) ;
		expect(segment("off"  , "0.2.6", undefined, true )).not.toContain("\n"          ) ;
	});

	test("a wrapped multi-line command is cut to its first non-empty line", () => {
		expect(firstLine("\nmodel opus\nline two\n")).toBe("model opus");

		const script = join(workspace(), "hud.js");
		writeFileSync(script, "console.log('ctx 42%'); console.log('second'); console.log('third');");
		const run = spawnSync(process.execPath, [CLI, "statusline", "--no-color", "--wrap", `"${process.execPath}" "${script}"`], { input: "{}", encoding: "utf8", env: { ...process.env, COLUMNS: "" } });
		expect(run.stdout).toBe("ctx 42% │ ▣ BB·CHECK");
	});
});

describe("status line layout", () => {
	test("with a terminal width the segment ends RIGHT_MARGIN columns before the edge, on one row", () => {
		const row = compose("Opus 5.5", "▣ BB·ALIGN", 60);
		expect(row.length + RIGHT_MARGIN                          ).toBe   (60                         ) ;
		expect(row.startsWith("Opus 5.5\u00a0")                   ).toBe   (true                       ) ;
		expect(row.endsWith("▣ BB·ALIGN")                         ).toBe   (true                       ) ;
		expect(compose("", "▣ BB·CHECK", 30)                      ).toMatch(/^\u00a0+▣/u               ) ;
		expect(compose("", "[36m▣ BB·CHECK[0m", 30).indexOf("")).toBe   (30 - RIGHT_MARGIN - 10     ) ;
	});

	test("too narrow, unknown width or --left falls back to a plain row", () => {
		expect(compose("wide left text", "▣ BB·CHECK", 20)).toBe("wide left text ▣ BB·CHECK") ;
		expect(compose("left", "▣ BB·CHECK", undefined)   ).toBe("left │ ▣ BB·CHECK"        ) ;
		expect(compose("left", "▣ BB·CHECK", 200, true)   ).toBe("left │ ▣ BB·CHECK"        ) ;
	});
});

describe("status line shim", () => {
	test("the version-free shim follows the plugin registry to the installed version", () => {
		const config  = workspace()                     ;
		const install = join     (workspace(), "0.9.9") ;
		const scripts = join     (install, "scripts"  ) ;
		spawnSync(process.execPath, ["-e", `require("fs").mkdirSync(${JSON.stringify(scripts)}, { recursive: true })`]);
		writeFileSync(join(scripts, "boxbox.mjs"), "process.stdout.write('seen:' + process.argv.slice(2).join(' '));");
		spawnSync(process.execPath, ["-e", `require("fs").mkdirSync(${JSON.stringify(join(config, "plugins"))}, { recursive: true })`]);
		writeFileSync(join(config, "plugins", "installed_plugins.json"), JSON.stringify({ plugins: { "boxbox@boxbox-plugins": [{ installPath: install }] } }));

		const installed = spawnSync(process.execPath, [CLI, "statusline", "--install-shim"], { encoding: "utf8", env: process.env }                              ) ;
		const shim      = join     (process.env.XDG_CONFIG_HOME!, "boxbox", "bin", "statusline.mjs"                                                              ) ;
		const run       = spawnSync(process.execPath, [shim, "--no-color"], { input: "{}", encoding: "utf8", env: { ...process.env, CLAUDE_CONFIG_DIR: config } }) ;

		expect(installed.stdout                                                                                                                      ).toContain("statusline.mjs"            ) ;
		expect(run.stdout                                                                                                                            ).toBe     ("seen:statusline --no-color") ;
		expect(spawnSync(process.execPath, [shim], { input: "{}", encoding: "utf8", env: { ...process.env, CLAUDE_CONFIG_DIR: workspace() } }).stdout).toBe     (""                          ) ;
	});
});

describe("hooks by mode", () => {
	function hook(root: string, mode: "session" | "post" | "stop", data: string): Record<string, unknown> {
		const run = spawnSync(process.execPath, [CLI, "hook", mode], { input: JSON.stringify({ session_id: "s", cwd: root, tool_name: "Write" }), encoding: "utf8", env: { ...process.env, CLAUDE_PLUGIN_DATA: data, BOXBOX_UPDATE_CHECK: "0" } });
		expect(run.status).toBe(0);
		return JSON.parse(run.stdout);
	}

	test("off keeps post and stop silent", () => {
		const root = workspace() ;
		const data = workspace() ;
		process.env.BOXBOX_MODE = "off";
		expect(JSON.stringify(hook(root, "session", data))).toContain("Mode off");
		writeFileSync(join(root, "sample.py"), "a = 1\nlonger = 22\nmid = 333\n");
		expect(hook(root, "post", data)).toEqual({});
		expect(hook(root, "stop", data)).toEqual({});
	}, 60_000);

	test("align applies approved whitespace in PostToolUse and reports it", () => {
		const root = workspace() ;
		const data = workspace() ;
		process.env.BOXBOX_MODE = "align";
		hook(root, "session", data);
		writeFileSync(join(root, "sample.py"), "a = 1\nlonger = 22\nmid = 333\n");
		const output = JSON.stringify(hook(root, "post", data));

		expect(output                                       ).toContain("mode=align"                             ) ;
		expect(output                                       ).toContain("Aligned sample.py (2 edits)"            ) ;
		expect(readFileSync(join(root, "sample.py"), "utf8")).toBe     ("a      = 1\nlonger = 22\nmid    = 333\n") ;
	}, 60_000);

	test("check reports the same file without writing it", () => {
		const root = workspace() ;
		const data = workspace() ;
		hook(root, "session", data);
		writeFileSync(join(root, "sample.py"), "a = 1\nlonger = 22\nmid = 333\n");
		expect(JSON.stringify(hook(root, "post", data))      ).toContain("mode=check")                 ;
		expect(readFileSync(join(root, "sample.py"), "utf8") ).toBe("a = 1\nlonger = 22\nmid = 333\n") ;
	}, 60_000);
});
