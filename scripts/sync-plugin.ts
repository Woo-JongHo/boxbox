import { existsSync, readFileSync, writeFileSync } from "node:fs"   ;
import { resolve                                 } from "node:path" ;

/**
 * Keeps the release plugin folder (plugin/) in line with the single source: rule documents are copied from skills/xxx/references,
 * and the version in manifests, marketplaces, the shim and docs is stamped from package.json alone. --check writes nothing and only reports drift.
 */

const ROOT       = resolve(import.meta.dir, "..")                                                                                     ;
const REFERENCES = ["charter.md", "grammar.md", "readability-contract.md", "typescript-grid-template.md"]                             ;
const PINNED     = ["plugin/scripts/xxx", "plugin/skills/xxx/SKILL.md", "plugin/agents/readability-inspector.md", "plugin/README.md"] ;
const MANIFESTS  = ["plugin/.claude-plugin/plugin.json", "plugin/.codex-plugin/plugin.json", "packaging/cli/package.json"]            ;

function read(path: string): string {
	return readFileSync(resolve(ROOT, path), "utf8");
}

function withVersion(path: string, version: string): string {
	const document = JSON.parse(read(path)) as Record<string, unknown>;
	if (path === ".claude-plugin/marketplace.json") for (const entry of document.plugins as Array<Record<string, unknown>>) entry.version = version;
	else document.version = version;
	return JSON.stringify(document, null, "\t") + "\n";
}

/** Expected content per path. Every target must already exist; no new files are created. */
export function expectedPluginFiles(): ReadonlyMap<string, string> {
	const version  = String((JSON.parse(read("package.json")) as { version: unknown }).version) ;
	const expected = new Map<string, string>()                                                  ;
	for (const name of REFERENCES) expected.set(`plugin/skills/xxx/references/${name}`, read(`skills/xxx/references/${name}`));
	for (const path of PINNED) expected.set(path, read(path).replaceAll(/xxx@\d+\.\d+\.\d+/gu, `xxx@${version}`));
	for (const path of [...MANIFESTS, ".claude-plugin/marketplace.json"]) expected.set(path, withVersion(path, version));
	return expected;
}

export function pluginDrift(): readonly string[] {
	return [...expectedPluginFiles()].filter(([path, text]) => !existsSync(resolve(ROOT, path)) || read(path) !== text).map(([path]) => path);
}

if (import.meta.main) {
	const drift = pluginDrift();
	if (process.argv.includes("--check")) {
		for (const path of drift) console.error(`drift: ${path}`);
		process.exit(drift.length === 0 ? 0 : 1);
	}
	for (const [path, text] of expectedPluginFiles()) if (drift.includes(path)) writeFileSync(resolve(ROOT, path), text);
	console.log(drift.length === 0 ? "plugin already in sync" : `synced ${drift.length} file(s)`);
}
