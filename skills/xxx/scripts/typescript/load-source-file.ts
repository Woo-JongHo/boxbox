import      { existsSync, realpathSync, statSync } from "node:fs"                   ;
import      { relative, resolve                  } from "node:path"                 ;

import      { API                                } from "typescript/unstable/async" ;
import type { SourceFile                         } from "typescript/unstable/ast"   ;

export interface LoadedSource {
	readonly source   : SourceFile;
	readonly relative : string;
}

export function repositoryFile(root: string, value: string): { absolute: string; relative: string } {
	const absolute = resolve(root, value)                           ;
	const path     = relative(root, absolute).replaceAll("\\", "/") ;
	if (!path || path === ".." || path.startsWith("../")) throw new Error(`target must be a file inside the repository: ${value}`);
	if (!existsSync(absolute) || !statSync(absolute).isFile()) throw new Error(`target is not a regular file: ${value}`);
	const physical = relative(realpathSync(root), realpathSync(absolute)).replaceAll("\\", "/");
	if (physical === ".." || physical.startsWith("../")) throw new Error(`target resolves outside the repository: ${value}`);
	if (!/\.[cm]?[jt]sx?$/u.test(path)) throw new Error(`target must be a JavaScript or TypeScript file: ${value}`);
	return { absolute, relative: path };
}

export async function loadSourceFile(root: string, value: string): Promise<LoadedSource> {
	const target = repositoryFile(root, value) ;
	const api    = new API({ cwd: root })      ;
	// The returned AST is plain client data, so the server closes right away — one unclosed server per call
	// leaks gigabytes across a test run or a corpus scan.
	try {
		const state   = await api.updateSnapshot({ openFiles: [target.absolute] }) ;
		const project = await state.getDefaultProjectForFile(target.absolute)      ;
		if (!project) throw new Error(`cannot find a TypeScript project: ${target.relative}`)     ;
		const source = await project.program.getSourceFile(target.absolute)                       ;
		if (!source) throw new Error(`cannot read the TypeScript source AST: ${target.relative}`) ;
		return { source, relative: target.relative }                                              ;
	} finally {
		await api.close()                                                                         ;
	}
}

/**
 * Syntactic (parse) diagnostics of a repository file as `line:code` keys, read from disk by a fresh TypeScript 7
 * server. Columns are left out because alignment moves columns but never lines.
 */
export async function syntacticDiagnostics(root: string, absolute: string, text: string): Promise<readonly string[]> {
	const api = new API({ cwd: root });
	try {
		const state   = await api.updateSnapshot({ openFiles: [absolute] }) ;
		const project = await state.getDefaultProjectForFile(absolute)      ;
		if (!project) throw new Error(`cannot find a TypeScript project: ${absolute}`);
		const found = await project.program.getSyntacticDiagnostics(absolute);
		return found.map(diagnostic => `${text.slice(0, diagnostic.pos).split("\n").length}:${diagnostic.code}`).sort();
	} finally {
		await api.close();
	}
}
