import      { spawnSync       } from "node:child_process" ;
import      {
              chmodSync     ,
              cpSync        ,
              mkdirSync     ,
              readFileSync  ,
              rmSync        ,
              writeFileSync ,
                              } from "node:fs"            ;
import      { join, resolve   } from "node:path"          ;

const ROOT = resolve(import.meta.dir, "..", "..");

function run(command: string, args: readonly string[]): string {
	const child = spawnSync(command, args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
	if (child.error) throw child.error;
	if (child.status !== 0) throw new Error(`${command} exited with ${child.status ?? child.signal}`);
	console.log(child.stdout);
	return child.stdout;
}

function projectDocument(source: string): string {
	const projected = source.replaceAll(/"<PLUGIN_ROOT>\/scripts\/boxbox"/gu, "@BOXBOX_ENGINE_COMMAND@");
	if (!projected.includes("@BOXBOX_ENGINE_COMMAND@") || /npx\s|scripts\/boxbox["\s]/u.test(projected)) throw new Error("Canonical plugin launcher changed; update the installer projection before shipping.");
	return projected;
}

/** Both host adapters carry the same fresh private engine, with no registry BoxBox lookup at runtime. */
export function buildInstallerArtifact(): string {
	run("bun", ["run", "sync:plugin"]);
	run("bun", ["run", "pack:cli"]);
	const product     = JSON.parse(readFileSync(join(ROOT, "product.json"), "utf8")) as { displayName: string; npmName: string }                                      ;
	const manifest    = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { name: string; version: string }                                             ;
	const marketplace = JSON.parse(readFileSync(join(ROOT, ".agents/plugins/marketplace.json"), "utf8")) as { name: string }                                          ;
	const output      = join(ROOT, "dist/installer-package")                                                                                                          ;
	const payload     = join(output, "payload")                                                                                                                       ;
	const metadata    = { name: manifest.name, npmName: product.npmName, version: manifest.version, displayName: product.displayName, marketplace: marketplace.name } ;
	if (!product.npmName) throw new Error("product.json must declare the public installer npmName.");
	rmSync(output, { recursive: true, force: true });
	mkdirSync(join(output, "bin"), { recursive: true });
	mkdirSync(payload, { recursive: true });
	cpSync(join(ROOT, "product/installer/platform.mjs"), join(payload, "platform.mjs"));
	cpSync(join(ROOT, "product/installer/entry.mjs"), join(output, "bin/boxbox.mjs"));
	cpSync(join(ROOT, "product/installer/README.md"), join(output, "README.md"));
	chmodSync(join(output, "bin/boxbox.mjs"), 0o755);
	writeFileSync(join(payload, "bundle.json"), JSON.stringify(metadata, null, "\t") + "\n");
	writeFileSync(join(output, "package.json"), JSON.stringify({ name: product.npmName, version: manifest.version, license: "UNLICENSED", description: `${product.displayName} plugin installer for Codex and Claude Code`, type: "module", engines: { node: ">=22.22.3" }, bin: { [manifest.name]: "bin/boxbox.mjs" }, files: ["bin/boxbox.mjs", "payload/", "README.md"] }, null, "\t") + "\n");

	for (const host of ["codex", "claude"]) {
		const root            = join(payload, host)                                                                       ;
		const plugin          = join(root, "plugin")                                                                      ;
		const marketplacePath = host === "codex" ? ".agents/plugins/marketplace.json" : ".claude-plugin/marketplace.json" ;
		mkdirSync(join(root, "packages"), { recursive: true });
		mkdirSync(join(root, marketplacePath, ".."), { recursive: true });
		mkdirSync(join(plugin, "scripts"), { recursive: true });
		for (const path of [host === "codex" ? ".codex-plugin" : ".claude-plugin", "skills", "hooks", ...(host === "claude" ? ["agents"] : [])]) cpSync(join(ROOT, "plugin", path), join(plugin, path), { recursive: true });
		cpSync(join(ROOT, marketplacePath), join(root, marketplacePath));
		cpSync(join(ROOT, "dist", `${manifest.name}-${manifest.version}.tgz`), join(root, "packages", `${manifest.name}-${manifest.version}.tgz`));
		for (const name of ["install.mjs", "platform.mjs"]) cpSync(join(ROOT, "product/installer", name), join(root, name));
		cpSync(join(ROOT, "product/installer/launcher.mjs"), join(plugin, "scripts/boxbox.mjs"));
		writeFileSync(join(root, "bundle.json"), JSON.stringify({ ...metadata, host }, null, "\t") + "\n");
		const skillPath = join(plugin, "skills", manifest.name, "SKILL.md")                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     ;
		const skill     = projectDocument(readFileSync(skillPath, "utf8")).replace(/^Every check and fix goes through.*$/mu, "Every check and fix goes through this plugin's permanent local Node launcher, already configured by the installer. Run the commands below from the root of the target repository. No BOXBOX_CLI setup is needed. Never fetch a separate registry package for the engine. " + (host === "claude" ? "On Windows, the generated Node bridge works from Bash or PowerShell." : "On Windows, run these commands through PowerShell.")) ;
		writeFileSync(skillPath, skill);
		if (host === "claude") {
			const inspector = join(plugin, "agents/readability-inspector.md");
			writeFileSync(inspector, projectDocument(readFileSync(inspector, "utf8")) + "\nOn Windows, the generated Node bridge works from Bash or PowerShell.\n");
		}
		const hooksPath = join(plugin, "hooks/hooks.json")            ;
		const hooks     = JSON.parse(readFileSync(hooksPath, "utf8")) ;
		for (const [event, mode] of [["SessionStart", "session"], ["PostToolUse", "post"], ["Stop", "stop"]]) {
			for (const group of hooks.hooks[event!]) {
				for (const hook of group.hooks) {
					delete hook.commandWindows;
					delete hook.args;
					if (host === "claude") Object.assign(hook, { command: "node", args: ["${CLAUDE_PLUGIN_ROOT}/scripts/boxbox.mjs", "hook", mode] });
					else Object.assign(hook, { command: `node "\${PLUGIN_ROOT}/scripts/boxbox.mjs" hook ${mode}`, commandWindows: `node "$env:PLUGIN_ROOT/scripts/boxbox.mjs" hook ${mode}` });
				}
			}
		}
		writeFileSync(hooksPath, JSON.stringify(hooks, null, "\t") + "\n");
	}

	const destination = join(ROOT, "dist/installer");
	mkdirSync(destination, { recursive: true });
	const packed = run("npm", ["pack", output, "--pack-destination", destination, "--json"]);
	writeFileSync(join(destination, "pack-result.json"), packed);
	const archive = join(destination, (JSON.parse(packed) as [{ filename: string }])[0].filename);
	console.log(archive);
	return archive;
}

if (import.meta.main) buildInstallerArtifact();
