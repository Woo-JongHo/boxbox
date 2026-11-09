import      { describe, expect, test } from "bun:test"                       ;
import      { fileURLToPath          } from "node:url"                       ;
import      { readFileSync           } from "node:fs"                        ;
import      { alignSource            } from "@/common/06_table-engine.ts"    ;
import      { maskSource             } from "@/common/00_code-text.ts"       ;
import      { PYTHON_ALIGNER         } from "@/python/03_profile.ts"         ;
import      { PYTHON_ANALYSIS_SCRIPT } from "@/python/06_analysis-script.ts" ;
import      { defineLanguageSuite    } from "./lang-harness.ts"              ;

test("nested comma rows, sibling imports and untyped parameters remain visibly unsupported", () => {
	const file     = fileURLToPath(new URL("./fixtures/python/review-visibility.py", import.meta.url)) ;
	const source   = readFileSync(file, "utf8")                                                        ;
	const expected = [2, 3, 4, 8, 9, 10, 13, 14, 17, 18, 19]                                           ;
	for (const ending of ["\n", "\r\n"]) {
		const input  = source.replaceAll("\n", ending                                      ) ;
		const result = alignSource      (input, PYTHON_ALIGNER, { minRows: 3, apply: true }) ;
		expect(result.unsupported?.map(row => row.line)).toEqual(expected);
		expect(result.unsupported?.map(row => row.reason)).toEqual(expected.map(line => line === 13 || line === 14
			? "Python import layout is not supported" : "Python comma-row layout is not supported"));
		expect(result.details                                                         ).toEqual([]    ) ;
		expect(result.output                                                          ).toBe   (input ) ;
		expect(alignSource(result.output, PYTHON_ALIGNER, { minRows: 3, apply: true })).toEqual(result) ;
	}
	const run = Bun.spawnSync([process.execPath, fileURLToPath(new URL("../product/packages/cli/entry.ts", import.meta.url)), "check", "--source", "--file", file, "--json"], { stdout: "pipe", stderr: "pipe" });
	expect(run.exitCode, run.stderr.toString()).toBe(0);
	const report = JSON.parse(run.stdout.toString());
	expect(report.syntax.status                                                  ).toBe   ("valid"                                                         ) ;
	expect(report.results[0].unsupported.map((row: { line: number }) => row.line)).toEqual(expected                                                        ) ;
	expect(report.results[0].summary                                             ).toEqual({ groups: 0, misaligned: 0, edits: 0, refused: 0, suggested: 0 }) ;
	expect(readFileSync(file, "utf8")                                            ).toBe   (source                                                          ) ;
});

test.each([
	"f(\n    wrap(a),\n    wrap(b),\n)\n",
	"f(\n    wrap(a),\n    wrap(b),\n)\ng(\n    wrap(c),\n    wrap(d),\n)\n",
	"f(\n    wrap(a),\n    # split\n    wrap(b),\n    wrap(c),\n)\n",
	"result = combine(wrap(first), wrap(second), wrap(third))\n",
	'text = """\nimport os; import sys\nwrap(a),\nwrap(b),\nwrap(c),\n"""\n',
	"def f(\n    alpha,\n    beta,\n):\n    pass\n",
	"def f(\n    alpha,\n    # split\n    beta,\n    gamma,\n):\n    pass\n",
])("unsupported visibility does not merge short, separate or non-code rows: %s", source => {
	const result = alignSource(source, PYTHON_ALIGNER, { minRows: 3, apply: true });
	expect(result.unsupported ?? []).toEqual([]    ) ;
	expect(result.details          ).toEqual([]    ) ;
	expect(result.output           ).toBe   (source) ;
});

test("bounded from-import rows and unsupported plain imports/comma rows remain visible through checks", () => {
	const file   = fileURLToPath(new URL("./fixtures/python/coverage-gaps.py", import.meta.url)) ;
	const before = readFileSync (file                                                          ) ;
	for (const [entry, args] of [
		["../product/engine/python/02_align-tables.ts", ["--file", file, "--json"]],
		["../product/packages/cli/entry.ts", ["check", "--file", file, "--json"]],
	] as const) {
		const run = Bun.spawnSync([process.execPath, fileURLToPath(new URL(entry, import.meta.url)), ...args], { stdout: "pipe", stderr: "pipe" });
		expect(run.exitCode, run.stderr.toString()).toBe(1);
		const result = JSON.parse(run.stdout.toString()).results[0];
		expect(result.summary.groups                                                       ).toBe         (1                                       ) ;
		expect(result.groups[0]                                                            ).toMatchObject({ semanticKind: "import-from", rows: 3 }) ;
		expect(result.unsupported.map((row: { line: number }) => row.line)                 ).toEqual      ([1, 7, 8, 9, 13, 14, 15, 16]            ) ;
		expect(result.unsupported.every((row: { reason: string }) => row.reason.length > 0)).toBe         (true                                    ) ;
		expect(readFileSync(file)                                                          ).toEqual      (before                                  ) ;
		const text = Bun.spawnSync([process.execPath, fileURLToPath(new URL(entry, import.meta.url)), ...args.slice(0, -1)], { stdout: "pipe", stderr: "pipe" });
		expect(text.exitCode, text.stderr.toString()).toBe(1);
		expect(text.stdout.toString()).toContain("unsupported line=1:");
	}
});

test("multiline imports and CRLF comma rows expose bounded unsupported lines without edits", () => {
	const source = 'from package import (\r\n    alpha,\r\n    beta,\r\n    gamma,\r\n)\r\n\r\nitems = [\r\n    first,\r\n    second,\r\n    third,\r\n    fourth\r\n]\r\n' ;
	const result = alignSource(source, PYTHON_ALIGNER, { minRows: 3, apply: true })                                                                                         ;
	expect(result.unsupported?.map(row => row.line)).toEqual([1, 8, 9, 10]) ;
	expect(result.output                           ).toBe   (source       ) ;
	expect(result.details                          ).toEqual([]           ) ;
});

test("dictionary unpacking inside a list remains invalid syntax rather than an unsupported valid table", () => {
	const source = "items = [\n    *args,\n    **kwargs,\n    plain,\n    another_one,\n]\n";
	expect(() => alignSource(source, PYTHON_ALIGNER, { minRows: 3, apply: true })).toThrow("Python source is invalid");
});

test("unsupported reporting excludes strings, comments, short runs and recognized rows", () => {
	const source = '# from package import name\ntext = "import os"\n\nitems = [\n    first,\n    second,\n]\n\nrows = [\n    ["a", 1],\n    ["longer", 2],\n    ["mid", 3],\n]\n\nh(\n    a=1,\n    longer=2,\n    mid=3,\n)\n' ;
	const result = alignSource(source, PYTHON_ALIGNER, { minRows: 3, apply: true })                                                                                                                                             ;
	expect(result.unsupported ?? []).toEqual([]);
	expect(result.tables).toBe(2);
});

test("unsupported candidates stay in their original AST owner and physical paragraph", () => {
	const source = 'h(\n    first,\n    second,\n)\ng(\n    third,\n    fourth,\n)\n\nitems = [\n    alpha,\n    # section\n    beta,\n    gamma,\n]\n' ;
	const result = alignSource(source, PYTHON_ALIGNER, { minRows: 3, apply: true })                                                                     ;
	expect(result.unsupported ?? []).toEqual([]);
	expect(result.output).toBe(source);
});

defineLanguageSuite({
	aligner     : PYTHON_ALIGNER                                                      ,
	fixturesDir : fileURLToPath(new URL("../test/fixtures/python/", import.meta.url)) ,
	tableFile   : "tables.py"                                                         ,
	alignedFile : "tables.aligned.py"                                                 ,
	trickyFile  : "tricky.py"                                                         ,
});

describe("python profile specific properties", () => {
	const align = (source: string): ReturnType<typeof alignSource> => alignSource(source, PYTHON_ALIGNER, { minRows: 3, apply: true });

	test("dictionary call values and an omitted final comma share their real table", () => {
		const source = [
			"values = {",
			'    "version": 1,',
			'    "status": "ok",',
			'    "sourceLength": len("a,b"),',
			'    "pythonVersion": list((3, 14, 2)),',
			'    "owners": [],',
			'    "rows": [],',
			'    "tokens": [],',
			'    "formatted": []',
			"}",
		].join("\n");
		const result = align(source);
		expect(result.details                                                 )    .toHaveLength (1                                                                              ) ;
		expect(result.details[0]                                              )    .toMatchObject({ startLine: 2, endLine: 9, rows: 8, axes: ["key", "colon", "value", "comma"] }) ;
		expect(result.output                                                  )    .toContain    ('len("a,b")'                                                                   ) ;
		expect(result.output                                                  )    .toContain    ('list((3, 14, 2))'                                                             ) ;
		expect(result.output.split("\n")[8]                                   ).not.toEndWith    (","                                                                            ) ;
		expect(result.output.split("\n").every(line => !/[ \t]+$/u.test(line)))    .toBe         (true                                                                           ) ;
		expect(align(result.output).output                                    )    .toBe         (result.output                                                                  ) ;
	});

	test("dictionary alignment preserves call evaluation order and nested values", () => {
		const source = [
			"import json",
			"events = []",
			"def capture(value):",
			"    events.append(value)",
			"    return value",
			"values = {",
			'    "a": capture("a,b"),',
			'    "longer": capture([1, 2]),',
			'    "mid": capture({"x": 3})',
			"}",
			"print(json.dumps([values, events]))",
		].join("\n");
		const result = align(source);
		expect(result.details[0]?.rows).toBe(3);
		const execute = (code: string) => {
			const run = Bun.spawnSync(["python3", "-I", "-c", code], { stdout: "pipe", stderr: "pipe" });
			expect(run.exitCode, run.stderr.toString()).toBe(0);
			return run.stdout.toString();
		};
		expect(execute(result.output)).toBe(execute(source));
		expect(align(result.output).output).toBe(result.output);
	});

	test("the engine's own eight-field Python response is inspected as one dictionary", () => {
		const lines   = PYTHON_ANALYSIS_SCRIPT.split("\n")                                                  ;
		const first   = lines.findIndex(line => line.includes("'sourceLength'")) - 1                        ;
		const last    = lines.findIndex(line => line.includes("'formatted'") && !line.includes("'owners'")) ;
		const result  = align(PYTHON_ANALYSIS_SCRIPT)                                                       ;
		const payload = result.details.find(table => table.startLine <= first && table.endLine >= last + 1) ;
		expect(payload?.rows).toBe(8);
		expect(payload?.axes).toEqual(["key", "colon", "value", "comma"]);
	});

	test.each([
		{ name: "CRLF", indent: "    ", ending: "\r\n" },
		{ name: "tab indentation", indent: "\t", ending: "\n" },
	])("dictionary calls without a final comma preserve $name", ({ indent, ending }) => {
		const source = ["data = {", `${indent}"a": len("x"),`, `${indent}"longer": [1, 2],`, `${indent}"mid": {"x": 3}`, "}"].join(ending) ;
		const result = align(source)                                                                                                       ;
		expect(result.details                                                                )    .toMatchObject([{ rows: 3, axes: ["key", "colon", "value", "comma"] }]) ;
		expect(result.output.split(ending)                                                   )    .toHaveLength (5                                                      ) ;
		expect(result.output.split(ending)[3]                                                ).not.toEndWith    (","                                                    ) ;
		expect(result.output.split(ending).slice(1, 4).every(line => line.startsWith(indent)))    .toBe         (true                                                   ) ;
		expect(result.output.replace(/[ \t]/gu, "")                                          )    .toBe         (source.replace(/[ \t]/gu, "")                          ) ;
		expect(align(result.output).output                                                   )    .toBe         (result.output                                          ) ;
	});

	test.each([
		{ name: "same-line sibling entries", source: 'data = {\n "a": len("x"), "extra": 1,\n "longer": [1, 2], "another": 2,\n "mid": {"x": 3}, "last": 3\n}' },
		{ name: "multiline values", source: 'data = {\n "a": (\n  len("x")\n ),\n "longer": (\n  [1, 2]\n ),\n "mid": (\n  {"x": 3}\n )\n}' },
	])("refuses dictionary $name without changing their source", ({ source }) => {
		const result = align(source);
		expect(result.tables).toBe(0);
		expect(result.output).toBe(source);
	});

	test("dictionary rows decompose into key, colon, value, comma axes and align the colon column", () => {
		const source = [
			"defaults = {",
			`    "host": "localhost:8080",`,
			`    "port": 8080,`,
			`    "debug": True,`,
			"}",
		].join("\n");
		const result = align              (source) ;
		const lines  = result.output.split("\n"  ) ;
		expect(lines[1]     ).toBe(`    "host"  : "localhost:8080",`) ;
		expect(lines[2]     ).toBe(`    "port"  : 8080            ,`) ;
		expect(lines[3]     ).toBe(`    "debug" : True            ,`) ;
		expect(result.tables).toBe(1                                ) ;
	});

	test("annotated assignments align name and type columns and never pad the trailing value", () => {
		const source = [
			"@dataclass",
			"class Config:",
			"    retries: int = 3",
			`    label: str = "x"`,
			"    verbose: bool = True",
		].join("\n");
		const result = align              (source) ;
		const lines  = result.output.split("\n"  ) ;
		expect(lines[2]         ).toBe("    retries : int  = 3"   ) ;
		expect(lines[3]         ).toBe(`    label   : str  = "x"` ) ;
		expect(lines[4]         ).toBe("    verbose : bool = True") ;
		expect(result.misaligned).toBe(3                          ) ;
	});

	test("tightly written assignments also form a table and are fixed to conventional gaps (one space around colon and equal)", () => {
		const source = [
			"ratio:float=0.5",
			"level:int=3",
			"name:str='x'",
		].join("\n");
		const result = align              (source) ;
		const lines  = result.output.split("\n"  ) ;
		expect(lines[0]).toBe("ratio : float = 0.5") ;
		expect(lines[1]).toBe("level : int   = 3"  ) ;
		expect(lines[2]).toBe("name  : str   = 'x'") ;
	});

	test("subscripted, union and quoted annotations stay in one field table", () => {
		const source = [
			"class Snapshot:",
			"    target_path: Path",
			'    scan: "ScanResult"',
			"    last_row: int | None",
			"    wire_keys: tuple[str, ...]",
		].join("\n");
		const lines = align(source).output.split("\n");
		expect(lines.slice(1)).toEqual([
			"    target_path : Path",
			'    scan        : "ScanResult"',
			"    last_row    : int | None",
			"    wire_keys   : tuple[str, ...]",
		]);
	});

	test("fields with and without defaults share the name and colon columns; equal follows the longest defaulted type", () => {
		const source = [
			"class Meta:",
			"    source_path: str",
			"    raw_row_count: int",
			"    account_filter_path: str | None = None",
			"    allowed_count: int = 0",
		].join("\n");
		const result = align(source);
		expect(result.tables).toBe(1);
		expect(result.output.split("\n").slice(1)).toEqual([
			"    source_path         : str",
			"    raw_row_count       : int",
			"    account_filter_path : str | None = None",
			"    allowed_count       : int        = 0",
		]);
	});

	test("annotated statements with a bracketed value are refused", () => {
		const source = [
			"items: list[int] = [1, 2]",
			"names: list[str] = []",
			"flags: list[bool] = []",
		].join("\n");
		const result = align(source);
		expect(result.tables).toBe(0     );
		expect(result.output).toBe(source);
	});

	test("keyword-argument rows align name, equal, value and the closing comma", () => {
		const source = [
			"result = Result(",
			"        source_path=local_path,",
			"        size=len(rows),",
			"        target_columns=(KEY,),",
			")",
		].join("\n");
		expect(align(source).output.split("\n").slice(1, 4)).toEqual([
			"        source_path    = local_path,",
			"        size           = len(rows) ,",
			"        target_columns = (KEY,)    ,",
		]);
	});

	test("parameters with and without defaults share one table and a closing comma column", () => {
		const source = [
			"def find(",
			"    search_dir: str | Path,",
			"    file_name: str = FILE_NAME,",
			"    recursive: bool = False,",
			") -> Path:",
			"    pass",
		].join("\n");
		const result = align(source);
		expect(result.tables).toBe(1);
		expect(result.output.split("\n").slice(1, 4)).toEqual([
			"    search_dir : str | Path      ,",
			"    file_name  : str  = FILE_NAME,",
			"    recursive  : bool = False    ,",
		]);
	});

	test("a keyword-only marker sits inside one parameter table", () => {
		const source = [
			"def resolve(",
			"    path_arg: str | None,",
			"    *,",
			"    base_dir: Path,",
			"    today: date | None = None,",
			") -> Path:",
			"    pass",
		].join("\n");
		const result = align(source);
		expect(result.tables).toBe(1);
		expect(result.output.split("\n").slice(1, 5)).toEqual([
			"    path_arg : str | None        ,",
			"    *,",
			"    base_dir : Path              ,",
			"    today    : date | None = None,",
		]);
	});

	test("comma rows whose value holds a top-level comma or an open bracket are refused", () => {
		const source = [
			"    alpha = 1, 2,",
			"    beta = call(,",
			"    gamma = x if y else (z,",
		].join("\n");
		expect(() => align(source)).toThrow();
	});

	test("a table whose columns would follow wide characters is refused with a reason and left unchanged", () => {
		const source = [
			"row = {",
			'    "송금번호": wire_value,', // cjk-test-data
			'    "입금증": deposit_slip,', // cjk-test-data
			'    "통화": currency,',       // cjk-test-data
			"}",
		].join("\n");
		const result = align(source);
		expect(result.output                             ).toBe   (source             ) ;
		expect(result.refused.map(table => table.refusal)).toEqual(["wide-characters"]) ;
	});

	test("wide characters in a row's last cell or trailing comment do not refuse the table", () => {
		const source = [
			"class Row:",
			"    deposit_date: str  # 입금일", // cjk-test-data
			'    company: str = "한국"',        // cjk-test-data
			"    amount: float",
		].join("\n");
		const result = align(source);
		expect(result.refused).toEqual([]);
		expect(result.output.split("\n").slice(1)).toEqual([
			"    deposit_date : str # 입금일", // cjk-test-data
			'    company      : str = "한국"',  // cjk-test-data
			"    amount       : float",
		]);
	});

	test("attribute assignments form a table without changing Python syntax or non-whitespace tokens", () => {
		const source = [
			"self.a = 0",
			"self.longer_name = 0",
			"self.b = 0",
		].join("\n");
		const result = align(source);

		expect(result.groups).toBe(1);
		expect(result.details[0]!.axes).toEqual(["attribute", "equal", "value"]);
		expect(result.output).toBe([
			"self.a           = 0",
			"self.longer_name = 0",
			"self.b           = 0",
		].join("\n"));
		expect(Bun.spawnSync(["python3", "-c", `import ast; ast.parse(${JSON.stringify(result.output)})`]).exitCode).toBe(0);
		expect(result.output.replaceAll(/\s/gu, "")).toBe(source.replaceAll(/\s/gu, ""));
	});

	test("assigned calls decompose into the call cell and argument columns", () => {
		const source = [
			"first  = diagnostics(toolchain, before)",
			"second = diagnostics(toolchain, after)",
			"third  = diagnostics(toolchain, during)",
		].join("\n");
		const result = align              (source) ;
		const lines  = result.output.split("\n"  ) ;
		expect(lines[0]).toBe("first  = diagnostics(toolchain, before)") ;
		expect(lines[1]).toBe("second = diagnostics(toolchain, after )") ;
		expect(lines[2]).toBe("third  = diagnostics(toolchain, during)") ;
	});

	test("a call wrapping one flat bundle aligns the bundle cells inside the call", () => {
		const source = [
			`STATES = frozenset({"PASS", "FIXABLE", "SUGGEST"})`,
			`PARSES = frozenset({"ok", "changed", "skipped"})`,
			`GONE = frozenset({"no", "off", "away"})`,
		].join("\n");
		const result = align              (source) ;
		const lines  = result.output.split("\n"  ) ;
		expect(lines[0]).toBe(`STATES = frozenset({"PASS", "FIXABLE", "SUGGEST"})`) ;
		expect(lines[1]).toBe(`PARSES = frozenset({"ok"  , "changed", "skipped"})`) ;
		expect(lines[2]).toBe(`GONE   = frozenset({"no"  , "off"    , "away"   })`) ;
	});

	test("heterogeneous positional calculations share only outer assignment columns; keyword arguments stay unsupported", () => {
		for (const source of [
			[
				"first  = other(toolchain, before)",
				"second = diagnostics(toolchain, after)",
				"third  = diagnostics(toolchain, during)",
			].join("\n"),
			[
				"first  = diagnostics(toolchain, before)",
				"second = diagnostics(toolchain, after, extra)",
				"third  = diagnostics(toolchain, during)",
			].join("\n"),
			[
				"first  = diagnostics(toolchain, os.path(base))",
				"second = diagnostics(toolchain, after)",
				"third  = diagnostics(toolchain, during)",
			].join("\n"),
			[
				"first  = diagnostics(tool=1, before=2)",
				"second = diagnostics(toolchain, after)",
				"third  = diagnostics(toolchain, during)",
			].join("\n"),
		]) {
			const result = align(source);
			if (source.includes("tool=1")) {
				expect(result.tables).toBe(0);
				expect(result.output).toBe(source);
			} else {
				expect(result.tables                                                           ).toBe   (1                                                                ) ;
				expect(result.details[0]!.axes                                                 ).toEqual(["name", "equal", "assignment-value"]                            ) ;
				expect(result.output.split("\n").map(line => line.slice(line.indexOf("=") + 1))).toEqual(source.split("\n").map(line => line.slice(line.indexOf("=") + 1))) ;
			}
		}
	});

	test("the profile refuses control-flow, call and line-continuation rows so they never form tables", () => {
		const source = [
			"if flag == other:",
			"    total = compute(a, b) + \\",
			"        extra",
			"    done = True",
		].join("\n");
		const result = align(source);
		expect(result.tables    ).toBe(0     ) ;
		expect(result.misaligned).toBe(0     ) ;
		expect(result.output    ).toBe(source) ;
	});

	test("bundle rows align inner cell columns, and rows with different bracket pairs split tables", () => {
		const source = [
			"GRID = [",
			`    ["alpha", 1,   "x"],`,
			`    ["b",     22,  "yy"],`,
			`    ["ccc",   333, "zzz"],`,
			`    ("delta", 4, "w"),`,
			"]",
		].join("\n");
		const result = align              (source) ;
		const lines  = result.output.split("\n"  ) ;
		expect(lines[1]).toBe(`    ["alpha", 1  , "x"  ],`) ;
		expect(lines[2]).toBe(`    ["b"    , 22 , "yy" ],`) ;
		expect(lines[3]).toBe(`    ["ccc"  , 333, "zzz"],`) ;
		// `[` rows and `(` rows have different axis sequences and never share a table — a lone tuple row stays as is.
		expect(lines[4]).toBe(`    ("delta", 4, "w"),`);
		expect(result.tables).toBe(1);
	});

	test("the profile refuses bundle rows with nesting, indexing, assignment, empty cells or f-strings", () => {
		const maskedOf = (code: string): string => maskSource(code, PYTHON_ALIGNER.syntax).text;
		for (const code of [
			`["a", ["b", "c"]],`, // nested bundle
			"[rows[0], total],",  // indexing/slicing
			"[alpha, beta = 1],", // inner assignment
			"[solo],",            // single cell
			"[alpha, ],",         // trailing empty cell
			"[alpha,, beta],",    // empty cell from double comma
			`[f"alpha", 1],`,     // f-string prefixed cell
			"[alpha, beta),",     // mismatched bracket pair
			"{alpha, 1},",        // brace bundles are not Python table rows
		]) {
			expect(PYTHON_ALIGNER.profile(code, maskedOf(code))).toBeNull();
		}
	});

	test("keeps == comparisons inside values and refuses values starting with ==", () => {
		const comparable = align([
			"flag = a == b",
			"other = b == c",
			"third = c == d",
		].join("\n"));
		expect(comparable.output.split("\n")[0]).toBe("flag  = a == b");
		expect(comparable.misaligned).toBe(1);

		const bareComparison = align([
			"alpha = 1",
			"beta = 22",
			"gamma = 333",
			"flag == other",
		].join("\n"));
		expect(bareComparison.tables               ).toBe(1              ) ;
		expect(bareComparison.misaligned           ).toBe(1              ) ;
		expect(bareComparison.output.split("\n")[0]).toBe("alpha = 1"    ) ;
		expect(bareComparison.output.split("\n")[3]).toBe("flag == other") ;
	});
});
