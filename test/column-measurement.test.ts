import      { afterEach, expect, test } from "bun:test"                 ;
import      {
              chmodSync             ,
              mkdirSync             ,
              mkdtempSync           ,
              readFileSync          ,
              rmSync                ,
              writeFileSync
                                      } from "node:fs"                  ;
import      { tmpdir                  } from "node:os"                  ;
import      { join, resolve           } from "node:path"                ;
import      { alignSource             } from "@/common/table-engine.ts" ;
import      { PYTHON_ALIGNER          } from "@/python/profile.ts"      ;

const root                 = resolve(import.meta.dir, "..") ;
const workspaces: string[] = []                             ;
afterEach(() => { for (const workspace of workspaces.splice(0)) rmSync(workspace, { recursive: true, force: true }); });
function invoke(language: "typescript" | "python", source: string, args: string[] = []): { result: any; exit: number | null; after: string } {
	const workspace = mkdtempSync(join(tmpdir(), "boxbox-measure-"));
	workspaces.push(workspace);
	const file = join(workspace, language === "python" ? "sample.py" : "sample.ts");
	writeFileSync(file, source);
	const script = join         (root, "product/engine", language, "measure-columns.ts"                                                                   ) ;
	const run    = Bun.spawnSync(["bun", script, "--file", file.split("/").at(-1)!, "--json", ...args], { cwd: workspace, stdout: "pipe", stderr: "pipe" }) ;
	return { result: JSON.parse(run.stdout.toString()), exit: run.exitCode, after: readFileSync(file, "utf8") };
}

test("TypeScript reports actual boundaries and preserves input", () => {
	const source = "const a=1;\nconst longer=2;\nconst c=3;\n";
	const { result, exit, after } = invoke("typescript", source);
	expect(exit                                                                                                             ).toBe   (1         ) ;
	expect(result.state                                                                                                     ).toBe   ("MISMATCH") ;
	expect(result.groups[0].rowLines                                                                                        ).toEqual([1, 2, 3] ) ;
	expect(result.groups[0].axes.find((axis: any) => axis.axis === "equals").points.map((point: any) => point.currentColumn)).toEqual([7, 12, 7]) ;
	expect(after                                                                                                            ).toBe   (source    ) ;

	expect(result.groups[0].axes.find((axis: any) => axis.axis === "equals").points.map((point: any) => point.targetColumn)).toEqual([13, 13, 13]);
});

test("Python uses the selected planner, reports pairs and never writes", () => {
	const source = "a=1\nlonger=2\nc=3\n\nx=1\ny=2\n";
	const { result, exit, after } = invoke("python", source);
	expect(exit                     ).toBe   (1             ) ;
	expect(result.groups[0].state   ).toBe   ("MISMATCH"    ) ;
	expect(result.groups[0].rowLines).toEqual([1, 2, 3]     ) ;
	expect(result.groups[1].state   ).toBe   ("UNMEASURABLE") ;
	expect(after                    ).toBe   (source        ) ;

	const equal = result.groups[0].axes.find((axis: any) => axis.axis === "equal");
	expect(equal.points.map((point: any) => point.currentColumn)).toEqual([1, 6, 1]);
	expect(equal.points.map((point: any) => point.targetColumn)).toEqual([7, 7, 7]);

	let observed       = false                                                                                                  ;
	const before       = alignSource(source, PYTHON_ALIGNER, { minRows: 3, apply: false })                                      ;
	const withObserver = alignSource(source, PYTHON_ALIGNER, { minRows: 3, apply: false, observe: () => { observed = true; } }) ;
	expect(withObserver).toEqual(before);
	expect(observed).toBe(true);
});

test("no groups, invalid input and unknown flags have explicit exits", () => {
	const empty   = invoke("python", "x = 1\n"             ) ;
	const invalid = invoke("python", "if:\n"               ) ;
	const flag    = invoke("python", "x = 1\n", ["--write"]) ;
	expect([empty.result.state, empty.exit]    ).toEqual(["NO_GROUPS", 0]) ;
	expect([invalid.result.state, invalid.exit]).toEqual(["ERROR", 2]    ) ;
	expect([flag.result.state, flag.exit]      ).toEqual(["ERROR", 2]    ) ;
	expect(flag.after                          ).toBe   ("x = 1\n"       ) ;
});

test("logical virtual anchors and noncontiguous guard rows are visible", () => {
	const source = "function f(a: boolean, b: boolean, c: boolean) {\r\n\tif (\r\n\t\ta\r\n\t\t|| !b\r\n\t\t|| c\r\n\t) return 1;\r\n\tif (a) return 1;\r\n\tconst value = b;\r\n\tif (value) return 2;\r\n\tif (c) return 3;\r\n}\r\n";
	const { result, after } = invoke("typescript", source);
	const logical = result.groups.find((group: any) => group.kind === "logical-chains") ;
	const guards  = result.groups.find((group: any) => group.kind === "return-guards" ) ;
	expect(logical.axes.flatMap((axis: any) => axis.points).some((point: any) => point.anchor === "virtual" && !point.editable)).toBe   (true      ) ;
	expect(guards.rowLines                                                                                                     ).toEqual([7, 9, 10]) ;
	expect(after                                                                                                               ).toBe   (source    ) ;
});

test("Python rejects unsupported BOM and lone CR without changing bytes", () => {
	for (const source of ["\uFEFFx = 1\n", "x = 1\ry = 2\r"]) {
		const result = invoke("python", source);
		expect([result.result.state, result.exit]).toEqual(["ERROR", 2]);
		expect(result.after).toBe(source);
	}
});

test("TypeScript reports a non-declaration pair as unmeasurable", () => {
	const source = "interface Example {\n first: string;\n second: number;\n}\n";
	const { result, exit, after } = invoke("typescript", source);
	expect(exit                        ).toBe           (1             ) ;
	expect(result.state                ).toBe           ("UNMEASURABLE") ;
	expect(result.groups[0].rowLines   ).toEqual        ([2, 3]        ) ;
	expect(result.groups[0].axes.length).toBeGreaterThan(0             ) ;
	expect(after                       ).toBe           (source        ) ;
});

test("unsupported file extensions return one in text and JSON modes", () => {
	const script = join(root, "product/engine/python/measure-columns.ts");
	for (const args of [["--file", "sample.txt"], ["--file", "sample.txt", "--json"]]) {
		const result = Bun.spawnSync(["bun", script, ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
		expect(result.exitCode).toBe(1);
		expect(result.stdout.toString()).toContain("UNMEASURABLE");
	}
});

test("missing Python fails closed without changing the target", () => {
	const workspace = mkdtempSync(join(tmpdir(), "boxbox-measure-missing-"));
	workspaces.push(workspace);
	const source = "a=1\nlonger=2\nthird=3\n"   ;
	const file   = join(workspace, "sample.py") ;
	writeFileSync(file, source);
	const script = join         (root, "product/engine/python/measure-columns.ts"                                                                                                         ) ;
	const run    = Bun.spawnSync([process.execPath, script, "--file", "sample.py", "--json"], { cwd: workspace, env: { ...process.env, PATH: workspace }, stdout: "pipe", stderr: "pipe" }) ;
	expect(run.exitCode                           ).toBe(2      ) ;
	expect(JSON.parse(run.stdout.toString()).state).toBe("ERROR") ;
	expect(readFileSync(file, "utf8")             ).toBe(source ) ;
});

test("an external edit during Python analysis is retained and refused", () => {
	const workspace = mkdtempSync(join(tmpdir(), "boxbox-measure-race-"));
	workspaces.push(workspace);
	const source    = "a=1\nlonger=2\nthird=3\n"   ;
	const file      = join(workspace, "sample.py") ;
	const binaryDir = join(workspace, "bin")       ;
	const fake      = join(binaryDir, "python3")   ;
	const python    = Bun.which("python3")         ;
	expect(python).not.toBeNull();
	mkdirSync(binaryDir);
	writeFileSync(file, source);
	writeFileSync(fake, '#!/bin/sh\n"$REAL_PYTHON" "$@" > "$PYTHON_OUTPUT"\nprintf "external = 9\\n" > "$TARGET"\n/bin/cat "$PYTHON_OUTPUT"\n');
	chmodSync(fake, 0o755);
	const script = join         (root, "product/engine/python/measure-columns.ts"                                                                                                                                                                                              ) ;
	const run    = Bun.spawnSync([process.execPath, script, "--file", "sample.py", "--json"], { cwd: workspace, env: { ...process.env, PATH: binaryDir, REAL_PYTHON: python!, PYTHON_OUTPUT: join(workspace, "analysis.json"), TARGET: file }, stdout: "pipe", stderr: "pipe" }) ;
	expect(run.exitCode                           ).toBe(2               ) ;
	expect(JSON.parse(run.stdout.toString()).state).toBe("ERROR"         ) ;
	expect(readFileSync(file, "utf8")             ).toBe("external = 9\n") ;
});

test("TypeScript vertical outliers are unmeasurable without a write", () => {
	const source = "const open = charTokenAt(source, skipTrivia(source.text, node.expression.getEnd()));\nconst close = charTokenAt(source, node.getEnd() - 1);\n";
	const { result, exit, after } = invoke("typescript", source);
	expect(exit                                                                          ).toBe(1             ) ;
	expect(result.state                                                                  ).toBe("UNMEASURABLE") ;
	expect(result.groups.some((group: any) => group.reason?.includes("vertical outlier"))).toBe(true          ) ;
	expect(after                                                                         ).toBe(source        ) ;
});

test("Python parameter columns preserve owner, marker, non-BMP data and CRLF", () => {
	const source = 'def f(\r\n    first: str,\r\n    *,\r\n    label: str = "🥚",\r\n    enabled: bool = True,\r\n):\r\n    pass\r\n';
	const { result, exit, after } = invoke("python", source);
	expect(exit).toBe(1);
	const group = result.groups.find((item: any) => item.rowLines.join(",") === "2,4,5");
	expect(group).toBeDefined();
	const colon = group.axes.find((axis: any) => axis.axis === "colon");
	expect(colon.points.map((point: any) => point.currentColumn)).toEqual([9, 9, 11]);
	const value = group.axes.find((axis: any) => axis.axis === "value");
	expect(value.points.map((point: any) => point.currentColumn)).toEqual([17, 20]);
	expect(after).toBe(source);
});


test("aligned TypeScript and Python groups report MATCH and unchanged columns", () => {
 for (const [language, source] of [
  ["typescript", "const a  = 1 ;\nconst bb = 2 ;\nconst c  = 3 ;\n"],
  ["python", "a  = 1\nbb = 2\nc  = 3\n"],
 ] as const) {
  const { result, exit, after } = invoke(language, source);
  expect(exit                ).toBe           (0      ) ;
  expect(result.state        ).toBe           ("MATCH") ;
  expect(result.counts.groups).toBeGreaterThan(0      ) ;
  const points = result.groups.flatMap((group: any) => group.axes.flatMap((axis: any) => axis.points));
  expect(points.length                                                           ).toBeGreaterThan(0     ) ;
  expect(points.every((point: any) => point.currentColumn === point.targetColumn)).toBe           (true  ) ;
  expect(after                                                                   ).toBe           (source) ;
 }
});

test("a singleton initializer axis has no planner target", () => {
 const source = 'class C {\n a      : string      ;\n longer : string = "" ;\n c      : string      ;\n}\n';
 const { result, exit, after } = invoke("typescript", source);
 const axis = result.groups[0].axes.find((item: any) => item.axis === "equals");
 expect(exit                                               ).toBe     (1                             ) ;
 expect(result.state                                       ).toBe     ("UNMEASURABLE"                ) ;
 expect(axis.points.map((point: any) => point.targetColumn)).toEqual  ([null]                        ) ;
 expect(result.groups[0].reason                            ).toContain("no horizontal planner target") ;
 expect(after                                              ).toBe     (source                        ) ;
});

test("Python tabs and trailing comments retain actual display columns", () => {
 const source = "if True:\n\ta = 1 # one\n\tlonger = 2 # two\n\tc = 3 # three\n";
 const { result, exit, after } = invoke("python", source);
 const axis = result.groups[0].axes.find((item: any) => item.axis === "equal");
 expect(exit                                                ).toBe   (1           ) ;
 expect(result.state                                        ).toBe   ("MISMATCH"  ) ;
 expect(axis.points.map((point: any) => point.currentColumn)).toEqual([6, 11, 6]  ) ;
 expect(axis.points.map((point: any) => point.targetColumn) ).toEqual([11, 11, 11]) ;
 expect(after                                               ).toBe   (source      ) ;
});

test("wide Python keys are refused without a target", () => {
 const source = "values = {\n    \"가\": 1,\n    \"나다\": 2,\n    \"라\": 3,\n}\n"; // cjk-test-data
 const { result, exit, after } = invoke("python", source);
 const points = result.groups[0].axes.flatMap((axis: any) => axis.points);
 expect(exit                                                     ).toBe           (1                ) ;
 expect(result.state                                             ).toBe           ("UNMEASURABLE"   ) ;
 expect(result.groups[0].reason                                  ).toBe           ("wide characters") ;
 expect(points.length                                            ).toBeGreaterThan(0                ) ;
 expect(points.every((point: any) => point.targetColumn === null)).toBe           (true             ) ;
 expect(after                                                    ).toBe           (source           ) ;
});
