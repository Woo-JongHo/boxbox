#!/usr/bin/env bun
/** 관측 JSONL을 사람 검토용 후보와 실제 엔진 전후 예문으로 결정적으로 변환한다. */
import      { createHash      } from "node:crypto"        ;
import      { spawnSync       } from "node:child_process" ;
import      {
              existsSync    ,
              mkdirSync     ,
              mkdtempSync   ,
              readFileSync  ,
              realpathSync  ,
              renameSync    ,
              rmSync        ,
              writeFileSync ,
                              } from "node:fs"            ;
import      { homedir, tmpdir } from "node:os"            ;
import      {
              dirname       ,
              isAbsolute    ,
              join          ,
              relative      ,
              resolve       ,
              sep           ,
                              } from "node:path"          ;

const ROOT          = join(import.meta.dir, "..")                ;
const DEFAULT_INPUT = join(homedir(), ".cache", "xxx", "corpus") ;
const DEFAULT_OUT   = join(ROOT, ".xxx", "cache", "corpus")      ;
const HEX_256       = /^sha256:[0-9a-f]{64}$/u                   ;

export interface Observation {
	readonly schemaVersion : 1                                                                                                       ;
	readonly id            : string                                                                                                  ;
	readonly lookupKey     : string                                                                                                  ;
	readonly signature     : string                                                                                                  ;
	readonly state         : string                                                                                                  ;
	readonly rows          : number                                                                                                  ;
	readonly edits         : number                                                                                                  ;
	readonly source        : { readonly id: string; readonly repository: string; readonly commit: string; readonly license: string } ;
	readonly file          : string                                                                                                  ;
	readonly startLine     : number                                                                                                  ;
	readonly endLine       : number                                                                                                  ;
	readonly sourceHash    : string                                                                                                  ;
}

export interface CandidateOptions {
	readonly inputDir?  : string                       ;
	readonly outputDir? : string                       ;
	readonly limit?     : number                       ;
	readonly reps?      : number                       ;
	readonly timeoutMs? : number                       ;
	readonly checkout?  : (sourceId: string) => string ;
}

interface Example {
	readonly schemaVersion     : 1                                     ;
	readonly id                : string                                ;
	readonly candidateId       : string                                ;
	readonly lookupKey         : string                                ;
	readonly evidenceId        : string                                ;
	readonly status            : "verified" | "failed" | "unavailable" ;
	readonly source            : Observation["source"]                 ;
	readonly file              : string                                ;
	readonly startLine         : number                                ;
	readonly endLine           : number                                ;
	readonly sourceHash        : string                                ;
	readonly before?           : string                                ;
	readonly after?            : string                                ;
	readonly verified          : boolean                               ;
	readonly originalUnchanged : boolean                               ;
	readonly parseStatus       : "ok" | "not-run" | "changed"          ;
	readonly reason?           : string                                ;
}

const hash       = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex") ;
const taggedHash = (value: string | Buffer): string => `sha256:${hash(value)}`                          ;
const languageOf = (key: string): string => key.split("|")[1] ?? "unknown"                              ;
const jsonLine   = (value: unknown): string => JSON.stringify(value)                                    ;

function observationsAt(inputDir: string): readonly Observation[] {
	const path = join(inputDir, "observations.jsonl");
	if (!existsSync(path)) throw new Error(`observation file does not exist: ${path}`);
	const rows = readFileSync(path, "utf8").split("\n").filter(line => line.trim() !== "").map((line, index) => {
		let value: Observation;
		try { value = JSON.parse(line) as Observation; } catch { throw new Error(`invalid JSON at observations.jsonl line ${index + 1}`); }
		if (value.schemaVersion !== 1 || !value.id || !value.lookupKey || !value.source?.id || !HEX_256.test(value.sourceHash)) throw new Error(`invalid schema at observations.jsonl line ${index + 1}`);
		if (!Number.isInteger(value.startLine) || !Number.isInteger(value.endLine) || value.startLine < 1 || value.endLine < value.startLine) throw new Error(`invalid range at observations.jsonl line ${index + 1}`);
		return value;
	});
	const raw     = readFileSync(path, "utf8")                                                                                                                                                                                       ;
	const linkage = JSON.parse(readFileSync(join(inputDir, "signatures.json"), "utf8")) as { readonly observations?: { readonly schemaVersion?: number; readonly path?: string; readonly sha256?: string; readonly rows?: number } } ;
	if (linkage.observations?.schemaVersion !== 1 || linkage.observations.path !== "observations.jsonl" || linkage.observations.sha256 !== taggedHash(raw) || linkage.observations.rows !== rows.length) throw new Error("signatures.json observation linkage mismatch");
	const ids = new Set<string>();
	for (const row of rows) if (ids.has(row.id)) throw new Error(`duplicate evidence id: ${row.id}`); else ids.add(row.id);
	return rows.sort((a, b) => a.lookupKey.localeCompare(b.lookupKey) || a.id.localeCompare(b.id));
}

function validateSources(rows: readonly Observation[], inputDir: string, checkoutOf: (sourceId: string) => string, timeoutMs: number): void {
	const heads = new Map<string, string>();
	for (const row of rows) {
		const checkout = checkoutOf(row.source.id) ;
		const known    = heads.get(row.source.id)  ;
		if (known !== undefined && known !== row.source.commit) throw new Error(`${row.source.id}: inconsistent observed commits`);
		if (known === undefined) {
			if (headOf(checkout, timeoutMs) !== row.source.commit) throw new Error(`${row.source.id}: source commit mismatch`);
			heads.set(row.source.id, row.source.commit);
		}
		const file = safeFile(checkout, row.file);
		if (taggedHash(readFileSync(file)) !== row.sourceHash) throw new Error(`${row.source.id}/${row.file}: source hash mismatch`);
	}
}

function selectedKeys(groups: ReadonlyMap<string, readonly Observation[]>, limit: number): ReadonlySet<string> {
	const ranked = [...groups].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
	if (limit >= ranked.length) return new Set(ranked.map(([key]) => key));
	const buckets = new Map<string, string[]>();
	for (const [key] of ranked) (buckets.get(languageOf(key)) ?? (buckets.set(languageOf(key), []), buckets.get(languageOf(key))!)).push(key);
	const languages        = [...buckets.keys()].sort() ;
	const chosen: string[] = []                         ;
	while (chosen.length < limit) {
		let changed = false;
		for (const language of languages) {
			const key = buckets.get(language)!.shift();
			if (key !== undefined && chosen.length < limit) { chosen.push(key); changed = true; }
		}
		if (!changed) break;
	}
	return new Set(chosen);
}

const STATE_ORDER = new Map([["FIXABLE", 0], ["PASS", 1], ["REFUSE", 2]]);

/** Picks stable representatives, preferring distinct sources and then actionable states. */
export function selectRepresentatives(evidence: readonly Observation[], limit: number): readonly Observation[] {
	const ranked                = [...evidence].sort((left, right) => (STATE_ORDER.get(left.state) ?? 3) - (STATE_ORDER.get(right.state) ?? 3) || left.id.localeCompare(right.id)) ;
	const chosen: Observation[] = []                                                                                                                                               ;
	const sources               = new Set<string>()                                                                                                                                ;
	for (const row of ranked) if (!sources.has(row.source.id) && chosen.length < limit) { chosen.push(row); sources.add(row.source.id); }
	for (const row of ranked) if (!chosen.includes(row) && chosen.length < limit) chosen.push(row);
	return chosen;
}

function safeFile(root: string, path: string): string {
	if (isAbsolute(path)) throw new Error("absolute file path");
	const target = resolve(root, path);
	if (target !== root && !target.startsWith(root + sep)) throw new Error("checkout path escape");
	const physicalRoot = realpathSync(root  ) ;
	const physicalFile = realpathSync(target) ;
	if (physicalFile !== physicalRoot && !physicalFile.startsWith(physicalRoot + sep)) throw new Error("checkout symlink escape");
	return target;
}

function headOf(checkout: string, timeoutMs: number): string {
	const result = spawnSync("git", ["-C", checkout, "rev-parse", "HEAD"], { encoding: "utf8", timeout: timeoutMs });
	if (result.status !== 0) throw new Error("failed to inspect checkout HEAD");
	return result.stdout.trim();
}

function makeExample(row: Observation, candidateId: string, checkout: string, timeoutMs: number): Example {
	const base     = { schemaVersion: 1 as const, id: `example-${hash(row.id).slice(0, 20)}`, candidateId, lookupKey: row.lookupKey, evidenceId: row.id, source: row.source, file: row.file, startLine: row.startLine, endLine: row.endLine, sourceHash: row.sourceHash } ;
	let sourcePath = ""                                                                                                                                                                                                                                                   ;
	let original   = Buffer.alloc(0)                                                                                                                                                                                                                                      ;
	try {
		if (headOf(checkout, timeoutMs) !== row.source.commit) throw new Error("source commit mismatch");
		sourcePath = safeFile(checkout, row.file);
		original = readFileSync(sourcePath);
		if (taggedHash(original) !== row.sourceHash) throw new Error("source hash mismatch");
	} catch (error) {
		return { ...base, status: "unavailable", verified: false, originalUnchanged: sourcePath === "" || !existsSync(sourcePath) || readFileSync(sourcePath).equals(original), parseStatus: "not-run", reason: error instanceof Error ? error.message : String(error) };
	}
	const work                              = realpathSync(mkdtempSync(join(tmpdir(), "xxx-candidate-"))) ;
	let parseStatus: Example["parseStatus"] = "not-run"                                                   ;
	try {
		const extension = row.file.endsWith(".py") ? ".py" : ".ts" ;
		const copy      = join(work, `source${extension}`)         ;
		writeFileSync(copy, original);
		const language = languageOf(row.lookupKey);
		if (language !== "typescript" && language !== "python") throw new Error(`unsupported language: ${language}`);
		const aligner = join(ROOT, "skills", "xxx", "scripts", language, "06_align-tables.ts")                                                                ;
		const first   = spawnSync("bun", [aligner, "--file", `source${extension}`, "--write", "--json"], { cwd: work, encoding: "utf8", timeout: timeoutMs }) ;
		if (first.error || first.status !== 0) throw new Error(first.error?.message ?? `aligner exit ${first.status}`);
		const afterFull     = readFileSync(copy, "utf8")                                                                                      ;
		const envelope      = JSON.parse(first.stdout) as { readonly results?: readonly { readonly parse?: { readonly status?: string } }[] } ;
		const reportedParse = envelope.results?.[0]?.parse?.status                                                                            ;
		parseStatus = afterFull === original.toString("utf8") ? "not-run" : reportedParse === "ok" ? "ok" : "changed";
		if (afterFull !== original.toString("utf8") && reportedParse !== "ok") throw new Error(`parser verification ${reportedParse ?? "missing"}`);
		const second = spawnSync("bun", [aligner, "--file", `source${extension}`, "--write", "--json"], { cwd: work, encoding: "utf8", timeout: timeoutMs });
		if (second.error || second.status !== 0 || readFileSync(copy, "utf8") !== afterFull) throw new Error("engine fixed-point verification failed");
		const beforeLines = original.toString("utf8").split("\n") ;
		const afterLines  = afterFull.split("\n")                 ;
		if (beforeLines.length !== afterLines.length) throw new Error("line mapping changed");
		const start = row.startLine - 1 ;
		const end   = row.endLine       ;
		return { ...base, status: "verified", before: beforeLines.slice(start, end).join("\n"), after: afterLines.slice(start, end).join("\n"), verified: true, originalUnchanged: readFileSync(sourcePath).equals(original), parseStatus };
	} catch (error) {
		return { ...base, status: "failed", verified: false, originalUnchanged: readFileSync(sourcePath).equals(original), parseStatus, reason: error instanceof Error ? error.message : String(error) };
	} finally {
		rmSync(work, { recursive: true, force: true });
	}
}

function atomicSnapshot(outputDir: string, files: Readonly<Record<string, string>>): void {
	mkdirSync(dirname(outputDir), { recursive: true });
	const staging = mkdtempSync(join(dirname(outputDir), ".corpus-candidates-"));
	try {
		for (const [name, content] of Object.entries(files)) writeFileSync(join(staging, name), content);
		const previous = `${outputDir}.previous-${process.pid}`;
		if (existsSync(outputDir)) renameSync(outputDir, previous);
		try { renameSync(staging, outputDir); } catch (error) { if (existsSync(previous)) renameSync(previous, outputDir); throw error; }
		rmSync(previous, { recursive: true, force: true });
	} finally { rmSync(staging, { recursive: true, force: true }); }
}

export function reviewMarkdown(candidates: readonly { readonly id: string; readonly lookupKey: string; readonly frequency: number }[], examples: readonly Example[]): string {
	const excerpt = (value: string | undefined): { readonly text: string; readonly truncated: boolean } => {
		const lines = (value ?? "").split("\n");
		return { text: lines.slice(0, 100).join("\n"), truncated: lines.length > 100 };
	};
	const parts = ["# 코퍼스 후보 검토", "", "사람 승인 전 후보 자료다. 전체 구조화 원문은 `examples.jsonl`에 있다.", ""];
	for (const candidate of candidates) {
		parts.push(`## ${candidate.frequency}회 · \`${candidate.lookupKey}\``, "");
		for (const example of examples.filter(value => value.candidateId === candidate.id)) {
			const repository = example.source.repository.replace(/\.git$/u, "")                                                                                                                                                                ;
			const github     = repository.startsWith("https://github.com/") ? repository : /^[^/\s]+\/[^/\s]+$/u.test(repository) ? `https://github.com/${repository}` : undefined                                                             ;
			const permalink  = github === undefined ? `${repository} @ ${example.source.commit} · ${example.file}#L${example.startLine}` : `${github}/blob/${example.source.commit}/${example.file}#L${example.startLine}-L${example.endLine}` ;
			parts.push(`- 출처: [${example.source.id}](${permalink}) · license ${example.source.license}`, `- 검증: ${example.status} · parser ${example.parseStatus} · fixed point ${example.verified ? "pass" : "not-run"} · original unchanged ${example.originalUnchanged}`);
			if (example.reason !== undefined) parts.push(`- 실패 원인: ${example.reason}`);
			if (example.before !== undefined) {
				const before = excerpt(example.before) ;
				const after  = excerpt(example.after ) ;
				parts.push("", "변경 전", "", "```", before.text, "```", ...(before.truncated ? ["100줄에서 잘림 — 전체 내용은 `examples.jsonl` 참조."] : []), "", "변경 후", "", "```", after.text, "```", ...(after.truncated ? ["100줄에서 잘림 — 전체 내용은 `examples.jsonl` 참조."] : []));
			}
			parts.push("");
		}
	}
	return parts.join("\n") + "\n";
}

/** Regenerates only the derived review document from the existing structured cache. */
export function regenerateReview(outputDir = DEFAULT_OUT): void {
	const candidates = readFileSync(join(outputDir, "candidates.jsonl"), "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line) as { readonly id: string; readonly lookupKey: string; readonly frequency: number }) ;
	const examples   = readFileSync(join(outputDir, "examples.jsonl"), "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line) as Example)                                                                           ;
	const temporary  = join(outputDir, `.REVIEW.md.${process.pid}.tmp`)                                                                                                                                                       ;
	writeFileSync(temporary, reviewMarkdown(candidates, examples));
	renameSync(temporary, join(outputDir, "REVIEW.md"));
}

export function generateCandidates(options: CandidateOptions = {}): { readonly candidates: number; readonly examples: number; readonly verified: number } {
	const inputDir  = resolve(options.inputDir ?? DEFAULT_INPUT) ;
	const outputDir = resolve(options.outputDir ?? DEFAULT_OUT)  ;
	const limit     = options.limit ?? 40                        ;
	const reps      = options.reps ?? 3                          ;
	const timeoutMs = options.timeoutMs ?? 60_000                ;
	if (!Number.isInteger(limit) || limit < 0 || !Number.isInteger(reps) || reps < 1 || reps > 3 || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) throw new Error("invalid limit/reps/timeout range");
	const rows       = observationsAt(inputDir)                                             ;
	const checkoutOf = options.checkout ?? ((sourceId: string) => join(inputDir, sourceId)) ;
	validateSources(rows, inputDir, checkoutOf, timeoutMs);
	const groups = new Map<string, Observation[]>();
	for (const row of rows) (groups.get(row.lookupKey) ?? (groups.set(row.lookupKey, []), groups.get(row.lookupKey)!)).push(row);
	const selected            = selectedKeys(groups, limit) ;
	const examples: Example[] = []                          ;
	const candidates = [...groups].map(([lookupKey, evidence]) => {
		const id = `candidate-${hash(lookupKey).slice(0, 20)}`;
		if (selected.has(lookupKey)) for (const row of selectRepresentatives(evidence, reps)) examples.push(makeExample(row, id, checkoutOf(row.source.id), timeoutMs));
		const sourceCounts = Object.fromEntries([...new Set(evidence.map(row => row.source.id))].sort().map(source => [source, evidence.filter(row => row.source.id === source).length])) ;
		const states       = Object.fromEntries([...new Set(evidence.map(row => row.state))].sort().map(state => [state, evidence.filter(row => row.state === state).length])           ) ;
		return { schemaVersion: 1, id, status: "candidate", lookupKey, language: languageOf(lookupKey), frequency: evidence.length, sourceCounts, states, evidenceIds: evidence.slice(0, 3).map(row => row.id) };
	}).sort((a, b) => b.frequency - a.frequency || a.lookupKey.localeCompare(b.lookupKey));
	const verified             = examples.filter(example => example.status === "verified").length                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     ;
	const selectedObservations = rows.filter(row => selected.has(row.lookupKey)).length                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               ;
	const reasons              = examples.flatMap(example => example.reason === undefined ? [] : [example.reason])                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    ;
	const summary              = { schemaVersion: 1, observations: rows.length, candidates: candidates.length, selectedKeys: selected.size, frequencyCoverage: { observations: selectedObservations, totalObservations: rows.length }, examples: examples.length, machineVerification: { passed: verified, failed: examples.length - verified }, parseNotRunCount: examples.filter(example => example.parseStatus === "not-run").length, reasonCounts: Object.fromEntries([...new Set(reasons)].sort().map(reason => [reason, reasons.filter(value => value === reason).length])), humanApprovals: 0, verified, failed: examples.filter(value => value.status === "failed").length, unavailable: examples.filter(value => value.status === "unavailable").length, states: Object.fromEntries([...new Set(rows.map(row => row.state))].sort().map(state => [state, rows.filter(row => row.state === state).length])) } ;
	const markdown             = ["# 코퍼스 후보 요약", "", `관측 ${summary.observations}개 · 정확 키 ${summary.candidates}개 · 대표 검증 ${verified}/${examples.length}개`, "", "| 빈도 | 언어 | 검증 | lookup key |", "|---:|---|---:|---|", ...candidates.slice(0, 30).map(candidate => `| ${candidate.frequency} | ${candidate.language} | ${examples.filter(example => example.lookupKey === candidate.lookupKey && example.verified).length}/${examples.filter(example => example.lookupKey === candidate.lookupKey).length} | \`${candidate.lookupKey}\` |`), "", `미검토 키: ${Math.max(0, candidates.length - selected.size)}개`, ""] .join("\n")                                                                                                                                                                                                                                                            ;
	atomicSnapshot(outputDir, { "candidates.jsonl": candidates.map(jsonLine).join("\n") + (candidates.length ? "\n" : ""), "examples.jsonl": examples.map(jsonLine).join("\n") + (examples.length ? "\n" : ""), "summary.json": JSON.stringify(summary, null, 2) + "\n", "SUMMARY.md": markdown, "REVIEW.md": reviewMarkdown(candidates, examples) });
	return { candidates: candidates.length, examples: examples.length, verified };
}

function main(): void {
	const args  = process.argv.slice(2)                                                                                                       ;
	const value = (name: string): string | undefined => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; } ;
	if (args.includes("--review-only")) {
		regenerateReview(resolve(value("--output") ?? DEFAULT_OUT));
		console.log("corpus-candidates review regenerated");
		return;
	}
	const result = generateCandidates({ inputDir: value("--input"), outputDir: value("--output"), limit: value("--limit") === undefined ? undefined : Number(value("--limit")), reps: value("--reps") === undefined ? undefined : Number(value("--reps")) }) ;
	console.log(`corpus-candidates candidates=${result.candidates} examples=${result.examples} verified=${result.verified}`);
}

if (import.meta.main) main();
