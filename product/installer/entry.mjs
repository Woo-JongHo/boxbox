#!/usr/bin/env node
import      { spawnSync                                    } from "node:child_process"                 ;
import      {
              cpSync                                     ,
              existsSync                                 ,
              mkdirSync                                  ,
              mkdtempSync                                ,
              readFileSync                               ,
              rmSync                                     ,
              statSync                                   ,
                                                           } from "node:fs"                            ;
import      { dirname, join                                } from "node:path"                          ;
import      { fileURLToPath                                } from "node:url"                           ;
import      { findCommand, installationRoot, supportedNode } from "../payload/platform.mjs"            ;

import      { installationState                            } from "../payload/install-state.mjs"       ;

import      { assertClaudeCatalog                          } from "../payload/claude-registration.mjs" ;

/** Restore only failures proven to precede host mutation; retain uncertain state for recovery. */
function installHost(payload, destination, engineOnly) {
	mkdirSync(dirname(destination), { recursive: true });
	const metadata      = JSON.parse(readFileSync(join(payload, "bundle.json"), "utf8"))                 ;
	const previousState = existsSync(destination) ? installationState(destination, metadata) : undefined ;
	const retained      = previousState?.read()                                                          ;
	if (metadata.host === "claude" && existsSync(destination)) assertClaudeCatalog(destination, metadata, true);
	const backup        = existsSync(destination) ? mkdtempSync(join(dirname(destination), ".boxbox-repair-")) : undefined ;
	if (backup) {
		try {
			cpSync(destination, join(backup, "previous"), { recursive: true });
		} catch (error) {
			try {
				rmSync(backup, { recursive: true, force: true });
			} catch (cleanupError) {
				throw new Error(`Backup preparation failed; partial backup retained at ${backup}: ${error.message}. Cleanup failed: ${cleanupError.message}`);
			}
			throw error;
		}
	}
	let succeeded = false ;
	let launched  = false ;
	let state;
	let exitStatus;
	let signaled = false;
	try {
		mkdirSync(destination, { recursive: true });
		if (retained) previousState.remove();
		cpSync(payload, destination, { recursive: true });
		state = installationState(destination, metadata);
		state.create();
		launched = true;
		const child = spawnSync(process.execPath, [join(destination, "install.mjs"), ...(engineOnly ? ["--engine-only"] : [])], { stdio: "inherit" });
		exitStatus = child.status;
		signaled = Boolean(child.signal);
		if (child.error) throw child.error;
		if (child.signal) throw new Error(`Installer terminated by ${child.signal}`);
		succeeded = child.status === 0 && state.read()?.phase === "verified";
		if (child.status === 0 && !succeeded) throw new Error("Installer exited without verified completion.");
		return child.status ?? 1;
	} finally {
		let prepared = !launched;
		if (launched && !succeeded) {
			try { prepared = !signaled && exitStatus !== 0 && state.read()?.phase === "prepared"; } catch { prepared = false; }
		}
		if (!succeeded && !prepared) {
			console.error(`[BoxBox] Installation may have changed host registration. Retained installation: ${destination}. Receipt: ${state?.path}.${backup ? ` Previous backup retained at ${backup}.` : ""} Inspect host plugin/marketplace lists, then rerun this exact installer or remove the exact registration before manual recovery.`);
		} else {
			if (!succeeded) {
				try {
					rmSync(destination, { recursive: true, force: true });
					if (backup) cpSync(join(backup, "previous"), destination, { recursive: true });
				} catch (error) {
					throw new Error(backup ? `Repair could not restore the previous installation. Backup retained at ${backup}: ${error.message}` : `Failed installation cleanup was incomplete at ${destination}: ${error.message}`);
				}
			}
			if (succeeded) state.remove();
			if (backup) {
				try {
					rmSync(backup, { recursive: true, force: true });
				} catch (error) {
					console.error(`[BoxBox] Previous backup could not be removed; retained at ${backup}: ${error.message}`);
				}
			}
		}
	}
}

const arguments_ = process.argv.slice(2)                                                 ;
const usage      = "Usage: boxbox [--codex] [--claude] [--hud] | --engine-only | --help" ;
if (arguments_.length === 1 && arguments_[0] === "--help") {
	console.log(`${usage}\n\nInstall BoxBox plugins for detected Codex and Claude Code CLIs.\nUse --codex or --claude to select hosts explicitly; both flags select both.\n--engine-only prepares the Codex local engine without host checks or registration.\n--hud opts into a Claude status line and a separate boxbox-codex tmux launcher on macOS/Linux.\nRestart each host afterward and review its hooks manually.`);
	process.exit(0);
}
const engineOnly = arguments_.length === 1 && arguments_[0] === "--engine-only";
if (!engineOnly && arguments_.some(value => !["--codex", "--claude", "--hud"].includes(value))) {
	console.error(`[BoxBox] ${usage}`);
	process.exit(1);
}

try {
	if (!supportedNode(process.versions.node)) throw new Error(`Node.js >=22.22.3 is required; found ${process.versions.node}. Install a supported Node.js release and rerun the installer.`);
	const hud = arguments_.includes("--hud");
	if (hud && process.platform === "win32") throw new Error("The terminal HUD requires macOS/Linux. Install the Windows plugins without --hud.");
	const requested = [...new Set(arguments_.filter(value => value !== "--hud").map(value => value.slice(2)))]                      ;
	const hosts     = engineOnly ? ["codex"] : requested.length ? requested : ["codex", "claude"].filter(host => findCommand(host)) ;
	if (hosts.length === 0) throw new Error("Neither Codex nor Claude Code was found on PATH. Install at least one CLI with plugin support, open a new terminal, then rerun the BoxBox installer.");
	if (!engineOnly) {
		for (const host of hosts) {
			if (!findCommand(host)) throw new Error(`${host === "codex" ? "Codex" : "Claude Code"} was not found on PATH. Install that CLI or select another installed host with --codex or --claude.`);
		}
	}
	if (!engineOnly && hosts.includes("codex") && process.env.CODEX_HOME && (!existsSync(process.env.CODEX_HOME) || !statSync(process.env.CODEX_HOME).isDirectory())) throw new Error("CODEX_HOME must point to an existing directory. Create that directory or unset CODEX_HOME before rerunning the installer.");
	const payload  = fileURLToPath(new URL("../payload/", import.meta.url)           ) ;
	const metadata = JSON.parse   (readFileSync(join(payload, "bundle.json"), "utf8")) ;
	for (const host of hosts) {
		const destination = installationRoot(metadata.version, host                      ) ;
		const status      = installHost     (join(payload, host), destination, engineOnly) ;
		if (status !== 0) process.exit(status);
		if (hud) {
			const setup = spawnSync(process.execPath, [join(destination, "plugin/scripts/hud/setup.mjs"), host, join(destination, "plugin")], { stdio: "inherit" });
			if (setup.error) throw setup.error;
			if (setup.status !== 0) throw new Error("Plugin installed, but HUD setup failed. Resolve the error above and rerun --hud.");
		}
	}
} catch (error) {
	console.error(`[BoxBox] ${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
}
