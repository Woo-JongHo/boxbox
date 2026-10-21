import      { spawnSync                } from "node:child_process" ;
import      { existsSync, readFileSync } from "node:fs"            ;
import      { isAbsolute, resolve      } from "node:path"          ;
import      { fileURLToPath            } from "node:url"           ;

const root = fileURLToPath(new URL("../", import.meta.url));
const configuration = resolve(root, "runtime.json");

try {
	if (!existsSync(configuration)) throw new Error("Local runtime is missing. Rerun the BoxBox installer before using this plugin.");
	const runtime = JSON.parse(readFileSync(configuration, "utf8"));
	for (const key of ["node", "cli"]) {
		if (typeof runtime[key] !== "string" || !isAbsolute(runtime[key]) || !existsSync(runtime[key])) throw new Error(`Local runtime ${key} is missing. Rerun the BoxBox installer to repair the local runtime.`);
	}
	const env = { ...process.env };
	if (process.argv[2] === "hook") {
		const data = env.PLUGIN_DATA || env.CLAUDE_PLUGIN_DATA;
		if (!data || !isAbsolute(data)) throw new Error("Hook requires an absolute PLUGIN_DATA or CLAUDE_PLUGIN_DATA directory from the host; no project files were written.");
		env.CLAUDE_PLUGIN_DATA = data;
		env.CLAUDE_PLUGIN_ROOT = env.PLUGIN_ROOT || env.CLAUDE_PLUGIN_ROOT || root;
	}
	const child = spawnSync(runtime.node, [runtime.cli, ...process.argv.slice(2)], { stdio: "inherit", env });
	if (child.error) throw child.error;
	if (child.signal) throw new Error(`Engine terminated by ${child.signal}`);
	process.exitCode = child.status ?? 1;
} catch (error) {
	console.error(`[BoxBox] ${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
}
