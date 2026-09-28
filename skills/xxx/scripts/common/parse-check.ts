/**
 * Output re-parse check for the line engine. The aligned file and its source are parsed with the language's
 * official toolchain; they must produce the same diagnostics. Column numbers, source excerpts and caret lines are
 * dropped because alignment moves columns but never lines. A missing toolchain yields `skipped`, never `ok`;
 * with XXX_REQUIRE_PARSERS=1 (CI) a missing toolchain is an error instead.
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
	rust       : { tool: "rustfmt", extension: ".rs",   command: file => ["rustfmt", "--edition", "2021", "--check", file],                    keep: /^error/u },
};

const available = new Map<string, boolean>();

function hasTool(tool: string): boolean {
	// A missing executable surfaces as a spawn error; any exit status means the tool exists.
	if (!available.has(tool)) available.set(tool, spawnSync(tool, ["--version"], { stdio: "ignore" }).error === undefined);
	return available.get(tool)!;
}

function diagnostics(toolchain: Toolchain, source: string): readonly string[] {
	const work = mkdtempSync(join(tmpdir(), "xxx-parse-"));
	try {
		const file = join(work, `Input${toolchain.extension}`);
		writeFileSync(file, source);
		const [command, ...args] = toolchain.command(file, work);
		const run = spawnSync(command!, args, { encoding: "utf8", timeout: 60_000 });
		return `${run.stdout ?? ""}\n${run.stderr ?? ""}`
			.split("\n")
			.filter(line => toolchain.keep.test(line))
			.map(line => line.replace(/\S*xxx-parse-[^/\s]*\/Input\.\w+/gu, "<file>").replace(/(:\d+):\d+/gu, "$1").trim());
	} finally {
		rmSync(work, { recursive: true, force: true });
	}
}

/** Parses `before` and `after` with the language's toolchain and compares their diagnostics. */
export function compareParse(language: string, before: string, after: string): ParseComparison {
	const toolchain = TOOLCHAINS[language];
	if (!toolchain) throw new Error(`no parser registered for language: ${language}`);
	if (!hasTool(toolchain.tool)) {
		if (process.env.XXX_REQUIRE_PARSERS === "1") throw new Error(`parser required but not installed: ${toolchain.tool}`);
		return { status: "skipped", tool: toolchain.tool, delta: [] };
	}
	if (before === after) return { status: "ok", tool: toolchain.tool, delta: [] };
	const left  = diagnostics(toolchain, before) ;
	const right = diagnostics(toolchain, after)  ;
	const delta = [
		...left.filter(line => !right.includes(line)).map(line => `- ${line}`),
		...right.filter(line => !left.includes(line)).map(line => `+ ${line}`),
	];
	return { status: delta.length === 0 && left.length === right.length ? "ok" : "changed", tool: toolchain.tool, delta };
}

/**
 * True when the toolchain for `language` is installed. With XXX_REQUIRE_PARSERS=1 a missing toolchain throws, so a
 * suite cannot quietly skip its parse checks in CI.
 */
export function parserAvailable(language: string): boolean {
	const toolchain = TOOLCHAINS[language]                               ;
	const present   = toolchain !== undefined && hasTool(toolchain.tool) ;
	if (!present && process.env.XXX_REQUIRE_PARSERS === "1") throw new Error(`parser required but not installed: ${toolchain?.tool ?? language}`);
	return present;
}
