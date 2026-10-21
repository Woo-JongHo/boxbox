#!/usr/bin/env bun
/**
 * STEP7: Wraps logical chains (&&, ||) listing four or more conditions on one physical line into the
 * multi-line form of rule 38 (operators at line start). Only line breaks are inserted, so operators,
 * parentheses and evaluation order are unchanged. Chains inside table rows (registration-object arrows, ...)
 * and chains already spanning lines are excluded — cases that would break a table or need structural
 * judgment are fixed by a person under rule 38.
 */
import type { Node, SourceFile } from "typescript/unstable/ast"          ;

import      { syntaxKindName   } from "@/typescript/grid-kinds.ts"       ;
import      { loadSourceFile   } from "@/typescript/load-source-file.ts" ;

function operatorOf(node: Node, source: SourceFile): string | undefined {
	if (syntaxKindName(node) !== "BinaryExpression") return undefined;
	const token = (node as unknown as { operatorToken: Node }).operatorToken ;
	const text  = source.text.slice(token.getStart(source), token.getEnd())  ;
	return text === "&&" || text === "||" ? text : undefined;
}

function unwrap(node: Node): Node {
	let current = node;
	while (syntaxKindName(current) === "ParenthesizedExpression") current = (current as unknown as { expression: Node }).expression;
	return current;
}

function collectOperands(node: Node, source: SourceFile, op: string): Node[] {
	const out: Node[] = [];
	const walk = (current: Node): void => {
		const inner = unwrap(current);
		if (operatorOf(inner, source) === op) {
			const binary = inner as unknown as { left: Node; right: Node };
			walk(binary.left);
			walk(binary.right);
		} else out.push(current);
	};
	walk(node);
	return out;
}

function lineIndent(source: SourceFile, position: number): string {
	const lineStart = source.getPositionOfLineAndCharacter(source.getLineAndCharacterOfPosition(position).line, 0);
	return /^[ \t]*/u.exec(source.text.slice(lineStart, position))?.[0] ?? "";
}

function parentKind(parent: Node, grandparent: Node): "if" | "return" | "variable" | "expression" | undefined {
	const parentName = syntaxKindName(parent     ) ;
	const grandName  = syntaxKindName(grandparent) ;
	if (parentName === "IfStatement")                                                                                           return "if";
	if (parentName === "ReturnStatement")                                                                                       return "return";
	if (parentName === "VariableDeclaration" && (grandName === "VariableStatement" || grandName === "VariableDeclarationList")) return "variable";
	if (parentName === "VariableStatement")                                                                                     return "variable";
	if (parentName === "ExpressionStatement")                                                                                   return "expression";
	return undefined;
}

interface Wrap {
	readonly start : number ;
	readonly end   : number ;
	readonly text  : string ;
}

function collectWraps(node: Node, source: SourceFile, minOperands: number, wraps: Wrap[], skipped: string[], parent?: Node, grandparent?: Node): void {
	const op = operatorOf(node, source);
	if (op !== undefined && parent !== undefined && operatorOf(parent, source) !== op) {
		const operands   = collectOperands(node, source, op)                                                                                                 ;
		const singleLine = source.getLineAndCharacterOfPosition(node.getStart(source)).line === source.getLineAndCharacterOfPosition(node.getEnd() - 1).line ;
		const parentForm = parentKind(parent, grandparent ?? parent)                                                                                         ;
		if (process.env.DEBUG_WRAP) console.error(`DBG op=${op} operands=${operands.length} parent=${syntaxKindName(parent)} grand=${syntaxKindName(grandparent ?? parent)} parentForm=${parentForm ?? "undefined"}`);
		if (operands.length >= minOperands && singleLine && parentForm !== undefined) {
			const base   = lineIndent(source, node.getStart(source))    ;
			const indent = /\t/u.test(base) ? base + "\t" : base + "  " ;
			const lead   = parentForm === "if" ? "" : indent            ;
			const lines = operands.map((operand, index) => {
				const text = source.text.slice(operand.getStart(source), operand.getEnd());
				return index === 0 ? `${lead}${text}` : `${indent}${op} ${text}`;
			});
			const body = lines.join("\n")                                                                         ;
			const text = parentForm === "if" ? body : `(\n${body}\n${lineIndent(source, node.getStart(source))})` ;
			wraps.push({ start: node.getStart(source), end: node.getEnd(), text });
		} else if (operands.length >= minOperands && singleLine) {
			skipped.push(`line=${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1} parent=${parentForm ?? "table row/other"}`);
		}
	}
	node.forEachChild(child => { collectWraps(child, source, minOperands, wraps, skipped, node, parent); return undefined; });
}

function applyWraps(text: string, wraps: readonly Wrap[]): string {
	let result = text;
	for (const wrap of [...wraps].sort((left, right) => right.start - left.start)) result = `${result.slice(0, wrap.start)}${wrap.text}${result.slice(wrap.end)}`;
	return result;
}

interface Arguments {
	readonly file        : string  ;
	readonly write       : boolean ;
	readonly minOperands : number  ;
}

function parseArguments(): Arguments {
	const raw           = process.argv.slice(2)                        ;
	const write         = raw.includes("--write")                      ;
	const minIndex      = raw.indexOf("--min-conditions")              ;
	const minConditions = minIndex < 0 ? 4 : Number(raw[minIndex + 1]) ;
	const minOperands   = minConditions                                ;
	if (raw[0] !== "--file" || !raw[1] || !Number.isInteger(minConditions) || minConditions < 3) {
		throw new Error("usage: 07_wrap-conditions.ts --file <repository TypeScript file> [--write] [--min-conditions 4]");
	}
	return { file: raw[1], write, minOperands };
}

async function main(): Promise<void> {
	const root = process.cwd();
	const { file, write, minOperands } = parseArguments();
	const { source, relative } = await loadSourceFile(root, file);

	const wraps   : Wrap[]   = [] ;
	const skipped : string[] = [] ;
	collectWraps(source, source, minOperands, wraps, skipped, undefined, undefined);

	console.log(`wrap-conditions file=${relative} chains=${wraps.length} skipped=${skipped.length}${write ? " write=true" : ""}`);
	for (const skip of skipped.slice(0, 5)) console.log(`  skip ${skip}`);
	if (write && wraps.length > 0) {
		await Bun.write(`${root}/${relative}`, applyWraps(source.text, wraps));
	}
	if (!write && wraps.length > 0) process.exit(1);
}

try {
	await main();
	process.exit(0);
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
}
