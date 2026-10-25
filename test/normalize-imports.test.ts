import      { afterEach, describe, expect, test } from "bun:test"                           ;
import      {
              existsSync                      ,
              mkdtempSync                     ,
              readFileSync                    ,
              rmSync                          ,
              writeFileSync
                                                } from "node:fs"                            ;
import      { join, relative, resolve           } from "node:path"                          ;

import      { preservesTokensWithBreaks         } from "@/typescript/token-preservation.ts" ;

const root                 = resolve(import.meta.dir, "..")                                     ;
const script               = resolve(root, "product/engine/typescript/00_normalize-imports.ts") ;
const workspaces: string[] = []                                                                 ;

afterEach(() => {
	for (const workspace of workspaces.splice(0)) rmSync(workspace, { recursive: true, force: true });
});

/** Writes `lines` to a temporary file, normalizes it in place and returns the result. */
function normalize(lines: readonly string[]): string {
	const workspace = mkdtempSync(join(import.meta.dir, "normalize-imports-")) ;
	const target    = join       (workspace, "imports.ts"                    ) ;
	workspaces.push(workspace);
	writeFileSync(target, lines.join("\n") + "\n");
	const run = Bun.spawnSync(["bun", script, "--write", relative(root, target)], { cwd: root, stderr: "pipe", stdout: "pipe" });
	expect(run.exitCode).toBe(0);
	const check = Bun.spawnSync(["bun", script, relative(root, target)], { cwd: root, stderr: "pipe", stdout: "pipe" });
	expect(check.stdout.toString()).toContain("changed=0");
	return readFileSync(target, "utf8");
}

function normalizeLayout(source: string): string {
	const workspace = mkdtempSync(join(import.meta.dir, "normalize-imports-layout-")) ;
	const target    = join       (workspace, "imports.ts"                           ) ;
	workspaces.push(workspace);
	writeFileSync(target, source);
	const run = Bun.spawnSync(["bun", script, "--write", "--layout-only", relative(root, target)], { cwd: root, stderr: "pipe", stdout: "pipe" });
	expect(run.exitCode).toBe(0);
	const after = readFileSync(target, "utf8");
	expect(preservesTokensWithBreaks(source, after)).toBe(true);
	const check = Bun.spawnSync(["bun", script, "--layout-only", relative(root, target)], { cwd: root, stderr: "pipe", stdout: "pipe" });
	expect(check.exitCode).toBe(0);
	expect(check.stdout.toString()).toContain("changed=0");
	return after;
}

async function waitForFile(path: string): Promise<void> {
	for (let attempt = 0; attempt < 200; attempt += 1) {
		if (existsSync(path)) return;
		await Bun.sleep(5);
	}
	throw new Error(`timed out waiting for ${path}`);
}

describe("import table cells", () => {
	test("preserves trailing comma presence in compact rows", () => {
		const before = [
			'import { alpha, beta, } from "./alpha.ts";',
			'import { gamma, delta } from "./gamma.ts";',
		].join("\n") + "\n";
		const after = normalizeLayout(before);

		expect(after).toContain('{ alpha, beta, }');
		expect(after).toContain('{ gamma, delta }');
	});

	test("preserves trailing comma presence when lifecycle imports go vertical", () => {
		const withComma = [
			'import { existsSync, mkdirSync, readFileSync, writeFileSync, } from "node:fs";',
			'import { join } from "node:path";',
		].join("\n") + "\n";
		const withoutComma = [
			'import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";',
			'import { join } from "node:path";',
		].join("\n") + "\n";

		const preservedComma = normalizeLayout(withComma   ) ;
		const preservedNone  = normalizeLayout(withoutComma) ;

		expect(preservedComma).toContain("writeFileSync ,");
		expect(preservedNone ).not.toContain("writeFileSync ,");
	});

	test("layout-only preserves aliases, trailing comments, attributes and CRLF", () => {
		const before = [
			'import { alpha as renamed, beta, } from "./alpha.ts"; // keep',
			'import { gamma } from "./gamma.ts";',
			'import { schema as dataSchema, } from "./data.json" with { type: "json" };',
		].join("\r\n") + "\r\n";
		const after = normalizeLayout(before);

		expect(after                       )    .toContain('alpha as renamed, beta,'                                                   ) ;
		expect(after                       )    .toContain('// keep'                                                                   ) ;
		expect(after                       )    .toContain('import { schema as dataSchema, } from "./data.json" with { type: "json" };') ;
		expect(after.replaceAll("\r\n", "")).not.toContain("\n"                                                                        ) ;
		expect(normalizeLayout(after)      )    .toBe     (after                                                                       ) ;
	});

	test("keeps full normalization mixed-import splitting and refuses it in layout-only mode", () => {
		const source = 'import { runtime, type Contract } from "./mixed.ts";\n';
		expect(normalize([source.trimEnd()])).toBe([
			'import      { runtime  } from "./mixed.ts" ;',
			'import type { Contract } from "./mixed.ts" ;',
		].join("\n") + "\n");

		const workspace = mkdtempSync(join(import.meta.dir, "normalize-imports-refusal-")) ;
		const target    = join       (workspace, "imports.ts"                            ) ;
		workspaces.push(workspace);
		writeFileSync(target, source);
		const run = Bun.spawnSync(["bun", script, "--write", "--layout-only", relative(root, target)], { cwd: root, stderr: "pipe", stdout: "pipe" });

		expect(run.exitCode                ).toBe     (1                                                        ) ;
		expect(run.stderr.toString()       ).toContain("layout-only refuses token-changing import normalization") ;
		expect(readFileSync(target, "utf8")).toBe     (source                                                   ) ;
	});

	test("layout-only keeps an external edit made while the staged candidate is verified", async () => {
		const workspace = mkdtempSync(join(import.meta.dir, "normalize-imports-race-")) ;
		const target    = join       (workspace, "imports.ts"                         ) ;
		const source    = [
			'import { alpha, beta, } from "./alpha.ts";',
			'import { gamma } from "./gamma.ts";',
		].join("\n") + "\n";
		const external = "export const externallyEdited = true;\n";
		workspaces.push(workspace);
		writeFileSync(target, source);
		const run = Bun.spawn(["bun", script, "--write", "--layout-only", relative(root, target)], { cwd: root, stderr: "pipe", stdout: "pipe" });
		await waitForFile(join(workspace, ".imports.ts.boxbox-write.lock"));
		writeFileSync(target, external);
		const [exitCode, stderr, stdout] = await Promise.all([
			run.exited,
			new Response(run.stderr).text(),
			new Response(run.stdout).text(),
		]);

		expect(exitCode                    )    .toBe     (1                 ) ;
		expect(stderr                      )    .toContain("target changed"  ) ;
		expect(stdout                      ).not.toContain("fixed"           ) ;
		expect(readFileSync(target, "utf8"))    .toBe     (external          ) ;
	});

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
			'              isVariableStatement',
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
			'              epsilon',
			'                        } from "./greek.ts" ;',
			'import      { one       } from "./one.ts"   ;',
		].join("\n") + "\n");
	});

	test("when long names and a long module on different rows push the table past 120, the widest names go vertical", () => {
		expect(normalize([
			'import { afterEach, describe, expect, test } from "bun:test";',
			'import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";',
			'import { preservesTokens } from "@/typescript/token-preservation.ts";',
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
