#!/usr/bin/env bun
/**
 * Out-of-table padding cleanup (M1.8, alarm A12). In TypeScript files, removes the spaces before the trailing `;` on A12 target lines, then reruns
 * the aligner and import normalization, so `;` columns reappear only where the engine recognizes a table. For each file it checks that tokens and comments
 * are byte-identical (preservesTokens), and reverts that file if not.
 *
 * Usage: bun development/tools/strip-stray-padding.ts [--write] <file>...
 */
import      { spawnSync                   } from "node:child_process"                 ;
import      { readFileSync, writeFileSync } from "node:fs"                            ;
import      { join                        } from "node:path"                          ;
import      { preservesTokens             } from "@/typescript/token-preservation.ts" ;
import      { straySemicolonPadding       } from "@/common/report.ts"                 ;

const ROOT = join(import.meta.dir, "..", "..");

/** Removes the spaces before the trailing `;` on A12 target lines. The decision is made once against the original body (straySemicolonPadding). */
export function stripSemicolonPadding(text: string): string {
	const lines = text.split("\n");

	return lines.map((line, index) => straySemicolonPadding(lines, index) === undefined ? line : line.replace(/(\S)[ \t]+;(\r?)$/u, "$1;$2")).join("\n");
}

function realign(file: string): void {
	spawnSync(process.execPath, [join(ROOT, "product/engine/typescript/06_align-tables.ts"), "--file", file, "--write"], { cwd: ROOT, encoding: "utf8" });
	spawnSync(process.execPath, [join(ROOT, "product/engine/typescript/00_normalize-imports.ts"), "--write", file], { cwd: ROOT, encoding: "utf8" });
}

function main(): void {
	const args  = process.argv.slice(2)                 ;
	const write = args.includes("--write")              ;
	const files = args.filter(arg => arg !== "--write") ;

	let changedFiles = 0 ;
	let changedLines = 0 ;
	for (const file of files) {
		const before   = readFileSync(file, "utf8")    ;
		const stripped = stripSemicolonPadding(before) ;
		if (stripped === before) continue;

		writeFileSync(file, stripped);
		realign(file);

		const after = readFileSync(file, "utf8");
		if (!preservesTokens(before, after)) {
			writeFileSync(file, before);
			console.error(`strip-stray-padding: token change, restored ${file}`);
			continue;
		}

		const lines = before.split("\n").filter((line, index) => line !== after.split("\n")[index]).length;
		if (!write) writeFileSync(file, before);
		if (lines > 0) {
			changedFiles += 1;
			changedLines += lines;
			console.log(`${file} lines=${lines}`);
		}
	}
	console.log(`strip-stray-padding files=${changedFiles} lines=${changedLines} write=${write}`);
}

if (import.meta.main) main();
