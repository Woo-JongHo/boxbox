import      { afterEach, expect, test                    } from "bun:test"                                 ;
import      { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"                                ;
import      { tmpdir                                      } from "node:os"                                ;
import      { dirname, join, resolve                      } from "node:path"                              ;

const roots: string[] = [];
const { codexRegistration } = await import(resolve(import.meta.dir, "../product/installer/codex-registration.mjs"));
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

const metadata = { host: "codex", name: "boxbox", marketplace: "boxbox-plugins" };

function fixture() {
	const base     = mkdtempSync(join(tmpdir(), "boxbox-codex-registration-")) ;
	const previous = join       (base, "0.2.3"                               ) ;
	const current  = join       (base, "0.2.7"                               ) ;
	roots.push(base);
	for (const root of [previous, current]) {
		mkdirSync(root);
		writeFileSync(join(root, "bundle.json"), JSON.stringify(metadata));
	}
	return { base, previous, current };
}

function harness(previous: string | undefined, installed = true, failNew = false) {
	const calls: string[][] = []        ;
	let source              = previous  ;
	let plugin              = installed ;
	const invoke = (args: string[]) => {
		calls.push(args);
		const command = args.join(" ");
		if (command === "plugin marketplace list --json") return { stdout: JSON.stringify({ marketplaces: source ? [{ name: metadata.marketplace, root: source, marketplaceSource: { source: "local" } }] : [] }) };
		if (command === "plugin list --json") return { stdout: JSON.stringify({ installed: plugin ? [{ pluginId: "boxbox@boxbox-plugins", installed: true }] : [] }) };
		if (command === `plugin remove boxbox@boxbox-plugins`              ) { plugin = false; return { stdout: "" }; }
		if (command === `plugin marketplace remove ${metadata.marketplace}`) { source = undefined; return { stdout: "" }; }
		if (args.slice(0, 3).join(" ") === "plugin marketplace add"        ) {
			if (failNew && args[3]?.endsWith("0.2.7")) throw new Error("new registration failed");
			source = args[3];
			return { stdout: "" };
		}
		if (command === "plugin add boxbox@boxbox-plugins"                 ) { plugin = true; return { stdout: "" }; }
		throw new Error(`unexpected call: ${command}`);
	};
	return { calls, invoke, state: () => ({ source, plugin }) };
}

test("owned versioned Codex registration transitions to the new installer root", () => {
	const value        = fixture          ()                                     ;
	const host         = harness          (value.previous                      ) ;
	const registration = codexRegistration(value.current, metadata, host.invoke) ;
	registration.preflight();
	registration.transition();
	expect(host.state()).toEqual({ source: value.current, plugin: true });
	expect(host.calls).toContainEqual(["plugin", "marketplace", "remove", "boxbox-plugins"]);
});

test("failed Codex transition restores the owned previous registration", () => {
	const value        = fixture          ()                                     ;
	const host         = harness          (value.previous, true, true          ) ;
	const registration = codexRegistration(value.current, metadata, host.invoke) ;
	registration.preflight();
	expect(() => registration.transition()).toThrow("new registration failed");
	expect(host.state()).toEqual({ source: value.previous, plugin: true });
});

test("foreign Codex marketplace sources are refused before mutation", () => {
	const value   = fixture()                               ;
	const foreign = join   (dirname(value.base), "foreign") ;
	mkdirSync(foreign);
	roots.push(foreign);
	writeFileSync(join(foreign, "bundle.json"), JSON.stringify(metadata));
	const host         = harness          (foreign                             ) ;
	const registration = codexRegistration(value.current, metadata, host.invoke) ;
	expect(() => registration.preflight()).toThrow("not owned");
	expect(host.calls).toHaveLength(1);
});
