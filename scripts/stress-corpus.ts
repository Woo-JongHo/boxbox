#!/usr/bin/env bun
/**
 * Stress corpus builder: picks the five longest real files from a large open-source project per language,
 * applies each language's aligner, and writes the original, aligned output, diff and verification results under stress/.
 * File lists and contents are read locally from shallow clones, so it works regardless of GitHub API limits.
 * Large repositories fetch only the needed directory blobs via blob:none + sparse-checkout.
 * Output is third-party code and is never committed (stress/ in .gitignore).
 */
import      {
              mkdirSync        ,
              readdirSync      ,
              readFileSync     ,
              statSync         ,
              writeFileSync    ,
                                 } from "node:fs"                                      ;
import      { homedir            } from "node:os"                                      ;
import      { basename, join     } from "node:path"                                    ;
import      { spawnSync          } from "node:child_process"                           ;
import type { CodeSyntax         } from "../skills/xxx/scripts/common/code-text.ts"    ;
import      { changedLines       } from "../skills/xxx/scripts/common/preservation.ts" ;
import      { C_ALIGNER          } from "../skills/xxx/scripts/c/profile.ts"           ;
import      { CPP_ALIGNER        } from "../skills/xxx/scripts/cpp/profile.ts"         ;
import      { GO_ALIGNER         } from "../skills/xxx/scripts/go/profile.ts"          ;
import      { JAVA_ALIGNER       } from "../skills/xxx/scripts/java/profile.ts"        ;
import      { JAVASCRIPT_ALIGNER } from "../skills/xxx/scripts/javascript/profile.ts"  ;
import      { PYTHON_ALIGNER     } from "../skills/xxx/scripts/python/profile.ts"      ;
import      { RUST_ALIGNER       } from "../skills/xxx/scripts/rust/profile.ts"        ;

const ROOT   = join(import.meta.dir, "..")                       ;
const OUT    = join(ROOT, "stress")                              ;
const CLONES = join(homedir(), ".cache", "xxx", "stress-clones") ;

interface LanguageConfig {
	readonly repo     : string;
	readonly ext      : string;
	/** Subdirectories to use inside the clone. Leave empty for a plain shallow clone of the whole repository. */
	readonly dirs     : readonly string[];
	readonly exclude? : RegExp;
	/** Row pattern for measuring declaration density — prefers files with more declarations than data tables. */
	readonly decl     : RegExp;
}

const GENERIC_EXCLUDE = /(^|\/)(tests?|testdata|examples?|benchmarks?|vendor|fuzz|fixtures)(\/|$)|Gen[A-Z]|opGen|rewrite[A-Z]|_pb2\.|\.pb\.|\.min\.|snapshot/i;
/** Generated-file markers — files showing these strings in their header are excluded from the corpus. */
const GENERATED_MARK = /code generated|do not edit|auto-?generated|machine generated/i;

const LANGUAGES: Readonly<Record<string, LanguageConfig>> = {
	python     : {
		repo : "django/django",
		ext  : ".py",
		dirs : [],
		decl : /^\s*[A-Za-z_]\w*\s*(?::\s*[^=;\n]+)?=(?!=)/,
	},
	java       : {
		repo : "openjdk/jdk",
		ext  : ".java",
		dirs : ["src/java.base/share/classes", "src/jdk.compiler/share/classes", "src/jdk.hotspot.agent/share/classes"],
		decl : /^\s+(?:(?:public|private|protected|static|final|volatile|transient|abstract)\s+)+(?:[\w<>\[\], ?.]+\s+)?\w+\s*(?:=|;)|^\s+(?:int|long|short|byte|char|boolean|float|double|String|Object|var)\b[^\n]*[;=]/,
	},
	go         : {
		repo : "golang/go",
		ext  : ".go",
		dirs : [],
		decl : /^\s*[A-Za-z_]\w*\s+[\w\[\]\*\.]+(?:\s+`|\s*=|$)|^\s*(?:const|var|type)\s/,
	},
	rust       : {
		repo : "rust-lang/rust",
		ext  : ".rs",
		dirs : ["library/core/src", "library/alloc/src", "library/std/src", "compiler/rustc_middle/src", "compiler/rustc_borrowck/src"],
		decl : /^\s*(?:pub\s+)?(?:\w+\s*:\s*|(?:const|static|let)\s)/,
	},
	javascript : {
		repo : "webpack/webpack",
		ext  : ".js",
		dirs : ["lib"],
		decl : /^\s*(?:const|let|var)\s+\w+\s*=|^\s+\w+\s*=\s*[^=]/,
	},
	c          : {
		repo : "ffmpeg/ffmpeg",
		ext  : ".c",
		dirs : ["libavcodec", "libavformat", "libavutil"],
		decl : /^\s*(?:const\s+|static\s+|unsigned\s+|signed\s+)*\w[\w\s]*[\*\s]\w+\s*(?:;|=\s*[^=]|\[[^\]]*\])/,
	},
	cpp        : {
		repo : "llvm/llvm-project",
		ext  : ".cpp",
		dirs : ["llvm/lib/IR", "llvm/lib/MC", "llvm/lib/Transforms/Scalar", "llvm/lib/Target/X86", "clang/lib/Sema", "clang/lib/CodeGen"],
		decl : /^\s*(?:constexpr|static|inline|const)\s[^\n]*;|^\s*\w[\w:<>&\*\s]*\s+\w+\s*(?:;|=\s*[^=])/,
	},
};

const MIN_LINES = 300 ;
const MIN_DECLS = 15  ;
const PER_LANG  = 5   ;

interface Candidate {
	readonly path     : string ;
	readonly absolute : string ;
	readonly lines    : number ;
	readonly decls    : number ;
}

function git(target: string, args: readonly string[]): void {
	const result = spawnSync("git", ["-C", target, ...args], { encoding: "utf8", timeout: 600_000 });
	if (result.status !== 0) throw new Error(`git ${args[0]} failed: ${result.stderr?.split("\n")[0]}`);
}

function ensureClone(config: LanguageConfig): string {
	const slug   = config.repo.replaceAll("/", "__") ;
	const target = join(CLONES, slug)                ;
	if (spawnSync("git", ["-C", target, "rev-parse", "HEAD"], { encoding: "utf8" }).status === 0) {
		// Fill the worktree if it is empty (e.g. after --no-checkout; compatible with reused clones). Ignore the collector's temp files.
		const hasWorktree = readdirSync(target).some(entry => entry !== ".git" && entry !== ".xxx-ls-tree.txt");
		if (!hasWorktree) git(target, ["checkout", "HEAD"]);
		return target;
	}
	mkdirSync(target, { recursive: true });
	const sparse    = config.dirs.length > 0    ;
	const cloneArgs = ["clone", "--depth", "1"] ;
	if (sparse) cloneArgs.push("--filter=blob:none", "--sparse");
	cloneArgs.push(`https://github.com/${config.repo}.git`, target);
	const clone = spawnSync("git", cloneArgs, { encoding: "utf8", timeout: 600_000 });
	if (clone.status !== 0) throw new Error(`clone failed: ${clone.stderr?.split("\n")[0]}`);
	if (sparse) git(target, ["sparse-checkout", "set", ...config.dirs]);
	return target;
}

function collectCandidates(config: LanguageConfig, target: string): readonly Candidate[] {
	const scopes                  = config.dirs.length > 0 ? config.dirs : [""] ;
	const candidates: Candidate[] = []                                          ;
	for (const scope of scopes) {
		const scopeDir = scope === "" ? target : join(target, scope);
		const walk = (dir: string): void => {
			for (const entry of readdirSync(dir)) {
				const path = join(dir, entry) ;
				const stat = statSync(path)   ;
				if (stat.isDirectory()) { walk(path); continue; }
				if (!entry.endsWith(config.ext)) continue;
				const relative = scope === "" ? path.slice(target.length + 1) : path.slice(target.length + 1);
				if (GENERIC_EXCLUDE.test(relative) || config.exclude?.test(relative)) continue;
				const text  = readFileSync(path, "utf8")                                     ;
				const heads = text.slice(0, 600)                                             ;
				const decls = text.split("\n").filter(line => config.decl.test(line)).length ;
				const lines = text.split("\n").length                                        ;
				// Exclude generated files and data tables; prefer files with many declarations.
				if (GENERATED_MARK.test(heads) || lines < MIN_LINES || decls < MIN_DECLS) continue;
				candidates.push({ path: relative, absolute: path, lines, decls });
			}
		};
		walk(scopeDir);
	}
	candidates.sort((left, right) => right.decls - left.decls || right.lines - left.lines);
	return candidates.slice(0, PER_LANG);
}

/** Syntax per corpus language, so preservation is judged by the same whitespace-only check as the engine. */
const SYNTAX: Readonly<Record<string, CodeSyntax>> = {
	c          : C_ALIGNER.syntax,
	cpp        : CPP_ALIGNER.syntax,
	go         : GO_ALIGNER.syntax,
	java       : JAVA_ALIGNER.syntax,
	javascript : JAVASCRIPT_ALIGNER.syntax,
	python     : PYTHON_ALIGNER.syntax,
	rust       : RUST_ALIGNER.syntax,
};

interface FileResult {
	readonly file       : string  ;
	readonly origin     : string  ;
	readonly lines      : number  ;
	readonly edits      : number  ;
	readonly diffLines  : number  ;
	readonly preserved  : boolean ;
	readonly idempotent : boolean ;
	readonly error?     : string  ;
}

async function processLanguage(language: string, config: LanguageConfig): Promise<readonly FileResult[]> {
	const dir  = join(OUT, language);
	mkdirSync(dir, { recursive: true });
	const target                = ensureClone(config)                                             ;
	const results: FileResult[] = []                                                              ;
	const alignerPath           = join(ROOT, `skills/xxx/scripts/${language}/06_align-tables.ts`) ;
	const spawnOptions          = { encoding: "utf8", timeout: 120_000, cwd: ROOT } as const      ;
	for (const [index, candidate] of collectCandidates(config, target).entries()) {
		const tag      = `${String(index + 1).padStart(2, "0")}-${basename(candidate.path)}` ;
		const original = join(dir, tag)                                                      ;
		const aligned  = join(dir, `${tag}.aligned${config.ext}`)                            ;
		try {
			const source = readFileSync(candidate.absolute, "utf8");
			writeFileSync(original, source);
			writeFileSync(aligned, source);
			const apply = spawnSync("bun", [alignerPath, "--file", aligned, "--write"], spawnOptions);
			// Crashes also exit with code 1, so success is judged by the presence of the report header.
			if (!(apply.stdout ?? "").startsWith("align-tables")) throw new Error(`aligner error: ${(apply.stderr ?? "").split("\n")[0]}`);
			const edits      = Number(/edits=(\d+)/.exec(apply.stdout ?? "")?.[1] ?? 0)                        ;
			const verify     = spawnSync("bun", [alignerPath, "--file", aligned], spawnOptions)                ;
			const diffOutput = spawnSync("diff", ["-u", original, aligned], { encoding: "utf8" }).stdout ?? "" ;
			writeFileSync(`${aligned}.diff`, diffOutput);
			results.push({
				file   : tag,
				origin : `${config.repo} ${candidate.path}`,
				lines  : candidate.lines,
				edits,
				diffLines  : diffOutput.split("\n").filter(line => (line.startsWith("+") || line.startsWith("-")) && !line.startsWith("+++") && !line.startsWith("---")).length,
				preserved  : changedLines(source, readFileSync(aligned, "utf8"), SYNTAX[language]!).length === 0,
				idempotent : verify.status === 0,
			});
		} catch (error) {
			results.push({ file: tag, origin: candidate.path, lines: candidate.lines, edits: 0, diffLines: 0, preserved: false, idempotent: false, error: error instanceof Error ? error.message : String(error) });
		}
	}
	return results;
}

mkdirSync(OUT, { recursive: true });
const summary: string[] = ["# Stress corpus — the 5 longest files from large open-source projects × 7 languages", ""];
for (const [language, config] of Object.entries(LANGUAGES)) {
	console.error(`collecting: ${language} (${config.repo})`);
	const results = await processLanguage(language, config);
	summary.push(`## ${language} — ${config.repo}`, "", "| File | Lines | Edits | Diff ±lines | Content preserved | Idempotent |", "|---|---|---|---|---|---|");
	for (const result of results) {
		const mark = (value: boolean): string => value ? "✅" : "❌";
		summary.push(`| ${result.file} | ${result.lines} | ${result.edits} | ${result.diffLines} | ${mark(result.preserved)}${result.error ? ` (${result.error})` : ""} | ${mark(result.idempotent)} |`);
		console.error(`  ${result.file} lines=${result.lines} edits=${result.edits} preserved=${result.preserved} idempotent=${result.idempotent}${result.error ? ` error=${result.error}` : ""}`);
	}
	summary.push("", "Each entry: `<file>` original · `<file>.aligned.<ext>` aligned result · `<file>.aligned.<ext>.diff` changes", "");
}
writeFileSync(join(OUT, "README.md"), summary.join("\n"));
console.error("done: stress/README.md");
