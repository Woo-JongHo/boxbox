import      { afterEach, describe, expect, test                } from "bun:test"  ;
import      { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"   ;
import      { join, relative, resolve                          } from "node:path" ;

const root                 = resolve(import.meta.dir, "..")                                         ;
const script               = resolve(root, "skills/xxx/scripts/typescript/00_normalize-imports.ts") ;
const workspaces: string[] = []                                                                     ;

afterEach(() => {
	for (const workspace of workspaces.splice(0)) rmSync(workspace, { recursive: true, force: true });
});

/** Writes `lines` to a temporary file, normalizes it in place and returns the result. */
function normalize(lines: readonly string[]): string {
	const workspace = mkdtempSync(join(import.meta.dir, "normalize-imports-")) ;
	const target    = join(workspace, "imports.ts")                            ;
	workspaces.push(workspace);
	writeFileSync(target, lines.join("\n") + "\n");
	const run = Bun.spawnSync(["bun", script, "--write", relative(root, target)], { cwd: root, stderr: "pipe", stdout: "pipe" });
	expect(run.exitCode).toBe(0);
	const check = Bun.spawnSync(["bun", script, relative(root, target)], { cwd: root, stderr: "pipe", stdout: "pipe" });
	expect(check.stdout.toString()).toContain("changed=0");
	return readFileSync(target, "utf8");
}

describe("import table cells", () => {
	test("reserves the type head and shares { } from ; columns across the blocks of a section", () => {
		expect(normalize([
			'import { readFileSync, writeFileSync } from "node:fs";',
			'import React, { useState } from "react"; // ui',
			'',
			'import type { Node, SourceFile } from "typescript/unstable/ast";',
			'import { loadSourceFile } from "./load-source-file.ts";',
		])).toBe([
			'import        { readFileSync, writeFileSync } from "node:fs"                 ;',
			'import React, { useState                    } from "react"                   ; // ui',
			'',
			'import type   { Node, SourceFile            } from "typescript/unstable/ast" ;',
			'import        { loadSourceFile              } from "./load-source-file.ts"   ;',
		].join("\n") + "\n");
	});

	test("an import over 120 columns goes vertical inside the table", () => {
		expect(normalize([
			'import { isArrayLiteralExpression, isBlock, isCallExpression, isConditionalExpression, isExpressionStatement, isVariableStatement } from "typescript/unstable/ast";',
			'import type { Node } from "typescript/unstable/ast";',
		])).toBe([
			'import      {',
			'              isArrayLiteralExpression ,',
			'              isBlock                  ,',
			'              isCallExpression         ,',
			'              isConditionalExpression  ,',
			'              isExpressionStatement    ,',
			'              isVariableStatement      ,',
			'                                         } from "typescript/unstable/ast" ;',
			'import type { Node                       } from "typescript/unstable/ast" ;',
		].join("\n") + "\n");
	});

	test("an import whose names outgrow the next widest by 20 goes vertical", () => {
		expect(normalize([
			'import { alpha, beta, gamma, delta, epsilon } from "./greek.ts";',
			'import { one } from "./one.ts";',
		])).toBe([
			'import      {',
			'              alpha   ,',
			'              beta    ,',
			'              gamma   ,',
			'              delta   ,',
			'              epsilon ,',
			'                        } from "./greek.ts" ;',
			'import      { one       } from "./one.ts"   ;',
		].join("\n") + "\n");
	});

	test("when long names and a long module on different rows push the table past 120, the widest names go vertical", () => {
		expect(normalize([
			'import { afterEach, describe, expect, test } from "bun:test";',
			'import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";',
			'import { preservesTokens } from "../skills/xxx/scripts/typescript/token-preservation.ts";',
		]).split("\n").every(line => line.length <= 120)).toBe(true);
	});

	test("imports without braces stay as written and a lone brace import stays compact", () => {
		expect(normalize([
			'import ts from "typescript";',
			'import { a } from "./a.ts";',
			'import * as ns from "./ns.ts";',
			'import { b, c } from "./bc.ts";',
		])).toBe([
			'import ts from "typescript";',
			'import      { a    } from "./a.ts"  ;',
			'import * as ns from "./ns.ts";',
			'import      { b, c } from "./bc.ts" ;',
		].join("\n") + "\n");
		expect(normalize(['import { only } from "./one.ts";'])).toBe('import { only } from "./one.ts";\n');
	});

	test("already aligned rows are recognized and realigned, not skipped", () => {
		expect(normalize([
			'import      { a    } from "./a.ts"  ;',
			'import      { b, c } from "./bc.ts" ;',
			'',
			'import { zzz, yyy } from "./far-away-module.ts";',
		])).toBe([
			'import      { a        } from "./a.ts"               ;',
			'import      { b, c     } from "./bc.ts"              ;',
			'',
			'import      { zzz, yyy } from "./far-away-module.ts" ;',
		].join("\n") + "\n");
	});

	test("files without semicolons get no ; column", () => {
		expect(normalize([
			'import { a } from "./a.ts"',
			'import { bb, cc } from "./bbcc.ts"',
		])).toBe([
			'import      { a      } from "./a.ts"',
			'import      { bb, cc } from "./bbcc.ts"',
		].join("\n") + "\n");
	});
});
