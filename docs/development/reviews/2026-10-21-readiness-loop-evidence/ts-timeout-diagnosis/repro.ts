import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(process.argv[2] ?? process.cwd());
const script = join(root, "product/engine/typescript/06_align-tables.ts");
const runs = Number(process.env.REPRO_RUNS ?? "40");
const parallel = Number(process.env.REPRO_PARALLEL ?? "4");
const deadline = Number(process.env.REPRO_DEADLINE_MS ?? "5000");
const input = "const rows = Array /* keep */ .from(items);\nconst over = rows. /* keep */ filter(isVisible);\n";
let next = 0;
let timedOut = 0;
let failed = 0;
const durations: number[] = [];

async function one(index: number): Promise<void> {
	const workspace = mkdtempSync(join(tmpdir(), "boxbox-ts-timeout-repro-"));
	writeFileSync(join(workspace, "sample.ts"), input);
	const started = performance.now();
	const child = Bun.spawn(["bun", script, "--file", "sample.ts", "--write", "--json"], {
		cwd: workspace,
		stdout: "pipe",
		stderr: "pipe",
	});
	let timer: ReturnType<typeof setTimeout> | undefined;
	const result = await Promise.race([
		child.exited.then(code => ({ kind: "exit" as const, code })),
		new Promise<{ kind: "timeout" }>(resolveTimeout => {
			timer = setTimeout(() => resolveTimeout({ kind: "timeout" }), deadline);
		}),
	]);
	if (timer) clearTimeout(timer);
	const elapsed = performance.now() - started;
	durations.push(elapsed);
	if (result.kind === "timeout") {
		timedOut += 1;
		child.kill("SIGKILL");
		await child.exited;
		console.error(JSON.stringify({ index, outcome: "timeout", elapsedMs: Math.round(elapsed), pid: child.pid }));
	} else if (result.code !== 0) {
		failed += 1;
		console.error(JSON.stringify({ index, outcome: "failed", code: result.code, elapsedMs: Math.round(elapsed), stderr: await new Response(child.stderr).text() }));
	}
	rmSync(workspace, { recursive: true, force: true });
}

async function worker(): Promise<void> {
	while (next < runs) {
		const index = next++;
		await one(index);
	}
}

await Promise.all(Array.from({ length: parallel }, () => worker()));
durations.sort((a, b) => a - b);
const percentile = (fraction: number) => Math.round(durations[Math.min(durations.length - 1, Math.floor(durations.length * fraction))] ?? 0);
const summary = { runs, parallel, deadlineMs: deadline, timedOut, failed, minMs: Math.round(durations[0] ?? 0), p50Ms: percentile(0.5), p95Ms: percentile(0.95), maxMs: Math.round(durations.at(-1) ?? 0) };
console.log(JSON.stringify(summary));
process.exitCode = timedOut > 0 || failed > 0 ? 1 : 0;
