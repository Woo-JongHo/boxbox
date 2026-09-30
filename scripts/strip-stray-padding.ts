#!/usr/bin/env bun
/**
 * 표 밖 정렬 공백 정리 (M1.8, 알람 A12). TypeScript 파일에서 A12 대상 줄의 끝 `;` 앞 공백을 지운 뒤 정렬기와 import 정리를
 * 다시 돌린다. 그러면 `;` 열은 엔진이 표로 인식한 곳에만 다시 생긴다. 파일마다 토큰·주석이 바이트 단위로 같은지
 * (preservesTokens) 확인하고, 다르면 그 파일은 되돌린다.
 *
 * 사용법: bun scripts/strip-stray-padding.ts [--write] <파일>...
 */
import      { spawnSync                   } from "node:child_process"                 ;
import      { readFileSync, writeFileSync } from "node:fs"                            ;
import      { join                        } from "node:path"                          ;
import      { preservesTokens             } from "@/typescript/token-preservation.ts" ;
import      { straySemicolonPadding       } from "@/common/report.ts"                 ;

const ROOT = join(import.meta.dir, "..");

/** A12 대상 줄의 끝 `;` 앞 공백을 지운다. 판단은 원래 본문 기준으로 한 번에 한다(straySemicolonPadding). */
export function stripSemicolonPadding(text: string): string {
	const lines = text.split("\n");

	return lines.map((line, index) => straySemicolonPadding(lines, index) === undefined ? line : line.replace(/(\S)[ \t]+;(\r?)$/u, "$1;$2")).join("\n");
}

function realign(file: string): void {
	spawnSync(process.execPath, [join(ROOT, "skills/xxx/scripts/typescript/06_align-tables.ts"), "--file", file, "--write"], { cwd: ROOT, encoding: "utf8" });
	spawnSync(process.execPath, [join(ROOT, "skills/xxx/scripts/typescript/00_normalize-imports.ts"), "--write", file], { cwd: ROOT, encoding: "utf8" });
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
