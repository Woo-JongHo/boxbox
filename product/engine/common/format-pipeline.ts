import      { readFileSync, realpathSync, writeFileSync       } from "node:fs"                           ;
import      { isAbsolute, relative, resolve                   } from "node:path"                         ;
import      { resolveFormatterExecutable, runFormatterProcess } from "./formatter-process.ts"            ;
import type { PipelineProcessResult                           } from "./formatter-process.ts"            ;

import      { evaluateApproval                                } from "./approval-gate.ts"                ;
import type { ApprovalRegistry, DocumentResolver              } from "./approval-gate.ts"                ;
import type { FormatterConfig, PublicLanguage                 } from "./project-config.ts"               ;
import type { FileResult, ResultEnvelope, ResultGroup         } from "./result-json.ts"                  ;
import      { compareParse                                    } from "./parse-check.ts"                  ;
import      { updateFileAtomically                            } from "./safe-file.ts"                    ;
import      { lookupKeyOf                                     } from "./signature.ts"                    ;
import      { runTypeScriptAlign                              } from "../typescript/align.ts"            ;
import      { syntacticDiagnostics                            } from "../typescript/load-source-file.ts" ;
import      { PYTHON_ALIGNER                                  } from "../python/profile.ts"              ;
import      { runAlignCli                                     } from "./align-cli.ts"                    ;

export type { PipelineProcessResult } from "./formatter-process.ts";

export interface FormatPipelineResult {
	readonly file              : string                       ;
	readonly formatterChanged  : boolean                      ;
	readonly boxboxChanged     : boolean                      ;
	readonly fixedPoint        : true                         ;
	readonly written           : boolean                      ;
	readonly formatter         : PipelineProcessResult | null ;
	readonly formatterExecuted : boolean                      ;
	readonly formatMode        : "standalone" | "formatter"   ;
	readonly approvals         : readonly string[]            ;
	readonly safety           : {
		readonly atomic           : true        ;
		readonly approvalChecked  : true        ;
		readonly parserChecked    : true        ;
		readonly executableStable : true | null ;
	};
}

export interface FormatPipelineOptions {
	readonly root            : string           ;
	readonly file            : string           ;
	readonly language        : PublicLanguage   ;
	readonly formatter?      : FormatterConfig  ;
	readonly registry        : ApprovalRegistry ;
	readonly resolveDocument : DocumentResolver ;
	/** Runs the same working-copy verification but restores the working copy before replacing the original. */
	readonly dryRun?         : boolean           ;
	/** Fingerprint built by rereading the config and approval files. If it differs between start and just before commit, nothing is written. */
	readonly provenance?       : () => string       ;
	readonly beforeCommit?     : () => void         ;
}

function targetOf(root: string, file: string): { readonly absolute: string; readonly display: string } {
	const absoluteRoot = realpathSync(resolve(root))                            ;
	const absolute     = resolve(absoluteRoot, file)                            ;
	const display      = relative(absoluteRoot, absolute).replaceAll("\\", "/") ;
	if (display === "" || display === ".." || display.startsWith("../") || isAbsolute(display)) throw new Error(`file escapes project root: ${file}`);
	const physical = relative(absoluteRoot, realpathSync(absolute)).replaceAll("\\", "/");
	if (physical === ".." || physical.startsWith("../") || isAbsolute(physical)) throw new Error(`file resolves outside project root: ${file}`);
	return { absolute, display };
}

async function checkFile(root: string, file: string, language: PublicLanguage): Promise<FileResult> {
	if (language === "python") {
		const result = runAlignCli(PYTHON_ALIGNER, ["--file", file, "--json"]);
		return (JSON.parse(result.report) as ResultEnvelope).results[0]!;
	}
	let report = "";
	await runTypeScriptAlign(["--file", file, "--json"], { root, emit: value => { report = value; } });
	return (JSON.parse(report) as ResultEnvelope).results[0]!;
}

async function assertParses(root: string, file: string, language: PublicLanguage): Promise<void> {
	const text = readFileSync(file, "utf8");
	if (language === "typescript") {
		const diagnostics = await syntacticDiagnostics(root, file, text);
		if (diagnostics.length > 0) throw new Error(`formatter output does not parse: ${diagnostics.join(",")}`);
		return;
	}
	const parsed = compareParse("python", "pass\n", text);
	if (parsed.status !== "ok") throw new Error(`formatter output does not parse: ${parsed.delta.join(",")}`);
}

async function writeFileWithEngine(root: string, file: string, language: PublicLanguage): Promise<void> {
	if (language === "python") {
		const result = runAlignCli(PYTHON_ALIGNER, ["--file", file, "--write", "--json"]);
		if (result.code !== 0) throw new Error(`BoxBox alignment failed: ${result.report}`);
		return;
	}
	const code = await runTypeScriptAlign(["--file", file, "--write", "--json"], { root, emit: () => {} });
	if (code !== 0) throw new Error(`BoxBox alignment failed with exit code ${code}`);
}

function approvedGroups(result: FileResult, registry: ApprovalRegistry, resolveDocument: DocumentResolver, originalPath: string): readonly string[] {
	const candidates = result.groups.filter(group => group.state === "PASS" || group.state === "FIXABLE");
	if (result.groups.some(group => group.state === "REFUSE")) throw new Error("BoxBox safety refusal prevents formatting");
	if (candidates.length === 0) throw new Error("no verified approval rule applies to this file");
	const approvals = candidates.map((group: ResultGroup) => evaluateApproval(registry, {
		key  : lookupKeyOf(result.language, group.context, group.kind, group.axes),
		file : originalPath,
	}, resolveDocument));
	const denied = approvals.filter(approval => !approval.writable || approval.status !== "approved");
	if (denied.length > 0) throw new Error(`approval denied: ${denied.flatMap(approval => approval.reasons).join("; ")}`);
	return [...new Set(approvals.map(approval => approval.conventionId!))].sort();
}

async function cycle(options: FormatPipelineOptions, working: string, display: string): Promise<{ readonly formatter: PipelineProcessResult | null; readonly formatterChanged: boolean; readonly boxboxChanged: boolean; readonly approvals: readonly string[] }> {
	const beforeFormatter                       = readFileSync(working) ;
	let formatter: PipelineProcessResult | null = null                  ;
	if (options.formatter) {
		const executable = resolveFormatterExecutable(options.formatter.command, options.root);
		formatter = await runFormatterProcess(executable.path, options.formatter, working, options.root);
		if (formatter.timedOut) throw new Error(`formatter timed out after ${options.formatter.timeoutMs}ms`);
		if (formatter.exitCode !== 0) throw new Error(`formatter failed with exit code ${String(formatter.exitCode)}${formatter.signal ? ` signal ${formatter.signal}` : ""}`);
		if (resolveFormatterExecutable(options.formatter.command, options.root).fingerprint !== executable.fingerprint) throw new Error("formatter executable changed during operation");
	}
	const afterFormatter = readFileSync(working);
	await assertParses(options.root, working, options.language);
	const checked   = await checkFile(options.root, working, options.language)                    ;
	const approvals = approvedGroups(checked, options.registry, options.resolveDocument, display) ;
	await writeFileWithEngine(options.root, working, options.language);
	return {
		formatter,
		formatterChanged: !beforeFormatter.equals(afterFormatter),
		boxboxChanged: !afterFormatter.equals(readFileSync(working)),
		approvals,
	};
}

/** Applies the optional formatter and BoxBox twice to the working copy to prove a fixed point, then replaces the original exactly once. */
export async function runFormatPipeline(given: FormatPipelineOptions): Promise<FormatPipelineResult> {
	// The working-copy path resolves to its real path, so resolve the root once too and use the same base in every step.
	const options = { ...given, root: realpathSync(resolve(given.root)) };
	if (options.formatter && options.formatter.args.filter(argument => argument === "{file}").length !== 1) throw new Error("formatter args must contain exactly one {file}");
	if (options.formatter && (!Number.isInteger(options.formatter.timeoutMs) || options.formatter.timeoutMs < 1 || options.formatter.timeoutMs > 60_000)) throw new Error("formatter timeoutMs must be an integer from 1 to 60000");
	const { absolute, display } = targetOf(options.root, options.file);
	const initialProvenance     = options.provenance?.();
	let first!: Awaited<ReturnType<typeof cycle>>;
	const written = await updateFileAtomically(absolute, async ({ initial, working }) => {
		first = await cycle(options, working, display);
		const firstOutput = readFileSync(working);
		await cycle(options, working, display);
		if (!readFileSync(working).equals(firstOutput)) throw new Error("format pipeline did not reach a byte fixed point");
		if (options.provenance && options.provenance() !== initialProvenance) throw new Error("configuration or approval provenance changed before commit");
		if (options.dryRun) writeFileSync(working, initial);
	}, {
		beforeCommit: () => {
			options.beforeCommit?.();
			if (options.provenance && options.provenance() !== initialProvenance) throw new Error("configuration or approval provenance changed before commit");
		},
	});
	return {
		file             : display,
		formatterChanged : first.formatterChanged,
		boxboxChanged    : first.boxboxChanged,
		fixedPoint       : true,
		written,
		formatter         : first.formatter,
		formatterExecuted : first.formatter !== null,
		formatMode        : options.formatter ? "formatter" : "standalone",
		approvals         : first.approvals,
		safety            : { atomic: true, approvalChecked: true, parserChecked: true, executableStable: options.formatter ? true : null },
	};
}
