import { lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { checkerEnvironment, invoke, judge, lintConfig, prepareChecker, sha256 } from "./lint-changed-checker.ts";
import type { Invocation, Judgment, LintConfig } from "./lint-changed-checker.ts";
import { git, selectChanges } from "./lint-changed-git.ts";
import type { Change, Selection } from "./lint-changed-git.ts";

export function languageOf(file: string): string | undefined {
	const extension = extname(file).toLowerCase();
	if ([".ts", ".tsx", ".mts", ".cts"].includes(extension)) return "typescript";
	if (extension === ".py")                                 return "python";
	if (extension === ".json")                               return "json";
	if ([".yml", ".yaml"].includes(extension))               return "yaml";
	return undefined;
}

/** Every component is checked; even an in-tree symlink is not a safe input. */
export function safeFile(root: string, path: string): Buffer {
	const absolute = resolve (root, path    ) ;
	const within   = relative(root, absolute) ;
	if (!within || within === ".." || within.startsWith(`..${sep}`) || isAbsolute(within)) throw new Error(`Unsafe input path: ${JSON.stringify(path)}`);
	let current = root              ;
	const parts = within.split(sep) ;
	for (const [index, part] of parts.entries()) {
		current = join(current, part);
		const stat = lstatSync(current);
		if (stat.isSymbolicLink() || (index === parts.length - 1 ? !stat.isFile() : !stat.isDirectory())) throw new Error(`Unsafe input component: ${JSON.stringify(path)}`);
	}
	return readFileSync(absolute);
}

function cacheDirectory(root: string): string {
	let directory = root;
	for (const part of [".boxbox", "cache", "lint-changed"]) {
		directory = join(directory, part);
		if (!lstatSync(directory, { throwIfNoEntry: false })) mkdirSync(directory);
		const stat = lstatSync(directory);
		if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Unsafe cache directory: ${directory}`);
	}
	return directory;
}

export function sourceBytes(root: string, selection: Selection, change: Change): Buffer {
	if (selection.mode === "local") return safeFile(root, change.path);
	const entry = git(root, ["ls-tree", "-z", selection.target, "--", `:(literal)${change.path}`]).toString();
	if (!/^100(?:644|755) blob [a-f0-9]{40}\t/.test(entry) || entry.split("\0").filter(Boolean).length !== 1) throw new Error(`Target is not a regular Git blob: ${JSON.stringify(change.path)}`);
	return git(root, ["show", `${selection.target}:${change.path}`]);
}

export function comparison(args: readonly string[], config: LintConfig, env: NodeJS.ProcessEnv = process.env): { base?: string; target?: string } {
	if (args.length === 1 && args[0] === "--ci") {
		if (!env.GITHUB_SHA || !env.GITHUB_EVENT_PATH) throw new Error("CI commit/event metadata is missing");
		const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
		if (env.GITHUB_EVENT_NAME === "pull_request") {
			if (!event.pull_request?.base?.sha || !env.GITHUB_REF?.startsWith("refs/pull/") || !env.GITHUB_REF.endsWith("/merge")) throw new Error("PR verification requires the base SHA and merge ref");
			return { base: event.pull_request.base.sha, target: env.GITHUB_SHA };
		}
		if (env.GITHUB_EVENT_NAME === "push" && event.ref === "refs/heads/main") {
			if (!event.before || !event.after || /^0+$/.test(event.before) || event.after !== env.GITHUB_SHA) throw new Error("Push comparison commits are missing or inconsistent");
			return { base: event.before, target: event.after };
		}
		if (!["workflow_dispatch", "workflow_call", "push"].includes(env.GITHUB_EVENT_NAME ?? "")) throw new Error("Unsupported CI comparison event");
		return { base: config.checker.commit, target: env.GITHUB_SHA };
	}
	const options: { base?: string; target?: string } = {};
	for (let index = 0; index < args.length; index += 2) {
		const key   = args[index    ] ;
		const value = args[index + 1] ;
		if ((key !== "--base" && key !== "--target") || !value || value.startsWith("--")) throw new Error("Usage: lint:changed [--base <commit>] [--target <commit>] | --ci");
		const field = key === "--base" ? "base" : "target";
		if (options[field]) throw new Error(`Duplicate option: ${key}`);
		options[field] = value;
	}
	if (options.target && !options.base) throw new Error("--target requires --base");
	return options;
}

export interface FileReport extends Change {
	status        : string     ;
	change        : string     ;
	beforeSha256? : string     ;
	afterSha256?  : string     ;
	inspection?   : Judgment   ;
	process?      : Invocation ;
	detail?       : string     ;
}

export interface LintReport {
	schemaVersion : 1                                                                                             ;
	status        : "pass" | "violation" | "error"                                                                ;
	checker?      : Record<string, unknown>                                                                       ;
	configSha256? : string                                                                                        ;
	selection?    : Selection                                                                                     ;
	files         : FileReport[]                                                                                  ;
	errors        : string[]                                                                                      ;
	counts        : { targets: number; excluded: number; deleted: number; noGroups: number; unsupported: number } ;
}

function escaped(text: string): string {
	return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("`", "&#96;").replaceAll("|", "&#124;").replaceAll("\n", "&#10;").replaceAll("\r", "&#13;");
}

function publish(report: LintReport, cache: string, run: string, ci: boolean): void {
	const json = `${JSON.stringify(report, null, 2)}\n`;
	writeFileSync(join(run, "latest.json"), json);
	renameSync(join(run, "latest.json"), join(cache, "report.json"));
	console.log(`lint:changed ${report.status}: targets=${report.counts.targets} excluded=${report.counts.excluded} deleted=${report.counts.deleted} no-groups=${report.counts.noGroups} unsupported=${report.counts.unsupported}`);
	for (const file of report.files) {
		console.log(`${file.status}: ${JSON.stringify(file.path)}${file.detail ? ` ${JSON.stringify(file.detail)}` : ""}`);
		for (const warning of file.inspection?.unsupported ?? []) {
			const message = `${file.path}:${warning.line}: ${warning.reason}`;
			console.log(process.env.GITHUB_ACTIONS === "true" ? `::warning::${message.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A")}` : `warning: ${JSON.stringify(message)}`);
		}
	}
	for (const error of report.errors) console.error(JSON.stringify(error));
	console.log(`Report: ${join(cache, "report.json")}`);
	if (ci && process.env.GITHUB_STEP_SUMMARY) {
		const lines = [
			`### BoxBox changed-file check: ${report.status}`,
			`Checker: <code>${escaped(JSON.stringify(report.checker ?? {}))}</code>`,
			`Comparison: <code>${escaped(report.selection?.base ?? "unresolved")}</code> → <code>${escaped(report.selection?.target ?? "unresolved")}</code>`,
			`Targets: ${report.counts.targets}; excluded: ${report.counts.excluded}; deleted: ${report.counts.deleted}; no recognized groups: ${report.counts.noGroups}; unsupported ranges: ${report.counts.unsupported}.`,
			"A pass covers detected groups only. See the JSON artifact for hashes, full results and unsupported ranges.",
			...report.files.map(file => `- **${file.status}** <code>${escaped(file.path)}</code>${file.detail ? `: ${escaped(file.detail)}` : ""}`),
			...report.errors.map(error => `- Error: ${escaped(error)}`),
		];
		appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n\n")}\n`);
	}
}

export function runChanged(root: string, args: readonly string[]): LintReport {
	root = realpathSync(root);
	const cache              = cacheDirectory(root)                                                                                                                       ;
	const run                = mkdtempSync(join(cache, "run-"))                                                                                                           ;
	const report: LintReport = { schemaVersion: 1, status: "error", files: [], errors: [], counts: { targets: 0, excluded: 0, deleted: 0, noGroups: 0, unsupported: 0 } } ;
	try {
		const raw    = safeFile(root, ".github/boxbox-lint.json").toString("utf8") ;
		const config = lintConfig(raw)                                             ;
		report.checker = config.checker;
		report.configSha256 = sha256(raw);
		const selection = selectChanges(root, comparison(args, config));
		report.selection = selection;
		if (args.includes("--ci") && git(root, ["rev-parse", "HEAD"]).toString().trim() !== selection.target) throw new Error("CI checkout does not match its target commit");
		const targets: Change[] = [];
		for (const change of selection.changes) {
			const excluded = config.exclude.find(pattern => new Bun.Glob(pattern).match(change.path))                                                    ;
			const status   = change.status === "D" ? "deleted" : excluded ? "excluded" : !languageOf(change.path) ? "not-supported-language" : "pending" ;
			report.files.push({ ...change, change: change.status, status, ...(excluded ? { detail: excluded } : {}) });
			if (status === "pending") targets.push(change);
			if (status === "deleted") report.counts.deleted += 1;
			if (status === "excluded") report.counts.excluded += 1;
		}
		report.counts.targets = targets.length;
		// Preparation failure remains an error even when this comparison has no supported targets.
		const checker = prepareChecker(root, run, config);
		report.checker = checker.identity;
		for (const [index, change] of targets.entries()) {
			const record = report.files.find(file => file.path === change.path)!;
			try {
				const bytes = sourceBytes(root, selection, change);
				record.beforeSha256 = sha256(bytes);
				const inputRoot = join(run, `input-${index}`)    ;
				const file      = `input${extname(change.path)}` ;
				mkdirSync(inputRoot);
				writeFileSync(join(inputRoot, file), bytes, { flag: "wx" });
				const result = invoke("node", [checker.entry, "check", "--file", file, "--json"], inputRoot, checkerEnvironment(run));
				record.process     = result                                        ;
				record.inspection  = judge(result, file, languageOf(change.path)!) ;
				record.status      = record.inspection.status                      ;
				record.detail      = record.inspection.detail                      ;
				record.afterSha256 = sha256(sourceBytes(root, selection, change))  ;
				if (record.beforeSha256 !== record.afterSha256 || record.beforeSha256 !== sha256(safeFile(inputRoot, file))) throw new Error("Input bytes changed during inspection");
				if (record.inspection.noGroups) report.counts.noGroups += 1;
				report.counts.unsupported += record.inspection.unsupported.length;
			} catch (error) {
				record.status = "error";
				record.detail = error instanceof Error ? error.message : String(error);
			}
		}
		// Recheck earlier inputs as well, so edits made during later checks cannot acquire a stale pass.
		for (const change of targets) {
			const record = report.files.find(file => file.path === change.path)!;
			if (!record.beforeSha256) continue;
			try {
				record.afterSha256 = sha256(sourceBytes(root, selection, change));
				if (record.afterSha256 !== record.beforeSha256) throw new Error("Source changed during the lint run");
			} catch (error) { record.status = "error"; record.detail = String(error); }
		}
		if (selection.mode === "local") {
			const final = selectChanges(root, { base: selection.base });
			if (final.target !== selection.target || final.localChangesId !== selection.localChangesId) throw new Error("Local changes changed during inspection; rerun against a stable worktree");
		}
		report.status = report.files.some(file => file.status === "error") ? "error" : report.files.some(file => file.status === "violation") ? "violation" : "pass";
	} catch (error) {
		report.errors.push(error instanceof Error ? error.message : String(error));
		for (const file of report.files) if (file.status === "pending") file.status = "not-checked";
	} finally {
		publish(report, cache, run, args.includes("--ci"));
		// The latest report persists; disposable source builds and input copies do not accumulate.
		rmSync(run, { recursive: true, force: true });
	}
	return report;
}

if (import.meta.main) {
	try {
		const root   = git(process.cwd(), ["rev-parse", "--show-toplevel"]).toString().trim()        ;
		const report = runChanged(root, process.argv.slice(2).filter(argument => argument !== "--")) ;
		process.exitCode = report.status === "pass" ? 0 : report.status === "violation" ? 1 : 2;
	} catch (error) {
		console.error(`lint:changed error: ${String(error)}`);
		process.exitCode = 2;
	}
}
