import      { afterAll, expect, test } from "bun:test"           ;
import      { spawnSync              } from "node:child_process" ;
import      {
              cpSync               ,
              existsSync           ,
              mkdirSync            ,
              mkdtempSync          ,
              readFileSync         ,
              readdirSync          ,
              rmSync               ,
              symlinkSync          ,
              writeFileSync        ,
                                     } from "node:fs"            ;
import      { tmpdir                 } from "node:os"            ;
import      { dirname, join, resolve } from "node:path"          ;

const SOURCE          = resolve(import.meta.dir, "../product/installer")                                    ;
const roots: string[] = []                                                                                  ;
const metadata        = { name: "boxbox", version: "0.2.4", host: "claude", marketplace: "boxbox-plugins" } ;
const registration    = await import(join(SOURCE, "claude-registration.mjs"))                               ;

function temporary(): string {
	const root = mkdtempSync(join(tmpdir(), "boxbox registration simulation "));
	roots.push(root);
	return root;
}

afterAll(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }); });

function payload(root: string, version: string): void {
	mkdirSync(join(root, "plugin/.claude-plugin"), { recursive: true });
	mkdirSync(join(root, ".claude-plugin"), { recursive: true });
	writeFileSync(join(root, ".claude-plugin/marketplace.json"), JSON.stringify({ name: "boxbox-plugins", plugins: [{ name: "boxbox", source: "./plugin" }] }));
	writeFileSync(join(root, "bundle.json"), JSON.stringify({ ...metadata, version }));
	writeFileSync(join(root, "plugin/.claude-plugin/plugin.json"), JSON.stringify({ name: "boxbox", version }));
	writeFileSync(join(root, "cli.js"), "engine fixture");
	writeFileSync(join(root, "plugin/runtime.json"), JSON.stringify({ cli: join(root, "cli.js"), node: process.execPath }));
}

test("simulated Claude no-op install requires one scoped update and matching cached identity", () => {
	const directory = temporary()                   ;
	const old       = join     (directory, "0.2.3") ;
	const current   = join     (directory, "0.2.4") ;
	payload(old, "0.2.3");
	payload(current, "0.2.4");
	let market                = old                                                                                                               ;
	let installed             = { id: "boxbox@boxbox-plugins", scope: "user", enabled: true, version: "0.2.3", installPath: join(old, "plugin") } ;
	const updates: string[][] = []                                                                                                                ;
	const invoke = (args: string[]) => {
		if (args.includes("--help"))   return { stdout: "--scope <scope>" };
		if (args[1] === "marketplace") return { stdout: JSON.stringify([{ name: "boxbox-plugins", source: "directory", path: market, installLocation: market }]) };
		if (args[1] === "list")        return { stdout: JSON.stringify([installed]) };
		updates.push(args);
		installed = { ...installed, version: "0.2.4", installPath: join(current, "plugin") };
		return { stdout: "" };
	};
	const host = registration.claudeRegistration(current, metadata, invoke);
	host.preflight();
	market = current;
	host.marketplace();
	host.verify();
	host.verify();
	expect(updates).toEqual([["plugin", "update", "boxbox@boxbox-plugins", "--scope", "user"]]);
	writeFileSync(join(current, "plugin/runtime.json"), JSON.stringify({ cli: join(old, "cli.js"), node: process.execPath }));
	const cache = join(directory, "cache");
	cpSync(join(current, "plugin"), cache, { recursive: true });
	installed = { ...installed, installPath: cache };
	writeFileSync(join(current, "plugin/runtime.json"), JSON.stringify({ cli: join(current, "cli.js"), node: process.execPath }));
	expect(() => host.verify()).toThrow("runtime");
});

test("simulated Claude refuses foreign marketplaces, duplicate scopes and stale successful updates", () => {
	const directory = temporary()                           ;
	const current   = join     (directory, "owned/0.2.4"  ) ;
	const foreign   = join     (directory, "foreign/0.2.3") ;
	payload(current, "0.2.4");
	payload(foreign, "0.2.3");
	let market  = foreign                                                                                                                 ;
	let entries = [{ id: "boxbox@boxbox-plugins", scope: "user", enabled: true, version: "0.2.3", installPath: join(foreign, "plugin") }] ;
	let updates = 0                                                                                                                       ;
	const host = registration.claudeRegistration(current, metadata, (args: string[]) => {
		if (args.includes("--help"))   return { stdout: "--scope <scope>" };
		if (args[1] === "marketplace") return { stdout: JSON.stringify([{ name: "boxbox-plugins", source: "directory", path: market, installLocation: market }]) };
		if (args[1] === "list")        return { stdout: JSON.stringify(entries) };
		updates += 1;
		return { stdout: "" };
	});
	expect(() => host.preflight()).toThrow("foreign");
	market = current;
	entries.push({ ...entries[0]!, scope: "project" });
	expect(() => host.preflight()).toThrow("ambiguous");
	entries = entries.slice(0, 1);
	expect(() => host.verify()).toThrow("wrong plugin version");
	expect(updates).toBe(1);
});

test("simulated Claude rejects split marketplace locations and uninstalled shared catalog entries before mutation", () => {
	const directory = temporary()                   ;
	const current   = join     (directory, "0.2.4") ;
	const old       = join     (directory, "0.2.3") ;
	payload(current, "0.2.4");
	payload(old, "0.2.3");
	let installLocation     = old ;
	const calls: string[][] = []  ;
	const host = registration.claudeRegistration(current, metadata, (args: string[]) => {
		calls.push(args);
		if (args.includes("--help")) return { stdout: "--scope <scope>" };
		if (args[1] === "marketplace") return { stdout: JSON.stringify([{ name: "boxbox-plugins", source: "directory", path: current, installLocation }]) };
		return { stdout: "[]" };
	});
	expect(() => host.preflight()).toThrow("installLocation");
	installLocation = current;
	writeFileSync(join(current, ".claude-plugin/marketplace.json"), JSON.stringify({ name: "boxbox-plugins", plugins: [{ name: "boxbox", source: "./plugin" }, { name: "uninstalled-other", source: "./other" }] }));
	expect(() => host.preflight()).toThrow("shared");
	expect(calls.every(args => args.includes("--help") || args.includes("list"))).toBe(true);
});

function simulatedChild(code: string) {
	const directory   = temporary()                                     ;
	const packageRoot = join     (directory, "package"                ) ;
	const bundled     = join     (packageRoot, "payload/codex"        ) ;
	const destination = join     (directory, "data/boxbox/codex/0.2.4") ;
	mkdirSync(join(packageRoot, "bin"), { recursive: true });
	mkdirSync(bundled, { recursive: true });
	mkdirSync(destination, { recursive: true });
	cpSync(join(SOURCE, "entry.mjs"), join(packageRoot, "bin/boxbox.mjs"));
	for (const name of ["platform.mjs", "install-state.mjs", "claude-registration.mjs"]) cpSync(join(SOURCE, name), join(packageRoot, "payload", name));
	cpSync(join(SOURCE, "install-state.mjs"), join(bundled, "install-state.mjs"));
	const bundle = { ...metadata, host: "codex" };
	writeFileSync(join(packageRoot, "payload/bundle.json"), JSON.stringify(bundle));
	writeFileSync(join(bundled, "bundle.json"), JSON.stringify(bundle));
	writeFileSync(join(destination, "preserved.txt"), "previous bytes");
	writeFileSync(join(bundled, "install.mjs"), `import { installationState } from './install-state.mjs'; import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'; import { fileURLToPath } from 'node:url'; const root=fileURLToPath(new URL('./',import.meta.url)); const metadata=JSON.parse(readFileSync(root+'bundle.json','utf8')); const state=installationState(root,metadata); writeFileSync(root+'preserved.txt','new bytes'); ${code}`);
	const run = () => spawnSync("node", [join(packageRoot, "bin/boxbox.mjs"), "--engine-only"], { encoding: "utf8", env: { ...process.env, XDG_DATA_HOME: join(directory, "data"), LOCALAPPDATA: join(directory, "data") } });
	return { run, destination };
}

test("real parent/child simulation restores only proven pre-registration failures", () => {
	const child = simulatedChild("process.exit(19);");
	expect(child.run().status                                            ).toBe   (19              ) ;
	expect(readFileSync(join(child.destination, "preserved.txt"), "utf8")).toBe   ("previous bytes") ;
	expect(readdirSync(dirname(child.destination))                       ).toEqual(["0.2.4"]       ) ;
});

test("real parent/child simulation retains mutation, missing, corrupt and unverified-zero outcomes", () => {
	for (const code of ["state.advance('host-registration-started'); process.exit(31);", "unlinkSync(state.path); process.exit(19);", "writeFileSync(state.path,'broken'); process.exit(19);", "process.exit(0);", "process.kill(process.pid, 'SIGTERM');"]) {
		const child  = simulatedChild(code) ;
		const result = child.run     ()     ;
		expect(result.status                                                 ).not.toBe     (0                      ) ;
		expect(result.stderr                                                 )    .toContain("Retained installation") ;
		expect(readFileSync(join(child.destination, "preserved.txt"), "utf8"))    .toBe     ("new bytes"            ) ;
		const backups = readdirSync(dirname(child.destination)).filter(name => name.startsWith(".boxbox-repair-"));
		expect(backups).toHaveLength(1);
		expect(readFileSync(join(dirname(child.destination), backups[0]!, "previous/preserved.txt"), "utf8")).toBe("previous bytes");
	}
});

test("real parent/child simulation retries owned partial receipts but refuses foreign and symlink receipts", () => {
	const child = simulatedChild("state.advance('host-registration-started'); process.exit(31);");
	expect(child.run().status                                                                        ).toBe        (31) ;
	expect(child.run().status                                                                        ).toBe        (31) ;
	expect(readdirSync(dirname(child.destination)).filter(name => name.startsWith(".boxbox-repair-"))).toHaveLength(2 ) ;
	for (const symlink of [false, true]) {
		const fresh   = simulatedChild("state.advance('verified');"                   ) ;
		const receipt = join          (fresh.destination, ".boxbox-install-state.json") ;
		const foreign = join          (fresh.destination, "foreign.json"              ) ;
		writeFileSync(foreign, "foreign bytes");
		if (symlink) symlinkSync(foreign, receipt);
		else writeFileSync(receipt, JSON.stringify({ schema: 1, root: "foreign", phase: "prepared" }));
		expect(fresh.run().status                                            ).toBe(1               ) ;
		expect(readFileSync(join(fresh.destination, "preserved.txt"), "utf8")).toBe("previous bytes") ;
		expect(readFileSync(foreign, "utf8")                                 ).toBe("foreign bytes" ) ;
	}
	const verified = simulatedChild("state.advance('verified');");
	expect(verified.run().status).toBe(0);
	expect(existsSync(join(verified.destination, ".boxbox-install-state.json"))).toBe(false);
});
