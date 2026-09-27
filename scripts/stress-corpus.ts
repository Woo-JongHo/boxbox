#!/usr/bin/env bun
/**
 * 스트레스 말뭉치 빌더: 언어별 대형 오픈소스에서 가장 긴 실제 파일 5개씩 골라
 * 각 언어 정렬기를 적용하고, 원본·정렬본·diff·검증 결과를 stress/ 아래에 남긴다.
 * 파일 목록과 내용은 얕은 클론에서 로컬로 직접 읽어 GitHub API 한도와 무관하게 동작한다.
 * 큰 저장소는 blob:none + sparse-checkout으로 필요한 디렉터리 블롭만 내려받는다.
 * 결과물은 서드파티 코드라 커밋하지 않는다(.gitignore의 stress/).
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join }                                                from "node:path";
import { spawnSync }                                                     from "node:child_process";

const ROOT   = join(import.meta.dir, "..");
const OUT    = join(ROOT, "stress");
const CLONES = "/tmp/woo-stress-clones";

interface LanguageConfig {
	readonly repo     : string;
	readonly ext      : string;
	/** 클론 안에서 볼 하위 디렉터리. 비우면 저장소 전체를 일반 얕은 클론한다. */
	readonly dirs     : readonly string[];
	readonly exclude? : RegExp;
	/** 선언문 밀도 측정용 행 패턴 — 데이터 테이블보다 선언이 많은 파일을 고른다. */
	readonly decl     : RegExp;
}

const GENERIC_EXCLUDE = /(^|\/)(tests?|testdata|examples?|benchmarks?|vendor|fuzz|fixtures)(\/|$)|Gen[A-Z]|opGen|rewrite[A-Z]|_pb2\.|\.pb\.|\.min\.|snapshot/i;
/** 생성물 표지 — 파일 머리에서 이 문자열이 보이면 말뭉치에서 제외한다. */
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

const MIN_LINES = 300;
const MIN_DECLS = 15;
const PER_LANG  = 5;

interface Candidate {
	readonly path    : string;
	readonly absolute: string;
	readonly lines   : number;
	readonly decls   : number;
}

function git(target: string, args: readonly string[]): void {
	const result = spawnSync("git", ["-C", target, ...args], { encoding: "utf8", timeout: 600_000 });
	if (result.status !== 0) throw new Error(`git ${args[0]} 실패: ${result.stderr?.split("\n")[0]}`);
}

function ensureClone(config: LanguageConfig): string {
	const slug   = config.repo.replaceAll("/", "__");
	const target = join(CLONES, slug);
	if (spawnSync("git", ["-C", target, "rev-parse", "HEAD"], { encoding: "utf8" }).status === 0) {
		// --no-checkout 등으로 작업트리가 비어 있으면 채운다(재사용 클론 호환). 수집기의 임시 파일은 무시한다.
		const hasWorktree = readdirSync(target).some(entry => entry !== ".git" && entry !== ".woo-ls-tree.txt");
		if (!hasWorktree) git(target, ["checkout", "HEAD"]);
		return target;
	}
	mkdirSync(target, { recursive: true });
	const sparse  = config.dirs.length > 0;
	const cloneArgs = ["clone", "--depth", "1"];
	if (sparse) cloneArgs.push("--filter=blob:none", "--sparse");
	cloneArgs.push(`https://github.com/${config.repo}.git`, target);
	const clone = spawnSync("git", cloneArgs, { encoding: "utf8", timeout: 600_000 });
	if (clone.status !== 0) throw new Error(`clone 실패: ${clone.stderr?.split("\n")[0]}`);
	if (sparse) git(target, ["sparse-checkout", "set", ...config.dirs]);
	return target;
}

function collectCandidates(config: LanguageConfig, target: string): readonly Candidate[] {
	const scopes = config.dirs.length > 0 ? config.dirs : [""];
	const candidates: Candidate[] = [];
	for (const scope of scopes) {
		const scopeDir = scope === "" ? target : join(target, scope);
		const walk = (dir: string): void => {
			for (const entry of readdirSync(dir)) {
				const path = join(dir, entry);
				const stat = statSync(path);
				if (stat.isDirectory()) { walk(path); continue; }
				if (!entry.endsWith(config.ext)) continue;
				const relative = scope === "" ? path.slice(target.length + 1) : path.slice(target.length + 1);
				if (GENERIC_EXCLUDE.test(relative) || config.exclude?.test(relative)) continue;
				const text    = readFileSync(path, "utf8");
				const heads   = text.slice(0, 600);
				const decls   = text.split("\n").filter(line => config.decl.test(line)).length;
				const lines   = text.split("\n").length;
				// 생성물·데이터 테이블은 배제하고, 선언문이 많은 파일을 우선한다.
				if (GENERATED_MARK.test(heads) || lines < MIN_LINES || decls < MIN_DECLS) continue;
				candidates.push({ path: relative, absolute: path, lines, decls });
			}
		};
		walk(scopeDir);
	}
	candidates.sort((left, right) => right.decls - left.decls || right.lines - left.lines);
	return candidates.slice(0, PER_LANG);
}

const stripWhitespace = (value: string): string => value.replace(/\s+/gu, "");

interface FileResult {
	readonly file       : string;
	readonly origin     : string;
	readonly lines      : number;
	readonly edits      : number;
	readonly diffLines  : number;
	readonly preserved  : boolean;
	readonly idempotent : boolean;
	readonly error?     : string;
}

async function processLanguage(language: string, config: LanguageConfig): Promise<readonly FileResult[]> {
	const dir  = join(OUT, language);
	mkdirSync(dir, { recursive: true });
	const target   = ensureClone(config);
	const results: FileResult[] = [];
	for (const [index, candidate] of collectCandidates(config, target).entries()) {
		const tag      = `${String(index + 1).padStart(2, "0")}-${basename(candidate.path)}`;
		const original = join(dir, tag);
		const aligned  = join(dir, `${tag}.aligned${config.ext}`);
		try {
			const source = readFileSync(candidate.absolute, "utf8");
			writeFileSync(original, source);
			writeFileSync(aligned, source);
			const apply = spawnSync("bun", [join(ROOT, `skills/woo-code-readability/scripts/${language}/06_align-tables.ts`), "--file", aligned, "--write"], { encoding: "utf8", timeout: 120_000, cwd: ROOT });
			// 크래시도 종료코드 1로 나오므로 보고 헤더 유무로 성공을 판정한다.
			if (!(apply.stdout ?? "").startsWith("align-tables")) throw new Error(`정렬기 오류: ${(apply.stderr ?? "").split("\n")[0]}`);
			const edits = Number(/edits=(\d+)/.exec(apply.stdout ?? "")?.[1] ?? 0);
			const verify = spawnSync("bun", [join(ROOT, `skills/woo-code-readability/scripts/${language}/06_align-tables.ts`), "--file", aligned], { encoding: "utf8", timeout: 120_000, cwd: ROOT });
			const diffOutput = spawnSync("diff", ["-u", original, aligned], { encoding: "utf8" }).stdout ?? "";
			writeFileSync(`${aligned}.diff`, diffOutput);
			results.push({
				file       : tag,
				origin     : `${config.repo} ${candidate.path}`,
				lines      : candidate.lines,
				edits,
				diffLines  : diffOutput.split("\n").filter(line => (line.startsWith("+") || line.startsWith("-")) && !line.startsWith("+++") && !line.startsWith("---")).length,
				preserved  : stripWhitespace(readFileSync(aligned, "utf8")) === stripWhitespace(source),
				idempotent : verify.status === 0,
			});
		} catch (error) {
			results.push({ file: tag, origin: candidate.path, lines: candidate.lines, edits: 0, diffLines: 0, preserved: false, idempotent: false, error: error instanceof Error ? error.message : String(error) });
		}
	}
	return results;
}

mkdirSync(OUT, { recursive: true });
const summary: string[] = ["# 스트레스 말뭉치 — 대형 오픈소스에서 가장 긴 파일 5개씩 × 7개 언어", ""];
for (const [language, config] of Object.entries(LANGUAGES)) {
	console.error(`수집 중: ${language} (${config.repo})`);
	const results = await processLanguage(language, config);
	summary.push(`## ${language} — ${config.repo}`, "", "| 파일 | 줄 | 편집 | diff ±줄 | 내용 보존 | 멱등 |", "|---|---|---|---|---|---|");
	for (const result of results) {
		const mark = (value: boolean): string => value ? "✅" : "❌";
		summary.push(`| ${result.file} | ${result.lines} | ${result.edits} | ${result.diffLines} | ${mark(result.preserved)}${result.error ? ` (${result.error})` : ""} | ${mark(result.idempotent)} |`);
		console.error(`  ${result.file} lines=${result.lines} edits=${result.edits} 보존=${result.preserved} 멱등=${result.idempotent}${result.error ? ` 오류=${result.error}` : ""}`);
	}
	summary.push("", "각 항목: `<파일>` 원본 · `<파일>.aligned.<확장자>` 정렬 결과 · `<파일>.aligned.<확장자>.diff` 변경점", "");
}
writeFileSync(join(OUT, "README.md"), summary.join("\n"));
console.error("완료: stress/README.md");
