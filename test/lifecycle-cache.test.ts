import      { afterEach, expect, test              } from "bun:test"                            ;
import      { createHash                           } from "node:crypto"                         ;
import      { spawnSync                            } from "node:child_process"                  ;
import      {
              existsSync                         ,
              mkdirSync                          ,
              mkdtempSync                        ,
              readFileSync                       ,
              readdirSync                        ,
              rmSync                             ,
              symlinkSync                        ,
              writeFileSync
                                                   } from "node:fs"                             ;
import      { tmpdir                               } from "node:os"                             ;
import      { join                                 } from "node:path"                           ;
import      { pathToFileURL                        } from "node:url"                            ;

import      {
              inspectionCacheKey                 ,
              inspectionDependenciesCurrent      ,
              inspectionFileSystem               ,
              observeInspection                  ,
              readInspectionCache                ,
              writeInspectionCache
                                                   } from "@/common/39_lifecycle-cache.ts"      ;
import type { FileResult                           } from "@/common/24_result-json.ts"          ;
import      { runTypeScriptAlign                   } from "@/typescript/12_align.ts"            ;
import      { loadSourceFile, syntacticDiagnostics } from "@/typescript/15_load-source-file.ts" ;

const roots: string[] = []                                                                                          ;
const cacheModule     = pathToFileURL(join(import.meta.dir, "../product/engine/common/39_lifecycle-cache.ts")).href ;
const hookModule      = pathToFileURL(join(import.meta.dir, "../product/engine/common/27_lifecycle-hook.ts")).href  ;

function workspace(): string {
	const root = mkdtempSync(join(tmpdir(), "boxbox-lifecycle-cache-"));
	roots.push(root);
	return root;
}

function result(file = "sample.ts"): FileResult {
	return {
		file, language: "typescript", mode: "check",
		summary : { groups: 1, misaligned: 0, edits: 0, refused: 1, suggested: 0 }                                                               ,
		groups  : [{ kind: "preservation", startLine: 1, endLine: 1, rows: 1, axes: [], state: "REFUSE", edits: 0, reason: "negative control" }] ,
		parse   : { status: "not-run", tool: "typescript" }                                                                                      ,
	};
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test("cache identity binds root, source path/content, mode and caller context", () => {
	const key = inspectionCacheKey("/a", "sample.ts", "check", "source", "context");
	for (const changed of [
		["/b", "sample.ts", "check", "source", "context"],
		["/a", "other.ts", "check", "source", "context"],
		["/a", "sample.ts", "align", "source", "context"],
		["/a", "sample.ts", "check", "changed", "context"],
		["/a", "sample.ts", "check", "source", "changed"],
	] as const) expect(inspectionCacheKey(changed[0], changed[1], changed[2], changed[3], changed[4])).not.toBe(key);
});

test("observed read, missing file/directory, entry list and realpath changes invalidate reuse", async () => {
	const root = workspace();
	writeFileSync(join(root, "sample.ts"), "const a = 1;\n");
	for (const operation of ["read", "missing-file", "missing-directory", "entries", "realpath"] as const) {
		const probe  = join(root, operation            ) ;
		const target = join(root, `${operation}-target`) ;
		if (operation === "read") writeFileSync(probe, "one");
		if (operation === "entries") mkdirSync(probe);
		if (operation === "realpath") { writeFileSync(target, "one"); symlinkSync(target, probe); }
		const observed = await observeInspection(async () => {
			const fs = inspectionFileSystem(root)!;
			if (operation === "read") fs.readFile(probe);
			if (operation === "missing-file") fs.fileExists(probe);
			if (operation === "missing-directory") fs.directoryExists(probe);
			if (operation === "entries") fs.getAccessibleEntries(probe);
			if (operation === "realpath") fs.realpath(probe);
			return result();
		});
		expect(observed.stable).toBe(true);
		writeInspectionCache(root, "sample.ts", "key", observed);
		expect(readInspectionCache(root, "sample.ts", "key")?.result.summary.refused).toBe(1);
		if (operation === "read") writeFileSync(probe, "two");
		if (operation === "missing-file") writeFileSync(probe, "new");
		if (operation === "missing-directory") mkdirSync(probe);
		if (operation === "entries") writeFileSync(join(probe, "new"), "new");
		if (operation === "realpath") { rmSync(probe); symlinkSync(join(root, "sample.ts"), probe); }
		expect(inspectionDependenciesCurrent(observed.dependencies)).toBe(false);
		expect(readInspectionCache(root, "sample.ts", "key")).toBeNull();
	}
});

test("corrupt, oversized and symlink cache entries are misses without following links", async () => {
	const root     = workspace()                                   ;
	const observed = await observeInspection(async () => result()) ;
	writeInspectionCache(root, "sample.ts", "key", observed);
	const cache = join(root, readdirSync(root).find(name => name.endsWith(".cache"))!);
	writeFileSync(cache, "not JSON");
	expect(readInspectionCache(root, "sample.ts", "key")).toBeNull();
	writeFileSync(cache, "x".repeat(8 * 1024 * 1024 + 1));
	expect(readInspectionCache(root, "sample.ts", "key")).toBeNull();
	rmSync(cache);
	const target = join(root, "private");
	writeFileSync(target, "unchanged");
	symlinkSync(target, cache);
	expect(readInspectionCache(root, "sample.ts", "key")).toBeNull();
	writeInspectionCache(root, "sample.ts", "key", observed);
	expect(readFileSync(target, "utf8")).toBe("unchanged");
});

test("a checksum-valid but inconsistent cached summary is still a miss", async () => {
	const root     = workspace()                                   ;
	const observed = await observeInspection(async () => result()) ;
	writeInspectionCache(root, "sample.ts", "key", observed);
	const path    = join      (root, readdirSync(root).find(name => name.endsWith(".cache"))!) ;
	const encoded = JSON.parse(readFileSync(path, "utf8")                                    ) ;
	const payload = JSON.parse(encoded.payload                                               ) ;
	payload.result.summary.refused = 0                                                          ;
	encoded.payload                = JSON.stringify(payload)                                    ;
	encoded.digest                 = createHash("sha256").update(encoded.payload).digest("hex") ;
	writeFileSync(path, JSON.stringify(encoded));
	expect(readInspectionCache(root, "sample.ts", "key")).toBeNull();
});

test("dependencies changing during inspection are never saved as a stable result", async () => {
	const root = workspace();
	writeFileSync(join(root, "sample.ts"), "one");
	const observed = await observeInspection(async () => {
		inspectionFileSystem(root)!.readFile("sample.ts");
		writeFileSync(join(root, "sample.ts"), "two");
		return result();
	});
	expect(observed.stable).toBe(false);
	writeInspectionCache(root, "sample.ts", "key", observed);
	expect(readInspectionCache(root, "sample.ts", "key")).toBeNull();
});

test("real TypeScript syntax and AST reads observe inherited configs and invalidate external changes", async () => {
	const root    = workspace()                     ;
	const outside = workspace()                     ;
	const base    = join     (outside, "base.json") ;
	writeFileSync(base, JSON.stringify({ compilerOptions: { target: "esnext", noLib: true } }));
	writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ extends: base, files: ["sample.ts"] }));
	writeFileSync(join(root, "sample.ts"), "const a = 1;\n");
	const observed = await observeInspection(async () => {
		const loaded = await loadSourceFile(root, "sample.ts");
		expect(loaded.relative).toBe("sample.ts");
		expect(await syntacticDiagnostics(root, join(root, "sample.ts"), "const a = 1;\n")).toEqual([]);
		return result();
	});
	expect(observed.stable                                                                        ).toBe(true) ;
	expect(observed.dependencies.some(item => item.operation === "readFile" && item.path === base)).toBe(true) ;
	expect(inspectionDependenciesCurrent(observed.dependencies)                                   ).toBe(true) ;
	writeFileSync(base, JSON.stringify({ compilerOptions: { target: "esnext", noLib: true, jsx: "preserve" } }));
	expect(inspectionDependenciesCurrent(observed.dependencies)).toBe(false);
}, 60_000);

test("filesystem observation preserves the ordinary TSX regex and JSX inspection result", async () => {
	const root = workspace()  ;
	const file = "sample.tsx" ;

	const source = "interface Props {\n  text: string;\n  streaming?: boolean;\n  onQuote?: (quote: string) => void;\n  label?: string;\n}\nconst view = <section>{text.replace(/\\n$/, \"\")}<span>Code</span></section>;\n" ;
	writeFileSync(join(root, file), source);
	const ordinarySyntax = await syntacticDiagnostics(root, join(root, file), source);
	const inspect = async (): Promise<FileResult> => {
		let report = "";
		await runTypeScriptAlign(["--file", file, "--json"], { root, emit: value => { report = value; } });
		return JSON.parse(report).results[0];
	};
	const ordinary = await inspect();
	const observed = await observeInspection(async () => {
		expect(await syntacticDiagnostics(root, join(root, file), source)).toEqual(ordinarySyntax);
		return inspect();
	});
	expect(observed.stable                       ).toBe   (true    ) ;
	expect(observed.result                       ).toEqual(ordinary) ;
	expect(readFileSync(join(root, file), "utf8")).toBe   (source  ) ;
}, 60_000);

function customHook(root: string, mode: "session" | "post" | "stop", context: string, race = "") {
	const script = `import {appendFileSync,readFileSync,writeFileSync} from "node:fs";
import {join} from "node:path";
import {lifecycleHook} from ${JSON.stringify(hookModule)};
import {inspectionFileSystem} from ${JSON.stringify(cacheModule)};
const root=process.argv[1];
const inspect=async (_root,file)=>{
 appendFileSync(join(root,".boxbox/count"),"1");
 inspectionFileSystem(root)?.readFile(file);
 inspectionFileSystem(root)?.readFile(".boxbox/proof");
 if(process.env.RACE==="source") writeFileSync(join(root,file),"changed");
 if(process.env.RACE==="context") writeFileSync(join(root,".boxbox/identity"),"changed");
 const report={...${JSON.stringify(result())},file};
 if(process.env.RACE==="transient") {
  const failed=readFileSync(join(root,".boxbox/count"),"utf8").length===1;
  report.groups[0].kind=failed?"syntax-validation-error":"declaration-values";
  report.groups[0].state=failed?"REFUSE":"PASS";
  report.summary.refused=failed?1:0;
  report.parse.status=failed?"skipped":"not-run";
 }
 return report;
};
await lifecycleHook([process.argv[2],"--root",root],inspect,{inspectionContext:()=>{appendFileSync(join(root,".boxbox/context-count"),"1");if(process.env.IDENTITY==="throws") throw new Error("identity unavailable");return process.env.IDENTITY==="disabled"?null:readFileSync(join(root,".boxbox/identity"),"utf8");}});`;
	const run = spawnSync(process.execPath, ["-e", script, root, mode], {
		input: JSON.stringify({ session_id: "cache", tool_name: "Write" }), encoding: "utf8",
		env: { ...process.env, BOXBOX_MODE: "check", BOXBOX_UPDATE_CHECK: "0", CLAUDE_PLUGIN_DATA: "", PLUGIN_DATA: "", CLAUDE_PROJECT_DIR: "", IDENTITY: context, RACE: race },
	});
	expect(run.status).toBe(0);
	return JSON.parse(run.stdout);
}

function latestStats(root: string) {
	const directory = join(root, ".boxbox/hooks", createHash("sha256").update("cache").digest("hex"))         ;
	const path      = readdirSync(directory).filter(name => name.endsWith(".json.inspection")).sort().at(-1)! ;
	return JSON.parse(readFileSync(join(directory, path), "utf8"));
}

test("PostToolUse reuses unchanged failures, invalidates content/context/proof, and Stop always reinspects", () => {
	const root = workspace();
	mkdirSync(join(root, ".boxbox"));
	writeFileSync(join(root, ".boxbox/identity"), "one");
	writeFileSync(join(root, ".boxbox/proof"), "one");
	customHook(root, "session", "enabled");
	writeFileSync(join(root, "sample.ts"), "const a = 1;\n");
	expect(customHook(root, "post", "enabled").decision).toBe         ("block"                         ) ;
	expect(latestStats(root)                           ).toMatchObject({ cacheHits: 0, inspections: 1 }) ;
	expect(customHook(root, "post", "enabled")         ).toEqual      ({}                              ) ;
	expect(latestStats(root)                           ).toMatchObject({ cacheHits: 1, inspections: 0 }) ;
	const directory = join(root, ".boxbox/hooks", createHash("sha256").update("cache").digest("hex")) ;
	const cache     = join(directory, readdirSync(directory).find(name => name.endsWith(".cache"))! ) ;
	writeFileSync(cache, "corrupt");
	customHook(root, "post", "enabled");
	expect(latestStats(root)).toMatchObject({ cacheHits: 0, inspections: 1 });
	writeFileSync(join(root, "sample.ts"), "const b = 2;\n");
	customHook(root, "post", "enabled");
	expect(latestStats(root)).toMatchObject({ cacheHits: 0, inspections: 1 });
	writeFileSync(join(root, ".boxbox/identity"), "two");
	customHook(root, "post", "enabled");
	expect(latestStats(root)).toMatchObject({ cacheHits: 0, inspections: 1 });
	writeFileSync(join(root, ".boxbox/proof"), "two");
	customHook(root, "post", "enabled");
	expect(latestStats(root)                           ).toMatchObject({ cacheHits: 0, inspections: 1 }) ;
	expect(customHook(root, "stop", "enabled").decision).toBe         ("block"                         ) ;
	expect(latestStats(root)                           ).toMatchObject({ cacheHits: 0, inspections: 1 }) ;
	customHook(root, "post", "disabled");
	expect(latestStats(root)                                        ).toMatchObject({ cacheHits: 0, inspections: 1 }) ;
	expect(readFileSync(join(root, ".boxbox/count"), "utf8")        ).toBe         ("1111111"                       ) ;
	expect(readFileSync(join(root, ".boxbox/context-count"), "utf8")).toHaveLength (13                              ) ;
}, 60_000);

test("context identity is read twice per hook rather than twice per changed file", () => {
	const root = workspace();
	mkdirSync(join(root, ".boxbox"));
	writeFileSync(join(root, ".boxbox/identity"), "one");
	writeFileSync(join(root, ".boxbox/proof"), "one");
	customHook(root, "session", "enabled");
	writeFileSync(join(root, "sample.ts"), "const a = 1;\n");
	writeFileSync(join(root, "second.ts"), "const b = 2;\n");
	customHook(root, "post", "enabled");
	expect(latestStats(root)).toMatchObject({ cacheHits: 0, cacheMisses: 2, inspections: 2 });
	expect(readFileSync(join(root, ".boxbox/context-count"), "utf8")).toBe("11");
	customHook(root, "post", "enabled");
	expect(latestStats(root)).toMatchObject({ cacheHits: 2, cacheMisses: 0, inspections: 0 });
	expect(readFileSync(join(root, ".boxbox/context-count"), "utf8")).toBe("1111");
}, 60_000);

for (const race of ["source", "context"] as const) test(`a ${race} race cannot yield a cached pass or normal receipt`, () => {
	const root = workspace();
	mkdirSync(join(root, ".boxbox"));
	writeFileSync(join(root, ".boxbox/identity"), "one");
	writeFileSync(join(root, ".boxbox/proof"), "one");
	customHook(root, "session", "enabled");
	writeFileSync(join(root, "sample.ts"), "const a = 1;\n");
	const output = customHook(root, "post", "enabled", race);
	expect(JSON.stringify(output)).toContain("changed during check");
	expect(output.decision).toBeUndefined();
}, 60_000);


function configuredAlignHook(root: string, mode: "session" | "post" | "stop", interfere = "") {
	const base = join(import.meta.dir, "../product/engine");
	const script = `
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lifecycleHook } from ${JSON.stringify(hookModule)};
import { inspectionFileSystem } from ${JSON.stringify(cacheModule)};
import { syntacticDiagnostics } from ${JSON.stringify(pathToFileURL(join(base, "typescript/15_load-source-file.ts")).href)};
import { runTypeScriptAlign } from ${JSON.stringify(pathToFileURL(join(base, "typescript/12_align.ts")).href)};
import { alignApprovedHook } from ${JSON.stringify(pathToFileURL(join(base, "00_cli.ts")).href)};
const root = process.argv[1];
await lifecycleHook([process.argv[2], "--root", root], async (_root, file) => {
 appendFileSync(join(root, ".boxbox/count"), file + "\\n");
 inspectionFileSystem(root)?.readFile(".boxbox/auxiliary");
 const syntax = await syntacticDiagnostics(root, join(root,file), readFileSync(join(root,file),"utf8"));
 if(syntax.length) throw new Error("syntactic failure");
 let report="";
 await runTypeScriptAlign(["--file",file,"--json"],{root,emit:value=>report=value});
 return JSON.parse(report).results[0];
}, {
 inspectionContext: () => "configured-project-test",
 align: async (_root,file) => {
  const result = await alignApprovedHook(root,file);
  if(process.env.INTERFERE==="source" && file==="first.ts") writeFileSync(join(root,"second.ts"),"const external = true;\\n");
  if(process.env.INTERFERE==="dependency" && file==="second.ts") writeFileSync(join(root,".boxbox/auxiliary"),"changed");
  return result;
 }
});`;
	const run = spawnSync(process.execPath, ["-e", script, root, mode], {
		input: JSON.stringify({ session_id: "cache", tool_name: "Write" }), encoding: "utf8",
		env: { ...process.env, BOXBOX_MODE: "align", BOXBOX_UPDATE_CHECK: "0", XDG_CONFIG_HOME: join(root, ".boxbox/config-home"), CLAUDE_PLUGIN_DATA: "", PLUGIN_DATA: "", CLAUDE_PROJECT_DIR: "", INTERFERE: interfere },
	});
	expect(run.status).toBe(0);
	return JSON.parse(run.stdout);
}

function configuredAlignProject(): string {
	const root = workspace();
	mkdirSync(join(root, ".boxbox"));
	writeFileSync(join(root, ".boxbox/auxiliary"), "one");
	writeFileSync(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { noLib: true }, files: ["first.ts", "second.ts"] }));
	configuredAlignHook(root, "session");
	for (const file of ["first.ts", "second.ts"]) writeFileSync(join(root, file), "const a=1;\nconst longer=2;\nconst third=3;\n");
	return root;
}

test("approved multi-file project alignment refreshes only its owned stale AST reads before cache publication", () => {
	const root   = configuredAlignProject()             ;
	const output = configuredAlignHook   (root, "post") ;
	expect(JSON.stringify(output)).not.toContain    ("hook error"                                    ) ;
	expect(JSON.stringify(output))    .toContain    ("PostToolUse: PASS"                             ) ;
	expect(JSON.stringify(output))    .toContain    ("Aligned first.ts"                              ) ;
	expect(JSON.stringify(output))    .toContain    ("second.ts"                                     ) ;
	expect(latestStats(root)     )    .toMatchObject({ cacheHits: 0, cacheMisses: 2, inspections: 6 }) ;
	const canonical = ["first.ts", "second.ts"].map(file => readFileSync(join(root, file), "utf8"));
	configuredAlignHook(root, "post");
	expect(latestStats(root)).toMatchObject({ cacheHits: 2, cacheMisses: 0, inspections: 0 });
	const stopped = configuredAlignHook(root, "stop");
	expect(JSON.stringify(stopped)                                                      ).not.toContain    ("hook error"                                    ) ;
	expect(latestStats(root)                                                            )    .toMatchObject({ cacheHits: 0, cacheMisses: 0, inspections: 2 }) ;
	expect(["first.ts", "second.ts"].map(file => readFileSync(join(root, file), "utf8")))    .toEqual      (canonical                                       ) ;
}, 60_000);

for (const interfere of ["source", "dependency"] as const) test(`multi-file alignment keeps completed writes visible and refuses an unowned ${interfere} change`, () => {
	const root   = configuredAlignProject()                        ;
	const output = configuredAlignHook   (root, "post", interfere) ;
	expect(JSON.stringify(output)).toContain("hook error");
	expect(JSON.stringify(output)).toContain("Aligned first.ts");
	if (interfere === "source") {
		expect(JSON.stringify(output)).toContain("Source changed before alignment");
		expect(readFileSync(join(root, "second.ts"), "utf8")).toBe("const external = true;\n");
	} else {
		expect(JSON.stringify(output)).toContain("Inspection dependencies changed during check");
		expect(readFileSync(join(root, ".boxbox/auxiliary"), "utf8")).toBe("changed");
	}
}, 60_000);


test("Stop ignores an unavailable context provider and reinspects even when context files change", () => {
	const root = workspace();
	mkdirSync(join(root, ".boxbox"));
	writeFileSync(join(root, ".boxbox/identity"), "one");
	writeFileSync(join(root, ".boxbox/proof"), "one");
	customHook(root, "session", "enabled");
	writeFileSync(join(root, "sample.ts"), "const a = 1;\n");
	const unavailable = customHook(root, "stop", "throws");
	expect(JSON.stringify(unavailable)                    ).not.toContain    ("hook error"                                    ) ;
	expect(JSON.stringify(unavailable)                    )    .toContain    ("Stop: FAIL"                                    ) ;
	expect(latestStats(root)                              )    .toMatchObject({ cacheHits: 0, cacheMisses: 0, inspections: 1 }) ;
	expect(existsSync(join(root, ".boxbox/context-count")))    .toBe         (false                                           ) ;
	const changing = customHook(root, "stop", "enabled", "context");
	expect(JSON.stringify(changing)                       ).not.toContain    ("hook error"                                    ) ;
	expect(JSON.stringify(changing)                       )    .toContain    ("Stop: FAIL"                                    ) ;
	expect(latestStats(root)                              )    .toMatchObject({ cacheHits: 0, cacheMisses: 0, inspections: 1 }) ;
	expect(existsSync(join(root, ".boxbox/context-count")))    .toBe         (false                                           ) ;
}, 60_000);

test("a directory observation above its bound delegates unchanged parser behavior and disables reuse", async () => {
	const root = workspace();
	for (let index = 0; index < 4097; index++) writeFileSync(join(root, `${index}.txt`), "");
	const observed = await observeInspection(async () => {
		expect(inspectionFileSystem(root)!.getAccessibleEntries(root)).toBeUndefined();
		return result();
	});
	expect(observed.stable).toBe(false);
	writeInspectionCache(root, "sample.ts", "key", observed);
	expect(readInspectionCache(root, "sample.ts", "key")).toBeNull();
});

test("filesystem observation preserves native TypeScript BOM and CRLF interpretation", async () => {
	const root   = workspace()                                                 ;
	const file   = "sample.ts"                                                 ;
	const source = "\uFEFFconst a=1;\r\nconst longer=2;\r\nconst third=3;\r\n" ;
	writeFileSync(join(root, file), source);
	const syntax = await syntacticDiagnostics(root, join(root, file), source);
	const inspect = async (): Promise<FileResult> => {
		let report = "";
		await runTypeScriptAlign(["--file", file, "--json"], { root, emit: value => { report = value; } });
		return JSON.parse(report).results[0];
	};
	const ordinary = await inspect();
	const observed = await observeInspection(async () => {
		expect(await syntacticDiagnostics(root, join(root, file), source)).toEqual(syntax);
		return inspect();
	});
	expect(observed.stable                       ).toBe   (false   ) ;
	expect(observed.result                       ).toEqual(ordinary) ;
	expect(readFileSync(join(root, file), "utf8")).toBe   (source  ) ;
}, 60_000);


test("transient parser execution errors are not stored or replayed from an older checksummed cache", async () => {
	const root                  = workspace()                                                                                                                          ;
	const failed                = result()                                                                                                                             ;
	const transient: FileResult = { ...failed, groups: [{ ...failed.groups[0]!, kind: "syntax-validation-error" }], parse: { status: "skipped", tool: "typescript" } } ;
	const observed              = await observeInspection(async () => transient)                                                                                       ;
	writeInspectionCache(root, "sample.ts", "key", observed);
	expect(readdirSync(root).filter(name => name.endsWith(".cache"))).toEqual([]);
	const payload = JSON.stringify({ schemaVersion: 1, key: "key", result: transient, dependencies: [] }             ) ;
	const path    = join          (root, `inspection-${createHash("sha256").update("sample.ts").digest("hex")}.cache`) ;
	writeFileSync(path, JSON.stringify({ payload, digest: createHash("sha256").update(payload).digest("hex") }));
	expect(readInspectionCache(root, "sample.ts", "key")).toBeNull();
	for (const kind of ["preservation", "syntax"]) {
		const deterministic: FileResult = { ...transient, groups: [{ ...transient.groups[0]!, kind }] } ;
		const stable                    = await observeInspection(async () => deterministic)            ;
		writeInspectionCache(root, "sample.ts", "key", stable);
		expect(readInspectionCache(root, "sample.ts", "key")?.result.groups[0]?.kind).toBe(kind);
	}
});

test("an unchanged post reinspects after transient tool failure and caches the recovered healthy result", () => {
	const root = workspace();
	mkdirSync(join(root, ".boxbox"));
	writeFileSync(join(root, ".boxbox/identity"), "one");
	writeFileSync(join(root, ".boxbox/proof"), "one");
	customHook(root, "session", "enabled");
	const source = "const a      =1 ;\nconst longer =2 ;\nconst third  =3 ;\n";
	writeFileSync(join(root, "sample.ts"), source);
	const first = customHook(root, "post", "enabled", "transient");
	expect(JSON.stringify(first)).toContain("PostToolUse: FAIL");
	expect(latestStats(root)).toMatchObject({ cacheHits: 0, cacheMisses: 1, inspections: 1 });
	const recovered = customHook(root, "post", "enabled", "transient");
	expect(JSON.stringify(recovered)                        ).toContain    ("PostToolUse: PASS"                             ) ;
	expect(latestStats(root)                                ).toMatchObject({ cacheHits: 0, cacheMisses: 1, inspections: 1 }) ;
	expect(readFileSync(join(root, ".boxbox/count"), "utf8")).toBe         ("11"                                            ) ;
	customHook(root, "post", "enabled", "transient");
	expect(latestStats(root)                                ).toMatchObject({ cacheHits: 1, cacheMisses: 0, inspections: 0 }) ;
	expect(readFileSync(join(root, ".boxbox/count"), "utf8")).toBe         ("11"                                            ) ;
	expect(readFileSync(join(root, "sample.ts"), "utf8")    ).toBe         (source                                          ) ;
}, 60_000);

test("the real approved hook keeps structural PipelineError recovery when another project file aligns", () => {
	const root    = configuredAlignProject()                                                                 ;
	const first   = join(root, "first.ts")                                                                   ;
	const initial = readFileSync(first, "utf8") + "interface Compact { a: string; b: number; c: boolean }\n" ;
	writeFileSync(first, initial);
	const output = configuredAlignHook(root, "post");
	expect(JSON.stringify(output)                       ).not.toContain("hook error"                                   ) ;
	expect(JSON.stringify(output)                       )    .toContain("[structural-prerequisite]"                    ) ;
	expect(JSON.stringify(output)                       )    .toContain("Write/Refactor"                               ) ;
	expect(JSON.stringify(output)                       )    .toContain("owner=agent"                                  ) ;
	expect(JSON.stringify(output)                       )    .toContain("Aligned second.ts"                            ) ;
	expect(readFileSync(first, "utf8")                  )    .toBe     (initial                                        ) ;
	expect(readFileSync(join(root, "second.ts"), "utf8")).not.toBe     ("const a=1;\nconst longer=2;\nconst third=3;\n") ;
}, 60_000);
