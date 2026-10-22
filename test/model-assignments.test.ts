import { readFileSync                                                                                     } from "node:fs"                               ;
import { resolve                                                                                          } from "node:path"                             ;
import { describe, expect, test                                                                           } from "bun:test"                              ;
import { modelConfigProblems, readModelConfig, stampClaudeAgent, stampCodexAgent, type Assignment, type ModelConfig } from "../development/tools/model-assignments.ts" ;
import { pluginDrift                                                                                      } from "../development/tools/sync-plugin.ts"   ;

const ROOT = resolve(import.meta.dir, "..")                                      ;
const read = (path: string): string => readFileSync(resolve(ROOT, path), "utf8") ;

const GOOD: ModelConfig = {
	schemaVersion : 1,
	capabilities  : { sonnet: ["low", "medium"], "no-effort-model": [], "codex-model": ["low", "high"] },
	roles         : {
		inspector: {
			claude : { model: "sonnet"     , effort: "medium", selectedBy: "unevaluated-default" },
			codex  : { model: "codex-model", effort: "high"  , selectedBy: "unevaluated-default" },
		},
	},
};
const withInspector = (host: "claude" | "codex", patch: Partial<Assignment>, remove: readonly (keyof Assignment)[] = []): unknown => {
	const assignment: Record<string, unknown> = { ...GOOD.roles.inspector[host], ...patch };
	for (const key of remove) delete assignment[key];
	return { ...GOOD, roles: { inspector: { ...GOOD.roles.inspector, [host]: assignment } } };
};

describe("model and effort assignment source", () => {
	test("the shipped product/models.json is valid and never assigns the author role", () => {
		const config = readModelConfig(ROOT);
		expect(modelConfigProblems(config)    ).toEqual([]);
		expect(Object.keys(config.roles)      ).not.toContain("author");
	});

	test("rejects a role the plugin does not own, including the author's session", () => {
		const config = { ...GOOD, roles: { ...GOOD.roles, author: GOOD.roles.inspector } };
		expect(modelConfigProblems(config).join("\n")).toContain("roles.author: not an assignable role");
	});

	test("rejects effort the model cannot take, and a missing effort the model needs", () => {
		expect(modelConfigProblems(withInspector("claude", { effort: "max"      })).join("\n")                     ).toContain("effort max is not supported by sonnet"         ) ;
		expect(modelConfigProblems(withInspector("claude", {}, ["effort"]       )).join("\n")                      ).toContain("supports effort (low, medium); set one"        ) ;
		expect(modelConfigProblems(withInspector("claude", { model: "no-effort-model", effort: "low" })).join("\n")).toContain("effort low is not supported by no-effort-model") ;
		expect(modelConfigProblems(withInspector("claude", { model: "no-effort-model" }, ["effort"]))              ).toEqual  ([]                                              ) ;
	});

	test("rejects an unknown model and an assignment with no provenance", () => {
		expect(modelConfigProblems(withInspector("codex", { model: "mystery" })).join("\n")).toContain("model mystery has no capabilities entry");
		expect(modelConfigProblems(withInspector("codex", {}, ["selectedBy"]  )).join("\n")).toContain("selectedBy must be");
	});

	test("rejects an unknown host and a document that is not schema 1", () => {
		const config = { ...GOOD, roles: { inspector: { ...GOOD.roles.inspector, gemini: GOOD.roles.inspector.claude } } };
		expect(modelConfigProblems(config).join("\n")).toContain("roles.inspector.gemini: unknown host");
		expect(modelConfigProblems({ schemaVersion: 2 })).toEqual(["schemaVersion must be 1"]);
	});
});

describe("stamping the host agent definitions", () => {
	const claude = "---\nname: x\ndisallowedTools: Write\neffort: low\nmodel: stale\n---\n\nBody keeps `model: text` lines.\n" ;
	const codex  = "name = \"x\"\nmodel = \"stale\"\nmodel_reasoning_effort = \"low\"\nsandbox_mode = \"read-only\"\n"         ;

	test("Claude frontmatter takes the assignment, keeps other keys and the body, and is idempotent", () => {
		const once = stampClaudeAgent(claude, { model: "sonnet", effort: "medium", selectedBy: "s" });
		expect(once                                                                                                   ).toBe("---\nname: x\ndisallowedTools: Write\nmodel: sonnet\neffort: medium\n---\n\nBody keeps `model: text` lines.\n");
		expect(stampClaudeAgent(once, { model: "sonnet", effort: "medium", selectedBy: "s" })                         ).toBe(once);
	});

	test("an assignment without effort removes the effort line instead of leaving a stale one", () => {
		expect(stampClaudeAgent(claude, { model: "haiku", selectedBy: "s" })).not.toContain("effort:");
		expect(stampCodexAgent (codex , { model: "m"    , selectedBy: "s" })).not.toContain("model_reasoning_effort");
	});

	test("Codex model and effort are replaced in place and the rest of the file is untouched", () => {
		expect(stampCodexAgent(codex, { model: "gpt-x", effort: "high", selectedBy: "s" })).toBe("name = \"x\"\nmodel = \"gpt-x\"\nmodel_reasoning_effort = \"high\"\nsandbox_mode = \"read-only\"\n");
	});

	test("an agent definition that cannot carry the assignment is refused", () => {
		expect(() => stampClaudeAgent("no frontmatter", { model: "m", selectedBy: "s" })).toThrow("no frontmatter");
		expect(() => stampCodexAgent ("name = \"x\"\n" , { model: "m", selectedBy: "s" })).toThrow("no model line");
	});
});

describe("generated outputs follow the source", () => {
	const inspector = readModelConfig(ROOT).roles.inspector;

	test("plugin and development agents carry exactly the source assignment", () => {
		for (const path of ["plugin/agents/readability-inspector.md", "development/agents/readability-inspector.md"]) {
			expect(read(path)).toContain(`\nmodel: ${inspector.claude.model}\neffort: ${inspector.claude.effort}\n`);
		}
		const toml = read("development/codex/readability-inspector.toml");
		expect(toml).toContain(`\nmodel = "${inspector.codex.model}"\n`);
		expect(toml).toContain(`\nmodel_reasoning_effort = "${inspector.codex.effort}"\n`);
	});

	test("the product template holds no model or effort of its own", () => {
		expect(read("product/plugin/agents/readability-inspector.md")).not.toMatch(/^(model|effort):/mu);
	});

	test("the Codex plugin ships no agents, so Codex values never leave the development definition", () => {
		expect(Object.keys(JSON.parse(read("plugin/.codex-plugin/plugin.json")) as object)).not.toContain("agents");
	});

	test("nothing generated has drifted from the source", () => {
		expect(pluginDrift(ROOT)).toEqual([]);
	});
});
