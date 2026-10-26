import      {
              chmodSync                                        ,
              lstatSync                                        ,
              mkdirSync                                        ,
              readdirSync                                      ,
              readFileSync                                     ,
              writeFileSync                                    ,
                                                                 } from "node:fs"                ;
import      { dirname, join, resolve                             } from "node:path"              ;
import      { readModelConfig, stampClaudeAgent, stampCodexAgent } from "./model-assignments.ts" ;

const ROOT       = resolve(import.meta.dir, "../..")                                                      ;
const REFERENCES = ["charter.md", "grammar.md", "readability-contract.md", "typescript-grid-template.md"] ;
const PLUGIN_FILES = [
	".claude-plugin/plugin.json",
	".codex-plugin/plugin.json",
	"README.md",
	"agents/readability-inspector.md",
	"hooks/hooks.json",
	"scripts/boxbox",
	"skills/boxbox/SKILL.md",
];

function versioned(text: string, version: string): string {
	return text.replaceAll(/boxbox@\d+\.\d+\.\d+/gu, `boxbox@${version}`);
}

interface JsonStringRange {
	readonly start : number ;
	readonly end   : number ;
	readonly value : string ;
}

function marketplaceVersionRanges(text: string): readonly JsonStringRange[] {
	let offset                      = 0                                                                   ;
	const ranges: JsonStringRange[] = []                                                                  ;
	const skipWhitespace            = (): void => { while (/\s/u.test(text[offset] ?? "")) offset += 1; } ;
	const readString = (): JsonStringRange => {
		const start = offset;
		offset += 1;
		while (offset < text.length) {
			if (text[offset] === "\\") { offset += 2; continue; }
			if (text[offset] === '"') {
				offset += 1;
				return { start, end: offset, value: JSON.parse(text.slice(start, offset)) as string };
			}
			offset += 1;
		}
		throw new Error("Unterminated JSON string in marketplace");
	};
	const readValue = (path: readonly (number | string)[]): void => {
		skipWhitespace();
		if (text[offset] === '"') {
			const value = readString();
			if (path.length === 3 && path[0] === "plugins" && typeof path[1] === "number" && path[2] === "version") ranges.push(value);
			return;
		}
		if (text[offset] === "{") {
			offset += 1;
			skipWhitespace();
			const keys = new Set<string>();
			while (text[offset] !== "}") {
				const key = readString();
				if (keys.has(key.value)) throw new Error(`Duplicate marketplace JSON key: ${key.value}`);
				keys.add(key.value);
				skipWhitespace();
				if (text[offset] !== ":") throw new Error("Missing JSON property separator in marketplace");
				offset += 1;
				readValue([...path, key.value]);
				skipWhitespace();
				if (text[offset] !== ",") break;
				offset += 1;
				skipWhitespace();
			}
			if (text[offset] !== "}") throw new Error("Unterminated JSON object in marketplace");
			offset += 1;
			return;
		}
		if (text[offset] === "[") {
			offset += 1;
			skipWhitespace();
			let index = 0;
			while (text[offset] !== "]") {
				readValue([...path, index]);
				index += 1;
				skipWhitespace();
				if (text[offset] !== ",") break;
				offset += 1;
				skipWhitespace();
			}
			if (text[offset] !== "]") throw new Error("Unterminated JSON array in marketplace");
			offset += 1;
			return;
		}
		while (offset < text.length && !/[\s,\]}]/u.test(text[offset]!)) offset += 1;
	};

	readValue([]);
	skipWhitespace();
	if (offset !== text.length) throw new Error("Unexpected JSON content after marketplace root");
	return ranges;
}

export function stampMarketplaceVersions(text: string, version: string): string {
	const marketplace = JSON.parse(text) as { plugins?: unknown };
	if (!marketplace || typeof marketplace !== "object" || !Array.isArray(marketplace.plugins)) throw new Error("Marketplace plugins must be an array");
	for (const entry of marketplace.plugins) {
		if (!entry || typeof entry !== "object" || Array.isArray(entry) || typeof (entry as Record<string, unknown>).version !== "string") {
			throw new Error("Every marketplace plugin must have a string version");
		}
		(entry as Record<string, unknown>).version = version;
	}
	const ranges = marketplaceVersionRanges(text);
	if (ranges.length !== marketplace.plugins.length) throw new Error("Marketplace version locations do not match parsed plugin entries");
	let output = text;
	for (const range of ranges.toReversed()) output = `${output.slice(0, range.start)}${JSON.stringify(version)}${output.slice(range.end)}`;
	if (JSON.stringify(JSON.parse(output)) !== JSON.stringify(marketplace)) throw new Error("Marketplace version stamping changed another parsed field");
	return output;
}

/** Every shipped file comes from product/. This also reconstructs a missing plugin/ folder. */
export function expectedPluginFiles(root = ROOT): ReadonlyMap<string, string> {
	const read      = (path: string): string => readFileSync(resolve(root, path), "utf8")        ;
	const version   = String((JSON.parse(read("package.json")) as { version: unknown }).version) ;
	const expected  = new Map<string, string>()                                                  ;
	const cliPath   = "product/engine/cli.ts"                                                    ;
	const cliSource = read(cliPath)                                                              ;
	if (!/^export const CLI_VERSION = "[^"\n]+";/mu.test(cliSource)) throw new Error("Missing CLI_VERSION declaration; update version synchronization before shipping.");
	expected.set(cliPath, cliSource.replace(/^export const CLI_VERSION = "[^"\n]+";/mu, `export const CLI_VERSION = "${version}";`));
	const inspector = readModelConfig(root).roles.inspector;
	for (const path of PLUGIN_FILES) {
		const source = `product/plugin/${path}`         ;
		let text     = versioned(read(source), version) ;
		if (path === "agents/readability-inspector.md") text = stampClaudeAgent(text, inspector.claude);
		if (path.endsWith("/plugin.json")) {
			const manifest = JSON.parse(text) as Record<string, unknown>;
			manifest.version = version;
			text = JSON.stringify(manifest, null, "\t") + "\n";
		}
		expected.set(`plugin/${path}`, text);
	}
	// The development agents are stamped in place from the same source, so the two hosts cannot drift apart.
	expected.set("development/agents/readability-inspector.md", stampClaudeAgent(read("development/agents/readability-inspector.md"), inspector.claude));
	expected.set("development/codex/readability-inspector.toml", stampCodexAgent(read("development/codex/readability-inspector.toml"), inspector.codex));
	for (const name of REFERENCES) expected.set(`plugin/skills/boxbox/references/${name}`, read(`product/rules/references/${name}`));
	expected.set(".claude-plugin/marketplace.json", stampMarketplaceVersions(read(".claude-plugin/marketplace.json"), version));
	return expected;
}

function pluginFiles(root: string, directory = "plugin"): string[] {
	const absolute = resolve  (root, directory                    ) ;
	const stat     = lstatSync(absolute, { throwIfNoEntry: false }) ;
	if (!stat) return [];
	if (stat.isSymbolicLink() || !stat.isDirectory()) return [directory];
	return readdirSync(absolute).flatMap(name => {
		const path = join(directory, name);
		return lstatSync(resolve(root, path)).isDirectory() ? pluginFiles(root, path) : [path];
	});
}

export function pluginDrift(root = ROOT): readonly string[] {
	const expected = expectedPluginFiles(root);
	const drift = [...expected].filter(([path, text]) => {
		const absolute = resolve  (root, path                         ) ;
		const stat     = lstatSync(absolute, { throwIfNoEntry: false }) ;
		return !stat || !stat.isFile() || readFileSync(absolute, "utf8") !== text || (path === "plugin/scripts/boxbox" && (stat.mode & 0o111) === 0);
	}).map(([path]) => path);
	return [...drift, ...pluginFiles(root).filter(path => !expected.has(path))];
}

/** Refuse unknown files instead of silently deleting manually added content. */
export function syncPlugin(root = ROOT): number {
	const expected = expectedPluginFiles(root)                             ;
	const extras   = pluginFiles(root).filter(path => !expected.has(path)) ;
	if (extras.length) throw new Error(`Unexpected generated plugin files: ${extras.join(", ")}`);
	const drift = pluginDrift(root);
	for (const path of drift) {
		const absolute = resolve(root, path) ;
		let parent     = dirname(absolute  ) ;
		while (parent !== resolve(root)) {
			if (lstatSync(parent, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error(`Refusing symbolic output directory: ${parent}`);
			parent = dirname(parent);
		}
		if (lstatSync(absolute, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error(`Refusing symbolic output: ${path}`);
		mkdirSync(dirname(absolute), { recursive: true });
		writeFileSync(absolute, expected.get(path)!);
	}
	chmodSync(resolve(root, "plugin/scripts/boxbox"), 0o755);
	return drift.length;
}

if (import.meta.main) {
	if (process.argv.includes("--check")) {
		const drift = pluginDrift();
		for (const path of drift) console.error(`drift: ${path}`);
		process.exitCode = drift.length ? 1 : 0;
	} else console.log(`synced ${syncPlugin()} file(s)`);
}
