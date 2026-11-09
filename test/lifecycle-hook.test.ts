import      { afterEach, expect, test                            } from "bun:test"                         ;
import      { createHash                                         } from "node:crypto"                      ;
import      { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs"                          ;
import      {
              lstatSync                                        ,
              mkdirSync                                        ,
              rmSync                                           ,
              symlinkSync                                      ,
              unlinkSync                                       ,
              writeFileSync
                                                                 } from "node:fs"                          ;
import      { join                                               } from "node:path"                        ;
import      { spawn, spawnSync                                   } from "node:child_process"               ;
import      { pathToFileURL                                      } from "node:url"                         ;
import      { readLifecycleReceipt                               } from "@/common/29_lifecycle-receipt.ts" ;
import      { lifecyclePostFingerprint                           } from "@/common/27_lifecycle-hook.ts"    ;

const CLI                   = join(import.meta.dir, "../product/packages/cli/entry.ts")                                  ;
const LIFECYCLE_MODULE      = pathToFileURL(join(import.meta.dir, "../product/engine/common/27_lifecycle-hook.ts")).href ;
const workspaces : string[] = []                                                                                         ;

afterEach(() => {
	for (const root of workspaces.splice(0)) rmSync(root, { recursive: true, force: true });
});

function project(): string {
	const root = mkdtempSync(join(import.meta.dir, "boxbox-lifecycle-hook-"));
	workspaces.push(root);
	return root;
}

/** Isolate mode/config state and prevent update probes in existing read-only hook regressions. */
function isolatedEnvironment(root: string): NodeJS.ProcessEnv {
	return { ...process.env, BOXBOX_MODE: "check", BOXBOX_UPDATE_CHECK: "0", XDG_CONFIG_HOME: join(root, ".boxbox/test-user-config") };
}

/** With data, calls it like a plugin: no --root, a cwd input and CLAUDE_PLUGIN_DATA. */
function hook(root: string, mode: "session" | "post" | "stop", input: Record<string, unknown>, data?: string, projectRoot = ""): Record<string, unknown> {
	const args = data ? [CLI, "hook", mode] : [CLI, "hook", mode, "--root", root]                                                                                                                                                                                ;
	const run  = spawnSync(process.execPath, args, { input: JSON.stringify(data ? { ...input, cwd: root } : input), encoding: "utf8", env: { ...isolatedEnvironment(root), CLAUDE_PLUGIN_DATA: data ?? "", PLUGIN_DATA: "", CLAUDE_PROJECT_DIR: projectRoot } }) ;
	expect(run.status).toBe(0);
	return JSON.parse(run.stdout);
}

function pluginDataHook(root: string, mode: "session" | "post" | "stop", input: Record<string, unknown>, data: string, variable: "PLUGIN_DATA" | "CLAUDE_PLUGIN_DATA"): Record<string, unknown> {
	const env = { ...isolatedEnvironment(root), CLAUDE_PLUGIN_DATA: "", PLUGIN_DATA: "", CLAUDE_PROJECT_DIR: "", [variable]: data }         ;
	const run = spawnSync(process.execPath, [CLI, "hook", mode], { input: JSON.stringify({ ...input, cwd: root }), encoding: "utf8", env }) ;
	expect(run.status).toBe(0);

	return JSON.parse(run.stdout);
}

function receiptOf(output: Record<string, unknown>): Record<string, unknown> {
	const specific = output.hookSpecificOutput as { additionalContext?: unknown } | undefined           ;
	const context  = String(output.reason ?? output.systemMessage ?? specific?.additionalContext ?? "") ;
	const path     = /filesWithGroups=\d+\. (.+?\.json) mode=/u.exec(context)?.[1]                      ;
	if (!path) throw new Error(`receipt path missing: ${context}`);
	return readLifecycleReceipt(path) as unknown as Record<string, unknown>;
}

function concurrentHook(root: string, mode: "post" | "stop", input: Record<string, unknown>): Promise<Record<string, unknown>> {
	return new Promise((resolveRun, reject) => {
		const child = spawn(process.execPath, [CLI, "hook", mode, "--root", root], { stdio: ["pipe", "pipe", "pipe"], env: { ...isolatedEnvironment(root), CLAUDE_PLUGIN_DATA: "", PLUGIN_DATA: "" } }) ;
		let stdout  = ""                                                                                                                                                                                ;
		let stderr  = ""                                                                                                                                                                                ;
		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", chunk => { stdout += chunk; });
		child.stderr.on("data", chunk => { stderr += chunk; });
		child.once("error", reject);
		child.once("close", status => {
			if (status !== 0) { reject(new Error(`hook exited ${status}: ${stderr}`)); return; }
			try { resolveRun(JSON.parse(stdout)); }
			catch (error) { reject(error); }
		});
		child.stdin.end(JSON.stringify(input));
	});
}

function stateDirectory(root: string, session: string): string {
	return join(root, ".boxbox/hooks", createHash("sha256").update(session).digest("hex"));
}

test("PostToolUse snapshot fingerprints are independent of enumeration order", () => {
	const left  = { "b.ts": "two", "a.ts": "one" } ;
	const right = { "a.ts": "one", "b.ts": "two" } ;

	expect(lifecyclePostFingerprint("check", left)).toBe(lifecyclePostFingerprint("check", right));
	expect(lifecyclePostFingerprint("align", left)).not.toBe(lifecyclePostFingerprint("check", right));
	const composed   = "é.ts"       ;
	const decomposed = "e\u0301.ts" ;
	expect(composed.localeCompare(decomposed)).toBe(0);
	expect(lifecyclePostFingerprint("check", { [composed]: "one", [decomposed]: "two" }))
		.toBe(lifecyclePostFingerprint("check", { [decomposed]: "two", [composed]: "one" }));
});

test("changes to unsupported files do not block later PostToolUse or Stop", () => {
	const root = project();
	hook(root, "session", { session_id: "one" });
	writeFileSync(join(root, "one.js"), "x=1\n");

	expect(hook(root, "post", { session_id: "one", tool_name: "Write" }).decision).toBeUndefined();
	expect(hook(root, "stop", { session_id: "one" }).decision                    ).toBeUndefined();
}, 60_000);

test("Stop does not block again with stop_hook_active even when an alignment failure remains", () => {
	const root = project();
	hook(root, "session", { session_id: "two" });
	writeFileSync(join(root, "sample.py"), "a = 1\nlonger = 22\nmid = 333\n");

	const firstPost = hook(root, "post", { session_id: "two", tool_name: "Write" });
	expect(firstPost.decision                                          ).toBe     ("block"              ) ;
	expect(JSON.stringify(firstPost)                                   ).toContain("attention=sample.py") ;
	expect(hook(root, "post", { session_id: "two", tool_name: "Edit" })).toEqual  ({}                   ) ;
	expect(hook(root, "stop", { session_id: "two" }).decision          ).toBe     ("block"              ) ;
	expect(hook(root, "stop", { session_id: "two", stop_hook_active: true }).decision ).toBeUndefined() ;
	expect(hook(root, "stop", { session_id: "two" }).decision                         ).toBeUndefined() ;
}, 60_000);

test("plugin hooks use the cwd input and write records to the plugin data folder, not the project", () => {
	const root = project() ;
	const data = project() ;
	hook(root, "session", { session_id: "three" }, data);
	writeFileSync(join(root, "sample.py"), "a = 1\nlonger = 22\nmid = 333\n");

	expect(hook(root, "post", { session_id: "three", tool_name: "apply_patch" }, data).decision).toBe("block") ;
	expect(existsSync(join(root, ".boxbox"))                                                   ).toBe(false  ) ;
	expect(readdirSync(join(data, "hooks")).length                                             ).toBe(1      ) ;
}, 60_000);

test("the session project root keeps nested repository edits on one baseline when cwd changes", () => {
	const outer   = project()                      ;
	const root    = join(outer, "team")            ;
	const nested  = join(root, "nested")           ;
	const data    = project()                      ;
	const session = "nested-project-root"          ;
	const source  = "def answer():\n\treturn 42\n" ;
	mkdirSync(nested, { recursive: true });
	for (const path of [outer, nested]) expect(spawnSync("git", ["init", "-q", path]).status).toBe(0);

	hook(root, "session", { session_id: session }, data, root);
	writeFileSync(join(nested, "sample.py"), source);
	const output = hook(nested, "post", { session_id: session, tool_name: "Edit", tool_input: { file_path: join(nested, "sample.py") } }, data, root);
	expect(JSON.stringify(output)).not.toContain("hook error");
	const receipt = receiptOf(output);

	expect(receipt                                                                  )    .toMatchObject({ state: "NO_GROUPS", files: ["nested/sample.py"] }) ;
	expect(readdirSync(join(data, "hooks"))                                         )    .toHaveLength (1                                                  ) ;
	expect(existsSync(join(nested, ".boxbox"))                                      )    .toBe         (false                                              ) ;
	expect(readFileSync(join(nested, "sample.py"), "utf8")                          )    .toBe         (source                                             ) ;
	expect(JSON.stringify(hook(nested, "stop", { session_id: session }, data, root))).not.toContain    ("hook error"                                       ) ;
}, 60_000);

test("outside-project edits report scope without creating another project baseline", () => {
	const root    = project()                         ;
	const outside = project()                         ;
	const data    = project()                         ;
	const session = "outside-project-root"            ;
	const file    = join(outside, "scratch.py")       ;
	const source  = "a = 1\nlonger = 22\nmid = 333\n" ;
	hook(root, "session", { session_id: session }, data, root);
	const namespaces = readdirSync(join(data, "hooks"));
	writeFileSync(file, source);

	const output = hook(outside, "post", { session_id: session, tool_name: "Write", tool_input: { file_path: file } }, data, root);
	expect(JSON.stringify(output)).not.toContain("hook error");
	expect(JSON.stringify(output)).toContain("outside the session project");
	expect(output.decision).toBeUndefined();
	expect(receiptOf(output)                   ).toMatchObject({ state: "NO_CHANGES", files: [], checked: [] }) ;
	expect(readdirSync(join(data, "hooks"))    ).toEqual      (namespaces                                     ) ;
	expect(existsSync(join(outside, ".boxbox"))).toBe         (false                                          ) ;
	expect(readFileSync(file, "utf8")          ).toBe         (source                                         ) ;
	const stationary = hook(root, "post", { session_id: session, tool_name: "Edit", tool_input: { file_path: file } }, data, root);
	expect(JSON.stringify(stationary)).toContain("outside the session project");
	expect(receiptOf(stationary)).toMatchObject({ state: "NO_CHANGES", files: [] });
}, 60_000);

test("the session root is canonicalized and explicit roots keep precedence over the host project", () => {
	const real      = project()                 ;
	const container = project()                 ;
	const linked    = join(container, "linked") ;
	const nested    = join(real, "nested")      ;
	const data      = project()                 ;
	const session   = "canonical-session-root"  ;
	symlinkSync(real, linked, "dir");
	mkdirSync(nested);
	hook(linked, "session", { session_id: session }, data, linked);
	writeFileSync(join(nested, "sample.py"), "def answer():\n\treturn 42\n");
	const output = hook(nested, "post", { session_id: session, tool_name: "Edit", tool_input: { file_path: join(linked, "nested/sample.py") } }, data, real);
	expect(JSON.stringify(output)).not.toContain("outside the session project");
	const receipt = receiptOf(output);
	expect(receipt).toMatchObject({ state: "NO_GROUPS", files: ["nested/sample.py"] });
	expect(readdirSync(join(data, "hooks"))).toHaveLength(1);

	const explicit = project();
	hook(explicit, "session", { session_id: "explicit-root" }, undefined, real);
	writeFileSync(join(explicit, "sample.py"), "def answer():\n\treturn 42\n");
	expect(receiptOf(hook(explicit, "post", { session_id: "explicit-root", tool_name: "Write" }, undefined, real)).state).toBe("NO_GROUPS");
}, 60_000);

test("the host project does not replace a missing SessionStart or bypass receipt namespace guards", () => {
	const root    = project()               ;
	const nested  = join   (root, "nested") ;
	const outside = project()               ;
	const data    = project()               ;
	mkdirSync(nested);
	const missing = hook(nested, "post", { session_id: "never-started", tool_name: "Edit" }, data, root);
	expect(JSON.stringify(missing)).toContain("Missing SessionStart baseline");
	const projectNamespace = readdirSync(join(data, "hooks"))[0]!;
	expect(existsSync(join(data, "hooks", projectNamespace, createHash("sha256").update("never-started").digest("hex"), "baseline.json"))).toBe(false);

	const unsafeData = project();
	symlinkSync(outside, join(unsafeData, "hooks"), "dir");
	const unsafe = hook(nested, "session", { session_id: "unsafe-session-root" }, unsafeData, root);
	expect(JSON.stringify(unsafe)).toContain("Unsafe receipt namespace");
	expect(readdirSync(outside)).toEqual([]);
}, 60_000);

test("fresh Codex and Claude plugin-data paths create every missing ancestor without project receipts", () => {
	for (const variable of ["PLUGIN_DATA", "CLAUDE_PLUGIN_DATA"] as const) {
		const root      = project()                                                                ;
		const container = project()                                                                ;
		const data      = join(container, "fresh", "plugins", "data", "boxbox-boxbox-plugins")     ;
		const session   = `fresh-${variable}`                                                      ;
		const started   = pluginDataHook(root, "session", { session_id: session }, data, variable) ;
		expect(JSON.stringify(started)).not.toContain("hook error");
		writeFileSync(join(root, "sample.py"), "def answer():\n\treturn 42\n");
		const receipt = receiptOf(pluginDataHook(root, "post", { session_id: session, tool_name: "Write" }, data, variable));

		expect(receipt.state                    ).toBe("NO_GROUPS") ;
		expect(existsSync(join(data, "hooks"))  ).toBe(true       ) ;
		expect(existsSync(join(root, ".boxbox"))).toBe(false      ) ;
		for (const directory of [join(container, "fresh"), join(container, "fresh/plugins"), join(container, "fresh/plugins/data"), data]) {
			expect(lstatSync(directory).mode & 0o777).toBe(0o700);
		}
	}
}, 60_000);

test("a fresh plugin-data root may descend from an existing symbolic ancestor", () => {
	const root      = project()                          ;
	const target    = project()                          ;
	const container = project()                          ;
	const alias     = join   (container, "var-alias"   ) ;
	const data      = join   (alias, "nested", "plugin") ;
	symlinkSync(target, alias, "dir");

	const started = pluginDataHook(root, "session", { session_id: "aliased-plugin-parent" }, data, "PLUGIN_DATA");
	expect(JSON.stringify(started)                        ).not.toContain("hook error") ;
	expect(existsSync(join(target, "nested/plugin/hooks")))    .toBe     (true        ) ;
	expect(existsSync(join(root, ".boxbox"))              )    .toBe     (false       ) ;
}, 60_000);

test("receipt namespaces reject project and plugin-data symlinks without writing through them", () => {
	const outside = project() ;
	const local   = project() ;
	symlinkSync(outside, join(local, ".boxbox"), "dir");
	const localOutput = hook(local, "session", { session_id: "local-symlink" });
	expect(JSON.stringify(localOutput)).toContain("Unsafe receipt namespace");
	expect(readdirSync(outside)).toEqual([]);

	const root = project() ;
	const data = project() ;
	symlinkSync(outside, join(data, "hooks"), "dir");
	const pluginOutput = hook(root, "session", { session_id: "plugin-symlink" }, data);
	expect(JSON.stringify(pluginOutput)).toContain("Unsafe receipt namespace");
	expect(readdirSync(outside)).toEqual([]);

	const linkedRoot = project()                   ;
	const linkedData = join   (linkedRoot, "data") ;
	symlinkSync(outside, linkedData, "dir");
	const dataOutput = hook(project(), "session", { session_id: "plugin-data-root-symlink" }, linkedData);
	expect(JSON.stringify(dataOutput)).toContain("Unsafe receipt namespace");
	expect(readdirSync(outside)).toEqual([]);
}, 60_000);

test("a symbolic project root remains a legitimate source root while owned namespace symlinks stay rejected", () => {
	const real      = project()                    ;
	const container = project()                    ;
	const linked    = join   (container, "linked") ;
	symlinkSync(real, linked, "dir");

	hook(linked, "session", { session_id: "linked-root" });
	writeFileSync(join(real, "sample.py"), "def answer():\n\treturn 42\n");
	const receipt = receiptOf(hook(linked, "post", { session_id: "linked-root", tool_name: "Write" }));

	expect(receipt.state).toBe("NO_GROUPS");
	expect(existsSync(join(real, ".boxbox/hooks"))).toBe(true);
}, 60_000);

test("a symbolic project root excludes canonical plugin data stored inside the real project", () => {
	const real      = project()                          ;
	const container = project()                          ;
	const linked    = join   (container, "linked"      ) ;
	const data      = join   (real     , "custom-data" ) ;
	const source    = "def answer():\n\treturn 42\n"     ;
	symlinkSync(real, linked, "dir");

	pluginDataHook(linked, "session", { session_id: "canonical-exclusion" }, data, "PLUGIN_DATA");
	writeFileSync(join(real, "sample.py"), source);
	const first  = receiptOf(pluginDataHook(linked, "post", { session_id: "canonical-exclusion", tool_name: "Write" }, data, "PLUGIN_DATA")) ;
	const second = receiptOf(pluginDataHook(linked, "post", { session_id: "canonical-exclusion", tool_name: "Read"  }, data, "PLUGIN_DATA")) ;

	expect((first.checked as { file: string }[]).map(item => item.file) ).toEqual      (["sample.py"]                                  ) ;
	expect((second.checked as { file: string }[]).map(item => item.file)).toEqual      (["sample.py"]                                  ) ;
	expect(second                                                       ).toMatchObject({ state: "NO_GROUPS", files: ["sample.py"]   } ) ;
	expect(readFileSync(join(real, "sample.py"), "utf8")                ).toBe         (source                                         ) ;
	expect(existsSync(join(real, ".boxbox"))                            ).toBe         (false                                          ) ;
}, 60_000);

test("project-local plugin data excludes only BoxBox's owned receipt namespace", () => {
	const root = project()                    ;
	const data = join   (root, "plugin-data") ;
	hook(root, "session", { session_id: "local-data" }, data);

	const unchanged = hook(root, "post", { session_id: "local-data", tool_name: "Read" }, data);
	expect(receiptOf(unchanged)).toMatchObject({ state: "NO_CHANGES", files: [], checked: [] });

	writeFileSync(join(data, "user.json"), "{}\n");
	const userChange  = receiptOf(hook(root, "post", { session_id: "local-data", tool_name: "Write" }, data)) ;
	const userChecked = userChange.checked as { file: string }[]                                              ;
	expect(userChange.state).toBe("NO_GROUPS");
	expect(userChecked.map(entry => entry.file)).toContain("plugin-data/user.json");

	const unrelated = join(data, "hooks", "unrelated-project");
	mkdirSync(unrelated, { recursive: true });
	writeFileSync(join(unrelated, "receipt.json"), "{}\n");
	const unrelatedChange  = receiptOf(hook(root, "post", { session_id: "local-data", tool_name: "Write" }, data)) ;
	const unrelatedChecked = unrelatedChange.checked as { file: string }[]                                         ;
	expect(unrelatedChange.state).toBe("NO_GROUPS");
	expect(unrelatedChecked.map(entry => entry.file)).toContain("plugin-data/hooks/unrelated-project/receipt.json");
}, 60_000);

test("hooks inspect all four supported language boundaries without changing source bytes", () => {
	const root = project();
	hook(root, "session", { session_id: "four-languages" });
	const sources = new Map([
		["sample.ts"  , "const a = 1;\nconst longer = 22;\nconst mid = 333;\n"],
		["sample.py"  , "a = 1\nlonger = 22\nmid = 333\n"],
		["sample.json", "{\n  \"a\": 1,\n  \"longer\": 22,\n  \"mid\": 333\n}\n"],
		["sample.yaml", "a: 1\nlonger: 22\nmid: 333\n"],
	]);
	for (const [file, source] of sources) writeFileSync(join(root, file), source);

	const receipt = receiptOf(hook(root, "post", { session_id: "four-languages", tool_name: "Write" })) ;
	const checked = receipt.checked as { file: string; result: { language: string } }[]                 ;
	expect(checked.map(item => item.result.language).sort()).toEqual(["json", "python", "typescript", "yaml"]);
	expect(receipt.coverage).toMatchObject({ changedFiles: 4, checkedFiles: 4, unsupportedFiles: 0 });
	for (const [file, source] of sources) expect(readFileSync(join(root, file), "utf8")).toBe(source);
}, 60_000);

test("real two-row suggestions stay nonblocking while an aligned three-row table passes", () => {
	const suggestedRoot   = project()             ;
	const suggestedSource = "a = 1\nlonger = 2\n" ;
	hook(suggestedRoot, "session", { session_id: "two-row-suggest" });
	writeFileSync(join(suggestedRoot, "sample.py"), suggestedSource);
	const suggestedOutput  = hook     (suggestedRoot, "post", { session_id: "two-row-suggest", tool_name: "Write" }) ;
	const suggestedReceipt = receiptOf(suggestedOutput                                                             ) ;

	expect(suggestedOutput.decision).toBeUndefined();
	expect(suggestedReceipt.state).toBe("SUGGEST");
	expect(readFileSync(join(suggestedRoot, "sample.py"), "utf8")).toBe(suggestedSource);

	const passingRoot   = project()                              ;
	const passingSource = "a      = 1\nlonger = 2\nmid    = 3\n" ;
	hook(passingRoot, "session", { session_id: "three-row-pass" });
	writeFileSync(join(passingRoot, "sample.py"), passingSource);
	const passingOutput  = hook     (passingRoot, "post", { session_id: "three-row-pass", tool_name: "Write" }) ;
	const passingReceipt = receiptOf(passingOutput                                                            ) ;

	expect(passingOutput.decision).toBeUndefined();
	expect(passingReceipt.state).toBe("PASS");
	expect(readFileSync(join(passingRoot, "sample.py"), "utf8")).toBe(passingSource);
}, 60_000);

test("deleted-only changes receive an explicit state and partition coverage", () => {
	const root = project();
	writeFileSync(join(root, "deleted.py"), "value = 1\n");
	hook(root, "session", { session_id: "deleted-only" });
	unlinkSync(join(root, "deleted.py"));

	const receipt = receiptOf(hook(root, "post", { session_id: "deleted-only", tool_name: "Write" }));
	expect(receipt.state   ).toBe         ("DELETED_ONLY"                                                            ) ;
	expect(receipt.deleted ).toEqual      (["deleted.py"]                                                            ) ;
	expect(receipt.coverage).toMatchObject({ changedFiles: 1, checkedFiles: 0, unsupportedFiles: 0, deletedFiles: 1 }) ;
}, 60_000);

test("real invalid syntax produces a refused FAIL receipt with a legal parse status", () => {
	const root = project();
	hook(root, "session", { session_id: "refused-result" });
	writeFileSync(join(root, "invalid.ts"), "const = ;\n");

	const output  = hook     (root, "post", { session_id: "refused-result", tool_name: "Write" })                ;
	const receipt = receiptOf(output                                                                          )  ;
	const checked = receipt.checked as { result: { summary: { refused: number }; parse: { status: string } } }[] ;
	expect(output.decision                        ).toBe     ("block"                        ) ;
	expect(receipt.state                          ).toBe     ("FAIL"                         ) ;
	expect(checked[0]?.result.summary.refused     ).toBe     (1                              ) ;
	expect(["ok", "changed", "skipped", "not-run"]).toContain(checked[0]?.result.parse.status) ;
}, 60_000);

test("a failing Bash post stays advisory while an edit post still blocks", () => {
	const root = project();
	hook(root, "session", { session_id: "bash-advisory" });
	writeFileSync(join(root, "invalid.ts"), "const = ;\n");

	const bash    = hook          (root, "post", { session_id: "bash-advisory", tool_name: "Bash" }) ;
	const receipt = receiptOf     (bash                                                            ) ;
	const context = JSON.stringify(bash.hookSpecificOutput                                         ) ;
	expect(bash.decision).toBeUndefined();
	expect(receipt.state                                                                  ).toBe     ("FAIL"                                  ) ;
	expect(context                                                                        ).toContain("PostToolUse: FAIL"                     ) ;
	expect(context                                                                        ).toContain("checked=1, groups=1, filesWithGroups=1") ;
	expect(hook(root, "post", { session_id: "bash-advisory", tool_name: "Bash" })         ).toEqual  ({}                                      ) ;
	expect(hook(root, "post", { session_id: "bash-advisory", tool_name: "Edit" }).decision).toBe     ("block"                                 ) ;
}, 60_000);

test("a dangling PostToolUse marker is a losing claim and never creates its external target", () => {
	const root     = project()                       ;
	const outside  = project()                       ;
	const session  = "dangling-post-marker"          ;
	const external = join(outside, "must-not-exist") ;
	hook(root, "session", { session_id: session });
	writeFileSync(join(root, "sample.py"), "a = 1\nlonger = 22\nmid = 333\n");

	expect(hook(root, "post", { session_id: session, tool_name: "Write" }).decision).toBe("block");
	const directory = stateDirectory(root, session)                                         ;
	const marker    = readdirSync(directory).find(name => name.startsWith("post-blocked-")) ;
	expect(marker).toBeDefined();
	unlinkSync(join(directory, marker!));
	symlinkSync(external, join(directory, marker!));

	expect(hook(root, "post", { session_id: session, tool_name: "Edit" })).toEqual({}   ) ;
	expect(lstatSync(join(directory, marker!)).isSymbolicLink()          ).toBe   (true ) ;
	expect(existsSync(external)                                          ).toBe   (false) ;
}, 60_000);

test("concurrent PostToolUse hooks atomically emit one block for an unchanged snapshot", async () => {
	const root = project();
	hook(root, "session", { session_id: "concurrent-post" });
	writeFileSync(join(root, "sample.py"), "a = 1\nlonger = 22\nmid = 333\n");

	const outputs = await Promise.all(Array.from({ length: 8 }, () => concurrentHook(root, "post", { session_id: "concurrent-post", tool_name: "Write" })));
	expect(outputs.filter(output => output.decision === "block")).toHaveLength(1);
	expect(outputs.filter(output => Object.keys(output).length === 0)).toHaveLength(7);
}, 60_000);

test("an active-first Stop does not consume the later exclusive claim", () => {
	const root    = project()                                           ;
	const session = "active-first"                                      ;
	const marker  = join(stateDirectory(root, session), "stop-blocked") ;
	hook(root, "session", { session_id: session });
	writeFileSync(join(root, "sample.py"), "a = 1\nlonger = 22\nmid = 333\n");

	expect(hook(root, "stop", { session_id: session, stop_hook_active: true }).decision).toBeUndefined();
	expect(existsSync(marker)                                  ).toBe(false  ) ;
	expect(hook(root, "stop", { session_id: session }).decision).toBe("block") ;
	expect(lstatSync(marker).isFile()                          ).toBe(true   ) ;
}, 60_000);

test("a dangling Stop marker symlink is a losing claim and never creates its external target", () => {
	const root     = project()                                           ;
	const outside  = project()                                           ;
	const session  = "dangling-marker"                                   ;
	const marker   = join(stateDirectory(root, session), "stop-blocked") ;
	const external = join(outside, "must-not-exist")                     ;
	hook(root, "session", { session_id: session });
	writeFileSync(join(root, "sample.py"), "a = 1\nlonger = 22\nmid = 333\n");
	symlinkSync(external, marker);

	expect(hook(root, "stop", { session_id: session }).decision).toBeUndefined();
	expect(lstatSync(marker).isSymbolicLink()).toBe(true);
	expect(existsSync(external)).toBe(false);
}, 60_000);

test("concurrent Stop hooks atomically emit at most one block for a session", async () => {
	const root = project();
	hook(root, "session", { session_id: "concurrent-stop" });
	writeFileSync(join(root, "sample.py"), "a = 1\nlonger = 22\nmid = 333\n");

	const outputs = await Promise.all(Array.from({ length: 8 }, () => concurrentHook(root, "stop", { session_id: "concurrent-stop" })));
	expect(outputs.filter(output => output.decision === "block")                            ).toHaveLength(1   ) ;
	expect(outputs.filter(output => output.decision === undefined)                          ).toHaveLength(7   ) ;
	expect(lstatSync(join(stateDirectory(root, "concurrent-stop"), "stop-blocked")).isFile()).toBe        (true) ;
}, 60_000);

test("an oversized receipt remains a fail-open infrastructure error", () => {
	const root = project();
	hook(root, "session", { session_id: "oversized-receipt" });
	writeFileSync(join(root, "sample.py"), "a = 1\nlonger = 22\nmid = 333\n");
	const script = `import { lifecycleHook } from ${JSON.stringify(LIFECYCLE_MODULE)};
await lifecycleHook(["post", "--root", process.argv[1]], async (_root, file) => ({
file, language: "python", mode: "check",
summary: { groups: 1, misaligned: 1, edits: 1, refused: 0, suggested: 0 },
groups: [{ kind: "assignment", startLine: 1, endLine: 3, rows: 3, axes: [], state: "FIXABLE", edits: 1 }],
parse: { status: "not-run", tool: "" },
unsupported: [{ line: 1, reason: "x".repeat(8 * 1024 * 1024) }]
}));`;
	const run = spawnSync(process.execPath, ["-e", script, root], {
		input    : JSON.stringify({ session_id: "oversized-receipt", tool_name: "Write" })   ,
		encoding : "utf8"                                                                    ,
		env      : { ...isolatedEnvironment(root), CLAUDE_PLUGIN_DATA: "", PLUGIN_DATA: "" } ,
	});
	const output = JSON.parse(run.stdout);

	expect(run.status).toBe(0);
	expect(output.decision).toBeUndefined();
	expect(JSON.stringify(output)).toContain("hook error: lifecycle receipt: exceeds");
}, 60_000);

test("hook errors never block work; they are only reported", () => {
	const root   = project()                                        ;
	const output = hook   (root, "post", { session_id: "missing" }) ;

	expect(output.decision                        ).toBeUndefined()            ;
	expect(JSON.stringify(output.hookSpecificOutput)).toContain("hook error") ;
}, 60_000);
