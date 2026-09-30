#!/usr/bin/env bun
/**
 * Claude Code 훅 진입점 (M1.8 S3.6, docs/authoring-flow.md). 첫 범위는 읽기 전용이다.
 *
 *   hook.ts session : 세션 시작 때 헌장 핵심 3줄을 한 번 주입한다.
 *   hook.ts pre     : 쓰기 직전 기준본을 `.xxx/cache/baseline/<tool_use_id>`에 저장한다. 새 파일이면 언어별로
 *                     세션당 한 번 짧은 안내를 주입한다.
 *   hook.ts post    : 쓴 뒤 리포트를 기준본과 비교해, 새 알람이 있을 때만 알린다. 파일은 고치지 않는다.
 *
 * 입력은 stdin의 호스트 JSON이다. XXX_HOOKS=off이면 아무것도 하지 않는다. 훅이 실패해도 편집을 막지 않는다(종료 코드 0).
 * 지연은 `.xxx/cache/hook-timing.jsonl`에 남긴다(S3.6 확인 기준).
 */
import      { spawnSync                   } from "node:child_process" ;
import      {
              appendFileSync            ,
              existsSync                ,
              mkdirSync                 ,
              readdirSync               ,
              readFileSync              ,
              rmSync                    ,
              statSync                  ,
              writeFileSync             ,
                                          } from "node:fs"            ;
import      { extname, join, relative     } from "node:path"          ;
import      { fileURLToPath               } from "node:url"           ;
import      {
              coreLines                 ,
              hookTarget                ,
              newFileGuide              ,
              postMessage               ,
              sessionGuide              ,
              type HookInput            ,
                                          } from "./common/hook.ts"   ;
import type { Report                      } from "./common/report.ts" ;
import      { appendUsage, estimateTokens } from "./common/usage.ts"  ;

const CHARTER = fileURLToPath(new URL("../references/charter.md", import.meta.url)) ;
const REPORT  = fileURLToPath(new URL("./report.ts", import.meta.url)             ) ;

/** 쓰기가 일어나지 않아 짝(post)을 잃은 기준본은 이 시간이 지나면 지운다. */
const STALE_MS = 60 * 60 * 1000;

/** 프로젝트의 캐시 폴더. 스스로 git에서 빠지도록 `*` 한 줄짜리 .gitignore를 두고, 오래된 기준본을 치운다. */
function cacheDir(project: string): string {
	const dir = join(project, ".xxx", "cache");
	mkdirSync(join(dir, "baseline"), { recursive: true });
	if (!existsSync(join(dir, ".gitignore"))) writeFileSync(join(dir, ".gitignore"), "*\n");

	for (const name of readdirSync(join(dir, "baseline"))) {
		const path = join(dir, "baseline", name);
		if (Date.now() - statSync(path).mtimeMs > STALE_MS) rmSync(path, { force: true });
	}
	return dir;
}

/** 에이전트에게 글을 주입하고, 그 양을 `.xxx/cache/usage.jsonl`에 남긴다(추정 토큰). */
function emit(event: string, context: string, project?: string, file?: string): void {
	console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: context } }));
	if (!project) return;

	appendUsage(join(cacheDir(project), "usage.jsonl"), { date: new Date().toISOString(), source: "hook", event, chars: context.length, tokens: estimateTokens(context), estimated: true, model: "host", ...(file ? { file } : {}) });
}

function session(): void {
	emit("SessionStart", sessionGuide(coreLines(readFileSync(CHARTER, "utf8"))), process.env["CLAUDE_PROJECT_DIR"]);
}

function pre(input: HookInput, project: string): void {
	const target = hookTarget(input);
	if (!target || !input.tool_use_id) return;

	const cache    = cacheDir(project)                                                      ;
	const baseline = join(cache, "baseline", `${input.tool_use_id}${extname(target.file)}`) ;
	const isNew    = !existsSync(target.file)                                               ;
	if (isNew) writeFileSync(`${baseline}.none`, "");
	else writeFileSync(baseline, readFileSync(target.file));

	const marker = join(cache, `guided-${input.session_id ?? "session"}-${target.language}`);
	if (!isNew || existsSync(marker)) return;

	writeFileSync(marker, "");
	emit("PreToolUse", newFileGuide(target.language), project, relative(project, target.file));
}

function post(input: HookInput, project: string): void {
	const target = hookTarget(input);
	if (!target || !input.tool_use_id || !existsSync(target.file)) return;

	const started  = Date.now()                                                                                                                  ;
	const cache    = cacheDir(project)                                                                                                           ;
	const saved    = join(cache, "baseline", `${input.tool_use_id}${extname(target.file)}`)                                                      ;
	const baseline = existsSync(saved) ? relative(project, saved) : "none"                                                                       ;
	const file     = relative(project, target.file)                                                                                              ;
	const run      = spawnSync(process.execPath, [REPORT, "--file", file, "--baseline", baseline, "--json"], { cwd: project, encoding: "utf8" }) ;

	rmSync(saved, { force: true });
	rmSync(`${saved}.none`, { force: true });
	appendFileSync(join(cache, "hook-timing.jsonl"), `${JSON.stringify({ file, tool: input.tool_name, ms: Date.now() - started, date: new Date().toISOString() })}\n`);

	let report: Report;
	try {
		report = JSON.parse(run.stdout) as Report;
	} catch {
		return;
	}

	const message = postMessage(report);
	if (message) emit("PostToolUse", message, project, file);
}

function main(): void {
	if (process.env["XXX_HOOKS"] === "off") return;

	const mode = process.argv[2];
	if (mode === "session") return session();

	const input   = JSON.parse(readFileSync(0, "utf8") || "{}") as HookInput        ;
	const project = process.env["CLAUDE_PROJECT_DIR"] ?? input.cwd ?? process.cwd() ;
	if (mode === "pre" ) return pre(input, project);
	if (mode === "post") return post(input, project);
}

try {
	if (import.meta.main) main();
} catch (error) {
	// 훅은 편집을 막지 않는다. 원인만 stderr에 남긴다.
	console.error(`xxx hook: ${error instanceof Error ? error.message : String(error)}`);
}
