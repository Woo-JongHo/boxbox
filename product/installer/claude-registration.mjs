import      { lstatSync, readFileSync, realpathSync } from "node:fs"   ;
import      { dirname, join, resolve                } from "node:path" ;

/** Check before repair copies can erase evidence of a foreign or shared catalog. */
export function assertClaudeCatalog(root, metadata, allowMissing = false) {
	const directory = join(root     , ".claude-plugin"  ) ;
	const path      = join(directory, "marketplace.json") ;
	for (const [target, isDirectory] of [[directory, true], [path, false]]) {
		let stat;
		try { stat = lstatSync(target); } catch (error) {
			if (allowMissing && error.code === "ENOENT") return;
			throw error;
		}
		if (stat.isSymbolicLink() || (isDirectory ? !stat.isDirectory() : !stat.isFile())) throw new Error(`Refusing non-regular Claude marketplace catalog: ${target}`);
	}
	const catalog = JSON.parse(readFileSync(path, "utf8"));
	if (catalog.name !== metadata.marketplace || !Array.isArray(catalog.plugins) || catalog.plugins.length !== 1 || catalog.plugins[0].name !== metadata.name || catalog.plugins[0].source !== "./plugin") throw new Error("Refusing a foreign or shared Claude marketplace catalog.");
}

/** Bind updates to the installer-owned local marketplace, never a same-named foreign source. */
export function claudeRegistration(root, metadata, invoke) {
	const intended = realpathSync(root)                         ;
	const id       = `${metadata.name}@${metadata.marketplace}` ;
	function json(args) {
		const value = JSON.parse(invoke(args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).stdout);
		if (!Array.isArray(value)) throw new Error(`Unexpected Claude list schema for ${args.join(" ")}`);
		return value;
	}
	function marketplace(exact) {
		const entries = json(["plugin", "marketplace", "list", "--json"]).filter(value => value.name === metadata.marketplace);
		if (!entries.length && !exact) return;
		if (entries.length !== 1 || entries[0].source !== "directory" || typeof entries[0].path !== "string" || typeof entries[0].installLocation !== "string") throw new Error("Claude marketplace is missing, ambiguous or not an owned local directory.");
		const source = realpathSync(entries[0].path);
		if (realpathSync(entries[0].installLocation) !== source) throw new Error("Claude marketplace installLocation does not match its source.");
		if (exact && source !== intended) throw new Error("Claude marketplace did not select the intended installation root.");
		if (dirname(source) !== dirname(intended)) throw new Error("Refusing to replace a foreign Claude marketplace.");
		const bundle   = JSON.parse(readFileSync(join(source, "bundle.json"), "utf8"))                       ;
		const manifest = JSON.parse(readFileSync(join(source, "plugin/.claude-plugin/plugin.json"), "utf8")) ;
		if (bundle.name !== metadata.name || bundle.host !== "claude" || bundle.marketplace !== metadata.marketplace || manifest.name !== metadata.name || manifest.version !== bundle.version || source !== realpathSync(resolve(dirname(intended), bundle.version))) throw new Error("Claude marketplace ownership could not be established.");
		assertClaudeCatalog(source, metadata);
		return source;
	}
	function plugin(required) {
		const all = json(["plugin", "list", "--json"]);
		if (all.some(value => typeof value.id === "string" && value.id.endsWith(`@${metadata.marketplace}`) && value.id !== id)) throw new Error("Refusing to replace a Claude marketplace shared with another plugin.");
		const entries = all.filter(value => value.id === id);
		if (!entries.length && !required) return;
		if (entries.length !== 1 || entries[0].scope !== "user" || entries[0].enabled !== true || typeof entries[0].installPath !== "string") throw new Error("Claude plugin identity is missing, ambiguous, disabled or outside user scope.");
		return entries[0];
	}
	function preflight() {
		const help = invoke(["plugin", "update", "--help"], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).stdout;
		if (!/(?:^|\s)--scope(?:[\s=,]|$)/u.test(help)) throw new Error("Claude plugin update does not advertise --scope support; upgrade Claude before installation.");
		const source = marketplace(false);
		if (plugin(false) && !source) throw new Error("Existing Claude plugin has no owned marketplace registration.");
	}
	function verify() {
		marketplace(true);
		let installed = plugin(true);
		if (installed.version !== metadata.version) {
			invoke(["plugin", "update", id, "--scope", "user"]);
			marketplace(true);
			installed = plugin(true);
		}
		if (installed.version !== metadata.version) throw new Error("Claude retained the wrong plugin version after registration.");
		const cached   = realpathSync(installed.installPath                                           ) ;
		const manifest = JSON.parse  (readFileSync(join(cached, ".claude-plugin/plugin.json"), "utf8")) ;
		const runtime  = JSON.parse  (readFileSync(join(cached, "runtime.json"), "utf8")              ) ;
		const expected = JSON.parse  (readFileSync(join(intended, "plugin/runtime.json"), "utf8")     ) ;
		if (manifest.name !== metadata.name || manifest.version !== metadata.version || realpathSync(runtime.cli) !== realpathSync(expected.cli) || realpathSync(runtime.node) !== realpathSync(expected.node)) throw new Error("Claude cached plugin identity or runtime does not match the intended installation.");
	}
	return { preflight, marketplace: () => marketplace(true), verify };
}
