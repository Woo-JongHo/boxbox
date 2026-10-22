import      { describe, expect, test                           } from "bun:test"                        ;
import      { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"                         ;
import      { tmpdir                                           } from "node:os"                         ;
import      { join                                             } from "node:path"                       ;
import      { assignmentEnvelopes                              } from "@/python/assignment-envelope.ts" ;
import      { changedLines                                     } from "@/common/preservation.ts"        ;
import      { assertAlignmentOnly                              } from "@/common/alignment-only.ts"      ;
import      {
              APPROVAL_VERSIONS                              ,
              documentResolver                               ,
              evaluateApproval                               ,
              loadApprovalRegistry                           ,
                                                               } from "@/common/approval-gate.ts"       ;
import type { ApprovalRegistry                                 } from "@/common/approval-gate.ts"       ;
import type { Example                                          } from "@/common/examples.ts"            ;
import      { contentHashOf, sectionHash                       } from "@/common/examples.ts"            ;
import      { lookupKeyOf                                      } from "@/common/signature.ts"           ;
import      { runFormatPipeline                                } from "@/common/format-pipeline.ts"     ;
import      { alignSource                                      } from "@/common/table-engine.ts"        ;
import      { PYTHON_ALIGNER                                   } from "@/python/profile.ts"             ;

const PRESET = join(import.meta.dir, "../product/rules/presets/recommended");

const SOURCE = [
	"def quote(unit_price, quantity, discount, shipping):",
	"    subtotal = unit_price * quantity",
	"    discounted = max(0, subtotal - discount)",
	"    total = discounted + shipping",
	"    return total",
	"",
].join("\n");

const EXPECTED = [
	"def quote(unit_price, quantity, discount, shipping):",
	"    subtotal   = unit_price * quantity",
	"    discounted = max(0, subtotal - discount)",
	"    total      = discounted + shipping",
	"    return total",
	"",
].join("\n");

const align = (source: string) => alignSource(source, PYTHON_ALIGNER, { minRows: 3, apply: true });

describe("Python assignment envelopes", () => {
	test("the exact native quote fixture shares outer assignment columns", () => {
		expect(new Bun.CryptoHasher("sha256").update(SOURCE).digest("hex")).toBe("bcaa36507954fe1d1933c5e44dbb939bc7540f63377b985c4d38575cb8aa802b");
		const result = align(SOURCE);

		expect(result.tables          ).toBe   (1                                    ) ;
		expect(result.details[0]!.axes).toEqual(["name", "equal", "assignment-value"]) ;
		expect(result.output          ).toBe   (EXPECTED                             ) ;
	});
});

function python(source: string, stdin = ""): string {
	const run = Bun.spawnSync(["python3", "-c", source], { stdin: Buffer.from(stdin), stdout: "pipe", stderr: "pipe" });

	expect(run.exitCode, run.stderr.toString()).toBe(0);
	return run.stdout.toString();
}

test("the native 180-case domain preserves reference behavior and positional-call evaluation order", () => {
	const baseline = "def quote(unit_price, quantity, discount, shipping):\n    return max(0, unit_price * quantity - discount) + shipping\n";
	const script = `import json, itertools, sys
sources = json.load(sys.stdin)
cases = list(itertools.product([0, 1, 7, 25, 100], [0, 1, 4], [0, 1, 7, 100], [0, 2, 11]))
def reference(unit_price, quantity, discount, shipping):
 remainder = unit_price * quantity - discount
 return (remainder if remainder > 0 else 0) + shipping
expected = [reference(*args) for args in cases]
results = []
for source in sources:
 scope = {}
 exec(source, scope)
 values = [scope['quote'](*args) for args in cases]
 assert values == expected
 results.append(values)
assert results[0] == results[1] == results[2]
assert len(cases) == 180
print(len(cases))
`;

	expect(python(script, JSON.stringify([SOURCE, align(SOURCE).output, baseline])).trim()).toBe("180");

	const ordered = "def order():\n    first = record(3) + record(4)\n    second = max(record(0), first - record(2))\n    third = record(second) + record(5)\n    return third\n";
	const compare = `import json,sys
results=[]
for source in json.load(sys.stdin):
 events=[]
 def record(value):
  events.append(value)
  return value
 scope={'record':record}
 exec(source,scope)
 results.append([scope['order'](),events])
assert results[0] == results[1] == [10,[3,4,0,2,5,5]]
print('same')`;

	expect(python(compare, JSON.stringify([ordered, align(ordered).output])).trim()).toBe("same");
});

test("opaque RHS bytes, CRLF, indentation and the fixed point are preserved", () => {
	const source = SOURCE.replaceAll("\n", "\r\n").replaceAll("    ", "\t").replace("max(0, subtotal - discount)", "max( 0, subtotal  - discount )")          ;
	const result = align(source)                                                                                                                              ;
	const rhs    = (value: string) => value.split("\r\n").filter(line => /^\t\w+\s*=/u.test(line)).map(line => line.slice(line.indexOf("=") + 1).trimStart()) ;

	expect(result.details[0]!.axes                                           ).toEqual(["name", "equal", "assignment-value"]                      ) ;
	expect(rhs(result.output)                                                ).toEqual(rhs(source)                                                ) ;
	expect(result.output.split("\r\n").length                                ).toBe   (source.split("\r\n").length                                ) ;
	expect(result.output.split("\r\n").map(line => /^[ \t]*/u.exec(line)![0])).toEqual(source.split("\r\n").map(line => /^[ \t]*/u.exec(line)![0])) ;
	expect(changedLines(source, result.output, PYTHON_ALIGNER.syntax)        ).toEqual([]                                                         ) ;
	expect(align(result.output).output                                       ).toBe   (result.output                                              ) ;
	expect(() => assertAlignmentOnly(Buffer.from(source), Buffer.from(result.output), "python")).not.toThrow();
	python("import ast,sys; ast.parse(sys.stdin.read())", result.output);
});

test("detailed tables retain ownership while a neighboring calculation receives its own envelope", () => {
	const detail       = "a = same(x, y)\nlonger = same(xx, y)\nc = same(x, yy)\n"                                                ;
	const calculations = "subtotal = price * quantity\ndiscounted = max(0, subtotal - discount)\ntotal = discounted + shipping\n" ;
	const legacy       = alignSource(detail, { ...PYTHON_ALIGNER, project: undefined }, { minRows: 3, apply: true })              ;
	const result       = align(detail + calculations)                                                                             ;

	expect(result.tables                                                                     ).toBe     (2                                                                     ) ;
	expect(result.output.split("\n").slice(0, 3).join("\n") + "\n"                           ).toBe     (legacy.output                                                         ) ;
	expect(result.details.map(table => [table.startLine, table.endLine])                     ).toEqual  ([[1, 3], [4, 6]]                                                      ) ;
	expect(result.details[0]!.axes                                                           ).toContain("call:same"                                                           ) ;
	expect(result.details[1]!.axes                                                           ).toContain("assignment-value"                                                    ) ;
	expect(new Set(result.details.flatMap(table => table.edits.map(edit => edit.index))).size).toBe     (result.details.reduce((total, table) => total + table.edits.length, 0)) ;
	expect(align(result.output).output                                                       ).toBe     (result.output                                                         ) ;
});

test("a detailed pair inside three heterogeneous rows is replaced by one outer owner", () => {
	const result = align("first = other(x, y)\nsecond = same(x, y)\nthird = same(x, z)\n");

	expect(result.groups          ).toBe   (1                                    ) ;
	expect(result.tables          ).toBe   (1                                    ) ;
	expect(result.pairs           ).toEqual([]                                   ) ;
	expect(result.details[0]!.axes).toEqual(["name", "equal", "assignment-value"]) ;
});

test("primary preservation refusal never retries the same rows through a broader projection", () => {
	const source = "a = -1\nlonger = -2\nthird = -3\n"                                                                                                    ;
	const result = alignSource(source, { ...PYTHON_ALIGNER, canonicalGaps: { ...PYTHON_ALIGNER.canonicalGaps, value: "" } }, { minRows: 3, apply: true }) ;

	expect(result.refused         ).toHaveLength(1                         ) ;
	expect(result.refused[0]!.axes).toEqual     (["name", "equal", "value"]) ;
	expect(result.details         ).toEqual     ([]                        ) ;
	expect(result.output          ).toBe        (source                    ) ;
});

test("projection rows must independently pass exact source reconstruction", () => {
	const result = alignSource(SOURCE, {
		...PYTHON_ALIGNER,
		project: () => new Map([1, 2, 3].map(index => [index, { indent: "    ", slots: [{ axis: "name", text: "invented", gapBefore: "" }] }])),
	}, { minRows: 3, apply: true });

	expect(result.tables).toBe(0);
	expect(result.output).toBe(SOURCE);
});

test("single rows, pairs, blank lines, comments and different indentation do not become automatic tables", () => {
	const rows = ["first = price * quantity", "second = max(0, first - discount)", "third = second + shipping"];
	for (const source of [rows[0]!, rows.slice(0, 2).join("\n"), rows.join("\n\n"), rows.join("\n# section\n"), rows.map((line, index) => " ".repeat(index) + line).join("\n")]) {
		const result = align(source);

		expect(result.tables).toBe(0);
		expect(result.output).toBe(source);
	}
	const pair = align(rows.slice(0, 2).join("\n"));

	expect(pair.pairs).toHaveLength(1);
	expect(pair.pairs[0]!.signature).toContain("name>equal>assignment-value");
});

test("parenthesized keyword arguments and prior-line explicit continuation cannot become assignments", () => {
	const fixtures = [
		"result = call(\n    first = price * quantity,\n    second = max(0, first - discount),\n    third = second + shipping\n)\n",
		"result = (\nfirst = price * quantity\nsecond = max(0, first - discount)\nthird = second + shipping\n)\n",
		"prefix = \\\nfirst = price * quantity\nsecond = max(0, first - discount)\nthird = second + shipping\n",
	];
	for (const source of fixtures) {
		expect(align(source).details.filter(table => table.axes.includes("assignment-value"))).toEqual([]);
		expect(assignmentEnvelopes(source).has(source.startsWith("prefix") ? 1 : 2)).toBe(false);
	}
});

test("unsupported targets, values and damaged delimiters never project an outer calculation", () => {
	const statements = [
		"self.total = call(x, y)", "items[0] = call(x, y)", "a, b = call(x, y)", "a: int = call(x, y)",
		"a = b = call(x, y)", "a += call(x, y)", "a == call(x, y)", "a = call(x=y)", "a = (b := 1)",
		"a = call(x, y); other()", 'a = "text"', "a = f'{value}'", "a = [x, y]", "a = items[index]",
		"a = [value for value in items]", "a = await call(x, y)", "a = lambda: 1", "a = yield 1",
		"a = x if flag else y", "a = call(x, y) ", "a = call(x,]", "a = call(x, y", "a = x @ y",
		"a = .", "a = foo bar", "a = call(x,)", "a = ()", `a = ${"(".repeat(66)}x${")".repeat(66)}`,
	];
	for (const statement of statements) expect(assignmentEnvelopes(`${statement}\n`).size, statement).toBe(0);
});

test("quoted continuations are skipped and a complete ordinary docstring does not absorb following calculations", () => {
	const docstring = '"""description\nfirst = price * quantity\nsecond = max(0, first - discount)\nthird = second + shipping\n"""\n' ;
	const result    = align(docstring + SOURCE)                                                                                       ;

	expect(result.details                                          ).toHaveLength(1                   ) ;
	expect(result.output                                           ).toBe        (docstring + EXPECTED) ;
	expect(assignmentEnvelopes(docstring).size                     ).toBe        (0                   ) ;
	expect(assignmentEnvelopes('text = f"{value}"\n' + SOURCE).size).toBe        (0                   ) ;
});

test("the new exact key cannot inherit the shipped simple-assignment approval", async () => {
	const root            = mkdtempSync         (join(tmpdir(), "boxbox-python-envelope-")                   ) ;
	const target          = join                (root, "sample.py"                                           ) ;
	const registry        = loadApprovalRegistry([{ root: PRESET, layer: "preset" }]                         ) ;
	const resolveDocument = documentResolver    ({ preset: PRESET }                                          ) ;
	const key             = lookupKeyOf         ("python", undefined, "table", align(SOURCE).details[0]!.axes) ;

	try {
		writeFileSync(target, SOURCE);

		expect(key                                                                                                          ).toBe         ("v1|python|-|table|name>equal>assignment-value") ;
		expect(evaluateApproval(registry, { key, file: "sample.py" }, resolveDocument)                                      ).toMatchObject({ status: "unknown", writable: false }         ) ;
		expect(evaluateApproval(registry, { key: "v1|python|-|table|name>equal>value", file: "sample.py" }, resolveDocument)).toMatchObject({ status: "approved", writable: true }         ) ;
		for (const dryRun of [true, false]) {
			await expect(runFormatPipeline({ root, file: "sample.py", language: "python", registry, resolveDocument, alignmentOnly: true, dryRun })).rejects.toThrow("approval denied");
			expect(readFileSync(target, "utf8")).toBe(SOURCE);
		}
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}, 60_000);

test("public Check and Guide expose the new group without approved write coverage", () => {
	const root = mkdtempSync(join(tmpdir(), "boxbox-python-envelope-cli-")) ;
	const cli  = join       (import.meta.dir, "../product/engine/cli.ts"  ) ;
	const invoke = (args: readonly string[], expectedExit = 1) => {
		const source = `import { runCli } from ${JSON.stringify(cli)}; process.exitCode = await runCli(JSON.parse(process.env.BOXBOX_TEST_ARGS!), process.cwd());`                                                          ;
		const run    = Bun.spawnSync([process.execPath, "-e", source], { cwd: root, env: { ...process.env, XDG_CONFIG_HOME: join(root, "user"), BOXBOX_TEST_ARGS: JSON.stringify(args) }, stdout: "pipe", stderr: "pipe" }) ;

		expect(run.exitCode, run.stderr.toString()).toBe(expectedExit);
		return JSON.parse(run.stdout.toString());
	};

	try {
		writeFileSync(join(root, "sample.py"), SOURCE);

		const checked = invoke(["check", "--file", "sample.py", "--json"]) ;
		const guided  = invoke(["guide", "--file", "sample.py", "--json"]) ;

		expect(checked.syntax.status                          ).toBe         ("valid"                                   ) ;
		expect(checked.results[0].groups[0].axes              ).toEqual      (["name", "equal", "assignment-value"]     ) ;
		expect(checked.formatReadiness.approvalEligible       ).toBe         (false                                     ) ;
		expect(checked.formatReadiness.approvalFacts[0].status).toBe         ("unknown"                                 ) ;
		expect(guided                                         ).toMatchObject({ ok: false, guides: [], conventions: [] }) ;
		expect(readFileSync(join(root, "sample.py"), "utf8")  ).toBe         (SOURCE                                    ) ;

		writeFileSync(join(root, "sample.py"), SOURCE.replace("max(0, subtotal - discount)", "max(0, subtotal - discount]"));
		const invalid = invoke(["check", "--file", "sample.py", "--json"], 2);

		expect(invalid.syntax.status).toBe("invalid");
		expect(invalid.formatReadiness.approvalEligible).toBe(false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}, 60_000);

test("a complete synthetic test proof permits preview and apply of the new envelope without changing product approvals", async () => {
	const root     = mkdtempSync(join(tmpdir(), "boxbox-python-envelope-proof-"))                                              ;
	const file     = join(root, "sample.py")                                                                                   ;
	const id       = "synthetic-test-calculation-envelope"                                                                     ;
	const document = "# Rules\n\n## Calculation envelope\nTest-only synthetic approval of the bounded calculation envelope.\n" ;
	const records: Example[] = ([
		["positive", SOURCE, EXPECTED, "after-better"],
		["pair", "a = price * quantity\nb = max(0, a)\n", "a = price * quantity\nb = max(0, a)\n", "bad"],
	] as const).map(([suffix, before, after, verdict]) => ({
		schemaVersion: 1, id: `${id}-${suffix}`, status: "approved", versions: APPROVAL_VERSIONS,
		language: "python", regime: "table", patterns: ["DEFINE"], rules: [id], before, after,
		contentHash: contentHashOf(before, after), verdict, asserts: { after: {} },
		source: { kind: "synthetic", license: "test-only" }, approvedBy: "synthetic-test-approver", date: "2026-10-22",
	}));
	const examples = records.map(record => record.id);
	const registry: ApprovalRegistry = {
		conventions : [{ schemaVersion: 1, id, key: "v1|python|-|table|name>equal>assignment-value", pattern: "DEFINE", status: "approved", scope: "**/*.py", examples, versions: APPROVAL_VERSIONS, approvedBy: "synthetic-test-approver", date: "2026-10-22", layer: "project" }],
		examples    : new Map(records.map(record => [record.id, record])),
		decisions   : new Map([[id, { schemaVersion: 1, id, kind: "rule", layer: "convention", ref: "rules.md#Calculation envelope", docHash: sectionHash(document, "Calculation envelope"), examples, approvedBy: "synthetic-test-approver", date: "2026-10-22" }]]),
	};

	try {
		writeFileSync(file, SOURCE);
		writeFileSync(join(root, "rules.md"), document);

		const options = { root, file: "sample.py", language: "python" as const, registry, resolveDocument: documentResolver(root), alignmentOnly: true } ;
		const preview = await runFormatPipeline({ ...options, dryRun: true })                                                                            ;

		expect(preview.written                               ).toBe   (false ) ;
		expect(preview.alignmentEdits?.map(edit => edit.line)).toEqual([2, 4]) ;
		expect(readFileSync(file, "utf8")                    ).toBe   (SOURCE) ;

		const applied = await runFormatPipeline(options);

		expect(applied.written                                                      ).toBe         (true                                          ) ;
		expect(applied.safety                                                       ).toMatchObject({ approvalChecked: true, parserChecked: true }) ;
		expect(readFileSync(file, "utf8")                                           ).toBe         (EXPECTED                                      ) ;
		expect((await runFormatPipeline(options)).written                           ).toBe         (false                                         ) ;
		expect(loadApprovalRegistry([{ root: PRESET, layer: "preset" }]).conventions).toHaveLength (2                                             ) ;
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}, 60_000);

test("inline comments keep their exact content and do not expose punctuation as calculation syntax", () => {
	const source = "first = price * quantity  # ) = marker\nlonger = max(0, first - discount) # ( marker\nthird = longer + shipping # ] marker\n" ;
	const result = align(source)                                                                                                                  ;

	expect(result.tables                                                                       ).toBe   (1                                                                            ) ;
	expect(result.output.split("\n").filter(Boolean).map(line => line.slice(line.indexOf("#")))).toEqual(source.split("\n").filter(Boolean).map(line => line.slice(line.indexOf("#")))) ;
	expect(changedLines(source, result.output, PYTHON_ALIGNER.syntax)                          ).toEqual([]                                                                           ) ;
	expect(align(result.output).output                                                         ).toBe   (result.output                                                                ) ;
});
