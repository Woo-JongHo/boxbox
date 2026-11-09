import      { expect, test               } from "bun:test"                       ;
import      {
              chmodSync                ,
              mkdtempSync              ,
              readFileSync             ,
              rmSync                   ,
              writeFileSync
                                         } from "node:fs"                        ;
import      { tmpdir                     } from "node:os"                        ;
import      { join, resolve              } from "node:path"                      ;
import      { alignSource                } from "@/common/06_table-engine.ts"    ;
import      { runAlignCli                } from "@/common/22_align-cli.ts"       ;
import      { lookupKeyOf                } from "@/common/02_signature.ts"       ;
import      { PYTHON_ALIGNER             } from "@/python/03_profile.ts"         ;
import      { analyzePython              } from "@/python/05_analysis.ts"        ;
import      {
              describePythonGroup      ,
              PYTHON_AXIS_NOTES        ,
              PYTHON_COLUMN_SETS       ,
              PYTHON_UNSUPPORTED_KINDS
                                         } from "@/python/08_kind-vocabulary.ts" ;
import      { loadApprovalRegistry       } from "@/common/18_approval-gate.ts"   ;
import      { comparePythonStructure     } from "@/common/08_parse-check.ts"     ;
import      { changedLines               } from "@/common/09_preservation.ts"    ;
import      { patternOf                  } from "@/common/03_surface.ts"         ;

const fixture        = join(import.meta.dir, "fixtures/python/kinds.py")                                                                                                   ;
const source         = readFileSync(fixture, "utf8")                                                                                                                       ;
const align          = (input: string) => alignSource(input, PYTHON_ALIGNER, { minRows: 3, apply: true })                                                                  ;
const withoutDisplay = (value: unknown): unknown => JSON.parse(JSON.stringify(value, (key, item) => key === "semanticKind" || key === "sourceContext" ? undefined : item)) ;

test.each(["\n", "\r\n"])("bounded from-import and return-guard tables preserve %j", ending => {
	const input  = readFileSync(join(import.meta.dir, "fixtures/python/bounded-import-guards.py"), "utf8").replaceAll("\n", ending) ;
	const result = align(input)                                                                                                     ;
	expect(result.details.map(group => [group.semanticKind, group.sourceContext, group.axes])).toEqual([
		["import-from", "Module", ["from", "module", "import", "names"]],
		["return-guards", "FunctionDef", ["if", "condition", "colon", "return", "value"]],
	]);
	expect(result.output                                                   ).toBe        ('from pathlib import Path\nfrom os      import path as os_path\nfrom math    import floor, ceil as up\n\ndef sign(value):\n    if value<0    : return "negative"\n    if value == 0 : return "zero"\n    if value>0    : return "positive"\n    return "fallthrough"\n'.replaceAll("\n", ending)) ;
	expect(changedLines(input, result.output, PYTHON_ALIGNER.syntax)       ).toEqual     ([]                                                                                                                                                                                                                                                                                              ) ;
	expect(comparePythonStructure(input, result.output).status             ).toBe        ("ok"                                                                                                                                                                                                                                                                                            ) ;
	expect(align(result.output).output                                     ).toBe        (result.output                                                                                                                                                                                                                                                                                   ) ;
	expect(result.output.split("\n")                                       ).toHaveLength(input.split("\n").length                                                                                                                                                                                                                                                                        ) ;
	expect(result.details.map(group => patternOf("python", group)?.pattern)).toEqual     (["IMPORT", "WHEN"]                                                                                                                                                                                                                                                                              ) ;
});

test("bounded imports preserve relative modules, aliases and opaque names", () => {
	const input  = "from .short import thing as alias\nfrom ..longer.module import first, second as other\nfrom ...module import final\n" ;
	const result = align(input)                                                                                                           ;
	expect(result.details[0]                                                                        ).toMatchObject({ semanticKind: "import-from", rows: 3 }                ) ;
	expect(result.output.split("\n").slice(0, 3).map(line => line.slice(line.indexOf("import") + 6))).toEqual      ([" thing as alias", " first, second as other", " final"]) ;
	expect(comparePythonStructure(input, result.output).status                                      ).toBe         ("ok"                                                    ) ;
	expect(changedLines(input, result.output, PYTHON_ALIGNER.syntax)                                ).toEqual      ([]                                                      ) ;
});

test.each([
	{ name : "parenthesized imports"     , input : "from x import (a,)\nfrom yy import (b,)\nfrom z import (c,)\n"                                                               , kind : "import-from"   },
	{ name : "multiline imports"         , input : "from x import (\n a,\n)\nfrom yy import (\n b,\n)\nfrom z import (\n c,\n)\n"                                                , kind : "import-from"   },
	{ name : "same-line sibling imports" , input : "from x import a; from y import b\nfrom z import c; from q import d\nfrom e import f; from g import h\n"                      , kind : "import-from"   },
	{ name : "multiline guards"          , input : "def f(a):\n if a:\n  return 1\n if a == 2:\n  return 2\n if a == 3:\n  return 3\n"                                           , kind : "return-guards" },
	{ name : "guard else branches"       , input : "def f(a):\n if a: return 1\n else: return 2\n if a == 2: return 2\n else: return 3\n if a == 3: return 3\n else: return 4\n" , kind : "return-guards" },
	{ name : "bare returns"              , input : "def f(a):\n if a: return\n if a == 2: return\n if a == 3: return\n"                                                          , kind : "return-guards" },
	{ name : "extra guard statements"    , input : "def f(a):\n if a: return 1; trace()\n if a == 2: return 2; trace()\n if a == 3: return 3; trace()\n"                         , kind : "return-guards" },
])("unsupported $name stay visible without speculative edits", ({ input, kind }) => {
	const result = align(input);
	expect(result.details.filter(group => group.semanticKind === kind)).toEqual               ([]   ) ;
	expect(result.output                                              ).toBe                  (input) ;
	expect((result.unsupported ?? []).length                          ).toBeGreaterThanOrEqual(3    ) ;
});

test("guard ownership and paragraph boundaries prevent a three-row table across functions", () => {
	const input  = "def first(a):\n if a: return 1\n if a == 2: return 2\n\ndef second(a):\n if a: return 1\n if a == 2: return 2\n" ;
	const result = align(input)                                                                                                      ;
	expect(result.details                                             ).toEqual([]                                          ) ;
	expect(result.pairs.map(group => [group.semanticKind, group.rows])).toEqual([["return-guards", 2], ["return-guards", 2]]) ;
	expect(result.output                                              ).toBe   (input                                       ) ;
});

test("from-import rows cannot cross paragraphs or independent class owners", () => {
	const paragraph = align("from a import x\nfrom bb import y\n\nfrom c import z\n")                                                  ;
	const classes   = align("class First:\n from a import x\n from bb import y\nclass Second:\n from c import z\n from dd import q\n") ;
	expect(paragraph.details                                                                ).toEqual([]                                                              ) ;
	expect(paragraph.pairs.map(group => [group.semanticKind, group.rows])                   ).toEqual([["import-from", 2]]                                            ) ;
	expect(paragraph.unsupported?.map(row => row.line)                                      ).toEqual([4]                                                             ) ;
	expect(classes.details                                                                  ).toEqual([]                                                              ) ;
	expect(classes.pairs.map(group => [group.semanticKind, group.sourceContext, group.rows])).toEqual([["import-from", "ClassDef", 2], ["import-from", "ClassDef", 2]]) ;
});

test("new bounded tables preserve CRLF, comments, opaque punctuation and execution", () => {
	const input  = 'def sign(value):\r\n    if (value<0): return "negative: return" # first  \r\n    if value == 0: return ("zero") # second  \r\n    if value>0: return "positive" # third  \r\n' ;
	const result = align(input)                                                                                                                                                                    ;
	expect(result.details[0]?.semanticKind                          ).toBe        ("return-guards"           ) ;
	expect(changedLines(input, result.output, PYTHON_ALIGNER.syntax)).toEqual     ([]                        ) ;
	expect(comparePythonStructure(input, result.output).status      ).toBe        ("ok"                      ) ;
	expect(align(result.output).output                              ).toBe        (result.output             ) ;
	expect(result.output.split("\r\n")                              ).toHaveLength(input.split("\r\n").length) ;
	const program = "import json,sys\nresults=[]\nfor source in json.load(sys.stdin):\n scope={}\n exec(source,scope)\n results.append([scope['sign'](value) for value in [-1,0,1]])\nassert results[0] == results[1]\nprint('same')" ;
	const run     = Bun.spawnSync(["python3", "-I", "-c", program], { stdin: Buffer.from(JSON.stringify([input, result.output])), stdout: "pipe", stderr: "pipe" })                                                                   ;
	expect(run.exitCode, run.stderr.toString()).toBe(0);
	expect(run.stdout.toString().trim()).toBe("same");
});

test("raw writes prove preservation while public previews deny the unapproved detector axes", () => {
	const root = mkdtempSync(join(tmpdir(), "boxbox-bounded-detectors-"));
	try {
		const combined = readFileSync(join(import.meta.dir, "fixtures/python/bounded-import-guards.py"), "utf8") ;
		const target   = join        (root, "sample.py"                                                        ) ;
		const cli      = resolve     ("product/packages/cli/entry.ts"                                          ) ;
		for (const input of [combined, combined.split("\n").slice(0, 3).join("\n") + "\n", combined.split("\n").slice(4).join("\n")]) {
			writeFileSync(target, input);
			const denied = Bun.spawnSync([process.execPath, cli, "align", "--file", "sample.py", "--dry-run", "--json"], { cwd: root, env: { ...process.env, XDG_CONFIG_HOME: join(root, "config") }, stdout: "pipe", stderr: "pipe" });
			expect(denied.exitCode, denied.stderr.toString()).toBe(2);
			expect(JSON.parse(denied.stdout.toString()).error.code).toBe("ALIGN_NOT_ELIGIBLE");
			expect(readFileSync(target, "utf8")).toBe(input);
			const written = runAlignCli(PYTHON_ALIGNER, ["--file", target, "--write", "--json"]);
			expect(written.code, written.report).toBe(0);
			expect(JSON.parse(written.report).results[0].parse.status).toBe("ok");
			expect(readFileSync(target, "utf8")).toBe(align(input).output);
			const beforeSecond = readFileSync(target);
			expect(runAlignCli(PYTHON_ALIGNER, ["--file", target, "--write", "--json"]).code).toBe   (0           ) ;
			expect(readFileSync(target)                                                     ).toEqual(beforeSecond) ;
			expect(comparePythonStructure(input, readFileSync(target, "utf8")).status       ).toBe   ("ok"        ) ;
		}
	} finally { rmSync(root, { recursive: true, force: true }); }
});

test("new source intervals preserve non-ASCII UTF-16 offsets and quoted keyword punctuation", () => {
	const input  = 'from p\u00e9riode import a\nfrom longer_module import b as alias\nfrom final import c\n\ndef f(value):\n if value == "return: if": return "\ud83d\ude00"\n if value == "from import": return ("second")\n if value == "other": return "third"\n' ;
	const result = align(input)                                                                                                                                                                                                                                      ;
	expect(result.details.map(group => group.semanticKind)          ).toEqual(["import-from", "return-guards"]) ;
	expect(changedLines(input, result.output, PYTHON_ALIGNER.syntax)).toEqual([]                              ) ;
	expect(comparePythonStructure(input, result.output).status      ).toBe   ("ok"                            ) ;
	expect(align(result.output).output                              ).toBe   (result.output                   ) ;
});

test("a malformed AST slot response cannot become a source profile", () => {
	const root = mkdtempSync(join(tmpdir(), "boxbox-invalid-slots-"));
	try {
		const executable = join(root, "python3")                                                                                                                                                                                                                                                ;
		const reply      = { version: 1, status: "ok", sourceLength: 16, pythonVersion: [3, 14, 2], owners: [[0, "Module", "body", "import-from"]], rows: [[0, 0, "import-from", 0, 15, [["from", 0, 3], ["module", 5, 6], ["import", 7, 13], ["names", 14, 15]]]], tokens: [], formatted: [] } ;
		writeFileSync(executable, `#!${process.execPath}\nconsole.log(${JSON.stringify(JSON.stringify(reply))});\n`);
		chmodSync(executable, 0o755);
		const program = `import { analyzePython } from ${JSON.stringify(resolve("product/engine/python/05_analysis.ts"))}; try { analyzePython("from x import a\\n"); process.exit(2); } catch(error) { console.error(error.message); process.exit(7); }` ;
		const run     = Bun.spawnSync([process.execPath, "-e", program], { env: { ...process.env, PATH: root }, stdout: "pipe", stderr: "pipe" })                                                                                                         ;
		expect(run.exitCode).toBe(7);
		expect(run.stderr.toString()).toContain("invalid response");
	} finally { rmSync(root, { recursive: true, force: true }); }
});

test("Python group names preserve the frozen legacy planner and JSON results", () => {
	const expected = JSON.parse(readFileSync(join(import.meta.dir, "fixtures/python/kinds.legacy.json"), "utf8"));
	expect(withoutDisplay(align(source))).toEqual(expected.alignment);
	expect(withoutDisplay(JSON.parse(runAlignCli(PYTHON_ALIGNER, ["--file", fixture, "--json"]).report))).toEqual(expected.report);
});

test("Python semantic names follow actual module, class, function and expression owners", () => {
	const result = JSON.parse(runAlignCli(PYTHON_ALIGNER, ["--file", fixture, "--json"]).report).results[0] ;
	const groups = result.groups                                                                            ;
	expect(groups.map((group: any) => [group.semanticKind, group.sourceContext, group.kind])).toEqual([
		["annotated-assignments", "Module", "table"],
		["class-fields", "ClassDef", "table"],
		["annotated-assignments", "FunctionDef", "table"],
		["parameters", "arguments", "table"],
		["assignments", "Module", "table"],
		["assignments", "Module", "table"],
		["assignments", "Module", "table"],
		["dict-rows", "Dict", "table"],
		["keyword-arguments", "Call", "table"],
		["bundle-rows", "List", "table"],
		["assignments", "Module", "pair"],
		["dict-rows", "Dict", "table"],
	]);
	expect(groups.at(-1).state).toBe("REFUSE");
	expect(groups.every((group: any) => group.context === undefined)).toBe(true);
	const ordinary = groups.find((group: any) => group.startLine === 26);
	expect(lookupKeyOf("python", ordinary.context, ordinary.kind, ordinary.axes)).toBe("v1|python|-|table|name>equal>value");
});

test("Python names and output remain stable across CRLF and parameter marker lines", () => {
	const lf   = align(source)                          ;
	const crlf = align(source.replaceAll("\n", "\r\n")) ;
	expect(crlf.details.map(group => [group.semanticKind, group.sourceContext])).toEqual(lf.details.map(group => [group.semanticKind, group.sourceContext])) ;
	expect(crlf.output.replaceAll("\r\n", "\n")                                ).toBe   (lf.output                                                         ) ;
	expect(align(crlf.output).output                                           ).toBe   (crlf.output                                                       ) ;
	expect(lf.details.find(group => group.semanticKind === "parameters")?.rows ).toBe   (3                                                                 ) ;
});

test("a descriptive callback cannot replace group membership, axes or output", () => {
	const result = alignSource(source, {
		...PYTHON_ALIGNER,
		prepareSource: input => ({
			...PYTHON_ALIGNER.prepareSource!(input),
			describeGroup: () => ({ semanticKind: "custom", sourceContext: "Custom", rows: 0, axes: ["invented"], signature: "invented" }),
		}),
	}, { minRows: 3, apply: true });
	expect(withoutDisplay(result)).toEqual(withoutDisplay(align(source)));
});

test("ambiguous or incompatible source evidence stays unknown and independent classes stay separate", () => {
	const input = "class First:\n a: int\n longer: int\n c: int\n\nclass Second:\n d: int\n much_longer: int\n f: int\n" ;
	const rows  = analyzePython(input).rows                                                                              ;
	expect(align(input).details.map(group => [group.startLine, group.endLine, group.semanticKind])).toEqual([[2, 4, "class-fields"], [7, 9, "class-fields"]]      ) ;
	expect(describePythonGroup(rows, [1, 2, 6], ["name", "colon", "type"])                        ).toEqual({ semanticKind: "unknown", sourceContext: "ClassDef" }) ;
	expect(describePythonGroup(rows, [1, 2, 3], ["name", "equal", "invented"])                    ).toEqual({ semanticKind: "unknown", sourceContext: "ClassDef" }) ;
	expect(describePythonGroup(rows, [99], ["name", "colon", "type"])                             ).toEqual({ semanticKind: "unknown" }                           ) ;
});

test.each(["\n", "\r\n"])("nested dictionary values retain the unique complete outer owner with %j", ending => {
	const input  = 'values = {\n    "alpha": 1,\n    "long_name": 22,\n    "rest": {"HttpOnly": None},\n}\n'.replaceAll("\n", ending) ;
	const result = align(input)                                                                                                       ;
	const rows   = analyzePython(input).rows.filter(row => row.kind === "dictionary")                                                 ;
	const owner  = rows.find(row => row.line === 1)!.owner                                                                            ;
	const outer  = rows.filter(row => row.owner === owner)                                                                            ;
	const axes   = ["key", "colon", "value", "comma"]                                                                                 ;

	expect(result.details).toHaveLength(1);
	expect(result.details[0]).toMatchObject({ semanticKind: "dict-rows", sourceContext: "Dict", rows: 3 });
	expect(describePythonGroup([...rows, ...outer.map(row => ({ ...row, owner: row.owner + 1000 }))], [1, 2, 3], axes))
		.toEqual({ semanticKind: "unknown", sourceContext: "Dict" });
	expect(describePythonGroup([...outer, outer[0]!], [1, 2, 3], axes))
		.toEqual({ semanticKind: "unknown", sourceContext: "Dict" });
	expect(changedLines(input, result.output, PYTHON_ALIGNER.syntax)).toEqual([]           ) ;
	expect(comparePythonStructure(input, result.output).status      ).toBe   ("ok"         ) ;
	expect(align(result.output).output                              ).toBe   (result.output) ;
});

test("source-free Python column variants retain complete axis notes and exact approval identities", () => {
	const registry = loadApprovalRegistry([{ root: join(import.meta.dir, "../product/rules/presets/recommended"), layer: "preset" }]) ;
	const approved = new Set(registry.conventions.filter(rule => rule.status === "approved").map(rule => rule.key))                   ;
	expect(PYTHON_COLUMN_SETS.filter(set => approved.has(lookupKeyOf("python", set.approvalContext ?? undefined, set.approvalKind, set.approvalAxes))).map(set => [set.kind, set.variant])).toEqual([["assignments", "simple"]]                                                                                        ) ;
	expect(PYTHON_COLUMN_SETS.every(set => set.columns.length > 0 && set.columns.every(axis => typeof PYTHON_AXIS_NOTES[axis] === "string"))                                              ).toBe   (true                                                                                                               ) ;
	expect(PYTHON_COLUMN_SETS.every(set => set.detection === "implemented")                                                                                                               ).toBe   (true                                                                                                               ) ;
	expect(PYTHON_COLUMN_SETS.filter(set => ["import-from", "return-guards"].includes(set.kind)).map(set => set.kind)                                                                     ).toEqual(["import-from", "return-guards"]                                                                                   ) ;
	expect(PYTHON_UNSUPPORTED_KINDS.map(item => [item.kind, item.detection])                                                                                                              ).toEqual([["plain-import", "unsupported"], ["complex-import-from", "unsupported"], ["complex-return-guards", "unsupported"]]) ;
	const root = mkdtempSync(join(tmpdir(), "boxbox-kind-source-free-"));
	try {
		const module  = resolve("product/engine/python/08_kind-vocabulary.ts")                                                                    ;
		const program = `import { PYTHON_COLUMN_SETS } from ${JSON.stringify(module)}; console.log(PYTHON_COLUMN_SETS.length);`                   ;
		const run     = Bun.spawnSync([process.execPath, "-e", program], { env: { ...process.env, PATH: root }, stdout: "pipe", stderr: "pipe" }) ;
		expect(run.exitCode, run.stderr.toString()).toBe(0);
		expect(Number(run.stdout.toString())).toBe(PYTHON_COLUMN_SETS.length);
	} finally { rmSync(root, { recursive: true, force: true }); }
});

test("semantic names still require one Python analysis for several owner kinds", () => {
	const root = mkdtempSync(join(tmpdir(), "boxbox-kind-analysis-"));
	try {
		const count      = join     (root, "count"  )  ;
		const python     = Bun.which("python3"      )! ;
		const executable = join     (root, "python3")  ;
		writeFileSync(executable, `#!${process.execPath}\nimport { appendFileSync, readFileSync } from "node:fs";\nappendFileSync(${JSON.stringify(count)}, "x");\nconst run=Bun.spawnSync([${JSON.stringify(python)},...process.argv.slice(2)],{stdin:readFileSync(0),stdout:"pipe",stderr:"pipe"});process.stdout.write(run.stdout);process.stderr.write(run.stderr);process.exit(run.exitCode);\n`);
		chmodSync(executable, 0o755);
		const added   = join(import.meta.dir, "fixtures/python/bounded-import-guards.py")                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             ;
		const program = `import { readFileSync } from "node:fs"; import { alignSource } from ${JSON.stringify(resolve("product/engine/common/06_table-engine.ts"))}; import { PYTHON_ALIGNER } from ${JSON.stringify(resolve("product/engine/python/03_profile.ts"))}; const result=alignSource(readFileSync(${JSON.stringify(fixture)},"utf8")+"\\n"+readFileSync(${JSON.stringify(added)},"utf8"),PYTHON_ALIGNER,{minRows:3,apply:false}); if(!["class-fields","import-from","return-guards"].every(kind=>result.details.some(group=>group.semanticKind===kind))) process.exit(2);` ;
		const run     = Bun.spawnSync([process.execPath, "-e", program], { env: { ...process.env, PATH: root }, stdout: "pipe", stderr: "pipe" })                                                                                                                                                                                                                                                                                                                                                                                                                                     ;
		expect(run.exitCode, run.stderr.toString()).toBe(0);
		expect(readFileSync(count, "utf8")).toBe("x");
	} finally { rmSync(root, { recursive: true, force: true }); }
});
