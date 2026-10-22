import { describe, expect, test } from "bun:test";
import { categoriesOf, categoryOf, formatUsage, sessionUsage } from "../development/tools/session-usage.ts";

const SECRET = "SECRET-PROMPT-TEXT";

const usage      = (input: number, cacheRead: number, cacheWrite: number, output: number) => ({ input_tokens: input, cache_read_input_tokens: cacheRead, cache_creation_input_tokens: cacheWrite, output_tokens: output })                                                                ;
const assistant  = (id: string, content: unknown[], numbers: ReturnType<typeof usage>, model = "claude-sonnet-5-5", effort = "low") => JSON.stringify({ type: "assistant", sessionId: "s1", effort, uuid: `u-${id}-${content.length}`, message: { id, model, content, usage: numbers } }) ;
const toolUse    = (id: string, name: string, input: unknown) => ({ type: "tool_use", id, name, input })                                                                                                                                                                                  ;
const toolResult = (id: string, content: unknown) => JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content }] } })                                                                                                                          ;
const bridge     = (...subs: string[]) => `cd "C:/p"; B='const [n,l]=JSON.parse(Buffer.from("QUJD","base64").toString("utf8"));'; ${subs.map(sub => `node -e "$B" -- ${sub} --file a.ts --json`).join("; ")}`                                                                             ;
const launcher   = (sub: string) => `'/usr/bin/node' '/home/x/plugin/scripts/boxbox.mjs' ${sub} --file a.ts --json`                                                                                                                                                                       ;

describe("categoryOf", () => {
	test("names the BoxBox step a tool call belongs to", () => {
		expect(categoryOf("Bash" , { command: launcher("guide") }                                             )).toBe("boxbox:guide"    ) ;
		expect(categoryOf("Bash" , { command: launcher("check") }                                             )).toBe("boxbox:check"    ) ;
		expect(categoryOf("Bash" , { command: "bun product/packages/cli/entry.ts format --file a.ts" }        )).toBe("boxbox:format"   ) ;
		expect(categoryOf("Bash" , { command: "bun product/engine/typescript/06_align-tables.ts --file a.ts" })).toBe("boxbox:aligner"  ) ;
		expect(categoryOf("Skill", { skill: "boxbox:boxbox" }                                                 )).toBe("boxbox:skill"    ) ;
		expect(categoryOf("Agent", { subagent_type: "boxbox:readability-inspector" }                          )).toBe("boxbox:inspector") ;
	});

	test("everything else, including a different subcommand word or a malformed input, is other", () => {
		expect(categoryOf("Bash" , { command: "ls -la" }              )).toBe("other") ;
		expect(categoryOf("Bash" , { command: "echo boxbox is great" })).toBe("other") ;
		expect(categoryOf("Read" , { file_path: "/x/boxbox.mjs" }     )).toBe("other") ;
		expect(categoryOf("Bash" , "not an object"                    )).toBe("other") ;
		expect(categoryOf("Skill", { skill: "other-skill" }           )).toBe("other") ;
	});
});

describe("categoriesOf", () => {
	test("recognizes the Windows bridge and every engine command a single shell call runs", () => {
		expect(categoriesOf("Bash", { command: bridge("check")                               })).toEqual(["boxbox:check"]                                ) ;
		expect(categoriesOf("Bash", { command: bridge("check", "guide", "check")             })).toEqual(["boxbox:check", "boxbox:guide", "boxbox:check"]) ;
		expect(categoriesOf("Bash", { command: `${launcher("align")} && ${launcher("check")}`})).toEqual(["boxbox:align", "boxbox:check"]                ) ;
	});

	test("recognizes the bridge script written inline instead of through a variable", () => {
		const inline = "cd \"C:/p\" && node -e \"const r=require('node:child_process').spawnSync(n,[l,...process.argv.slice(1)],{stdio:'inherit'})\" -- check --file a.ts --json; node -e \"const r=require('node:child_process').spawnSync(n,[l])\" -- guide --file a.ts";
		expect(categoriesOf("Bash", { command: inline })).toEqual(["boxbox:check", "boxbox:guide"]);
	});

	test("a node -e script that is not the bridge, and a different option position, stay other", () => {
		expect(categoriesOf("Bash", { command: `node -e "console.log(1)" -- check` })).toEqual(["other"]);
		expect(categoriesOf("Bash", { command: "echo check guide"                  })).toEqual(["other"]);
	});
});

describe("sessionUsage", () => {
	test("counts usage once per message id even though one response spans several lines", () => {
		const numbers = usage(2, 1000, 50, 200);
		const result  = sessionUsage([
			assistant("m1", [{ type: "thinking" }]                              , numbers),
			assistant("m1", [{ type: "text", text: "hi" }]                      , numbers),
			assistant("m1", [toolUse("t1", "Bash", { command: launcher("check") })], numbers),
		]);
		expect(result.total                             ).toEqual({ turns: 1, input: 2, cacheRead: 1000, cacheWrite: 50, output: 200 }) ;
		expect(result.byCategory["boxbox:check"]?.calls ).toBe   (1                                                                   ) ;
		expect(result.byCategory["boxbox:check"]?.output).toBe   (200                                                                 ) ;
		expect(result.session                           ).toBe   ("s1"                                                                ) ;
	});

	test("a turn counts under its BoxBox call, other calls in the same turn still count as calls", () => {
		const result = sessionUsage([assistant("m1", [toolUse("a", "Bash", { command: "ls" }), toolUse("b", "Bash", { command: launcher("guide") })], usage(1, 10, 0, 5))]);
		expect(Object.keys(result.byCategory).sort()).toEqual      (["boxbox:guide", "other"]        ) ;
		expect(result.byCategory["boxbox:guide"]    ).toMatchObject({ turns: 1, calls: 1, output: 5 }) ;
		expect(result.byCategory["other"]           ).toMatchObject({ turns: 0, calls: 1, output: 0 }) ;
	});

	test("separates models and efforts and ignores synthetic messages", () => {
		const result = sessionUsage([
			assistant("m1", [], usage(1, 0, 0, 10), "claude-opus-5-5"  , "high"),
			assistant("m2", [], usage(1, 0, 0, 20), "claude-sonnet-5-5", "low" ),
			assistant("m3", [], usage(9, 9, 9, 9) , "<synthetic>"      , "low" ),
		]);
		expect(Object.keys(result.byModel).sort()).toEqual(["claude-opus-5-5:high", "claude-sonnet-5-5:low"]);
		expect(result.total.output                ).toBe(30);
	});

	test("estimates the tokens a call's result put in front of the model", () => {
		const result = sessionUsage([
			assistant("m1", [toolUse("t1", "Bash", { command: launcher("guide") })], usage(1, 0, 0, 1)),
			toolResult("t1", "x".repeat(40)),
			toolResult("t1", [{ type: "text", text: "y".repeat(8) }]),
			toolResult("unknown", "z".repeat(400)),
		]);
		expect(result.byCategory["boxbox:guide"]?.resultTokens).toBe(12);
	});

	test("counts only BoxBox hook text, by event", () => {
		const hook   = (hookEvent: string, stdout: string) => JSON.stringify({ type: "attachment", attachment: { type: "hook_success", hookEvent, stdout } }) ;
		const result = sessionUsage([hook("Stop", "[boxbox] Stop: PASS"), hook("Stop", "[boxbox] Stop: PASS"), hook("PostToolUse", "another tool's output")]) ;
		expect(result.hooks).toEqual({ Stop: { count: 2, tokens: 10 } });
	});

	test("skips lines that are not JSON and accepts an empty record", () => {
		expect(sessionUsage(["", "not json", "[1,2]", "null"]).total).toEqual({ turns: 0, input: 0, cacheRead: 0, cacheWrite: 0, output: 0 });
		expect(sessionUsage([]).session                              ).toBeUndefined();
	});

	test("never copies message text, commands or results into its output", () => {
		const result = sessionUsage([
			JSON.stringify({ type: "user", message: { content: SECRET } }),
			assistant("m1", [{ type: "text", text: SECRET }, toolUse("t1", "Bash", { command: `${launcher("check")} # ${SECRET}` })], usage(1, 1, 1, 1)),
			toolResult("t1", SECRET),
			JSON.stringify({ type: "attachment", attachment: { type: "hook_success", hookEvent: "Stop", stdout: `[boxbox] ${SECRET}` } }),
		]);
		expect(JSON.stringify(result)).not.toContain(SECRET);
		expect(formatUsage(result)   ).not.toContain(SECRET);
	});

	test("reports a subagent's own turns under subagent/ and as a share of the total", () => {
		const parent = assistant     ("p1", [toolUse("a1", "Agent", { subagent_type: "boxbox:readability-inspector" })], usage(1, 100, 10, 20)                                                                                                                                                    ) ;
		const child  = JSON.stringify({ type: "assistant", isSidechain: true, agentId: "x", sessionId: "s1", effort: "low", uuid: "c1", message: { id: "c1", model: "claude-sonnet-5-5", content: [toolUse("b1", "Bash", { command: bridge("check", "guide") })], usage: usage(2, 300, 30, 40) } }) ;
		const result = sessionUsage  ([parent, child]                                                                                                                                                                                                                                             ) ;
		expect(result.total.output                          ).toBe         (60                                                                ) ;
		expect(result.subagent                              ).toEqual      ({ turns: 1, input: 2, cacheRead: 300, cacheWrite: 30, output: 40 }) ;
		expect(result.byCategory["boxbox:inspector"]?.output).toBe         (20                                                                ) ;
		expect(result.byCategory["subagent/boxbox:check"]   ).toMatchObject({ turns: 1, calls: 1, output: 40 }                                ) ;
		expect(result.byCategory["subagent/boxbox:guide"]   ).toMatchObject({ turns: 0, calls: 1 }                                            ) ;
	});

	test("a call that runs several engine commands is one turn but one call per command", () => {
		const result = sessionUsage([assistant("m1", [toolUse("t1", "Bash", { command: bridge("check", "guide") })], usage(1, 0, 0, 7))]);
		expect(result.total.turns               ).toBe         (1                                ) ;
		expect(result.byCategory["boxbox:check"]).toMatchObject({ turns: 1, calls: 1, output: 7 }) ;
		expect(result.byCategory["boxbox:guide"]).toMatchObject({ turns: 0, calls: 1, output: 0 }) ;
	});
});
