import { describe, expect, test } from "bun:test";
import {
	horizontalWhitespaceRanges,
	preservesTokens,
	preservesTokensWithBreaks,
	tokenStream,
} from "@/typescript/16_token-preservation.ts";
import { loadSourceFile } from "@/typescript/15_load-source-file.ts";
import { straySemicolonPadding, straySemicolonPaddings } from "@/common/23_report.ts";
import { assertAlignmentOnly } from "@/common/10_alignment-only.ts";
import { SyntaxKind } from "typescript/unstable/ast";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captureLifecycleBaseline, compareBaselineFootprints } from "@/common/32_lifecycle-baseline.ts";

describe("TypeScript ambiguous slash refusal", () => {
	const ambiguous = [
		["if header", "if(x)/a  b/;"],
		["while header", "while(x)/a  b/.test(s);"],
		["for header", "for(;x;)/a  b/.test(s);"],
		["block end", "if(x){} /a  b/.test(s);"],
		["ASI declaration", "let x\n/a  b/.test(s);"],
		["ASI import", 'import x from "x"\n/a  b/.test(s);'],
		["ASI label", "outer: while(x){break outer\n/a  b/.test(s);}"],
		["template scanner state", 'const x = `${(()=>{if(x)/{/.test(s);})()}\na  b`;'],
		["invalid fragment", ") /a  b/;"],
	] as const;
	for (const [name, before] of ambiguous) {
		test(`refuses ${name} before exposing literal gaps`, () => {
			const after = before.replace("a  b", "a b");

			expect(() => tokenStream(before)                                                       ).toThrow("ambiguous slash"       ) ;
			expect(horizontalWhitespaceRanges(before)                                              ).toEqual([]                      ) ;
			expect(preservesTokens(before, after)                                                  ).toBe   (false                   ) ;
			expect(preservesTokensWithBreaks(before, after)                                        ).toBe   (false                   ) ;
			expect(() => assertAlignmentOnly(Buffer.from(before), Buffer.from(after), "typescript")).toThrow("alignment-only refusal") ;
			expect(preservesTokens(before, before)                                                 ).toBe   (true                    ) ;
			expect(preservesTokensWithBreaks(before, before)                                       ).toBe   (true                    ) ;
		});
	}

	for (const [name, separator] of [
		["LF", "\n"],
		["CR", "\r"],
		["CRLF", "\r\n"],
		["line separator", "\u2028"],
		["paragraph separator", "\u2029"],
	] as const) {
		for (const comment of [false, true]) {
			test(`tracks ${name}${comment ? " inside a comment" : ""} before a slash`, () => {
				const between = comment ? ` /*${separator}*/ ` : separator ;
				const before  = `let x${between}/a  b/.test(s);`           ;

				expect(() => tokenStream(before)                             ).toThrow("ambiguous slash") ;
				expect(preservesTokens(before, before.replace("a  b", "a b"))).toBe   (false            ) ;
				expect(horizontalWhitespaceRanges(before)                    ).toEqual([]               ) ;
			});
		}
	}

	for (const expression of ["n", "4", '"4"', "n /*note*/", "`${n}`"] as const) {
		test(`keeps same-line division after ${expression}`, () => {
			const before = `const x = ${expression} / a  / b;`;

			expect(preservesTokens(before, before.replace("a  /", "a /"))).toBe(true);
			expect(preservesTokensWithBreaks(before, before.replace("a  /", "a /"))).toBe(true);
		});
	}

	for (const expression of ["f()", "(n)", "{}", "function(){}", "class{}"] as const) {
		test(`conservatively refuses division after ${expression}`, () => {
			const before = `const x = ${expression} / a  / b;\nconst longer = 3;`;

			expect(() => tokenStream(before)                                                  ).toThrow("ambiguous slash") ;
			expect(preservesTokens(before, before.replace("a  /", "a /"))                     ).toBe   (false            ) ;
			expect(preservesTokensWithBreaks(before, before.replace(";\nconst", ";\n\nconst"))).toBe   (false            ) ;
			expect(preservesTokens(before, before.replace("longer =", "longer  ="))           ).toBe   (false            ) ;
		});
	}
});

describe("TypeScript skipped Unicode line breaks", () => {
	const newlineTokens = (text: string): readonly string[] => tokenStream(text).filter(token => token.startsWith(`${SyntaxKind.NewLineTrivia}:`));

	for (const [name, separator] of [["LS", "\u2028"], ["PS", "\u2029"]] as const) {
		for (const [position, before] of [
			["only input", separator],
			["leading", `${separator}x;`],
			["trailing", `x;${separator}`],
			["between tokens", `return${separator}x;`],
			["before trailing whitespace", `x;${separator} \t`],
		] as const) {
			test(`preserves ${name} ${position}`, () => {
				const after = before.replace(separator, " ");

				expect(newlineTokens(before)                                                                                    ).toEqual([`${SyntaxKind.NewLineTrivia}:${separator}`]) ;
				expect(preservesTokens(before, after)                                                                           ).toBe   (false                                       ) ;
				expect(preservesTokensWithBreaks(before, after)                                                                 ).toBe   (true                                        ) ;
				expect(horizontalWhitespaceRanges(before).every(range => /^[ \t]+$/u.test(before.slice(range.start, range.end)))).toBe   (true                                        ) ;
			});
		}

		for (const [kind, before] of [
			["comment", `/*a${separator}b*/ x;`],
			["string", `const x="a${separator}b";`],
			["template", 'const x=`a' + separator + 'b${x}c' + separator + '`;'],
		] as const) {
			test(`keeps ${name} inside a ${kind} in its opaque token`, () => {
				const after = before.replaceAll(separator, " ");

				expect(newlineTokens(before)                   ).toEqual([]   ) ;
				expect(preservesTokens(before, after)          ).toBe   (false) ;
				expect(preservesTokensWithBreaks(before, after)).toBe   (false) ;
			});
		}

		test(`preserves ${name} after a line comment and inside an interpolation`, () => {
			const comment  = `//a${separator}x;`                  ;
			const template = 'const x=`a${' + separator + 'x}b`;' ;

			expect(newlineTokens(comment)                                               ).toEqual([`${SyntaxKind.NewLineTrivia}:${separator}`]) ;
			expect(newlineTokens(template)                                              ).toEqual([`${SyntaxKind.NewLineTrivia}:${separator}`]) ;
			expect(preservesTokens(template, template.replace(separator, " "))          ).toBe   (false                                       ) ;
			expect(preservesTokensWithBreaks(template, template.replace(separator, " "))).toBe   (true                                        ) ;
		});

		test(`classifies ${name} return-boundary loss as content in lifecycle metadata`, () => {
			const root   = mkdtempSync(join(tmpdir(), "boxbox-ts-linebreak-"))                                  ;
			const file   = join(root, "sample.ts")                                                              ;
			const before = `function f(){return${separator}x;}`                                                 ;
			const after  = "function f(){return x;}"                                                            ;
			const hashes = (text: string) => ({ "sample.ts": createHash("sha256").update(text).digest("hex") }) ;

			try {
				writeFileSync(file, before);
				const baseline = captureLifecycleBaseline(root, hashes(before));
				writeFileSync(file, after);
				const comparison = compareBaselineFootprints(root, baseline, hashes(after));

				expect(baseline.footprints["sample.ts"]!.s).not.toBeNull();
				expect(comparison.files[0]!.change).toBe("content");
				expect(comparison.files[0]!.whitespaceBytes).toBeNull();
			} finally {
				rmSync(root, { recursive: true, force: true });
			}
		});
	}

	test("keeps consecutive mixed separators in order without duplicating skipped gaps", () => {
		const before = " \u2028\t\u2029\u2028 x; \u2029 ";

		expect(newlineTokens(before)                                         ).toEqual(["\u2028", "\u2029", "\u2028", "\u2029"].map(value => `${SyntaxKind.NewLineTrivia}:${value}`)) ;
		expect(preservesTokens(before, before.replace("x;", "x ;"))          ).toBe   (true                                                                                         ) ;
		expect(preservesTokens(before, before.replaceAll("\u2028", "\u2029"))).toBe   (false                                                                                        ) ;
	});
});

describe("TypeScript positive slash contexts", () => {
	for (const [name, before] of [
		["contextual identifier", 'const type=1; const result=type / /a  b/.test("a  b");'],
		["private field", 'class A { #x=1; f(){return this.#x / /a  b/.test("a  b");}}'],
		["keyword property", 'const obj={return:1}; const result=obj.return / /a  b/.test("a  b");'],
		["optional keyword property", 'const result=obj?.return / /a  b/.test("a  b");'],
		["non-null assertion", 'declare const x:number; const result=x! / /a  b/.test("a  b");'],
		["generic instantiation", 'declare function f<T>():number; const result=f<number> / /a  b/.test("a  b");'],
		["nested generic instantiation", "const x=f<A<B>> / /a  b/;"],
		["prefix increment", "const x=++/a  b/;"],
		["postfix increment", "let x=1; x++ / /a  b/;"],
		["unary bang", "const x=!/a  b/;"],
		["contextual await", "function f(){const await=1; return await / /a  b/;}"],
	] as const) {
		test(`protects regex text after ${name}`, () => {
			const after = before.replace("/a  b/", "/a b/") ;
			const gap   = before.indexOf("/a  b/") + 2      ;

			expect(preservesTokens(before, after)                                                              ).toBe   (false                   ) ;
			expect(preservesTokensWithBreaks(before, after)                                                    ).toBe   (false                   ) ;
			expect(horizontalWhitespaceRanges(before).some(range => range.start <= gap && range.end >= gap + 2)).toBe   (false                   ) ;
			expect(() => assertAlignmentOnly(Buffer.from(before), Buffer.from(after), "typescript")            ).toThrow("alignment-only refusal") ;
		});
	}

	for (const [name, before] of [
		["assignment", "const x=/a  b/;"],
		["return", "function f(){return /a  b/;}"],
		["throw", "throw /a  b/;"],
		["binary operator", "const x=n + /a  b/;"],
		["logical operator", "const x=n && /a  b/;"],
		["assignment operator", "let x=1; x /= /a  b/;"],
		["conditional operator", "const x=n ? /a  b/ : /c/;"],
		["arrow body", "const f=()=> /a  b/;"],
		["template head", 'const x=`${/a  b/}`;'],
		["template middle", 'const x=`${1}${/a  b/}`;'],
	] as const) {
		test(`recognizes a regex in ${name}`, () => {
			expect(() => tokenStream(before)).not.toThrow();
			expect(preservesTokens(before, before.replace("/a  b/", "/a b/"))).toBe(false);
		});
	}

	test("keeps private-field division gaps without an unavailable fallback", () => {
		const before = "class A {#x=1; f(){return this.#x / a  / b;}}";

		expect(() => tokenStream(before)).not.toThrow();
		expect(preservesTokens(before, before.replace("a  /", "a /"))).toBe(true);
	});
});

describe("TypeScript regex expression endings", () => {
	const contexts = [
		["regex division", 'const result = /a/ / /b  c/.test("b  c");', "/b  c/"],
		["chained division", "const r = /a/ / /b  c/ / /d/;", "/b  c/"],
		["numeric and regex division", "const r = 1 / /a/ / /b  c/;", "/b  c/"],
		["regex flags", "const r = /a/g / /b  c/u.test(s);", "/b  c/"],
		["comment before division", "const r = /a/ /*gap*/ / /b  c/;", "/b  c/"],
		["newline before division", "const r = /a/\n/ /b  c/;", "/b  c/"],
		["template interpolation", 'const x = `${/a/ / /b  c/.test(s)}`;', "/b  c/"],
		["nested interpolation", 'const x = `${`${/a/ / /b  c/}`}`;', "/b  c/"],
		["template brace state", 'const x = `${/a/ / /{/.test(s)}\na  b`;', "a  b"],
		["array expression", "const x = [/a/ / /b  c/, /d/];", "/b  c/"],
		["character class in first regex", "const x = /[/]/ / /b  c/;", "/b  c/"],
		["escaped slash in first regex", "const x = /a\\// / /b  c/;", "/b  c/"],
		["division assignment", "let x = /a/; x /= /b  c/.test(s);", "/b  c/"],
		["return expression", "function f(){return /b  c/;}", "/b  c/"],
		["assignment expression", "const x = /b  c/;", "/b  c/"],
		["call argument", "f(/b  c/);", "/b  c/"],
		["conditional expression", "const x = /a/ ? /b  c/ : /d/;", "/b  c/"],
		["logical expression", "const x = /a/ && /b  c/;", "/b  c/"],
		["typeof expression", "const x = typeof /b  c/;", "/b  c/"],
	] as const;

	for (const [name, before, target] of contexts) {
		test(`protects literal content in ${name}`, () => {
			const after = before.replace(target, target.replace("  ", " ")) ;
			const gap   = before.indexOf(target) + target.indexOf("  ")     ;

			expect(preservesTokens(before, after)                                                              ).toBe   (false                   ) ;
			expect(preservesTokensWithBreaks(before, after)                                                    ).toBe   (false                   ) ;
			expect(horizontalWhitespaceRanges(before).some(range => range.start <= gap && range.end >= gap + 2)).toBe   (false                   ) ;
			expect(() => assertAlignmentOnly(Buffer.from(before), Buffer.from(after), "typescript")            ).toThrow("alignment-only refusal") ;
		});
	}

	for (const [before, target, output] of [
		["const x = /a/  /  2;", "  /", " /"],
		["const x = /a/ /  /b/.test(s);", "/  /b", "/ /b"],
		["const x = /a/ / /b/ /  2;", "/  2", "/ 2"],
	] as const) {
		test(`keeps code gaps in ${before}`, () => {
			const after = before.replace(target, output);

			expect(preservesTokens(before, after)).toBe(true);
			expect(preservesTokensWithBreaks(before, after)).toBe(true);
		});
	}

	test("refuses joining a division operator and regex into a comment", () => {
		const before = "const x = /a/ / /b/.test(s);" ;
		const after  = before.replace("/ /b", "//b")  ;

		expect(preservesTokens(before, after)).toBe(false);
		expect(preservesTokensWithBreaks(before, after)).toBe(false);
	});
});


async function parserSnapshot(text: string, file = "sample.ts") {
	const root = mkdtempSync(join(tmpdir(), "boxbox-parser-slash-"));
	try {
		writeFileSync(join(root, file), text);
		return (await loadSourceFile(root, file)).source;
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

describe("parser-confirmed TypeScript slash roles", () => {
	for (const [name, before] of [
		["call division", "const result = Number(3) / 1e6;"],
		["grouped division", "const result = (3) / 2;"],
		["unary bang regex", 'const result = !/a  b/.test("a  b");'],
		["non-null division and regex", 'declare const n:number; const result = n! / /a  b/.test("a  b");'],
		["regex after if header", 'if (ready) /a  b/.test("a  b"); const result = 1;'],
		["regex after block", 'if (ready) {} /a  b/.test("a  b"); const result = 1;'],
	] as const) {
		test(name, async () => {
			const parsed = await parserSnapshot(before);

			const after = before.replace("result =", "result  =");

			expect(() => tokenStream(before, parsed)).not.toThrow();
			expect(preservesTokens(before, after, parsed)).toBe(true);
			expect(() => assertAlignmentOnly(Buffer.from(before), Buffer.from(after), "typescript", parsed)).not.toThrow();
			if (before.includes("/a  b/")) {
				const changed = after.replace("/a  b/", "/a b/");

				const interior = before.indexOf("/a  b/") + 2;
				expect(preservesTokens(before, changed, parsed)).toBe(false);
				expect(preservesTokensWithBreaks(before, changed, parsed)).toBe(false);

				expect(horizontalWhitespaceRanges(before, parsed).some(range => range.start <= interior && range.end >= interior + 2)).toBe(false);

				expect(() => assertAlignmentOnly(Buffer.from(before), Buffer.from(changed), "typescript", parsed)).toThrow("alignment-only refusal");
			}
		}, 30_000);
	}

	test("stale parser snapshots do not authorize gaps", async () => {
		const before = 'const result = !/a  b/.test("a  b");';

		const parsed = await parserSnapshot(before);

		const current  = before .replace( "result =", "result  =" ) ;
		const extended = current.replace("result  =", "result   =") ;

		expect(() => tokenStream(current, parsed)).toThrow("ambiguous slash");

		expect(horizontalWhitespaceRanges(current, parsed)).toEqual([]);

		expect(preservesTokens(current, extended, parsed)).toBe(false);
	}, 30_000);

	test("candidate slash roles cannot be added, removed or merged into a comment", async () => {
		const before = 'const result = Number(2) / /a  b/.test("a  b");';

		const parsed = await parserSnapshot(before);

		for (const after of [before.replace(" / /", " //"), before.replace(" / /a  b/", " /a  b/"), before.replace("Number(2)", "Number(2) / 2")]) {
			expect(preservesTokens(before, after, parsed)).toBe(false);
		}
	}, 30_000);
});


test("parser-aware reports keep code gaps and exclude regex content", async () => {
	const before = 'function f() {\n\tconst invalid = !/a ;/.test("a ;");\n\n\treturn value  ;\n}\n';

	const parsed = await parserSnapshot(before);

	const lines = before.split("\n");

	expect(straySemicolonPadding(lines, 3, parsed)).toBe(2);
	expect([...straySemicolonPaddings(lines, parsed)]).toEqual([[3, 2]]);
	expect(straySemicolonPadding(lines, 1, parsed)).toBeUndefined();
}, 30_000);


describe("parser-confirmed JSX lexical boundaries", () => {
	for (const before of [
		'const view = <div>  hello  world\n</div>;',
		'const view = <><span title="a \\ b">hello  world</span><br /></>;',
		'const view = <div>{Number(3) / 2} hello  world {!/a  b/.test("a  b")}</div>;',
		'const view = <div>{\u0060a \${<b> hello  world </b>}\u0060}</div>;',
		'const view = <div>  /look like regex/ // hello  world &amp; text </div>;',
	] as const) {
		test(before, async () => {
			const parsed = await parserSnapshot(before, "sample.tsx");

			const after = before.replace("view =", "view  =");

			const literalGap = before.indexOf("hello  world") + 5;

			expect(() => tokenStream(before, parsed)).not.toThrow();
			expect(preservesTokens(before, after, parsed)).toBe(true);
			expect(() => assertAlignmentOnly(Buffer.from(before), Buffer.from(after), "typescript", parsed)).not.toThrow();
			expect(preservesTokens(before, after.replace("hello  world", "hello world"), parsed)).toBe(false);
			expect(horizontalWhitespaceRanges(before, parsed).some(range => range.start <= literalGap && range.end > literalGap)).toBe(false);
		}, 30_000);
	}

	test("JSX text leading, trailing, newline and attribute bytes stay protected", async () => {
		const before = 'const view = <div title="a \\ b">  hello  world\n </div>;';

		const parsed = await parserSnapshot(before, "sample.tsx");

		for (const after of [
			before.replace(">  hello", "> hello"),
			before.replace("world\n ", "world\n"),
			before.replace("world\n ", "world "),
			before.replace("a \\ b", "a  \\ b"),
		]) {
			expect(preservesTokens(before, after, parsed)).toBe(false);
			expect(preservesTokensWithBreaks(before, after, parsed)).toBe(false);
		}
	}, 30_000);

	test("parser-aware reports do not treat JSX text as stray source padding", async () => {
		const before = 'function f() {\n\tconst view = <div>\nJSX text  ;\n</div>;\n\n\treturn view  ;\n}\n';

		const parsed = await parserSnapshot(before, "sample.tsx");


		expect([...straySemicolonPaddings(before.split("\n"), parsed)]).toEqual([[5, 2]]);
	}, 30_000);
});
