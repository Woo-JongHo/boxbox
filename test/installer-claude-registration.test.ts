import { expect, test } from "bun:test"  ;
import { resolve      } from "node:path" ;

const { claudeRegistration } = await import(resolve(import.meta.dir, "../product/installer/claude-registration.mjs"));

const METADATA = { name: "boxbox", marketplace: "boxbox-plugins", version: "1.0.0" } ;

function registration(marketplaces: readonly object[], plugins: readonly object[] = []) {
	return claudeRegistration(import.meta.dir, METADATA, (args: readonly string[]) => {
		if (args.includes("--help")                            ) return { stdout: "--scope" };
		if (args.join(" ") === "plugin marketplace list --json") return { stdout: JSON.stringify(marketplaces) };
		if (args.join(" ") === "plugin list --json"            ) return { stdout: JSON.stringify(plugins) };
		return { stdout: "[]" };
	});
}

test("a same-named marketplace from another source is refused with the exact commands to remove it", () => {
	const github = registration([{ name: "boxbox-plugins", source: "github", repo: "Woo-JongHo/boxbox" }]);

	expect(() => github.preflight()).toThrow("was added from this project's repository (github)"                    ) ;
	expect(() => github.preflight()).toThrow("claude plugin uninstall boxbox@boxbox-plugins --scope user"           ) ;
	expect(() => github.preflight()).toThrow("claude plugin marketplace remove boxbox-plugins"                      ) ;
});

test("a git URL registration of this repository gets the same removal commands", () => {
	const git = registration([{ name: "boxbox-plugins", source: "git", url: "https://github.com/Woo-JongHo/boxbox.git" }]);

	expect(() => git.preflight()).toThrow("claude plugin marketplace remove boxbox-plugins");
});

test("removal is never suggested for a foreign repository or a marketplace with other plugins", () => {
	const foreign   = registration([{ name: "boxbox-plugins", source: "github", repo: "someone/else" }]                                       ) ;
	const lookalike = registration([{ name: "boxbox-plugins", source: "git", url: "https://github.com/Woo-JongHo/boxbox-fork.git" }]          ) ;
	const shared    = registration([{ name: "boxbox-plugins", source: "github", repo: "Woo-JongHo/boxbox" }], [{ id: "other@boxbox-plugins" }]) ;

	for (const candidate of [foreign, lookalike, shared]) {
		expect(() => candidate.preflight()).toThrow("Inspect it with");
		expect(() => candidate.preflight()).not.toThrow("marketplace remove");
	}
});

test("a clean host passes preflight", () => {
	expect(() => registration([]).preflight()).not.toThrow();
});
