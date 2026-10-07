#!/usr/bin/env bun
/**
 * 최소 평가 실행기 — 스모크용 (2026-10-01).
 * 공준 2(강제와 기록): 실행마다 매니페스트를 남긴다. 강제할 수 없는 것(공급자 무작위성,
 * CLI 숨은 시스템 지시, 응답의 모델 식별자 미노출)은 config.json에 명시한다.
 * 공준 5(조정자와 채점자의 분리): 채점은 이 스크립트의 결정적 대조가 한다.
 *
 * 사용:
 *   bun run scripts/eval.ts build     # eval/items/items.jsonl 생성 (A=기준, B=채굴, C=함정)
 *   bun run scripts/eval.ts run       # 주 실행 + 안정성 층(층화 부분표본 × 5회), 시드 셔플 (기본: gpt-6-sol medium)
 *   bun run scripts/eval.ts grade     # 마지막 run의 결정적 채점 + 잡음 바닥·Fleiss κ
 *   bun run scripts/eval.ts pack      # 사람 판정자용 블라인드 자료 팩 생성
 */
import      { spawnSync        } from "node:child_process" ;
import      { createHash       } from "node:crypto"        ;
import      {
              readFileSync   ,
              writeFileSync  ,
              mkdirSync      ,
              existsSync     ,
              appendFileSync ,
              cpSync         ,
              readdirSync    ,
              statSync       ,
                               } from "node:fs"            ;
import      {
              join           ,
              basename       ,
              extname        ,
              relative       ,
                               } from "node:path"          ;

const ROOT       = process.cwd()                                                    ;
const EVAL       = join(ROOT, "eval")                                               ;
const INSTR      = join(EVAL, "instructions")                                       ;
const ITEMS      = join(EVAL, "items", "items.jsonl")                               ;
const CANARY     = "ZZQCANARY7"                                                     ;
const CATEGORIES = ["correct", "different-role", "missing-kind", "taste", "unsure"] ;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex") ;
const read   = (p: string) => readFileSync(p, "utf8")                      ;

interface Item {
	id       : string          ;
	layer    : "A" | "B" | "C" ;
	lang     : string          ;
	source   : string          ;
	kind     : string          ;
	axes     : string          ;
	before   : string          ;
	after    : string | null   ;
	expected : string | null   ;
}

interface Occ {
	lang  : "ts" | "py"      ;
	file  : string           ;
	start : number           ;
	end   : number           ;
	rows  : number           ;
	shape : "pair" | "table" ;
	slot  : string | null    ;
	skind : string | null    ;
	axes  : string           ;
}

// ---------------------------------------------------------------- build

const ANCHOR_LANGS: Array<[string, string, string]> = [
	["python", "py", "py"],
	["go", "go", "go"],
	["c", "c", "c"],
	["rust", "rs", "rs"],
	["swift", "swift", "swift"],
	["java", "java", "java"],
];

function cmdBuild(): void {
	const items: Item[] = [];

	// A층 — 기준 항목: fixtures golden 쌍. 정답은 구조적으로 correct.
	for (const [dir, ext, lang] of ANCHOR_LANGS) {
		const base       = join(ROOT, "skills/xxx/fixtures", dir) ;
		const beforePath = join(base, `tables.${ext}`)            ;
		const afterPath  = join(base, `tables.aligned.${ext}`)    ;
		if (!existsSync(beforePath) || !existsSync(afterPath)) continue;
		items.push({
			id: `A-${dir}-01`, layer: "A", lang,
			source: `skills/xxx/fixtures/${dir}/tables.${ext}`,
			kind: "(파일 전체, 여러 표)", axes: "(파일 전체)",
			before: read(beforePath), after: read(afterPath), expected: "correct",
		});
	}

	// C층(수제) — different-role: 컴파일 후 소멸 선언(type)과 실행 선언(const/def/class)을 한 표로 묶은 제안.
	items.push({
		id: "C-hand-ts-role", layer: "C", lang: "ts",
		source: "hand-made (different-role 트랩)",
		kind: "declaration 혼합 제안", axes: "colon,semicolon",
		before: [
			"type FetchPort = (id: string) => Promise<Doc>;",
			`type RenderMode = "grid" | "list";`,
			"const fetchDoc = (id: string) => api.get(`/doc/${id}`);",
			"const renderGrid = (doc: Doc) => doc.toGrid();",
		].join("\n"),
		after: [
			"type FetchPort  = (id: string) => Promise<Doc>;",
			`type RenderMode = "grid" | "list";`,
			"const fetchDoc  = (id: string) => api.get(`/doc/${id}`);",
			"const renderGrid = (doc: Doc) => doc.toGrid();",
		].join("\n"),
		expected: "different-role",
	});
	items.push({
		id: "C-hand-py-role", layer: "C", lang: "py",
		source: "hand-made (different-role 트랩)",
		kind: "declaration 혼합 제안", axes: "equal,value",
		before: [
			"WIDTH = 120",
			'INDENT = "    "',
			"def load(path):",
			"    ...",
			"class Reader:",
			"    ...",
		].join("\n"),
		after: [
			"WIDTH  = 120",
			'INDENT = "    "',
			"def    load(path):",
			"    ...",
			"class  Reader:",
			"    ...",
		].join("\n"),
		expected: "different-role",
	});

	// B층 + C층(채굴) — eval/corpus 스냅샷에서 01_group-regions로 채굴한다.
	const occs: Occ[] = [];
	const files = walk(join(EVAL, "corpus"))
		.filter((f) => (/\.ts$|\.py$/.test(f)) && !f.includes("/.next/") && !f.includes("/dist/") && !f.endsWith(".d.ts"))
		.sort();
	for (const abs of files) {
		const rel = relative(ROOT, abs);
		try { occs.push(...groupRegions(rel)); } catch { /* 해석 실패 파일은 건너뛴다 */ }
	}

	// B층 — 3행 이상, 등록 축 있음, 빈도 상위 키. after는 실제 06 정렬 결과. expected 없음(탐색).
	const bKeys = new Map<string, Occ[]>();
	for (const o of occs) {
		if (o.rows < 3 || o.axes === "-" ) continue;
		const k = `${o.lang}|${o.axes}`;
		if (!bKeys.has(k)) bKeys.set(k, []);
		bKeys.get(k)!.push(o);
	}
	const bTop   = [...bKeys.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 16) ;
	const tmpDir = join(EVAL, "runs", "tmp-build")                                             ;
	mkdirSync(tmpDir, { recursive: true });
	let bN = 0;
	for (const [key, occsOfKey] of bTop) {
		const o      = occsOfKey[0]                      ;
		const before = fileLines(o.file, o.start, o.end) ;
		if (!before) continue;
		let after: string | null = null;
		try {
			const aligned = alignFileCopy(o.file, tmpDir);
			if (aligned) after = extractAfter(aligned, before, o.start);
		} catch { after = null; }
		bN += 1;
		items.push({
			id: `B-${String(bN).padStart(2, "0")}`, layer: "B", lang: o.lang,
			source: o.file, kind: o.skind ?? "(python 축)", axes: o.axes,
			before, after, expected: null,
		});
	}

	// C층(채굴) — missing-kind: 3행 이상 표 같은 구조인데 축이 없음. 등록된 KIND로 지도되는
	// 구문(import·const·type·guard 등)은 트랩이 안 된다(smoke의 C-miss-01 교훈) — 실행 흐름 구문만.
	const PURE_MISS = new Set(["ForOfStatement", "ForStatement", "WhileStatement", "DoStatement", "FunctionDeclaration", "ReturnStatement", "TryStatement", "SwitchStatement"])                                                                                                                     ;
	const MAPPED    = new Set(["ImportDeclaration", "FirstStatement", "VariableStatement", "TypeAliasDeclaration", "IfStatement", "ExpressionStatement", "PropertyAssignment", "PropertyDeclaration", "MethodDeclaration", "EnumMember", "CaseClause", "InterfaceDeclaration", "ClassDeclaration"]) ;
	let mN          = 0                                                                                                                                                                                                                                                                             ;
	const missSeen  = new Set<string>()                                                                                                                                                                                                                                                             ;
	for (const o of occs) {
		if (mN >= 2) break;
		if (o.shape !== "table" || o.axes !== "-" || o.rows < 3 || missSeen.has(o.file)) continue;
		const kind = o.skind ?? "";
		if (!(PURE_MISS.has(kind) || (kind !== "" && !MAPPED.has(kind)))) continue;
		const before = fileLines(o.file, o.start, o.end);
		if (!before) continue;
		missSeen.add(o.file);
		mN += 1;
		items.push({
			id: `C-miss-${String(mN).padStart(2, "0")}`, layer: "C", lang: o.lang,
			source: o.file, kind: o.skind ?? "(python 축)", axes: "-",
			before, after: null, expected: "missing-kind",
		});
	}

	// C층(채굴) — taste: 2행 묶음(=` 선언/import가 아닌), 사용자 확인이 필요한 영역.
	let tN          = 0                 ;
	const tasteSeen = new Set<string>() ;
	for (const o of occs) {
		if (tN >= 2) break;
		if (o.rows !== 2 || tasteSeen.has(o.file)) continue;
		if (o.skind === "ImportDeclaration" || (o.axes ?? "").includes("equal")) continue; // 규약상 표가 되는 2행은 제외
		const before = fileLines(o.file, o.start, o.end);
		if (!before) continue;
		tasteSeen.add(o.file);
		tN += 1;
		items.push({
			id: `C-taste-${String(tN).padStart(2, "0")}`, layer: "C", lang: o.lang,
			source: o.file, kind: o.skind ?? "(python 축)", axes: o.axes,
			before, after: null, expected: "taste",
		});
	}

	writeFileSync(ITEMS, items.map((i) => JSON.stringify(i)).join("\n") + "\n");
	const tally = { A: 0, B: 0, C: 0 } as Record<string, number>;
	for (const i of items) tally[i.layer] += 1;
	console.error(`items.jsonl: ${items.length}건 (A=${tally.A} B=${tally.B} C=${tally.C}) — B의 after 추출 실패는 after=null로 남긴다`);
}

// ---------------------------------------------------------------- run

function cmdRun(): void {
	const model         = argOf("--model")  ?? "gpt-6-sol"                         ;
	const effort        = argOf("--effort") ?? "medium"                            ;
	const seed          = Number(argOf("--seed") ?? 20261001)                      ;
	const stbN          = Number(argOf("--stability-n") ?? 8)                      ;
	const reps          = Number(argOf("--reps") ?? 5)                             ;
	const items: Item[] = read(ITEMS).trim().split("\n").map((l) => JSON.parse(l)) ;

	const runId  = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) ;
	const runDir = join(EVAL, "runs", runId)                                   ;
	mkdirSync(join(runDir, "raw"), { recursive: true });
	mkdirSync(join(runDir, "work"), { recursive: true });
	const home = join(runDir, "codex-home");
	mkdirSync(home, { recursive: true });
	cpSync(join(process.env.HOME ?? "", ".codex/auth.json"), join(home, "auth.json"));
	// 조작 점검용 카나리: 프롬프트에는 이 토큰이 없다. 응답에 나오면 문맥 누출.
	writeFileSync(join(runDir, "work", "canary-note.md"), `${CANARY} 격리 검증용 마커다. 읽지 않는다.\n`);

	const template     = read(join(INSTR, "prompt-template-v1.txt"))                                   ;
	const instructions = read(join(INSTR, "judgment-v1.md"))                                           ;
	const schemaPath   = join(INSTR, "output-schema-v0.json")                                          ;
	const schema       = read(schemaPath)                                                              ;
	const cliVersion   = (spawnSync("codex", ["--version"], { encoding: "utf8" }).stdout ?? "").trim() ;
	const workHash     = sha256(JSON.stringify(listWork(join(runDir, "work"))))                        ;

	// 실행 계획: 주(모든 항목 1회) + 안정성(층화 부분표본 × reps, 주 실행과 별도 — 원고 7.5절).
	// 전체를 시드로 섞어 같은 입력이 연달아 오지 않게 한다(명제 3). 반복을 다수결하지 않는다.
	const rnd     = mulberry32(seed)                                           ;
	const byLayer = (l: "A" | "B" | "C") => items.filter((i) => i.layer === l) ;
	const nA      = Math.max(1, Math.round(stbN * 0.25))                       ;
	const nB      = Math.max(2, Math.round(stbN * 0.5))                        ;
	const sub = [
		...shuffle(byLayer("A"), rnd).slice(0, nA),
		...shuffle(byLayer("B"), rnd).slice(0, nB),
		...shuffle(byLayer("C"), rnd).slice(0, Math.max(1, stbN - nA - nB)),
	];
	const plan = shuffle([
		...items.map((item) => ({ item, attempt: 1 })),
		...shuffle(sub.flatMap((item) => Array.from({ length: reps }, (_, r) => ({ item, attempt: r + 2 }))), rnd),
	], rnd);

	writeFileSync(join(runDir, "config.json"), JSON.stringify({
		runId, model, effort,
		cli: "codex exec", cli_version: cliVersion,
		template_version: "v1", instructions_sha256: sha256(instructions),
		template_sha256: sha256(template), schema_sha256: sha256(schema),
		order_seed: seed,
		stability_design: {
			subsample: sub.map((i) => i.id), strata: { A: nA, B: nB, C: sub.length - nA - nB },
			reps, note: "반복은 주 실행과 별도이고 다수결하지 않는다(원고 7.5절). 반복은 전체 실행 순서에 섞여 배치된다(명제 3).",
		},
		isolation: {
			codex_home: "임시 홈 — auth.json만 포함(AGENTS.md·config·메모리·스킬 없음). 사전 프로브로 AGENTS.md 비로드 확인(2026-10-01)",
			workdir: "비어있는 전용 폴더 + 카나리 파일",
			sandbox: "read-only", git_repo_check: "skip(작업 폴더는 비저장소)",
		},
		workdir_sha256               : workHash,
		model_identifier_in_response : "CLI가 노출하지 않음 — 요청 모델 id만 기록(원고 4절 모델 업데이트 항의 제한)",
		uncontrollable               : ["공급자 무작위성(시드 지정 불가)", "CLI 숨은 시스템 지시(명제 1 — 결론을 CLI 조합으로 한정)"],
		cost_basis                   : "CLI 구독 — API 정가 환산 안 함(토큰 사용량만 기록)",
		started_at                   : new Date().toISOString(),
		plan                         : plan.map(({ item, attempt }) => ({ id: item.id, attempt })),
	}, null, "\t") + "\n");

	const manifestPath = join(runDir, "manifest.jsonl");
	for (const { item, attempt } of plan) {
		runOne({ runDir, home, manifestPath, template, instructions, schemaPath, schema, cliVersion, workHash, model, effort, item, attempt });
	}
	console.error(`run 완료: ${runDir}`);
}

function runOne(ctx: {
	runDir: string; home: string; manifestPath: string;
	template: string; instructions: string; schemaPath: string; schema: string;
	cliVersion: string; workHash: string; model: string; effort: string;
	item: Item; attempt: number;
}): void {
	const { runDir, home, manifestPath, template, instructions, schemaPath, schema, cliVersion, workHash, model, effort, item, attempt } = ctx;
	const afterBlock = item.after == null
		? "after: 없음 — 이 구조에는 아직 정렬 규칙(제안)이 없다."
		: ["after (정렬기 제안):", "```" + item.lang, item.after ?? "", "```"].join("\n");
	const prompt = template
		.replaceAll("<INSTRUCTIONS>", instructions)
		.replaceAll("<LANG>", item.lang)
		.replaceAll("<KIND>", item.kind)
		.replaceAll("<AXES>", item.axes)
		.replaceAll("<SOURCE>", item.source)
		.replaceAll("<BEFORE>", item.before)
		.replaceAll("<AFTER_BLOCK>", afterBlock);

	const tag       = `${item.id}.a${attempt}`            ;
	const respPath  = join(runDir, "raw", `${tag}.resp`)  ;
	const jsonlPath = join(runDir, "raw", `${tag}.jsonl`) ;
	writeFileSync(join(runDir, "raw", `${tag}.prompt`), prompt);

	const t0 = Date.now();
	const r = spawnSync("codex", [
		"exec", "--json",
		"-C", join(runDir, "work"),
		"--skip-git-repo-check",
		"-s", "read-only",
		"-m", model,
		"-c", `model_reasoning_effort=${effort}`,
		"--output-schema", schemaPath,
		"-o", respPath,
	], {
		cwd: ROOT, encoding: "utf8", input: prompt, maxBuffer: 64 * 1024 * 1024,
		timeout: 120_000,
		env: { ...process.env, CODEX_HOME: home },
	});
	const wall = Date.now() - t0;
	writeFileSync(jsonlPath, r.stdout ?? "");

	let usage    : Record<string, number> | null = null ;
	let threadId : string | null                 = null ;
	for (const line of (r.stdout ?? "").split("\n")) {
		try {
			const e = JSON.parse(line);
			if (e.type === "turn.completed") usage = e.usage ?? null;
			if (e.type === "thread.started") threadId = e.thread_id ?? null;
		} catch { /* 이벤트가 아닌 줄 */ }
	}

	let judgment   : string | null = null ;
	let reason     : string | null = null ;
	let parseError : string | null = null ;
	if (existsSync(respPath)) {
		try {
			const txt = read(respPath).trim().replace(/^```(json)?\s*/u, "").replace(/\s*```$/u, "") ;
			const j   = JSON.parse(txt)                                                              ;
			if (CATEGORIES.includes(j.judgment)) { judgment = j.judgment; reason = j.reason ?? null; }
			else parseError = `범주 밖 값: ${String(j.judgment).slice(0, 40)}`;
		} catch (e) { parseError = `JSON 해석 실패: ${String(e).slice(0, 60)}`; }
	} else parseError = `응답 파일 없음(exit ${r.status}, ${String(r.stderr ?? "").split("\n")[0]?.slice(0, 60)})`;

	const canaryLeak = (r.stdout ?? "").includes(CANARY) || (existsSync(respPath) ? read(respPath).includes(CANARY) : false);

	appendFileSync(manifestPath, JSON.stringify({
		id: item.id, attempt, layer: item.layer, expected: item.expected,
		cli: "codex exec", cli_version: cliVersion, model_requested: model, effort,
		template_version: "v1", tool_permission: "read-only sandbox", time_limit_s: 120,
		prompt_sha256: sha256(prompt), workdir_sha256: workHash,
		isolation: "CODEX_HOME=temp(auth.json만)", output_schema_sha256: sha256(schema),
		thread_id: threadId, started_at: new Date(t0).toISOString(), wall_ms: wall,
		usage, exit_status: r.status,
		judgment, reason, valid: judgment != null, parse_error: parseError, canary_leak: canaryLeak,
	}) + "\n");
	console.error(`${item.id} a${attempt} → ${judgment ?? `무효(${parseError})`} (${(wall / 1000).toFixed(1)}s)`);
}

// ---------------------------------------------------------------- grade

function cmdGrade(): void {
	const runDir = latestRun();
	if (!runDir) throw new Error("run이 없다");
	const lines = read(join(runDir, "manifest.jsonl")).trim().split("\n").map((l) => JSON.parse(l)) ;
	const first = lines.filter((l: any) => l.attempt === 1)                                         ;

	const scoreRows = first.filter((l: any) => l.layer !== "B").map((l: any) => ({
		id: l.id, expected: l.expected, got: l.judgment, ok: l.judgment === l.expected,
	}));
	const okN                           = scoreRows.filter((r) => r.ok).length      ;
	const bRows                         = first.filter((l: any) => l.layer === "B") ;
	const bDist: Record<string, number> = {}                                        ;
	for (const l of bRows) { const k = l.judgment ?? "invalid"; bDist[k] = (bDist[k] ?? 0) + 1; }

	// 위험 범주 재현율(C층: different-role / missing-kind, attempt 1)
	const risk = ["different-role", "missing-kind"].map((c) => {
		const rows = first.filter((l: any) => l.expected === c)       ;
		const hit  = rows.filter((l: any) => l.judgment === c).length ;
		return { category: c, hit, total: rows.length };
	});

	// 안정성 층(attempt >= 2): 잡음 바닥·최빈 라벨 비율·쌍별 불일치율·위험 뒤집힘·Fleiss κ(원고 7.5절).
	const itemsById  = new Map<string, Item>(read(ITEMS).trim().split("\n").map((l) => JSON.parse(l)).map((i: Item) => [i.id, i])) ;
	const RISK       = new Set(["different-role", "missing-kind"])                                                                 ;
	const stabByItem = new Map<string, Array<any>>()                                                                               ;
	for (const l of lines) {
		if (l.attempt < 2) continue;
		if (!stabByItem.has(l.id)) stabByItem.set(l.id, []);
		stabByItem.get(l.id)!.push(l);
	}
	const stabRows: any[] = [] ;
	let flipPairs         = 0  ;
	let totalPairs        = 0  ;
	for (const [id, ls] of stabByItem) {
		const labels = ls.sort((a: any, b: any) => a.attempt - b.attempt).map((l: any) => l.judgment ?? "invalid") ;
		const k      = labels.length                                                                               ;
		const counts = new Map<string, number>()                                                                   ;
		for (const t of labels) counts.set(t, (counts.get(t) ?? 0) + 1);
		const modeRatio = Math.max(...counts.values()) / k ;
		let dis         = 0                                ;
		for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) if (labels[i] !== labels[j]) dis += 1;
		flipPairs += dis;
		totalPairs += (k * (k - 1)) / 2;
		const gold = itemsById.get(id)?.expected ?? null;
		stabRows.push({
			id, k, labels,
			mode_ratio        : modeRatio,
			pair_disagreement : dis / ((k * (k - 1)) / 2),
			flipped           : modeRatio < 1,
			gold,
			miss_direction  : gold != null && RISK.has(gold) && labels.some((t) => !RISK.has(t)),
			false_alarm     : gold != null && !RISK.has(gold) && labels.some((t) => RISK.has(t)),
			direction_known : gold != null,
		});
	}
	const noiseFloor           = totalPairs > 0 ? flipPairs / totalPairs : null              ;
	const nRaters              = stabRows.length ? Math.max(...stabRows.map((r) => r.k)) : 0 ;
	let fleissK: number | null = null                                                        ;
	if (stabRows.length > 0 && nRaters >= 2) {
		const totalRatings = stabRows.reduce((s, r) => s + r.k, 0)                                                                                               ;
		const pj           = CATEGORIES.map((c) => stabRows.reduce((s: number, r: any) => s + r.labels.filter((t: string) => t === c).length, 0) / totalRatings) ;
		const Pe           = pj.reduce((s, v) => s + v * v, 0)                                                                                                   ;
		const Pbar = stabRows.reduce((s: number, r: any) => {
			let sum = 0;
			for (const c of CATEGORIES) { const n = r.labels.filter((t: string) => t === c).length; sum += n * (n - 1); }
			return s + sum / (r.k * (r.k - 1));
		}, 0) / stabRows.length;
		fleissK = Pe < 1 ? (Pbar - Pe) / (1 - Pe) : 1;
	}

	const invalid = lines.filter((l: any) => !l.valid)                                                                   ;
	const canary  = lines.filter((l: any) => l.canary_leak)                                                              ;
	const inputT  = lines.reduce((s: number, l: any) => s + (l.usage?.input_tokens ?? 0), 0)                             ;
	const outputT = lines.reduce((s: number, l: any) => s + (l.usage?.output_tokens ?? 0), 0)                            ;
	const cachedT = lines.reduce((s: number, l: any) => s + (l.usage?.cached_input_tokens ?? 0), 0)                      ;
	const wallAvg = Math.round(lines.reduce((s: number, l: any) => s + (l.wall_ms ?? 0), 0) / Math.max(1, lines.length)) ;

	const summary = {
		run: runDir,
		scores: scoreRows,
		score_ok: okN, score_total: scoreRows.length,
		risk_recall_attempt1: risk,
		B_distribution: bDist,
		stability: {
			noise_floor: noiseFloor,
			fleiss_kappa_reps: fleissK,
			flip_directions: {
				miss         : stabRows.filter((r) => r.miss_direction).length,
				false_alarm  : stabRows.filter((r) => r.false_alarm).length,
				unknown_gold : stabRows.filter((r) => !r.direction_known && r.flipped).length,
			},
			rows: stabRows,
		},
		invalid_count     : invalid.length,
		invalid_detail    : invalid.map((l: any) => ({ id: l.id, attempt: l.attempt, error: l.parse_error })),
		canary_leak_count : canary.length,
		tokens            : { input_total: inputT, cached_input_total: cachedT, output_total: outputT },
		wall_ms_avg       : wallAvg,
		cost_note         : "CLI 구독 실행 — API 정가 환산 없음. 토큰 사용량만 기록(원고 부록 B는 API 기준).",
	};
	writeFileSync(join(runDir, "grade.json"), JSON.stringify(summary, null, "\t") + "\n");

	console.log(`=== 채점 요약 (${runDir}) ===`);
	console.log(`A+C 정합: ${okN}/${scoreRows.length}`);
	for (const r of scoreRows) console.log(`  ${r.ok ? "✓" : "✗"} ${r.id}: expected=${r.expected} got=${r.got}`);
	console.log(`위험 재현율(attempt1): ${risk.map((r) => `${r.category} ${r.hit}/${r.total}`).join(", ")}`);
	console.log(`B 범주 분포(탐색): ${JSON.stringify(bDist)}`);
	console.log(`잡음 바닥(쌍별 불일치): ${noiseFloor == null ? "측정 없음" : (noiseFloor * 100).toFixed(1) + "%"} · Fleiss κ(반복 간): ${fleissK == null ? "측정 없음" : fleissK.toFixed(3)}`);
	for (const r of stabRows) console.log(`  ${r.flipped ? "↯" : "="} ${r.id}: ${r.labels.join(" | ")} (최빈 ${r.mode_ratio * 100}%)`);
	console.log(`무효 ${invalid.length}건 · 카나리 누출 ${canary.length}건 · 토큰 in=${inputT}(cached ${cachedT}) out=${outputT} · 평균 ${(wallAvg / 1000).toFixed(1)}s/호출`);
}

// ---------------------------------------------------------------- pack (사람 판정자용)

function cmdPack(): void {
	const items: Item[] = read(ITEMS).trim().split("\n").map((l) => JSON.parse(l))               ;
	const instructions  = read(join(INSTR, "judgment-v1.md"))                                    ;
	const outDir        = join(EVAL, "judging", new Date().toISOString().slice(0, 10) + "-pack") ;
	mkdirSync(join(outDir, "sheets"), { recursive: true });
	// 블라인드: expected 칸과 모델 출력은 팩에 넣지 않는다. 판정 근거는 지침 v1뿐이다.
	for (const i of items) {
		const sheet = [
			`# ${i.id} (${i.layer}층 · ${i.lang})`, ``,
			`언어: ${i.lang} · 표 종류 후보: ${i.kind} / 축: ${i.axes} · 출처: ${i.source}`, ``,
			`before:`, "```" + i.lang, i.before, "```", ``,
			i.after == null
				? `after: 없음 — 아직 정렬 규칙(제안)이 없다.`
				: [`after (정렬기 제안):`, "```" + i.lang, i.after, "```"].join("\n"),
			``, `---`, `판정: (correct / different-role / missing-kind / taste / unsure 중 하나)`, `이유(한 문장):`, ``,
		].join("\n");
		writeFileSync(join(outDir, "sheets", `${i.id}.md`), sheet);
	}
	writeFileSync(join(outDir, "answers-판정자이름.csv"), "id,judgment,reason\n" + items.map((i) => `${i.id},`).join("\n") + "\n");
	writeFileSync(join(outDir, "README.md"), [
		`# 사람 판정 팩 (${new Date().toISOString().slice(0, 10)})`, ``,
		`- sheets/의 각 항목에서 before/after를 보고 다섯 범주 중 하나로 판정한다. 모델 출력과 예상 정답은 일부러 빠져 있다(블라인드).`,
		`- 판정자마다 \`answers-<이름>.csv\`를 복사해 id별 judgment와 한 문장 이유를 채운다. 판정자끼리 답을 보지 않는다(독립 판정).`,
		`- 합의 전 라벨과 이견 항목은 그대로 보존한다. 이견 조정은 두 판정이 모두 끝난 뒤 별도로 한다.`,
		`- 판정의 유일한 근거는 아래 지침이다:`, ``, instructions,
	].join("\n"));
	console.error(`pack: ${outDir} (${items.length}건)`);
}

// ---------------------------------------------------------------- helpers

function mulberry32(seed: number): () => number {
	let s = seed | 0;
	return () => {
		s = (s + 0x6D2B79F5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function shuffle<T>(arr: readonly T[], rnd: () => number): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

function walk(dir: string): string[] {
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		const p = join(dir, name) ;
		const s = statSync(p)     ;
		if (s.isDirectory()) out.push(...walk(p));
		else out.push(p);
	}
	return out;
}

function listWork(dir: string): Record<string, string> {
	const map: Record<string, string> = {};
	for (const p of walk(dir)) map[relative(dir, p)] = sha256(read(p));
	return map;
}

function groupRegions(rel: string): Occ[] {
	const lang : "ts" | "py" = extname(rel) === ".py" ? "py" : "ts"                                                                           ;
	const script             = join(ROOT, "skills/xxx/scripts", lang === "py" ? "python" : "typescript", "01_group-regions.ts")               ;
	const r                  = spawnSync("bun", ["run", script, "--file", rel], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }) ;
	const occs : Occ[]       = []                                                                                                             ;
	for (const line of (r.stdout ?? "").split("\n")) {
		let m = line.match(/^\s+(\d+)(?:-(\d+))?\s+(\S+)\s+(\S+)\s+rows=\s*(\d+)\s+(pair|table)\s+axes=(\S+)\s*$/);
		if (m) {
			occs.push({ lang, file: rel, start: +m[1], end: m[2] ? +m[2] : +m[1], rows: +m[5], shape: m[6] as "pair" | "table", slot: m[3], skind: m[4], axes: m[7] });
			continue;
		}
		m = line.match(/^\s+(\d+)(?:-(\d+))?\s+rows=\s*(\d+)\s+axes=(\S+)\s*$/);
		if (m) {
			const rows = +m[3];
			occs.push({ lang, file: rel, start: +m[1], end: m[2] ? +m[2] : +m[1], rows, shape: rows >= 3 ? "table" : "pair", slot: null, skind: null, axes: m[4] });
		}
	}
	return occs;
}

function fileLines(rel: string, start: number, end: number): string | null {
	const all = read(join(ROOT, rel)).split("\n");
	if (start < 1 || end > all.length || end < start) return null;
	return all.slice(start - 1, end).join("\n");
}

function alignFileCopy(rel: string, tmpDir: string): string | null {
	const tmp = join(tmpDir, sha256(rel).slice(0, 8) + "-" + basename(rel));
	cpSync(join(ROOT, rel), tmp);
	const lang = extname(rel) === ".py" ? "python" : "typescript";
	spawnSync("bun", ["run", join(ROOT, "skills/xxx/scripts", lang, "06_align-tables.ts"), "--file", tmp, "--write"], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
	// 06은 "정렬 필요 있음"도 exit 1로 알리므로 상태 코드가 아니라 산출물로 판단한다.
	return existsSync(tmp) ? read(tmp) : null;
}

function extractAfter(aligned: string, before: string, start: number): string | null {
	const rows = before.split("\n").length;
	// 정렬은 공백만 바꾸므로(콜론 앞 이동 포함) 공백을 모두 지우면 첫 행 내용이 그대로 남는다.
	// 세로형 줄바꿈으로 첫 행이 짧아졌을 경우를 대비해 접두어 매칭을 이중으로 둔다.
	const squash = (s: string) => s.replace(/\s+/g, "") ;
	const exact  = squash(before.split("\n")[0])        ;
	const head   = exact.slice(0, 20)                   ;
	if (!exact) return null;
	const al   = aligned.split("\n")    ;
	const from = Math.max(0, start - 6) ;
	for (let i = from; i < Math.min(al.length, start + rows + 15); i++) {
		const t = squash(al[i] ?? "");
		if (t === exact || (head.length >= 8 && (t.startsWith(head) || (t.length >= 10 && exact.startsWith(t))))) {
			return al.slice(i, i + rows).join("\n");
		}
	}
	return null;
}

function argOf(name: string): string | null {
	const i = process.argv.indexOf(name);
	return i >= 0 ? process.argv[i + 1] ?? null : null;
}

function latestRun(): string | null {
	const dir = join(EVAL, "runs");
	if (!existsSync(dir)) return null;
	const runs = readdirSync(dir).filter((n) => n !== "tmp-build").sort();
	return runs.length ? join(dir, runs[runs.length - 1]) : null;
}

const cmd = process.argv[2];
if (cmd === "build") cmdBuild();
else if (cmd === "run") cmdRun();
else if (cmd === "grade") cmdGrade();
else if (cmd === "pack") cmdPack();
else {
	console.error("사용: bun run scripts/eval.ts <build|run|grade|pack>");
	process.exit(1);
}
