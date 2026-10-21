/**
 * Re-parse check for line-engine output. Diagnostics of the original and the aligned result must match; column numbers and source quotes,
 * which alignment can shift, are excluded from the comparison. compareParse closes unverifiable cases as errors; only parserAvailable keeps
 * its role as an optional probe for local tests.
 */
import      { spawnSync       } from "node:child_process" ;
import      {
              mkdtempSync   ,
              rmSync        ,
              writeFileSync ,
                              } from "node:fs"            ;
import      { tmpdir          } from "node:os"            ;
import      { join            } from "node:path"          ;

export type ParseStatus = "ok" | "changed" | "skipped";

export interface ParseComparison {
	readonly status : ParseStatus       ;
	readonly tool   : string            ;
	/** Diagnostics present in only one side, prefixed with `-` (source) or `+` (output). */
	readonly delta  : readonly string[] ;
}

export interface ParseCheckOptions {
	/** Execution limit for reproducing faults quickly in tests. The product default and maximum is 60 seconds. */
	readonly timeoutMs?: number;
}

export interface SyntaxDiagnostics {
	readonly tool        : string            ;
	readonly diagnostics : readonly string[] ;
}

interface Toolchain {
	readonly tool      : string                                            ;
	readonly extension : string                                            ;
	readonly command   : (file: string, work: string) => readonly string[] ;
	/** Keeps only diagnostic lines; everything else in the tool output is noise. */
	readonly keep      : RegExp                                        ;
}

const PYTHON_PARSE = "import ast,sys\ntry:\n ast.parse(open(sys.argv[1],encoding='utf-8').read())\nexcept SyntaxError as e:\n print(f'{e.lineno}: error: {e.msg}')";

const TOOLCHAINS: Readonly<Record<string, Toolchain>> = {
	python     : { tool: "python3", extension: ".py",   command: file => ["python3", "-c", PYTHON_PARSE, file],                                keep: /error:/u },
	go         : { tool: "gofmt",   extension: ".go",   command: file => ["gofmt", "-e", "-l", file],                                           keep: /:\d+:\d+: /u },
	javascript : { tool: "node",    extension: ".js",   command: file => ["node", "--check", file],                                             keep: /Error|:\d+$/u },
	c          : { tool: "clang",   extension: ".c",    command: file => ["clang", "-fsyntax-only", "-w", file],                                keep: /error:/u },
	cpp        : { tool: "clang++", extension: ".cpp",  command: file => ["clang++", "-std=c++20", "-fsyntax-only", "-w", file],               keep: /error:/u },
	java       : { tool: "javac",   extension: ".java", command: (file, work) => ["javac", "-proc:none", "-Xlint:none", "-d", work, file],     keep: /error:/u },
	rust       : { tool: "rustfmt", extension: ".rs",   command: file => ["rustfmt", "--edition", "2021", "--emit", "stdout", file],           keep: /^error/u },
	swift      : { tool: "swiftc",  extension: ".swift", command: file => ["swiftc", "-parse", file],                                           keep: /error:/u },
	kotlin     : { tool: "kotlinc", extension: ".kt",   command: (file, work) => ["kotlinc", file, "-d", work],                                keep: /error:/u },
};

const DEFAULT_TIMEOUT_MS = 60_000    ;
const MAX_OUTPUT_BYTES   = 1_048_576 ;

function hasTool(tool: string, timeoutMs = 5_000): boolean {
	// Not cached. A stale true after PATH or the executable changed must never pass the write gate.
	const run = spawnSync(tool, ["--version"], { encoding: "utf8", maxBuffer: MAX_OUTPUT_BYTES, timeout: Math.min(timeoutMs, 5_000) });
	return run.error === undefined && run.signal === null && run.status !== null;
}

function diagnostics(toolchain: Toolchain, source: string, timeoutMs: number): readonly string[] {
	const work = mkdtempSync(join(tmpdir(), "boxbox-parse-"));
	try {
		const file = join(work, `Input${toolchain.extension}`);
		writeFileSync(file, source);
		const [command, ...args] = toolchain.command(file, work);
		const run    = spawnSync(command!, args, { encoding: "utf8", maxBuffer: MAX_OUTPUT_BYTES, timeout: timeoutMs }) ;
		const output = `${run.stdout ?? ""}\n${run.stderr ?? ""}`                                                       ;

		// rustfmt emits formatted source on stdout; only stderr contains its diagnostics.
		const diagnosticOutput = toolchain.tool === "rustfmt" ? run.stderr ?? "" : output;
		const parsed = diagnosticOutput
			.split("\n")
			.filter(line => toolchain.keep.test(line))
			.map(line => line.replace(/\S*boxbox-parse-[^/\s]*\/Input\.\w+/gu, "<file>").replace(/(:\d+):\d+/gu, "$1").trim());
		if (run.error !== undefined) throw new Error(`parser execution failed (${toolchain.tool}): ${run.error.message}`);
		if (run.signal !== null) throw new Error(`parser terminated by signal (${toolchain.tool}): ${run.signal}`);
		if (run.status === null) throw new Error(`parser exited without a status: ${toolchain.tool}`);
		const diagnosticExit = parsed.length > 0 && (
			(toolchain.tool === "gofmt" && run.status === 2)
			|| (["node", "clang", "clang++", "javac", "rustfmt", "swiftc", "kotlinc"].includes(toolchain.tool) && run.status === 1)
		);
		if (run.status !== 0 && !diagnosticExit) {
			throw new Error(`parser exited with unrecognized status (${toolchain.tool}): ${run.status}`);
		}
		return parsed;
	} finally {
		rmSync(work, { recursive: true, force: true });
	}
}

/** Parses one input unconditionally. Unlike compareParse's identical-input fast path, this establishes syntax validity. */
export function syntaxDiagnostics(language: string, source: string, options: ParseCheckOptions = {}): SyntaxDiagnostics {
	const toolchain = TOOLCHAINS[language];
	if (!toolchain) throw new Error(`no parser registered for language: ${language}`);
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > DEFAULT_TIMEOUT_MS) throw new Error(`invalid parser timeout: ${timeoutMs}`);
	if (!hasTool(toolchain.tool, timeoutMs)) throw new Error(`parser unavailable: ${toolchain.tool}`);
	return { tool: toolchain.tool, diagnostics: diagnostics(toolchain, source, timeoutMs) };
}

/** Parses `before` and `after` with the language's toolchain and compares their diagnostics. */
export function compareParse(language: string, before: string, after: string, options: ParseCheckOptions = {}): ParseComparison {
	const toolchain = TOOLCHAINS[language];
	if (!toolchain) throw new Error(`no parser registered for language: ${language}`);
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > DEFAULT_TIMEOUT_MS) throw new Error(`invalid parser timeout: ${timeoutMs}`);
	if (!hasTool(toolchain.tool, timeoutMs)) throw new Error(`parser unavailable: ${toolchain.tool}`);
	if (before === after) return { status: "ok", tool: toolchain.tool, delta: [] };
	const left  = diagnostics(toolchain, before, timeoutMs) ;
	const right = diagnostics(toolchain, after , timeoutMs) ;
	const delta = [
		...left.filter(line => !right.includes(line)).map(line => `- ${line}`),
		...right.filter(line => !left.includes(line)).map(line => `+ ${line}`),
	];
	return { status: delta.length === 0 && left.length === right.length ? "ok" : "changed", tool: toolchain.tool, delta };
}

/**
 * True when the toolchain for `language` is installed. With BOXBOX_REQUIRE_PARSERS=1 a missing toolchain throws, so a
 * suite cannot quietly skip its parse checks in CI.
 */
export function parserAvailable(language: string): boolean {
	const toolchain = TOOLCHAINS[language]                               ;
	const present   = toolchain !== undefined && hasTool(toolchain.tool) ;
	if (!present && process.env.BOXBOX_REQUIRE_PARSERS === "1") throw new Error(`parser required but not installed: ${toolchain?.tool ?? language}`);
	return present;
}
