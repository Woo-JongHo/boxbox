/**
 * Registry of table row kinds. Each kind detects rows in one container (detect) and returns the
 * alignable boundary (axis) positions for each row. The alignment engine (06_align-tables.ts) aligns axis
 * columns without knowing the kind. To add a case: 01 which kind is it → 02 which axis is missing → 03 register
 * the kind and axes in this file, add rows to test/fixtures/table-kinds.ts, and pin them with test/typescript-align.test.ts.
 */
import      {
              isArrayLiteralExpression                                    ,
              isBlock                                                     ,
              isAwaitExpression                                           ,
              isCallExpression                                            ,
              isCaseClause                                                ,
              isReturnStatement                                           ,
              isClassDeclaration                                          ,
              isEnumDeclaration                                           ,
              isExpressionStatement                                       ,
              isIfStatement                                               ,
              isEnumMember                                                ,
              isIdentifier                                                ,
              isInterfaceDeclaration                                      ,
              isMethodDeclaration                                         ,
              isMethodSignatureDeclaration                                ,
              isNewExpression                                             ,
              isObjectLiteralExpression                                   ,
              isPropertyAssignment                                        ,
              isPropertyAccessExpression                                  ,
              isPropertyDeclaration                                       ,
              isPropertySignatureDeclaration                              ,
              isSourceFile                                                ,
              isSwitchStatement                                           ,
              isTypeAliasDeclaration                                      ,
              isTypeLiteralNode                                           ,
              isVariableStatement                                         ,
              SyntaxKind                                                  ,
              NodeFlags                                                   ,
                                                                            } from "typescript/unstable/ast"         ;
import type { ObjectLiteralExpression, Node, PropertyAssignment, SourceFile } from "typescript/unstable/ast"         ;
import      { skipTrivia                                                    } from "typescript/unstable/ast/scanner" ;

import      { displayWidth                                                  } from "@/common/display-width.ts"       ;
import      {
              minimumRowsOf                                               ,
              TYPESCRIPT_LAYOUT_POLICY                                    ,
              validateLayoutAxisNotes                                     ,
                                                                            } from "@/typescript/layout-policy.ts"   ;

export interface RowBoundary {
	readonly axis : string ;
	readonly from : number ;
	readonly at   : number ;
	/** true for an insert axis with no minimum gap (`(`, `)`, `):`, `":`, `//`, layer `,`); false for a gap axis that keeps at least one space. */
	readonly insert? : boolean;
	/** The nested cell this boundary belongs to: `"call"`, or a named literal list (`list:value`, `list:arg2`, `list:matcher-arg1`). A layer is kept only when every row of the run has it in the same shape. */
	readonly layer?  : LayerTag;
}

/** Which nested cell a boundary belongs to: the compatible call layer, an outer call envelope, a subscript, or a named list slot. */
export type LayerTag = "call" | "call-envelope" | "subscript" | `list:${string}`;

/** One literal list a list slot may align: the open bracket position, the item nodes, the close bracket position. */
export interface ListCell {
	readonly open  : number          ;
	readonly items : readonly Node[] ;
	readonly close : number          ;
}

export type GapRule = "blank" | "comma";

export interface RowKind {
	readonly name       : string                                                                 ;
	readonly gap        : GapRule                                                                ;
	readonly containers : (node: Node, seen: ReadonlySet<Node>) => readonly Node[] | undefined   ;
	readonly detect     : (source: SourceFile, node: Node) => readonly RowBoundary[] | undefined ;
	/** Changes the reported name depending on the detected rows (e.g. declaration-equals when aligning the `=` axis). */
	readonly groupName? : (run: readonly DetectedRow[]) => string;
	/** Row floor for this run when it differs from the general floor (user-confirmed: `=` declaration tables from 2 rows). */
	readonly minRows?   : (run: readonly DetectedRow[]) => number | undefined;
	/** The row's nested call (declaration value, call-statement subject argument) whose `(`, `,`, `)` form the call layer. */
	readonly layerCall? : (node: Node) => Node | undefined;
}

/** Returns the token position only if only whitespace lies between from and the token; undefined with comments or ASI. */
export function tokenAfter(source: SourceFile, from: number, token: string): number | undefined {
	const at = skipTrivia(source.text, from);
	return source.text[at] === token && /^[ \t]*$/u.test(source.text.slice(from, at)) ? at : undefined;
}

export function spacesOnly(source: SourceFile, from: number, to: number): boolean {
	return /^[ \t]*$/u.test(source.text.slice(from, to));
}

export function displayColumn(source: SourceFile, position: number): number {
	const { line } = source.getLineAndCharacterOfPosition(position);
	return displayWidth(source.text.slice(source.getPositionOfLineAndCharacter(line, 0), position));
}

/** Checks that the row owns its line; false when other code shares the line, as in a one-line execution block. */
export function ownLineOf(source: SourceFile, node: Node, rest: RegExp): boolean {
	const start = node.getStart(source)                            ;
	const line  = source.getLineAndCharacterOfPosition(start).line ;
	if (line !== source.getLineAndCharacterOfPosition(node.getEnd() - 1).line) return false;
	if (skipTrivia(source.text, source.getPositionOfLineAndCharacter(line, 0)) !== start) return false;
	const lineEnd = source.text.indexOf("\n", node.getEnd());
	return rest.test(source.text.slice(node.getEnd(), lineEnd < 0 ? source.text.length : lineEnd).replace(/\r$/u, ""));
}

const LINE_REST  = /^[ \t]*(?:\/\/.*)?$/u         ;
const COMMA_REST = /^[ \t]*,?[ \t]*(?:\/\/.*)?$/u ;
/** Tail after an object row's closing `}`: allows `)`, `;`, `,`, `as const` and `satisfies X`. */
const CLOSER_REST = /^[ \t]*(?:(?:as const|satisfies [A-Za-z_$][\w$.<>[\]"']*)?[ \t]*(?:\)|;|,))?[ \t]*(?:\/\/.*)?$/u;
/** Returns the start of the tail after the closing `}` (`as const`/`satisfies`/`)`/`;`/`,`); undefined when there is no tail. */
function closerTail(source: SourceFile, node: Node): number | undefined {
	const lineEnd = source.text.indexOf("\n", node.getEnd())                                                         ;
	const rest    = source.text.slice(node.getEnd(), lineEnd < 0 ? source.text.length : lineEnd).replace(/\r$/u, "") ;
	const match   = /^[ \t]*((?:as const|satisfies [A-Za-z_$][\w$.<>[\]"']*)[ \t]*)?(\)|;|,)/u.exec(rest)            ;
	if (!match) return undefined;
	const tailLength = (match[1]?.length ?? 0) + (match[2]?.length ?? 0);
	return node.getEnd() + match[0].length - tailLength;
}

/** Returns a trailing `//` note on the same line after the terminator as the comment axis boundary. */
function trailingComment(source: SourceFile, after: number): RowBoundary | undefined {
	const lineEnd = source.text.indexOf("\n", after)                                     ;
	const rest    = source.text.slice(after, lineEnd < 0 ? source.text.length : lineEnd) ;
	const match   = /^[ \t]+(\/\/.*)$/u.exec(rest)                                       ;
	if (!match) return undefined;
	const at = after + match.index! + match[0].indexOf("//");
	return { axis: "comment", from: at, at, insert: true };
}

/** A call or `new` expression with at least one argument, looking through `await`; undefined otherwise. */
function callWithArguments(node: Node | undefined): Node | undefined {
	if (node === undefined)                                               return undefined;
	const current = isAwaitExpression(node) ? node.expression : node;
	if (isCallExpression(current) && current.arguments.length > 0)        return current;
	if (isNewExpression(current) && (current.arguments?.length ?? 0) > 0) return current;
	return undefined;
}

function callArguments(call: Node): readonly Node[] {
	return (call as unknown as { readonly arguments?: readonly Node[] }).arguments ?? [];
}

/** The call a declaration's value consists of, as in `const STATES = new Set([...]) ;`. */
function declarationCall(node: Node): Node | undefined {
	if (!isVariableStatement(node)) return undefined;
	return callWithArguments(node.declarationList.declarations[0]?.initializer);
}

/** The call inside a call statement's subject, as `preservesTokens(a, b)` in `expect(preservesTokens(a, b)).toBe(false);`. */
function subjectCall(node: Node): Node | undefined {
	if (!isExpressionStatement(node))                                                        return undefined;

	const expression = unwrapExpression(node.expression);
	if (!isCallExpression(expression) || !isPropertyAccessExpression(expression.expression)) return undefined;

	let subject: Node = expression.expression.expression;

	while (isPropertyAccessExpression(subject)) subject = subject.expression;
	if (!isCallExpression(subject) || subject.arguments.length !== 1)                        return undefined;

	const argument = subject.arguments[0]!;

	return isCallExpression(argument) && argument.arguments.length > 0 ? argument : undefined;
}

/**
 * Layer 2 — the call cell: `(` at its column, each top-level argument `,` right after the widest argument, one
 * space before the next argument, and `)` right after the widest last argument. Undefined when the call carries
 * type arguments, a trailing comma or anything but spaces between the tokens.
 */
function callLayer(source: SourceFile, call: Node): readonly RowBoundary[] | undefined {
	if ((call as unknown as { readonly typeArguments?: unknown }).typeArguments) return undefined;

	const callee = (call as unknown as { readonly expression: Node }).expression ;
	const open   = tokenAfter(source, callee.getEnd(), "(")                      ;
	const items  = callArguments(call)                                           ;
	if (open === undefined || items.length === 0)                                return undefined;

	const boundaries: RowBoundary[] = [{ axis: "call-open-paren", from: open, at: open, insert: true, layer: "call" }];

	for (let index = 0; index + 1 < items.length; index += 1) {
		const end   = items[index]!.getEnd()             ;
		const comma = tokenAfter(source, end, ",")       ;
		const next  = items[index + 1]!.getStart(source) ;
		if (comma === undefined || !spacesOnly(source, comma + 1, next)) return undefined;

		boundaries.push({ axis: `call-comma${index + 1}`, from: end, at: comma, insert: true, layer: "call" });
		boundaries.push({ axis: `call-arg${index + 2}`, from: comma + 1, at: next, layer: "call" });
	}

	const last  = items.at(-1)!.getEnd()        ;
	const close = tokenAfter(source, last, ")") ;
	if (close === undefined || close !== call.getEnd() - 1)                      return undefined;

	boundaries.push({ axis: "call-close-paren", from: last, at: close, insert: true, layer: "call" });

	return boundaries;
}

/** A list item the list layer may pad: a string, number or boolean literal. Identifiers and calls keep the list compact. */
function isLiteralItem(node: Node): boolean {
	const name = syntaxKindName(node);
	return name === "StringLiteral"
		|| name === "NumericLiteral"
		|| name === "TrueLiteral"
		|| name === "FalseLiteral";
}

/** An object item of the list layer: a `name: literal` property whose name text must match across rows. */
function isNamedProperty(node: Node): boolean {
	if (!isPropertyAssignment(node)) return false;
	const name = syntaxKindName((node as PropertyAssignment).name);
	return name === "Identifier" || name === "StringLiteral";
}

/** The literal list a node consists of: an array of literals or an object of literal properties; undefined otherwise. */
function literalListOf(source: SourceFile, node: Node): ListCell | undefined {
	if (isArrayLiteralExpression(node)) {
		const elements = node.elements;
		if (elements.length === 0 || !elements.every(isLiteralItem)) return undefined;
		return { open: node.getStart(source), items: [...elements], close: node.getEnd() - 1 };
	}
	const object = objectLiteralOf(node);
	if (object === undefined) return undefined;
	const properties = [...object.properties];
	if (properties.length === 0 || !properties.every(isNamedProperty)) return undefined;
	return { open: object.getStart(source), items: properties, close: object.getEnd() - 1 };
}

/**
 * Layer 3 — one list cell: the bracket at its column, each item `,` right after the widest item, the next item one
 * space later, and the closing bracket right after the widest last item. Empty when a comma, the closing bracket or
 * the spacing between them is missing (trailing comma, multi-line list).
 */
function itemLayer(source: SourceFile, cell: ListCell, prefix: string, tag: LayerTag): readonly RowBoundary[] {
	const boundaries: RowBoundary[] = [{ axis: `${prefix}-open`, from: cell.open, at: cell.open, insert: true, layer: tag }];
	for (let index = 0; index + 1 < cell.items.length; index += 1) {
		const end   = cell.items[index]!.getEnd()             ;
		const comma = tokenAfter(source, end, ",")            ;
		const next  = cell.items[index + 1]!.getStart(source) ;
		if (comma === undefined || !spacesOnly(source, comma + 1, next)) return [];
		boundaries.push({ axis: `${prefix}-comma${index + 1}`, from: end, at: comma, insert: true, layer: tag });
		boundaries.push({ axis: `${prefix}-el${index + 2}`, from: comma + 1, at: next, layer: tag });
	}
	const last  = cell.items.at(-1)!.getEnd()                       ;
	const close = tokenAfter(source, last, source.text[cell.close]) ;
	if (close === undefined || close !== cell.close) return [];
	boundaries.push({ axis: `${prefix}-close`, from: last, at: close, insert: true, layer: tag });
	return boundaries;
}

/** The nested call of a row by kind name — the same call `layerCall` selects. */
function kindLayerCall(kindName: string, node: Node): Node | undefined {
	if (kindName === "declaration") return declarationCall(node)      ;
	if (kindName === "call-statements") return subjectCall(node)      ;
	return undefined                                                  ;
}

/** The right-hand matcher call of a call statement, as `.toBe(false)` in `expect(x).toBe(false);`. */
function matcherCallOf(node: Node): Node | undefined {
	if (!isExpressionStatement(node)) return undefined                 ;
	const expression = unwrapExpression(node.expression)               ;
	return isCallExpression(expression) && isPropertyAccessExpression(expression.expression) ? expression : undefined;
}

/** The declaration's own value when it is a literal list, as `const STATES = ["PASS", "FIXABLE"] ;`. */
function declarationValueList(source: SourceFile, node: Node): ListCell | undefined {
	if (!isVariableStatement(node)) return undefined                        ;
	const initializer = node.declarationList.declarations[0]?.initializer   ;
	return initializer === undefined ? undefined : literalListOf(source, initializer);
}

/** The literal list slots of one row: each layered-call argument, the declaration value itself, and the matcher arguments. */
function rowListCells(source: SourceFile, kindName: string, node: Node): ReadonlyMap<LayerTag, ListCell> {
	const cells = new Map<LayerTag, ListCell>();
	if (kindName === "call-statements") {
		const matcher = matcherCallOf(node);
		if (matcher) for (const [index, argument] of callArguments(matcher).entries()) {
			const cell = literalListOf(source, argument)                             ;
			if (cell) cells.set(`list:matcher-arg${index + 1}`, cell)                ;
		}
	}
	const call = kindLayerCall(kindName, node);
	if (call) {
		for (const [index, argument] of callArguments(call).entries()) {
			const cell = literalListOf(source, argument)                             ;
			if (cell) cells.set(`list:arg${index + 1}`, cell)                        ;
		}
		return cells;
	}
	if (kindName === "declaration") {
		const cell = declarationValueList(source, node)                              ;
		if (cell) cells.set("list:value", cell)                                      ;
	}
	return cells;
}

/** The boundary axis prefix of a list slot tag: `list:arg2` → `list-arg2`. */
function listAxisPrefix(tag: string): string {
	return tag.replace(/^list:/u, "list-");
}

/** The subscript a declaration's value consists of, as `chars[index + 1]` in `const next = chars[index + 1] ;` — a leading `!` is fine. */
function subscriptPartsOf(source: SourceFile, node: Node): { readonly object: string; readonly index: Node; readonly close: number } | undefined {
	if (!isVariableStatement(node))                              return undefined;
	const declared = node.declarationList.declarations[0]?.initializer;
	if (declared === undefined)                                  return undefined;
	const unwrapped = syntaxKindName(declared) === "NonNullExpression" ? (declared as unknown as { readonly expression: Node }).expression : declared;
	if (syntaxKindName(unwrapped) !== "ElementAccessExpression") return undefined;
	const parts  = unwrapped as unknown as { readonly expression: Node; readonly argumentExpression: Node } ;
	const object = source.text.slice(parts.expression.getStart(source), parts.expression.getEnd())          ;
	return { object, index: parts.argumentExpression, close: unwrapped.getEnd() - 1 };
}

/** Callee text (whitespace-collapsed, `new`/`await` included) and arity; rows share the call layer only when these match. */
function callSignature(source: SourceFile, call: Node): string {
	const callee = (call as unknown as { readonly expression: Node }).expression;
	return `${source.text.slice(call.getStart(source), callee.getEnd()).replace(/\s+/gu, " ")}/${callArguments(call).length}`;
}

function detectDeclaration(source: SourceFile, node: Node): readonly RowBoundary[] | undefined {
	if (!isVariableStatement(node))          return undefined;
	const declarations = node.declarationList.declarations;
	if (declarations.length !== 1)           return undefined;
	const declaration = declarations[0]!;
	if (!isIdentifier(declaration.name))     return undefined;
	if (!ownLineOf(source, node, LINE_REST)) return undefined;
	const nameEnd                   = declaration.name.getEnd()        ;
	const boundaries: RowBoundary[] = []                               ;
	const colon                     = tokenAfter(source, nameEnd, ":") ;
	if (colon) boundaries.push({ axis: "colon", from: nameEnd, at: colon });
	const equalsAnchor = declaration.type ? declaration.type.getEnd() : nameEnd ;
	const equals       = tokenAfter(source, equalsAnchor, "=")                  ;
	if (equals) boundaries.push({ axis: "equals", from: equalsAnchor, at: equals });
	if (!colon && !equals) return undefined;
	const call = equals ? declarationCall(node) : undefined;
	if (call) boundaries.push(...callLayer(source, call) ?? []);
	for (const [tag, cell] of rowListCells(source, "declaration", node)) boundaries.push(...itemLayer(source, cell, listAxisPrefix(tag), tag));
	const subscript = equals && !call ? subscriptPartsOf(source, node) : undefined;
	if (subscript) {
		const closeBracket = tokenAfter(source, subscript.index.getEnd(), "]");
		if (closeBracket !== undefined && closeBracket === subscript.close) {
			boundaries.push({ axis: "subscript-close", from: subscript.index.getEnd(), at: closeBracket, insert: true, layer: "subscript" });
		}
	}
	const contentEnd = node.declarationList.getEnd()                        ;
	const semicolon  = tokenAfter                 (source, contentEnd, ";") ;
	if (!semicolon) return undefined;
	boundaries.push({ axis: "semicolon", from: contentEnd, at: semicolon });
	const comment = trailingComment(source, semicolon + 1);
	if (comment) boundaries.push(comment);
	return boundaries;
}

function detectTypeAlias(source: SourceFile, node: Node): readonly RowBoundary[] | undefined {
	if (!isTypeAliasDeclaration(node))       return undefined;
	if (!ownLineOf(source, node, LINE_REST)) return undefined;
	const anchor = node.typeParameters ? (node.typeParameters as unknown as { readonly end: number }).end : node.name.getEnd() ;
	const equals = tokenAfter(source, anchor, "=")                                                                             ;
	if (!equals)                             return undefined;
	const semicolon = tokenAfter(source, node.type.getEnd(), ";");
	if (!semicolon)                          return undefined;
	const boundaries: RowBoundary[] = [
		{ axis: "equals"   , from: anchor, at: equals },
		{ axis: "semicolon", from: node.type.getEnd(), at: semicolon },
	];
	const comment = trailingComment(source, semicolon + 1);
	if (comment) boundaries.push(comment);
	return boundaries;
}

function detectMember(source: SourceFile, node: Node): readonly RowBoundary[] | undefined {
	if (!isPropertySignatureDeclaration(node) && !isPropertyDeclaration(node)) return undefined;
	if (!ownLineOf(source, node, LINE_REST)) return undefined;
	const nameEnd                   = (node.postfixToken ?? node.name).getEnd() ;
	const boundaries: RowBoundary[] = []                                        ;
	const colon                     = tokenAfter(source, nameEnd, ":")          ;
	if (colon) boundaries.push({ axis: "colon", from: nameEnd, at: colon });
	const equalsAnchor = node.type ? node.type.getEnd() : nameEnd                                                            ;
	const equals       = isPropertyDeclaration(node) && node.initializer ? tokenAfter(source, equalsAnchor, "=") : undefined ;
	if (equals) boundaries.push({ axis: "equals", from: equalsAnchor, at: equals });
	const contentEnd = (node.initializer ?? node.type)?.getEnd() ?? nameEnd ;
	const semicolon  = tokenAfter(source, contentEnd, ";")                  ;
	if (!semicolon) return undefined;
	boundaries.push({ axis: "semicolon", from: contentEnd, at: semicolon });
	const comment = trailingComment(source, semicolon + 1);
	if (comment) boundaries.push(comment);
	return boundaries;
}

function detectMethod(source: SourceFile, node: Node): readonly RowBoundary[] | undefined {
	if (!isMethodSignatureDeclaration(node) && !isMethodDeclaration(node)) return undefined;
	if (!ownLineOf(source, node, LINE_REST))                               return undefined;
	const nameEnd = node.name.getEnd()                     ;
	const open    = tokenAfter      (source, nameEnd, "(") ;
	if (!open)                                                             return undefined;
	const parameters    = node.parameters                                        ;
	const hasParameters = parameters.length > 0                                  ;
	const closeAnchor   = hasParameters ? parameters.at(-1)!.getEnd() : open + 1 ;
	const close         = tokenAfter(source, closeAnchor, ")")                   ;
	if (!close)                                                            return undefined;
	const boundaries: RowBoundary[] = [{ axis: "open-paren", from: open, at: open, insert: true }];
	// Empty parameter lists stay attached as () — the closing paren is not aligned to the table width; padding goes outside.
	if (hasParameters) boundaries.push({ axis: "close-paren", from: close, at: close, insert: true });
	const typeColon = node.type ? tokenAfter(source, close + 1, ":") : undefined;
	// The return-type `:` is aligned as an insert axis (from==at) to preserve the existing `):` convention.
	if (typeColon) boundaries.push({ axis: "colon", from: typeColon, at: typeColon, insert: true });
	const commentAnchor = node.type ? node.type.getEnd() : node.getEnd() ;
	const comment       = trailingComment(source, commentAnchor)         ;
	if (comment) boundaries.push(comment);
	return boundaries;
}

function detectEnumMember(source: SourceFile, node: Node): readonly RowBoundary[] | undefined {
	if (!isEnumMember(node)) return undefined;
	if (!ownLineOf(source, node, COMMA_REST)) return undefined;
	const nameEnd                   = node.name.getEnd()                                              ;
	const boundaries: RowBoundary[] = []                                                              ;
	const equals                    = node.initializer ? tokenAfter(source, nameEnd, "=") : undefined ;
	if (equals) boundaries.push({ axis: "equals", from: nameEnd, at: equals });
	const valueEnd = node.initializer ? node.initializer.getEnd() : nameEnd ;
	const comma    = tokenAfter(source, valueEnd, ",")                      ;
	if (!comma) return undefined;
	boundaries.push({ axis: "comma", from: valueEnd, at: comma });
	const comment = trailingComment(source, comma + 1);
	if (comment) boundaries.push(comment);
	return boundaries;
}

/** Finds the outermost call expression in a statement (strips await and targets the first CallExpression). */
function firstCallOf(node: Node): Node | undefined {
	let found: Node | undefined;
	const visit = (current: Node): void => {
		if (found) return;
		const unwrapped = isAwaitExpression(current) ? current.expression : current;
		if (isCallExpression(unwrapped)) { found = unwrapped; return; }
		unwrapped.forEachChild(child => visit(child));
	};
	visit(node);
	return found;
}

/** Strips parentheses to reach the actual expression. */
function unwrapExpression(node: Node): Node {
	let current = node;
	while (syntaxKindName(current) === "ParenthesizedExpression") current = (current as unknown as { expression: Node }).expression;
	return current;
}

function detectAssignments(source: SourceFile, node: Node): readonly RowBoundary[] | undefined {
	if (!isExpressionStatement(node))                                                                    return undefined;
	if (!ownLineOf(source, node, LINE_REST))                                                             return undefined;
	const expression = unwrapExpression(node.expression);
	if (syntaxKindName(expression) !== "BinaryExpression")                                               return undefined;
	const binary = expression as unknown as { operatorToken: Node; left: Node; right: Node };
	if (source.text.slice(binary.operatorToken.getStart(source), binary.operatorToken.getEnd()) !== "=") return undefined;
	const boundaries: RowBoundary[] = []                                            ;
	const equals                    = tokenAfter(source, binary.left.getEnd(), "=") ;
	if (equals === undefined)                                                                            return undefined;
	boundaries.push({ axis: "equals", from: binary.left.getEnd(), at: equals });
	const semicolon = tokenAfter(source, binary.right.getEnd(), ";");
	if (!semicolon)                                                                                      return undefined;
	boundaries.push({ axis: "semicolon", from: binary.right.getEnd(), at: semicolon });
	const comment = trailingComment(source, semicolon + 1);
	if (comment) boundaries.push(comment);
	return boundaries;
}

function detectCallStatement(source: SourceFile, node: Node): readonly RowBoundary[] | undefined {
	if (!isExpressionStatement(node))                                              return undefined;
	if (!ownLineOf(source, node, LINE_REST))                                       return undefined;
	const expression = unwrapExpression(node.expression);
	if (!isCallExpression(expression))                                             return undefined;
	const matcher = expression.expression;
	if (!isPropertyAccessExpression(matcher) || expression.arguments.length !== 1) return undefined;
	let subject: Node = matcher.expression;
	while (isPropertyAccessExpression(subject)) subject = subject.expression;
	if (!isCallExpression(subject) || subject.arguments.length !== 1)              return undefined;
	const subjectClose = subject.getEnd() - 1;
	if (source.text[subjectClose] !== ")")                                         return undefined;
	const matcherDot = tokenAfter(source, matcher.expression.getEnd(), ".");
	if (matcherDot === undefined)                                                  return undefined;
	const matcherOpen = tokenAfter(source, matcher.getEnd(), "(");
	if (matcherOpen === undefined)                                                 return undefined;
	const matcherClose = expression.getEnd() - 1;
	if (source.text[matcherClose] !== ")")                                         return undefined;
	const semicolon = tokenAfter(source, expression.getEnd(), ";");
	if (semicolon === undefined)                                                   return undefined;
	const boundaries: RowBoundary[] = [
		{ axis : "subject-close-paren" , from : subject.arguments[0]!.getEnd() , at : subjectClose , insert : true },
		{ axis : "matcher-dot"         , from : matcherDot                     , at : matcherDot   , insert : true },
		{ axis : "matcher-open-paren"  , from : matcherOpen                    , at : matcherOpen  , insert : true },
		{ axis : "matcher-close-paren" , from : matcherClose                   , at : matcherClose , insert : true },
		{ axis : "semicolon"           , from : expression.getEnd()            , at : semicolon                    },
	];
	const inner = subjectCall(node);
	if (inner) boundaries.push(...callLayer(source, inner) ?? []);
	for (const [tag, cell] of rowListCells(source, "call-statements", node)) boundaries.push(...itemLayer(source, cell, listAxisPrefix(tag), tag));
	const comment = trailingComment(source, semicolon + 1);
	if (comment) boundaries.push(comment);
	return boundaries;
}

/** A one-line, unbraced early return; only the space before `return` belongs to this axis. */
function detectReturnGuard(source: SourceFile, node: Node): readonly RowBoundary[] | undefined {
	if (!isIfStatement(node) || node.elseStatement !== undefined || !isReturnStatement(node.thenStatement)) return undefined;
	if (!ownLineOf(source, node, LINE_REST))                                                                return undefined;

	const close = tokenAfter                 (source, node.expression.getEnd(), ")") ;
	const start = node.thenStatement.getStart(source                               ) ;
	if (close === undefined || !spacesOnly(source, close + 1, start))                                       return undefined;

	return [{ axis: "guard-return", from: close + 1, at: start }];
}

/**
 * A guard row: a one-line `if (…) { …; continue; }` whose block ends in `continue`, with no `else`. Aligned cells
 * are the condition's closing `)` (hugging the widest condition), the first statement's `;` (hugging the widest
 * first statement) and the `continue` column; the statements in between stay as written.
 */
function detectGuard(source: SourceFile, node: Node): readonly RowBoundary[] | undefined {
	if (!isIfStatement(node))                      return undefined                        ;
	if (node.elseStatement !== undefined)          return undefined            ;
	if (!ownLineOf(source, node, LINE_REST))       return undefined         ;
	const closeParen = tokenAfter(source, node.expression.getEnd(), ")");
	if (closeParen === undefined)                  return undefined;
	const thenStatement = node.thenStatement                                    ;
	if (syntaxKindName(thenStatement) !== "Block") return undefined             ;
	const statements = (thenStatement as unknown as { readonly statements: readonly Node[] }).statements;
	if (statements.length < 2)                     return undefined;
	// A statement node includes its `;`, so the padding anchor is the first statement's expression.
	const first          = statements[0]!                                       ;
	if (syntaxKindName(first) !== "ExpressionStatement") return undefined       ;
	const firstExpression = (first as unknown as { readonly expression: Node }).expression ;
	const firstSemicolon  = tokenAfter(source, firstExpression.getEnd(), ";")              ;
	if (firstSemicolon === undefined)                    return undefined                          ;
	const last = statements.at(-1)!                                             ;
	if (syntaxKindName(last) !== "ContinueStatement")    return undefined          ;
	const boundaries: RowBoundary[] = [
		{ axis : "guard-close-paren" , from : node.expression.getEnd() , at : closeParen            , insert : true },
		{ axis : "guard-semi1"       , from : firstExpression.getEnd() , at : firstSemicolon        , insert : true },
		{ axis : "guard-continue"    , from : last.getStart(source)    , at : last.getStart(source) , insert : true },
	];
	const comment = trailingComment(source, node.getEnd());
	if (comment) boundaries.push(comment);
	return boundaries;
}

function detectCaseClause(source: SourceFile, node: Node): readonly RowBoundary[] | undefined {
	if (!isCaseClause(node))                 return undefined;
	if (!ownLineOf(source, node, LINE_REST)) return undefined;
	const colon = tokenAfter(source, node.expression.getEnd(), ":");
	if (!colon)                              return undefined;
	// The label `:` is aligned as an insert axis (from==at) to preserve the `case "a":` convention.
	const boundaries: RowBoundary[] = [{ axis: "case-colon", from: colon, at: colon, insert: true }] ;
	const statements                = node.statements                                                ;
	if (statements.length > 0) {
		const call = firstCallOf(statements[0]!);
		if (call) {
			const paren = tokenAfter(source, (call as unknown as { expression: Node }).expression.getEnd(), "(");
			if (paren !== undefined) boundaries.push({ axis: "call-paren", from: paren, at: paren, insert: true });
		}
		const last = statements.at(-1)!;
		if (isReturnStatement(last) && last.expression === undefined) {
			boundaries.push({ axis: "return-tail", from: last.getStart(source), at: last.getStart(source), insert: true });
		}
	}
	return boundaries;
}


/** Strips `x as const`, parentheses and non-null to return the inner object literal; undefined if it is not an object. */
function objectLiteralOf(node: Node): ObjectLiteralExpression | undefined {
	let current = node;
	for (;;) {
		const name = syntaxKindName(current);
		if (name === "AsExpression" || name === "ParenthesizedExpression" || name === "NonNullExpression") {
			current = (current as unknown as { expression: Node }).expression;
			continue;
		}
		return isObjectLiteralExpression(current) ? current : undefined;
	}
}

function detectObjectRow(source: SourceFile, node: Node): readonly RowBoundary[] | undefined {
	if (!isObjectLiteralExpression(node) && objectLiteralOf(node) === undefined) return undefined;
	if (!ownLineOf(source, node, CLOSER_REST))                                   return undefined;
	const obj        = objectLiteralOf(node)! ;
	const properties = [...obj.properties]    ;
	if (properties.length === 0 || !properties.every(isPropertyAssignment))      return undefined;
	const openBrace = obj.getStart(source);
	if (source.text[openBrace] !== "{")                                          return undefined;
	const boundaries: RowBoundary[] = [{ axis: "open-brace", from: openBrace, at: openBrace, insert: true }] ;
	let propertyAnchor              = openBrace + 1                                                          ;
	for (let index = 0; index < properties.length; index += 1) {
		const property  = properties[index]! as PropertyAssignment          ;
		const nameStart = property.name.getStart(source)                    ;
		const nameEnd   = (property.postfixToken ?? property.name).getEnd() ;
		const colon     = tokenAfter(source, nameEnd, ":")                  ;
		if (!spacesOnly(source, propertyAnchor, nameStart)) return undefined;
		boundaries.push({ axis: `property${index + 1}`, from: propertyAnchor, at: nameStart });
		if (!colon) return undefined;
		boundaries.push({ axis: `colon${index + 1}`, from: nameEnd, at: colon });
		if (spacesOnly(source, colon + 1, property.initializer.getStart())) {
			boundaries.push({ axis: `value${index + 1}`, from: colon + 1, at: property.initializer.getStart() });
		}
		const last        = index === properties.length - 1            ;
		const valueEnd    = property.initializer.getEnd()              ;
		const comma       = tokenAfter(source, valueEnd, ",")          ;
		const closeAnchor = comma === undefined ? valueEnd : comma + 1 ;
		if (!last && comma === undefined) return undefined;
		if (comma !== undefined) boundaries.push({ axis: `comma${index + 1}`, from: valueEnd, at: comma });
		if (!last) {
			propertyAnchor = comma! + 1;
			continue;
		}
		const closeBrace = tokenAfter(source, closeAnchor, "}");
		if (closeBrace === undefined) return undefined;
		boundaries.push({ axis: "close-brace", from: closeAnchor, at: closeBrace });
	}
	const tail = closerTail(source, node);
	if (tail !== undefined) boundaries.push({ axis: "tail", from: node.getEnd(), at: tail, insert: true });
	return boundaries;
}

function detectRegistrationRow(source: SourceFile, node: Node): readonly RowBoundary[] | undefined {
	if (!isPropertyAssignment(node))          return undefined;
	if (!ownLineOf(source, node, COMMA_REST)) return undefined;
	const nameEnd = (node.postfixToken ?? node.name).getEnd() ;
	const colon   = tokenAfter(source, nameEnd, ":")          ;
	if (!colon)                               return undefined;
	const boundaries: RowBoundary[] = [{ axis: "colon", from: nameEnd, at: colon }];
	if (spacesOnly(source, colon + 1, node.initializer.getStart())) {
		boundaries.push({ axis: "value", from: colon + 1, at: node.initializer.getStart() });
	}
	// A row without a trailing comma (the last property) simply has no comma cell; the other rows still align theirs.
	const comma = tokenAfter(source, node.initializer.getEnd(), ",");
	if (comma) boundaries.push({ axis: "comma", from: node.initializer.getEnd(), at: comma });
	return boundaries;
}

/** Keep resource declarations and awaited/constructor initializers outside direct-call approval keys. */
function declarationGroupName(run: readonly DetectedRow[]): string {
	if (run.some(row => row.boundaries.some(boundary => boundary.layer === "call-envelope"))) return "declaration-call-envelope";
	if (!run.some(row => row.boundaries.some(boundary => boundary.axis === "equals"))) return "declaration";
	const extended = run.some(row => {
		if (!isVariableStatement(row.node)) return false;
		const declaration = row.node.declarationList                 ;
		const initializer = declaration.declarations[0]?.initializer ;
		return (declaration.flags & NodeFlags.Using) !== 0 || (initializer !== undefined && (isAwaitExpression(initializer) || isNewExpression(initializer)));
	});
	return extended ? "declaration-extended-equals" : "declaration-equals";
}

/**
 * Kind priority. Ordered so node syntaxes never overlap and no node is claimed by two kinds; when object-rows
 * claims array-element objects first, registration backs off via seen.
 */
export const ROW_KINDS: readonly RowKind[] = [
	{
		name       : "declaration",
		gap        : TYPESCRIPT_LAYOUT_POLICY.rowKinds.declaration.gap,
		containers : node => (isSourceFile(node) || isBlock(node)) ? node.statements : undefined,
		detect     : detectDeclaration,
		groupName  : declarationGroupName,
		minRows    : run => minimumRowsOf(TYPESCRIPT_LAYOUT_POLICY.rowKinds.declaration, run.map(row => row.boundaries.map(boundary => boundary.axis))),
		layerCall  : node => kindLayerCall("declaration", node),
	},
	{
		name       : "type-alias",
		gap        : "blank",
		containers : node => (isSourceFile(node) || isBlock(node)) ? node.statements : undefined,
		detect     : detectTypeAlias,
	},
	{
		name       : "type-members",
		gap        : "blank",
		containers : node => isTypeLiteralNode(node) ? node.members : undefined,
		detect     : detectMember,
	},
	{
		name       : "method-signature",
		gap        : "blank",
		containers : node => isInterfaceDeclaration(node) ? node.members : undefined,
		detect     : detectMethod,
	},
	{
		name       : "interface-members",
		gap        : "blank",
		containers : node => isInterfaceDeclaration(node) ? node.members : undefined,
		detect     : detectMember,
	},
	{
		name       : "class-method",
		gap        : "blank",
		containers : node => isClassDeclaration(node) ? node.members : undefined,
		detect     : detectMethod,
	},
	{
		name       : "class-members",
		gap        : "blank",
		containers : node => isClassDeclaration(node) ? node.members : undefined,
		detect     : detectMember,
	},
	{
		name       : "assignments",
		gap        : "blank",
		containers : node => (isSourceFile(node) || isBlock(node)) ? node.statements : undefined,
		detect     : detectAssignments,
	},
	{
		name       : "call-statements",
		gap        : "blank",
		containers : node => (isSourceFile(node) || isBlock(node)) ? node.statements : undefined,
		detect     : detectCallStatement,
		layerCall  : node => kindLayerCall("call-statements", node),
	},
	{
		name       : "return-guards",
		gap        : "blank",
		containers : node => isBlock(node) ? node.statements : undefined,
		detect     : detectReturnGuard,
	},
	{
		name       : "guard-statements",
		gap        : "blank",
		containers : node => (isSourceFile(node) || isBlock(node)) ? node.statements : undefined,
		detect     : detectGuard,
	},
	{
		name       : "enum-member",
		gap        : "comma",
		containers : node => isEnumDeclaration(node) ? node.members : undefined,
		detect     : detectEnumMember,
	},
	{
		name       : "case-clause",
		gap        : "blank",
		containers : node => isSwitchStatement(node) ? node.caseBlock.clauses : undefined,
		detect     : detectCaseClause,
	},
	{
		name       : "object-rows",
		gap        : "comma",
		containers : node => {
			if (!isArrayLiteralExpression(node)) return undefined;
			if (!node.elements.every(element => objectLiteralOf(element) !== undefined)) return undefined;
			return node.elements;
		},
		detect     : detectObjectRow,
	},
	{
		name       : "registration",
		gap        : "comma",
		containers : (node, seen) => {
			if (!isObjectLiteralExpression(node) || seen.has(node)) return undefined;
			return node.properties;
		},
		detect     : detectRegistrationRow,
	},
];

/** Human-readable description of which syntax boundary each axis name means. Fill it in when registering a new axis. */
export const AXIS_NOTES: Readonly<Record<string, string>> = {
	"call-member-dot"        :
		"final receiver/method dot of a supported member call; inner receiver dots remain inside the receiver cell",
	"colon"                  :
		"`:` separating a name or identifier from its type or expression",
	"equals"                 :
		"`=` of a declaration, alias or enum member",
	"semicolon"              :
		"statement-terminating `;`",
	"comma"                  :
		"row-separating `,` of an enum member or object property (a last row without one is left out of the column)",
	"comment"                :
		"start column of a trailing `//` note",
	"open-paren"             :
		"parameter-opening `(` (after the name width)",
	"close-paren"            :
		"parameter-closing `)` (after the minimum inner width)",
	"case-colon"             :
		"`:` of a case label",
	"call-paren"             :
		"opening `(` of the first call in a case row",
	"subject-close-paren"    :
		"`)` closing the subject argument cell of a call statement",
	"matcher-dot"            :
		"`.` before the right-hand matcher of a call statement",
	"matcher-open-paren"     :
		"`(` opening the matcher argument cell",
	"matcher-close-paren"    :
		"`)` closing the matcher argument cell",
	"return-tail"            :
		"start column of a bare `return;` at the end of a case row",
	"value"                  :
		"start column of a registration-object expression",
	"property"               :
		"start column of the property name at each position in an object row",
	"open-brace"             :
		"opening `{` of an object row",
	"close-brace"            :
		"closing `}` of an object row",
	"tail"                   :
		"tail after an object row's `}` (`,` `;` `)` `as const`)",
	"call-open-paren"        :
		"`(` of the nested call cell (same callee and arity in every row)",
	"call-comma"             :
		"top-level argument `,` of the nested call cell, right after the widest argument",
	"call-arg"               :
		"start column of the next argument of the nested call cell",
	"call-close-paren"       :
		"`)` of the nested call cell, right after the widest last argument",
	"list-value-open"        :
		"opening `[` or `{` of a declaration value list",
	"list-value-comma"       :
		"`,` of a declaration value list, right after the widest item",
	"list-value-el"          :
		"start column of the next item of a declaration value list",
	"list-value-close"       :
		"closing `]` or `}` of a declaration value list, right after the widest last item",
	"list-arg-open"          :
		"opening `[` or `{` of a list inside a nested call argument",
	"list-arg-comma"         :
		"`,` of a list inside a nested call argument, right after the widest item",
	"list-arg-el"            :
		"start column of the next item of a list inside a nested call argument",
	"list-arg-close"         :
		"closing `]` or `}` of a list inside a nested call argument, right after the widest last item",
	"list-matcher-arg-open"  :
		"opening `[` or `{` of a list inside a matcher argument",
	"list-matcher-arg-comma" :
		"`,` of a list inside a matcher argument, right after the widest item",
	"list-matcher-arg-el"    :
		"start column of the next item of a list inside a matcher argument",
	"list-matcher-arg-close" :
		"closing `]` or `}` of a list inside a matcher argument, right after the widest last item",
	"subscript-close"        :
		"`]` of a declaration's subscript value, right after the widest index",
	"guard-return"           :
		"start column of an unbraced early return in the same block",
	"call-envelope-open"     :
		"opening `(` of compatible direct-call declaration values with different signatures",
	"call-envelope-close"    :
		"closing `)` of a nonempty direct-call value; its arguments remain one opaque cell",
	"guard-close-paren"      :
		"`)` of a guard row's condition, right after the widest condition",
	"guard-semi1"            :
		"first statement's `;` of a guard row, right after the widest first statement",
	"guard-continue"         :
		"start column of the trailing `continue;` in a guard row",
};

validateLayoutAxisNotes(TYPESCRIPT_LAYOUT_POLICY, AXIS_NOTES);

export function syntaxKindName(node: Node): string {
	return SyntaxKind[node.kind] ?? `Kind${String(node.kind)}`;
}

/**
 * Axis contract per kind — the single basis shared by authoring time (prompts, doc examples) and check time
 * (06_align-tables). gap axes keep at least one space; insert axes preserve existing conventions (`):`, `":`,
 * `//`) and only align the column. `{i}` marks per-property-position axes of object rows.
 */
export const KIND_AXES: Readonly<Record<string, { readonly gap: readonly string[]; readonly insert: readonly string[] }>> = TYPESCRIPT_LAYOUT_POLICY.kinds;

export interface DetectedRow {
	readonly node       : Node;
	readonly boundaries : readonly RowBoundary[];
	/** The nested call to render as the vertical form (declaration outlier rows). Such rows leave the horizontal column math. */
	readonly vertical?  : Node;
}

/** Ordinary rows must be contiguous; return guards share a region of immediate block siblings without crossing section barriers. */
export function runsOf(source: SourceFile, siblings: readonly Node[], kind: RowKind): readonly (readonly DetectedRow[])[] {
	if (kind.name === "return-guards") return returnGuardRuns(source, siblings, kind);
	const commaGap                    = kind.gap === "comma" ;
	const runs      : DetectedRow[][] = []                   ;
	let current     : DetectedRow[]   = []                   ;
	let previousEnd : number | undefined                     ;
	for (const sibling of siblings) {
		const boundaries = kind.detect(source, sibling)                                                                                                                    ;
		const gap        = previousEnd === undefined || boundaries === undefined ? undefined : source.text.slice(previousEnd, sibling.getStart(source))                    ;
		const continues  = boundaries !== undefined && (previousEnd === undefined || (commaGap ? /^[ \t]*,?[ \t]*\r?\n[ \t]*$/u : /^[ \t]*\r?\n[ \t]*$/u).test(gap ?? "")) ;
		if (continues) current.push({ node: sibling, boundaries });
		else {
			if (current.length > 0) runs.push(current);
			current = boundaries ? [{ node: sibling, boundaries }] : [];
		}
		previousEnd = sibling.getEnd();
	}
	if (current.length > 0) runs.push(current);
	return runs.filter(run => run.length > 0).map(run => withCallEnvelope(source, kind, withLayers(source, kind, run)));
}

/** Terminal statements and unrelated declaration/control-flow forms end a guard region. */
function guardRegionBarrier(node: Node): boolean {
	return [
		"IfStatement",
		"ReturnStatement",
		"ThrowStatement",
		"BreakStatement",
		"ContinueStatement",
		"FunctionDeclaration",
		"ClassDeclaration",
	].includes(syntaxKindName(node));
}

/** Inspect immediate siblings only: ordinary statements bridge guards, while comments and explicit section barriers split them. */
function returnGuardRuns(source: SourceFile, siblings: readonly Node[], kind: RowKind): readonly (readonly DetectedRow[])[] {
	const runs      : DetectedRow[][] = [] ;
	let current     : DetectedRow[]   = [] ;
	let previousEnd : number | undefined   ;

	for (const sibling of siblings) {
		const boundaries = kind.detect(source, sibling)                                                              ;
		const gap        = previousEnd === undefined ? "" : source.text.slice(previousEnd, sibling.getStart(source)) ;
		const barrier    = boundaries === undefined && guardRegionBarrier(sibling)                                   ;
		if (!/^[ \t\r\n]*$/u.test(gap) || barrier) {
			if (current.length > 0) runs.push(current);
			current = [];
		}
		if (boundaries !== undefined) current.push({ node: sibling, boundaries });
		previousEnd = sibling.getEnd();
	}
	if (current.length > 0) runs.push(current);

	return runs;
}

/** Identifier/property callees only: optional chains, computed access and call-produced receivers stay opaque. */
function simpleCallee(node: Node): boolean {
	if (isIdentifier(node)) return true;
	if (!isPropertyAccessExpression(node) || node.questionDotToken !== undefined) return false;

	return simpleCallee(node.expression);
}

/** A direct call may carry one trailing non-null assertion; await/new/type arguments are separate contracts. */
function envelopeCall(node: Node): Node | undefined {
	if (!isVariableStatement(node) || (node.declarationList.flags & NodeFlags.Using) !== 0) return undefined;

	const value = node.declarationList.declarations[0]?.initializer;
	const call = value !== undefined && syntaxKindName(value) === "NonNullExpression"
		? (value as unknown as { readonly expression: Node }).expression : value;
	if (
		call === undefined
		|| !isCallExpression(call)
		|| call.questionDotToken !== undefined
		|| call.typeArguments !== undefined
	)
		return undefined;

	return simpleCallee(call.expression) ? call : undefined;
}

/** The outer call is one cell; commas and nested expressions inside that cell are deliberately not edited. */
function envelopeBoundaries(source: SourceFile, call: Node): readonly RowBoundary[] | undefined {
	const callee = (call as unknown as { readonly expression: Node }).expression ;
	const open   = tokenAfter(source, callee.getEnd(), "(")                      ;
	const items  = callArguments(call)                                           ;
	if (open === undefined) return undefined;

	const end   = items.at(-1)?.getEnd() ?? open + 1 ;
	const close = tokenAfter(source, end, ")")       ;
	if (close === undefined || close !== call.getEnd() - 1) return undefined;

	const boundaries: RowBoundary[] = [];
	if (isPropertyAccessExpression(callee)) {
		const receiverEnd = callee.expression.getEnd()                         ;
		const dot         = tokenAfter              (source, receiverEnd, ".") ;
		if (dot === undefined || !spacesOnly(source, dot + 1, callee.name.getStart(source))) return undefined;
		boundaries.push({ axis: "call-member-dot", from: receiverEnd, at: dot, insert: true, layer: "call-envelope" });
	}
	boundaries.push({ axis: "call-envelope-open", from: callee.getEnd(), at: open, insert: true, layer: "call-envelope" });
	// Empty calls retain (), including their zero inner width.
	if (items.length === 0 && close !== open + 1) return undefined;
	if (items.length > 0) boundaries.push({ axis: "call-envelope-close", from: end, at: close, insert: true, layer: "call-envelope" });

	return boundaries;
}

/** Existing direct same-call argument layers keep their key; empty calls and non-null wrappers use the new envelope contract. */
function withCallEnvelope(source: SourceFile, kind: RowKind, run: readonly DetectedRow[]): readonly DetectedRow[] {
	if (kind.name !== "declaration" || run.length < 2)                          return run;

	const calls = run.map(row => envelopeCall(row.node));
	if (calls.some(call => call === undefined))                                 return run;

	const legacyCalls = run.map(row => declarationCall(row.node))                ;
	const signatures  = new Set(calls.map(call => callSignature(source, call!))) ;
	if (signatures.size === 1 && legacyCalls.every(call => call !== undefined)) return run;

	const envelopes = calls.map(call => envelopeBoundaries(source, call!));
	if (envelopes.some(boundaries => boundaries === undefined))                 return run;

	return run.map((row, index) => ({
		node: row.node,
		boundaries: [...row.boundaries.filter(boundary => boundary.layer === undefined), ...envelopes[index]!],
	}));
}

/** An argument cell this much wider than the second widest in its column is an outlier (import rule B); the layer is not applied. */
const OUTLIER_GAP = 20;

/**
 * Keeps the call layer only when every row calls the same callee with the same arity and no argument column has an
 * outlier; keeps a list slot only when every row has the same literal list there (same shape, no outlier column).
 * In declaration tables the outlier rows go vertical instead, and the rest keep the call layer when no outlier is
 * left among them. Dropping the call layer drops the list slots inside its arguments; matcher slots survive.
 */
function withLayers(source: SourceFile, kind: RowKind, run: readonly DetectedRow[]): readonly DetectedRow[] {
	const tags = new Set(run.flatMap(row => row.boundaries.filter(boundary => boundary.layer !== undefined).map(boundary => boundary.layer!)));
	if (tags.size === 0) return run;
	const keep       = new Set<string>()                                                                        ;
	let rows         = run                                                                                      ;
	const calls      = run.map(row => kind.layerCall?.(row.node))                                               ;
	const signatures = new Set(calls.map(call => call === undefined ? undefined : callSignature(source, call))) ;
	const complete   = run.every(row => row.boundaries.some(boundary => boundary.axis === "call-close-paren"))  ;
	const sameCall   = tags.has("call")
		&& complete
		&& signatures.size === 1
		&& !signatures.has(undefined)      ;
	if (sameCall) {
		const widths = itemWidths(source, calls.map(call => callArguments(call!))) ;
		if (!hasOutlierWidths(widths)) keep.add("call")                            ;
		else if (kind.name === "declaration") rows = withVerticalOutliers(run, keep, calls as readonly Node[], widths);
	}
	if (tags.has("subscript") && kind.name === "declaration") {
		const parts    = run.map  (row => subscriptPartsOf(source, row.node)                                  ) ;
		const complete = run.every(row => row.boundaries.some(boundary => boundary.axis === "subscript-close")) ;
		if (complete && parts.every(part => part !== undefined) && new Set(parts.map(part => part!.object)).size === 1
			&& !hasOutlierWidths(itemWidths(source, parts.map(part => [part!.index])))) keep.add("subscript");
	}
	for (const tag of tags) {
		if (!tag.startsWith("list:")) continue                                   ;
		if (tag.startsWith("list:arg") && !keep.has("call")) continue            ;
		const cells = run.map(row => rowListCells(source, kind.name, row.node).get(tag));
		if (cells.some(cell => cell === undefined)) continue                     ;
		if (!sameShape(source, cells as readonly ListCell[])) continue           ;
		if (hasOutlierWidths(itemWidths(source, cells.map(cell => (cell as ListCell).items)))) continue;
		keep.add(tag);
	}
	if (keep.size === tags.size) return rows;
	return rows.map(row => ({ node: row.node, vertical: row.vertical, boundaries: row.boundaries.filter(boundary => boundary.layer === undefined || keep.has(boundary.layer)) }));
}

/**
 * Marks the row whose argument is the outlier of a column (import rule B) for the vertical form — only when the
 * call has two or more arguments, so the render actually shortens the row. The remaining rows keep the call layer
 * when no outlier is left among them; otherwise they fall back to one flat layer.
 */
function withVerticalOutliers(run: readonly DetectedRow[], keep: Set<string>, calls: readonly Node[], widths: readonly (readonly number[])[]): readonly DetectedRow[] {
	const arity  = widths[0]!.length    ;
	const marked = run.map(() => false) ;
	if (arity >= 2) {
		for (let index = 0; index < arity; index += 1) {
			const order = widths.map((row, position) => ({ width: row[index] ?? 0, position })).sort((left, right) => right.width - left.width);
			if (order[0]!.width - (order[1]?.width ?? 0) < OUTLIER_GAP) continue    ;
			if (callArguments(calls[order[0]!.position]!).length < 2) continue      ;
			marked[order[0]!.position] = true                                       ;
		}
	}
	if (!marked.some(Boolean)) return run;
	const remaining = widths.filter((_, position) => !marked[position]);
	if (remaining.length > 0 && !hasOutlierWidths(remaining)) keep.add("call");
	return run.map((row, position) => marked[position] ? { node: row.node, boundaries: row.boundaries, vertical: calls[position]! } : row);
}

/** An item cell this much wider than the second widest in its column is an outlier (import rule B); the layer is not applied. */
function hasOutlierWidths(widthsPerRow: readonly (readonly number[])[]): boolean {
	const columns = widthsPerRow[0]!.map((_, index) => widthsPerRow.map(widths => widths[index]!));
	return columns.some(widths => {
		const [widest = 0, second = 0] = [...widths].sort((left, right) => right - left);
		return widest - second >= OUTLIER_GAP;
	});
}

/** The display widths of every item cell per row, the input of the outlier rule. */
function itemWidths(source: SourceFile, itemsPerRow: readonly (readonly Node[])[]): readonly (readonly number[])[] {
	return itemsPerRow.map(items => items.map(item => displayWidth(source.text.slice(item.getStart(source), item.getEnd()))));
}

/**
 * The vertical form of a declaration outlier row: the call's arguments one per line under the opening `(`, each
 * non-last argument comma right after the widest argument (the horizontal call-layer rule), and the closing `);`
 * on the statement's indentation — with the `=` at the table's `=` column. The trailing `//` note and everything
 * after the statement stay in place. Only whitespace and inserted line breaks change.
 */
export function verticalCallText(source: SourceFile, row: DetectedRow, equalsTarget: number, newline: string): string {
	const call      = row.vertical!                                                                                                                                             ;
	const node      = row.node                                                                                                                                                  ;
	const start     = node.getStart(source)                                                                                                                                     ;
	const lineStart = source.getPositionOfLineAndCharacter(source.getLineAndCharacterOfPosition(start).line, 0)                                                                 ;
	const indent    = source.text.slice(lineStart, start)                                                                                                                       ;
	const equals    = row.boundaries.find(boundary => boundary.axis === "equals")!                                                                                              ;
	const callee    = (call as unknown as { readonly expression: Node }).expression                                                                                             ;
	const texts     = callArguments(call).map(item => source.text.slice(item.getStart(source), item.getEnd()))                                                                  ;
	const widest    = Math.max(...texts.map(text => displayWidth(text)))                                                                                                        ;
	const pad       = Math.max(1, equalsTarget - displayColumn(source, equals.from))                                                                                            ;
	const lines     = [`${source.text.slice(lineStart, equals.from)}${" ".repeat(pad)}= ${source.text.slice(callee.getStart(source), callee.getEnd()).replace(/\s+/gu, " ")}(`] ;
	lines.push(...texts.map((text, index) => `${indent}\t${index + 1 < texts.length ? `${text}${" ".repeat(widest - displayWidth(text))},` : text}`));
	lines.push(`${indent});`);
	return lines.join(newline);
}

/** Rows keep a list slot only when every list there has the same items: equal arity for arrays, equal property names for objects. */
function sameShape(source: SourceFile, cells: readonly ListCell[]): boolean {
	const first = cells[0]!;
	return cells.every(cell => cell.items.length === first.items.length && cell.items.every((item, index) => itemName(source, item) === itemName(source, first.items[index]!)));
}

/** The name that must match across rows: the property name of an object item; array items have none. */
function itemName(source: SourceFile, item: Node): string {
	const name = (item as unknown as { readonly name?: Node }).name;
	return name === undefined ? "" : source.text.slice(name.getStart(source), name.getEnd());
}
