import { existsSync, readFileSync, realpathSync } from "node:fs"   ;
import { dirname, resolve                      } from "node:path" ;

function registrationSource(entry) {
	const value = entry?.root ?? entry?.marketplaceSource?.source;
	return typeof value === "string" ? resolve(value) : undefined;
}

export function codexRegistration(root, metadata, invoke) {
	const selector = `${metadata.name}@${metadata.marketplace}`;

	function json(args) {
		const output = invoke(args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).stdout;
		return JSON.parse(output);
	}

	function inspect() {
		const marketplaces = json(["plugin", "marketplace", "list", "--json"]);
		if (!Array.isArray(marketplaces?.marketplaces)) throw new Error("Unexpected Codex marketplace list schema.");
		const matches = marketplaces.marketplaces.filter(entry => entry?.name === metadata.marketplace);
		if (matches.length > 1) throw new Error("Multiple Codex BoxBox marketplace registrations were found; remove the duplicates before installation.");
		if (matches.length === 0) return { previous: undefined, installed: false };
		const previous = registrationSource(matches[0]);
		if (!previous) throw new Error("Existing Codex BoxBox marketplace has no local source path.");
		if (previous !== resolve(root)) {
			if (!existsSync(previous) || dirname(realpathSync(previous)) !== realpathSync(dirname(root))) throw new Error("Existing Codex BoxBox marketplace is not owned by this installer; remove it manually before installation.");
			const bundle = JSON.parse(readFileSync(resolve(previous, "bundle.json"), "utf8"));
			if (bundle.host !== "codex" || bundle.name !== metadata.name || bundle.marketplace !== metadata.marketplace) throw new Error("Existing Codex BoxBox marketplace ownership metadata does not match this installer.");
		}
		const plugins = json(["plugin", "list", "--json"]);
		if (!Array.isArray(plugins?.installed)) throw new Error("Unexpected Codex plugin list schema.");
		return { previous, installed: plugins.installed.some(entry => entry?.pluginId === selector && entry?.installed === true) };
	}

	let state;
	return {
		preflight() { state = inspect(); },
		transition() {
			state ??= inspect();
			if (state.previous === resolve(root)) {
				if (!state.installed) invoke(["plugin", "add", selector]);
				return;
			}
			if (state.previous) {
				if (state.installed) invoke(["plugin", "remove", selector]);
				invoke(["plugin", "marketplace", "remove", metadata.marketplace]);
			}
			try {
				invoke(["plugin", "marketplace", "add", root]);
				invoke(["plugin", "add", selector]);
			} catch (error) {
				if (state.previous) {
					try {
						invoke(["plugin", "marketplace", "add", state.previous]);
						if (state.installed) invoke(["plugin", "add", selector]);
					} catch { /* Preserve the original transition error; the installer receipt names manual recovery. */ }
				}
				throw error;
			}
		},
	};
}
