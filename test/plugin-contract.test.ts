import      { existsSync, readFileSync } from "node:fs"                                        ;
import      { resolve                  } from "node:path"                                      ;
import      { describe, expect, test   } from "bun:test"                                       ;
import      { AXIS_NOTES, KIND_AXES    } from "../skills/xxx/scripts/typescript/grid-kinds.ts" ;

const ROOT                    = resolve(import.meta.dir, "..")                                                               ;
const read                    = (path: string): string => readFileSync(resolve(ROOT, path), "utf8")                          ;
const parseJson               = (path: string): Record<string, unknown> => JSON.parse(read(path)) as Record<string, unknown> ;
const LANGUAGE_DISCOVERY_TEXT = "TypeScript, Python, Java, Go, Rust, JavaScript, C, and C++"                                 ;

describe("plugin distribution contract", () => {
	test("package, plugin and marketplace share version and identity", () => {
		const packageJson = parseJson("package.json")                                   ;
		const plugin      = parseJson(".claude-plugin/plugin.json")                     ;
		const marketplace = parseJson(".claude-plugin/marketplace.json")                ;
		const entry       = (marketplace.plugins as Array<Record<string, unknown>>)[0]! ;

		expect(plugin.name   ).toBe(packageJson.name   ) ;
		expect(entry.name    ).toBe(packageJson.name   ) ;
		expect(plugin.version).toBe(packageJson.version) ;
		expect(entry.version ).toBe(packageJson.version) ;
		expect(entry.source  ).toBe("./"               ) ;
	});

	test("skills and agents referenced by the manifest exist", () => {
		const plugin = parseJson(".claude-plugin/plugin.json");
		for (const field of ["skills", "agents"] as const) {
			const relative = String(plugin[field]).replace(/^\.\//u, "");
			expect(existsSync(resolve(ROOT, relative))).toBe(true);
		}
		expect(existsSync(resolve(ROOT, "skills/xxx/SKILL.md")             )).toBe(true) ;
		expect(existsSync(resolve(ROOT, "agents/readability-inspector.md") )).toBe(true) ;
		expect(existsSync(resolve(ROOT, "codex/readability-inspector.toml"))).toBe(true) ;
	});

	test("discovery descriptions list every supported language", () => {
		const descriptions = [
			String(parseJson("package.json").description),
			String(parseJson(".claude-plugin/plugin.json").description),
			String((parseJson(".claude-plugin/marketplace.json").plugins as Array<Record<string, unknown>>)[0]!.description),
			read("skills/xxx/SKILL.md").split("---", 3)[1] ?? "",
		];
		for (const description of descriptions) expect(description).toContain(LANGUAGE_DISCOVERY_TEXT);
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
