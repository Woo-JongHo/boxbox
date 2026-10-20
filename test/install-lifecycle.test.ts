import      {
              existsSync    ,
              lstatSync     ,
              mkdtempSync   ,
              mkdirSync     ,
              readFileSync  ,
              realpathSync  ,
              rmSync        ,
              writeFileSync ,
                              } from "node:fs"   ;
import      { tmpdir          } from "node:os"   ;
import      { join, resolve   } from "node:path" ;
import      {
              afterEach     ,
              describe      ,
              expect        ,
              test          ,
                              } from "bun:test"  ;

const ROOT            = resolve(import.meta.dir, "..") ;
const homes: string[] = []                             ;

function temporaryHome(): string {
	const home = mkdtempSync(join(tmpdir(), "boxbox-install-"));
	homes.push(home);
	return home;
}

function install(home: string, ...args: string[]): ReturnType<typeof Bun.spawnSync> {
	return Bun.spawnSync(["bash", "development/install.sh", ...args, "--skip-deps"], {
		cwd : ROOT,
		env : { ...process.env, BOXBOX_INSTALL_HOME: home },
	});
}

afterEach(() => {
	for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true });
});

describe("install.sh lifecycle", () => {
	test("links the same skill source into Claude, ZCode and Codex and survives a rerun", () => {
		const home = temporaryHome();
		for (let run = 0; run < 2; run += 1) expect(install(home, "claude", "zcode", "codex").exitCode).toBe(0);

		const skillLinks = [
			join(home, ".claude/skills/boxbox"),
			join(home, ".agents/skills/boxbox"),
			join(home, ".codex/skills/boxbox"),
		];
		for (const link of skillLinks) {
			expect(lstatSync(link).isSymbolicLink()).toBe(true);
			expect(realpathSync(link)).toBe(realpathSync(resolve(ROOT, "development/skills/boxbox")));
		}
		expect(lstatSync(join(home, ".claude/agents/readability-inspector.md")).isSymbolicLink()).toBe(true);
		expect(lstatSync(join(home, ".codex/agents/readability-inspector.toml")).isSymbolicLink()).toBe(true);
	});

	test("copy install creates an independent copy and uninstall removes only installed targets", () => {
		const home = temporaryHome();
		expect(install(home, "codex", "--copy").exitCode).toBe(0);
		const skill = join(home, ".codex/skills/boxbox");
		expect(lstatSync(skill).isDirectory()                   ).toBe     (true          ) ;
		expect(readFileSync(join(skill, "SKILL.md"), "utf8")    ).toContain("name: boxbox") ;
		expect(lstatSync(join(skill, "engine")).isSymbolicLink()).toBe     (false         ) ;
		expect(lstatSync(join(skill, "rules")).isSymbolicLink() ).toBe     (false         ) ;
		expect(existsSync(join(skill, "fixtures"))              ).toBe     (false         ) ;
		const runtime = Bun.spawnSync(["bun", "-e", 'const { surfaceOf } = await import(process.argv[1]); console.log(surfaceOf("python").language);', join(skill, "engine/common/surface.ts")], { cwd: home });
		expect(runtime.exitCode).toBe(0);
		expect(runtime.stdout.toString().trim()).toBe("python");

		expect(install(home, "codex", "--uninstall").exitCode).toBe(0);
		expect(existsSync(skill)).toBe(false);
	});

	test("never overwrites a regular file owned by the user", () => {
		const home   = temporaryHome()                    ;
		const target = join(home, ".codex/skills/boxbox") ;
		mkdirSync(target, { recursive: true });
		writeFileSync(join(target, "owner.txt"), "keep\n");

		const result = install(home, "codex");
		expect(result.exitCode                                ).toBe     (0                                     ) ;
		expect(result.stdout?.toString() ?? ""                ).toContain("existing entry that is not a symlink") ;
		expect(readFileSync(join(target, "owner.txt"), "utf8")).toBe     ("keep\n"                              ) ;
	});
});
