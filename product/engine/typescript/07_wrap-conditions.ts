#!/usr/bin/env bun
/**
 * STEP7: Authors the leading-operator form for supported homogeneous logical chains. This is a structural
 * authoring command, not the public horizontal-only aligner. Every write keeps the original tokens, comments,
 * parentheses and AST structure, and unsupported contexts are reported without touching the file.
 */
import type { Node, SourceFile        } from "typescript/unstable/ast"             ;

import      { displayWidth            } from "@/common/display-width.ts"           ;
import      { updateFileAtomically    } from "@/common/safe-file.ts"               ;
import      { syntaxKindName          } from "@/typescript/grid-kinds.ts"          ;
import      { compareTypeScriptLayout } from "@/typescript/layout-preservation.ts" ;
import      { loadSourceFile          } from "@/typescript/load-source-file.ts"    ;

interface LogicalParts {
	readonly operands  : readonly Node[] ;
	readonly operators : readonly Node[] ;
}

interface Wrap {
	readonly start : number ;
	readonly end   : number ;
	readonly text  : string ;
}

interface Refusal {
	readonly line   : number ;
	readonly reason : string ;
}

interface IfEnvelope {
	readonly start          : number ;
	readonly end            : number ;
	readonly leadingBreaks  : number ;
	readonly trailingBreaks : number ;
	readonly closeIndent    : string ;
}

type ParentForm = "if" | "return" | "variable" | "expression";

function operatorOf(node: Node, source: SourceFile): string | undefined {
	if (syntaxKindName(node) !== "BinaryExpression") return undefined;
	const token = (node as unknown as { operatorToken: Node }).operatorToken ;
	const text  = source.text.slice(token.getStart(source), token.getEnd())  ;
	return text === "&&" || text === "||" ? text : undefined;
}

function logicalParts(node: Node, source: SourceFile, operator: string): LogicalParts {
	const operands  : Node[] = [] ;
	const operators : Node[] = [] ;
	const visit = (current: Node): void => {
		if (operatorOf(current, source) !== operator) {
			operands.push(current);
			return;
		}
		const binary = current as unknown as { left: Node; operatorToken: Node; right: Node };
		visit(binary.left);
		operators.push(binary.operatorToken);
		visit(binary.right);
	};
	visit(node);
	return { operands, operators };
}

function logicalLeafCount(node: Node, source: SourceFile): number {
	if (operatorOf(node, source) === undefined) return 1;
	const binary = node as unknown as { left: Node; right: Node };
	return logicalLeafCount(binary.left, source) + logicalLeafCount(binary.right, source);
}

function hasMixedLogicalOperator(node: Node, source: SourceFile, operator: string): boolean {
	let mixed = false;
	const visit = (current: Node): void => {
		if (current !== node && syntaxKindName(current) === "ParenthesizedExpression") return;
		const found = operatorOf(current, source);
		if (found !== undefined && found !== operator) mixed = true;
		current.forEachChild(child => { visit(child); return undefined; });
	};
	visit(node);
	return mixed;
}

function parentForm(ancestors: readonly Node[]): ParentForm | undefined {
	for (let index = ancestors.length - 1; index >= 0; index -= 1) {
		const name = syntaxKindName(ancestors[index]!);
		if (name === "ParenthesizedExpression") continue;
		if (name === "IfStatement"        ) return "if"         ;
		if (name === "ReturnStatement"    ) return "return"     ;
		if (name === "VariableDeclaration") return "variable"   ;
		if (name === "ExpressionStatement") return "expression" ;
		return undefined;
	}
	return undefined;
}

function indentation(source: SourceFile, position: number): { readonly base: string; readonly continuation: string } {
	const line      = source.getLineAndCharacterOfPosition(position).line    ;
	const lineStart = source.getPositionOfLineAndCharacter(line, 0)          ;
	const prefix    = source.text.slice(lineStart, position)                 ;
	const base      = /^[ \t]*/u.exec(prefix)?.[0] ?? ""                     ;
	const padding   = Math.max(0, displayWidth(prefix) - displayWidth(base)) ;
	return { base, continuation: `${base}${" ".repeat(padding)}` };
}

function lineIndentation(source: SourceFile, position: number): string {
	const line      = source.getLineAndCharacterOfPosition(position).line ;
	const lineStart = source.getPositionOfLineAndCharacter(line, 0)       ;
	return /^[ \t]*/u.exec(source.text.slice(lineStart, position))?.[0] ?? "";
}

function lineBreakCount(text: string): number {
	return text.match(/\r\n|\r|\n/gu)?.length ?? 0;
}

function ifEnvelope(node: Node, source: SourceFile, ancestors: readonly Node[]): IfEnvelope | undefined {
	const statement = [...ancestors].reverse().find(ancestor => syntaxKindName(ancestor) === "IfStatement");
	if (statement === undefined)                                                                   return undefined;
	const open  = source.text.lastIndexOf("(", node.getStart(source)) ;
	const close = source.text.indexOf    (")", node.getEnd()        ) ;
	if (open < statement.getStart(source) || close < node.getEnd() || close >= statement.getEnd()) return undefined;
	const leading  = source.text.slice(open + 1     , node.getStart(source)) ;
	const trailing = source.text.slice(node.getEnd(), close                ) ;
	if (!/^[ \t\r\n]*$/u.test(leading) || !/^[ \t\r\n]*$/u.test(trailing))                         return undefined;
	return {
		start          : open + 1                                            ,
		end            : close                                               ,
		leadingBreaks  : Math.max(1, lineBreakCount(leading ))               ,
		trailingBreaks : Math.max(1, lineBreakCount(trailing))               ,
		closeIndent    : lineIndentation(source, statement.getStart(source)) ,
	};
}

function triviaComments(text: string): readonly string[] | undefined {
	if (text.includes("//")) return undefined;
	const comments = [...text.matchAll(/\/\*[\s\S]*?\*\//gu)].map(match => match[0]);
	if (comments.some(comment => /[\r\n]/u.test(comment))) return undefined;
	const rest = text.replace(/\/\*[\s\S]*?\*\//gu, "");
	return /^\s*$/u.test(rest) ? comments : undefined;
}

function unaryOperand(node: Node, source: SourceFile): string | undefined {
	if (syntaxKindName(node) !== "PrefixUnaryExpression")                           return undefined;
	const operand = (node as unknown as { operand: Node }).operand;
	if (syntaxKindName(operand) === "PrefixUnaryExpression")                        return undefined;
	if (source.text.slice(node.getStart(source), operand.getStart(source)) !== "!") return undefined;
	return source.text.slice(operand.getStart(source), node.getEnd());
}

function displayColumn(source: SourceFile, position: number): number {
	const line      = source.getLineAndCharacterOfPosition(position).line ;
	const lineStart = source.getPositionOfLineAndCharacter(line, 0)       ;
	return displayWidth(source.text.slice(lineStart, position));
}

function isCanonicalLeading(source: SourceFile, operands: readonly Node[], operators: readonly Node[]): boolean {
	if (operators.length === 0) return false;
	const unary     = operands.map(operand => unaryOperand(operand, source)) ;
	const hasUnary  = unary.some(value => value !== undefined)               ;
	const opColumn  = displayColumn(source, operators[0]!.getStart(source))  ;
	const first     = displayColumn(source, operands[0]!.getStart(source))   ;
	const firstSlot = hasUnary && unary[0] === undefined ? 4 : 3             ;
	if (first !== opColumn + firstSlot) return false;
	return operators.every((token, index) => {
		const operatorLine = source.getLineAndCharacterOfPosition(token.getStart(source)).line        ;
		const previousLine = source.getLineAndCharacterOfPosition(operands[index]!.getEnd() - 1).line ;
		const lineStart    = source.getPositionOfLineAndCharacter(operatorLine, 0)                    ;
		const prefix       = source.text.slice(lineStart, token.getStart(source))                     ;
		return operatorLine > previousLine && /^\s*$/u.test(prefix) && displayWidth(prefix) === opColumn;
	});
}

function renderWrap(node: Node, source: SourceFile, form: ParentForm, operator: string, envelope?: IfEnvelope): { readonly text?: string; readonly refusal?: string } {
	const { operands, operators } = logicalParts(node, source, operator);
	const beforeComments : (readonly string[])[] = [] ;
	const afterComments  : (readonly string[])[] = [] ;
	for (let index = 0; index < operators.length; index += 1) {
		const previous = operands[index    ]!                                                         ;
		const token    = operators[index   ]!                                                         ;
		const next     = operands[index + 1]!                                                         ;
		const before   = triviaComments(source.text.slice(previous.getEnd(), token.getStart(source))) ;
		const after    = triviaComments(source.text.slice(token.getEnd(), next.getStart(source)))     ;
		if (before === undefined || after === undefined) return { refusal: "line or multiline comments between operands are unsupported" };
		beforeComments.push(before);
		afterComments .push(after );
	}
	const texts = operands.map(operand => source.text.slice(operand.getStart(source), operand.getEnd()));
	if (texts.some(text => /[\r\n]/u.test(text))) return { refusal: "multiline operands are unsupported" };
	const unary    = operands.map(operand => unaryOperand(operand, source)) ;
	const hasUnary = unary.some(value => value !== undefined)               ;
	const newline  = source.text.includes("\r\n") ? "\r\n" : "\n"           ;
	const indent   = indentation(source, node.getStart(source))             ;
	const operandText = (index: number): string => unary[index] === undefined
		? `${hasUnary ? " " : ""}${texts[index]}`
		: `!${unary[index]}`;
	const first          = `${" ".repeat(3)}${operandText(0)}` ;
	const rows: string[] = [first]                             ;
	for (let index = 0; index < operators.length; index += 1) {
		const priorNotes = beforeComments[index]!;
		if (priorNotes.length > 0) rows[rows.length - 1] += ` ${priorNotes.join(" ")}`;
		const nextNotes = afterComments[index]!                                 ;
		const noteCell  = nextNotes.length > 0 ? `${nextNotes.join(" ")} ` : "" ;
		rows.push(`${indent.continuation}${operator} ${noteCell}${operandText(index + 1)}`);
	}
	const body = rows.join(newline);
	if (form !== "if")                            return { text: body };
	if (envelope === undefined)                   return { refusal: "comments or unsupported trivia surround the if condition" };
	return {
		text: `${newline.repeat(envelope.leadingBreaks)}${indent.continuation}${body}${newline.repeat(envelope.trailingBreaks)}${envelope.closeIndent}`,
	};
}

function collectWraps(node: Node, source: SourceFile, minOperands: number, wraps: Wrap[], refused: Refusal[], ancestors: readonly Node[] = [], insideLogical = false): void {
	const operator = operatorOf(node, source);
	if (operator !== undefined && !insideLogical) {
		const count = logicalLeafCount(node, source);
		if (count >= minOperands) {
			const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
			if (hasMixedLogicalOperator(node, source, operator)) {
				refused.push({ line, reason: "mixed logical operators" });
				return;
			}
			const form = parentForm(ancestors);
			if (form === undefined) {
				refused.push({ line, reason: "table row or unsupported expression context" });
				return;
			}
			const parts = logicalParts(node, source, operator);
			if (isCanonicalLeading(source, parts.operands, parts.operators)) return;
			const envelope = form === "if" ? ifEnvelope(node, source, ancestors) : undefined ;
			const rendered = renderWrap(node, source, form, operator, envelope)              ;
			if (rendered.refusal !== undefined) {
				refused.push({ line, reason: rendered.refusal });
				return;
			}
			const start = envelope?.start ?? node.getStart(source) ;
			const end   = envelope?.end   ?? node.getEnd()         ;
			if (rendered.text !== undefined && rendered.text !== source.text.slice(start, end)) {
				wraps.push({ start, end, text: rendered.text });
			}
			return;
		}
	}
	const nextAncestors = [...ancestors, node];
	node.forEachChild(child => { collectWraps(child, source, minOperands, wraps, refused, nextAncestors, insideLogical || operator !== undefined); return undefined; });
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
	if (
            raw[0] !== "--file"
        || !raw[1]
        || !Number.isInteger(minConditions)
        ||  minConditions < 3
	) {
		throw new Error("usage: 07_wrap-conditions.ts --file <repository TypeScript file> [--write] [--min-conditions 4]");
	}
	return { file: raw[1], write, minOperands: minConditions };
}

async function main(): Promise<number> {
	const root = process.cwd();
	const { file, write, minOperands } = parseArguments();
	const { source, relative } = await loadSourceFile(root, file);
	const wraps   : Wrap[]    = [] ;
	const refused : Refusal[] = [] ;
	collectWraps(source, source, minOperands, wraps, refused);

	console.log(`wrap-conditions file=${relative} chains=${wraps.length} refused=${refused.length}${write ? " write=true" : ""}`);
	for (const refusal of refused.slice(0, 5)) console.log(`  refuse line=${refusal.line} reason=${refusal.reason}`);
	if (write && wraps.length > 0 && refused.length === 0) {
		const target = `${root}/${relative}`          ;
		const output = applyWraps(source.text, wraps) ;
		await updateFileAtomically(target, async ({ initial, working }) => {
			if (!initial.equals(Buffer.from(source.text))) throw new Error("target changed before condition authoring");
			const preservation = await compareTypeScriptLayout(root, working, source.text, output);
			if (preservation.status !== "preserved") throw new Error(`condition layout refused: ${preservation.reason}`);
			await Bun.write(working, output);
		});
	}
	if (refused.length > 0 || (!write && wraps.length > 0)) return 1;
	return 0;
}

try {
	process.exit(await main());
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
}
