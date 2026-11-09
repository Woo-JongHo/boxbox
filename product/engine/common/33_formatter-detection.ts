import      { lstatSync, readFileSync } from "node:fs"                       ;
import      { basename, join          } from "node:path"                     ;
import      { parse as parseYaml      } from "yaml"                          ;

import type { FormatterConfig         } from "@/common/15_project-config.ts" ;

export interface DetectedFormatter {
	readonly name      : "prettier" | "black" | "ruff format";
	readonly evidence  : string                              ;
	/** `runs` means a hook or script rewrites files with it; `possible` means it is only set up, or runs in check mode. */
	readonly certainty : "runs" | "possible"                 ;
}

type FormatterName = DetectedFormatter["name"];

const MAX_CONFIG_BYTES = 256 * 1024;
const PRETTIER_FILES   = [
	".prettierrc"         ,
	".prettierrc.json"    ,
	".prettierrc.json5"   ,
	".prettierrc.yaml"    ,
	".prettierrc.yml"     ,
	".prettierrc.toml"    ,
	".prettierrc.js"      ,
	".prettierrc.cjs"     ,
	".prettierrc.mjs"     ,
	".prettierrc.ts"      ,
	".prettierrc.cts"     ,
	".prettierrc.mts"     ,
	"prettier.config.js"  ,
	"prettier.config.cjs" ,
	"prettier.config.mjs" ,
	"prettier.config.ts"  ,
	"prettier.config.cts" ,
	"prettier.config.mts" ,
] ;

/** Published pre-commit hook ids; each rewrites files unless its arguments select check mode. */
const HOOK_IDS = new Map<string, FormatterName>([
	["ruff-format"   , "ruff format"] ,
	["black"         , "black"      ] ,
	["black-jupyter" , "black"      ] ,
	["prettier"      , "prettier"   ] ,
]) ;

/** Reads a small regular file at the project root; a missing, linked, oversized or unreadable file is treated as absent. */
function rootFile(root: string, name: string): string | undefined {
	try {
		const stat = lstatSync(join(root, name));
		return stat.isFile() && stat.size <= MAX_CONFIG_BYTES ? readFileSync(join(root, name), "utf8") : undefined;
	} catch {
		return undefined;
	}
}

/** Launchers that run the next word as the program; anything else in command position is the program itself. */
const COMMAND_WRAPPERS = new Set(["uv", "uvx", "run", "exec", "npx", "bunx", "pnpm", "yarn", "bun", "x", "dlx", "poetry", "pipx", "pdm", "hatch", "python", "python3", "env"]);

/** Splits simple shell commands, honoring quotes, escapes, line continuations, `#` comments and command separators. */
function shellCommands(command: string): readonly (readonly string[])[] {
	const commands : string[][] = [[]]                                                                                   ;
	let word       : string | undefined                                                                                  ;
	let quote      : string | undefined                                                                                  ;
	const endWord               = (): void => { if (word !== undefined) commands.at(-1)!.push(word); word = undefined; } ;
	for (let index = 0; index < command.length; index += 1) {
		const char = command[index]!;
		if (char === "\\" && quote !== "'") {
			const next = command[index + 1];
			if (next !== undefined && (quote === undefined || '"\\$`\n'.includes(next))) {
				index += 1;
				if (next !== "\n") word = (word ?? "") + next;
				continue;
			}
		}
		if (quote !== undefined) {
			if (char === quote) quote = undefined;
			else word += char;
		} else if (char === '"' || char === "'") {
			quote = char;
			word ??= "";
		} else if (char === "\n") {
			endWord();
			commands.push([]);
		} else if (/\s/u.test(char)) endWord();
		else if (char === "#" && word === undefined) {
			const lineEnd = command.indexOf("\n", index);
			if (lineEnd < 0) break;
			index = lineEnd - 1;
		} else if (char === ";" || char === "|" || char === "&") {
			endWord();
			commands.push([]);
		} else word = (word ?? "") + char;
	}
	endWord();
	return commands;
}

function invocationFormatters(words: readonly string[]): readonly (readonly [FormatterName, boolean])[] {
	const found: (readonly [FormatterName, boolean])[] = []                                                                                                   ;
	const start                                        = words.findIndex(word => !word.startsWith("-") && !word.includes("=") && !COMMAND_WRAPPERS.has(word)) ;
	if (start < 0) return found;
	const tool  = basename(words[start]!).replace(/\.exe$/iu, "")       ;
	const check = words.includes("--check") || words.includes("--diff") ;
	if (tool === "ruff" && words[start + 1] === "format") found.push(["ruff format", !check]);
	if (tool === "black") found.push(["black", !check]);
	if (/^prettier(?:@\S+)?$/u.test(tool)) found.push(["prettier", words.includes("--write") || words.includes("-w")]);
	return found;
}

/** Which formatters a shell command starts, and whether that invocation rewrites files. Only the program position counts, so `echo ruff format` does not. */
function commandFormatters(command: string): readonly (readonly [FormatterName, boolean])[] {
	return shellCommands(command).flatMap(invocationFormatters);
}

/** Whether the configured argv already invokes this detected formatter; unknown wrapper scripts keep their advisory. */
export function formatterConfigured(formatter: DetectedFormatter, configured: FormatterConfig | undefined): boolean {
	if (!configured) return false;
	const command = basename(configured.command).replace(/\.exe$/iu, "");
	return invocationFormatters([command, ...configured.args]).some(([name]) => name === formatter.name);
}

function stringsOf(value: unknown): readonly string[] {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : typeof value === "string" ? [value] : [];
}

/** Only `entry` and `args` affect what a hook runs. Display names and exclude patterns are not evidence. */
function hookFormatters(text: string): readonly (readonly [FormatterName, boolean])[] {
	let document: unknown;
	try {
		document = parseYaml(text);
	} catch {
		return [];
	}
	const repos = (document as { readonly repos?: unknown } | null)?.repos;
	if (!Array.isArray(repos)) return [];
	const hooks = repos.flatMap(repo => { const list = (repo as { readonly hooks?: unknown } | null)?.hooks; return Array.isArray(list) ? list as unknown[] : []; });
	return hooks.flatMap(hook => {
		const fields  = (hook ?? {}) as { readonly id?: unknown; readonly entry?: unknown; readonly args?: unknown } ;
		const args    = stringsOf(fields.args)                                                                       ;
		const command = [...stringsOf(fields.entry), ...args].join(" ")                                              ;
		const named   = typeof fields.id === "string" && !fields.entry ? HOOK_IDS.get(fields.id) : undefined         ;
		if (named) return [[named, !args.includes("--check") && !args.includes("--diff")] as const];
		return commandFormatters(command);
	});
}

function packageFormatters(text: string): { readonly invoked: readonly (readonly [FormatterName, boolean])[]; readonly prettierSetUp: boolean } {
	try {
		const manifest = JSON.parse(text) as Record<string, unknown>                                                                                         ;
		const scripts  = typeof manifest.scripts === "object" && manifest.scripts !== null ? Object.values(manifest.scripts) : []                            ;
		const invoked  = scripts.filter((script): script is string => typeof script === "string").flatMap(commandFormatters)                                 ;
		const depends  = [manifest.dependencies, manifest.devDependencies].some(group => typeof group === "object" && group !== null && "prettier" in group) ;
		return { invoked, prettierSetUp: manifest.prettier !== undefined || depends };
	} catch {
		return { invoked: [], prettierSetUp: false };
	}
}

/** TOML table headers. Comments and strings are skipped, because a multi-line string can hold text that looks like a header. */
function tomlTables(text: string): ReadonlySet<string> {
	const tables = new Set<string>() ;
	let index    = 0                 ;
	let lineFree = true              ;
	while (index < text.length) {
		const char = text[index]!;
		if (char === "\n") {
			lineFree = true;
			index += 1;
		} else if (char === "#") {
			const lineEnd = text.indexOf("\n", index);
			index = lineEnd < 0 ? text.length : lineEnd;
		} else if (char === '"' || char === "'") {
			const delimiter = text.startsWith(char.repeat(3), index) ? char.repeat(3) : char;
			index += delimiter.length;
			while (index < text.length && !text.startsWith(delimiter, index) && (delimiter.length > 1 || text[index] !== "\n")) index += char === '"' && text[index] === "\\" ? 2 : 1;
			if (text.startsWith(delimiter, index)) index += delimiter.length;
			lineFree = false;
		} else if (char === "[" && lineFree) {
			const lineEnd = text.indexOf("\n", index)                                                                            ;
			const header  = /^\[([^[\]]+)\]\s*(?:#.*)?$/u.exec(text.slice(index, lineEnd < 0 ? text.length : lineEnd).trimEnd()) ;
			if (header) tables.add(header[1]!.trim());
			lineFree = false;
			index += 1;
		} else {
			if (!/\s/u.test(char)) lineFree = false;
			index += 1;
		}
	}
	return tables;
}

/**
 * Finds formatter evidence in configuration files at the project root. It only reads them, never runs a formatter,
 * and never throws: a failed detection must not change the result of a command.
 */
export function detectFormatters(root: string): readonly DetectedFormatter[] {
	try {
		const found = new Map<FormatterName, DetectedFormatter>();
		const add   = (name: FormatterName, evidence: string, certainty: DetectedFormatter["certainty"]): void => {
			if (certainty === "runs" ? found.get(name)?.certainty !== "runs" : !found.has(name)) found.set(name, { name, evidence, certainty });
		};
		const addAll = (entries: readonly (readonly [FormatterName, boolean])[], evidence: string): void => {
			for (const [name, writes] of entries) add(name, evidence, writes ? "runs" : "possible");
		};

		const hooks = rootFile(root, ".pre-commit-config.yaml");
		if (hooks !== undefined) addAll(hookFormatters(hooks), ".pre-commit-config.yaml");

		const manifest = rootFile(root, "package.json")                                   ;
		const packaged = manifest === undefined ? undefined : packageFormatters(manifest) ;
		if (packaged) addAll(packaged.invoked, "package.json");
		if (packaged?.prettierSetUp) add("prettier", "package.json", "possible");

		const prettierFile = PRETTIER_FILES.find(name => rootFile(root, name) !== undefined);
		if (prettierFile) add("prettier", prettierFile, "possible");

		const tables = tomlTables(rootFile(root, "pyproject.toml") ?? "");
		if (tables.has("tool.black")) add("black", "pyproject.toml", "possible");
		const ruffFile = ["ruff.toml", ".ruff.toml"].find(name => rootFile(root, name) !== undefined);
		if ([...tables].some(table => table === "tool.ruff" || table.startsWith("tool.ruff."))) add("ruff format", "pyproject.toml", "possible");
		else if (ruffFile) add("ruff format", ruffFile, "possible");

		return [...found.values()];
	} catch {
		return [];
	}
}

/** The user-facing effect of one detected formatter, without claiming that a formatter runs when it is only set up. */
export function formatterWarning(formatter: DetectedFormatter): string {
	const support = "Configure the formatter in BoxBox, then use BoxBox format and check with --file or --directory in editors, hooks and CI. Each file still requires complete rule approval";
	return formatter.certainty === "runs"
		? `${formatter.name} runs from ${formatter.evidence}: it reverts BoxBox alignment in the files it rewrites. ${support}.`
		: `${formatter.name} may be in use (${formatter.evidence}). If the project runs it, it reverts BoxBox alignment in the files it rewrites, and in check mode it reports aligned files as unformatted. ${support}.`;
}

/** Whether this formatter rewrites files of the language, so its warning applies to a write in that language. */
export function formatterAffects(formatter: DetectedFormatter, language: string): boolean {
	return formatter.name === "prettier" ? language !== "python" : language === "python";
}
