import      { ruleData                                                   } from "@/05_rule-data.ts"                  ;
import      { lifecycleHook, installHooks                                } from "@/common/27_lifecycle-hook.ts"      ;
import      { createHash                                                 } from "node:crypto"                        ;
import      { spawnSync                                                  } from "node:child_process"                 ;
import      { existsSync, lstatSync, readFileSync, realpathSync          } from "node:fs"                            ;
import      { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path"                          ;

import      { documentResolver, evaluateDetected, loadApprovalRegistry   } from "@/common/18_approval-gate.ts"       ;
import type { ApprovalRegistry, DocumentResolver, RegistrySource         } from "@/common/18_approval-gate.ts"       ;
import      { runAlignCli                                                } from "@/common/22_align-cli.ts"           ;
import      {
              detectFormatters                                         ,
              formatterAffects                                         ,
              formatterConfigured                                      ,
              formatterWarning
                                                                         } from "@/common/33_formatter-detection.ts" ;
import      { resolveFormatterExecutable                                 } from "@/common/14_formatter-process.ts"   ;
import      { runFormatPipeline                                          } from "@/common/21_format-pipeline.ts"     ;
import type { FormatPipelineResult                                       } from "@/common/21_format-pipeline.ts"     ;
import      { runProjectCommand, selectProjectTargets                    } from "@/common/34_project-commands.ts"    ;
import type { ProjectExitCode, ProjectPipelineContext                    } from "@/common/34_project-commands.ts"    ;
import      { buildMonitorReport, writeMonitorReport                     } from "@/common/31_monitor.ts"             ;
import      { runMode                                                    } from "@/common/35_mode.ts"                ;
import      { runStatusline                                              } from "@/common/36_statusline.ts"          ;
import      { runUpdate                                                  } from "@/common/37_update.ts"              ;
import      { authoringGuide, columnSetGuide, pythonColumnSetGuide       } from "@/common/20_authoring-guide.ts"     ;
import      { axisExpectation, baseAxis                                  } from "@/common/05_axis-expectations.ts"   ;
import      { validateSyntax                                             } from "@/common/11_syntax-validation.ts"   ;
import type { SyntaxValidation                                           } from "@/common/11_syntax-validation.ts"   ;
import      {
              initializeProjectConfig                                  ,
              initializeUserDatabase                                   ,
              resolveConfig                                            ,
              userDatabaseStatus                                       ,
                                                                         } from "@/common/15_project-config.ts"      ;
import type { PublicLanguage                                             } from "@/common/15_project-config.ts"      ;
import type { FileResult, ResultEnvelope                                 } from "@/common/24_result-json.ts"         ;
import      { PYTHON_ALIGNER                                             } from "@/python/03_profile.ts"             ;
import      { PYTHON_AXIS_NOTES                                          } from "@/python/08_kind-vocabulary.ts"     ;
import      { normalizeAxis                                              } from "@/common/02_signature.ts"           ;
import      { analyzeStructured                                          } from "@/structured/00_index.ts"           ;
import      { runTypeScriptAlign                                         } from "@/typescript/12_align.ts"           ;
import      { AXIS_NOTES, KIND_AXES                                      } from "@/typescript/13_grid-kinds.ts"      ;

import      { guardedRun, guardStatus                                    } from "@/common/25_guarded-run.ts"         ;

export const CLI_VERSION = "0.2.8";

const HELP = `Usage: boxbox <command> [options]

Commands:
  check   (--file <path> | --directory <path>)... [--source] [--language typescript|python|json|yaml] [--expect-axis <axis>]... [--json]
  align   --file <path> [--language typescript|python|json|yaml] [--dry-run] [--json]
  format  (--file <path> | --directory <path>)... [--language typescript|python|json|yaml] [--dry-run] [--json]
  guide   --file <path> [--language typescript|python|json|yaml] [--authoring] [--json]
  init    [--json]
  doctor  [--json]
  mode [off|check|align|refactor] [--global] [--json]
  update [--check | --snooze [days] | --source <absolute-checkout>] [--host claude|codex] [--json]
  statusline [--no-color] [--left] [--wrap <command>] | --install-shim
  monitor [--project | --session <id>] [--host auto|claude|codex] [--no-paths] [--html <absolute-path>] [--json]
  run --root <path> [--json] -- <command> [args...]
  status --root <path> [--json]
  hook session|post|stop --root <path>
  hooks install codex|claude --root <path>
  db init [--json]
  db status [--json]

Options:
  --help       Show this help
  --version    Show the development metadata version

align and guide accept exactly one TypeScript, Python, JSON or YAML file. check and format also accept
repeated --file selections and bounded --directory traversal. Batch formats are atomic per file, and
report completed writes when another file fails. format writes only when
complete human-approval proof passes the fixed-point safety pipeline. An optional configured
formatter runs before BoxBox; without it BoxBox aligns approved tables directly.
With a configured formatter, check verifies the complete formatter-then-BoxBox canonical output without replacing the source.
check --source inspects source syntax and tables without a formatter, working copy or write attempt; it does not grant write approval.
align preserves line breaks and indentation and never runs the configured formatter.
guide --authoring provides scoped approved guidance before a file exists; it does not write or verify code. For TypeScript it also lists
the registered column sets and what each axis means, as row-design vocabulary, not approval.
check --expect-axis reports which requested axes the detected groups cover, miss, or do not recognize; it never changes the exit code.
monitor always writes one local HTML page inside absolute CLAUDE_PLUGIN_DATA or PLUGIN_DATA, including with --json.
Write and Refactor are agent skill workflows, not automatic CLI rewrites.`;

interface ParsedFileCommand {
	readonly file       : string            ;
	readonly language   : PublicLanguage    ;
	readonly json       : boolean           ;
	readonly dryRun     : boolean           ;
	readonly authoring  : boolean           ;
	readonly sourceOnly : boolean           ;
	readonly expectAxes : readonly string[] ;
}

interface CliErrorEnvelope {
	readonly schemaVersion : 1                                                   ;
	readonly tool          : "boxbox"                                            ;
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
		const envelope: CliErrorEnvelope = { schemaVersion: 1, tool: "boxbox", command, ok: false, error: { code: known.code, message: known.message } };
		emitJson(envelope);
	} else console.error(`boxbox ${command}: ${known.message}`);
	return 2;
}

function assertRoot(root: string): string {
	const absolute = resolve(root);
	if (!existsSync(absolute)) throw new CliError("PROJECT_NOT_FOUND", `project root does not exist: ${absolute}`);
	const status = lstatSync(absolute);
	if (!status.isDirectory() || status.isSymbolicLink()) throw new CliError("UNSAFE_PROJECT_PATH", `project root must be a real directory, not a symlink: ${absolute}`);
	return absolute;
}

/**
 * A single-file command reads the project layer of the nearest `.boxbox/` directory between the file and the working
 * root, so a check run from a parent of several projects still honors each project's approvals. The search never leaves
 * the working root; `--file` is rewritten relative to the selected project.
 */
function fileProjectScope(root: string, args: readonly string[]): { root: string; args: readonly string[] } {
	const positions = args.flatMap((argument, index) => argument === "--file" ? [index] : []);
	if (positions.length !== 1 || args.includes("--directory")) return { root, args };
	const value = args[positions[0]! + 1];
	if (!value || value.startsWith("--")) return { root, args };
	const absolute = resolve(root, value);
	for (let directory = dirname(absolute); ; directory = dirname(directory)) {
		const path = relative(root, directory);
		if (path === "" || path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path) || directory === dirname(directory)) return { root, args };
		const marker = lstatSync(join(directory, ".boxbox"), { throwIfNoEntry: false });
		if (marker?.isDirectory() && !lstatSync(directory).isSymbolicLink()) {
			return { root: directory, args: args.map((argument, index) => index === positions[0]! + 1 ? relative(directory, absolute) : argument) };
		}
	}
}

function insideRoot(root: string, file: string, allowMissing = false): string {
	const absolute = resolve (root, file    ) ;
	const path     = relative(root, absolute) ;
	if (
		   path === ""
		|| path === ".."
		|| path.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
		|| isAbsolute(path)
	) {
		throw new CliError("PATH_ESCAPE", `file must stay inside the project root: ${file}`);
	}
	if (allowMissing && !lstatSync(absolute, { throwIfNoEntry: false })) {
		let parent = dirname(absolute);
		while (!lstatSync(parent, { throwIfNoEntry: false })) parent = dirname(parent);
		const parentStatus = lstatSync(parent);
		if (parentStatus.isSymbolicLink() || !parentStatus.isDirectory())
			throw new CliError("UNSAFE_FILE_PATH", `new file parent must be a real directory: ${file}`);
		const physical = relative(realpathSync(root), realpathSync(parent));
		if (
			   physical === ".."
			|| physical.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
			|| isAbsolute(physical)
		)
			throw new CliError("PATH_ESCAPE", `file resolves outside the project root: ${file}`);
		return absolute;
	}
	if (!existsSync(absolute)) throw new CliError("FILE_NOT_FOUND", `file does not exist: ${file}`);
	const status = lstatSync(absolute);
	if (!status.isFile() || status.isSymbolicLink()) throw new CliError("UNSAFE_FILE_PATH", `file must be a regular file, not a symlink: ${file}`);
	const realRoot = realpathSync(root              ) ;
	const realFile = realpathSync(absolute          ) ;
	const realPath = relative    (realRoot, realFile) ;
	if (
		   realPath === ".."
		|| realPath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
		|| isAbsolute(realPath)
	) {
		throw new CliError("PATH_ESCAPE", `file resolves outside the project root: ${file}`);
	}
	return absolute;
}

function inferredLanguage(file: string): PublicLanguage | undefined {
	const extension = extname(file).toLowerCase();
	if (
		   extension === ".ts"
		|| extension === ".tsx"
		|| extension === ".mts"
		|| extension === ".cts"
	)
		return "typescript";
	if (extension === ".py"                          ) return "python";
	if (extension === ".json"                        ) return "json";
	if (extension === ".yaml" || extension === ".yml") return "yaml";
	return undefined;
}

function parseFileCommand(args: readonly string[], allowDryRun: boolean, root: string, allowAuthoring = false, allowExpect = false): ParsedFileCommand {
	let file         : string | undefined         ;
	let language     : PublicLanguage | undefined ;
	let json                    = false           ;
	let dryRun                  = false           ;
	let authoring               = false           ;
	let sourceOnly              = false           ;
	const expectAxes : string[] = []              ;
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index]!;
		if (argument === "--json"                             ) { json = true; continue; }
		if (argument === "--dry-run" && allowDryRun           ) { dryRun = true; continue; }
		if (argument === "--source" && allowExpect            ) {
			if (sourceOnly) throw new CliError("DUPLICATE_OPTION", "--source may be provided only once");
			sourceOnly = true;
			continue;
		}
		if (argument === "--authoring" && allowAuthoring      ) {
			if (authoring) throw new CliError("DUPLICATE_OPTION", "--authoring may be provided only once");
			authoring = true;
			continue;
		}
		if (argument === "--expect-axis" && allowExpect       ) {
			const value = args[index + 1];
			if (!value || (!/^[a-z][a-z0-9{}-]*(=\d+)?$/u.test(value) && !Object.hasOwn(PYTHON_AXIS_NOTES, value))) throw new CliError("MISSING_VALUE", "--expect-axis requires an axis name such as call-open-paren");
			index += 1;
			expectAxes.push(value);
			continue;
		}
		if (argument === "--file" || argument === "--language") {
			const value = args[index + 1];
			if (!value || value.startsWith("--")) throw new CliError("MISSING_VALUE", `${argument} requires a value`);
			index += 1;
			if (argument === "--file") {
				if (file !== undefined) throw new CliError("DUPLICATE_OPTION", "--file may be provided only once");
				file = value;
			} else {
				if (language !== undefined) throw new CliError("DUPLICATE_OPTION", "--language may be provided only once");
				if (
					   value !== "typescript"
					&& value !== "python"
					&& value !== "json"
					&& value !== "yaml"
				)
					throw new CliError("UNSUPPORTED_LANGUAGE", `unsupported language: ${value}`);
				language = value;
			}
			continue;
		}
		throw new CliError("UNKNOWN_OPTION", `unknown option: ${argument}`);
	}
	if (!file) throw new CliError("MISSING_FILE", "one --file <path> is required");
	if (sep === "/" && file.includes("\\")) throw new CliError("UNSUPPORTED_FILE_PATH", `POSIX paths containing literal backslashes are unsupported: ${file}`);
	const absolute = insideRoot      (root, file, authoring) ;
	const inferred = inferredLanguage(absolute             ) ;
	if (!inferred) throw new CliError("UNSUPPORTED_LANGUAGE", `cannot infer a supported language from: ${file}`);
	if (language && language !== inferred) throw new CliError("LANGUAGE_MISMATCH", `--language ${language} does not match ${file}`);
	return { file: relative(root, absolute), language: language ?? inferred, json, dryRun, authoring, sourceOnly, expectAxes };
}

function parseProjectCommand(args: readonly string[], command: "check" | "format", root: string) {
	const batch = args.includes("--directory") || args.filter(argument => argument === "--file").length > 1;
	if (!batch) return { batch, files: [parseFileCommand(args, command === "format", root, false, command === "check")] };
	const inputs : string[] = [] ;
	const shared : string[] = [] ;
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index]!;
		if (argument === "--file" || argument === "--directory") {
			const value = args[index + 1];
			if (!value || value.startsWith("--")) throw new CliError("MISSING_VALUE", `${argument} requires a value`);
			inputs.push(value);
			index += 1;
		} else shared.push(argument);
	}
	const targets = selectProjectTargets(root, inputs                                                                                                          ) ;
	const files   = targets.map         (target => parseFileCommand(["--file", target.file, ...shared], command === "format", root, false, command === "check")) ;
	return { batch, files };
}

function jsonRequested(args: readonly string[]): boolean {
	return args.includes("--json");
}

function assertSimpleFlags(args: readonly string[], allowed: readonly string[]): void {
	for (const argument of args) if (!allowed.includes(argument)) throw new CliError("UNKNOWN_OPTION", `unknown option: ${argument}`);
}

function assertControlOptions(command: "mode" | "update" | "statusline", args: readonly string[]): void {
	const allowed = command === "mode" ? ["--global", "--json"]
		: command === "update" ? ["--check", "--snooze", "--source", "--host", "--json"]
		: ["--install-shim", "--no-color", "--left", "--wrap"];
	const seen = new Set<string>();
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index]!;
		if (command === "mode" && !argument.startsWith("--")) continue;
		if (!allowed.includes(argument)) throw new CliError("UNKNOWN_OPTION", `unknown option: ${argument}`);
		if (seen.has(argument)) throw new CliError("DUPLICATE_OPTION", `${argument} may be provided only once`);
		seen.add(argument);
		if (["--source", "--host", "--wrap"].includes(argument)) {
			const value = args[index + 1];
			if (!value || value.startsWith("--")) throw new CliError("MISSING_VALUE", `${argument} requires a value`);
			if (argument === "--host" && value !== "claude" && value !== "codex") throw new CliError("INVALID_HOST", "--host must be claude or codex");
			index += 1;
		} else if (argument === "--snooze" && args[index + 1] !== undefined && !args[index + 1]!.startsWith("--")) {
			const days = Number(args[index + 1]);
			if (!Number.isFinite(days) || days <= 0) throw new CliError("INVALID_VALUE", "--snooze days must be a positive number");
			index += 1;
		}
	}
	if (seen.has("--install-shim") && seen.size > 1) throw new CliError("CONFLICTING_OPTIONS", "--install-shim cannot be combined with statusline display options");
	if (seen.has("--snooze") && ["--check", "--source", "--host"].some(flag => seen.has(flag))) throw new CliError("CONFLICTING_OPTIONS", "--snooze cannot be combined with update check or installation options");
}

function monitor(args: readonly string[], root: string): number {
	const seen = new Set<string>()     ;
	let sessionId : string | undefined ;
	let htmlPath  : string | undefined ;
	let host   = "auto"                ;
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index]!;
		if (!["--project", "--session", "--host", "--json", "--no-paths", "--html"].includes(argument)) throw new CliError("UNKNOWN_OPTION", `unknown option: ${argument}`);
		if (seen.has(argument)) throw new CliError("DUPLICATE_OPTION", `${argument} may be provided only once`);
		seen.add(argument);
		if (["--session", "--host", "--html"].includes(argument)) {
			const value = args[index + 1];
			if (!value || value.startsWith("--")) throw new CliError("MISSING_VALUE", `${argument} requires a value`);
			if (argument === "--session") sessionId = value;
			if (argument === "--host") host = value;
			if (argument === "--html") htmlPath = value;
			index += 1;
		}
	}
	if (seen.has("--project") && sessionId !== undefined) throw new CliError("CONFLICTING_OPTIONS", "--project and --session are mutually exclusive");
	if (host !== "auto" && host !== "claude" && host !== "codex") throw new CliError("INVALID_HOST", "--host must be auto, claude or codex");
	if (htmlPath !== undefined && !isAbsolute(htmlPath)) throw new CliError("INVALID_PATH", "--html requires an absolute path inside plugin data");
	const data = process.env.CLAUDE_PLUGIN_DATA || process.env.PLUGIN_DATA;
	if (!data || !isAbsolute(data)) throw new CliError("MISSING_PLUGIN_DATA", "monitor requires absolute CLAUDE_PLUGIN_DATA or PLUGIN_DATA; use the installed host launcher or set the host-owned plugin-data path");
	const selectedHost = host === "auto" ? process.env.CODEX_THREAD_ID || process.env.CODEX_SESSION_ID ? "codex" : "claude" : host                                              ;
	const report       = buildMonitorReport({ root, host: selectedHost, pluginData: data, ...(sessionId !== undefined ? { sessionId } : {}), noPaths: seen.has("--no-paths") }) ;
	const html         = writeMonitorReport(report, { root, pluginData: data, ...(htmlPath !== undefined ? { path: htmlPath } : {}) })                                          ;
	if (seen.has("--json")) emitJson({ ...report, html });
	else {
		console.log(`monitor host=${report.host} sessions=${report.sessions.length} input=${report.totals.input} cache-read=${report.totals.cacheRead} cache-write=${report.totals.cacheWrite} output=${report.totals.output}`);
		console.log(`HTML: ${html}`);
		for (const note of report.notes) console.log(`limitation: ${note}`);
	}
	return 0;
}

interface ApprovalContext {
	readonly registry          : ApprovalRegistry ;
	readonly resolveDocument   : DocumentResolver ;
	readonly fingerprint       : string           ;
	readonly configFingerprint : string           ;
}

function approvalContext(root: string): ApprovalContext {
	const config     = resolveConfig(root)                                          ;
	const userConfig = config.sources.find(source => source.layer === "user")?.path ;
	const userRoot   = userConfig ? dirname(userConfig) : undefined                 ;
	const projectDb  = join(root, ".boxbox")                                        ;
	const presetRoot = ruleData("presets/recommended/")                             ;
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
		config      : config.fingerprint                ,
		conventions : registry.conventions              ,
		examples    : [...registry.examples.entries()]  ,
		decisions   : [...registry.decisions.entries()] ,
		documents,
	});
	return { registry, resolveDocument, configFingerprint: config.fingerprint, fingerprint: `sha256:${createHash("sha256").update(evidence).digest("hex")}` };
}

/** Bind the registry and selected configuration to the snapshot used by every later provenance check. */
export function preparedPipelineContext(root: string, expectedConfigFingerprint?: string): ProjectPipelineContext {
	const context = approvalContext(root);
	if (expectedConfigFingerprint !== undefined && context.configFingerprint !== expectedConfigFingerprint) throw new Error("configuration changed before pipeline preparation");
	return {
		registry        : context.registry        ,
		resolveDocument : context.resolveDocument ,
		provenance      : () => {
			const current = approvalContext(root).fingerprint;
			if (current !== context.fingerprint) throw new Error("configuration or approval provenance changed after preparation");
			return current;
		},
	};
}

/** Hook alignment uses the same approved horizontal-only pipeline as explicit Align, with no formatter or secondary stdout. */
export async function alignApprovedHook(root: string, file: string): Promise<{ readonly written: boolean; readonly edits: number }> {
	const project = assertRoot      (root                           ) ;
	const parsed  = parseFileCommand(["--file", file], true, project) ;
	const config  = resolveConfig   (project                        ) ;
	if (!config.effective.languages.includes(parsed.language)) throw new CliError("LANGUAGE_DISABLED", `${parsed.language} is not enabled by the effective configuration`);
	const context = preparedPipelineContext(project, config.fingerprint) ;
	const target  = insideRoot             (project, parsed.file       ) ;
	const initial = readFileSync           (target                     ) ;
	const unchanged = (): void => {
		if (!readFileSync(target).equals(initial)) throw new Error("Source changed after alignment preview");
	};
	const options = { ...context, root: project, file: parsed.file, language: parsed.language, alignmentOnly: true, beforeCommit: unchanged } ;
	const preview = await runFormatPipeline({ ...options, dryRun: true })                                                                     ;
	unchanged();
	context.provenance?.();
	if (!preview.canonicalChanged) return { written: false, edits: 0 };
	const edits = preview.alignmentEdits?.length;
	if (!edits) throw new Error("Alignment preview did not report changed physical lines");
	const applied = await runFormatPipeline(options);
	if (!applied.written) unchanged();
	return { written: applied.written, edits: applied.written ? edits : 0 };
}

function syntaxRefusal(parsed: ParsedFileCommand, syntax: SyntaxValidation): FileResult {
	const groups = [{ kind: "syntax", startLine: 1, endLine: 1, rows: 0, axes: [], state: "REFUSE" as const, edits: 0 }];
	return { file: parsed.file, language: parsed.language, mode: "check", summary: { groups: 1, misaligned: 0, edits: 0, refused: 1, suggested: 0 }, groups, parse: { status: "skipped", tool: syntax.tool } };
}

async function inspectFile(parsed: ParsedFileCommand, root: string, knownSyntax?: SyntaxValidation): Promise<FileResult> {
	const syntax = knownSyntax ?? await validateSyntax({ root, file: parsed.file, language: parsed.language });
	if (syntax.status !== "valid") return syntaxRefusal(parsed, syntax);
	if (parsed.language === "python") {
		const previous = process.cwd();
		try {
			process.chdir(root);
			const report = runAlignCli(PYTHON_ALIGNER, ["--file", parsed.file, "--json"]).report;
			return (JSON.parse(report) as ResultEnvelope).results[0]!;
		} finally { process.chdir(previous); }
	}
	if (parsed.language === "json" || parsed.language === "yaml") {
		return analyzeStructured(readFileSync(resolve(root, parsed.file), "utf8"), parsed.language, parsed.file).result;
	}
	let report = "";
	await runTypeScriptAlign(["--file", parsed.file, "--json"], { root, emit: value => { report = value; } });
	return (JSON.parse(report) as ResultEnvelope).results[0]!;
}

function doctorReport(root: string) {
	const nodeParts = process.versions.node.split(".").map(Number) ;
	const node = {
		ok: (nodeParts[0] ?? 0) > 22
			|| ((nodeParts[0] ?? 0) === 22
				&& ((nodeParts[1] ?? 0) > 22
					|| ((nodeParts[1] ?? 0) === 22 && (nodeParts[2] ?? 0) >= 3))),
		detail: `Node ${process.versions.node} (artifact candidate minimum: 22.22.3)`
	} ;
	const pythonProbe = spawnSync("python3", ["--version"], { encoding: "utf8", timeout: 5_000, maxBuffer: 64 * 1024 }) ;
	const python = {
		ok: pythonProbe.status === 0,
		detail: pythonProbe.status === 0 ? (pythonProbe.stdout || pythonProbe.stderr).trim() : "python3 is unavailable or failed to start"
	} ;
	let config: {
		ok           : boolean            ;
		detail       : string             ;
		fingerprint? : string             ;
		layers?      : readonly unknown[] ;
		formatters?  : readonly string[]  ;
		languages?: readonly PublicLanguage[]
	} ;
	try {
		const resolved   = resolveConfig        (root                                ) ;
		const project    = resolved.sources.find(source => source.layer === "project") ;
		const formatters = Object          .keys(resolved.effective.formatters       ) ;
		config = {
			ok          : true                 ,
			detail      :
				`schema 2; languages=${resolved.effective.languages.join(",")}; project=${project?.present ? "present" : "absent, inherited defaults"}`,
			fingerprint : resolved.fingerprint ,
			layers      : resolved.sources     ,
			formatters                         ,
			languages   : resolved.effective.languages
		};
	} catch (error) {
		config = { ok: false, detail: messageOf(error) };
	}
	let approval: { ok: boolean; detail: string };
	try {
		const context  = approvalContext(root)                                                              ;
		const approved = context.registry.conventions.filter(record => record.status === "approved").length ;
		approval = approved > 0
			? {
				ok: true,
				detail: `${approved} approved convention record(s) loaded; proof remains file-specific`
			}
			: { ok: false, detail: "approved convention registry is empty" };
	} catch (error) {
		approval = { ok: false, detail: messageOf(error) };
	}
	const detectedFormatters = detectFormatters(root)                                                                                                                                                   ;
	const warnings           = detectedFormatters.map(formatterWarning)                                                                                                                                 ;
	let formatter            = { ok: true, detail: detectedFormatters.length > 0 ? "standalone alignment; no formatter configured in BoxBox" : "standalone alignment; no external formatter required" } ;
	try {
		const formatters = Object.entries(resolveConfig(root).effective.formatters);
		for (const [, configured] of formatters) resolveFormatterExecutable(configured.command, root);
		if (formatters.length > 0) formatter = {
			ok: true,
			detail: `executable resolved for ${formatters.map(([language]) => language).join(",")}; execution is verified by format --dry-run`
		};
	} catch (error) {
		formatter = { ok: false, detail: messageOf(error) };
	}
	const limitations = [
		"format readiness is finally decided per file by exact approval proof",
		"only one explicit TypeScript, Python, JSON or YAML file is accepted",
		"installation and hook registration do not prove native host event delivery"
	] ;
	const pythonRequired   = config.languages?.includes("python") ?? true           ;
	const runtimeUsable    = node.ok && config.ok && (!pythonRequired || python.ok) ;
	const formatConfigured = runtimeUsable && approval.ok && formatter.ok           ;
	const ok               = runtimeUsable                                          ;
	const result = {
		schemaVersion : 1        ,
		tool          : "boxbox" ,
		command       : "doctor" ,
		ok                                                                    ,
		runtimeUsable                                                         ,
		formatConfigured                                                      ,
		releaseReady : false                                                  ,
		checks       : { runtime: node, python, config, approval, formatter } ,
		detectedFormatters                                                    ,
		warnings                                                              ,
		limitations
	} ;
	return result;
}

function doctor(root: string, json: boolean): number {
	const result = doctorReport(root);
	if (json) emitJson(result);
	else {
		for (const [name, check] of Object.entries(result.checks)) console.log(`${check.ok ? "ok" : "not-ready"} ${name}: ${check.detail}`);
		for (const warning of result.warnings) console.log(`warning: ${warning}`);
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
			schemaVersion : 1                  ,
			tool          : "boxbox"           ,
			command       : "db init"          ,
			ok            : true               ,
			root          : result.root        ,
			createdRoot   : result.createdRoot ,
			files         : result.files       ,
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
		const result = { schemaVersion: 1, tool: "boxbox", command: "db status", ok: true, ...userDatabaseStatus() };
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

function formatReadiness(parsed: ParsedFileCommand, root: string, result: FileResult, syntax: SyntaxValidation) {
	const mode          = resolveConfig(root).effective.formatters[parsed.language] ? "formatter" : "standalone" ;
	const eligible      = result.groups.filter(group => group.state === "PASS" || group.state === "FIXABLE")     ;
	const fixableGroups = eligible.filter(group => group.state === "FIXABLE").length                             ;
	try {
		const context = approvalContext(root);
		const groups = evaluateDetected(
			context.registry,
			eligible
				.map(group => ({
					language : result.language ,
					context  : group.context   ,
					kind     : group.kind      ,
					axes     : group.axes      ,
					file     : parsed.file
				})),
			context.resolveDocument
		);
		const approvalFacts = [...new Map(groups.map(group => [group.query.key, {
			key           : group.query.key,
			status        : group.result.status,
			...(group.result.conventionId ? { conventionId: group.result.conventionId } : {}),
			...(group.result.layer ? { layer: group.result.layer } : {}),
			proofComplete : group.result.status === "approved" && group.result.writable,
			reasons       : group.result.reasons,
		}])).values()];
		const approvedFixableGroups = groups.filter((group, index) => eligible[index]!.state === "FIXABLE" && group.result.status === "approved" && group.result.writable).length ;
		const reasons               = groups.flatMap(group => group.result.reasons)                                                                                               ;
		if (syntax.status !== "valid") reasons.push(`syntax ${syntax.status}: ${syntax.diagnostics.join("; ")}`);
		if (result.groups.some(group => group.state === "REFUSE")) reasons.push("BoxBox safety refusal prevents formatting");
		if (groups.length === 0) reasons.push("no verified approval rule applies to this file");
		return {
			mode                                    ,
			approvalEligible : reasons.length === 0 ,
			verification     : "not-run"            ,
			fixableGroups                           ,
			approvedFixableGroups                   ,
			approvalFacts                           ,
			reasons                                 ,
			next             : "align --dry-run verifies horizontal whitespace only; format --dry-run includes the configured formatter. Both verify parser, preservation and fixed point before writing"
		};
	} catch (error) {
		return {
			mode                         ,
			approvalEligible : false     ,
			verification     : "not-run" ,
			fixableGroups                ,
			approvedFixableGroups : 0                  ,
			approvalFacts         : []                 ,
			reasons               : [messageOf(error)] ,
			next                  : "repair approval data before formatting"
		};
	}
}

async function inspectCheck(parsed: ParsedFileCommand, root: string) {
	const config = resolveConfig(root).effective;
	if (!config.languages.includes(parsed.language)) throw new CliError("LANGUAGE_DISABLED", `${parsed.language} is not enabled by the effective configuration`);
	const syntax = await validateSyntax({ root, file: parsed.file, language: parsed.language });
	const result = syntax.status === "valid"
		? await inspectFile(parsed, root, syntax)
		: { file: parsed.file, language: parsed.language, mode: "check" as const, summary: { groups: 0, misaligned: 0, edits: 0, refused: 0, suggested: 0 }, groups: [], parse: { status: "not-run" as const, tool: "" } };
	const readiness                 = formatReadiness(parsed, root, result, syntax)                                                                                                                           ;
	const vocabulary                = parsed.language === "typescript" ? AXIS_NOTES : parsed.language === "python" ? PYTHON_AXIS_NOTES : undefined                                                            ;
	const known                     = vocabulary ? new Set(Object.keys(vocabulary).map(baseAxis)) : undefined                                                                                                 ;
	const expectedGroups            = parsed.language === "python" ? result.groups.map(group => ({ ...group, axes: group.axes.map(normalizeAxis) })) : result.groups                                          ;
	const requestedAxes             = parsed.language === "python" ? parsed.expectAxes.map(normalizeAxis) : parsed.expectAxes                                                                                 ;
	const expectation               = parsed.expectAxes.length ? axisExpectation(expectedGroups, requestedAxes, known) : undefined                                                                            ;
	const report                    = { schemaVersion: 1 as const, tool: "boxbox" as const, results: [result], syntax, formatReadiness: readiness, ...(expectation ? { axisExpectation: expectation } : {}) } ;
	const exitCode: ProjectExitCode = syntax.status !== "valid" || result.summary.refused > 0 ? 2 : result.summary.misaligned > 0 ? 1 : 0                                                                     ;
	return { report, exitCode };
}

interface CanonicalCheck {
	readonly basis        : "formatter-then-boxbox"         ;
	readonly verification : "passed" | "failed" | "not-run" ;
	readonly result       : FormatPipelineResult | null     ;
	readonly error        : string | null                   ;
}

type SourceCheck = Awaited<ReturnType<typeof inspectCheck>>;
type CheckReport = SourceCheck["report"] & { readonly basis?: "source"; readonly canonical?: CanonicalCheck };

function canonicalReport(source: SourceCheck, result: FormatPipelineResult | null, error: string | null): CheckReport {
	return {
		...source.report, basis: "source",
		canonical: { basis: "formatter-then-boxbox", verification: result ? "passed" : source.report.syntax.status === "valid" ? "failed" : "not-run", result, error },
	};
}

async function checkReport(parsed: ParsedFileCommand, root: string): Promise<{ readonly report: CheckReport; readonly exitCode: ProjectExitCode }> {
	const source    = await inspectCheck(parsed, root)             ;
	if (parsed.sourceOnly)                       return { report: { ...source.report, basis: "source" }, exitCode: source.exitCode };

	const config    = resolveConfig(root)                          ;
	const formatter = config.effective.formatters[parsed.language] ;
	if (!formatter)                              return source;
	if (source.report.syntax.status !== "valid") return { report: canonicalReport(source, null, `syntax ${source.report.syntax.status}`), exitCode: 2 };
	try {
		const context = preparedPipelineContext(root, config.fingerprint)                                                                    ;
		const result  = await runFormatPipeline({ ...context, root, file: parsed.file, language: parsed.language, formatter, dryRun: true }) ;
		return { report: canonicalReport(source, result, null), exitCode: result.canonicalChanged ? 1 : 0 };
	} catch (error) {
		return { report: canonicalReport(source, null, messageOf(error)), exitCode: 2 };
	}
}

function printCheck(report: CheckReport): void {
	const result      = report.results[0]!     ;
	const syntax      = report.syntax          ;
	const readiness   = report.formatReadiness ;
	const expectation = report.axisExpectation ;
	console.log(`check file=${result.file} groups=${result.summary.groups} misaligned=${result.summary.misaligned} refused=${result.summary.refused} suggested=${result.summary.suggested} unsupported=${result.unsupported?.length ?? 0}`);
	for (const unsupported of result.unsupported ?? []) console.log(`unsupported line=${unsupported.line}: ${unsupported.reason}`);
	for (const group of result.groups) if (group.semanticKind) console.log(`group ${group.semanticKind} kind=${group.kind} lines=${group.startLine}-${group.endLine} rows=${group.rows} state=${group.state}`);
	console.log(`syntax status=${syntax.status} tool=${syntax.tool} diagnostics=${syntax.diagnostics.length}`);
	for (const diagnostic of syntax.diagnostics) console.log(`syntax: ${diagnostic}`);
	console.log(`format mode=${readiness.mode} approval-eligible=${readiness.approvalEligible} verification=${readiness.verification} fixable-groups=${readiness.fixableGroups} approved-fixable-groups=${readiness.approvedFixableGroups}`);
	for (const reason of readiness.reasons) console.log(`format: ${reason}`);
	console.log(readiness.next);
	if (expectation) {
		console.log(`expect-axis requested=${expectation.requested.join(",")} covered=${expectation.covered.map(entry => `${entry.axis}x${entry.groups}`).join(",")} missing=${expectation.missing.join(",")} unknown=${expectation.unknown.join(",")}`);
	}
	if (report.canonical) {
		const canonical = report.canonical;
		console.log(`canonical basis=${canonical.basis} verification=${canonical.verification}${canonical.result ? ` changed=${canonical.result.canonicalChanged} formatter-changed=${canonical.result.formatterChanged} boxbox-changed=${canonical.result.boxboxChanged} fixed-point=${canonical.result.fixedPoint}` : ` error=${canonical.error}`}`);
	}
}

async function check(parsed: ParsedFileCommand, root: string): Promise<number> {
	const computed = await checkReport(parsed, root);
	if (parsed.json) emitJson(computed.report);
	else printCheck(computed.report);
	return computed.exitCode;
}

async function projectCommand(files: readonly ParsedFileCommand[], command: "check" | "format", root: string): Promise<number> {
	const config = resolveConfig(root);
	for (const file of files) if (!config.effective.languages.includes(file.language)) throw new CliError("LANGUAGE_DISABLED", `${file.language} is not enabled by the effective configuration`);
	const selected = new Map(files.map(file => [file.file.split(sep).join("/"), file])) ;
	const sources  = new Map<string, SourceCheck>()                                     ;
	const computed = await runProjectCommand({
		root, command, inputs: files.map(file => file.file), formatters: files[0]!.sourceOnly ? {} : config.effective.formatters, dryRun: files[0]!.dryRun,
		inspect: async target => {
			const source = await inspectCheck(selected.get(target.file)!, root);
			return { result: files[0]!.sourceOnly ? { ...source.report, basis: "source" } : source.report, exitCode: source.exitCode };
		},
		pipelineContext: async target => {
			const parsed  = selected.get(target.file)!                        ;
			const context = preparedPipelineContext(root, config.fingerprint) ;
			let syntax: SyntaxValidation                                      ;
			if (command === "check") {
				const source = await inspectCheck(parsed, root);
				sources.set(target.file, source);
				syntax = source.report.syntax;
			} else syntax = await validateSyntax({ root, file: parsed.file, language: parsed.language });
			if (syntax.status !== "valid") throw new Error(`syntax ${syntax.status}: ${syntax.diagnostics.join("; ")}`);
			return context;
		},
	});
	const results = computed.results.map(entry => {
		const source = sources.get(entry.file);
		return source ? { ...entry, result: canonicalReport(source, entry.result as FormatPipelineResult | null, entry.error) } : entry;
	});
	const warnings = command === "format" ? detectFormatters(root).filter(formatter => files.some(file => formatterAffects(formatter, file.language) && !formatterConfigured(formatter, config.effective.formatters[file.language]))).map(formatterWarning) : [] ;
	const output   = { schemaVersion: 1, tool: "boxbox", ok: computed.exitCode === 0, dryRun: command === "check" || files[0]!.dryRun, ...computed, results, warnings }                                                                                          ;
	if (files[0]!.json) emitJson(output);
	else {
		for (const entry of results) {
			console.log(`${command} file=${entry.file} exit=${entry.exitCode}${entry.error ? ` error=${entry.error}` : ""}`);
			if (command === "check" && entry.result) printCheck(entry.result as CheckReport);
			if (command === "format" && entry.result) {
				const result = entry.result as FormatPipelineResult;
				console.log(`format mode=${result.formatMode} written=${result.written} canonical-changed=${result.canonicalChanged} fixed-point=${result.fixedPoint}`);
			}
		}
		console.log(`${command} files=${results.length} exit=${computed.exitCode} atomicity=per-file`);
		for (const warning of warnings) console.log(`warning: ${warning}`);
	}
	return computed.exitCode;
}

async function guide(parsed: ParsedFileCommand, root: string): Promise<number> {
	const config = resolveConfig(root).effective;
	if (!config.languages.includes(parsed.language)) throw new CliError("LANGUAGE_DISABLED", `${parsed.language} is not enabled by the effective configuration`);
	if (parsed.authoring) {
		const context = approvalContext(root                                                                   ) ;
		const advice  = authoringGuide (context.registry, parsed.file, parsed.language, context.resolveDocument) ;
		if (approvalContext(root).fingerprint !== context.fingerprint) throw new Error("configuration or approval data changed while preparing guidance");
		const approvedKeys = advice.rules.map(rule => rule.key);
		const sets = parsed.language === "typescript" ? columnSetGuide(KIND_AXES, AXIS_NOTES, approvedKeys)
			: parsed.language === "python" ? pythonColumnSetGuide(approvedKeys)
			: { columnSets: [], axisNotes: {} };
		const output = {
			schemaVersion: 1, tool: "boxbox", command: "guide", basis: "authoring", ok: advice.rules.length > 0,
			file: parsed.file, language: parsed.language, verification: "not-run", writeAuthorized: false, ...advice, ...sets,
		};
		if (parsed.json) emitJson(output);
		else {
			console.log(`guide file=${parsed.file} basis=authoring rules=${advice.rules.length} verification=not-run write-authorized=false`);
			for (const rule of advice.rules) {
				console.log(`[${rule.id}] ${rule.key}\n${rule.contract}`);
				for (const example of rule.examples) console.log(`[${example.id}] approved example\n${example.after}`);
				for (const example of rule.counterexamples) console.log(`[${example.id}] counterexample: preserve the before form\n${example.before}`);
			}
			for (const item of advice.unavailable) console.log(`unavailable ${item.key}: ${item.reasons.join("; ")}`);
			for (const set of sets.columnSets) console.log(`column-set ${set.kind} approved=${set.approved}: ${set.columns.join(" | ")}`);
		}
		return output.ok ? 0 : 1;
	}
	const inspected = await inspectFile(parsed, root) ;
	const context   = approvalContext(root)           ;
	const evaluated = evaluateDetected(
		context.registry,
		inspected.groups
			.filter(group => group.state === "PASS" || group.state === "FIXABLE")
			.map(group => ({
				language : inspected.language ,
				context  : group.context      ,
				kind     : group.kind         ,
				axes     : group.axes         ,
				file     : parsed.file
			})),
		context.resolveDocument
	);
	const approved    = evaluated.filter(item => item.result.status === "approved" && item.result.writable)                       ;
	const guides      = [...new Map(approved.flatMap(item => item.result.guide).map(example => [example.id, example])).values()]  ;
	const conventions = [...new Set(approved.flatMap(item => item.result.conventionId ? [item.result.conventionId] : []))].sort() ;
	const output = {
		schemaVersion : 1                 ,
		tool          : "boxbox"          ,
		command       : "guide"           ,
		ok            : guides.length > 0 ,
		file          : parsed.file       ,
		language      : parsed.language   ,
		conventions,
		guides
	} ;
	if (parsed.json) emitJson(output);
	else if (guides.length === 0) console.log(`guide file=${parsed.file}: no verified approved guidance applies`);
	else {
		console.log(`guide file=${parsed.file} conventions=${conventions.join(",")}`);
		for (const example of guides) console.log(`[${example.id}]\n${example.after}`);
	}
	return guides.length > 0 ? 0 : 1;
}

async function format(parsed: ParsedFileCommand, root: string, alignmentOnly = false): Promise<number> {
	const command   = alignmentOnly ? "align" : "format"                           ;
	const errorCode = alignmentOnly ? "ALIGN_NOT_ELIGIBLE" : "FORMAT_NOT_ELIGIBLE" ;
	const resolved  = resolveConfig(root)                                          ;
	if (!resolved.effective.languages.includes(parsed.language)) throw new CliError("LANGUAGE_DISABLED", `${parsed.language} is not enabled by the effective configuration`);
	const formatter = alignmentOnly ? undefined : resolved.effective.formatters[parsed.language] ;
	const context   = preparedPipelineContext(root, resolved.fingerprint)                        ;
	if (context.registry.conventions.length === 0) throw new CliError(errorCode, `${command} refused: approval registry is empty`);
	if (!alignmentOnly && formatter) {
		const syntax = await validateSyntax({ root, file: parsed.file, language: parsed.language });
		if (syntax.status !== "valid") throw new CliError(errorCode, `format refused: syntax ${syntax.status}: ${syntax.diagnostics.join("; ")}`);
	}
	const warnings = detectFormatters(root).filter(detected => formatterAffects(detected, parsed.language) && !formatterConfigured(detected, formatter)).map(formatterWarning);
	try {
		const result = await runFormatPipeline({
			root                       ,
			file     : parsed.file     ,
			language : parsed.language ,
			...(formatter ? { formatter } : {}),
			registry        : context.registry        ,
			resolveDocument : context.resolveDocument ,
			dryRun          : parsed.dryRun           ,
			alignmentOnly                        ,
			provenance      : context.provenance ,
		});
		const output = { schemaVersion: 1, tool: "boxbox", command, ok: true, dryRun: parsed.dryRun, formatEligible: true, ...result, warnings,
			...(alignmentOnly ? { mode: "align", horizontalWhitespaceOnly: true } : {}),
		};
		if (parsed.json) emitJson(output);
		else {
			console.log(`${command} file=${result.file} mode=${result.formatMode} dry-run=${parsed.dryRun} written=${result.written} formatter-changed=${result.formatterChanged} boxbox-changed=${result.boxboxChanged} fixed-point=${result.fixedPoint} approvals=${result.approvals.join(",")}`);
			for (const edit of result.alignmentEdits ?? []) console.log(`line ${edit.line}\n- ${edit.before}\n+ ${edit.after}`);
			for (const warning of warnings) console.log(`warning: ${warning}`);
		}
		return 0;
	} catch (error) {
		throw new CliError(errorCode, `${command} refused: ${messageOf(error)}`);
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
		if (command === "hook"  ) return await lifecycleHook(tail, async (project, file) => {
			const scope  = fileProjectScope(project, ["--file", file])     ;
			const parsed = parseFileCommand(scope.args, false, scope.root) ;
			const result = await inspectFile(parsed, scope.root)           ;
			if (scope.root === project) return result;
			// Receipts name the file relative to the session root, in the separator style the inspector reported.
			const original = parseFileCommand(["--file", file], false, project).file;
			return { ...result, file: result.file === parsed.file ? original : original.split(sep).join("/") };
		}, { version: CLI_VERSION, align: alignApprovedHook });
		if (command === "hooks" ) return installHooks(tail);
		if (command === "status") return guardStatus(tail);
		if (command === "db"    ) return database(tail, json);
		if (command === "mode" || command === "update" || command === "statusline") {
			assertControlOptions(command, tail);
			if (command === "mode") return runMode(tail, assertRoot(root));
			return command === "update" ? runUpdate(tail, CLI_VERSION) : runStatusline(tail, CLI_VERSION);
		}
		if (command === "monitor") return monitor(tail, assertRoot(root));
		if (command === "init") {
			const project = assertRoot(root) ;
			assertSimpleFlags(tail, ["--json"]);
			const result   = initializeProjectConfig(project) ;
			const resolved = resolveConfig          (project) ;
			const detected = detectFormatters       (project) ;
			const output = {
				schemaVersion      : 1                              ,
				tool               : "boxbox"                       ,
				command            : "init"                         ,
				ok                 : true                           ,
				created            : result.created                 ,
				config             : relative(project, result.path) ,
				languages          : resolved.effective.languages   ,
				fingerprint        : resolved.fingerprint           ,
				detectedFormatters : detected                       ,
				warnings           : detected.map(formatterWarning)
			} ;
			if (json) emitJson(output);
			else {
				console.log(result.created ? `created ${output.config}` : `kept existing ${output.config}`);
				for (const warning of output.warnings) console.log(`warning: ${warning}`);
			}
			return 0;
		}
		if (command === "doctor") {
			const project = assertRoot(root);
			assertSimpleFlags(tail, ["--json"]);
			return doctor(project, json);
		}
		const { root: project, args: options } = fileProjectScope(assertRoot(root), tail);
		if (command === "check" || command === "format") {
			const parsed = parseProjectCommand(options, command, project);
			if (parsed.batch) return await projectCommand(parsed.files, command, project);
			return command === "check" ? await check(parsed.files[0]!, project) : await format(parsed.files[0]!, project);
		}
		if (command === "guide" ) return await guide(parseFileCommand(options, false, project, true), project);
		if (command === "align" ) return await format(parseFileCommand(options, true, project), project, true);
		throw new CliError("UNKNOWN_COMMAND", `unknown command: ${command}`);
	} catch (error) {
		return fail(command, json, error);
	}
}
