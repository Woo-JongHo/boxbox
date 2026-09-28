/**
 * Registry of table row kinds. Each kind detects contiguous rows in a container (detect) and returns the
 * alignable boundary (axis) positions for each row. The alignment engine (06_align-tables.ts) aligns axis
 * columns without knowing the kind. To add a case: 01 which kind is it → 02 which axis is missing → 03 register
 * the kind and axes in this file, add rows to fixtures/table-kinds.ts, and pin them with test/typescript-align.test.ts.
 */
import      {
              isArrayLiteralExpression       ,
              isBlock                        ,
              isAwaitExpression              ,
              isCallExpression               ,
              isCaseClause                   ,
              isReturnStatement              ,
              isClassDeclaration             ,
              isEnumDeclaration              ,
              isExpressionStatement          ,
              isEnumMember                   ,
              isIdentifier                   ,
              isInterfaceDeclaration         ,
              isMethodDeclaration            ,
              isMethodSignatureDeclaration   ,
              isObjectLiteralExpression      ,
              isPropertyAssignment           ,
              isPropertyAccessExpression     ,
              isPropertyDeclaration          ,
              isPropertySignatureDeclaration ,
              isSourceFile                   ,
              isSwitchStatement              ,
              isTypeAliasDeclaration         ,
              isTypeLiteralNode              ,
              isVariableStatement            ,
              SyntaxKind                     ,
                                               } from "typescript/unstable/ast"         ;
import type {
              ObjectLiteralExpression        ,
              Node                           ,
              PropertyAssignment             ,
              SourceFile                     ,
                                               } from "typescript/unstable/ast"         ;
import      { skipTrivia                       } from "typescript/unstable/ast/scanner" ;

import      { displayWidth                     } from "../common/display-width.js"      ;

export interface RowBoundary {
	readonly axis : string ;
	readonly from : number ;
	readonly at   : number ;
	/** true for an insert axis aligned at the existing column (`(`, `)`, `):`, `":`, `//`); false for a gap axis that keeps at least one space. */
	readonly insert? : boolean;
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

function detectDeclaration(source: SourceFile, node: Node): readonly RowBoundary[] | undefined {
	if (!isVariableStatement(node)) return undefined;
	const declarations = node.declarationList.declarations;
	if (declarations.length !== 1) return undefined;
	const declaration = declarations[0]!;
	if (!isIdentifier(declaration.name)) return undefined;
	if (!ownLineOf(source, node, LINE_REST)) return undefined;
	const nameEnd                   = declaration.name.getEnd()        ;
	const boundaries: RowBoundary[] = []                               ;
	const colon                     = tokenAfter(source, nameEnd, ":") ;
	if (colon) boundaries.push({ axis: "colon", from: nameEnd, at: colon });
	const equalsAnchor = declaration.type ? declaration.type.getEnd() : nameEnd ;
	const equals       = tokenAfter(source, equalsAnchor, "=")                  ;
	if (equals) boundaries.push({ axis: "equals", from: equalsAnchor, at: equals });
	if (!colon && !equals) return undefined;
	const contentEnd = node.declarationList.getEnd()       ;
	const semicolon  = tokenAfter(source, contentEnd, ";") ;
	if (!semicolon) return undefined;
	boundaries.push({ axis: "semicolon", from: contentEnd, at: semicolon });
	const comment = trailingComment(source, semicolon + 1);
	if (comment) boundaries.push(comment);
	return boundaries;
}

function detectTypeAlias(source: SourceFile, node: Node): readonly RowBoundary[] | undefined {
	if (!isTypeAliasDeclaration(node)) return undefined;
	if (!ownLineOf(source, node, LINE_REST)) return undefined;
	const anchor = node.typeParameters ? (node.typeParameters as unknown as { readonly end: number }).end : node.name.getEnd() ;
	const equals = tokenAfter(source, anchor, "=")                                                                             ;
	if (!equals) return undefined;
	const semicolon = tokenAfter(source, node.type.getEnd(), ";");
	if (!semicolon) return undefined;
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
	if (!ownLineOf(source, node, LINE_REST)) return undefined;
	const nameEnd = node.name.getEnd()               ;
	const open    = tokenAfter(source, nameEnd, "(") ;
	if (!open) return undefined;
	const parameters    = node.parameters                                        ;
	const hasParameters = parameters.length > 0                                  ;
	const closeAnchor   = hasParameters ? parameters.at(-1)!.getEnd() : open + 1 ;
	const close         = tokenAfter(source, closeAnchor, ")")                   ;
	if (!close) return undefined;
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
	if (!isExpressionStatement(node)) return undefined;
	if (!ownLineOf(source, node, LINE_REST)) return undefined;
	const expression = unwrapExpression(node.expression);
	if (syntaxKindName(expression) !== "BinaryExpression") return undefined;
	const binary = expression as unknown as { operatorToken: Node; left: Node; right: Node };
	if (source.text.slice(binary.operatorToken.getStart(source), binary.operatorToken.getEnd()) !== "=") return undefined;
	const boundaries: RowBoundary[] = []                                            ;
	const equals                    = tokenAfter(source, binary.left.getEnd(), "=") ;
	if (equals === undefined) return undefined;
	boundaries.push({ axis: "equals", from: binary.left.getEnd(), at: equals });
	const semicolon = tokenAfter(source, binary.right.getEnd(), ";");
	if (!semicolon) return undefined;
	boundaries.push({ axis: "semicolon", from: binary.right.getEnd(), at: semicolon });
	const comment = trailingComment(source, semicolon + 1);
	if (comment) boundaries.push(comment);
	return boundaries;
}

function detectCallStatement(source: SourceFile, node: Node): readonly RowBoundary[] | undefined {
	if (!isExpressionStatement(node)) return undefined;
	if (!ownLineOf(source, node, LINE_REST)) return undefined;
	const expression = unwrapExpression(node.expression);
	if (!isCallExpression(expression)) return undefined;
	const matcher = expression.expression;
	if (!isPropertyAccessExpression(matcher) || expression.arguments.length !== 1) return undefined;
	let subject: Node = matcher.expression;
	while (isPropertyAccessExpression(subject)) subject = subject.expression;
	if (!isCallExpression(subject) || subject.arguments.length !== 1) return undefined;
	const subjectClose = subject.getEnd() - 1;
	if (source.text[subjectClose] !== ")") return undefined;
	const matcherDot = tokenAfter(source, matcher.expression.getEnd(), ".");
	if (matcherDot === undefined) return undefined;
	const matcherOpen = tokenAfter(source, matcher.getEnd(), "(");
	if (matcherOpen === undefined) return undefined;
	const matcherClose = expression.getEnd() - 1;
	if (source.text[matcherClose] !== ")") return undefined;
	const semicolon = tokenAfter(source, expression.getEnd(), ";");
	if (semicolon === undefined) return undefined;
	const boundaries: RowBoundary[] = [
		{ axis : "subject-close-paren" , from : subjectClose        , at : subjectClose , insert : true },
		{ axis : "matcher-dot"         , from : matcherDot          , at : matcherDot   , insert : true },
		{ axis : "matcher-open-paren"  , from : matcherOpen         , at : matcherOpen  , insert : true },
		{ axis : "matcher-close-paren" , from : matcherClose        , at : matcherClose , insert : true },
		{ axis : "semicolon"           , from : expression.getEnd() , at : semicolon                    },
	];
	const comment = trailingComment(source, semicolon + 1);
	if (comment) boundaries.push(comment);
	return boundaries;
}

function detectCaseClause(source: SourceFile, node: Node): readonly RowBoundary[] | undefined {
	if (!isCaseClause(node)) return undefined;
	if (!ownLineOf(source, node, LINE_REST)) return undefined;
	const colon = tokenAfter(source, node.expression.getEnd(), ":");
	if (!colon) return undefined;
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
	if (!ownLineOf(source, node, CLOSER_REST)) return undefined;
	const obj        = objectLiteralOf(node)! ;
	const properties = [...obj.properties]    ;
	if (properties.length === 0 || !properties.every(isPropertyAssignment)) return undefined;
	const openBrace = obj.getStart(source);
	if (source.text[openBrace] !== "{") return undefined;
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
	if (!isPropertyAssignment(node)) return undefined;
	if (!ownLineOf(source, node, COMMA_REST)) return undefined;
	const nameEnd = (node.postfixToken ?? node.name).getEnd() ;
	const colon   = tokenAfter(source, nameEnd, ":")          ;
	if (!colon) return undefined;
	const boundaries: RowBoundary[] = [{ axis: "colon", from: nameEnd, at: colon }];
	if (spacesOnly(source, colon + 1, node.initializer.getStart())) {
		boundaries.push({ axis: "value", from: colon + 1, at: node.initializer.getStart() });
	}
	return boundaries;
}

/**
 * Kind priority. Ordered so node syntaxes never overlap and no node is claimed by two kinds; when object-rows
 * claims array-element objects first, registration backs off via seen.
 */
export const ROW_KINDS: readonly RowKind[] = [
	{
		name       : "declaration",
		gap        : "blank",
		containers : node => (isSourceFile(node) || isBlock(node)) ? node.statements : undefined,
		detect     : detectDeclaration,
		groupName  : run => run.some(row => row.boundaries.some(boundary => boundary.axis === "equals")) ? "declaration-equals" : "declaration",
		minRows    : run => run.every(row => row.boundaries.some(boundary => boundary.axis === "equals")) ? 2 : undefined,
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
	"colon"               : "`:` separating a name or identifier from its type or expression",
	"equals"              : "`=` of a declaration, alias or enum member",
	"semicolon"           : "statement-terminating `;`",
	"comma"               : "row-separating `,`",
	"comment"             : "start column of a trailing `//` note",
	"open-paren"          : "parameter-opening `(` (after the name width)",
	"close-paren"         : "parameter-closing `)` (after the minimum inner width)",
	"case-colon"          : "`:` of a case label",
	"call-paren"          : "opening `(` of the first call in a case row",
	"subject-close-paren" : "`)` closing the subject argument cell of a call statement",
	"matcher-dot"         : "`.` before the right-hand matcher of a call statement",
	"matcher-open-paren"  : "`(` opening the matcher argument cell",
	"matcher-close-paren" : "`)` closing the matcher argument cell",
	"return-tail"         : "start column of a bare `return;` at the end of a case row",
	"value"               : "start column of a registration-object expression",
	"property"            : "start column of the property name at each position in an object row",
	"open-brace"          : "opening `{` of an object row",
	"close-brace"         : "closing `}` of an object row",
	"tail"                : "tail after an object row's `}` (`,` `;` `)` `as const`)",
};

export function syntaxKindName(node: Node): string {
	return SyntaxKind[node.kind] ?? `Kind${String(node.kind)}`;
}

/**
 * Axis contract per kind — the single basis shared by authoring time (prompts, doc examples) and check time
 * (06_align-tables). gap axes keep at least one space; insert axes preserve existing conventions (`):`, `":`,
 * `//`) and only align the column. `{i}` marks per-property-position axes of object rows.
 */
export const KIND_AXES: Readonly<Record<string, { readonly gap: readonly string[]; readonly insert: readonly string[] }>> = {
	"declaration"        : { gap: ["colon", "semicolon"], insert: ["comment"] },
	"declaration-equals" : { gap: ["colon", "equals", "semicolon"], insert: ["comment"] },
	"type-alias"         : { gap: ["equals", "semicolon"], insert: ["comment"] },
	"method-signature"   : { gap: [], insert: ["open-paren", "close-paren", "colon", "comment"] },
	"class-method"       : { gap: [], insert: ["open-paren", "close-paren", "colon", "comment"] },
	"interface-members"  : { gap: ["colon", "equals", "semicolon"], insert: ["comment"] },
	"type-members"       : { gap: ["colon", "equals", "semicolon"], insert: ["comment"] },
	"class-members"      : { gap: ["colon", "equals", "semicolon"], insert: ["comment"] },
	"enum-member"        : { gap: ["equals", "comma"], insert: ["comment"] },
	"case-clause"        : { gap: [], insert: ["case-colon", "call-paren", "return-tail"] },
	"assignments"        : { gap: ["equals", "semicolon"], insert: ["comment"] },
	"call-statements"    : { gap: ["semicolon"], insert: ["subject-close-paren", "matcher-dot", "matcher-open-paren", "matcher-close-paren", "comment"] },
	"object-rows"        : { gap: ["property{i}", "colon{i}", "value{i}", "comma{i}", "close-brace"], insert: ["open-brace", "tail"] },
	"registration"       : { gap: ["colon", "value"], insert: [] },
};

export interface DetectedRow {
	readonly node       : Node;
	readonly boundaries : readonly RowBoundary[];
}

/** Groups only contiguous same-kind rows among container siblings. Blank lines, comments or other statements in between break the table. */
export function runsOf(source: SourceFile, siblings: readonly Node[], kind: RowKind): readonly (readonly DetectedRow[])[] {
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
	return runs.filter(run => run.length > 0);
}
