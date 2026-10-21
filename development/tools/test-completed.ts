#!/usr/bin/env bun
/**
 * Collects aligned results into TEST_COMPLETED/ (git-ignored) for review in an editor: every fixture and seeded
 * mutation samples per language, each aligned file next to its original under before/, plus SUMMARY.txt with the
 * safety results per file. Usage:
 *   bun development/tools/test-completed.ts [--samples 3]
 */
import      { spawnSync          } from "node:child_process"                 ;
import      {
              mkdirSync        ,
              readFileSync     ,
              rmSync           ,
              writeFileSync    ,
                                 } from "node:fs"                            ;
import      { join               } from "node:path"                          ;
import      { compareParse       } from "@/common/parse-check.ts"            ;
import      { changedLines       } from "@/common/preservation.ts"           ;
import      { alignSource        } from "@/common/table-engine.ts"           ;
import type { LineProfiler       } from "@/common/table-engine.ts"           ;
import      { C_ALIGNER          } from "@/c/profile.ts"                     ;
import      { CPP_ALIGNER        } from "@/cpp/profile.ts"                   ;
import      { GO_ALIGNER         } from "@/go/profile.ts"                    ;
import      { JAVA_ALIGNER       } from "@/java/profile.ts"                  ;
import      { JAVASCRIPT_ALIGNER } from "@/javascript/profile.ts"            ;
import      { PYTHON_ALIGNER     } from "@/python/profile.ts"                ;
import      { RUST_ALIGNER       } from "@/rust/profile.ts"                  ;
import      { preservesTokens    } from "@/typescript/token-preservation.ts" ;
import      { mutate             } from "../../test/mutator.ts"              ;

const ROOT     = join(import.meta.dir, "..", "..")                     ;
const OUT      = join(ROOT, "TEST_COMPLETED")                          ;
const FIXTURES = join(ROOT, "test/fixtures")                           ;
const argv     = process.argv.slice(2)                                 ;
const SAMPLES  = Number(argv[argv.indexOf("--samples") + 1] ?? 3) || 3 ;

interface Entry {
	readonly language : string;
	/** Path inside the language folder, e.g. `tables.py` or `mutations/seed-01.py`. */
	readonly title  : string            ;
	readonly before : string            ;
	readonly after  : string            ;
	readonly checks : readonly string[] ;
	readonly ok     : boolean           ;
}

const LINE_LANGUAGES: readonly (readonly [LineProfiler, string, string])[] = [
	[PYTHON_ALIGNER    , "py"  , "#" ],
	[JAVA_ALIGNER      , "java", "//"],
	[GO_ALIGNER        , "go"  , "//"],
	[RUST_ALIGNER      , "rs"  , "//"],
	[JAVASCRIPT_ALIGNER, "js"  , "//"],
	[C_ALIGNER         , "c"   , "//"],
	[CPP_ALIGNER       , "cpp" , "//"],
];

function lineEntry(aligner: LineProfiler, title: string, before: string): Entry {
	const result    = alignSource(before, aligner, { minRows: 3, apply: true })               ;
	const preserved = changedLines(before, result.output, aligner.syntax).length === 0        ;
	const again     = alignSource(result.output, aligner, { minRows: 3, apply: true }).output ;
	const parse     = compareParse(aligner.language, before, result.output)                   ;
	const checks    = [
		`tables ${result.tables}`,
		`refused ${result.refused.length}`,
		`whitespace-only ${preserved ? "ok" : "FAIL"}`,
		`idempotent ${again === result.output ? "ok" : "FAIL"}`,
		`parse ${parse.status}`,
	];
	const ok = preserved && again === result.output && result.refused.length === 0 && parse.status !== "changed";
	return { language: aligner.language, title, before, after: result.output, checks, ok };
}

function typescriptEntry(title: string, file: string): Entry {
	const work   = join(OUT, "tmp")                       ;
	const target = join(work, file.split("/").pop()!)     ;
	const before = readFileSync(join(ROOT, file), "utf8") ;
	mkdirSync(work, { recursive: true });
	writeFileSync(target, before);
	const run    = spawnSync("bun", [join(ROOT, "product/engine/typescript/06_align-tables.ts"), "--file", target.slice(ROOT.length + 1), "--write"], { cwd: ROOT, encoding: "utf8" }) ;
	const after  = readFileSync(target, "utf8")                                                                                                                                        ;
	const report = run.stdout ?? ""                                                                                                                                                    ;
	const checks = [
		`tables ${/groups=(\d+)/u.exec(report)?.[1] ?? "?"}`,
		`refused ${/refused=(\d+)/u.exec(report)?.[1] ?? "?"}`,
		`whitespace-only ${preservesTokens(before, after) ? "ok" : "FAIL"}`,
		/parse=ok/u.test(report) ? `parse ok (${/passes=(\d+)/u.exec(report)?.[1] ?? "1"} pass)` : `parse ${run.status === 0 ? "unchanged file" : "FAIL"}`,
	];
	return { language: "typescript", title, before, after, checks, ok: run.status === 0 && preservesTokens(before, after) };
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const entries: Entry[] = [];
for (const [aligner, extension, comment] of LINE_LANGUAGES) {
	for (const file of ["tables", "tricky"]) {
		const source = readFileSync(join(FIXTURES, aligner.language, `${file}.${extension}`), "utf8");
		entries.push(lineEntry(aligner, `${file}.${extension}`, source));
		if (file !== "tables") continue;
		for (let seed = 1; seed <= SAMPLES; seed += 1) {
			entries.push(lineEntry(aligner, `mutations/seed-${String(seed).padStart(2, "0")}.${extension}`, mutate(source, { syntax: aligner.syntax, comment }, seed)));
		}
	}
}
for (const file of ["table-kinds.ts", "table-alignment.ts", "grid-regions.ts"]) entries.push(typescriptEntry(file, `test/fixtures/${file}`));
rmSync(join(OUT, "tmp"), { recursive: true, force: true });

for (const entry of entries) {
	const aligned  = join(OUT, entry.language, entry.title)                                                                     ;
	const original = join(OUT, entry.language, ...entry.title.split("/").slice(0, -1), "before", entry.title.split("/").pop()!) ;
	mkdirSync(join(aligned, ".."), { recursive: true });
	mkdirSync(join(original, ".."), { recursive: true });
	writeFileSync(aligned, entry.after);
	writeFileSync(original, entry.before);
}

const commit  = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf8" }).stdout.trim() ;
const failing = entries.filter(entry => !entry.ok)                                                                ;
const width   = Math.max(...entries.map(entry => `${entry.language}/${entry.title}`.length))                      ;
const summary = [
	`TEST_COMPLETED — commit ${commit}, ${new Date().toISOString()}`,
	`${entries.length} files, ${failing.length} failing. Each aligned file sits next to its original under before/.`,
	"",
	...entries.map(entry => {
		const changed = entry.before.split("\n").filter((line, index) => line !== entry.after.split("\n")[index]).length;
		return `${entry.ok ? "ok  " : "FAIL"}  ${`${entry.language}/${entry.title}`.padEnd(width)}  changed-lines ${String(changed).padStart(3)}  ${entry.checks.join(" · ")}`;
	}),
];
writeFileSync(join(OUT, "SUMMARY.txt"), `${summary.join("\n")}\n`);
console.log(`TEST_COMPLETED: ${OUT} (${entries.length} files, ${failing.length} failing)`);
