import      { afterEach, expect, test                            } from "bun:test"   ;
import      { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs"    ;
import      { tmpdir                                             } from "node:os"    ;
import      { join, resolve                                      } from "node:path"  ;

const ROOT                = resolve(import.meta.dir, "..") ;
const temporary: string[] = []                             ;

function workspace(): string {
	const path = mkdtempSync(join(tmpdir(), "boxbox-alias-portability-"));
	temporary.push(path);
	return path;
}

afterEach(() => {
	for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});

test("a copied development skill resolves engine aliases and its TypeScript runtime in isolation", () => {
	const dependencies = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).dependencies as Record<string, string> ;
	const home         = workspace()                                                                                         ;
	const install = Bun.spawnSync(["bash", "development/install.sh", "codex", "--copy", "--skip-deps"], {
		cwd : ROOT,
		env : { ...process.env, BOXBOX_INSTALL_HOME: home },
	});
	expect(install.exitCode).toBe(0);
	const skill = join(home, ".codex/skills/boxbox");
	expect(existsSync(join(skill, "tsconfig.json"                  )     )).toBe(true) ;
	expect(existsSync(join(skill, "node_modules/typescript/package.json"))).toBe(true) ;
	expect(existsSync(join(skill, "node_modules/yaml/package.json"      ))).toBe(true) ;
	writeFileSync(join(skill, "engine/alias-portability-probe.ts"), [
		'import { version } from "typescript";',
		'import { parse } from "yaml";',
		'import { displayWidth } from "@/common/display-width.ts";',
		'console.log(JSON.stringify({ version, width: displayWidth("가a"), yaml: parse("ready: true").ready }));',
	].join("\n") + "\n");
	const alias = Bun.spawnSync(["bun", join(skill, "engine/alias-portability-probe.ts")], { cwd: home });
	expect(alias.exitCode                                                                         ).toBe   (0                                                         ) ;
	expect(JSON.parse(alias.stdout.toString())                                                    ).toEqual({ version: dependencies.typescript, width: 3, yaml: true }) ;
	expect(JSON.parse(readFileSync(join(skill, "node_modules/yaml/package.json"), "utf8")).version).toBe   (dependencies.yaml                                         ) ;
	const project = workspace();
	writeFileSync(join(project, "tsconfig.json"), '{"compilerOptions":{"target":"esnext"}}\n');
	writeFileSync(join(project, "sample.ts"), "const alpha = 1;\nconst beta = 2;\n");
	const engine = Bun.spawnSync(["bun", join(skill, "engine/typescript/01_group-regions.ts"), "--file", "sample.ts"], { cwd: project });
	expect(engine.exitCode).toBe(0);
	expect(engine.stdout.toString()).toContain("grid-regions file=sample.ts");
});

test("copy installation leaves no partial target when pinned dependencies are absent", () => {
	const root = workspace() ;
	const home = workspace() ;
	mkdirSync(join(root, "development/skills/boxbox"), { recursive: true });
	cpSync(join(ROOT, "development/install.sh"), join(root, "development/install.sh"));
	writeFileSync(join(root, "package.json"), '{"dependencies":{"typescript":"7.0.2","yaml":"2.9.1"}}\n');
	writeFileSync(join(root, "development/skills/boxbox/SKILL.md"), "fixture\n");
	const install = Bun.spawnSync(["bash", "development/install.sh", "codex", "--copy", "--skip-deps"], {
		cwd : root,
		env : { ...process.env, BOXBOX_INSTALL_HOME: home },
	});
	expect(install.exitCode                                             ).toBe     (1                                              ) ;
	expect(install.stdout.toString()                                    ).toContain("pinned runtime dependencies are not installed") ;
	expect(existsSync(join(home, ".codex/skills/boxbox"))               ).toBe     (false                                          ) ;
	expect(existsSync(join(home, ".codex/skills/boxbox.boxbox-managed"))).toBe     (false                                          ) ;
});

test("stale markers never authorize replacing or uninstalling a user-owned directory", () => {
	const home   = workspace()                              ;
	const target = join     (home, ".agents/skills/boxbox") ;
	mkdirSync(target, { recursive: true });
	writeFileSync(join(target, "owner.txt"), "keep\n");
	writeFileSync(`${target}.boxbox-managed`, "stale marker\n");
	const install = Bun.spawnSync(["bash", "development/install.sh", "zcode", "--copy", "--skip-deps"], {
		cwd : ROOT,
		env : { ...process.env, BOXBOX_INSTALL_HOME: home },
	});
	expect(install.exitCode).toBe(0);
	expect(existsSync(join(target, "node_modules"))).toBe(false);
	const uninstall = Bun.spawnSync(["bash", "development/install.sh", "zcode", "--uninstall", "--skip-deps"], {
		cwd : ROOT,
		env : { ...process.env, BOXBOX_INSTALL_HOME: home },
	});
	expect(uninstall.exitCode).toBe(0);
	expect(readFileSync(join(target, "owner.txt"), "utf8")).toBe("keep\n");
});

test("foreign symlinks survive install and uninstall", () => {
	const home    = workspace()                              ;
	const foreign = workspace()                              ;
	const target  = join     (home, ".agents/skills/boxbox") ;
	mkdirSync(join(target, ".."), { recursive: true });
	symlinkSync(foreign, target);
	for (const args of [["zcode"], ["zcode", "--uninstall"]]) {
		const result = Bun.spawnSync(["bash", "development/install.sh", ...args, "--skip-deps"], {
			cwd : ROOT,
			env : { ...process.env, BOXBOX_INSTALL_HOME: home },
		});
		expect(result.exitCode).toBe(0);
		expect(readlinkSync(target)).toBe(foreign);
	}
});

test("a managed copy refreshes only while its directory identity matches", () => {
	const home   = workspace()                              ;
	const target = join     (home, ".agents/skills/boxbox") ;
	for (let run = 0; run < 2; run += 1) {
		const result = Bun.spawnSync(["bash", "development/install.sh", "zcode", "--copy", "--skip-deps"], {
			cwd : ROOT,
			env : { ...process.env, BOXBOX_INSTALL_HOME: home },
		});
		expect(result.exitCode).toBe(0);
		if (run === 0) writeFileSync(join(target, "refresh-sentinel.txt"), "replace me\n");
	}
	expect(existsSync(join(target, "refresh-sentinel.txt"))).toBe(false);
	expect(readFileSync(join(target, ".boxbox-managed"), "utf8")).toBe(readFileSync(`${target}.boxbox-managed`, "utf8"));
});

test("an edited managed file copy survives refresh and uninstall", () => {
	const home   = workspace()                                                 ;
	const target = join     (home, ".codex/agents/readability-inspector.toml") ;
	const install = Bun.spawnSync(["bash", "development/install.sh", "codex", "--copy", "--skip-deps"], {
		cwd : ROOT,
		env : { ...process.env, BOXBOX_INSTALL_HOME: home },
	});
	expect(install.exitCode).toBe(0);
	writeFileSync(target, "user edit\n");
	for (const args of [["codex", "--copy"], ["codex", "--uninstall"]]) {
		const result = Bun.spawnSync(["bash", "development/install.sh", ...args, "--skip-deps"], {
			cwd : ROOT,
			env : { ...process.env, BOXBOX_INSTALL_HOME: home },
		});
		expect(result.exitCode).toBe(0);
		expect(readFileSync(target, "utf8")).toBe("user edit\n");
	}
});
