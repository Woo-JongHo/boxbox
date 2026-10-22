#!/usr/bin/env bun
/**
 * Minimal evaluation runner — for smoke tests (2026-10-01).
 * Postulate 2 (enforce and record): leaves a manifest per run. What cannot be enforced (provider randomness,
 * hidden CLI system instructions, model identifiers not exposed in responses) is stated in config.json.
 * Postulate 5 (separate coordinator and grader): grading is this script's deterministic comparison.
 *
 * Usage:
 *   bun run development/tools/eval.ts build     # builds eval/items/items.jsonl (A=reference, B=mined, C=traps)
 *   bun run development/tools/eval.ts run       # main run + stability layer (stratified subsample × 5), seeded shuffle (default: gpt-6-sol medium)
 *   bun run development/tools/eval.ts grade     # deterministic grading of the last run + noise floor and Fleiss κ
 *   bun run development/tools/eval.ts pack      # builds a blind material pack for human judges
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
];

function cmdBuild(): void {
	const items: Item[] = [];

	// Layer A — reference items: fixture golden pairs. The answer is structurally correct.
	for (const [dir, ext, lang] of ANCHOR_LANGS) {
		const base       = join(ROOT, "test/fixtures", dir)    ;
		const beforePath = join(base, `tables.${ext}`)         ;
		const afterPath  = join(base, `tables.aligned.${ext}`) ;
		if (!existsSync(beforePath) || !existsSync(afterPath)) continue;
		items.push({
			id: `A-${dir}-01`, layer: "A", lang,
			source: `test/fixtures/${dir}/tables.${ext}`,
			kind: "(whole file, several tables)", axes: "(whole file)",
			before: read(beforePath), after: read(afterPath), expected: "correct",
		});
	}

	// Layer C (hand-made) — different-role: a proposal that puts compile-time-erased declarations (type) and runtime declarations (const/def/class) in one table.
	items.push({
		id: "C-hand-ts-role", layer: "C", lang: "ts",
		source: "hand-made (different-role trap)",
		kind: "mixed declaration proposal", axes: "colon,semicolon",
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
		source: "hand-made (different-role trap)",
		kind: "mixed declaration proposal", axes: "equal,value",
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

	// Layers B + C (mined) — mined from the eval/corpus snapshot with 01_group-regions.
	const occs: Occ[] = [];
	const files = walk(join(EVAL, "corpus"))
		.filter((f) => (/\.ts$|\.py$/.test(f)) && !f.includes("/.next/") && !f.includes("/dist/") && !f.endsWith(".d.ts"))
		.sort();
	for (const abs of files) {
		const rel = relative(ROOT, abs);
		try { occs.push(...groupRegions(rel)); } catch { /* skip files that fail to parse */ }
	}

	// Layer B — 3+ rows, registered axes, top-frequency keys. after is the real 06 alignment result. No expected value (exploratory).
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
			source: o.file, kind: o.skind ?? "(python axes)", axes: o.axes,
			before, after, expected: null,
		});
	}

	// Layer C (mined) — missing-kind: a 3+ row table-like structure without axes. Syntax that maps to a registered KIND
	// (import, const, type, guard, ...) cannot be a trap (lesson from smoke C-miss-01) — execution-flow syntax only.
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
			source: o.file, kind: o.skind ?? "(python axes)", axes: "-",
			before, after: null, expected: "missing-kind",
		});
	}

	// Layer C (mined) — taste: two-row groups (not `=` declarations/imports), an area that needs user confirmation.
	let tN          = 0                 ;
	const tasteSeen = new Set<string>() ;
	for (const o of occs) {
		if (tN >= 2) break;
		if (o.rows !== 2 || tasteSeen.has(o.file)) continue;
		if (o.skind === "ImportDeclaration" || (o.axes ?? "").includes("equal")) continue; // two-row groups that become tables by convention are excluded
		const before = fileLines(o.file, o.start, o.end);
		if (!before) continue;
		tasteSeen.add(o.file);
		tN += 1;
		items.push({
			id: `C-taste-${String(tN).padStart(2, "0")}`, layer: "C", lang: o.lang,
			source: o.file, kind: o.skind ?? "(python axes)", axes: o.axes,
			before, after: null, expected: "taste",
		});
	}

	writeFileSync(ITEMS, items.map((i) => JSON.stringify(i)).join("\n") + "\n");
	const tally = { A: 0, B: 0, C: 0 } as Record<string, number>;
	for (const i of items) tally[i.layer] += 1;
	console.error(`items.jsonl: ${items.length} item(s) (A=${tally.A} B=${tally.B} C=${tally.C}) — failed B after extraction is kept as after=null`);
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
	// Canary for tampering checks: the prompt does not contain this token. If it appears in a response, context leaked.
	writeFileSync(join(runDir, "work", "canary-note.md"), `${CANARY} marker for isolation checks. Do not read.\n`);

	const template     = read(join(INSTR, "prompt-template-v1.txt"))                                   ;
	const instructions = read(join(INSTR, "judgment-v1.md"))                                           ;
	const schemaPath   = join(INSTR, "output-schema-v0.json")                                          ;
	const schema       = read(schemaPath)                                                              ;
	const cliVersion   = (spawnSync("codex", ["--version"], { encoding: "utf8" }).stdout ?? "").trim() ;
	const workHash     = sha256(JSON.stringify(listWork(join(runDir, "work"))))                        ;

	// Run plan: main (every item once) + stability (stratified subsample × reps, separate from the main run — manuscript section 7.5).
	// The whole plan is shuffled with a seed so the same input does not come back to back (proposition 3). Repeats are never majority-voted.
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
			reps, note: "Repeats are separate from the main run and never majority-voted (manuscript section 7.5). Repeats are interleaved into the overall run order (proposition 3).",
		},
		isolation: {
			codex_home: "temporary home — only auth.json (no AGENTS.md, config, memory or skills). A pre-probe confirmed AGENTS.md is not loaded (2026-10-01)",
			workdir: "empty dedicated folder + canary file",
			sandbox: "read-only", git_repo_check: "skip (the work folder is not a repository)",
		},
		workdir_sha256               : workHash,
		model_identifier_in_response : "not exposed by the CLI — only the requested model id is recorded (limit of the model-update clause in manuscript section 4)",
		uncontrollable               : ["provider randomness (no seed control)", "hidden CLI system instructions (proposition 1 — conclusions limited to the CLI combination)"],
		cost_basis                   : "CLI subscription — not converted to API list price (token usage recorded only)",
		started_at                   : new Date().toISOString(),
		plan                         : plan.map(({ item, attempt }) => ({ id: item.id, attempt })),
	}, null, "\t") + "\n");

	const manifestPath = join(runDir, "manifest.jsonl");
	for (const { item, attempt } of plan) {
		runOne({ runDir, home, manifestPath, template, instructions, schemaPath, schema, cliVersion, workHash, model, effort, item, attempt });
	}
	console.error(`run complete: ${runDir}`);
}

function runOne(ctx: {
	runDir: string; home: string; manifestPath: string;
	template: string; instructions: string; schemaPath: string; schema: string;
	cliVersion: string; workHash: string; model: string; effort: string;
	item: Item; attempt: number;
}): void {
	const { runDir, home, manifestPath, template, instructions, schemaPath, schema, cliVersion, workHash, model, effort, item, attempt } = ctx;
	const afterBlock = item.after == null
		? "after: none — there is no alignment rule (proposal) for this structure yet."
		: ["after (aligner proposal):", "```" + item.lang, item.after ?? "", "```"].join("\n");
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
		} catch { /* not an event line */ }
	}

	let judgment   : string | null = null ;
	let reason     : string | null = null ;
	let parseError : string | null = null ;
	if (existsSync(respPath)) {
		try {
			const txt = read(respPath).trim().replace(/^```(json)?\s*/u, "").replace(/\s*```$/u, "") ;
			const j   = JSON.parse(txt)                                                              ;
			if (CATEGORIES.includes(j.judgment)) { judgment = j.judgment; reason = j.reason ?? null; }
			else parseError = `value outside the categories: ${String(j.judgment).slice(0, 40)}`;
		} catch (e) { parseError = `JSON parse failed: ${String(e).slice(0, 60)}`; }
	} else parseError = `no response file (exit ${r.status}, ${String(r.stderr ?? "").split("\n")[0]?.slice(0, 60)})`;

	const canaryLeak = (r.stdout ?? "").includes(CANARY) || (existsSync(respPath) ? read(respPath).includes(CANARY) : false);

	appendFileSync(manifestPath, JSON.stringify({
		id: item.id, attempt, layer: item.layer, expected: item.expected,
		cli: "codex exec", cli_version: cliVersion, model_requested: model, effort,
		template_version: "v1", tool_permission: "read-only sandbox", time_limit_s: 120,
		prompt_sha256: sha256(prompt), workdir_sha256: workHash,
		isolation: "CODEX_HOME=temp (auth.json only)", output_schema_sha256: sha256(schema),
		thread_id: threadId, started_at: new Date(t0).toISOString(), wall_ms: wall,
		usage, exit_status: r.status,
		judgment, reason, valid: judgment != null, parse_error: parseError, canary_leak: canaryLeak,
	}) + "\n");
	console.error(`${item.id} a${attempt} → ${judgment ?? `invalid(${parseError})`} (${(wall / 1000).toFixed(1)}s)`);
}

// ---------------------------------------------------------------- grade

function cmdGrade(): void {
	const runDir = latestRun();
	if (!runDir) throw new Error("no run");
	const lines = read(join(runDir, "manifest.jsonl")).trim().split("\n").map((l) => JSON.parse(l)) ;
	const first = lines.filter((l: any) => l.attempt === 1)                                         ;

	const scoreRows = first.filter((l: any) => l.layer !== "B").map((l: any) => ({
		id: l.id, expected: l.expected, got: l.judgment, ok: l.judgment === l.expected,
	}));
	const okN                           = scoreRows.filter((r) => r.ok).length      ;
	const bRows                         = first.filter((l: any) => l.layer === "B") ;
	const bDist: Record<string, number> = {}                                        ;
	for (const l of bRows) { const k = l.judgment ?? "invalid"; bDist[k] = (bDist[k] ?? 0) + 1; }

	// Risk-category recall (layer C: different-role / missing-kind, attempt 1)
	const risk = ["different-role", "missing-kind"].map((c) => {
		const rows = first.filter((l: any) => l.expected === c)       ;
		const hit  = rows.filter((l: any) => l.judgment === c).length ;
		return { category: c, hit, total: rows.length };
	});

	// Stability layer (attempt >= 2): noise floor, modal-label share, pairwise disagreement, risk flips, Fleiss κ (manuscript section 7.5).
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
		cost_note         : "CLI subscription run — not converted to API list price. Token usage recorded only (manuscript appendix B uses API pricing).",
	};
	writeFileSync(join(runDir, "grade.json"), JSON.stringify(summary, null, "\t") + "\n");

	console.log(`=== grading summary (${runDir}) ===`);
	console.log(`A+C agreement: ${okN}/${scoreRows.length}`);
	for (const r of scoreRows) console.log(`  ${r.ok ? "✓" : "✗"} ${r.id}: expected=${r.expected} got=${r.got}`);
	console.log(`risk recall (attempt1): ${risk.map((r) => `${r.category} ${r.hit}/${r.total}`).join(", ")}`);
	console.log(`B category distribution (exploratory): ${JSON.stringify(bDist)}`);
	console.log(`noise floor (pairwise disagreement): ${noiseFloor == null ? "not measured" : (noiseFloor * 100).toFixed(1) + "%"} · Fleiss κ (across repeats): ${fleissK == null ? "not measured" : fleissK.toFixed(3)}`);
	for (const r of stabRows) console.log(`  ${r.flipped ? "↯" : "="} ${r.id}: ${r.labels.join(" | ")} (mode ${r.mode_ratio * 100}%)`);
	console.log(`${invalid.length} invalid · ${canary.length} canary leak(s) · tokens in=${inputT}(cached ${cachedT}) out=${outputT} · mean ${(wallAvg / 1000).toFixed(1)}s/call`);
}

// ---------------------------------------------------------------- pack (for human judges)

function cmdPack(): void {
	const items: Item[] = read(ITEMS).trim().split("\n").map((l) => JSON.parse(l))               ;
	const instructions  = read(join(INSTR, "judgment-v1.md"))                                    ;
	const outDir        = join(EVAL, "judging", new Date().toISOString().slice(0, 10) + "-pack") ;
	mkdirSync(join(outDir, "sheets"), { recursive: true });
	// Blind: the expected column and model outputs are not put in the pack. The only basis for judging is guideline v1.
	for (const i of items) {
		const sheet = [
			`# ${i.id} (layer ${i.layer} · ${i.lang})`, ``,
			`Language: ${i.lang} · table kind candidate: ${i.kind} / axes: ${i.axes} · source: ${i.source}`, ``,
			`before:`, "```" + i.lang, i.before, "```", ``,
			i.after == null
				? `after: none — there is no alignment rule (proposal) yet.`
				: [`after (aligner proposal):`, "```" + i.lang, i.after, "```"].join("\n"),
			``, `---`, `Verdict: (one of correct / different-role / missing-kind / taste / unsure)`, `Reason (one sentence):`, ``,
		].join("\n");
		writeFileSync(join(outDir, "sheets", `${i.id}.md`), sheet);
	}
	writeFileSync(join(outDir, "answers-judge-name.csv"), "id,judgment,reason\n" + items.map((i) => `${i.id},`).join("\n") + "\n");
	writeFileSync(join(outDir, "README.md"), [
		`# Human judgment pack (${new Date().toISOString().slice(0, 10)})`, ``,
		`- For each item in sheets/, look at before/after and pick one of the five categories. Model outputs and expected answers are left out on purpose (blind).`,
		`- Each judge copies \`answers-<name>.csv\` and fills in a judgment and a one-sentence reason per id. Judges do not see each other's answers (independent judging).`,
		`- Labels before agreement and disputed items are kept as they are. Disagreements are reconciled separately after both judgments are finished.`,
		`- The only basis for judging is the guideline below:`, ``, instructions,
	].join("\n"));
	console.error(`pack: ${outDir} (${items.length} item(s))`);
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
	const script             = join(ROOT, "product/engine", lang === "py" ? "python" : "typescript", "01_group-regions.ts")                   ;
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
	spawnSync("bun", ["run", join(ROOT, "product/engine", lang, "06_align-tables.ts"), "--file", tmp, "--write"], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
	// 06 reports "alignment needed" with exit 1 too, so judge by the output, not the status code.
	return existsSync(tmp) ? read(tmp) : null;
}

function extractAfter(aligned: string, before: string, start: number): string | null {
	const rows = before.split("\n").length;
	// Alignment changes only whitespace (including moving before colons), so removing all whitespace leaves the first row's content intact.
	// In case vertical line breaks shortened the first row, prefix matching is doubled.
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
	console.error("Usage: bun run development/tools/eval.ts <build|run|grade|pack>");
	process.exit(1);
}
