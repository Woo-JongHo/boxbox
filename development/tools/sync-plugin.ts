import      {
              chmodSync            ,
              lstatSync            ,
              mkdirSync            ,
              readdirSync          ,
              readFileSync         ,
              writeFileSync        ,
                                     } from "node:fs"   ;
import      { dirname, join, resolve } from "node:path" ;

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

/** Every shipped file comes from product/. This also reconstructs a missing plugin/ folder. */
export function expectedPluginFiles(root = ROOT): ReadonlyMap<string, string> {
	const read      = (path: string): string => readFileSync(resolve(root, path), "utf8")        ;
	const version   = String((JSON.parse(read("package.json")) as { version: unknown }).version) ;
	const expected  = new Map<string, string>()                                                  ;
	const cliPath   = "product/engine/cli.ts"                                                    ;
	const cliSource = read(cliPath)                                                              ;
	if (!/^export const CLI_VERSION = "[^"\n]+";/mu.test(cliSource)) throw new Error("Missing CLI_VERSION declaration; update version synchronization before shipping.");
	expected.set(cliPath, cliSource.replace(/^export const CLI_VERSION = "[^"\n]+";/mu, `export const CLI_VERSION = "${version}";`));
	for (const path of PLUGIN_FILES) {
		const source = `product/plugin/${path}`         ;
		let text     = versioned(read(source), version) ;
		if (path.endsWith("/plugin.json")) {
			const manifest = JSON.parse(text) as Record<string, unknown>;
			manifest.version = version;
			text = JSON.stringify(manifest, null, "\t") + "\n";
		}
		expected.set(`plugin/${path}`, text);
	}
	for (const name of REFERENCES) expected.set(`plugin/skills/boxbox/references/${name}`, read(`product/rules/references/${name}`));
	const marketplace = JSON.parse(read(".claude-plugin/marketplace.json")) as { plugins: Array<Record<string, unknown>> };
	for (const entry of marketplace.plugins) entry.version = version;
	expected.set(".claude-plugin/marketplace.json", JSON.stringify(marketplace, null, "\t") + "\n");
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
