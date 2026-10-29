import      { ruleData                                                 } from "@/rule-data.ts"                ;
import      { lifecycleHook, installHooks                              } from "@/common/lifecycle-hook.ts"    ;
import      { createHash                                               } from "node:crypto"                   ;
import      { spawnSync                                                } from "node:child_process"            ;
import      { existsSync, lstatSync, readFileSync, realpathSync        } from "node:fs"                       ;
import      { dirname, extname, isAbsolute, join, relative, resolve    } from "node:path"                     ;

import      { documentResolver, evaluateDetected, loadApprovalRegistry } from "@/common/approval-gate.ts"     ;
import type { ApprovalRegistry, DocumentResolver, RegistrySource       } from "@/common/approval-gate.ts"     ;
import      { runAlignCli                                              } from "@/common/align-cli.ts"         ;
import      { resolveFormatterExecutable                               } from "@/common/formatter-process.ts" ;
import      { runFormatPipeline                                        } from "@/common/format-pipeline.ts"   ;
import      { authoringGuide, columnSetGuide                           } from "@/common/authoring-guide.ts"   ;
import      { axisExpectation, baseAxis                                } from "@/common/axis-expectations.ts" ;
import      { validateSyntax                                           } from "@/common/syntax-validation.ts" ;
import type { SyntaxValidation                                         } from "@/common/syntax-validation.ts" ;
import      {
              initializeProjectConfig                                ,
              initializeUserDatabase                                 ,
              resolveConfig                                          ,
              userDatabaseStatus                                     ,
                                                                       } from "@/common/project-config.ts"    ;
import type { PublicLanguage                                           } from "@/common/project-config.ts"    ;
import type { FileResult, ResultEnvelope                               } from "@/common/result-json.ts"       ;
import      { PYTHON_ALIGNER                                           } from "@/python/profile.ts"           ;
import      { analyzeStructured                                        } from "@/structured/index.ts"         ;
import      { runTypeScriptAlign                                       } from "@/typescript/align.ts"         ;
import      { AXIS_NOTES, KIND_AXES                                    } from "@/typescript/grid-kinds.ts"    ;

import      { guardedRun, guardStatus                                  } from "@/common/guarded-run.ts"       ;
import      { runMode                                                  } from "@/common/mode.ts"              ;
import      { runStatusline                                            } from "@/common/statusline.ts"        ;
import      { runUpdate                                                } from "@/common/update.ts"            ;

export const CLI_VERSION = "0.2.6";

const HELP = `Usage: boxbox <command> [options]

Commands:
  check   --file <path> [--language typescript|python|json|yaml] [--expect-axis <axis>]... [--json]
  align   --file <path> [--language typescript|python|json|yaml] [--dry-run] [--json]
  format  --file <path> [--language typescript|python|json|yaml] [--dry-run] [--json]
  guide   --file <path> [--language typescript|python|json|yaml] [--authoring] [--json]
  init    [--json]
  doctor  [--json]
  run --root <path> [--json] -- <command> [args...]
  status --root <path> [--json]
  hook session|post|stop --root <path>
  hooks install codex|claude --root <path>
  mode    [off|check|align|refactor] [--global] [--json]
  update  [--check] [--snooze [days]] [--source <checkout>] [--host claude|codex] [--json]
  statusline [--wrap "<command>"] [--no-color]
  db init [--json]
  db status [--json]

Options:
  --help       Show this help
  --version    Show the development metadata version

The first public stage accepts exactly one TypeScript, Python, JSON or YAML file. format writes only when
complete human-approval proof passes the fixed-point safety pipeline. An optional configured
formatter runs before BoxBox; without it BoxBox aligns approved tables directly.
align preserves line breaks and indentation and never runs the configured formatter.
guide --authoring provides scoped approved guidance before a file exists; it does not write or verify code. For TypeScript it also lists
the registered column sets and what each axis means, as row-design vocabulary, not approval.
check --expect-axis reports which requested axes the detected groups cover, miss, or do not recognize; it never changes the exit code.
Write and Refactor are agent skill workflows, not automatic CLI rewrites.`;

interface ParsedFileCommand {
	readonly file       : string            ;
	readonly language   : PublicLanguage    ;
	readonly json       : boolean           ;
	readonly dryRun     : boolean           ;
	readonly authoring  : boolean           ;
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
	if (extension === ".py")                           return "python";
	if (extension === ".json")                         return "json";
	if (extension === ".yaml" || extension === ".yml") return "yaml";

	return undefined;
}

function parseFileCommand(
	args: readonly string[],
	allowDryRun: boolean,
	root: string,
	allowAuthoring = false,
	allowExpect = false
): ParsedFileCommand {
	let file         : string | undefined         ;
	let language     : PublicLanguage | undefined ;

	let json      = false ;
	let dryRun    = false ;
	let authoring = false ;

	const expectAxes: string[] = [];

	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index]!;
		if (argument === "--json") { json = true; continue; }
		if (argument === "--dry-run" && allowDryRun) { dryRun = true; continue; }
		if (argument === "--authoring" && allowAuthoring) {
			if (authoring) throw new CliError("DUPLICATE_OPTION", "--authoring may be provided only once");
			authoring = true;
			continue;
		}
		if (argument === "--expect-axis" && allowExpect) {
			const value = args[index + 1];
			if (!value || !/^[a-z][a-z0-9{}-]*(=\d+)?$/u.test(value))
				throw new CliError("MISSING_VALUE", "--expect-axis requires an axis name such as call-open-paren");
			index += 1;
			expectAxes.push(value);
			continue;
		}
		if (argument === "--file" || argument === "--language") {
			const value = args[index + 1];
			if (!value || value.startsWith("--"))
				throw new CliError("MISSING_VALUE", `${argument} requires a value`);
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

	if (!file)
		throw new CliError("MISSING_FILE", "one --file <path> is required");

	const absolute = insideRoot      (root, file, authoring) ;
	const inferred = inferredLanguage(absolute             ) ;
	if (!inferred)
		throw new CliError("UNSUPPORTED_LANGUAGE", `cannot infer a supported language from: ${file}`);
	if (language && language !== inferred)
		throw new CliError("LANGUAGE_MISMATCH", `--language ${language} does not match ${file}`);

	return {
		file     : relative(root, absolute),
		language : language ?? inferred,
		json,
		dryRun,
		authoring,
		expectAxes
	};
}

function jsonRequested(args: readonly string[]): boolean {
	return args.includes("--json");
}

function assertSimpleFlags(args: readonly string[], allowed: readonly string[]): void {
	for (const argument of args)
		if (!allowed.includes(argument))
			throw new CliError("UNKNOWN_OPTION", `unknown option: ${argument}`);
}

interface ApprovalContext {
	readonly registry        : ApprovalRegistry ;
	readonly resolveDocument : DocumentResolver ;
	readonly fingerprint     : string           ;
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

	const roots = {
		project: root,
		...(userRoot && existsSync(userRoot) ? { user: userRoot } : {}),
		preset: presetRoot
	};

	const registry        = loadApprovalRegistry(sources) ;
	const resolveDocument = documentResolver(roots)       ;

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

	return {
		registry,
		resolveDocument,
		fingerprint: `sha256:${createHash("sha256").update(evidence).digest("hex")}`
	};
}

function syntaxRefusal(parsed: ParsedFileCommand, syntax: SyntaxValidation): FileResult {
	const groups = [
		{
			kind      : "syntax",
			startLine : 1,
			endLine   : 1,
			rows      : 0,
			axes      : [],
			state     : "REFUSE" as const,
			edits     : 0
		}
	];

	return {
		file     : parsed.file,
		language : parsed.language,
		mode     : "check",
		summary  : { groups: 1, misaligned: 0, edits: 0, refused: 1, suggested: 0 },
		groups,
		parse    : { status: "skipped", tool: syntax.tool }
	};
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
			ok: true,
			detail:
				`schema 2; languages=${resolved.effective.languages.join(",")}; project=${project?.present ? "present" : "absent, inherited defaults"}`,
			fingerprint: resolved.fingerprint,
			layers: resolved.sources,
			formatters,
			languages: resolved.effective.languages
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
	let formatter = { ok: true, detail: "standalone alignment; no external formatter required" };
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
		ok,
		runtimeUsable,
		formatConfigured,
		releaseReady: false,
		checks: { runtime: node, python, config, approval, formatter },
		limitations
	} ;
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
	const mode = resolveConfig(root).effective.formatters[parsed.language] ? "formatter" : "standalone";
	try {
		const context = approvalContext(root);
		const groups = evaluateDetected(
			context.registry,
			result.groups
				.filter(group => group.state === "PASS" || group.state === "FIXABLE")
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
		const reasons = groups.flatMap(group => group.result.reasons);
		if (syntax.status !== "valid") reasons.push(`syntax ${syntax.status}: ${syntax.diagnostics.join("; ")}`);
		if (result.groups.some(group => group.state === "REFUSE")) reasons.push("BoxBox safety refusal prevents formatting");
		if (groups.length === 0) reasons.push("no verified approval rule applies to this file");
		return {
			mode,
			approvalEligible: reasons.length === 0,
			verification: "not-run",
			approvalFacts,
			reasons,
			next: "align --dry-run verifies horizontal whitespace only; format --dry-run includes the configured formatter. Both verify parser, preservation and fixed point before writing"
		};
	} catch (error) {
		return {
			mode,
			approvalEligible : false              ,
			verification     : "not-run"          ,
			approvalFacts    : []                 ,
			reasons          : [messageOf(error)] ,
			next             : "repair approval data before formatting"
		};
	}
}

async function check(parsed: ParsedFileCommand, root: string): Promise<number> {
	const config = resolveConfig(root).effective;
	if (!config.languages.includes(parsed.language)) throw new CliError("LANGUAGE_DISABLED", `${parsed.language} is not enabled by the effective configuration`);
	const syntax = await validateSyntax({ root, file: parsed.file, language: parsed.language });
	const result = syntax.status === "valid"
		? await inspectFile(parsed, root, syntax)
		: { file: parsed.file, language: parsed.language, mode: "check" as const, summary: { groups: 0, misaligned: 0, edits: 0, refused: 0, suggested: 0 }, groups: [], parse: { status: "not-run" as const, tool: "" } };
	const readiness   = formatReadiness(parsed, root, result, syntax)                                                   ;
	const known       = parsed.language === "typescript" ? new Set(Object.keys(AXIS_NOTES).map(baseAxis)) : undefined   ;
	const expectation = parsed.expectAxes.length ? axisExpectation(result.groups, parsed.expectAxes, known) : undefined ;
	if (parsed.json) emitJson({ schemaVersion: 1, tool: "boxbox", results: [result], syntax, formatReadiness: readiness, ...(expectation ? { axisExpectation: expectation } : {}) });
	else {
		console.log(`check file=${result.file} groups=${result.summary.groups} misaligned=${result.summary.misaligned} refused=${result.summary.refused} suggested=${result.summary.suggested} unsupported=${result.unsupported?.length ?? 0}`);
		for (const unsupported of result.unsupported ?? []) console.log(`unsupported line=${unsupported.line}: ${unsupported.reason}`);
		console.log(`syntax status=${syntax.status} tool=${syntax.tool} diagnostics=${syntax.diagnostics.length}`);
		for (const diagnostic of syntax.diagnostics) console.log(`syntax: ${diagnostic}`);
		console.log(`format mode=${readiness.mode} approval-eligible=${readiness.approvalEligible} verification=${readiness.verification}`);
		for (const reason of readiness.reasons) console.log(`format: ${reason}`);
		console.log(readiness.next);
		if (expectation) {
			console.log(`expect-axis requested=${expectation.requested.join(",")} covered=${expectation.covered.map(entry => `${entry.axis}x${entry.groups}`).join(",")} missing=${expectation.missing.join(",")} unknown=${expectation.unknown.join(",")}`);
		}
	}
	return syntax.status !== "valid" || result.summary.refused > 0 ? 2 : result.summary.misaligned > 0 ? 1 : 0;
}

async function guide(parsed: ParsedFileCommand, root: string): Promise<number> {
	const config = resolveConfig(root).effective;
	if (!config.languages.includes(parsed.language)) throw new CliError("LANGUAGE_DISABLED", `${parsed.language} is not enabled by the effective configuration`);
	if (parsed.authoring) {
		const context = approvalContext(root                                                                   ) ;
		const advice  = authoringGuide (context.registry, parsed.file, parsed.language, context.resolveDocument) ;
		if (approvalContext(root).fingerprint !== context.fingerprint) throw new Error("configuration or approval data changed while preparing guidance");
		const sets   = parsed.language === "typescript" ? columnSetGuide(KIND_AXES, AXIS_NOTES, advice.rules.map(rule => rule.key)) : { columnSets: [], axisNotes: {} } ;
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

/** The one pipeline call behind `format`, `align` and the align-mode hook; approval and preservation gates included. */
async function pipeline(parsed: ParsedFileCommand, root: string, alignmentOnly: boolean) {
	const command   = alignmentOnly ? "align" : "format"                           ;
	const errorCode = alignmentOnly ? "ALIGN_NOT_ELIGIBLE" : "FORMAT_NOT_ELIGIBLE" ;
	const resolved  = resolveConfig(root)                                          ;
	if (!resolved.effective.languages.includes(parsed.language)) throw new CliError("LANGUAGE_DISABLED", `${parsed.language} is not enabled by the effective configuration`);
	const formatter = alignmentOnly ? undefined : resolved.effective.formatters[parsed.language] ;
	const context   = approvalContext(root)                                                      ;
	if (context.registry.conventions.length === 0) throw new CliError(errorCode, `${command} refused: approval registry is empty`);
	return runFormatPipeline({
		root,
		file            : parsed.file,
		language        : parsed.language,
		...(formatter ? { formatter } : {}),
		registry        : context.registry        ,
		resolveDocument : context.resolveDocument ,
		dryRun          : parsed.dryRun           ,
		alignmentOnly,
		provenance      : () => approvalContext(root).fingerprint,
	});
}

const alignFile = (parsed: ParsedFileCommand, root: string) => pipeline(parsed, root, true);

async function format(parsed: ParsedFileCommand, root: string, alignmentOnly = false): Promise<number> {
	const command   = alignmentOnly ? "align" : "format"                           ;
	const errorCode = alignmentOnly ? "ALIGN_NOT_ELIGIBLE" : "FORMAT_NOT_ELIGIBLE" ;
	try {
		const result = await pipeline(parsed, root, alignmentOnly);
		const output = { schemaVersion: 1, tool: "boxbox", command, ok: true, dryRun: parsed.dryRun, formatEligible: true, ...result,
			...(alignmentOnly ? { mode: "align", horizontalWhitespaceOnly: true } : {}),
		};
		if (parsed.json) emitJson(output);
		else {
			console.log(`${command} file=${result.file} mode=${result.formatMode} dry-run=${parsed.dryRun} written=${result.written} formatter-changed=${result.formatterChanged} boxbox-changed=${result.boxboxChanged} fixed-point=${result.fixedPoint} approvals=${result.approvals.join(",")}`);
			for (const edit of result.alignmentEdits ?? []) console.log(`line ${edit.line}\n- ${edit.before}\n+ ${edit.after}`);
		}
		return 0;
	} catch (error) {
		// Configuration refusals keep their own code, as they did before the pipeline call was shared.
		if (error instanceof CliError) throw error;
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
		if (command === "hook")   return await lifecycleHook(tail, async (project, file) => inspectFile(parseFileCommand(["--file", file], false, project), project), {
			version : CLI_VERSION,
			align   : async (project, file) => {
				const result = await alignFile(parseFileCommand(["--file", file], false, project), project);
				return { written: result.written, edits: result.alignmentEdits?.length ?? 0 };
			},
		});
		if (command === "mode")       return runMode(tail, assertRoot(root));
		if (command === "update")     return runUpdate(tail, CLI_VERSION);
		if (command === "statusline") return runStatusline(tail, CLI_VERSION);
		if (command === "hooks")  return installHooks(tail);
		if (command === "status") return guardStatus(tail);
		if (command === "db")     return database(tail, json);
		if (command === "init") {
			const project = assertRoot(root) ;
			assertSimpleFlags(tail, ["--json"]);
			const result   = initializeProjectConfig(project) ;
			const resolved = resolveConfig          (project) ;
			const output = {
				schemaVersion : 1                              ,
				tool          : "boxbox"                       ,
				command       : "init"                         ,
				ok            : true                           ,
				created       : result.created                 ,
				config        : relative(project, result.path) ,
				languages     : resolved.effective.languages   ,
				fingerprint   : resolved.fingerprint
			} ;
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
		if (command === "check")  return await check(parseFileCommand(tail, false, project, false, true), project);
		if (command === "guide")  return await guide(parseFileCommand(tail, false, project, true), project);
		if (command === "align")  return await format(parseFileCommand(tail, true, project), project, true);
		if (command === "format") return await format(parseFileCommand(tail, true, project), project);
		throw new CliError("UNKNOWN_COMMAND", `unknown command: ${command}`);
	} catch (error) {
		return fail(command, json, error);
	}
}
