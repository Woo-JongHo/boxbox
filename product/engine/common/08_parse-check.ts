/**
 * Re-parse check for line-engine output. Diagnostics of the original and the aligned result must match; column numbers and source quotes,
 * which alignment can shift, are excluded from the comparison. compareParse closes unverifiable cases as errors; only parserAvailable keeps
 * its role as an optional probe for local tests.
 */
import { spawnSync } from "node:child_process";

export type ParseStatus = "ok" | "changed" | "skipped";

export interface ParseComparison {
	readonly status : ParseStatus      ;
	readonly tool   : string           ;
	/** Diagnostics present in only one side, prefixed with `-` (source) or `+` (output). */
	readonly delta  : readonly string[];
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
	readonly tool    : string           ;
	readonly command : readonly string[];
	/** Recognizes syntax diagnostic lines inside the validated parser response. */
	readonly keep    : RegExp           ;
}

const PYTHON_PARSE = `import ast,json,sys,warnings
warnings.simplefilter('ignore', SyntaxWarning)
warnings.simplefilter('ignore', DeprecationWarning)
source=sys.stdin.buffer.read().decode('utf-8')
diagnostics=[]
try:
 ast.parse(source)
except SyntaxError as e:
 diagnostics=[f'{e.lineno}: error: {e.msg}']
except ValueError:
 if '\\x00' not in source: raise
 diagnostics=['None: error: source code string cannot contain null bytes']
print(json.dumps({'version':1,'status':'invalid' if diagnostics else 'valid','diagnostics':diagnostics}))`;

const TOOLCHAINS: Readonly<Record<string, Toolchain>> = {
	python : { tool: "python3", keep: /error:/u, command: ["python3", "-I", "-c", PYTHON_PARSE] },
};

const DEFAULT_TIMEOUT_MS = 60_000    ;
const MAX_OUTPUT_BYTES   = 1_048_576 ;

function hasTool(tool: string, timeoutMs = 5_000): boolean {
	// Not cached. A stale true after PATH or the executable changed must never pass the write gate.
	const run = spawnSync(tool, ["--version"], { encoding: "utf8", maxBuffer: MAX_OUTPUT_BYTES, timeout: Math.min(timeoutMs, 5_000) });
	return run.error === undefined && run.signal === null && run.status !== null;
}

function diagnostics(toolchain: Toolchain, source: string, timeoutMs: number): readonly string[] {
	const [command, ...args] = toolchain.command;
	const run    = spawnSync(command!, args, { input: source, encoding: "utf8", maxBuffer: MAX_OUTPUT_BYTES, timeout: timeoutMs }) ;
	if (run.error !== undefined) throw new Error(`parser execution failed (${toolchain.tool}): ${run.error.message}`);
	if (run.signal !== null) throw new Error(`parser terminated by signal (${toolchain.tool}): ${run.signal}`);
	if (run.status === null) throw new Error(`parser exited without a status: ${toolchain.tool}`);
	// The Python probe emits a typed response and exits 0; any other status is an unexplained failure.
	if (run.status !== 0) throw new Error(`parser exited with unrecognized status (${toolchain.tool}): ${run.status}`);
	const invalid = new Error(`parser returned an invalid response (${toolchain.tool})`);
	if (run.stderr !== "") throw invalid;
	let decoded: unknown;
	try { decoded = JSON.parse(run.stdout); } catch { throw invalid; }
	if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) throw invalid;
	const response = decoded as Record<string, unknown>;
	if (Object.keys(response).length !== 3 || response.version !== 1 || !Array.isArray(response.diagnostics)) throw invalid;
	const values: unknown[] = response.diagnostics;
	if (!values.every((value): value is string => typeof value === "string" && toolchain.keep.test(value))) throw invalid;
	if (response.status !== (values.length === 0 ? "valid" : "invalid")) throw invalid;
	return values.map(line => line.replace(/\S*boxbox-parse-[^/\s]*\/Input\.\w+/gu, "<file>").replace(/(:\d+):\d+/gu, "$1").trim());
}

/** The toolchain for a language, with its validated timeout. Throws when the language has no parser or the tool is not installed. */
function requireToolchain(language: string, options: ParseCheckOptions): { readonly toolchain: Toolchain; readonly timeoutMs: number } {
	const toolchain = TOOLCHAINS[language];
	if (!toolchain) throw new Error(`no parser registered for language: ${language}`);
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > DEFAULT_TIMEOUT_MS) throw new Error(`invalid parser timeout: ${timeoutMs}`);
	if (!hasTool(toolchain.tool, timeoutMs)) throw new Error(`parser unavailable: ${toolchain.tool}`);
	return { toolchain, timeoutMs };
}

/** Parses one input unconditionally and requires a typed parser response to establish syntax validity. */
export function syntaxDiagnostics(language: string, source: string, options: ParseCheckOptions = {}): SyntaxDiagnostics {
	const { toolchain, timeoutMs } = requireToolchain(language, options);
	return { tool: toolchain.tool, diagnostics: diagnostics(toolchain, source, timeoutMs) };
}

/** Parses `before` and `after` with the language's toolchain and compares their diagnostics. */
export function compareParse(language: string, before: string, after: string, options: ParseCheckOptions = {}): ParseComparison {
	const { toolchain, timeoutMs } = requireToolchain(language, options);
	const left  = diagnostics(toolchain, before, timeoutMs) ;
	if (before === after) return { status: "ok", tool: toolchain.tool, delta: [] };
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

const PYTHON_STRUCTURE = `import ast,json,sys,warnings
warnings.simplefilter('ignore', SyntaxWarning)
warnings.simplefilter('ignore', DeprecationWarning)
before,after=json.loads(sys.stdin.buffer.read().decode('utf-8'))
def normalized(source):
 try: return ast.dump(ast.parse(source),include_attributes=False)
 except ValueError:
  if '\\x00' not in source: raise
  return None
try:
 left=normalized(before)
 right=normalized(after)
 if left is None or right is None: print('BOXBOX_AST_INVALID')
 else: print('BOXBOX_AST_EQUAL' if left==right else 'BOXBOX_AST_DIFFERENT')
except SyntaxError:
 print('BOXBOX_AST_INVALID')`;

/** Independent write safeguard. Diagnostic comparison remains separate because formatters validate unrelated source. */
export function comparePythonStructure(before: string, after: string, options: ParseCheckOptions = {}): ParseComparison {
	const { toolchain, timeoutMs } = requireToolchain("python", options);
	const run = spawnSync(toolchain.tool, ["-I", "-c", PYTHON_STRUCTURE], {
		input: JSON.stringify([before, after]), encoding: "utf8", timeout: timeoutMs, maxBuffer: MAX_OUTPUT_BYTES,
	});
	if (run.error || run.signal || run.status !== 0 || run.stderr !== "") {
		throw new Error(`Python structure parser failed: ${run.error?.message ?? run.stderr ?? run.signal ?? run.status}`);
	}
	if (/^BOXBOX_AST_EQUAL\r?\n$/u.test(run.stdout)    ) return { status: "ok", tool: toolchain.tool, delta: [] };
	if (/^BOXBOX_AST_DIFFERENT\r?\n$/u.test(run.stdout)) return { status: "changed", tool: toolchain.tool, delta: ["Python AST differs"] };
	if (/^BOXBOX_AST_INVALID\r?\n$/u.test(run.stdout)  ) return { status: "changed", tool: toolchain.tool, delta: ["Python source is invalid"] };
	throw new Error("Python structure parser returned an invalid response");
}
