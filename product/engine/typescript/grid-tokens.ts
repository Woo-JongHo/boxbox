/**
 * Decides in which AST roles a token (., ,, :, {}, (), ;) counts as a "boundary".
 * Positions come from AST node boundaries + skipTrivia instead of text indexOf, so identical characters
 * inside strings, comments or ternaries never collide. This judgment does not replace grouping —
 * 01_group-regions.ts already separates roles by grouping sibling rows of the same SyntaxKind.
 */
import      {
              isArrayLiteralExpression       ,
              isBlock                        ,
              isCallExpression               ,
              isConditionalExpression        ,
              isExpressionStatement          ,
              isObjectLiteralExpression      ,
              isParameterDeclaration         ,
              isPropertyAssignment           ,
              isPropertyDeclaration          ,
              isPropertySignatureDeclaration ,
              isVariableStatement            ,
                                               } from "typescript/unstable/ast"         ;
import type { Node, SourceFile                 } from "typescript/unstable/ast"         ;
import      { skipTrivia                       } from "typescript/unstable/ast/scanner" ;

export type BoundaryRole =
	| "type-annotation-colon"
	| "object-literal-colon"
	| "ternary-colon"
	| "call-arg-comma"
	| "array-comma"
	| "object-comma"
	| "statement-semicolon"
	| "block-brace"
	| "object-literal-brace"
	| "array-bracket"
	| "call-paren";

export interface Boundary {
	readonly role  : BoundaryRole ;
	readonly start : number       ;
	readonly end   : number       ;
}

function tokenAt(role: BoundaryRole, start: number, length = 1): Boundary {
	return { role, start, end: start + length };
}

function charTokenAt(role: BoundaryRole, source: SourceFile, position: number, char: string): Boundary | undefined {
	return source.text[position] === char ? tokenAt(role, position) : undefined;
}

/** Returns the ternary `:` and the property/parameter/object-literal `:` as different roles. Only same-role tokens share a table. */
export function colonOf(node: Node, source: SourceFile): Boundary | undefined {
	if (isConditionalExpression(node)) {
		return tokenAt("ternary-colon", node.colonToken.getStart(source), node.colonToken.getEnd() - node.colonToken.getStart(source));
	}
	if (isParameterDeclaration(node)) {
		const gapStart = (node.questionToken ?? node.name).getEnd();
		return charTokenAt("type-annotation-colon", source, skipTrivia(source.text, gapStart), ":");
	}
	if (isPropertySignatureDeclaration(node) || isPropertyDeclaration(node)) {
		const gapStart = (node.postfixToken ?? node.name).getEnd();
		return charTokenAt("type-annotation-colon", source, skipTrivia(source.text, gapStart), ":");
	}
	if (isPropertyAssignment(node)) {
		const gapStart = (node.postfixToken ?? node.name).getEnd();
		return charTokenAt("object-literal-colon", source, skipTrivia(source.text, gapStart), ":");
	}
	return undefined;
}

/** Terminating `;`. Statements without a semicolon (ASI) return undefined and are excluded from alignment. */
export function semicolonOf(node: Node, source: SourceFile): Boundary | undefined {
	if (isExpressionStatement(node)) {
		return charTokenAt("statement-semicolon", source, skipTrivia(source.text, node.expression.getEnd()), ";");
	}
	if (isVariableStatement(node)) {
		return charTokenAt("statement-semicolon", source, skipTrivia(source.text, node.declarationList.getEnd()), ";");
	}
	return undefined;
}

/** The `,` between call arguments, array elements or object properties. The role differs per container kind. */
export function commasOf(node: Node, source: SourceFile): readonly Boundary[] {
	const [role, items] = isCallExpression(node) ? (["call-arg-comma", node.arguments] as const)
		: isArrayLiteralExpression(node) ? (["array-comma", node.elements] as const)
		: isObjectLiteralExpression(node) ? (["object-comma", node.properties] as const)
		: (["array-comma", []] as const);
	const boundaries: Boundary[] = [];
	for (let index = 0; index < items.length - 1; index += 1) {
		const boundary = charTokenAt(role, source, skipTrivia(source.text, items[index].getEnd()), ",");
		if (boundary) boundaries.push(boundary);
	}
	return boundaries;
}

/** Opening/closing boundary pair enclosing one cell. For block/object literal/array literal, the node's own start and end are the tokens. */
export function bracketsOf(node: Node, source: SourceFile): { readonly open: Boundary; readonly close: Boundary } | undefined {
	if (isBlock(node))                   return pairAt("block-brace", source, node);
	if (isObjectLiteralExpression(node)) return pairAt("object-literal-brace", source, node);
	if (isArrayLiteralExpression(node))  return pairAt("array-bracket", source, node);
	if (isCallExpression(node)) {
		const open  = charTokenAt(
			"call-paren"                                     ,
			source                                           ,
			skipTrivia(source.text, node.expression.getEnd()),
			"("
		);
		const close = charTokenAt("call-paren", source, node.getEnd() - 1, ")");
		return open && close ? { open, close } : undefined;
	}
	return undefined;
}

function pairAt(role: BoundaryRole, source: SourceFile, node: Node): { readonly open: Boundary; readonly close: Boundary } {
	return { open: tokenAt(role, node.getStart(source)), close: tokenAt(role, node.getEnd() - 1) };
}

/**
 * Collects only the names of boundary axes actually present. A summary for group reports, not the grouping basis.
 * `:` and `;` are boundaries of the row itself, while `,` belongs to the container holding the rows — array elements
 * and call arguments have no comma in the row itself, only in the enclosing node, so the two are treated separately.
 */
export function boundaryAxesOf(container: Node, row: Node, source: SourceFile): readonly BoundaryRole[] {
	const axes: BoundaryRole[] = []                   ;
	const colon                = colonOf(row, source) ;
	if (colon) axes.push(colon.role);
	const semicolon = semicolonOf(row, source);
	if (semicolon) axes.push(semicolon.role);
	const commas = commasOf(container, source);
	if (commas.length > 0) axes.push(commas[0].role);
	return axes;
}
