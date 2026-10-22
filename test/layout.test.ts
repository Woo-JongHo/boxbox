import      { afterEach, expect, test                      } from "bun:test"                             ;
import      {
              cpSync                                     ,
              existsSync                                 ,
              mkdirSync                                  ,
              mkdtempSync                                ,
              readFileSync                               ,
              rmSync                                     ,
              symlinkSync                                ,
              writeFileSync                              ,
                                                           } from "node:fs"                              ;
import      { tmpdir                                       } from "node:os"                              ;
import      { join, resolve                                } from "node:path"                            ;
import      { containedRelative, layoutViolations          } from "../development/tools/check-layout.ts" ;
import      { expectedPluginFiles, pluginDrift, syncPlugin } from "../development/tools/sync-plugin.ts"  ;

const ROOT                = resolve(import.meta.dir, "..") ;
const temporary: string[] = []                             ;

afterEach(() => {
	for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});

function workspace(): string {
	const path = mkdtempSync(join(tmpdir(), "boxbox-layout-"));
	temporary.push(path);
	return path;
}

test("relative containment handles Windows separators and cross-drive paths", () => {
	expect(containedRelative("common\\table-engine.ts"       )).toBe(true ) ;
	expect(containedRelative("..\\outside.ts"                )).toBe(false) ;
	expect(containedRelative("nested\\..\\..\\outside.ts" )   ).toBe(false) ;
	expect(containedRelative("D:\\outside.ts", true          )).toBe(false) ;
});

test("a version bump stamps generated manifests without modifying product templates", () => {
	const root = workspace();
	for (const path of ["product", "package.json", ".claude-plugin", "development/agents", "development/codex"]) cpSync(join(ROOT, path), join(root, path), { recursive: true });
	const paths     = ["product/plugin/.claude-plugin/plugin.json", "product/plugin/.codex-plugin/plugin.json", "product/packages/cli/package.json", "product/packages/node/package.json"] ;
	const originals = paths.map(path => readFileSync(join(root, path), "utf8"))                                                                                                            ;
	const manifest  = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))                                                                                                         ;
	manifest.version = "9.8.7";
	writeFileSync(join(root, "package.json"), JSON.stringify(manifest));
	syncPlugin(root);
	for (const path of ["plugin/.claude-plugin/plugin.json", "plugin/.codex-plugin/plugin.json"]) expect(JSON.parse(readFileSync(join(root, path), "utf8")).version).toBe("9.8.7");
	expect(paths.map(path => readFileSync(join(root, path), "utf8"))).toEqual  (originals                            ) ;
	expect(readFileSync(join(root, "product/engine/cli.ts"), "utf8")).toContain('export const CLI_VERSION = "9.8.7";') ;
	expect(pluginDrift(root)                                        ).toEqual  ([]                                   ) ;
});

test("dangling output links never create external files or directories", () => {
	const root = workspace();
	for (const path of ["product", "package.json", ".claude-plugin", "development/agents", "development/codex"]) cpSync(join(ROOT, path), join(root, path), { recursive: true });
	syncPlugin(root);
	const outsideFile = join(root, "external-file");
	rmSync(join(root, "plugin/README.md"));
	symlinkSync(outsideFile, join(root, "plugin/README.md"));
	expect(pluginDrift(root)      ).toContain("plugin/README.md"        ) ;
	expect(() => syncPlugin(root) ).toThrow  ("Refusing symbolic output") ;
	expect(existsSync(outsideFile)).toBe     (false                     ) ;
	rmSync(join(root, "plugin"), { recursive: true });
	const outsideDirectory = join(root, "external-directory");
	symlinkSync(outsideDirectory, join(root, "plugin"));
	expect(pluginDrift(root)           ).toContain("plugin"                           ) ;
	expect(() => syncPlugin(root)      ).toThrow  ("Unexpected generated plugin files") ;
	expect(existsSync(outsideDirectory)).toBe     (false                              ) ;
});

test("product dependencies allow mapped engine aliases and reject escapes", () => {
	expect(layoutViolations()).toEqual([]);
	const root = workspace();
	mkdirSync(join(root, "product/engine"), { recursive: true });
	mkdirSync(join(root, "product/engine/common"), { recursive: true });
	writeFileSync(join(root, "product/engine/common/table-engine.ts"), "export const table = true;\n");
	writeFileSync(join(root, "product/engine/leak.ts"), 'export { tool } from "../../development/tools/private.ts";\nconst module = import("@/common/table-engine.ts");\n');
	expect(layoutViolations(root)).toEqual(["product/engine/leak.ts: engine relative module outside alias root: ../../development/tools/private.ts"]);
	writeFileSync(join(root, "product/engine/leak.ts"), 'import type { Data } from "../../development/private.ts";\n');
	expect(layoutViolations(root)).toEqual(["product/engine/leak.ts: engine relative module outside alias root: ../../development/private.ts"]);
	writeFileSync(join(root, "product/engine/leak.ts"), 'import "./common/table-engine.ts";\n');
	expect(layoutViolations(root)).toEqual(["product/engine/leak.ts: engine module must use @/ alias: ./common/table-engine.ts"]);
	mkdirSync(join(root, "product/engine/typescript"), { recursive: true });
	mkdirSync(join(root, "product/rules/base"), { recursive: true });
	writeFileSync(join(root, "product/rules/base/typescript-layout.json"), "{}\n");
	writeFileSync(join(root, "product/engine/typescript/layout-policy.ts"), 'import data from "../../rules/base/typescript-layout.json" with { type: "json" };\n');
	writeFileSync(join(root, "product/engine/leak.ts"), 'import "@/common/table-engine.ts";\n');
	expect(layoutViolations(root)).toEqual([]);
});

test("engine aliases reject missing targets, escapes and symbolic paths", () => {
	const root = workspace();
	mkdirSync(join(root, "product/engine/common"), { recursive: true });
	writeFileSync(join(root, "product/private.ts"), "export const privateValue = true;\n");
	writeFileSync(join(root, "product/engine/leak.ts"), 'import "@/missing.ts";\nimport "@/../private.ts";\nconst missing = import("@/dynamic-missing.ts");\n');
	expect(layoutViolations(root)).toEqual([
		"product/engine/leak.ts: invalid engine alias @/missing.ts",
		"product/engine/leak.ts: invalid engine alias @/../private.ts",
		"product/engine/leak.ts: invalid engine alias @/dynamic-missing.ts",
	]);
	const outside = join(root, "outside.ts");
	writeFileSync(outside, "export const outside = true;\n");
	symlinkSync(outside, join(root, "product/engine/common/linked.ts"));
	writeFileSync(join(root, "product/engine/leak.ts"), 'import "@/common/linked.ts";\n');
	expect(layoutViolations(root)).toContain("product/engine/leak.ts: invalid engine alias @/common/linked.ts");
});

test("the entire marketplace plugin regenerates from product sources and detects manual changes", () => {
	const root = workspace();
	for (const path of ["product", "package.json", ".claude-plugin", "development/agents", "development/codex"]) cpSync(join(ROOT, path), join(root, path), { recursive: true });
	expect(existsSync(join(root, "plugin"))).toBe           (false) ;
	expect(syncPlugin(root)                ).toBeGreaterThan(0    ) ;
	expect(pluginDrift(root)               ).toEqual        ([]   ) ;
	for (const [path, content] of expectedPluginFiles(ROOT)) if (path.startsWith("plugin/")) expect(readFileSync(join(root, path), "utf8")).toBe(content);
	const source = join(root, "product/plugin/README.md");
	writeFileSync(source, readFileSync(source, "utf8") + "\nSource update.\n");
	expect(pluginDrift(root)).toContain("plugin/README.md");
	syncPlugin(root);
	expect(readFileSync(join(root, "plugin/README.md"), "utf8")).toContain("Source update.");
	writeFileSync(join(root, "plugin/README.md"), "Manual output edit.\n");
	expect(pluginDrift(root)).toContain("plugin/README.md");
	syncPlugin(root);
	expect(syncPlugin(root)).toBe(0);
	writeFileSync(join(root, "plugin/private.txt"), "Keep this unexpected file.\n");
	expect(pluginDrift(root)                                     ).toContain("plugin/private.txt"               ) ;
	expect(() => syncPlugin(root)                                ).toThrow  ("Unexpected generated plugin files") ;
	expect(readFileSync(join(root, "plugin/private.txt"), "utf8")).toBe     ("Keep this unexpected file.\n"     ) ;
});
