import      { afterEach, expect, test } from "bun:test"                         ;
import      { spawnSync               } from "node:child_process"               ;
import      { createHash              } from "node:crypto"                      ;
import      {
              existsSync            ,
              mkdirSync             ,
              mkdtempSync           ,
              readFileSync          ,
              readdirSync           ,
              rmSync                ,
              unlinkSync            ,
              writeFileSync
                                      } from "node:fs"                          ;
import      { join                    } from "node:path"                        ;
import      {
              parseLifecycleReceipt ,
              readLifecycleReceipt
                                      } from "@/common/29_lifecycle-receipt.ts" ;
import type { LifecycleReceiptV2      } from "@/common/29_lifecycle-receipt.ts" ;

const roots: string[] = []                                                                         ;
const modulePath      = (name: string): string => join(import.meta.dir, "../product/engine", name) ;
const SOURCE          = "a = 1\nlonger = 22\nmid = 333\n"                                          ;
const DENIED          = "a: int = 1\nlonger: int = 22\nmid: int = 333\n"                           ;

interface Fixture {
	readonly root   : string ;
	readonly data   : string ;
	readonly config : string ;
	readonly trace  : string ;
}

function fixture(): Fixture {
	const base = mkdtempSync(join(import.meta.dir, "boxbox-session-modes-"));
	roots.push(base);
	const result = { root: join(base, "project"), data: join(base, "plugin-data"), config: join(base, "config"), trace: join(base, "trace.log") };
	for (const path of [result.root, result.data, result.config]) mkdirSync(path);
	return result;
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const HARNESS = `
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lifecycleHook } from ${JSON.stringify(modulePath("common/27_lifecycle-hook.ts"))};
import { runFormatPipeline } from ${JSON.stringify(modulePath("common/21_format-pipeline.ts"))};
import { documentResolver, loadApprovalRegistry } from ${JSON.stringify(modulePath("common/18_approval-gate.ts"))};
import { ruleData } from ${JSON.stringify(modulePath("05_rule-data.ts"))};
import { runAlignCli } from ${JSON.stringify(modulePath("common/22_align-cli.ts"))};
import { PYTHON_ALIGNER } from ${JSON.stringify(modulePath("python/03_profile.ts"))};
import { runTypeScriptAlign } from ${JSON.stringify(modulePath("typescript/12_align.ts"))};
const event = process.argv[1];
const root = process.env.TEST_PROJECT;
const scenario = process.env.TEST_SCENARIO;
const trace = (operation, file) => appendFileSync(process.env.TEST_TRACE, JSON.stringify({operation, file}) + "\\n");
const inspect = async (project, file) => {
 trace("inspect", file);
 let report;
 if (file.endsWith(".py")) report = runAlignCli(PYTHON_ALIGNER, ["--file", join(project, file), "--json"]).report;
 else await runTypeScriptAlign(["--file", file, "--json"], {root: project, emit: text => {report = text;}});
 const result = JSON.parse(report).results[0];
 trace("summary", String(result.summary.edits));
 if (scenario === "inspection-drift") writeFileSync(join(project, "concurrent.py"), "external_change = True\\n");
 return {...result, file};
};
const align = async (project, file) => {
 trace("align", file);
 const preset = ruleData("presets/recommended/");
 const options = {
  root: project, file, language: file.endsWith(".py") ? "python" : "typescript", alignmentOnly: true,
  registry: loadApprovalRegistry([{root: preset, layer: "preset"}]), resolveDocument: documentResolver({preset}),
 };
 const preview = await runFormatPipeline({...options, dryRun: true});
 const applied = await runFormatPipeline(options);
 if (scenario === "other-file-drift") writeFileSync(join(project, "concurrent.py"), "external_change = True\\n");
 return {written: scenario === "no-write-but-change" ? false : applied.written, edits: preview.alignmentEdits?.length ?? 0};
};
await lifecycleHook([event], inspect, {
 ...(process.env.TEST_VERSION ? {version: process.env.TEST_VERSION} : {}),
 ...(process.env.TEST_CALLBACK === "0" ? {} : {align}),
});
`;

function hook(value: Fixture, event: "session" | "post" | "stop", mode = "check", options: { readonly scenario?: string; readonly tool?: string; readonly active?: boolean; readonly callback?: boolean; readonly version?: string; readonly env?: Record<string, string> } = {}): Record<string, unknown> {
	const run = spawnSync(process.execPath, ["-e", HARNESS, event], {
		input    : JSON.stringify({ session_id: "session-modes", cwd: value.root, tool_name: options.tool ?? "Write", stop_hook_active: options.active }) ,
		encoding : "utf8"                                                                                                                                 ,
		env      : {
			...process.env,
			CLAUDE_PLUGIN_DATA  : value.data                             ,
			PLUGIN_DATA         : ""                                     ,
			CLAUDE_PROJECT_DIR  : value.root                             ,
			XDG_CONFIG_HOME     : value.config                           ,
			BOXBOX_MODE         : mode                                   ,
			BOXBOX_UPDATE_CHECK : "0"                                    ,
			TEST_PROJECT        : value.root                             ,
			TEST_TRACE          : value.trace                            ,
			TEST_SCENARIO       : options.scenario ?? ""                 ,
			TEST_CALLBACK       : options.callback === false ? "0" : "1" ,
			TEST_VERSION        : options.version ?? ""                  ,
			...options.env,
		},
	});
	expect(run.status).toBe(0);
	if (!run.stdout.trim()) throw new Error(`No hook output: ${run.stderr}`);
	return JSON.parse(run.stdout);
}

function records(value: Fixture): string[] {
	const project   = readdirSync(join(value.data, "hooks"))[0]!                 ;
	const session   = createHash("sha256").update("session-modes").digest("hex") ;
	const directory = join(value.data, "hooks", project, session)                ;
	return readdirSync(directory).filter(name => name.endsWith(".json") && name !== "baseline.json").map(name => join(directory, name));
}

function latest(value: Fixture): LifecycleReceiptV2 {
	const paths  = records(value).sort()               ;
	const result = readLifecycleReceipt(paths.at(-1)!) ;
	expect(result.schemaVersion).toBe(2);
	return result as LifecycleReceiptV2;
}

function trace(value: Fixture): { operation: string; file: string }[] {
	return existsSync(value.trace) ? readFileSync(value.trace, "utf8").trim().split("\n").map(line => JSON.parse(line)) : [];
}

function baseline(value: Fixture): string {
	const project = readdirSync(join(value.data, "hooks"))[0]!                 ;
	const session = createHash("sha256").update("session-modes").digest("hex") ;
	return readFileSync(join(value.data, "hooks", project, session, "baseline.json"), "utf8");
}

test("off captures the original baseline and stays silent until checks are enabled", () => {
	const value = fixture();
	expect(JSON.stringify(hook(value, "session", "off"))).toContain("Mode off");
	const before = baseline(value);
	writeFileSync(join(value.root, "sample.py"), SOURCE);
	expect(hook(value, "post", "off")           ).toEqual      ({}                                                                                           ) ;
	expect(hook(value, "stop", "off")           ).toEqual      ({}                                                                                           ) ;
	expect(trace(value)                         ).toEqual      ([]                                                                                           ) ;
	expect(records(value)                       ).toEqual      ([]                                                                                           ) ;
	expect(hook(value, "post", "check").decision).toBe         ("block"                                                                                      ) ;
	expect(latest(value)                        ).toMatchObject({ schemaVersion: 2, mode: "check", state: "FAIL", aligned: [], automaticFixPerformed: false }) ;
	expect(baseline(value)                      ).toBe         (before                                                                                       ) ;
}, 60_000);

for (const mode of ["check", "refactor"]) test(`${mode} inspects without calling the writer and schema-1 evidence stays readable`, () => {
	const value = fixture();
	hook(value, "session", mode);
	writeFileSync(join(value.root, "sample.py"), SOURCE);
	hook(value, "post", mode);
	const record = latest(value);
	expect(record                                                 ).toMatchObject({ mode, state: "FAIL", automaticFixPerformed: false, aligned: [] }) ;
	expect(trace(value).filter(item => item.operation === "align")).toEqual      ([]                                                                ) ;
	expect(readFileSync(join(value.root, "sample.py"), "utf8")    ).toBe         (SOURCE                                                            ) ;
	const { mode: _mode, aligned: _aligned, ...shared } = record;
	expect(parseLifecycleReceipt(JSON.stringify({ ...shared, schemaVersion: 1 })).schemaVersion).toBe(1);
}, 60_000);

test("align records actual changed lines from the approved callback and rechecks the written source", () => {
	const value  = fixture()                                                    ;
	const source = "const a=fn(1);\nconst longer=fn(22);\nconst mid=fn(333);\n" ;
	hook(value, "session", "align");
	const before = baseline(value);
	writeFileSync(join(value.root, "sample.ts"), source);
	const output       = hook(value, "post", "align")                                                                                                       ;
	const record       = latest(value)                                                                                                                      ;
	const changedLines = source.split("\n").filter((line, index) => line !== readFileSync(join(value.root, "sample.ts"), "utf8").split("\n")[index]).length ;
	expect(output.decision).toBeUndefined();
	expect(record                                                               ).toMatchObject  ({ mode: "align", state: "PASS", automaticFixPerformed: true, aligned: [{ file: "sample.ts", edits: changedLines }] }) ;
	expect(record.checked[0]?.result.summary.misaligned                         ).toBe           (0                                                                                                                   ) ;
	expect(Number(trace(value).find(item => item.operation === "summary")?.file)).toBeGreaterThan(changedLines                                                                                                        ) ;
	expect(trace(value).filter(item => item.operation === "inspect")            ).toHaveLength   (2                                                                                                                   ) ;
	expect(JSON.stringify(output)                                               ).toContain      ("re-read before editing"                                                                                            ) ;
	expect(baseline(value)                                                      ).toBe           (before                                                                                                              ) ;
}, 60_000);

test("unapproved align callbacks preserve bytes and keep failed Bash feedback advisory", () => {
	const value = fixture();
	hook(value, "session", "align");
	writeFileSync(join(value.root, "sample.py"), DENIED);
	const bash = hook(value, "post", "align", { tool: "Bash" });
	expect(bash.decision).toBeUndefined();
	expect(latest(value)                                          ).toMatchObject({ mode: "align", state: "FAIL", automaticFixPerformed: false, aligned: [] }) ;
	expect(readFileSync(join(value.root, "sample.py"), "utf8")    ).toBe         (DENIED                                                                     ) ;
	expect(hook(value, "post", "align", { tool: "Edit" }).decision).toBe         ("block"                                                                    ) ;
	expect(trace(value).filter(item => item.operation === "align")).toHaveLength (2                                                                          ) ;
}, 60_000);

test("a completed approved file and a refused file retain their separate outcomes", () => {
	const value = fixture();
	hook(value, "session", "align");
	writeFileSync(join(value.root, "approved.py"), SOURCE);
	writeFileSync(join(value.root, "unapproved.py"), DENIED);
	const output = hook  (value, "post", "align") ;
	const record = latest(value                 ) ;

	expect(output.decision                                                                      )    .toBe           ("block"                                                                                     ) ;
	expect(record                                                                               )    .toMatchObject  ({ state: "FAIL", automaticFixPerformed: true, aligned: [{ file: "approved.py", edits: 2 }] }) ;
	expect(record.checked.find(item => item.file === "approved.py")?.result.summary.misaligned  )    .toBe           (0                                                                                           ) ;
	expect(record.checked.find(item => item.file === "unapproved.py")?.result.summary.misaligned)    .toBeGreaterThan(0                                                                                           ) ;
	expect(readFileSync(join(value.root, "approved.py"), "utf8")                                ).not.toBe           (SOURCE                                                                                      ) ;
	expect(readFileSync(join(value.root, "unapproved.py"), "utf8")                              )    .toBe           (DENIED                                                                                      ) ;
	expect(JSON.stringify(output)                                                               )    .toContain      ("Aligned approved.py (2 changed lines)"                                                     ) ;
}, 60_000);

test("align Stop never calls the writer and retains the one-continuation claim", () => {
	const value = fixture();
	hook(value, "session", "align");
	writeFileSync(join(value.root, "sample.py"), SOURCE);
	expect(hook(value, "stop", "align").decision).toBe("block");
	expect(hook(value, "stop", "align").decision).toBeUndefined();
	expect(latest(value)                                          ).toMatchObject({ mode: "align", state: "FAIL", automaticFixPerformed: false, aligned: [] }) ;
	expect(trace(value).filter(item => item.operation === "align")).toEqual      ([]                                                                         ) ;
	expect(readFileSync(join(value.root, "sample.py"), "utf8")    ).toBe         (SOURCE                                                                     ) ;
}, 60_000);

test("align without a writer callback remains a read-only failing inspection", () => {
	const value = fixture();
	hook(value, "session", "align");
	writeFileSync(join(value.root, "sample.py"), SOURCE);
	expect(hook(value, "post", "align", { callback: false }).decision).toBe         ("block"                                                                    ) ;
	expect(latest(value)                                             ).toMatchObject({ mode: "align", state: "FAIL", automaticFixPerformed: false, aligned: [] }) ;
	expect(readFileSync(join(value.root, "sample.py"), "utf8")       ).toBe         (SOURCE                                                                     ) ;
}, 60_000);

for (const sample of [
	{ state : "NO_GROUPS"    , file : "sample.py" , source : "def answer():\n    return 42\n" , deleted : false },
	{ state : "SUGGEST"      , file : "sample.py" , source : "a = 1\nlonger = 22\n"           , deleted : false },
	{ state : "UNSUPPORTED"  , file : "sample.js" , source : "let answer = 42;\n"             , deleted : false },
	{ state : "DELETED_ONLY" , file : "sample.py" , source : "a = 1\n"                        , deleted : true  },
]) test(`mode receipts retain ${sample.state} coverage without a write`, () => {
	const value = fixture();
	if (sample.deleted) writeFileSync(join(value.root, sample.file), sample.source);
	hook(value, "session", "align");
	if (sample.deleted) unlinkSync(join(value.root, sample.file));
	else writeFileSync(join(value.root, sample.file), sample.source);
	expect(hook(value, "post", "align").decision).toBeUndefined();
	expect(latest(value)).toMatchObject({ mode: "align", state: sample.state, automaticFixPerformed: false, aligned: [] });
	expect(trace(value).filter(item => item.operation === "align")).toEqual([]);
}, 60_000);

test("a concurrent other-file write is not blessed by an approved alignment's hash update", () => {
	const value = fixture();
	hook(value, "session", "align");
	writeFileSync(join(value.root, "sample.py"), SOURCE);
	const output = hook(value, "post", "align", { scenario: "other-file-drift" });
	expect(JSON.stringify(output)).toContain("Source changed during alignment");
	expect(JSON.stringify(output)).toContain("Aligned sample.py");
	expect(output.decision).toBeUndefined();
	expect(records(value)                                         )    .toEqual([]                        ) ;
	expect(readFileSync(join(value.root, "concurrent.py"), "utf8"))    .toBe   ("external_change = True\n") ;
	expect(readFileSync(join(value.root, "sample.py"), "utf8")    ).not.toBe   (SOURCE                    ) ;
}, 60_000);

test("source drift during inspection prevents any alignment callback", () => {
	const value = fixture();
	hook(value, "session", "align");
	writeFileSync(join(value.root, "sample.py"), SOURCE);
	const output = hook(value, "post", "align", { scenario: "inspection-drift" });
	expect(JSON.stringify(output)                                 ).toContain("Source changed during check") ;
	expect(trace(value).filter(item => item.operation === "align")).toEqual  ([]                           ) ;
	expect(readFileSync(join(value.root, "sample.py"), "utf8")    ).toBe     (SOURCE                       ) ;
}, 60_000);

test("a callback cannot hide changed bytes by reporting that it wrote nothing", () => {
	const value = fixture();
	hook(value, "session", "align");
	writeFileSync(join(value.root, "sample.py"), SOURCE);
	const output = hook(value, "post", "align", { scenario: "no-write-but-change" });
	expect(JSON.stringify(output)).toContain("Source changed during alignment");
	expect(records(value)).toEqual([]);
}, 60_000);

test("a cached update notice is considered only at SessionStart when a version is supplied", () => {
	const value = fixture()                             ;
	const state = join   (value.config, "boxbox/state") ;
	mkdirSync(state, { recursive: true });
	writeFileSync(join(state, "update.json"), JSON.stringify({ checkedAt: new Date().toISOString(), latest: "99.0.1" }));
	const withoutVersion = hook(value, "session", "check", { env: { BOXBOX_UPDATE_CHECK: "1", PATH: "" } });
	expect(withoutVersion.systemMessage).toBeUndefined();
	const withVersion = hook(value, "session", "check", { version: "0.2.7", env: { BOXBOX_UPDATE_CHECK: "1", PATH: "" } });
	expect(String(withVersion.systemMessage)).toContain("BoxBox update available");
	writeFileSync(join(value.root, "sample.py"), SOURCE);
	const post = hook(value, "post", "check", { version: "0.2.7" });
	expect(JSON.stringify(post)).not.toContain("update available");
}, 60_000);

test("update advice failure cannot prevent SessionStart from capturing its baseline", () => {
	const value   = fixture()                        ;
	const blocked = join   (value.config, "blocked") ;
	writeFileSync(blocked, "regular file");
	const output = hook(value, "session", "check", { version: "0.2.7", env: { XDG_CONFIG_HOME: blocked, BOXBOX_UPDATE_CHECK: "1", PATH: "" } });
	expect(JSON.stringify(output)).not.toContain("hook error");
	expect(baseline(value)).toBeTruthy();
}, 60_000);
