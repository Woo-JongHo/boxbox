import      { randomUUID                            } from "node:crypto"                        ;
import      { existsSync, unlinkSync, writeFileSync } from "node:fs"                            ;
import      { basename, dirname, join               } from "node:path"                          ;

import      { API                                   } from "typescript/unstable/async"          ;
import type { Node, SourceFile                      } from "typescript/unstable/ast"            ;

import      { repositoryFile                        } from "@/typescript/load-source-file.ts"   ;
import      { preservesTokensWithBreaks             } from "@/typescript/token-preservation.ts" ;

export type LayoutPreservationStatus = "preserved" | "tokens-changed" | "parse-changed" | "structure-changed";

export interface LayoutPreservationResult {
	readonly status : LayoutPreservationStatus ;
	readonly reason : string                   ;
}

interface ParsedLayout {
	readonly diagnostics : readonly number[] ;
	readonly structure   : readonly number[] ;
}

function structureOf(source: SourceFile): readonly number[] {
	const structure: number[] = [];
	const visit = (node: Node): void => {
		structure.push(node.kind);
		node.forEachChild(child => { visit(child); return undefined; });
		structure.push(-1);
	};
	visit(source);
	return structure;
}

function same(left: readonly number[], right: readonly number[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function parseLayouts(root: string, beforePath: string, afterPath: string): Promise<readonly [ParsedLayout, ParsedLayout]> {
	const api = new API({ cwd: root });
	try {
		const state = await api.updateSnapshot({ openFiles: [beforePath, afterPath] });
		const parse = async (path: string): Promise<ParsedLayout> => {
			const project = await state.getDefaultProjectForFile(path);
			if (!project) throw new Error(`cannot find a TypeScript project for layout preservation: ${path}`);
			const source = await project.program.getSourceFile(path);
			if (!source) throw new Error(`cannot read the TypeScript AST for layout preservation: ${path}`);
			const diagnostics = (await project.program.getSyntacticDiagnostics(path)).map(diagnostic => diagnostic.code).sort((left, right) => left - right);
			return { diagnostics, structure: structureOf(source) };
		};
		return [await parse(beforePath), await parse(afterPath)];
	} finally {
		await api.close();
	}
}

/**
 * Compares a proposed TypeScript layout edit using exact non-linebreak tokens and the real project parser.
 * Temporary sibling files preserve extension-sensitive meanings such as `.d.ts`, `.mts` and `.tsx`.
 */
export async function compareTypeScriptLayout(root: string, target: string, before: string, after: string): Promise<LayoutPreservationResult> {
	if (!preservesTokensWithBreaks(before, after)) return { status: "tokens-changed", reason: "token or comment bytes changed" };

	const path       = repositoryFile(root, target).absolute                               ;
	const directory  = dirname(path)                                                       ;
	const nonce      = `${process.pid}.${randomUUID()}`                                    ;
	const beforePath = join(directory, `.boxbox-layout.before.${nonce}.${basename(path)}`) ;
	const afterPath  = join(directory, `.boxbox-layout.after.${nonce}.${basename(path)}` ) ;
	try {
		writeFileSync(beforePath, before);
		writeFileSync(afterPath , after );
		const [left, right] = await parseLayouts(root, beforePath, afterPath);
		if (!same(left.diagnostics, right.diagnostics)) return { status: "parse-changed", reason: "TypeScript syntactic diagnostics changed" };
		if (!same(left.structure, right.structure)) return { status: "structure-changed", reason: "TypeScript AST structure changed" };
		return { status: "preserved", reason: "tokens, comments, diagnostics and AST structure preserved" };
	} finally {
		if (existsSync(beforePath)) unlinkSync(beforePath);
		if (existsSync(afterPath )) unlinkSync(afterPath );
	}
}
