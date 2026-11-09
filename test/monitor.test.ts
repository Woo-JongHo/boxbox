import      { createHash                                        } from "node:crypto"                       ;
import      {
              existsSync                                      ,
              lstatSync                                       ,
              mkdirSync                                       ,
              mkdtempSync                                     ,
              readFileSync                                    ,
              realpathSync                                    ,
              rmSync                                          ,
              symlinkSync                                     ,
              writeFileSync
                                                                } from "node:fs"                           ;
import      { tmpdir                                            } from "node:os"                           ;
import      { join                                              } from "node:path"                         ;
import      { afterEach, describe, expect, test                 } from "bun:test"                          ;
import      { snapshot                                          } from "@/common/25_guarded-run.ts"        ;
import      { codexSessionUsage, hostSessionUsage, sessionUsage } from "@/common/30_session-usage.ts"      ;
import      {
              buildMonitorReport                              ,
              monitorReceiptSummary                           ,
              renderMonitorHtml                               ,
              writeMonitorReport
                                                                } from "@/common/31_monitor.ts"            ;
import      {
              baselineHashes                                  ,
              captureLifecycleBaseline                        ,
              compareBaselineFootprints                       ,
              decodeLifecycleBaseline
                                                                } from "@/common/32_lifecycle-baseline.ts" ;

const SECRET            = "PRIVATE-CONVERSATION-CONTENT"                                              ;
const folders: string[] = []                                                                          ;
const hash              = (value: string): string => createHash("sha256").update(value).digest("hex") ;
const json              = (value: unknown): string => JSON.stringify(value)                           ;

function project() {
	const folder = realpathSync(mkdtempSync(join(tmpdir(), "boxbox-monitor-"))) ;
	const root   = join        (folder, "project"                             ) ;
	const data   = join        (folder, "data"                                ) ;
	mkdirSync(root);
	mkdirSync(data);
	folders.push(folder);
	return { folder, root, data };
}

function sessionFolder(root: string, data: string, id: string): string {
	const path = join(data, "hooks", hash(root).slice(0, 16), hash(id));
	mkdirSync(path, { recursive: true });
	return path;
}

const claude = (root: string, id = "session-1", content: unknown[] = []): string => json({
	type: "assistant", cwd: root, sessionId: id,
	message: { id: "message-1", model: "claude-test", content, usage: { input_tokens: 3, cache_read_input_tokens: 9, cache_creation_input_tokens: 2, output_tokens: 5 } },
});
const codexUsage = (input: number, cache: number, output: number): string => json({ type: "event_msg", payload: { type: "token_count", info: { total_token_usage: { input_tokens: input, cached_input_tokens: cache, output_tokens: output }, last_token_usage: { input_tokens: 99, output_tokens: 99 } } } });

afterEach(() => {
	for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

describe("monitor usage readers", () => {
	test("reads the sanitized current Codex record shape", () => {
		const lines  = readFileSync(join(import.meta.dir, "fixtures/monitor/codex-usage.jsonl"), "utf8").split("\n") ;
		const result = codexSessionUsage(lines)                                                                      ;
		expect(result.session).toBe("sanitized-codex-session");
		expect(result.total).toMatchObject({ input: 100, cacheRead: 60, cacheWrite: 5, output: 25 });
	});
	test("Claude counts a split response once using its complete observed usage", () => {
		const first = JSON.parse     (claude("/project")) ;
		const last  = structuredClone(first             ) ;
		last.message.usage.output_tokens = 12;
		last.message.content = [{ type: "text", text: SECRET }];
		const result = sessionUsage([json(first), json(last), json(first)]);
		expect(result.total).toEqual({ turns: 1, input: 3, cacheRead: 9, cacheWrite: 2, output: 12 });
		expect(json(result)).not.toContain(SECRET);
	});

	test("Codex uses cumulative differences, not repeated totals or last-usage buckets", () => {
		const result = codexSessionUsage([
			json({ type: "session_meta", payload: { id: "codex-1", cwd: "/project" } }),
			json({ type: "turn_context", payload: { model: "gpt-test", effort: "high" } }),
			codexUsage(100, 40, 10), codexUsage(100, 40, 10), codexUsage(160, 60, 25),
		]);
		expect(result.total                          ).toEqual({ turns: 2, input: 100, cacheRead: 60, cacheWrite: 0, output: 25 }) ;
		expect(result.byModel["gpt-test:high"]       ).toEqual(result.total                                                      ) ;
		expect(result.byCategory.unattributed?.output).toBe   (25                                                                ) ;
		expect(result.attribution                    ).toBe   ("unavailable"                                                     ) ;
	});

	test("Codex counter resets remain explicitly uncertain and malformed events add nothing", () => {
		const result = codexSessionUsage(["not JSON", codexUsage(100, 40, 10), codexUsage(20, 5, 2), codexUsage(-1, 0, 30)]);
		expect(result.total                                       ).toMatchObject({ input: 75, cacheRead: 45, output: 12 }) ;
		expect(result.notes.join(" ")                             ).toContain    ("uncertain"                             ) ;
		expect(hostSessionUsage("codex", ["null", "[]"]).readable ).toBe         (false                                   ) ;
		expect(hostSessionUsage("claude", ["null", "[]"]).readable).toBe         (false                                   ) ;
	});

	test("Codex counts tool categories without copying commands or inventing step token attribution", () => {
		const result = codexSessionUsage([
			json({ type: "response_item", payload: { type: "function_call", name: "exec_command", arguments: json({ cmd: `boxbox check --file a.ts # ${SECRET}` }) } }),
			json({ type: "response_item", payload: { type: "message", content: [{ text: SECRET }] } }),
			codexUsage(12, 2, 4),
		]);
		expect(result.byCategory["boxbox:check"]).toMatchObject({ calls: 1, input: 0, output: 0 });
		expect(json(result)).not.toContain(SECRET);
	});
});

describe("lifecycle baseline footprints", () => {
	test("v2 and old baselines expose identical hashes; legacy sizes stay unavailable", () => {
		const { root } = project();
		writeFileSync(join(root, "a.ts"), "const a = 1;\n");
		const hashes   = snapshot                (root        ) ;
		const baseline = captureLifecycleBaseline(root, hashes) ;
		expect(baselineHashes(JSON.parse(json(baseline)))                              )    .toEqual      (hashes                                       ) ;
		expect(baselineHashes(hashes)                                                  )    .toEqual      (hashes                                       ) ;
		expect(compareBaselineFootprints(root, decodeLifecycleBaseline(hashes), hashes))    .toEqual      ({ available: false, files: [], totals: null }) ;
		expect(baseline.footprints["a.ts"]                                             )    .toMatchObject({ b: 13, l: 1 }                              ) ;
		expect(json(baseline)                                                          ).not.toContain    ("const a"                                    ) ;
	});

	test.each([
		["a.ts", "const a = 1;\n", "const a   = 1;\n", "horizontal-whitespace"],
		["a.ts", "const a = 'a b';\n", "const a = 'ab';\n", "content"],
		["a.ts", "// a b\nconst a = 1;\n", "// ab\nconst a = 1;\n", "content"],
		["a.ts", "const a = /a b/;\n", "const a = /ab/;\n", "content"],
		["a.ts", "const a = `a b`;\n", "const a = `ab`;\n", "content"],
		["a.py", "a = 1\n", "a   = 1\n", "horizontal-whitespace"],
		["a.py", "a = 1\r\n", "a   = 1\r\n", "horizontal-whitespace"],
		["a.py", "value = f'{1 + 2}'\n", "value = f'{1+2}'\n", "content"],
		["a.py", "a = 1\n  \n", "a = 1\n \n", "content"],
		["a.py", "a = 'a b'\n", "a = 'ab'\n", "content"],
		["a.py", "if True:\n    a = 1\n", "if True:\n        a = 1\n", "content"],
		["a.json", "{\"a\": 1}\n", "{\"a\" : 1}\n", "horizontal-whitespace"],
		["a.json", "{\"a\": \"a b\"}\n", "{\"a\": \"ab\"}\n", "content"],
		["a.yaml", "a: 1\n", "a:   1\n", "horizontal-whitespace"],
		["a.yaml", "a: |\n  a b\n", "a: |\n  ab\n", "content"],
		["a.yaml", "a: hello world\n", "a: hello  world\n", "content"],
		["a.yaml", "a: 1 # a b\n", "a: 1 # ab\n", "content"],
	])("classifies %s without stripping protected content", (name, before, after, expected) => {
		const { root } = project();
		writeFileSync(join(root, name), before);
		const baseline = captureLifecycleBaseline(root, snapshot(root));
		writeFileSync(join(root, name), after);
		const result = compareBaselineFootprints(root, baseline, snapshot(root));
		expect(String(result.files[0]?.change)).toBe(expected);
		expect(result.files[0]?.whitespaceBytes).toBe(expected === "horizontal-whitespace" ? Buffer.byteLength(after) - Buffer.byteLength(before) : null);
	});

	test("counts physical lines and UTF-8 bytes, retaining CRLF and empty-file distinctions", () => {
		const { root } = project();
		writeFileSync(join(root, "empty.py"), "");
		writeFileSync(join(root, "a.ts"), "const a = '😀';\r\nconst b = 2;");
		const baseline = captureLifecycleBaseline(root, snapshot(root));
		expect(baseline.footprints["empty.py"]).toMatchObject({ b: 0, l: 0 });
		expect(baseline.footprints["a.ts"]).toMatchObject({ b: Buffer.byteLength("const a = '😀';\r\nconst b = 2;"), l: 2 });
	});

	test("reports added, deleted and unchanged sources and refuses malformed baseline metadata", () => {
		const { root } = project();
		writeFileSync(join(root, "gone.ts"), "const a = 1;");
		writeFileSync(join(root, "same.ts"), "const a = 2;");
		const baseline = captureLifecycleBaseline(root, snapshot(root));
		rmSync(join(root, "gone.ts"));
		writeFileSync(join(root, "new.ts"), "const a = 3;");
		expect(compareBaselineFootprints(root, baseline, snapshot(root)).files.map(file => [file.file, file.change])                ).toEqual([["gone.ts", "deleted"], ["new.ts", "added"], ["same.ts", "unchanged"]]) ;
		expect(() => decodeLifecycleBaseline({ schemaVersion: 3 })                                                                  ).toThrow("Unsupported"                                                          ) ;
		expect(() => decodeLifecycleBaseline({ "../outside.py": "a".repeat(64) })                                                   ).toThrow("source name"                                                          ) ;
		expect(() => decodeLifecycleBaseline({ ...baseline, footprints: { "same.ts": { h: "b".repeat(64), b: 1, l: 1, s: null } } })).toThrow("footprint"                                                            ) ;
	});

	test("linked sources never supply footprint content", () => {
		const { folder, root } = project();
		const outside = join(folder, "outside.py");
		writeFileSync(outside, `${SECRET} = 1\n`);
		symlinkSync(outside, join(root, "linked.py"));
		const baseline = captureLifecycleBaseline(root, snapshot(root));
		expect(baseline.hashes["linked.py"])    .toStartWith("symlink:") ;
		expect(baseline.footprints         )    .toEqual    ({}        ) ;
		expect(json(baseline)              ).not.toContain  (SECRET    ) ;
	});
});

test("invalid sources and missing Python preserve baseline hashes and sizes", () => {
	const { root } = project();
	writeFileSync(join(root, "invalid.py"), "def missing(:\n");
	writeFileSync(join(root, "invalid.ts"), "const = ;\n");
	const hashes  = snapshot                (root        ) ;
	const invalid = captureLifecycleBaseline(root, hashes) ;
	expect(invalid.hashes                  ).toEqual      (hashes                  ) ;
	expect(invalid.footprints["invalid.py"]).toMatchObject({ b: 14, l: 1, s: null }) ;
	expect(invalid.footprints["invalid.ts"]).toMatchObject({ b: 10, l: 1 }         ) ;
	writeFileSync(join(root, "valid.py"), "a = 1\n");
	const originalPath = process.env.PATH;
	let missing;
	try {
		process.env.PATH = root;
		missing = captureLifecycleBaseline(root, snapshot(root));
	} finally {
		if (originalPath === undefined) delete process.env.PATH;
		else process.env.PATH = originalPath;
	}
	expect(missing.footprints["valid.py"]).toMatchObject({ b: 6, l: 1, s: null });
	writeFileSync(join(root, "valid.py"), "a   = 1\n");
	expect(compareBaselineFootprints(root, missing, snapshot(root)).files.find(file => file.file === "valid.py")?.change).toBe("unknown");
});

test("optional footprint races do not prevent the original hash baseline", () => {
	const { root } = project();
	writeFileSync(join(root, "a.py"), "a = 1\n");
	const hashes = snapshot(root);
	writeFileSync(join(root, "a.py"), "a = 2\n");
	const baseline = captureLifecycleBaseline(root, hashes);
	expect(baselineHashes(baseline)                                                  ).toEqual(hashes   ) ;
	expect(baseline.footprints                                                       ).toEqual({}       ) ;
	expect(compareBaselineFootprints(root, baseline, snapshot(root)).files[0]?.change).toBe   ("unknown") ;
});

test("one Python batch preserves valid neighbors around an invalid source", () => {
	const { root } = project();
	writeFileSync(join(root, "a.py"), "first = 'a b'\n");
	writeFileSync(join(root, "b.py"), "def invalid(:\n");
	writeFileSync(join(root, "c.py"), "last = f'{1 + 2}'\n");
	const baseline = captureLifecycleBaseline(root, snapshot(root));
	expect(baseline.footprints["a.py"]?.s).toMatch(/^[a-f0-9]{64}$/u);
	expect(baseline.footprints["b.py"]?.s).toBeNull();
	expect(baseline.footprints["c.py"]?.s).toMatch(/^[a-f0-9]{64}$/u);
	expect(Object.keys(baseline.footprints)).toHaveLength(3);
});

describe("monitor report service", () => {
	test("monitor report destination refuses non-HTML baseline and receipt files without changing evidence", () => {
		const { root, data } = project();
		const report   = buildMonitorReport({ root, host: "codex", pluginData: data, recordPaths: [] }) ;
		const state    = sessionFolder     (root, data, "protected-session"                           ) ;
		const baseline = json              (captureLifecycleBaseline(root, snapshot(root))            ) ;
		const destinations = [
			[join(state, "baseline.json"), baseline],
			[join(state, "receipt.json"), json({ event: "PostToolUse", state: "NO_CHANGES", at: "2026-11-09T00:00:00Z", files: [], results: [] })],
			[join(data, "settings.json"), json({ setting: true })],
		] as const;

		for (const [path, contents] of destinations) {
			writeFileSync(path, contents, { mode: 0o600 });

			const before = lstatSync(path);

			expect(() => writeMonitorReport(report, { root, pluginData: data, path })).toThrow(".html"    ) ;
			expect(readFileSync(path, "utf8")                                        ).toBe   (contents   ) ;
			expect(lstatSync(path).ino                                               ).toBe   (before.ino ) ;
			expect(lstatSync(path).mode                                              ).toBe   (before.mode) ;
		}

		expect(decodeLifecycleBaseline(JSON.parse(readFileSync(join(state, "baseline.json"), "utf8"))).hashes).toEqual(snapshot(root));
	});

	test.each([
		["lowercase", "hooks/session/monitor.html"],
		["uppercase", "HOOKS/session/monitor.html"],
		["mixed case", "HoOkS/session/monitor.HTML"],
		["normalized", "reports/../hooks/session/monitor.html"],
	])("monitor report destination refuses the %s hook namespace before creating a report", (_name, target) => {
		const { root, data } = project();
		const report = buildMonitorReport({ root, host: "codex", pluginData: data, recordPaths: [] }) ;
		const path   = join              (data, target                                              ) ;

		expect(() => writeMonitorReport(report, { root, pluginData: data, path })).toThrow("hook evidence") ;
		expect(existsSync(path)                                                  ).toBe   (false          ) ;
		expect(snapshot(root)                                                    ).toEqual({}             ) ;
	});

	test("monitor report destination allows an uppercase HTML extension outside hook evidence", () => {
		const { root, data } = project();
		const report = buildMonitorReport({ root, host: "codex", pluginData: data, recordPaths: [] }) ;
		const path   = join              (data, "reports", "monitor.HTML"                           ) ;

		expect(writeMonitorReport(report, { root, pluginData: data, path })).toBe(path);
		expect(readFileSync(path, "utf8")).toStartWith("<!doctype html>");
	});

	test("allows unowned ancestor aliases while keeping report output inside canonical plugin data", () => {
		const { folder, root, data } = project();
		const alias = join(folder, "ancestor-alias");
		symlinkSync(folder, alias, "dir");
		const suppliedData = join              (alias, "data"                                                                                  ) ;
		const suppliedRoot = join              (alias, "project"                                                                               ) ;
		const report       = buildMonitorReport({ root: suppliedRoot, pluginData: suppliedData, host: "codex", recordPaths: [] }               ) ;
		const page         = writeMonitorReport(report, { root, pluginData: suppliedData, path: join(suppliedData, "reports", "monitor.html") }) ;
		expect(report.sessions ).toEqual([]                                   ) ;
		expect(page            ).toBe   (join(data, "reports", "monitor.html")) ;
		expect(existsSync(page)).toBe   (true                                 ) ;
		expect(snapshot(root)  ).toEqual({}                                   ) ;
	});

	test("canonicalizes project ancestor aliases before rejecting project-local data without creating it", () => {
		const { folder, root, data } = project();
		const alias = join(folder, "ancestor-alias");
		symlinkSync(folder, alias, "dir");
		const projectData = join(alias, "project", "forbidden-data");
		expect(() => buildMonitorReport({ root, pluginData: projectData, host: "codex", recordPaths: [] })).toThrow("outside the project");
		expect(existsSync(join(root, "forbidden-data"))).toBe(false);
		const projectLink = join(folder, "project-link");
		symlinkSync(root, projectLink, "dir");
		expect(() => buildMonitorReport({ root: projectLink, pluginData: data, host: "codex", recordPaths: [] })).toThrow("Unsafe monitor project");
	});

	test("rejects links in owned hook and report components after allowing external ancestor aliases", () => {
		const { folder, root, data } = project();
		const report   = buildMonitorReport({ root, pluginData: data, host: "codex", recordPaths: [] }) ;
		const external = join              (folder, "external"                                        ) ;
		mkdirSync(external);
		symlinkSync(external, join(data, "reports"), "dir");
		expect(() => writeMonitorReport(report, { root, pluginData: data, path: join(data, "reports", "monitor.html") })).toThrow("Unsafe monitor data");
		expect(existsSync(join(external, "monitor.html"))).toBe(false);
		symlinkSync(external, join(data, "hooks"), "dir");
		expect(() => buildMonitorReport({ root, pluginData: data, host: "codex", recordPaths: [] })).toThrow("Unsafe monitor data");
	});
	test("discovers both hosts from project-owned metadata in isolated homes", () => {
		const { folder, root, data } = project();
		const claudeFolder = join(folder, ".claude", "projects", "project-slug"   ) ;
		const codexFolder  = join(folder, ".codex", "sessions", "2026", "11", "09") ;
		mkdirSync(claudeFolder, { recursive: true });
		mkdirSync(codexFolder, { recursive: true });
		writeFileSync(join(claudeFolder, "session.jsonl"), claude(root));
		writeFileSync(join(codexFolder, "rollout.jsonl"), [
			json({ type: "session_meta", payload: { id: "codex-1", cwd: root } }),
			json({ type: "turn_context", payload: { model: "gpt-test", effort: "medium" } }),
			codexUsage(50, 10, 12),
		].join("\n"));
		const claudeReport = buildMonitorReport({ root, pluginData: data, host: "claude", home: folder }) ;
		const codexReport  = buildMonitorReport({ root, pluginData: data, host: "codex", home: folder } ) ;
		expect(claudeReport.sessions[0]?.id).toBe         ("session-1"                             ) ;
		expect(codexReport.sessions[0]?.id ).toBe         ("codex-1"                               ) ;
		expect(codexReport.totals          ).toMatchObject({ input: 40, cacheRead: 10, output: 12 }) ;
	});
	test("combines usage, exact footprints and sanitized current/legacy receipts without source writes", () => {
		const { folder, root, data } = project();
		writeFileSync(join(root, "a.ts"), "const a = 1;\n");
		const state = sessionFolder(root, data, "session-1");
		writeFileSync(join(state, "baseline.json"), json(captureLifecycleBaseline(root, snapshot(root))));
		writeFileSync(join(root, "a.ts"), "const a   = 1;\n");
		const transcript = join(folder, "session.jsonl");
		writeFileSync(transcript, [claude(root, "session-1", [{ type: "text", text: SECRET }, { type: "tool_use", name: "Bash", id: "call-1", input: { command: `boxbox format --file a.ts # ${SECRET}` } }]), json({ type: "user", message: { content: SECRET } })].join("\n"));
		const result = {
			file     : "a.ts"                                                           ,
			language : "typescript"                                                     ,
			mode     : "check"                                                          ,
			groups   : [{ before: SECRET }]                                             ,
			summary  : { groups: 1, misaligned: 0, refused: 0, edits: 0, suggested: 0 } ,
			parse    : { status: "ok", tool: SECRET }                                   ,
		};
		const legacy = {
			event                 : "Stop"                     ,
			state                 : "PASS"                     ,
			files                 : ["a.ts"]                   ,
			checked               : [{ file: "a.ts", result }] ,
			unsupported           : []                         ,
			at                    : "2026-11-09T00:00:00.000Z" ,
			tool                  : SECRET                     ,
			automaticFixPerformed : false                      ,
		};
		const current = {
			...legacy,
			schemaVersion : 1  ,
			deleted       : [] ,
			coverage      : {
				changedFiles     : 1 ,
				checkedFiles     : 1 ,
				unsupportedFiles : 0 ,
				deletedFiles     : 0 ,
				filesWithGroups  : 1 ,
				groups           : 1 ,
			},
		};
		writeFileSync(join(state, "legacy.json"), json(legacy));
		writeFileSync(join(state, "current.json"), json(current));
		const before = snapshot          (root                                                                 ) ;
		const report = buildMonitorReport({ root, host: "claude", pluginData: data, recordPaths: [transcript] }) ;
		expect(report.sessions                                                   )    .toHaveLength (1                                                      ) ;
		expect(report.sessions[0]?.footprint.files[0]                            )    .toMatchObject({ change: "horizontal-whitespace", whitespaceBytes: 2 }) ;
		expect(report.sessions[0]?.receipts.map(receipt => receipt.legacy).sort())    .toEqual      ([false, true]                                          ) ;
		expect(report.sessions[0]?.usage?.total.output                           )    .toBe         (5                                                      ) ;
		expect(json(report)                                                      ).not.toContain    (SECRET                                                 ) ;
		expect(renderMonitorHtml(report)                                         ).not.toContain    (SECRET                                                 ) ;
		const page = writeMonitorReport(report, { root, pluginData: data });
		expect(page                      ).toBe     (join(data, "monitor-claude.html")) ;
		expect(readFileSync(page, "utf8")).toContain("Whitespace byte delta"          ) ;
		expect(snapshot(root)            ).toEqual  (before                           ) ;
	});

	test("legacy baselines report missing footprint and malformed receipts are counted without exposing errors", () => {
		const { root, data } = project();
		writeFileSync(join(root, "a.py"), "a = 1\n");
		const state = sessionFolder(root, data, "old-session");
		writeFileSync(join(state, "baseline.json"), json(snapshot(root)));
		writeFileSync(join(state, "broken.json"), SECRET);
		const report = buildMonitorReport({ root, host: "codex", pluginData: data, sessionId: "old-session", recordPaths: [] });
		expect(report.sessions[0]).toMatchObject({ footprint: { available: false, files: [], totals: null }, unreadable: 1, usage: null });
		expect(json(report)).not.toContain(SECRET);
	});

	test("selects current-project records only and provides path-free sharing", () => {
		const { folder, root, data } = project();
		const name = "private-file.ts";
		writeFileSync(join(root, name), "const a = 1;\n");
		const state = sessionFolder(root, data, "session-1");
		writeFileSync(join(state, "baseline.json"), json(captureLifecycleBaseline(root, snapshot(root))));
		const accepted = join(folder, "accepted.jsonl") ;
		const excluded = join(folder, "excluded.jsonl") ;
		writeFileSync(accepted, claude(root));
		writeFileSync(excluded, claude(join(folder, "other"), "excluded-session"));
		const report = buildMonitorReport({ root, host: "claude", pluginData: data, noPaths: true, recordPaths: [accepted, excluded] });
		expect(report.sessions                             )    .toHaveLength(1       ) ;
		expect(report.sessions[0]?.footprint.files[0]?.file)    .toBe        ("file-1") ;
		expect(json(report)                                ).not.toContain   (name    ) ;
		expect(json(report)                                ).not.toContain   (root    ) ;
	});

	test("escapes hostile metadata in self-contained HTML without remote resources", () => {
		const { folder, root, data } = project();
		const path = join      (folder, "session.jsonl"                  ) ;
		const line = JSON.parse(claude(root, "<script>alert(1)</script>")) ;
		line.message.model = "<img src=x onerror=alert(1)>";
		writeFileSync(path, json(line));
		const report = buildMonitorReport({ root, host: "claude", pluginData: data, recordPaths: [path] }) ;
		const html   = renderMonitorHtml (report                                                         ) ;
		expect(html)    .toContain("&lt;script&gt;"           ) ;
		expect(html).not.toContain("<script>"                 ) ;
		expect(html).not.toContain("<img src=x"               ) ;
		expect(html).not.toMatch  (/(?:src|href)=["']https?:/u) ;
	});

	test("refuses project output, linked data/report paths and outside overrides without writing", () => {
		const { folder, root, data } = project();
		const report = buildMonitorReport({ root, host: "claude", pluginData: data, recordPaths: [] });
		expect(() => writeMonitorReport(report, { root, pluginData: join(root, "data") })).toThrow("outside the project");
		expect(() => writeMonitorReport(report, { root, pluginData: data, path: join(folder, "outside.html") })).toThrow("inside plugin data");
		symlinkSync(data, join(folder, "linked-data"));
		expect(() => writeMonitorReport(report, { root, pluginData: join(folder, "linked-data") })).toThrow("Unsafe");
		symlinkSync(join(folder, "missing.html"), join(data, "monitor-claude.html"));
		expect(() => writeMonitorReport(report, { root, pluginData: data })).toThrow("Unsafe") ;
		expect(existsSync(join(folder, "outside.html"))                    ).toBe   (false   ) ;
		expect(existsSync(join(folder, "missing.html"))                    ).toBe   (false   ) ;
	});

	test("refuses linked receipt inputs through the existing receipt codec", () => {
		const { folder, data } = project();
		writeFileSync(join(folder, "outside.json"), SECRET);
		symlinkSync(join(folder, "outside.json"), join(data, "receipt.json"));
		expect(() => monitorReceiptSummary(join(data, "receipt.json"))).toThrow("regular file");
	});
});
