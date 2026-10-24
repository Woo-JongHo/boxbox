import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { git } from "./lint-changed-git.ts";

export interface LintConfig {
	schemaVersion : 1                                   ;
	checker       : { version: string; commit: string } ;
	exclude       : string[]                            ;
}

export interface Invocation {
	status : number | null ;
	stdout : string        ;
	stderr : string        ;
	error? : string        ;
}

export interface Judgment {
	status      : "pass" | "violation" | "error"     ;
	noGroups    : boolean                            ;
	unsupported : { line: number; reason: string }[] ;
	detail?     : string                             ;
	result?     : Record<string, any>                ;
}

export const sha256 = (bytes: string | Buffer): string => createHash("sha256").update(bytes).digest("hex");

export function lintConfig(raw: string): LintConfig {
	const value = JSON.parse(raw);
	if (value?.schemaVersion !== 1 || !/^\d+\.\d+\.\d+$/.test(value.checker?.version ?? "") || !/^[a-f0-9]{40}$/.test(value.checker?.commit ?? "")) {
		throw new Error("Invalid lint configuration: expected schema 1, checker version and full commit SHA");
	}
	if (!Array.isArray(value.exclude) || value.exclude.some((path: unknown) => typeof path !== "string" || !path || path.startsWith("/") || path.split("/").includes(".."))) {
		throw new Error("Invalid lint exclusion paths");
	}
	return value;
}

/** Only platform/runtime discovery variables are inherited; no personal BoxBox or runtime injection settings. */
export function checkerEnvironment(directory: string): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = {};
	for (const key of ["PATH", "SystemRoot", "SYSTEMROOT", "WINDIR", "PATHEXT", "TMPDIR", "TMP", "TEMP"]) {
		if (process.env[key] !== undefined) env[key] = process.env[key];
	}
	return { ...env, XDG_CONFIG_HOME: join(directory, "config"), XDG_CACHE_HOME: join(directory, "cache"), BOXBOX_REQUIRE_PARSERS: "1" };
}

export function invoke(command: string, args: readonly string[], cwd: string, env: NodeJS.ProcessEnv, timeout = 60_000, input?: Buffer): Invocation {
	const result = spawnSync(command, [...args], { cwd, env, input, encoding: "utf8", timeout, maxBuffer: 32 * 1024 * 1024 });
	return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "", ...(result.error ? { error: result.error.message } : {}) };
}

function requireSuccess(result: Invocation, step: string): void {
	if (result.status !== 0 || result.error) throw new Error(`${step} failed: ${result.error ?? result.stderr ?? result.stdout}`);
}

/** Build afresh from the pinned Git tree, never from the working engine or a published npm package. */
export function prepareChecker(root: string, directory: string, config: LintConfig) {
	const commit = git(root, ["rev-parse", "--verify", `${config.checker.commit}^{commit}`]).toString().trim();
	if (commit !== config.checker.commit) throw new Error("Checker commit mismatch");
	const source = join              (directory, "checker") ;
	const env    = checkerEnvironment(directory           ) ;

	mkdirSync(source);
	const archive = git(root, ["archive", "--format=tar", commit]);

	requireSuccess(invoke("tar", ["-xf", "-", "-C", source], directory, env, 60_000, archive), "Checker extraction");
	const manifest = JSON.parse(readFileSync(join(source, "package.json"), "utf8"));
	if (manifest.version !== config.checker.version) throw new Error("Checker source version mismatch");
	requireSuccess(invoke(process.execPath, ["install", "--frozen-lockfile", "--ignore-scripts"], source, env, 180_000), "Checker dependency installation");
	requireSuccess(invoke(process.execPath, ["run", "development/tools/build-cli-artifact.ts"], source, env, 180_000), "Checker build");
	const entry   = join  (source, "dist/cli/dist/cli.js"           ) ;
	const version = invoke("node", [entry, "--version"], source, env) ;

	requireSuccess(version, "Checker version probe");
	if (version.stdout.trim() !== config.checker.version) throw new Error("Built checker version mismatch");
	return {
		entry,
		env,
		identity: { ...config.checker, tree: git(root, ["rev-parse", `${commit}^{tree}`]).toString().trim(), bundleSha256: sha256(readFileSync(entry)), bun: Bun.version },
	};
}

const object  = (value: any): value is Record<string, any> => value !== null && typeof value === "object" && !Array.isArray(value) ;
const count   = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0                             ;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === "string")       ;

/** Validate the pinned public check envelope and cross-check totals/exit status before accepting a pass. */
export function judge(result: Invocation, file: string, language: string): Judgment {
	const failure = (detail: string): Judgment => ({ status: "error", noGroups: false, unsupported: [], detail });
	if (result.error || result.status === null)                                                                                                                               return failure(result.error ?? "Checker terminated without an exit status");
	let body: any;
	try { body = JSON.parse(result.stdout); }
	catch { return failure("Checker returned invalid JSON"); }
	if (!object(body) || body.schemaVersion !== 1 || body.tool !== "boxbox")                                                                                                  return failure("Invalid checker envelope");
	if (body.ok === false)                                                                                                                                                    return failure(`Checker error: ${JSON.stringify(body.error)}`);
	if (!Array.isArray(body.results) || body.results.length !== 1 || !object(body.syntax))                                                                                    return failure("Missing check result or syntax validation");
	const checked = body.results[0] ;
	const syntax  = body.syntax     ;
	if (!object(checked) || checked.file !== file || checked.language !== language || checked.mode !== "check" || !Array.isArray(checked.groups) || !object(checked.summary)) return failure("Invalid file result identity or shape");
	if (!["valid", "invalid", "error"].includes(syntax.status) || typeof syntax.tool !== "string" || !strings(syntax.diagnostics))                                            return failure("Invalid syntax result");
	if (!object(checked.parse) || !["not-run", "ok", "skipped", "changed"].includes(checked.parse.status) || typeof checked.parse.tool !== "string")                          return failure("Invalid parser result");
	for (const group of checked.groups) {
		if (!object(group) || typeof group.kind !== "string" || !count(group.startLine) || group.startLine < 1 || !count(group.endLine) || group.endLine < group.startLine || !count(group.rows) || !strings(group.axes) || !["PASS", "FIXABLE", "SUGGEST", "REFUSE"].includes(group.state) || !count(group.edits)) return failure("Invalid alignment group");
	}
	const groups = checked.groups as Record<string, any>[];
	const totals = {
		groups     : groups.length                                                                                  ,
		misaligned : groups.filter(group => group.state === "FIXABLE").length                                       ,
		refused    : groups.filter(group => group.state === "REFUSE").length                                        ,
		suggested  : groups.filter(group => group.state === "SUGGEST").length                                       ,
		edits      : groups.filter(group => group.state === "FIXABLE").reduce((sum, group) => sum + group.edits, 0) ,
	};
	if (Object.entries(totals).some(([key, value]) => checked.summary[key] !== value))                                                                                        return failure("Checker summary disagrees with groups");
	const unsupported = checked.unsupported ?? [];
	if (!Array.isArray(unsupported) || unsupported.some(item => !object(item) || !count(item.line) || item.line < 1 || typeof item.reason !== "string"))                      return failure("Invalid unsupported ranges");
	const unsafe   = syntax.status !== "valid" || syntax.diagnostics.length > 0 || totals.refused > 0 || checked.parse.status === "skipped" || checked.parse.status === "changed" ;
	const expected = unsafe ? 2 : totals.misaligned > 0 ? 1 : 0                                                                                                                   ;
	if (result.status !== expected)                                                                                                                                           return failure(`Checker exit/result mismatch: exit=${result.status}, expected=${expected}`);
	return {
		status: unsafe ? "error" : totals.misaligned > 0 ? "violation" : "pass",
		noGroups: groups.length === 0,
		unsupported,
		...(unsafe ? { detail: `Syntax or safety refusal: ${JSON.stringify(syntax)}` } : {}),
		result: body,
	};
}
