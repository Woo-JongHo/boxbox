import      { existsSync, lstatSync, readdirSync } from "node:fs"                             ;
import      { readFileSync, statSync             } from "node:fs"                             ;
import      { join, resolve                      } from "node:path"                           ;
import      { describe, expect, test             } from "bun:test"                            ;
import      { AXIS_NOTES, KIND_AXES              } from "@/typescript/grid-kinds.ts"          ;
import      { pluginDrift                        } from "../development/tools/sync-plugin.ts" ;

const ROOT                    = resolve(import.meta.dir, "..")                                                               ;
const read                    = (path: string): string => readFileSync(resolve(ROOT, path), "utf8")                          ;
const parseJson               = (path: string): Record<string, unknown> => JSON.parse(read(path)) as Record<string, unknown> ;
const LANGUAGE_DISCOVERY_TEXT = "TypeScript, Python, Java, Go, Rust, JavaScript, C, C++, Swift, and Kotlin"                  ;

describe("plugin distribution contract", () => {
	test("package, Claude and Codex manifests and both marketplaces share name and version", () => {
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

	test("plugin components live inside the plugin folder", () => {
		// Agents are discovered from the default location: with an agents array in the manifest, Claude Code 2.1.286 did not detect the inspector.
		expect(parseJson("plugin/.claude-plugin/plugin.json").agents).toBeUndefined();
		for (const path of ["agents/readability-inspector.md", "skills/boxbox/SKILL.md", "hooks/hooks.json", "scripts/boxbox", "README.md"]) expect(existsSync(resolve(ROOT, "plugin", path))).toBe(true);
		expect(statSync(resolve(ROOT, "plugin/scripts/boxbox")).mode & 0o111               ).not.toBe(0   ) ;
		expect(existsSync(resolve(ROOT, "development/skills/boxbox/SKILL.md")             ))    .toBe(true) ;
		expect(existsSync(resolve(ROOT, "development/agents/readability-inspector.md") )   )    .toBe(true) ;
		expect(existsSync(resolve(ROOT, "development/codex/readability-inspector.toml"))   )    .toBe(true) ;
	});

	test("the development skill lists every language; the shipped plugin introduces only the first public scope", () => {
		for (const description of [String(parseJson("package.json").description), read("development/skills/boxbox/SKILL.md").split("---", 3)[1] ?? ""]) {
			expect(description).toContain(LANGUAGE_DISCOVERY_TEXT);
		}
		const published = [
			String(parseJson("plugin/.claude-plugin/plugin.json").description),
			String(parseJson("plugin/.codex-plugin/plugin.json").description),
			String((parseJson(".claude-plugin/marketplace.json").plugins as Array<Record<string, unknown>>)[0]!.description),
			read("plugin/skills/boxbox/SKILL.md").split("---", 3)[1] ?? "",
		];
		for (const description of published) expect(description).toContain("TypeScript and Python");
	});

	test("the plugin folder does not drift from the single source", () => {
		expect(pluginDrift()).toEqual([]);
	});

	test("hooks call only the shim inside the plugin, and the shim requires an explicit local engine", () => {
		const hooks    = JSON.parse(read("plugin/hooks/hooks.json")) as { hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>> } ;
		const commands = Object.values(hooks.hooks).flat().flatMap(entry => entry.hooks.map(hook => hook.command))                              ;
		expect(commands.length).toBe(3);
		for (const command of commands) expect(command).toMatch(/^"\$\{CLAUDE_PLUGIN_ROOT\}"\/scripts\/boxbox hook (session|post|stop)$/u);
		expect(read("plugin/scripts/boxbox")).toContain('exec node "$BOXBOX_CLI" "$@"');
		expect(read("plugin/scripts/boxbox")).not.toContain("exec npx");
	});

	test("the plugin folder stays within the directory submission limits", () => {
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
		const skill = read("development/skills/boxbox/SKILL.md");
		expect(skill).not.toContain("test/code-readability-tools.test.ts");
	});

	test("every table-kind axis has a human-readable note", () => {
		for (const axes of Object.values(KIND_AXES)) {
			for (const axis of [...axes.gap, ...axes.insert]) expect(AXIS_NOTES[axis.replaceAll("{i}", "")]).toBeDefined();
		}
	});
});
