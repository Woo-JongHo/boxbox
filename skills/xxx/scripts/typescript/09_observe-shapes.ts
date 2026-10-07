#!/usr/bin/env bun
import      { createHash                                         } from "node:crypto"               ;
import      {
              closeSync                                        ,
              existsSync                                       ,
              lstatSync                                        ,
              mkdirSync                                        ,
              openSync                                         ,
              readFileSync                                     ,
              realpathSync                                     ,
              renameSync                                       ,
              statSync                                         ,
              unlinkSync                                       ,
              writeFileSync                                    ,
                                                                 } from "node:fs"                   ;
import      { join, relative, resolve                            } from "node:path"                 ;

import      { API                                                } from "typescript/unstable/async" ;
import      { SyntaxKind, isArrowFunction, isFunctionDeclaration } from "typescript/unstable/ast"   ;
import type { FunctionDeclaration, Node, SourceFile, Statement   } from "typescript/unstable/ast"   ;
import      { version as typescriptVersion                       } from "typescript"                ;

import type { Pattern                                            } from "../common/grammar-ids.ts"  ;
import      { repositoryFile                                     } from "./load-source-file.ts"     ;

export const SHAPE_SCHEMA_VERSION    = "1"                                              ;
export const SHAPE_EXTRACTOR_VERSION = "obs1-ts-fn"                                     ;
export const SHAPE_PARSER_VERSION    = `typescript-${typescriptVersion}-unstable-async` ;
export const SHAPE_PROFILE_VERSION   = "ts-direct-statements-v1"                        ;

const MAX_FILES = 1_000            ;
const MAX_BYTES = 16 * 1024 * 1024 ;

type Fingerprint = string | "unknown";
type Classification = Pattern | "unknown" | "notApplicable";

export interface ObservationFingerprints {
	readonly rule      ? : Fingerprint ;
	readonly config    ? : Fingerprint ;
	readonly preset    ? : Fingerprint ;
	readonly formatter ? : Fingerprint ;
}

export interface ObserveShapesOptions {
	readonly root            : string                  ;
	readonly files           : readonly string[]       ;
	readonly fingerprints ?  : ObservationFingerprints ;
	readonly writeCache    ? : boolean                 ;
}

export interface ShapeSegment {
	readonly classification : Classification ;
	readonly count          : number         ;
	readonly start          : number         ;
	readonly end            : number         ;
}

export interface ShapeUnitRecord {
	readonly recordType   : "unit"                  ;
	readonly id           : string                  ;
	readonly parentUnitId : string | null           ;
	readonly file         : string                  ;
	readonly displayName  : string                  ;
	readonly start        : number                  ;
	readonly end          : number                  ;
	readonly startLine    : number                  ;
	readonly startColumn  : number                  ;
	readonly sourceHash   : string                  ;
	readonly shapeHash    : string                  ;
	readonly segments     : readonly ShapeSegment[] ;
}

export interface ShapeFileRecord {
	readonly recordType             : "file"                        ;
	readonly path                   : string                        ;
	readonly sourceHash             : string                        ;
	readonly bytes                  : number                        ;
	readonly units                  : number                        ;
	readonly unsupportedArrows      : number                        ;
	readonly unsupportedNoBody      : number                        ;
	readonly status                 : "ok" | "malformed" | "failed" ;
	readonly error                ? : string                        ;
}

export interface ShapeHeaderRecord {
	readonly recordType          : "header"                                                                                                                                                              ;
	readonly schemaVersion       : string                                                                                                                                                                ;
	readonly extractorVersion    : string                                                                                                                                                                ;
	readonly parserVersion       : string                                                                                                                                                                ;
	readonly profileVersion      : string                                                                                                                                                                ;
	readonly phase               : "original"                                                                                                                                                            ;
	readonly fingerprints        : Required<ObservationFingerprints>                                                                                                                                     ;
	readonly scope               : { readonly root: "."; readonly files: readonly string[] }                                                                                                             ;
	readonly completion          : { readonly complete: boolean; readonly requested: number; readonly succeeded: number; readonly failed: number; readonly unsupported: number; readonly units: number } ;
	readonly snapshotFingerprint : string                                                                                                                                                                ;
}

export interface ShapeObservation {
	readonly header : ShapeHeaderRecord          ;
	readonly files  : readonly ShapeFileRecord[] ;
	readonly units  : readonly ShapeUnitRecord[] ;
	readonly jsonl  : string                     ;
}

const hash = (value: string): string => `sha256:${createHash("sha256").update(value).digest("hex")}`;

function classificationOf(statement: Statement, source: SourceFile): Classification {
	switch (statement.kind) {
		case SyntaxKind.ImportDeclaration:
		case SyntaxKind.ImportEqualsDeclaration:
			return "IMPORT";
		case SyntaxKind.VariableStatement   :
		case SyntaxKind.FunctionDeclaration :
		case SyntaxKind.ClassDeclaration    :
		case SyntaxKind.InterfaceDeclaration:
		case SyntaxKind.TypeAliasDeclaration:
		case SyntaxKind.EnumDeclaration:
			return "DEFINE";
		case SyntaxKind.ReturnStatement:
		case SyntaxKind.ThrowStatement:
			return "EXIT";
		case SyntaxKind.ExpressionStatement: {
			const expression = (statement as Statement & { readonly expression: Node }).expression;
			if (expression.kind === SyntaxKind.CallExpression || expression.kind === SyntaxKind.NewExpression || expression.kind === SyntaxKind.AwaitExpression) return "DO";
			if (expression.kind === SyntaxKind.PostfixUnaryExpression || expression.kind === SyntaxKind.PrefixUnaryExpression) {
				const operator = (expression as Node & { readonly operator: SyntaxKind }).operator;
				return operator === SyntaxKind.PlusPlusToken || operator === SyntaxKind.MinusMinusToken ? "CHANGE" : "unknown";
			}
			if (expression.kind === SyntaxKind.BinaryExpression) {
				const operator    = (expression as Node & { readonly operatorToken: { readonly kind: SyntaxKind } }).operatorToken.kind                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    ;
				const assignments = new Set([SyntaxKind.EqualsToken, SyntaxKind.PlusEqualsToken, SyntaxKind.MinusEqualsToken, SyntaxKind.AsteriskEqualsToken, SyntaxKind.SlashEqualsToken, SyntaxKind.PercentEqualsToken, SyntaxKind.AmpersandEqualsToken, SyntaxKind.BarEqualsToken, SyntaxKind.CaretEqualsToken, SyntaxKind.LessThanLessThanEqualsToken, SyntaxKind.GreaterThanGreaterThanEqualsToken, SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken, SyntaxKind.AsteriskAsteriskEqualsToken, SyntaxKind.AmpersandAmpersandEqualsToken, SyntaxKind.BarBarEqualsToken, SyntaxKind.QuestionQuestionEqualsToken]) ;
				return assignments.has(operator) ? "CHANGE" : "unknown";
			}
			return "unknown";
		}
		case SyntaxKind.EmptyStatement:
		case SyntaxKind.DebuggerStatement:
			return "notApplicable";
		default:
			return "unknown";
	}
}

function segmentsOf(node: FunctionDeclaration, source: SourceFile): readonly ShapeSegment[] {
	const segments: ShapeSegment[] = [];
	for (const statement of node.body?.statements ?? []) {
		const classification = classificationOf(statement, source) ;
		const previous       = segments.at(-1)                     ;
		if (previous?.classification === classification) {
			segments[segments.length - 1] = { ...previous, count: previous.count + 1, end: statement.getEnd() };
		} else {
			segments.push({ classification, count: 1, start: statement.getStart(source), end: statement.getEnd() });
		}
	}
	return segments;
}

function collectUnits(source: SourceFile, file: string): { readonly units: ShapeUnitRecord[]; readonly arrows: number; readonly noBody: number } {
	const units: ShapeUnitRecord[] = [] ;
	let arrows                     = 0  ;
	let noBody                     = 0  ;
	let ordinal                    = 0  ;
	const visit = (node: Node, parentUnitId: string | null): void => {
		if (isArrowFunction(node)) arrows += 1;
		let childParent = parentUnitId;
		if (isFunctionDeclaration(node) && node.name) {
			if (!node.body) noBody += 1;
			else {
				ordinal += 1;
				const id       = `${hash(file).slice(7, 19)}:u${String(ordinal).padStart(6, "0")}` ;
				const start    = node.getStart(source)                                             ;
				const end      = node.getEnd()                                                     ;
				const location = source.getLineAndCharacterOfPosition(start)                       ;
				const segments = segmentsOf(node, source)                                          ;
				units.push({
					recordType: "unit", id, parentUnitId, file, displayName: node.name.text,
					start, end, startLine: location.line + 1, startColumn: location.character + 1,
					sourceHash: hash(source.text.slice(start, end)), shapeHash: hash(JSON.stringify(segments.map(({ classification, count }) => ({ classification, count })))), segments,
				});
				childParent = id;
			}
		}
		node.forEachChild(child => { visit(child, childParent); return undefined; });
	};
	visit(source, null);
	return { units, arrows, noBody };
}

function fullFingerprints(value: ObservationFingerprints | undefined): Required<ObservationFingerprints> {
	return { rule: value?.rule ?? "unknown", config: value?.config ?? "unknown", preset: value?.preset ?? "unknown", formatter: value?.formatter ?? "unknown" };
}

function serialize(header: ShapeHeaderRecord, files: readonly ShapeFileRecord[], units: readonly ShapeUnitRecord[]): string {
	return [header, ...files, ...units].map(record => JSON.stringify(record)).join("\n") + "\n";
}

async function parseFile(root: string, absolute: string): Promise<{ readonly source: SourceFile; readonly diagnostics: readonly string[] }> {
	const api = new API({ cwd: root });
	try {
		const state   = await api.updateSnapshot({ openFiles: [absolute] }) ;
		const project = await state.getDefaultProjectForFile(absolute)      ;
		if (!project) throw new Error(`cannot find a TypeScript project: ${absolute}`);
		const source = await project.program.getSourceFile(absolute);
		if (!source) throw new Error(`cannot read the TypeScript source AST: ${absolute}`);
		const found       = await project.program.getSyntacticDiagnostics(absolute)                                                               ;
		const diagnostics = found.map(diagnostic => `${source.getLineAndCharacterOfPosition(diagnostic.pos).line + 1}:${diagnostic.code}`).sort() ;
		return { source, diagnostics };
	} finally {
		await api.close();
	}
}

function ensureSafeCacheDirectory(root: string): string {
	let current = realpathSync(root);
	for (const part of [".xxx", "cache"]) {
		current = join(current, part);
		if (existsSync(current)) {
			if (lstatSync(current).isSymbolicLink() || !statSync(current).isDirectory()) throw new Error(`cache path component is not a real directory: ${current}`);
		} else {
			try { mkdirSync(current); }
			catch (error) { if (!existsSync(current) || lstatSync(current).isSymbolicLink() || !statSync(current).isDirectory()) throw error; }
		}
	}
	const ignore = join(current, ".gitignore");
	if (existsSync(ignore) && lstatSync(ignore).isSymbolicLink()) throw new Error(`cache ignore file must not be a symbolic link: ${ignore}`);
	if (!existsSync(ignore)) writeFileSync(ignore, "*\n", { flag: "wx", mode: 0o600 });
	return current;
}

function writeCompleteCache(root: string, jsonl: string): void {
	if (Buffer.byteLength(jsonl) > MAX_BYTES) throw new Error(`shape snapshot exceeds ${MAX_BYTES} bytes`);
	const directory = ensureSafeCacheDirectory(root)                                      ;
	const current   = join(directory, "shape.jsonl")                                      ;
	const previous  = join(directory, "shape.previous.jsonl")                             ;
	const lock      = join(directory, "shape.lock")                                       ;
	const temporary = join(directory, `.shape.${process.pid}.${crypto.randomUUID()}.tmp`) ;
	for (const path of [current, previous]) if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error(`cache target must not be a symbolic link: ${path}`);
	let lockDescriptor: number;
	try {
		lockDescriptor = openSync(lock, "wx", 0o600);
	} catch (error) {
		throw new Error(`shape cache is locked by another writer: ${error instanceof Error ? error.message : String(error)}`);
	}
	try {
		if (existsSync(current) && readFileSync(current, "utf8") === jsonl) return;
		const descriptor = openSync(temporary, "wx", 0o600);
		try {
			writeFileSync(descriptor, jsonl, "utf8");
		} finally {
			closeSync(descriptor);
		}
		let movedCurrent = false;
		try {
			if (existsSync(previous)) unlinkSync(previous);
			if (existsSync(current)) { renameSync(current, previous); movedCurrent = true; }
			renameSync(temporary, current);
		} catch (error) {
			if (existsSync(temporary)) unlinkSync(temporary);
			if (movedCurrent && !existsSync(current) && existsSync(previous)) renameSync(previous, current);
			throw error;
		}
	} finally {
		closeSync(lockDescriptor);
		if (existsSync(lock)) unlinkSync(lock);
	}
}

export async function observeShapes(options: ObserveShapesOptions): Promise<ShapeObservation> {
	const root = realpathSync(resolve(options.root));
	if (options.files.length === 0) throw new Error("at least one --file is required");
	if (options.files.length > MAX_FILES) throw new Error(`shape scan supports at most ${MAX_FILES} files`);
	const targets = [...new Map(options.files.map(value => {
		const absolute = resolve(root, value)                           ;
		const path     = relative(root, absolute).replaceAll("\\", "/") ;
		if (!path || path === ".." || path.startsWith("../")) throw new Error(`target must be a file inside the repository: ${value}`);
		try {
			const target = repositoryFile(root, value);
			if (!/\.[cm]?tsx?$/u.test(path)) return [path, { absolute, relative: path, error: `target must be a TypeScript file: ${value}` }] as const;
			return [path, target] as const;
		} catch (error) {
			return [path, { absolute, relative: path, error: error instanceof Error ? error.message : String(error) }] as const;
		}
	})).values()].sort((left, right) => left.relative.localeCompare(right.relative));
	if (options.writeCache !== false) ensureSafeCacheDirectory(root);
	const files : ShapeFileRecord[] = [] ;
	const units : ShapeUnitRecord[] = [] ;
	for (const target of targets) {
		if ("error" in target) {
			files.push({ recordType: "file", path: target.relative, sourceHash: "unknown", bytes: 0, units: 0, unsupportedArrows: 0, unsupportedNoBody: 0, status: "failed", error: String(target.error) });
			continue;
		}
		try {
			if (statSync(target.absolute).size > MAX_BYTES) throw new Error(`source file exceeds ${MAX_BYTES} bytes: ${target.relative}`);
			const parsed = await parseFile(root, target.absolute) ;
			const text   = parsed.source.text                     ;
			if (Buffer.byteLength(text) > MAX_BYTES) throw new Error(`source file exceeds ${MAX_BYTES} bytes: ${target.relative}`);
			if (readFileSync(target.absolute, "utf8") !== text) throw new Error(`source changed during scan: ${target.relative}`);
			if (parsed.diagnostics.length > 0) {
				files.push({ recordType: "file", path: target.relative, sourceHash: hash(text), bytes: Buffer.byteLength(text), units: 0, unsupportedArrows: 0, unsupportedNoBody: 0, status: "malformed", error: parsed.diagnostics.join(",") });
				continue;
			}
			const found = collectUnits(parsed.source, target.relative);
			units.push(...found.units);
			files.push({ recordType: "file", path: target.relative, sourceHash: hash(text), bytes: Buffer.byteLength(text), units: found.units.length, unsupportedArrows: found.arrows, unsupportedNoBody: found.noBody, status: "ok" });
		} catch (error) {
			files.push({ recordType: "file", path: target.relative, sourceHash: "unknown", bytes: 0, units: 0, unsupportedArrows: 0, unsupportedNoBody: 0, status: "failed", error: error instanceof Error ? error.message : String(error) });
		}
	}
	const failed              = files.filter(file => file.status !== "ok").length                                                                                                                                                                                                                                                                                                   ;
	const unsupported         = files.reduce((total, file) => total + file.unsupportedArrows + file.unsupportedNoBody, 0)                                                                                                                                                                                                                                                           ;
	const snapshotFingerprint = hash(JSON.stringify({ schemaVersion: SHAPE_SCHEMA_VERSION, extractorVersion: SHAPE_EXTRACTOR_VERSION, parserVersion: SHAPE_PARSER_VERSION, profileVersion: SHAPE_PROFILE_VERSION, fingerprints: fullFingerprints(options.fingerprints), scope: targets.map(target => target.relative), sources: files.map(file => [file.path, file.sourceHash]) })) ;
	const header: ShapeHeaderRecord = {
		recordType: "header", schemaVersion: SHAPE_SCHEMA_VERSION, extractorVersion: SHAPE_EXTRACTOR_VERSION,
		parserVersion: SHAPE_PARSER_VERSION, profileVersion: SHAPE_PROFILE_VERSION, phase: "original",
		fingerprints: fullFingerprints(options.fingerprints), scope: { root: ".", files: targets.map(target => target.relative) },
		completion: { complete: failed === 0, requested: targets.length, succeeded: targets.length - failed, failed, unsupported, units: units.length },
		snapshotFingerprint,
	};
	const jsonl = serialize(header, files, units);
	if (options.writeCache !== false && header.completion.complete) writeCompleteCache(root, jsonl);
	return { header, files, units, jsonl };
}

function argumentsOf(argv: readonly string[]): ObserveShapesOptions {
	let root              = process.cwd() ;
	const files: string[] = []            ;
	for (let index = 0; index < argv.length; index += 1) {
		const option = argv[index    ] ;
		const value  = argv[index + 1] ;
		if ((option === "--file" || option === "--root") && (!value || value.startsWith("--"))) throw new Error(`${option} requires a value`);
		if (option === "--file") { files.push(value!); index += 1; }
		else if (option === "--root") { root = value!; index += 1; }
		else throw new Error(`unknown option: ${option}`);
	}
	return { root, files };
}

async function main(): Promise<void> {
	const result      = await observeShapes(argumentsOf(process.argv.slice(2)))                                                                                                                                                ;
	const frequencies = new Map(result.units.map(unit => [unit.shapeHash, result.units.filter(candidate => candidate.shapeHash === unit.shapeHash).length]))                                                                   ;
	const classified  = result.units.flatMap(unit => unit.segments).filter(segment => segment.classification !== "unknown" && segment.classification !== "notApplicable").reduce((total, segment) => total + segment.count, 0) ;
	const statements  = result.units.flatMap(unit => unit.segments).reduce((total, segment) => total + segment.count, 0)                                                                                                       ;
	console.log(JSON.stringify({ ...result.header, coverage: { classified, statements, ratio: statements === 0 ? 0 : classified / statements }, files: result.files.filter(file => file.status !== "ok"), frequencies: [...frequencies].sort((left, right) => right[1] - left[1]), representatives: [...new Map(result.units.map(unit => [unit.shapeHash, { file: unit.file, line: unit.startLine, name: unit.displayName }])).entries()] }));
	if (!result.header.completion.complete) process.exitCode = 1;
}

if (import.meta.main) main().catch(error => {
	console.log(JSON.stringify({ recordType: "header", phase: "original", completion: { complete: false }, error: error instanceof Error ? error.message : String(error) }));
	process.exitCode = 1;
});
