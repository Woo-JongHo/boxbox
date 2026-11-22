import      { AsyncLocalStorage                                 } from "node:async_hooks"          ;
import      { existsSync, readFileSync, realpathSync, statSync } from "node:fs"                   ;
import      { relative, resolve                                 } from "node:path"                 ;

import      { API                                } from "typescript/unstable/async" ;
import      { inspectionFileSystem               } from "@/common/40_lifecycle-cache.ts" ;
import type { SourceFile                         } from "typescript/unstable/ast"   ;

export interface LoadedSource {
	readonly source   : SourceFile;
	readonly relative : string;
}

interface InspectionSnapshot {
	readonly root     : string     ;
	readonly path     : string     ;
	readonly absolute : string     ;
	readonly raw      : Buffer     ;
	readonly source   : SourceFile ;
}

interface TypeScriptInspection {
	active: boolean;
	snapshot?: InspectionSnapshot;
}

const inspections = new AsyncLocalStorage<TypeScriptInspection>();

/** Bounds AST reuse to one read-only inspection operation. Nested callers retain the same narrow scope. */
export async function withTypeScriptInspection<T>(operation: () => Promise<T>): Promise<T> {
	const current = inspections.getStore();
	if (current?.active) return operation();
	const scope: TypeScriptInspection = { active: true };
	return inspections.run(scope, async () => {
		try { return await operation(); }
		finally {
			scope.active   = false     ;
			scope.snapshot = undefined ;
		}
	});
}

function inspectionScope(): TypeScriptInspection | undefined {
	const scope = inspections.getStore();
	return scope?.active ? scope : undefined;
}

function snapshotIdentity(root: string, absolute: string): { readonly root: string; readonly path: string; readonly absolute: string } | undefined {
	try { return { root: realpathSync(resolve(root)), path: resolve(absolute), absolute: realpathSync(absolute) }; }
	catch { return undefined; }
}

function reusableSnapshot(root: string, absolute: string): InspectionSnapshot | undefined {
	const snapshot = inspectionScope()?.snapshot      ;
	const identity = snapshotIdentity(root, absolute) ;
	if (!snapshot || !identity) return undefined;
	if (snapshot.root !== identity.root || snapshot.path !== identity.path) return undefined;
	if (snapshot.absolute !== identity.absolute || !readFileSync(absolute).equals(snapshot.raw)) {
		throw new Error("source changed during TypeScript inspection");
	}
	return snapshot;
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
	const target = repositoryFile  (root, value          ) ;
	const cached = reusableSnapshot(root, target.absolute) ;
	if (cached) return { source: cached.source, relative: target.relative };
	const api = new API({ cwd: root, fs: inspectionFileSystem(root) });
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
		await api.close();
	}
}

/**
 * Syntactic (parse) diagnostics of a repository file as `line:code` keys, read from disk by a fresh TypeScript 7
 * server. Columns are left out because alignment moves columns but never lines.
 */
export async function syntacticDiagnostics(root: string, absolute: string, text: string): Promise<readonly string[]> {
	const api = new API({ cwd: root, fs: inspectionFileSystem(root) });

	let source      : SourceFile | undefined        ;
	let diagnostics : readonly string[] | undefined ;

	const scope           = inspectionScope()                                    ;
	const initialIdentity = scope ? snapshotIdentity(root, absolute) : undefined ;
	try {
		const state   = await api.updateSnapshot({ openFiles: [absolute] }) ;
		const project = await state.getDefaultProjectForFile(absolute)      ;
		if (!project) throw new Error(`cannot find a TypeScript project: ${absolute}`);
		if (scope) source = await project.program.getSourceFile(absolute);
		const found = await project.program.getSyntacticDiagnostics(absolute);
		diagnostics = found.map(diagnostic => `${text.slice(0, diagnostic.pos).split("\n").length}:${diagnostic.code}`).sort();
	} finally {
		await api.close();
	}
	if (!scope || !scope.active || inspections.getStore() !== scope || !source) return diagnostics!;
	if (text.startsWith("\uFEFF") && source.text === text.slice(1)) return diagnostics!;
	if (source.text !== text) throw new Error("source changed during TypeScript inspection");
	const identity = snapshotIdentity(root, absolute);
	let raw: Buffer;
	try { raw = readFileSync(absolute); }
	catch { throw new Error("source changed during TypeScript inspection"); }
	if (!initialIdentity || !identity
		|| initialIdentity.root !== identity.root
		|| initialIdentity.path !== identity.path
		|| initialIdentity.absolute !== identity.absolute
		|| !raw.equals(Buffer.from(text, "utf8"))) throw new Error("source changed during TypeScript inspection");
	scope.snapshot = { ...identity, raw: Buffer.from(raw), source };
	return diagnostics!;
}
