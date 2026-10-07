import      { existsSync, lstatSync, readdirSync } from "node:fs"                    ;
import      { readFileSync, statSync             } from "node:fs"                    ;
import      { join, resolve                      } from "node:path"                  ;
import      { describe, expect, test             } from "bun:test"                   ;
import      { AXIS_NOTES, KIND_AXES              } from "@/typescript/grid-kinds.ts" ;
import      { pluginDrift                        } from "../scripts/sync-plugin.ts"  ;

const ROOT                    = resolve(import.meta.dir, "..")                                                               ;
const read                    = (path: string): string => readFileSync(resolve(ROOT, path), "utf8")                          ;
const parseJson               = (path: string): Record<string, unknown> => JSON.parse(read(path)) as Record<string, unknown> ;
const LANGUAGE_DISCOVERY_TEXT = "TypeScript, Python, Java, Go, Rust, JavaScript, C, C++, Swift, and Kotlin"                  ;

describe("plugin distribution contract", () => {
	test("package, Claude·Codex 매니페스트와 두 marketplace가 이름·버전을 공유한다", () => {
		const packageJson = parseJson("package.json")                                                                     ;
		const claude      = parseJson("plugin/.claude-plugin/plugin.json")                                                ;
		const codex       = parseJson("plugin/.codex-plugin/plugin.json")                                                 ;
		const entry       = (parseJson(".claude-plugin/marketplace.json").plugins as Array<Record<string, unknown>>)[0]!  ;
		const codexEntry  = (parseJson(".agents/plugins/marketplace.json").plugins as Array<Record<string, unknown>>)[0]! ;

		for (const manifest of [claude, codex]) {
			expect(manifest.name   ).toBe(packageJson.name   ) ;
			expect(manifest.version).toBe(packageJson.version) ;
		}
		expect(entry.name       ).toBe   (packageJson.name                     ) ;
		expect(entry.version    ).toBe   (packageJson.version                  ) ;
		expect(entry.source     ).toBe   ("./plugin"                           ) ;
		expect(codexEntry.name  ).toBe   (packageJson.name                     ) ;
		expect(codexEntry.source).toEqual({ source: "local", path: "./plugin" }) ;
	});

	test("플러그인 구성 요소가 플러그인 폴더 안에 있다", () => {
		// agents는 기본 위치로 탐색시킨다: 매니페스트에 agents 배열을 두면 Claude Code 2.1.286이 inspector를 인식하지 않았다.
		expect(parseJson("plugin/.claude-plugin/plugin.json").agents).toBeUndefined();
		for (const path of ["agents/readability-inspector.md", "skills/xxx/SKILL.md", "hooks/hooks.json", "scripts/xxx", "README.md"]) expect(existsSync(resolve(ROOT, "plugin", path))).toBe(true);
		expect(statSync(resolve(ROOT, "plugin/scripts/xxx")).mode & 0o111   ).not.toBe(0   ) ;
		expect(existsSync(resolve(ROOT, "skills/xxx/SKILL.md")             ))    .toBe(true) ;
		expect(existsSync(resolve(ROOT, "agents/readability-inspector.md") ))    .toBe(true) ;
		expect(existsSync(resolve(ROOT, "codex/readability-inspector.toml")))    .toBe(true) ;
	});

	test("개발 스킬은 전체 언어를, 배포 플러그인은 첫 공개 범위만 소개한다", () => {
		for (const description of [String(parseJson("package.json").description), read("skills/xxx/SKILL.md").split("---", 3)[1] ?? ""]) {
			expect(description).toContain(LANGUAGE_DISCOVERY_TEXT);
		}
		const published = [
			String(parseJson("plugin/.claude-plugin/plugin.json").description),
			String(parseJson("plugin/.codex-plugin/plugin.json").description),
			String((parseJson(".claude-plugin/marketplace.json").plugins as Array<Record<string, unknown>>)[0]!.description),
			read("plugin/skills/xxx/SKILL.md").split("---", 3)[1] ?? "",
		];
		for (const description of published) expect(description).toContain("TypeScript and Python");
	});

	test("플러그인 폴더가 단일 소스와 어긋나지 않는다", () => {
		expect(pluginDrift()).toEqual([]);
	});

	test("훅은 플러그인 안 shim만 부르고 shim은 정확한 엔진 버전을 고정한다", () => {
		const hooks    = JSON.parse(read("plugin/hooks/hooks.json")) as { hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>> } ;
		const commands = Object.values(hooks.hooks).flat().flatMap(entry => entry.hooks.map(hook => hook.command))                              ;
		expect(commands.length).toBe(3);
		for (const command of commands) expect(command).toMatch(/^"\$\{CLAUDE_PLUGIN_ROOT\}"\/scripts\/xxx hook (session|post|stop)$/u);
		expect(read("plugin/scripts/xxx")).toContain(`exec npx --yes "xxx@${String(parseJson("package.json").version)}" "$@"`);
	});

	test("플러그인 폴더가 디렉터리 제출 한도를 지킨다", () => {
		const files = readdirSync(resolve(ROOT, "plugin"), { recursive: true, withFileTypes: true }).filter(entry => !entry.isDirectory());
		expect(files.length).toBeLessThanOrEqual(512);
		for (const entry of files) {
			const path = join(entry.parentPath, entry.name);
			expect(lstatSync(path).isSymbolicLink()         )    .toBe        (false     ) ;
			expect(statSync(path).size                      )    .toBeLessThan(256 * 1024) ;
			expect([".DS_Store", "Thumbs.db", "desktop.ini"]).not.toContain   (entry.name) ;
		}
	});

	test("shipped docs never instruct running a nonexistent repository test", () => {
		const skill = read("skills/xxx/SKILL.md");
		expect(skill).not.toContain("test/code-readability-tools.test.ts");
	});

	test("every table-kind axis has a human-readable note", () => {
		for (const axes of Object.values(KIND_AXES)) {
			for (const axis of [...axes.gap, ...axes.insert]) expect(AXIS_NOTES[axis.replaceAll("{i}", "")]).toBeDefined();
		}
	});
});
