import      { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test"                  ;
import      {
              mkdirSync                                             ,
              mkdtempSync                                           ,
              readFileSync                                          ,
              realpathSync                                          ,
              rmSync                                                ,
              symlinkSync                                           ,
              writeFileSync
                                                                      } from "node:fs"                   ;
import      { join                                                    } from "node:path"                 ;
import      { tmpdir                                                  } from "node:os"                   ;
import      { spawnSync                                               } from "node:child_process"        ;
import      { pathToFileURL                                           } from "node:url"                  ;
import      { resolveMode, setMode                                    } from "@/common/35_mode.ts"       ;
import      { compose, firstLine, RIGHT_MARGIN, segment               } from "@/common/36_statusline.ts" ;
import      {
              CHECK_PERIOD_MS                                       ,
              checkForUpdate                                        ,
              compareVersions                                       ,
              latestTag                                             ,
              patchNotes                                            ,
              readUpdateCache                                       ,
              runUpdate                                             ,
              updateNotice
                                                                      } from "@/common/37_update.ts"     ;

const entryRoot = mkdtempSync(join(tmpdir(), "boxbox-mode-entry-")) ;
const CLI       = join       (entryRoot, "entry.ts"               ) ;
writeFileSync(CLI, `
import { runMode } from ${JSON.stringify(join(import.meta.dir, "../product/engine/common/35_mode.ts"))};
import { runStatusline } from ${JSON.stringify(join(import.meta.dir, "../product/engine/common/36_statusline.ts"))};
import { runUpdate } from ${JSON.stringify(join(import.meta.dir, "../product/engine/common/37_update.ts"))};
const [command, ...args] = process.argv.slice(2);
try {
 process.exitCode = command === "mode" ? runMode(args, process.cwd()) : command === "statusline" ? runStatusline(args, "0.2.7") : runUpdate(args, "0.2.7");
} catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 2; }
`);
afterAll(() => rmSync(entryRoot, { recursive: true, force: true }));
const workspaces : string[] = []                 ;
const saved                 = { ...process.env } ;
const { installationRoot } = await import(join(import.meta.dir, "../product/installer/platform.mjs"));

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

		expect(status                    ).toMatchObject({ latest: "0.2.6", available: true, probeSucceeded: false }) ;
		expect(readUpdateCache().checkedAt).toBe(new Date(now + CHECK_PERIOD_MS).toISOString()) ;
		expect(updateNotice("0.2.5", { now: now + CHECK_PERIOD_MS, force: true, probe: () => undefined })).toBeUndefined();
	});

	test("an explicit offline update check returns a visible non-success result", () => {
		const execute         = (() => ({ status: 1, stdout: "", stderr: "offline" })) as unknown as typeof spawnSync ;
		const lines: string[] = []                                                                                    ;
		const original        = console.log                                                                           ;
		console.log = value => { lines.push(String(value)); };
		try {
			expect(runUpdate(["--check", "--json"], "0.2.7", execute)).toBe(2);
		} finally {
			console.log = original;
		}
		expect(JSON.parse(lines.at(-1)!)).toMatchObject({ ok: false, error: { code: "UPDATE_CHECK_FAILED" } });
	});

	test("invalid cached timestamps are dropped and recover with one new daily check", () => {
		const now       = Date.parse("2026-11-09T00:00:00.000Z"                     ) ;
		const directory = join      (process.env.XDG_CONFIG_HOME!, "boxbox", "state") ;
		const path      = join      (directory, "update.json"                       ) ;

		mkdirSync(directory, { recursive: true });
		for (const timestamp of [null, 12, "not-a-date", "2026-02-30T00:00:00.000Z", "2026-11-09", "2026-11-09T00:00:00Z", "2026-11-09T00:00:00.000Z\n"]) {
			writeFileSync(path, JSON.stringify({ checkedAt: timestamp, latest: "9.9.9", snoozedUntil: timestamp }));
			let probes  = 0                                            ;
			const probe = (): string => { probes++; return "9.9.10"; } ;

			expect(readUpdateCache().checkedAt).toBeUndefined();
			expect(readUpdateCache().snoozedUntil).toBeUndefined();
			expect(checkForUpdate("0.2.7", { now, probe })                    ).toMatchObject({ latest: "9.9.10", probed: true, snoozed: false }) ;
			expect(readUpdateCache().checkedAt                                ).toBe         (new Date(now).toISOString()                       ) ;
			expect(checkForUpdate("0.2.7", { now: now + 1_000, probe }).probed).toBe         (false                                             ) ;
			expect(probes                                                     ).toBe         (1                                                 ) ;
		}
	});

	test("a future cached check is stale while a valid future snooze remains active", () => {
		const now          = Date.parse("2026-11-09T00:00:00.000Z")                ;
		const directory    = join(process.env.XDG_CONFIG_HOME!, "boxbox", "state") ;
		const path         = join(directory, "update.json")                        ;
		const snoozedUntil = new Date(now + 7 * CHECK_PERIOD_MS).toISOString()     ;

		mkdirSync(directory, { recursive: true });
		for (const checkedAt of [new Date(now + 1).toISOString(), new Date(now + CHECK_PERIOD_MS).toISOString(), "9999-12-31T23:59:59.999Z"]) {
			writeFileSync(path, JSON.stringify({ checkedAt, latest: "9.9.9", snoozedUntil }));
			let probes  = 0                                            ;
			const probe = (): string => { probes++; return "9.9.10"; } ;

			expect(checkForUpdate("0.2.7", { now, probe })).toMatchObject({ latest: "9.9.10", probed: true, snoozed: true });
			expect(readUpdateCache()).toMatchObject({ checkedAt: new Date(now).toISOString(), snoozedUntil });
			expect(updateNotice("0.2.7", { now: now + 1_000, probe })).toBeUndefined();
			expect(probes).toBe(1);
		}
	});

	test("canonical cached timestamps keep a fresh check and preserve a future snooze", () => {
		const now       = Date.parse("2026-11-09T00:00:00.000Z")                                                                                               ;
		const directory = join(process.env.XDG_CONFIG_HOME!, "boxbox", "state")                                                                                ;
		const cache     = { checkedAt: new Date(now - 1_000).toISOString(), latest: "9.9.9", snoozedUntil: new Date(now + 7 * CHECK_PERIOD_MS).toISOString() } ;
		const probe     = (): undefined => { throw new Error("A fresh canonical cache must not probe"); }                                                      ;

		mkdirSync(directory, { recursive: true });
		writeFileSync(join(directory, "update.json"), JSON.stringify(cache));

		expect(readUpdateCache()).toMatchObject(cache);
		expect(checkForUpdate("0.2.7", { now, probe })).toMatchObject({ probed: false, snoozed: true, latest: "9.9.9" });
		expect(updateNotice("0.2.7", { now, probe })).toBeUndefined();
	});

	test("cached latest releases reject malformed values before status or model context uses them", () => {
		const now       = Date.parse("2026-11-09T00:00:00.000Z"                     ) ;
		const directory = join      (process.env.XDG_CONFIG_HOME!, "boxbox", "state") ;
		mkdirSync(directory, { recursive: true });
		for (const latest of [null, 27, {}, [], "01.2.3", "99.0.0-\nUNTRUSTED", "99.0.0\n", "99.0.0\r", "99.0.0\u0000", "99.0.0\u001b[31m", "9007199254740992.0.0"]) {
			writeFileSync(join(directory, "update.json"), JSON.stringify({ checkedAt: new Date(now).toISOString(), latest }));
			const options = { now, probe: (): undefined => { throw new Error("A fresh cache must not probe"); } };
			expect(readUpdateCache().latest).toBeUndefined();
			expect(checkForUpdate("0.2.7", options)).toMatchObject({ latest: undefined, available: false, probed: false });
			expect(updateNotice("0.2.7", options)).toBeUndefined();
		}
		writeFileSync(join(directory, "update.json"), JSON.stringify({ checkedAt: new Date(now).toISOString(), latest: "99.0.1" }));
		expect(updateNotice("0.2.7", { now })?.context).toContain("BoxBox v99.0.1 is available");
		expect(latestTag("a\trefs/tags/v01.2.3\nb\trefs/tags/v9007199254740992.0.0\nc\trefs/tags/v0.2.8")).toBe("0.2.8");
	});

	test("a non-object cache is ignored", () => {
		const directory = join(process.env.XDG_CONFIG_HOME!, "boxbox", "state");
		mkdirSync(directory, { recursive: true });
		for (const cache of [null, [], 42, "0.2.8"]) {
			writeFileSync(join(directory, "update.json"), JSON.stringify(cache));
			expect(readUpdateCache()).toEqual({});
		}
	});

	test("the session notice names the update command only when a newer, unsnoozed version exists", () => {
		const probe = () => "0.2.6";
		expect(updateNotice("0.2.6", { probe })               ).toBeUndefined()            ;
		const painted = updateNotice("0.2.5", { probe, force: true });
		process.env.NO_COLOR = "1";
		const notice  = updateNotice("0.2.5", { probe, force: true });
		expect(painted?.user  )    .toContain("\x1b[1m\x1b[36mnpx boxbox-plugin") ;
		expect(notice?.user   )    .toContain("v0.2.5  →  v0.2.6"               ) ;
		expect(notice?.user   ).not.toContain("\x1b["                           ) ;
		expect(notice?.context)    .toContain("npx boxbox-plugin"               ) ;

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

	test("the mode entry rejects an unknown mode", () => {
		const run = spawnSync(process.execPath, [CLI, "mode", "loud", "--json"], { cwd: workspace(), encoding: "utf8", env: process.env });
		expect(run.status).not.toBe(0);
	});

	test("global mode output reports the global setting while a project keeps its override", () => {
		const root = realpathSync(workspace());
		setMode("off", root);
		const run = spawnSync(process.execPath, [CLI, "mode", "align", "--global", "--json"], { cwd: root, encoding: "utf8", env: process.env });

		expect(run.status            ).toBe         (0                                                    ) ;
		expect(JSON.parse(run.stdout)).toMatchObject({ scope: "global", previous: "check", mode: "align" }) ;
		expect(resolveMode(root)     ).toBe         ("off"                                                ) ;
		expect(resolveMode(undefined)).toBe         ("align"                                              ) ;
	});

	test("canonical project aliases share one mode setting", () => {
		const root  = workspace()                       ;
		const alias = join     (workspace(), "project") ;
		symlinkSync(root, alias, "junction");
		setMode("align", root);

		expect(resolveMode(realpathSync(root))).toBe("align");
		expect(resolveMode(alias)).toBe("align");
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
		writeFileSync(join(config, "plugins", "installed_plugins.json"), JSON.stringify({ plugins: { "boxbox@boxbox-plugins": [{ scope: "user", installPath: install }] } }));

		const installed = spawnSync(process.execPath, [CLI, "statusline", "--install-shim"], { encoding: "utf8", env: process.env }                              ) ;
		const shim      = join     (process.env.XDG_CONFIG_HOME!, "boxbox", "bin", "statusline.mjs"                                                              ) ;
		const run       = spawnSync(process.execPath, [shim, "--no-color"], { input: "{}", encoding: "utf8", env: { ...process.env, CLAUDE_CONFIG_DIR: config } }) ;

		expect(installed.stdout                                                                                                                      ).toContain("statusline.mjs"            ) ;
		expect(run.stdout                                                                                                                            ).toBe     ("seen:statusline --no-color") ;
		expect(spawnSync(process.execPath, [shim], { input: "{}", encoding: "utf8", env: { ...process.env, CLAUDE_CONFIG_DIR: workspace() } }).stdout).toBe     (""                          ) ;
	});

	test("the shim selects one absolute user installation regardless of record order and refuses ambiguity", () => {
		const config  = workspace()                       ;
		const user    = join     (workspace(), "user"   ) ;
		const project = join     (workspace(), "project") ;
		for (const [directory, marker] of [[user, "user"], [project, "project"]]) {
			mkdirSync(join(directory!, "scripts"), { recursive: true });
			writeFileSync(join(directory!, "scripts", "boxbox.mjs"), `process.stdout.write(${JSON.stringify(marker)});`);
		}
		mkdirSync(join(config, "plugins"));
		spawnSync(process.execPath, [CLI, "statusline", "--install-shim"], { encoding: "utf8", env: process.env });
		const shim          = join(process.env.XDG_CONFIG_HOME!, "boxbox", "bin", "statusline.mjs") ;
		const userRecord    = { scope: "user", installPath: user }                                  ;
		const projectRecord = { scope: "project", installPath: project }                            ;
		for (const [records, expected] of [
			[[projectRecord, userRecord], "user"],
			[[userRecord, projectRecord], "user"],
			[[projectRecord], ""],
			[[userRecord, userRecord], ""],
			[[{ scope: "user", installPath: "relative/plugin" }], ""],
			[[{ scope: "user", installPath: 42 }], ""],
			[{}, ""],
		] as const) {
			writeFileSync(join(config, "plugins", "installed_plugins.json"), JSON.stringify({ plugins: { "boxbox@boxbox-plugins": records } }));
			const run = spawnSync(process.execPath, [shim], { encoding: "utf8", input: "{}", env: { ...process.env, CLAUDE_CONFIG_DIR: config } });
			expect(run.status).toBe(0);
			expect(run.stdout).toBe(expected);
		}
	});
});



describe("regressions from PR 31 integration", () => {
	test("BOXBOX_COLOR=0 disables the status-line escape sequences", () => {
		const run = spawnSync(process.execPath, [CLI, "statusline", "--left"], {
			input: "{}", encoding: "utf8", env: { ...process.env, BOXBOX_COLOR: "0" },
		});
		expect(run.status).toBe(0);
		expect(run.stdout).toBe("▣ BB·CHECK");
	});

	for (const host of ["claude", "codex"] as const) {
		for (const installed of [undefined, "99.0.0", "99.0.1"] as const) {
			test(`${host} updater verifies the installed engine (${installed ?? "missing"}) after installer success`, () => {
				const root             = workspace()                                             ;
				const data             = workspace()                                             ;
				const config           = workspace()                                             ;
				const archiveDirectory = join     (root, "archive&^%() space"                  ) ;
				const archive          = join     (archiveDirectory, "boxbox-plugin-99.0.1.tgz") ;
				mkdirSync(archiveDirectory);
				mkdirSync(join(root, ".git"));
				writeFileSync(join(root, "product.json"), JSON.stringify({ displayName: "BoxBox" }));
				writeFileSync(join(root, "package.json"), JSON.stringify({ version: "99.0.1" }));
				writeFileSync(archive, "Controlled archive marker; the installer is stubbed.");
				const install = installationRoot("99.0.1", host, { environment: { XDG_DATA_HOME: data, LOCALAPPDATA: data } }) ;
				const plugin  = join            (install, "plugin"                                                           ) ;
				if (installed !== undefined) {
					mkdirSync(join(plugin, "scripts"), { recursive: true });
					writeFileSync(join(plugin, "scripts", "boxbox.mjs"), `process.stdout.write(${JSON.stringify(installed)});`);
				}
				const project = join(workspace(), "project-plugin");
				mkdirSync(join(project, "scripts"), { recursive: true });
				writeFileSync(join(project, "scripts", "boxbox.mjs"), `process.stdout.write(${JSON.stringify(installed === "99.0.1" ? "99.0.0" : "99.0.1")});`);
				mkdirSync(join(config, "plugins"), { recursive: true });
				const registry = join(config, "plugins", "installed_plugins.json");
				writeFileSync(registry, JSON.stringify({ plugins: { "boxbox@boxbox-plugins": [
					{ scope: "project", installPath: project },
					...(installed === undefined ? [] : [{ scope: "user", installPath: plugin }]),
				] } }));
				// Only external installer/build/git calls are simulated. Version checks execute the actual fixture launcher.
				const harness = join(root, "probe.ts");
				writeFileSync(harness, `
import { spawnSync } from "node:child_process";
import { runUpdate } from ${JSON.stringify(join(import.meta.dir, "../product/engine/common/37_update.ts"))};
const run = (command, ...args) => {
 if (command === process.execPath) return spawnSync(command, ...args);
 if (command === "git") return { status: args[0][0] === "rev-parse" ? 1 : 0, stdout: "", stderr: "" };
 if (command === "bun") return { status: 0, stdout: args[0][0] === "run" ? ${JSON.stringify(archive + "\n")} : "", stderr: "" };
 if (command === "npm" || command.startsWith("npm ")) {
  require("node:fs").writeFileSync(${JSON.stringify(join(root, "npm-call.json"))}, JSON.stringify({ command, args }));
  return { status: 0, stdout: "", stderr: "" };
 }
 throw new Error("Unexpected external command");
};
try { process.exitCode = runUpdate(["--source", ${JSON.stringify(root)}, "--host", ${JSON.stringify(host)}, ...(process.env.BOXBOX_TEST_PROGRESS ? [] : ["--json"])], "0.2.7", run); }
catch (error) { console.error(error.message); process.exitCode = 2; }
`);
				const run = spawnSync(process.execPath, [harness], {
					encoding: "utf8", env: { ...process.env, XDG_DATA_HOME: data, LOCALAPPDATA: data, CLAUDE_CONFIG_DIR: config },
				});
				const npm             = JSON.parse(readFileSync(join(root, "npm-call.json"), "utf8"))                             ;
				const packageArgument = process.platform === "win32" ? "./boxbox-plugin-99.0.1.tgz" : pathToFileURL(archive).href ;
				if (process.platform === "win32") {
					expect(npm.command).toBe(`npm exec --yes --package ${packageArgument} -- boxbox --${host}`);
					expect(npm.args[0].cwd).toBe(archiveDirectory);
				} else {
					expect(npm.args[0]).toEqual(["exec", "--yes", "--package", packageArgument, "--", "boxbox", `--${host}`]);
					expect(npm.args[1].cwd).toBe(archiveDirectory);
				}
				if (installed === "99.0.1") {
					expect(run.status).toBe(0);
					expect(JSON.parse(run.stdout).ok).toBe(true);
					const progress = spawnSync(process.execPath, [harness], {
						encoding: "utf8", env: { ...process.env, XDG_DATA_HOME: data, LOCALAPPDATA: data, CLAUDE_CONFIG_DIR: config, BOXBOX_TEST_PROGRESS: "1", NO_COLOR: "1" },
					});
					expect(progress.status).toBe(0);
					let previous = -1;
					for (const phase of ["PREPARING", "BUILDING", "INSTALLING", "VERIFYING", "FINISHING"]) {
						const position = progress.stdout.indexOf(phase);
						expect(position).toBeGreaterThan(previous);
						previous = position;
					}
					expect(progress.stdout).not.toContain("\x1b[");
					if (host === "claude") {
						writeFileSync(registry, JSON.stringify({ plugins: { "boxbox@boxbox-plugins": [{ scope: "user", installPath: plugin }, { scope: "user", installPath: plugin }] } }));
						const ambiguous = spawnSync(process.execPath, [harness], { encoding: "utf8", env: { ...process.env, CLAUDE_CONFIG_DIR: config } });
						expect(ambiguous.status).toBe(2);
						expect(ambiguous.stderr).toContain("installed version is unknown");
					}
				} else {
					expect(run.status)    .toBe     (2                                                                ) ;
					expect(run.stderr)    .toContain(`installed version is ${installed ?? "unknown"}, expected 99.0.1`) ;
					expect(run.stdout).not.toContain('"ok":true'                                                      ) ;
				}
			});
		}
	}

	for (const name of ["boxbox&diag.tgz", "boxbox^diag.tgz", "boxbox%diag%.tgz", "boxbox(diag).tgz", "boxbox diag.tgz", "boxbox;diag.tgz", "relative.tgz"]) {
		test(`updater refuses an unsafe or non-absolute archive before npm (${name})`, () => {
			const root    = workspace()                                       ;
			const archive = name === "relative.tgz" ? name : join(root, name) ;
			mkdirSync(join(root, ".git"));
			writeFileSync(join(root, "product.json"), JSON.stringify({ displayName: "BoxBox" }));
			if (name !== "relative.tgz") writeFileSync(archive, "Controlled archive marker");
			let npmCalls = 0;
			const execute = ((command: string, args: readonly string[]) => {
				if (command === "npm" || command.startsWith("npm ")) npmCalls++;
				return { status: command === "git" && args[0] === "rev-parse" ? 1 : 0, stdout: command === "bun" && args[0] === "run" ? archive + "\n" : "", stderr: "" };
			}) as typeof spawnSync;
			expect(() => runUpdate(["--source", root, "--host", "claude", "--json"], "0.2.7", execute)).toThrow(/absolute.*archive|unsafe.*archive/iu);
			expect(npmCalls).toBe(0);
		});
	}
});
