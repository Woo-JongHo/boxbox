import      { afterEach, describe, expect, test                } from "bun:test"                           ;
import      { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"                            ;
import      { tmpdir                                           } from "node:os"                            ;
import      { join, resolve                                    } from "node:path"                          ;
import      { preservesTokens                                  } from "@/typescript/token-preservation.ts" ;
import type { ResultEnvelope, ResultGroup                      } from "@/common/result-json.ts"            ;
import      { lookupKeyOf                                      } from "@/common/signature.ts"              ;

const script               = resolve(import.meta.dir, "../product/engine/typescript/06_align-tables.ts") ;
const workspaces: string[] = []                                                                          ;

afterEach(() => {
	for (const workspace of workspaces.splice(0)) rmSync(workspace, { recursive: true, force: true });
});

function align(lines: readonly string[]): { text: string; groups: readonly ResultGroup[] } {
	const root   = mkdtempSync(join(tmpdir(), "boxbox-matrix-")) ;
	const file   = join(root, "sample.ts")                       ;
	const before = `${lines.join("\n")}\n`                       ;

	workspaces.push(root);
	writeFileSync(file, before);

	const first = Bun.spawnSync(["bun", script, "--file", "sample.ts", "--write", "--json"], { cwd: root });
	expect(first.exitCode).toBe(0);
	if (first.exitCode !== 0) throw new Error(first.stderr.toString());

	const text    = readFileSync (file, "utf8"                                                   ) ;
	const checked = Bun.spawnSync(["bun", script, "--file", "sample.ts", "--json"], { cwd: root }) ;

	expect(checked.exitCode                                    ).toBe   (0                                                     ) ;
	expect(preservesTokens(before, text)                       ).toBe   (true                                                  ) ;
	expect(text.split("\n").length                             ).toBe   (before.split("\n").length                             ) ;
	expect(text.split("\n").map(line => /^\s*/u.exec(line)![0])).toEqual(before.split("\n").map(line => /^\s*/u.exec(line)![0])) ;

	const report = JSON.parse(checked.stdout.toString()) as ResultEnvelope;

	return { text, groups: report.results[0]!.groups };
}

describe("matrix syntax boundaries", () => {
	test("shares the receiver-method dot as well as outer call parentheses", () => {
		const result = align([
			"const rows = Array.from(items);",
			"const over = rows.filter(isVisible);",
		]);

		expect(result.text).toBe("const rows = Array.from  (items    ) ;\nconst over = rows .filter(isVisible) ;\n");
		expect(result.groups[0]!.axes).toContain("call-member-dot=18");
	}, 60_000);

	test("matches the final method separator while preserving nested receivers and argument dots", () => {
		const result = align([
			"const rows = registry.rows.from(items);",
			"const over = rows.filter(value => value.amount > 1.5 && value.name === 'a.b');",
			"const plain = resolve(items);",
		]);
		const lines = result.text.split("\n");

		expect(lines[0]!.indexOf(".from")).toBe     (lines[1]!.indexOf(".filter")                         ) ;
		expect(lines[0]                  ).toContain("registry.rows"                                      ) ;
		expect(lines[1]                  ).toContain("value => value.amount > 1.5 && value.name === 'a.b'") ;
		expect(result.groups[0]!.kind    ).toBe     ("declaration-call-envelope"                          ) ;
	}, 60_000);

	test("keeps member-boundary comments outside the call-envelope contract", () => {
		const result = align([
			"const rows = Array /* keep */ .from(items);",
			"const over = rows. /* keep */ filter(isVisible);",
		]);

		expect(result.text                                                            ).toContain("Array /* keep */ .from(items)"     ) ;
		expect(result.text                                                            ).toContain("rows. /* keep */ filter(isVisible)") ;
		expect(result.groups.some(group => group.kind === "declaration-call-envelope")).toBe     (false                               ) ;
	}, 60_000);

	test("shares return columns across declarations and blank lines without moving statements", () => {
		const result = align([
			"function read(value: unknown) {",
			"\tif (!value) return undefined;",
			"\tconst declared = value;",
			"",
			"\tif (declared === undefined) return undefined;",
			"\tconst unwrapped = declared;",
			"\tif (typeof unwrapped !== 'string') return undefined;",
			"\treturn unwrapped;",
			"}",
		]);

		expect(result.text).toBe([
			"function read(value: unknown) {",
			"\tif (!value)                        return undefined;",
			"\tconst declared = value;",
			"",
			"\tif (declared === undefined)        return undefined;",
			"\tconst unwrapped = declared;",
			"\tif (typeof unwrapped !== 'string') return undefined;",
			"\treturn unwrapped;",
			"}",
			"",
		].join("\n"));
		expect(result.groups.filter(group => group.kind === "return-guards")).toHaveLength(1);
	}, 60_000);

	test("comments, unsupported guards, terminal statements and nested declarations break guard regions", () => {
		const barriers = [
			"\t// a separate region",
			"\tif (other) { return undefined; }",
			"\tif (other) return undefined; else handle();",
			"\treturn undefined;",
			'\tthrow new Error("stop");',
			"\tbreak;",
			"\tcontinue;",
			"\tfunction nested() {}",
			"\tclass Nested {}",
		];
		const lines = barriers.flatMap((barrier, index) => [
			`function check${index}() {`,
			"\tfor (;;) {",
			"\tif (a) return undefined;",
			"\tif (longCondition) return undefined;",
			barrier,
			"\tif (b) return undefined;",
			"\tif (anotherLongCondition) return undefined;",
			"\t}",
			"}",
		]);
		const result = align(lines);

		expect(result.text).toBe(`${lines.join("\n")}\n`);
		expect(result.groups.filter(group => group.kind === "return-guards")).toHaveLength(0);
	}, 60_000);

	test("subjectCall-shaped guards share return columns across while, statements and multiline declarations", () => {
		const result = align([
			"function subjectCall(node: Node): Node | undefined {",
			"\tif (!isExpressionStatement(node)) return undefined;",
			"\tconst expression = unwrapExpression(node.expression);",
			"\tif (!isCallExpression(expression) || !isPropertyAccessExpression(expression.expression)) return undefined;",
			"\tlet subject: Node = expression.expression.expression;",
			"\twhile (isPropertyAccessExpression(subject)) subject = subject.expression;",
			"\tobserve(subject);",
			"\tconst intermediate = (\n\t\tsubject\n\t);",
			"\tif (!isCallExpression(subject) || subject.arguments.length !== 1) return undefined;",
			"\tconst argument = subject.arguments[0]!;",
			"\treturn isCallExpression(argument) && argument.arguments.length > 0 ? argument : undefined;",
			"}",
		]);
		const guards = result.text.split("\n").filter(line => line.startsWith("\tif ("));

		expect(guards                                                       ).toHaveLength(3                                                                            ) ;
		expect(new Set(guards.map(line => line.indexOf("return")))          ).toHaveLength(1                                                                            ) ;
		expect(result.groups.filter(group => group.kind === "return-guards")).toHaveLength(1                                                                            ) ;
		expect(result.text                                                  ).toContain   ("\twhile (isPropertyAccessExpression(subject)) subject = subject.expression;") ;
	}, 60_000);

	test("callLayer-shaped guards bridge a for block whose own guards have independent return columns", () => {
		const result = align([
			"function callLayer(source: SourceFile, call: Node) {",
			"\tif (call.typeArguments) return undefined;",
			"\tconst callee = call.expression;",
			"\tconst open = tokenAfter(source, callee.getEnd(), '(');",
			"\tconst items = callArguments(call);",
			"\tif (open === undefined || items.length === 0) return undefined;",
			"\tconst boundaries: RowBoundary[] = [];",
			"\tfor (let index = 0; index + 1 < items.length; index += 1) {",
			"\t\tconst end = items[index]!.getEnd();",
			"\t\tconst comma = tokenAfter(source, end, ',');",
			"\t\tif (comma === undefined) return undefined;",
			"\t\tconst next = items[index + 1]!.getStart(source);",
			"\t\tif (!spacesOnly(source, comma + 1, next)) return undefined;",
			"\t\tif (next === end) return undefined;",
			"\t\tboundaries.push({ from: end, at: comma });",
			"\t}",
			"\tconst last = items.at(-1)!.getEnd();",
			"\tconst close = tokenAfter(source, last, ')');",
			"\tif (close === undefined || close !== call.getEnd() - 1) return undefined;",
			"\treturn boundaries;",
			"}",
		]);
		const outer  = result.text.split("\n").filter(line => line.startsWith("\tif ("))   ;
		const inner  = result.text.split("\n").filter(line => line.startsWith("\t\tif (")) ;
		const groups = result.groups.filter(group => group.kind === "return-guards")       ;

		expect(outer                                             )    .toHaveLength(3                          ) ;
		expect(inner                                             )    .toHaveLength(3                          ) ;
		expect(groups                                            )    .toHaveLength(2                          ) ;
		expect(new Set(outer.map(line => line.indexOf("return"))))    .toHaveLength(1                          ) ;
		expect(new Set(inner.map(line => line.indexOf("return"))))    .toHaveLength(1                          ) ;
		expect(outer[0]!.indexOf("return")                       ).not.toBe        (inner[0]!.indexOf("return")) ;
		expect(groups.every(group => group.rows === 3)           )    .toBe        (true                       ) ;
	}, 60_000);

	test("does not pad commented condition boundaries or span nested guard scopes", () => {
		const lines = [
			"function check() {",
			"\tif (a) /* keep */ return undefined;",
			"\tif (bbb) /* keep */ return undefined;",
			"\tif (cc) /* keep */ return undefined;",
			"\tif (outer) return undefined;",
			"\t{",
			"\t\tif (x) return undefined;",
			"\t\tif (longInner) return undefined;",
			"\t\tif (z) return undefined;",
			"\t}",
			"\tif (veryLongOuter) return undefined;",
			"}",
		];
		const result = align               (lines                                  ) ;
		const guards = result.groups.filter(group => group.kind === "return-guards") ;

		expect(guards              ).toHaveLength(1                                      ) ;
		expect(guards[0]!.startLine).toBe        (7                                      ) ;
		expect(guards[0]!.endLine  ).toBe        (9                                      ) ;
		expect(result.text         ).toContain   ("\tif (outer) return undefined;"       ) ;
		expect(result.text         ).toContain   ("\tif (a) /* keep */ return undefined;") ;
	}, 60_000);

	test("aligns different callable envelopes and preserves the trailing non-null assertion", () => {
		const result = align([
			"const decision = registry.decisions.get(convention.id)!;",
			"const document = resolveDocument(decision.ref, convention.layer);",
		]);

		expect(result.text).toBe([
			"const decision = registry.decisions.get(convention.id                 )! ;",
			"const document = resolveDocument       (decision.ref, convention.layer)  ;",
			"",
		].join("\n"));
		expect(result.groups[0]!.kind).toBe("declaration-call-envelope");
		expect(result.groups[0]!.axes.some((axis: string) => axis.startsWith("call-comma"))).toBe(false);
	}, 60_000);

	test("keeps heterogeneous arguments opaque, including different arities, literals and nested calls", () => {
		const result = align([
			'const a = first("(,)", nested(x, y));',
			'const longer = second("hello");',
			'const third = thirdCall(x, /* inside */ y, z);',
		]);
		const lines = result.text.trimEnd().split("\n");

		expect(new Set(lines.map(line => line.indexOf("(", line.indexOf("="))))).toHaveLength(1                                ) ;
		expect(new Set(lines.map(line => line.lastIndexOf(")")))               ).toHaveLength(1                                ) ;
		expect(result.text                                                     ).toContain   ('first    ("(,)", nested(x, y)'  ) ;
		expect(result.text                                                     ).toContain   ('thirdCall(x, /* inside */ y, z)') ;
	}, 60_000);

	test("zero argument calls retain compact parentheses while sharing the opening column", () => {
		const result = align([
			"const a = short();",
			"const bb = muchLonger(value, other);",
		]);

		expect(result.text).toBe("const a  = short     ()             ;\nconst bb = muchLonger(value, other) ;\n");
		expect(result.groups[0]!.axes.some((axis: string) => axis.startsWith("call-envelope-close"))).toBe(false);
	}, 60_000);

	test("keeps await/new/optional/type-argument/computed calls outside the new envelope contract", () => {
		const expressions = ["await first(x)", "new First(x)", "first?.(x)", "object?.first(x)", "first<string>(x)", "object[key](x)", "factory().first(x)", "first /* note */ (x)", "first(x,)", "first(x /* note */)"];
		const result = align(expressions.flatMap((expression, index) => [
			`const value${index} = ${expression};`,
			`const longer${index} = other(x, y);`,
			"",
		]));

		expect(result.groups.some(group => group.kind === "declaration-call-envelope")).toBe(false);
	}, 60_000);

	test("preserves the approved same-call key and output while new envelopes have distinct keys", () => {
		const approved      = align(["const short = make(1);", "const muchLonger = make(22);", "const middle = make(333);"]) ;
		const heterogeneous = align(["const short = first(1);", "const longer = other(22);"])                                ;
		const group         = approved.groups[0]!                                                                            ;

		expect(approved.text                                                   ).toBe("const short      = make(1  ) ;\nconst muchLonger = make(22 ) ;\nconst middle     = make(333) ;\n") ;
		expect(lookupKeyOf("typescript", group.context, group.kind, group.axes)).toBe("v1|typescript|SourceFile|declaration-equals|equals>call-open-paren>call-close-paren>semicolon"   ) ;
		expect(heterogeneous.groups[0]!.kind                                   ).toBe("declaration-call-envelope"                                                                       ) ;
	}, 60_000);
});
