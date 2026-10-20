import      { createHash                              } from "node:crypto"                       ;
import      {
              constants                             ,
              readFileSync                          ,
              realpathSync                          ,
              statSync                              ,
              writeFileSync                         ,
                                                      } from "node:fs"                           ;
import      { delimiter                               } from "node:path"                         ;
import      { isAbsolute, relative, resolve           } from "node:path"                         ;
import      { spawn                                   } from "node:child_process"                ;

import      { evaluateApproval                        } from "./approval-gate.ts"                ;
import type { ApprovalRegistry, DocumentResolver      } from "./approval-gate.ts"                ;
import type { FormatterConfig, PublicLanguage         } from "./project-config.ts"               ;
import type { FileResult, ResultEnvelope, ResultGroup } from "./result-json.ts"                  ;
import      { compareParse                            } from "./parse-check.ts"                  ;
import      { updateFileAtomically                    } from "./safe-file.ts"                    ;
import      { lookupKeyOf                             } from "./signature.ts"                    ;
import      { runTypeScriptAlign                      } from "../typescript/align.ts"            ;
import      { syntacticDiagnostics                    } from "../typescript/load-source-file.ts" ;
import      { PYTHON_ALIGNER                          } from "../python/profile.ts"              ;
import      { runAlignCli                             } from "./align-cli.ts"                    ;

const OUTPUT_LIMIT = 64 * 1024;

export interface PipelineProcessResult {
	readonly exitCode : number | null ;
	readonly signal   : string | null ;
	readonly timedOut : boolean       ;
	/** Bounded output kept for the diagnostic report. Truncation itself is not a formatter failure. */
	readonly stdout    : string  ;
	readonly stderr    : string  ;
	readonly truncated : boolean ;
}

export interface FormatPipelineResult {
	readonly file             : string                ;
	readonly formatterChanged : boolean               ;
	readonly boxboxChanged    : boolean               ;
	readonly fixedPoint       : true                  ;
	readonly written          : boolean               ;
	readonly formatter        : PipelineProcessResult ;
	readonly approvals        : readonly string[]     ;
	readonly safety           : {
		readonly atomic           : true ;
		readonly approvalChecked  : true ;
		readonly parserChecked    : true ;
		readonly executableStable : true ;
	};
}

export interface FormatPipelineOptions {
	readonly root            : string           ;
	readonly file            : string           ;
	readonly language        : PublicLanguage   ;
	readonly formatter       : FormatterConfig  ;
	readonly registry        : ApprovalRegistry ;
	readonly resolveDocument : DocumentResolver ;
	/** Runs the same working-copy verification but restores the working copy before replacing the original. */
	readonly dryRun?         : boolean           ;
	/** Fingerprint built by rereading the config and approval files. If it differs between start and just before commit, nothing is written. */
	readonly provenance?       : () => string       ;
	readonly beforeCommit?     : () => void         ;
}

interface ExecutableIdentity {
	readonly path: string;
	readonly fingerprint: string;
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

function executableOf(command: string, root: string): ExecutableIdentity {
	const candidates = command.includes("/") || command.includes("\\")
		? [resolve(root, command)]
		: (process.env.PATH ?? "").split(delimiter).filter(Boolean).map(directory => resolve(directory, command));
	for (const candidate of candidates) {
		try {
			const physical = realpathSync(candidate) ;
			const status   = statSync(physical)      ;
			if (!status.isFile() || (status.mode & constants.S_IXUSR) === 0) continue;
			const fingerprint = createHash("sha256").update(JSON.stringify([physical, status.dev, status.ino, status.mode, status.size, status.mtimeMs, status.ctimeMs])).digest("hex");
			return { path: physical, fingerprint };
		} catch { /* Check the next PATH candidate. */ }
	}
	throw new Error(`formatter executable not found: ${command}`);
}

function appendBounded(current: Buffer[], size: number, chunk: Buffer): { readonly size: number; readonly truncated: boolean } {
	const remaining = Math.max(0, OUTPUT_LIMIT - size);
	if (remaining > 0) current.push(chunk.subarray(0, remaining));
	return { size: size + Math.min(chunk.length, remaining), truncated: chunk.length > remaining };
}

async function runFormatter(executable: string, config: FormatterConfig, file: string, root: string): Promise<PipelineProcessResult> {
	if (process.platform === "win32") throw new Error("formatter process-group termination is not supported on Windows");
	const args = config.args.map(argument => argument === "{file}" ? file : argument);
	return new Promise((accept, reject) => {
		const child             = spawn(executable, args, { cwd: root, detached: true, shell: false, stdio: ["ignore", "pipe", "pipe"] }) ;
		const stdout : Buffer[] = []                                                                                                      ;
		const stderr : Buffer[] = []                                                                                                      ;
		let stdoutSize          = 0                                                                                                       ;
		let stderrSize          = 0                                                                                                       ;
		let truncated           = false                                                                                                   ;
		let timedOut            = false                                                                                                   ;
		const terminate = (signal: NodeJS.Signals): void => {
			if (child.pid === undefined) return;
			try { process.kill(-child.pid, signal); } catch { /* The process has already exited. */ }
		};
		const timeout = setTimeout(() => {
			timedOut = true;
			terminate("SIGTERM");
			setTimeout(() => terminate("SIGKILL"), 250).unref();
		}, config.timeoutMs);
		child.stdout.on("data", (value: Buffer) => {
			const next = appendBounded(stdout, stdoutSize, value);
			stdoutSize = next.size;
			truncated ||= next.truncated;
		});
		child.stderr.on("data", (value: Buffer) => {
			const next = appendBounded(stderr, stderrSize, value);
			stderrSize = next.size;
			truncated ||= next.truncated;
		});
		child.once("error", error => { clearTimeout(timeout); reject(error); });
		child.once("close", (exitCode, signal) => {
			clearTimeout(timeout);
			accept({ exitCode, signal, timedOut, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8"), truncated });
		});
	});
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

async function cycle(options: FormatPipelineOptions, working: string, display: string): Promise<{ readonly formatter: PipelineProcessResult; readonly formatterChanged: boolean; readonly boxboxChanged: boolean; readonly approvals: readonly string[] }> {
	const beforeFormatter = readFileSync(working)                                                         ;
	const executable      = executableOf(options.formatter.command, options.root)                         ;
	const formatter       = await runFormatter(executable.path, options.formatter, working, options.root) ;
	if (formatter.timedOut) throw new Error(`formatter timed out after ${options.formatter.timeoutMs}ms`);
	if (formatter.exitCode !== 0) throw new Error(`formatter failed with exit code ${String(formatter.exitCode)}${formatter.signal ? ` signal ${formatter.signal}` : ""}`);
	if (executableOf(options.formatter.command, options.root).fingerprint !== executable.fingerprint) throw new Error("formatter executable changed during operation");
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

/** Applies the formatter and BoxBox twice to the working copy to prove a fixed point, then replaces the original exactly once. */
export async function runFormatPipeline(given: FormatPipelineOptions): Promise<FormatPipelineResult> {
	// The working-copy path resolves to its real path, so resolve the root once too and use the same base in every step.
	const options = { ...given, root: realpathSync(resolve(given.root)) };
	if (options.formatter.args.filter(argument => argument === "{file}").length !== 1) throw new Error("formatter args must contain exactly one {file}");
	if (!Number.isInteger(options.formatter.timeoutMs) || options.formatter.timeoutMs < 1 || options.formatter.timeoutMs > 60_000) throw new Error("formatter timeoutMs must be an integer from 1 to 60000");
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
		formatter : first.formatter,
		approvals : first.approvals,
		safety    : { atomic: true, approvalChecked: true, parserChecked: true, executableStable: true },
	};
}
