import      { lstatSync, opendirSync, realpathSync  } from "node:fs"                        ;
import      { extname, join, relative, resolve, sep } from "node:path"                      ;

import      { escapesRoot                           } from "@/common/18_approval-gate.ts"   ;
import      { runFormatPipeline                     } from "@/common/21_format-pipeline.ts" ;
import type { FormatPipelineOptions                 } from "@/common/21_format-pipeline.ts" ;
import type { EffectiveConfig, PublicLanguage       } from "@/common/15_project-config.ts"  ;

export type ProjectExitCode = 0 | 1 | 2;

export interface ProjectTarget {
	readonly file     : string         ;
	readonly language : PublicLanguage ;
}

export interface ProjectInspection {
	readonly exitCode : ProjectExitCode ;
	readonly result   : unknown         ;
}

export type ProjectPipelineContext = Pick<FormatPipelineOptions, "registry" | "resolveDocument" | "provenance" | "beforeCommit">;

export interface ProjectCommandOptions {
	readonly root    : string             ;
	readonly inputs  : readonly string[]  ;
	readonly command : "check" | "format" ;
	/** Verify batch formatting on working copies without replacing any selected source file. */
	readonly dryRun?         : boolean                                                                             ;
	readonly formatters      : EffectiveConfig["formatters"]                                                       ;
	readonly inspect         : (target: ProjectTarget) => ProjectInspection | Promise<ProjectInspection>           ;
	readonly pipelineContext : (target: ProjectTarget) => ProjectPipelineContext | Promise<ProjectPipelineContext> ;
}

export interface ProjectFileResult extends ProjectTarget, ProjectInspection {
	readonly error : string | null ;
}

export interface ProjectCommandResult {
	readonly command   : "check" | "format"           ;
	readonly results   : readonly ProjectFileResult[] ;
	readonly exitCode  : ProjectExitCode              ;
	readonly atomicity : "per-file"                   ;
}

const SKIPPED_DIRECTORIES = new Set([".git", ".boxbox", "node_modules", "dist"]);
const LANGUAGES: Readonly<Record<string, PublicLanguage>> = {
	".ts"   : "typescript" ,
	".tsx"  : "typescript" ,
	".mts"  : "typescript" ,
	".cts"  : "typescript" ,
	".py"   : "python"     ,
	".json" : "json"       ,
	".yaml" : "yaml"       ,
	".yml"  : "yaml"       ,
};

/** Reject every symbolic component, even when it resolves to another location inside the project. */
function checkedPath(root: string, input: string): string {
	const absolute = resolve (root, input   ) ;
	const display  = relative(root, absolute) ;
	if (sep === "/" && display.includes("\\")) throw new Error(`POSIX paths containing literal backslashes are unsupported: ${input}`);
	if (escapesRoot(display)) throw new Error(`project target escapes root: ${input}`);
	let current = root;
	for (const component of display.split(sep).filter(Boolean)) {
		if (SKIPPED_DIRECTORIES.has(component)) throw new Error(`project target is in an excluded directory: ${input}`);
		current = join(current, component);
		if (lstatSync(current).isSymbolicLink()) throw new Error(`project target must not be a symbolic link: ${input}`);
	}
	return absolute;
}

/** Resolve explicit files and directories before running any operation; directory order is lexical and limits fail closed. */
export function selectProjectTargets(givenRoot: string, inputs: readonly string[]): readonly ProjectTarget[] {
	if (inputs.length === 0) throw new Error("at least one project target is required");
	const given = resolve(givenRoot);
	if (lstatSync(given).isSymbolicLink() || !lstatSync(given).isDirectory()) throw new Error("project root must be a real directory");
	const root                     = realpathSync(given) ;
	const targets: ProjectTarget[] = []                  ;
	const seen                     = new Set<string>()   ;
	let entries                    = 0                   ;
	const visit = (input: string, depth: number, explicit: boolean): void => {
		const absolute = checkedPath(root, input) ;
		const status   = lstatSync  (absolute   ) ;
		if (status.isDirectory()) {
			if (depth > 32) throw new Error("project target traversal exceeds 32 directory levels");
			const directory       = opendirSync(absolute) ;
			const names: string[] = []                    ;
			try {
				for (let entry = directory.readSync(); entry !== null; entry = directory.readSync()) {
					entries += 1;
					if (entries > 100_000) throw new Error("project target traversal exceeds 100000 entries");
					if (!SKIPPED_DIRECTORIES.has(entry.name)) names.push(entry.name);
				}
			} finally { directory.closeSync(); }
			for (const name of names.sort()) visit(join(absolute, name), depth + 1, false);
			return;
		}
		if (!status.isFile()) throw new Error(`project target must be a regular file: ${input}`);
		const language = LANGUAGES[extname(absolute).toLowerCase()];
		if (!language) {
			if (explicit) throw new Error(`unsupported project target: ${input}`);
			return;
		}
		const physical = realpathSync(absolute);
		if (seen.has(physical)) throw new Error(`duplicate project target: ${relative(root, absolute)}`);
		if (targets.length >= 10_000) throw new Error("project target selection exceeds 10000 files");
		seen.add(physical);
		targets.push({ file: relative(root, absolute).split(sep).join("/"), language });
	};
	for (const input of inputs) {
		if (input === "") throw new Error("project target must not be empty");
		visit(input, 0, true);
	}
	if (targets.length === 0) throw new Error("no supported project targets were found");
	return targets;
}

/** Run files sequentially. Every format is atomic for one file; later failures never hide earlier completed results. */
export async function runProjectCommand(options: ProjectCommandOptions): Promise<ProjectCommandResult> {
	const targets                       = selectProjectTargets(options.root, options.inputs) ;
	const root                          = realpathSync(resolve(options.root))                ;
	const results : ProjectFileResult[] = []                                                 ;
	let exitCode  : ProjectExitCode     = 0                                                  ;
	for (const target of targets) {
		try {
			const absolute = checkedPath(root, target.file);
			if (!lstatSync(absolute).isFile()) throw new Error(`project target must be a regular file: ${target.file}`);
			const formatter = options.formatters[target.language];
			let inspected: ProjectInspection;
			if (options.command === "check" && !formatter) inspected = await options.inspect(target);
			else {
				const context = await options.pipelineContext(target);
				const result = await runFormatPipeline({
					...context, root, file: target.file, language: target.language,
					...(formatter ? { formatter } : {}), dryRun: options.command === "check" || options.dryRun === true,
				});
				inspected = { result, exitCode: options.command === "check" && result.canonicalChanged ? 1 : 0 };
			}
			results.push({ ...target, ...inspected, error: null });
			if (inspected.exitCode > exitCode) exitCode = inspected.exitCode;
		} catch (error) {
			results.push({ ...target, exitCode: 2, result: null, error: error instanceof Error ? error.message : String(error) });
			exitCode = 2;
		}
	}
	return { command: options.command, results, exitCode, atomicity: "per-file" };
}
