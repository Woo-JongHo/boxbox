import      { readFileSync, realpathSync, writeFileSync                     } from "node:fs"                          ;
import      { relative, resolve                                             } from "node:path"                        ;
import      { resolveFormatterExecutable, runFormatterProcess               } from "@/common/formatter-process.ts"    ;
import type { PipelineProcessResult                                         } from "@/common/formatter-process.ts"    ;

import      { escapesRoot, evaluateApproval                                 } from "@/common/approval-gate.ts"        ;
import type { ApprovalRegistry, DocumentResolver                            } from "@/common/approval-gate.ts"        ;
import type { FormatterConfig, PublicLanguage                               } from "@/common/project-config.ts"       ;
import type { FileResult, ResultEnvelope, ResultGroup                       } from "@/common/result-json.ts"          ;
import      { compareParse                                                  } from "@/common/parse-check.ts"          ;
import      { updateFileAtomically                                          } from "@/common/safe-file.ts"            ;
import      { lookupKeyOf                                                   } from "@/common/signature.ts"            ;
import      { runTypeScriptAlign                                            } from "@/typescript/align.ts"            ;
import      { syntacticDiagnostics                                          } from "@/typescript/load-source-file.ts" ;
import      { PYTHON_ALIGNER                                                } from "@/python/profile.ts"              ;
import      { runAlignCli                                                   } from "@/common/align-cli.ts"            ;
import      { assertAlignmentOnly                                           } from "@/common/alignment-only.ts"       ;
import      { analyzeStructured, preservesStructured, structuredDiagnostics } from "@/structured/index.ts"            ;

export type { PipelineProcessResult } from "@/common/formatter-process.ts";

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
	/** Exact changed physical lines, present only for alignment-only previews. Line numbers are 1-based. */
	readonly alignmentEdits?   : readonly { readonly line: number; readonly before: string; readonly after: string }[];
	readonly safety           : {
		readonly atomic           : true        ;
		readonly approvalChecked  : true        ;
		readonly parserChecked    : true        ;
		readonly executableStable : true | null ;
	};
}

export interface FormatPipelineOptions {
	readonly root       : string          ;
	readonly file       : string          ;
	readonly language   : PublicLanguage  ;
	readonly formatter? : FormatterConfig ;
	/** Restricts edits to horizontal whitespace between tokens and prohibits external formatters. */
	readonly alignmentOnly?  : boolean          ;
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
	if (display === "" || escapesRoot(display)) throw new Error(`file escapes project root: ${file}`);
	const physical = relative(absoluteRoot, realpathSync(absolute)).replaceAll("\\", "/");
	if (escapesRoot(physical)) throw new Error(`file resolves outside project root: ${file}`);
	return { absolute, display };
}

function readStructuredUtf8(file: string): string {
	const raw  = readFileSync(file  ) ;
	const text = raw.toString("utf8") ;
	if (!Buffer.from(text, "utf8").equals(raw)) throw new Error("structured input is not valid UTF-8");
	return text;
}

/** What the pipeline needs from each language: its current groups, a parse gate for formatter output, and the engine's own write. */
interface LanguageEngine {
	readonly check : (root: string, file: string) => Promise<FileResult> ;
	readonly parse : (root: string, file: string) => Promise<void>       ;
	readonly write : (root: string, file: string) => Promise<void>       ;
}

const structuredEngine = (language: "json" | "yaml"): LanguageEngine => ({
	check : async (_root, file) => analyzeStructured(readStructuredUtf8(file), language, file).result,
	parse : async (_root, file) => {
		const diagnostics = structuredDiagnostics(readStructuredUtf8(file), language);
		if (diagnostics.length > 0) throw new Error(`formatter output does not parse: ${diagnostics.join(",")}`);
	},
	write : async (_root, file) => {
		const before   = readStructuredUtf8(file                  ) ;
		const analyzed = analyzeStructured (before, language, file) ;
		if (analyzed.result.summary.refused > 0) throw new Error(`BoxBox alignment failed: ${analyzed.refusals.map(refusal => refusal.reason).join(",")}`);
		if (!preservesStructured(before, analyzed.output, language)) throw new Error("BoxBox alignment failed: structured preservation refusal");
		if (analyzed.output !== before) writeFileSync(file, analyzed.output);
	},
});

const pythonEngine: LanguageEngine = {
	check : async (_root, file) => {
		const result = runAlignCli(PYTHON_ALIGNER, ["--file", file, "--json"]);
		return (JSON.parse(result.report) as ResultEnvelope).results[0]!;
	},
	parse : async (_root, file) => {
		const parsed = compareParse("python", "pass\n", readFileSync(file, "utf8"));
		if (parsed.status !== "ok") throw new Error(`formatter output does not parse: ${parsed.delta.join(",")}`);
	},
	write : async (_root, file) => {
		const result = runAlignCli(PYTHON_ALIGNER, ["--file", file, "--write", "--json"]);
		if (result.code !== 0) throw new Error(`BoxBox alignment failed: ${result.report}`);
	},
};

const typescriptEngine: LanguageEngine = {
	check : async (root, file) => {
		let report = "";
		await runTypeScriptAlign(["--file", file, "--json"], { root, emit: value => { report = value; } });
		return (JSON.parse(report) as ResultEnvelope).results[0]!;
	},
	parse : async (root, file) => {
		const diagnostics = await syntacticDiagnostics(root, file, readFileSync(file, "utf8"));
		if (diagnostics.length > 0) throw new Error(`formatter output does not parse: ${diagnostics.join(",")}`);
	},
	write : async (root, file) => {
		const code = await runTypeScriptAlign(["--file", file, "--write", "--json"], { root, emit: () => {} });
		if (code !== 0) throw new Error(`BoxBox alignment failed with exit code ${code}`);
	},
};

const ENGINES: Readonly<Record<PublicLanguage, LanguageEngine>> = {
	typescript : typescriptEngine         ,
	python     : pythonEngine             ,
	json       : structuredEngine("json") ,
	yaml       : structuredEngine("yaml") ,
};

function approvedGroups(result: FileResult, registry: ApprovalRegistry, resolveDocument: DocumentResolver, originalPath: string): readonly string[] {
	const candidates = result.groups.filter(group => group.state === "PASS" || group.state === "FIXABLE");
	if (result.groups.some(group => group.state === "REFUSE")) throw new Error("BoxBox safety refusal prevents formatting");
	if (candidates.length === 0) throw new Error("no verified approval rule applies to this file");
	const approvals = candidates.map((group: ResultGroup) => evaluateApproval(registry, {
		key  : lookupKeyOf(result.language, group.context, group.kind, group.axes) ,
		file : originalPath                                                        ,
	}, resolveDocument));
	const denied = approvals.filter(approval => !approval.writable || approval.status !== "approved");
	if (denied.length > 0) throw new Error(`approval denied: ${denied.flatMap(approval => approval.reasons).join("; ")}`);
	return [...new Set(approvals.map(approval => approval.conventionId!))].sort();
}

async function cycle(options: FormatPipelineOptions, working: string, display: string): Promise<{ readonly formatter: PipelineProcessResult | null; readonly formatterChanged: boolean; readonly boxboxChanged: boolean; readonly approvals: readonly string[] }> {
	if (options.language === "json" || options.language === "yaml") readStructuredUtf8(working);
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
	await ENGINES[options.language].parse(options.root, working);
	const checked   = await ENGINES[options.language].check(options.root, working)                ;
	const approvals = approvedGroups(checked, options.registry, options.resolveDocument, display) ;
	await ENGINES[options.language].write(options.root, working);
	return {
		formatter                                                        ,
		formatterChanged : !beforeFormatter.equals(afterFormatter)       ,
		boxboxChanged    : !afterFormatter.equals(readFileSync(working)) ,
		approvals                                                        ,
	};
}

/** Applies the optional formatter and BoxBox twice to the working copy to prove a fixed point, then replaces the original exactly once. */
export async function runFormatPipeline(given: FormatPipelineOptions): Promise<FormatPipelineResult> {
	if (given.alignmentOnly && given.formatter) throw new Error("alignment-only mode cannot execute an external formatter");
	// The working-copy path resolves to its real path, so resolve the root once too and use the same base in every step.
	const options = { ...given, root: realpathSync(resolve(given.root)) };
	if (options.formatter && options.formatter.args.filter(argument => argument === "{file}").length !== 1) throw new Error("formatter args must contain exactly one {file}");
	if (options.formatter && (!Number.isInteger(options.formatter.timeoutMs) || options.formatter.timeoutMs < 1 || options.formatter.timeoutMs > 60_000)) throw new Error("formatter timeoutMs must be an integer from 1 to 60000");
	const { absolute, display } = targetOf(options.root, options.file);
	const initialProvenance     = options.provenance?.();
	let first!: Awaited<ReturnType<typeof cycle>>;
	let alignmentEdits: FormatPipelineResult["alignmentEdits"];
	const written = await updateFileAtomically(absolute, async ({ initial, working }) => {
		first = await cycle(options, working, display);
		const firstOutput = readFileSync(working);
		if (options.alignmentOnly) assertAlignmentOnly(initial, firstOutput, options.language);
		if (options.alignmentOnly && options.dryRun) {
			const originalLines  = initial.toString("utf8").split(/\r\n|[\r\n\u2028\u2029]/u)     ;
			const candidateLines = firstOutput.toString("utf8").split(/\r\n|[\r\n\u2028\u2029]/u) ;

			alignmentEdits = originalLines.flatMap((before, index) => before === candidateLines[index]
				? []
				: [{ line: index + 1, before, after: candidateLines[index]! }]);
		}
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
		file             : display                ,
		formatterChanged : first.formatterChanged ,
		boxboxChanged    : first.boxboxChanged    ,
		fixedPoint       : true                   ,
		written                                                            ,
		formatter         : first.formatter                                ,
		formatterExecuted : first.formatter !== null                       ,
		formatMode        : options.formatter ? "formatter" : "standalone" ,
		approvals         : first.approvals                                ,
		...(alignmentEdits === undefined ? {} : { alignmentEdits }),
		safety            : { atomic: true, approvalChecked: true, parserChecked: true, executableStable: options.formatter ? true : null },
	};
}
