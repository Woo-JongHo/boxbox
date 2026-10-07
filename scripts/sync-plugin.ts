import { existsSync, readFileSync, writeFileSync } from "node:fs"   ;
import { resolve                                 } from "node:path" ;

/**
 * 배포 플러그인 폴더(plugin/)를 단일 소스에 맞춘다: 규칙 문서는 skills/xxx/references에서 복사하고,
 * 매니페스트·marketplace·shim·문서의 버전은 package.json 하나에서 찍는다. --check는 쓰지 않고 drift만 보고한다.
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

/** 경로별 기대 내용. 모든 대상은 이미 존재해야 하며 새 파일을 만들지 않는다. */
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
