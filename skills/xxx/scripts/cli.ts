import { lifecycleHook, installHooks } from "./common/lifecycle-hook.ts";
import      { createHash                                               } from "node:crypto"                 ;
import      { spawnSync                                                } from "node:child_process"          ;
import      { existsSync, lstatSync, realpathSync                      } from "node:fs"                     ;
import      { fileURLToPath                                            } from "node:url"                    ;
import      { dirname, extname, isAbsolute, join, relative, resolve    } from "node:path"                   ;

import      { documentResolver, evaluateDetected, loadApprovalRegistry } from "./common/approval-gate.ts"   ;
import type { ApprovalRegistry, DocumentResolver, RegistrySource       } from "./common/approval-gate.ts"   ;
import      { runAlignCli                                              } from "./common/align-cli.ts"       ;
import      { runFormatPipeline                                        } from "./common/format-pipeline.ts" ;
import      {
              initializeProjectConfig                                ,
              initializeUserDatabase                                 ,
              resolveConfig                                          ,
              userDatabaseStatus                                     ,
                                                                       } from "./common/project-config.ts"  ;
import type { PublicLanguage                                           } from "./common/project-config.ts"  ;
import type { FileResult, ResultEnvelope                               } from "./common/result-json.ts"     ;
import      { PYTHON_ALIGNER                                           } from "./python/profile.ts"         ;
import      { runTypeScriptAlign                                       } from "./typescript/align.ts"       ;

import      { guardedRun, guardStatus                                  } from "./common/guarded-run.ts"     ;

export const CLI_VERSION = "0.2.0";

const HELP = `Usage: xxx <command> [options]

Commands:
  check   --file <path> [--language typescript|python] [--json]
  format  --file <path> [--language typescript|python] [--dry-run] [--json]
  guide   --file <path> [--language typescript|python] [--json]
  init    [--json]
  doctor  [--json]
  run --root <path> [--json] -- <command> [args...]
  status --root <path> [--json]
  hook session|post|stop --root <path>
  hooks install codex|claude --root <path>
  db init [--json]
  db status [--json]

Options:
  --help       Show this help
  --version    Show the development metadata version

The first public stage accepts exactly one TypeScript or Python file. format writes only when
an explicit formatter and complete human-approval proof pass the fixed-point safety pipeline.`;

interface ParsedFileCommand {
	readonly file     : string         ;
	readonly language : PublicLanguage ;
	readonly json     : boolean        ;
	readonly dryRun   : boolean        ;
}

interface CliErrorEnvelope {
	readonly schemaVersion : 1                                                   ;
	readonly tool          : "xxx"                                               ;
	readonly command       : string                                              ;
	readonly ok            : false                                               ;
	readonly error         : { readonly code: string; readonly message: string } ;
}

class CliError extends Error {
	constructor(readonly code: string, message: string) { super(message); }
}

const messageOf = (value: unknown): string => value instanceof Error ? value.message : String(value);

function emitJson(value: unknown): void {
	console.log(JSON.stringify(value));
}

function fail(command: string, json: boolean, error: unknown): number {
	const known = error instanceof CliError ? error : new CliError("INTERNAL_ERROR", messageOf(error));
	if (json) {
		const envelope: CliErrorEnvelope = { schemaVersion: 1, tool: "xxx", command, ok: false, error: { code: known.code, message: known.message } };
		emitJson(envelope);
	} else console.error(`xxx ${command}: ${known.message}`);
	return 2;
}

function assertRoot(root: string): string {
	const absolute = resolve(root);
	if (!existsSync(absolute)) throw new CliError("PROJECT_NOT_FOUND", `project root does not exist: ${absolute}`);
	const status = lstatSync(absolute);
	if (!status.isDirectory() || status.isSymbolicLink()) throw new CliError("UNSAFE_PROJECT_PATH", `project root must be a real directory, not a symlink: ${absolute}`);
	return absolute;
}

function insideRoot(root: string, file: string): string {
	const absolute = resolve(root, file)      ;
	const path     = relative(root, absolute) ;
	if (path === "" || path === ".." || path.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(path)) {
		throw new CliError("PATH_ESCAPE", `file must stay inside the project root: ${file}`);
	}
	if (!existsSync(absolute)) throw new CliError("FILE_NOT_FOUND", `file does not exist: ${file}`);
	const status = lstatSync(absolute);
	if (!status.isFile() || status.isSymbolicLink()) throw new CliError("UNSAFE_FILE_PATH", `file must be a regular file, not a symlink: ${file}`);
	const realRoot = realpathSync(root)           ;
	const realFile = realpathSync(absolute)       ;
	const realPath = relative(realRoot, realFile) ;
	if (realPath === ".." || realPath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(realPath)) {
		throw new CliError("PATH_ESCAPE", `file resolves outside the project root: ${file}`);
	}
	return absolute;
}

function inferredLanguage(file: string): PublicLanguage | undefined {
	const extension = extname(file).toLowerCase();
	if (extension === ".ts" || extension === ".tsx" || extension === ".mts" || extension === ".cts") return "typescript";
	if (extension === ".py") return "python";
	return undefined;
}

function parseFileCommand(args: readonly string[], allowDryRun: boolean, root: string): ParsedFileCommand {
	let file     : string | undefined         ;
	let language : PublicLanguage | undefined ;
	let json   = false                        ;
	let dryRun = false                        ;
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index]!;
		if (argument === "--json") { json = true; continue; }
		if (argument === "--dry-run" && allowDryRun) { dryRun = true; continue; }
		if (argument === "--file" || argument === "--language") {
			const value = args[index + 1];
			if (!value || value.startsWith("--")) throw new CliError("MISSING_VALUE", `${argument} requires a value`);
			index += 1;
			if (argument === "--file") {
				if (file !== undefined) throw new CliError("DUPLICATE_OPTION", "--file may be provided only once");
				file = value;
			} else {
				if (language !== undefined) throw new CliError("DUPLICATE_OPTION", "--language may be provided only once");
				if (value !== "typescript" && value !== "python") throw new CliError("UNSUPPORTED_LANGUAGE", `unsupported language: ${value}`);
				language = value;
			}
			continue;
		}
		throw new CliError("UNKNOWN_OPTION", `unknown option: ${argument}`);
	}
	if (!file) throw new CliError("MISSING_FILE", "one --file <path> is required");
	const absolute = insideRoot(root, file)     ;
	const inferred = inferredLanguage(absolute) ;
	if (!inferred) throw new CliError("UNSUPPORTED_LANGUAGE", `cannot infer a supported language from: ${file}`);
	if (language && language !== inferred) throw new CliError("LANGUAGE_MISMATCH", `--language ${language} does not match ${file}`);
	return { file: relative(root, absolute), language: language ?? inferred, json, dryRun };
}

function jsonRequested(args: readonly string[]): boolean {
	return args.includes("--json");
}

function assertSimpleFlags(args: readonly string[], allowed: readonly string[]): void {
	for (const argument of args) if (!allowed.includes(argument)) throw new CliError("UNKNOWN_OPTION", `unknown option: ${argument}`);
}

interface ApprovalContext {
	readonly registry        : ApprovalRegistry ;
	readonly resolveDocument : DocumentResolver ;
	readonly fingerprint     : string           ;
}

function approvalContext(root: string): ApprovalContext {
	const config     = resolveConfig(root)                                                ;
	const userConfig = config.sources.find(source => source.layer === "user")?.path       ;
	const userRoot   = userConfig ? dirname(userConfig) : undefined                       ;
	const projectDb  = join(root, ".xxx")                                                 ;
	const presetRoot = fileURLToPath(new URL("../presets/recommended/", import.meta.url)) ;
	const sources: RegistrySource[] = [
		...(existsSync(projectDb) ? [{ root: projectDb, layer: "project" as const }] : []),
		...(userRoot && existsSync(userRoot) ? [{ root: userRoot, layer: "user" as const }] : []),
		{ root: presetRoot, layer: "preset" as const },
	];
	const roots           = { project: root, ...(userRoot && existsSync(userRoot) ? { user: userRoot } : {}), preset: presetRoot } ;
	const registry        = loadApprovalRegistry(sources)                                                                          ;
	const resolveDocument = documentResolver(roots)                                                                                ;
	const documents = [...registry.decisions.values()].map(decision => {
		const convention = registry.conventions.find(record => record.id === decision.id);
		try {
			const resolved = resolveDocument(decision.ref, convention?.layer);
			return [decision.id, decision.ref, resolved.heading, resolved.document];
		} catch (error) {
			return [decision.id, decision.ref, "invalid", messageOf(error)];
		}
	});
	const evidence = JSON.stringify({
		config      : config.fingerprint,
		conventions : registry.conventions,
		examples    : [...registry.examples.entries()],
		decisions   : [...registry.decisions.entries()],
		documents,
	});
	return { registry, resolveDocument, fingerprint: `sha256:${createHash("sha256").update(evidence).digest("hex")}` };
}

async function inspectFile(parsed: ParsedFileCommand, root: string): Promise<FileResult> {
	if (parsed.language === "python") {
		const previous = process.cwd();
		try {
			process.chdir(root);
			const report = runAlignCli(PYTHON_ALIGNER, ["--file", parsed.file, "--json"]).report;
			return (JSON.parse(report) as ResultEnvelope).results[0]!;
		} finally { process.chdir(previous); }
	}
	let report = "";
	await runTypeScriptAlign(["--file", parsed.file, "--json"], { root, emit: value => { report = value; } });
	return (JSON.parse(report) as ResultEnvelope).results[0]!;
}

function doctorReport(root: string) {
	const nodeParts   = process.versions.node.split(".").map(Number)                                                                                                                                                                                              ;
	const node        = { ok: (nodeParts[0] ?? 0) > 22 || ((nodeParts[0] ?? 0) === 22 && ((nodeParts[1] ?? 0) > 22 || ((nodeParts[1] ?? 0) === 22 && (nodeParts[2] ?? 0) >= 3))), detail: `Node ${process.versions.node} (artifact candidate minimum: 22.22.3)` } ;
	const pythonProbe = spawnSync("python3", ["--version"], { encoding: "utf8", timeout: 5_000, maxBuffer: 64 * 1024 })                                                                                                                                           ;
	const python      = { ok: pythonProbe.status === 0, detail: pythonProbe.status === 0 ? (pythonProbe.stdout || pythonProbe.stderr).trim() : "python3 is unavailable or failed to start" }                                                                      ;
	let config: { ok: boolean; detail: string; fingerprint?: string; layers?: readonly unknown[]; formatters?: readonly string[] }                                                                                                                                ;
	try {
		const resolved   = resolveConfig(root)                                         ;
		const project    = resolved.sources.find(source => source.layer === "project") ;
		const formatters = Object.keys(resolved.effective.formatters)                  ;
		config = { ok: true, detail: `schema 2; languages=${resolved.effective.languages.join(",")}; project=${project?.present ? "present" : "absent, inherited defaults"}`, fingerprint: resolved.fingerprint, layers: resolved.sources, formatters };
	} catch (error) {
		config = { ok: false, detail: messageOf(error) };
	}
	let approval: { ok: boolean; detail: string };
	try {
		const context  = approvalContext(root)                                                              ;
		const approved = context.registry.conventions.filter(record => record.status === "approved").length ;
		approval = approved > 0
			? { ok: true, detail: `${approved} approved convention record(s) loaded; proof remains file-specific` }
			: { ok: false, detail: "approved convention registry is empty" };
	} catch (error) {
		approval = { ok: false, detail: messageOf(error) };
	}
	const configuredFormatters = config.formatters ?? [];
	const formatter = configuredFormatters.length > 0
		? { ok: true, detail: `configured for ${configuredFormatters.join(",")}` }
		: { ok: false, detail: "no project formatter is configured" };
	const limitations      = ["format readiness is finally decided per file by exact approval proof", "only one explicit TypeScript or Python file is accepted", "Linux and host acceptance are not yet verified"]       ;
	const runtimeUsable    = node.ok && python.ok && config.ok                                                                                                                                                           ;
	const formatConfigured = runtimeUsable && approval.ok && formatter.ok                                                                                                                                                ;
	const ok               = runtimeUsable                                                                                                                                                                               ;
	const result           = { schemaVersion: 1, tool: "xxx", command: "doctor", ok, runtimeUsable, formatConfigured, releaseReady: false, checks: { runtime: node, python, config, approval, formatter }, limitations } ;
	return result;
}

function doctor(root: string, json: boolean): number {
	const result = doctorReport(root);
	if (json) emitJson(result);
	else {
		for (const [name, check] of Object.entries(result.checks)) console.log(`${check.ok ? "ok" : "not-ready"} ${name}: ${check.detail}`);
		for (const limitation of result.limitations) console.log(`limitation: ${limitation}`);
	}
	return result.ok ? 0 : 1;
}

function database(args: readonly string[], json: boolean): number {
	const action = args[0]       ;
	const tail   = args.slice(1) ;
	if (action === "init") {
		assertSimpleFlags(tail, ["--json"]);
		const result = initializeUserDatabase();
		const output = {
			schemaVersion : 1,
			tool          : "xxx",
			command       : "db init",
			ok            : true,
			root          : result.root,
			createdRoot   : result.createdRoot,
			files         : result.files,
		};
		if (json) emitJson(output);
		else {
			console.log(`${result.createdRoot ? "created" : "kept"} user database directory ${result.root}`);
			for (const file of result.files) console.log(`${file.created ? "created" : "kept"} ${file.path}`);
		}
		return 0;
	}
	if (action === "status") {
		assertSimpleFlags(tail, ["--json"]);
		const result = { schemaVersion: 1, tool: "xxx", command: "db status", ok: true, ...userDatabaseStatus() };
		if (json) emitJson(result);
		else {
			console.log(`user database ${result.exists ? "present" : "absent"}: ${result.root}`);
			console.log(`total: rows=${result.files.reduce((count, file) => count + file.rows, 0)}; bytes=${result.bytes}`);
			for (const file of result.files) console.log(`${file.name}: ${file.exists ? "present" : "absent"}; rows=${file.rows}; bytes=${file.bytes}; ${file.path}`);
		}
		return 0;
	}
	if (action === undefined) throw new CliError("MISSING_DB_COMMAND", "db requires init or status");
	throw new CliError("UNKNOWN_DB_COMMAND", `unknown db command: ${action}`);
}

async function check(parsed: ParsedFileCommand, root: string): Promise<number> {
	const config = resolveConfig(root).effective;
	if (!config.languages.includes(parsed.language)) throw new CliError("LANGUAGE_DISABLED", `${parsed.language} is not enabled by the effective configuration`);
	const previous = process.cwd();
	try {
		process.chdir(root);
		if (parsed.language === "python") {
			const result = runAlignCli(PYTHON_ALIGNER, ["--file", parsed.file, ...(parsed.json ? ["--json"] : [])]);
			console.log(result.report);
			return result.code;
		}
		return await runTypeScriptAlign(["--file", parsed.file, ...(parsed.json ? ["--json"] : [])]);
	} finally {
		process.chdir(previous);
	}
}

async function guide(parsed: ParsedFileCommand, root: string): Promise<number> {
	const config = resolveConfig(root).effective;
	if (!config.languages.includes(parsed.language)) throw new CliError("LANGUAGE_DISABLED", `${parsed.language} is not enabled by the effective configuration`);
	const inspected = await inspectFile(parsed, root) ;
	const context   = approvalContext(root)           ;
	const evaluated = evaluateDetected(context.registry, inspected.groups
		.filter(group => group.state === "PASS" || group.state === "FIXABLE")
		.map(group => ({ language: inspected.language, context: group.context, kind: group.kind, axes: group.axes, file: parsed.file })), context.resolveDocument);
	const approved    = evaluated.filter(item => item.result.status === "approved" && item.result.writable)                                                           ;
	const guides      = [...new Map(approved.flatMap(item => item.result.guide).map(example => [example.id, example])).values()]                                      ;
	const conventions = [...new Set(approved.flatMap(item => item.result.conventionId ? [item.result.conventionId] : []))].sort()                                     ;
	const output      = { schemaVersion: 1, tool: "xxx", command: "guide", ok: guides.length > 0, file: parsed.file, language: parsed.language, conventions, guides } ;
	if (parsed.json) emitJson(output);
	else if (guides.length === 0) console.log(`guide file=${parsed.file}: no verified approved guidance applies`);
	else {
		console.log(`guide file=${parsed.file} conventions=${conventions.join(",")}`);
		for (const example of guides) console.log(`[${example.id}]\n${example.after}`);
	}
	return guides.length > 0 ? 0 : 1;
}

async function format(parsed: ParsedFileCommand, root: string): Promise<number> {
	const resolved = resolveConfig(root);
	if (!resolved.effective.languages.includes(parsed.language)) throw new CliError("LANGUAGE_DISABLED", `${parsed.language} is not enabled by the effective configuration`);
	const formatter = resolved.effective.formatters[parsed.language];
	if (!formatter) throw new CliError("FORMAT_NOT_ELIGIBLE", `format refused: no explicit formatter is configured for ${parsed.language}`);
	const context = approvalContext(root);
	if (context.registry.conventions.length === 0) throw new CliError("FORMAT_NOT_ELIGIBLE", "format refused: approval registry is empty");
	try {
		const result = await runFormatPipeline({
			root,
			file            : parsed.file,
			language        : parsed.language,
			formatter,
			registry        : context.registry,
			resolveDocument : context.resolveDocument,
			dryRun          : parsed.dryRun,
			provenance      : () => approvalContext(root).fingerprint,
		});
		const output = { schemaVersion: 1, tool: "xxx", command: "format", ok: true, dryRun: parsed.dryRun, formatterExecuted: true, formatEligible: true, ...result };
		if (parsed.json) emitJson(output);
		else console.log(`format file=${result.file} dry-run=${parsed.dryRun} written=${result.written} formatter-changed=${result.formatterChanged} xxx-changed=${result.xxxChanged} fixed-point=${result.fixedPoint} approvals=${result.approvals.join(",")}`);
		return 0;
	} catch (error) {
		throw new CliError("FORMAT_NOT_ELIGIBLE", `format refused: ${messageOf(error)}`);
	}
}

export async function runCli(args: readonly string[], root = process.cwd()): Promise<number> {
	const command = args[0] ?? "help"   ;
	const tail    = args.slice(1)       ;
	const json    = jsonRequested(tail) ;
	try {
		if (command === "help" || command === "--help" || command === "-h") {
			assertSimpleFlags(tail, []);
			console.log(HELP);
			return 0;
		}
		if (command === "--version" || command === "-V" || command === "version") {
			assertSimpleFlags(tail, []);
			console.log(CLI_VERSION);
			return 0;
		}
		if (command === "run") return await guardedRun(tail, doctorReport, async (project, file) => {
			const parsed = parseFileCommand(["--file", file], false, project);
			if (!resolveConfig(project).effective.languages.includes(parsed.language)) throw new Error("LANGUAGE_DISABLED");
			return inspectFile(parsed, project);
		}, CLI_VERSION);
		if (command === "hook") return await lifecycleHook(tail, async (project, file) => inspectFile(parseFileCommand(["--file", file], false, project), project));
		if (command === "hooks") return installHooks(tail);
		if (command === "status") return guardStatus(tail);
		if (command === "db") return database(tail, json);
		if (command === "init") {
			const project  = assertRoot(root)                                                                                                                                                                                          ;
			assertSimpleFlags(tail, ["--json"]);
			const result   = initializeProjectConfig(project)                                                                                                                                                                          ;
			const resolved = resolveConfig(project)                                                                                                                                                                                    ;
			const output   = { schemaVersion: 1, tool: "xxx", command: "init", ok: true, created: result.created, config: relative(project, result.path), languages: resolved.effective.languages, fingerprint: resolved.fingerprint } ;
			if (json) emitJson(output);
			else console.log(result.created ? `created ${output.config}` : `kept existing ${output.config}`);
			return 0;
		}
		if (command === "doctor") {
			const project = assertRoot(root);
			assertSimpleFlags(tail, ["--json"]);
			return doctor(project, json);
		}
		const project = assertRoot(root);
		if (command === "check") return await check(parseFileCommand(tail, false, project), project);
		if (command === "guide") return await guide(parseFileCommand(tail, false, project), project);
		if (command === "format") return await format(parseFileCommand(tail, true, project), project);
		throw new CliError("UNKNOWN_COMMAND", `unknown command: ${command}`);
	} catch (error) {
		return fail(command, json, error);
	}
}
