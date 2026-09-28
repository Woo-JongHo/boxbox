#!/usr/bin/env bun
/**
 * STEP8: Checks drift between the function map (GROUP | FUNCTION | INPUT | RETURN | CALLS | ROLE)
 * and the actual declarations. FUNCTION must map 1:1 to declarations in the file, the INPUT count must
 * match the parameter count, and names listed in CALLS must exist in the file. --scaffold scans the
 * declarations and prints a map skeleton with only GROUP and ROLE left empty to stdout.
 */
import      {
              isArrowFunction       ,
              isFunctionDeclaration ,
              isFunctionExpression  ,
              isVariableStatement   ,
                                      } from "typescript/unstable/ast"    ;
import type { Node, SourceFile        } from "typescript/unstable/ast"    ;

import      { displayWidth            } from "../common/display-width.ts" ;
import      { loadSourceFile          } from "./load-source-file.ts"      ;

interface MapRow {
	readonly line : number;
	readonly cells: readonly string[];
}

interface Declaration {
	readonly name   : string ;
	readonly params : number ;
	readonly line   : number ;
}

const HEADER = /GROUP\s*\|\s*FUNCTION\s*\|\s*INPUT\s*\|\s*RETURN\s*\|\s*CALLS\s*\|\s*ROLE/u;

const MAP_COLUMNS = ["GROUP", "FUNCTION", "INPUT", "RETURN", "CALLS", "ROLE"] as const;

interface ParsedMap {
	readonly headerLine : number            ;
	readonly rows       : readonly MapRow[] ;
	readonly lines      : readonly string[] ;
}

function parseMap(source: SourceFile): ParsedMap {
	const lines          = source.text.split("\n") ;
	const rows: MapRow[] = []                      ;
	let headerLine       = -1                      ;
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index]!.trim();
		if (headerLine < 0) {
			if (line.startsWith("//") && HEADER.test(line)) headerLine = index;
			continue;
		}
		if (!line.startsWith("//")) break;
		const cells = line.replace(/^\/\/\s*/u, "").split("|").map(cell => cell.trim());
		if (cells.length < 6) break;
		rows.push({ line: index, cells: cells.slice(0, 6) });
	}
	return { headerLine, rows, lines };
}

function alignedMapLines(rows: readonly MapRow[]): readonly string[] {
	const widths = MAP_COLUMNS.map((column, index) => Math.max(displayWidth(column), ...rows.map(row => displayWidth(row.cells[index] ?? ""))));
	const render = (cells: readonly string[]): string => "// " + cells.map((cell, index) => index === MAP_COLUMNS.length - 1 ? cell : cell + " ".repeat(Math.max(0, widths[index]! - displayWidth(cell)))).join(" | ");
	return [render([...MAP_COLUMNS]), ...rows.map(row => render(row.cells))];
}

function collectDeclarations(node: Node, source: SourceFile, out: Map<string, Declaration>): void {
	let name: string | undefined;
	let params: Node[] | undefined;
	if (isFunctionDeclaration(node) && node.name) {
		name = node.name.text;
		params = [...node.parameters];
	} else if (isVariableStatement(node)) {
		const declaration = node.declarationList.declarations[0];
		const initializer = declaration?.initializer;
		if (declaration && initializer && (isArrowFunction(initializer) || isFunctionExpression(initializer))) {
			name = declaration.name.getText(source);
			params = [...initializer.parameters];
		}
	}
	if (name && params) {
		const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
		out.set(name, { name, params: params.length, line });
	}
	node.forEachChild(child => { collectDeclarations(child, source, out); return undefined; });
}

async function main(): Promise<void> {
	const root      = process.cwd()              ;
	const raw       = process.argv.slice(2)      ;
	const scaffold  = raw.includes("--scaffold") ;
	const write     = raw.includes("--write")    ;
	const fileIndex = raw.indexOf("--file")      ;
	if (raw[0] !== "--file" || !raw[1]) throw new Error("usage: 08_function-map.ts --file <repository TypeScript file> [--check|--scaffold]");
	const { source, relative } = await loadSourceFile(root, raw[1]);

	const declarations = new Map<string, Declaration>();
	collectDeclarations(source, source, declarations);

	if (scaffold) {
		const width = Math.max(...[...declarations.keys()].map(name => name.length), 8);
		console.log(`// GROUP     | FUNCTION${" ".repeat(Math.max(0, width - 8))} | INPUT | RETURN | CALLS | ROLE`);
		for (const declaration of declarations.values()) {
			const pad = " ".repeat(Math.max(0, width - declaration.name.length));
			const inputs = `${declaration.params} param(s)`;
			console.log(`// TODO      | ${declaration.name}${pad} | ${inputs} | TODO   | TODO  | TODO`);
		}
		process.exit(0);
	}

	const parsed           = parseMap(source)                                                                   ;
	const rows             = parsed.rows                                                                        ;
	const expected         = alignedMapLines(rows)                                                              ;
	const mapMisaligned    = rows.filter((row, index) => parsed.lines[row.line] !== expected[index + 1]).length ;
	const errors: string[] = []                                                                                 ;
	for (const row of rows) {
		const name        = row.cells[1]!                                                                                        ;
		const inputs      = row.cells[2]!.split(",").map(value => value.trim()).filter(value => Boolean(value) && value !== "-") ;
		const calls       = row.cells[4]!.split(",").map(value => value.trim()).filter(value => Boolean(value) && value !== "-") ;
		const declaration = declarations.get(name)                                                                               ;
		if (!declaration) {
			errors.push(`map line=${row.line + 1}: no declaration: ${name}`);
			continue;
		}
		if (declaration.params !== inputs.length) {
			errors.push(`map line=${row.line + 1}: ${name} INPUT ${inputs.length} != declared parameters ${declaration.params}`);
		}
		for (const call of calls) {
			if (!declarations.has(call) && !source.text.includes(call)) {
				errors.push(`map line=${row.line + 1}: CALLS target not found: ${call}`);
			}
		}
	}
	const mapped = rows.map(row => row.cells[1]);
	const undeclared = [...declarations.keys()].filter(name => !mapped.includes(name));
	console.log(`function-map file=${relative} map-entries=${rows.length} declarations=${declarations.size} undeclared=${undeclared.length} errors=${errors.length} map-misaligned=${mapMisaligned}${write ? " write=true" : ""}`);
	for (const error of errors) console.log(`  ${error}`);
	if (undeclared.length > 0) console.log(`  declarations missing from the map: ${undeclared.join(", ")}`);
	if (write && mapMisaligned > 0) {
		const lines = [...parsed.lines];
		for (const [index, line] of expected.entries()) lines[parsed.headerLine + index] = line;
		await Bun.write(`${root}/${relative}`, lines.join("\n"));
	}
	if (errors.length > 0) process.exit(1);
	if (!write && mapMisaligned > 0) process.exit(1);
}

try {
	await main();
	process.exit(0);
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
}
