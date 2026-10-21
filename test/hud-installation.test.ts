import { afterEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const setup           = await import(resolve("product/hud/setup.mjs")) ;
const roots: string[] = []                                             ;
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
	const root = mkdtempSync(join(tmpdir(), "boxbox-hud-setup-"));
	roots.push(root);
	const pluginRoot = join(root, "plugin ' $ files") ;
	const hudData    = join(root, "hud"             ) ;
	const config     = join(root, "claude config"   ) ;
	mkdirSync(join(pluginRoot, "scripts"), { recursive: true });
	mkdirSync(config);
	cpSync(resolve("product/hud"), join(pluginRoot, "scripts/hud"), { recursive: true });
	writeFileSync(join(pluginRoot, "runtime.json"), JSON.stringify({ node: process.execPath, cli: join(root, "engine.mjs"), hudData }));
	return { root, pluginRoot, hudData, config, environment: { CLAUDE_CONFIG_DIR: config, BOXBOX_BIN_HOME: join(root, "bin") } };
}

test("Claude HUD opt-in preserves unrelated settings, repairs its own command and removes only its key", () => {
	const f        = fixture()                                                         ;
	const path     = join(f.config, "settings.json")                                   ;
	const original = { permissions: { defaultMode: "default" }, env: { KEEP: "yes" } } ;
	writeFileSync(path, JSON.stringify(original));
	setup.configureHud({ ...f, host: "claude" });
	const changed = JSON.parse(readFileSync(path, "utf8"));
	expect(changed                                                                             ).toMatchObject(original             ) ;
	expect(changed.statusLine.command                                                          ).toContain    ("--claude-statusline") ;
	expect(JSON.parse(readFileSync(join(f.hudData, "claude-settings.before-hud.json"), "utf8"))).toEqual      (original             ) ;
	setup.configureHud({ ...f, host: "claude" });
	changed.env.NEW = "preserved";
	writeFileSync(path, JSON.stringify(changed));
	setup.configureHud({ ...f, host: "claude", disable: true });
	expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ ...original, env: { KEEP: "yes", NEW: "preserved" } });
	setup.configureHud({ ...f, host: "claude" });
	const manuallyDisabled = JSON.parse(readFileSync(path, "utf8"));
	delete manuallyDisabled.statusLine;
	writeFileSync(path, JSON.stringify(manuallyDisabled));
	expect(setup.configureHud({ ...f, host: "claude", disable: true })).toMatchObject({ disabled: true }) ;
	expect(existsSync(join(f.hudData, "claude-statusline.json"))      ).toBe         (false             ) ;
	expect(setup.configureHud({ ...f, host: "claude", disable: true })).toMatchObject({ disabled: true }) ;
});

test("HUD setup refuses foreign settings, user changes, symlinks and unsupported platform without replacing them", () => {
	const f       = fixture       ()                                                                       ;
	const path    = join          (f.config, "settings.json"                                             ) ;
	const foreign = JSON.stringify({ statusLine: { type: "command", command: "my-status" }, other: true }) ;
	writeFileSync(path, foreign);
	expect(() => setup.configureHud({ ...f, host: "claude" })               ).toThrow("already has") ;
	expect(() => setup.configureHud({ ...f, host: "claude", disable: true })).toThrow("not owned"  ) ;
	expect(readFileSync(path, "utf8")                                       ).toBe   (foreign      ) ;
	rmSync(path);
	const target = join(f.root, "target");
	writeFileSync(target, "{}");
	symlinkSync(target, path);
	expect(() => setup.configureHud({ ...f, host: "claude" })                  ).toThrow("regular file") ;
	expect(readFileSync(target, "utf8")                                        ).toBe   ("{}"          ) ;
	expect(() => setup.configureHud({ ...f, host: "codex", platform: "win32" })).toThrow("macOS/Linux" ) ;
});

test("Codex launcher keeps literal paths and argv, refuses foreign bins, and removes only its own launcher", () => {
	const f = fixture();
	writeFileSync(join(f.pluginRoot, "scripts/hud/codex.mjs"), "console.log(JSON.stringify(process.argv.slice(2)))");
	const { path } = setup.configureHud({ ...f, host: "codex" });
	const args   = ["--cd", "a 'quoted' path", "prompt $(touch nope); "] ;
	const result = spawnSync(path, args, { encoding: "utf8" })           ;
	expect(result.status).toBe(0);
	expect(JSON.parse(result.stdout)).toEqual(["--plugin-root", f.pluginRoot, "--", ...args]);
	writeFileSync(path, readFileSync(path, "utf8") + "# user edit\n");
	expect(() => setup.configureHud({ ...f, host: "codex", disable: true })).toThrow("user edit owns");
	expect(readFileSync(path, "utf8")).toContain("# user edit");
	writeFileSync(path, readFileSync(path, "utf8").replace("# user edit\n", ""));
	setup.configureHud({ ...f, host: "codex", disable: true });
	expect(existsSync(path)).toBe(false);
	writeFileSync(path, "unrelated");
	expect(() => setup.configureHud({ ...f, host: "codex" })).toThrow("Another file");
	expect(readFileSync(path, "utf8")).toBe("unrelated");
});

test("HUD upgrade disables the old Codex launcher before enabling the new installation", () => {
	const old            = fixture()                        ;
	const nextPluginRoot = join   (old.root, "next plugin") ;
	cpSync(old.pluginRoot, nextPluginRoot, { recursive: true });
	writeFileSync(join(nextPluginRoot, "runtime.json"), JSON.stringify({ node: process.execPath, cli: join(old.root, "next-engine.mjs"), hudData: old.hudData }));
	const next        = { ...old, pluginRoot: nextPluginRoot }        ;
	const oldLauncher = setup.configureHud({ ...old, host: "codex" }) ;
	expect(() => setup.configureHud({ ...next, host: "codex" })).toThrow("Another file or a user edit owns");
	setup.configureHud({ ...old, host: "codex", disable: true });
	const newLauncher = setup.configureHud({ ...next, host: "codex" });
	expect(readFileSync(newLauncher.path, "utf8")).toContain(nextPluginRoot);
	writeFileSync(newLauncher.path, readFileSync(newLauncher.path, "utf8") + "# user edit\n");
	expect(() => setup.configureHud({ ...next, host: "codex", disable: true })).toThrow("user edit owns");
	expect(existsSync(oldLauncher.path)).toBe(true);
});

test("installed hook launcher forwards exact input and protocol while recording a bounded project locator", () => {
	const f       = fixture()                    ;
	const data    = join   (f.root, "host data") ;
	const project = join   (f.root, "project"  ) ;
	mkdirSync(project);
	const launcher = join(f.pluginRoot, "scripts/boxbox.mjs");
	cpSync(resolve("product/installer/launcher.mjs"), launcher);
	const engine = join(f.root, "engine.mjs");
	writeFileSync(engine, `import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'; import { createHash } from 'node:crypto'; import { join } from 'node:path'; const raw=readFileSync(0,'utf8');const input=JSON.parse(raw);const hash=x=>createHash('sha256').update(x).digest('hex');const dir=join(process.env.CLAUDE_PLUGIN_DATA,'hooks',hash(input.cwd).slice(0,16),hash(input.session_id));mkdirSync(dir,{recursive:true});writeFileSync(join(dir,'baseline.json'),'{}');process.stdout.write(raw);`);
	const input  = JSON.stringify({ session_id: "native-id", cwd: project }                                                                               ) ;
	const result = spawnSync     (process.execPath, [launcher, "hook", "session"], { input, encoding: "utf8", env: { ...process.env, PLUGIN_DATA: data } }) ;
	expect(result.status).toBe(0);
	expect(result.stdout).toBe(input);
	const pointer = join(f.hudData, createHash("sha256").update(project).digest("hex").slice(0, 16) + ".json");
	expect(JSON.parse(readFileSync(pointer, "utf8"))).toMatchObject({ schemaVersion: 1, root: project, sessionHash: createHash("sha256").update("native-id").digest("hex") });
	const tooLarge = spawnSync(process.execPath, [launcher, "hook", "session"], { input: " ".repeat(1024 * 1024 + 1), encoding: "utf8", env: { ...process.env, PLUGIN_DATA: data } });
	expect(tooLarge.status).toBe(1);
	expect(tooLarge.stderr).toContain("1 MiB");
});

test("HUD setup direct execution accepts a symlinked entry path", () => {
	const f      = fixture()                           ;
	const script = resolve("product/hud/setup.mjs"   ) ;
	const linked = join   (f.root, "linked-setup.mjs") ;
	symlinkSync(script, linked);
	const result = spawnSync(process.execPath, [linked, "codex", f.pluginRoot], { encoding: "utf8", env: { ...process.env, BOXBOX_BIN_HOME: f.environment.BOXBOX_BIN_HOME } });
	expect(result.status).toBe(0);
	expect(JSON.parse(result.stdout)).toMatchObject({ disabled: false });
});
