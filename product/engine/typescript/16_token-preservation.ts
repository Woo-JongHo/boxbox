/**
 * Whitespace-only edit check for TypeScript, based on the TypeScript 7 scanner. Two texts are equivalent when their
 * token streams — every token, comment and line break, with its exact text — are identical; only horizontal
 * whitespace trivia is ignored. Ambiguous slash contexts are unavailable without parser disambiguation; changed
 * comparisons refuse them and expose no editable gaps. A matching parser snapshot supplies exact slash roles;
 * candidate roles are replayed only while comparing exact token bytes. Final writes still reparse both layouts.
 */
import      {
              isBinaryExpression,
              isJsxClosingElement,
              isJsxSelfClosingElement,
              SyntaxKind,
            } from "typescript/unstable/ast";
import type { Node, SourceFile               } from "typescript/unstable/ast"         ;
import      { createScanner                  } from "typescript/unstable/ast/scanner" ;

/** Ordinary same-line expression endings; parentheses, braces and intervening line breaks remain ambiguous. */
const DIVISION_AFTER = new Set<SyntaxKind>([
	SyntaxKind.Identifier,
	SyntaxKind.NumericLiteral,
	SyntaxKind.BigIntLiteral,
	SyntaxKind.StringLiteral,
	SyntaxKind.RegularExpressionLiteral,
	SyntaxKind.NoSubstitutionTemplateLiteral,
	SyntaxKind.TemplateTail,
	SyntaxKind.CloseParenToken,
	SyntaxKind.CloseBracketToken,
	SyntaxKind.CloseBraceToken,
	SyntaxKind.PrivateIdentifier,
	SyntaxKind.ThisKeyword,
	SyntaxKind.SuperKeyword,
	SyntaxKind.TrueKeyword,
	SyntaxKind.FalseKeyword,
	SyntaxKind.NullKeyword,
]);

/** Only confirmed operand prefixes start a regex; every other unclassified context is unavailable. */
const REGEX_AFTER = new Set<SyntaxKind>([
	SyntaxKind.TemplateHead,
	SyntaxKind.TemplateMiddle,
	SyntaxKind.Unknown,
	SyntaxKind.OpenParenToken,
	SyntaxKind.OpenBracketToken,
	SyntaxKind.OpenBraceToken,
	SyntaxKind.CommaToken,
	SyntaxKind.SemicolonToken,
	SyntaxKind.ColonToken,
	SyntaxKind.QuestionToken,
	SyntaxKind.EqualsGreaterThanToken,
	SyntaxKind.EqualsToken,
	SyntaxKind.PlusToken,
	SyntaxKind.MinusToken,
	SyntaxKind.AsteriskToken,
	SyntaxKind.AsteriskAsteriskToken,
	SyntaxKind.SlashToken,
	SyntaxKind.PercentToken,
	SyntaxKind.AmpersandToken,
	SyntaxKind.BarToken,
	SyntaxKind.CaretToken,
	SyntaxKind.AmpersandAmpersandToken,
	SyntaxKind.BarBarToken,
	SyntaxKind.QuestionQuestionToken,
	SyntaxKind.EqualsEqualsToken,
	SyntaxKind.EqualsEqualsEqualsToken,
	SyntaxKind.ExclamationEqualsToken,
	SyntaxKind.ExclamationEqualsEqualsToken,
	SyntaxKind.LessThanEqualsToken,
	SyntaxKind.GreaterThanEqualsToken,
	SyntaxKind.LessThanLessThanToken,
	SyntaxKind.TildeToken,
	SyntaxKind.PlusEqualsToken,
	SyntaxKind.MinusEqualsToken,
	SyntaxKind.AsteriskEqualsToken,
	SyntaxKind.AsteriskAsteriskEqualsToken,
	SyntaxKind.SlashEqualsToken,
	SyntaxKind.PercentEqualsToken,
	SyntaxKind.AmpersandEqualsToken,
	SyntaxKind.BarEqualsToken,
	SyntaxKind.CaretEqualsToken,
	SyntaxKind.AmpersandAmpersandEqualsToken,
	SyntaxKind.BarBarEqualsToken,
	SyntaxKind.QuestionQuestionEqualsToken,
	SyntaxKind.LessThanLessThanEqualsToken,
	SyntaxKind.GreaterThanGreaterThanEqualsToken,
	SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
	SyntaxKind.DotDotDotToken,
	SyntaxKind.ReturnKeyword,
	SyntaxKind.ThrowKeyword,
	SyntaxKind.CaseKeyword,
	SyntaxKind.DeleteKeyword,
	SyntaxKind.VoidKeyword,
	SyntaxKind.TypeOfKeyword,
	SyntaxKind.NewKeyword,
	SyntaxKind.InKeyword,
	SyntaxKind.InstanceOfKeyword,
	SyntaxKind.ElseKeyword,
	SyntaxKind.DoKeyword,
	SyntaxKind.DefaultKeyword,
]);

const TRIVIA = new Set<SyntaxKind>([SyntaxKind.NewLineTrivia, SyntaxKind.SingleLineCommentTrivia, SyntaxKind.MultiLineCommentTrivia]);

/** Bounded refusal: callers must not infer editable whitespace from a partial token stream. */
export class TypeScriptSlashAmbiguityError extends Error {
	constructor() {
		super("TypeScript ambiguous slash requires parser disambiguation");
	}
}

type SlashRole = "regex" | "division" | "jsx";

interface ParsedToken {
	readonly kind         : SyntaxKind ;
	readonly end          : number     ;
	readonly allowCodeGap : boolean    ;
}

interface OpaqueToken {
	readonly index        : number     ;
	readonly kind         : SyntaxKind ;
	readonly text         : string     ;
	readonly allowCodeGap : boolean    ;
}

interface ScanTrace {
	readonly slashes : readonly SlashRole[]   ;
	readonly opaque  : readonly OpaqueToken[] ;
}

/** Parser positions distinguish division and JSX delimiters, and own the exact bytes of JSX text/attributes. */
function parsedLexicalContext(source: SourceFile) {
	const slashes = new Map<number, { readonly role: SlashRole; readonly end: number }>() ;
	const opaque  = new Map<number, ParsedToken>()                                        ;
	const visit = (node: Node): void => {
		const jsxText = node.kind === SyntaxKind.JsxText || node.kind === SyntaxKind.JsxTextAllWhiteSpaces;
		if (jsxText || node.kind === SyntaxKind.RegularExpressionLiteral || node.kind === SyntaxKind.StringLiteral && node.parent.kind === SyntaxKind.JsxAttribute) {
			// getStart() strips leading JSX whitespace, which is literal content rather than a code gap.
			const start = jsxText ? node.pos : node.getStart(source);
			if (node.getEnd() > start) opaque.set(start, { kind: node.kind, end: node.getEnd(), allowCodeGap: !jsxText });
		}

		// Arithmetic operators and JSX delimiters carry different parser-owned roles.
		if (isBinaryExpression(node) && (node.operatorToken.kind === SyntaxKind.SlashToken || node.operatorToken.kind === SyntaxKind.SlashEqualsToken)) {
			slashes.set(node.operatorToken.getStart(source), { role: "division", end: node.operatorToken.getEnd() });
		}

		if (isJsxClosingElement(node)                  ) {
			const start = node        .getStart(  source  ) ;
			const name  = node.tagName.getStart(  source  ) ;
			const slash = source.text .indexOf ("/", start) ;
			if (slash < name && /^<\s*\/\s*$/u.test(source.text.slice(start, name))) slashes.set(slash, { role: "jsx", end: slash + 1 });
		}
		if (node.kind === SyntaxKind.JsxClosingFragment) {
			const start = node       .getStart(  source  ) ;
			const slash = source.text.indexOf ("/", start) ;
			if (/^<\s*\/\s*>$/u.test(source.text.slice(start, node.getEnd()))) slashes.set(slash, { role: "jsx", end: slash + 1 });
		}
		if (isJsxSelfClosingElement(node)              ) {
			const slash = source.text.lastIndexOf("/", node.getEnd() - 1);
			if (slash >= node.attributes.getEnd() && /^\/\s*>$/u.test(source.text.slice(slash, node.getEnd()))) slashes.set(slash, { role: "jsx", end: slash + 1 });
		}
		node.forEachChild(child => { visit(child); return undefined; });
	};
	visit(source);
	return { slashes, opaque };
}

function scan(
	text    : string                                                               ,
	visit   : (kind: SyntaxKind, text: string, start: number, end: number) => void ,
	parsed? : SourceFile                                                           ,
	replay? : ScanTrace                                                            ,
): ScanTrace {
	if (parsed && parsed.text !== text) throw new TypeScriptSlashAmbiguityError();
	const context                                 = parsed ? parsedLexicalContext(parsed) : undefined ;
	const slashRoles   : SlashRole[]              = []                                                ;
	const opaqueTokens : OpaqueToken[]            = []                                                ;
	const scanner                                 = createScanner(false, undefined, text)             ;
	const braces       : ("block" | "template")[] = []                                                ;
	let previous                                  = SyntaxKind.Unknown                                ;
	let prior                                     = SyntaxKind.Unknown                                ;
	let separatedByBreak                          = false                                             ;
	let lastEnd                                   = 0                                                 ;
	let tokenIndex                                = 0                                                 ;
	const emit = (kind: SyntaxKind, value: string, start: number, end: number): void => {
		visit(kind, value, start, end);
		if (kind !== SyntaxKind.WhitespaceTrivia && kind !== SyntaxKind.NewLineTrivia) tokenIndex += 1;
	};
	// LS/PS are skipped between scanner tokens; token-internal separators remain in that token's exact text.
	const skippedLineBreaks = (end: number): void => {
		for (let start = lastEnd; start < end; start += 1) {
			const value = text[start]!;
			if (value === "\u2028" || value === "\u2029") emit(SyntaxKind.NewLineTrivia, value, start, start + 1);
		}
	};

	for (;;) {
		const cursor   = scanner.getTokenEnd()               ;
		const literal  = context?.opaque.get(cursor)         ;
		const expected = replay?.opaque[opaqueTokens.length] ;

		const replayLiteral = expected?.index === tokenIndex
			&& !(expected.allowCodeGap && /^[\s\uFEFF]$/u.test(text[cursor] ?? ""))
			? expected : undefined;
		if (literal || replayLiteral) {
			const kind  = literal?.kind ?? replayLiteral!.kind                ;
			const end   = literal?.end ?? cursor + replayLiteral!.text.length ;
			const value = text.slice(cursor, end)                             ;
			opaqueTokens.push({ index: tokenIndex, kind, text: value, allowCodeGap: literal?.allowCodeGap ?? replayLiteral!.allowCodeGap });
			emit(kind, value, cursor, end);
			scanner.resetTokenState(end);
			lastEnd          = end      ;
			prior            = previous ;
			previous         = kind     ;
			separatedByBreak = false    ;
			continue;
		}
		let kind = scanner.scan();
		if (kind === SyntaxKind.EndOfFile) break;
		skippedLineBreaks(scanner.getTokenStart());
		separatedByBreak ||= scanner.hasPrecedingLineBreak();
		if (kind === SyntaxKind.WhitespaceTrivia) {
			emit(kind, scanner.getTokenText(), scanner.getTokenStart(), scanner.getTokenEnd());
			lastEnd = scanner.getTokenEnd();
			continue;
		}
		if (kind === SyntaxKind.OpenBraceToken) braces.push("block");
		else if (kind === SyntaxKind.TemplateHead) braces.push("template");
		else if (kind === SyntaxKind.CloseBraceToken && braces.pop() === "template") {
			kind = scanner.reScanTemplateToken(false);
			if (kind === SyntaxKind.TemplateMiddle) braces.push("template");
		} else if (kind === SyntaxKind.SlashToken || kind === SyntaxKind.SlashEqualsToken) {
			const parsedRole = context?.slashes.get(scanner.getTokenStart())          ;
			const role       = parsedRole?.role ?? replay?.slashes[slashRoles.length] ;
			if (context || replay) {
				if (role === undefined) throw new TypeScriptSlashAmbiguityError();
				if (role === "regex") kind = scanner.reScanSlashToken();
			} else {
				if (previous === SyntaxKind.CloseParenToken || previous === SyntaxKind.CloseBraceToken || separatedByBreak && DIVISION_AFTER.has(previous)) throw new TypeScriptSlashAmbiguityError();
				if (!DIVISION_AFTER.has(previous)) {
					if (!REGEX_AFTER.has(previous) || prior === SyntaxKind.DotToken || prior === SyntaxKind.QuestionDotToken) throw new TypeScriptSlashAmbiguityError();
					kind = scanner.reScanSlashToken();
				}
			}
			if (parsedRole && scanner.getTokenEnd() !== parsedRole.end) throw new TypeScriptSlashAmbiguityError();
			slashRoles.push(role ?? (kind === SyntaxKind.RegularExpressionLiteral ? "regex" : "division"));
		}
		emit(kind, scanner.getTokenText(), scanner.getTokenStart(), scanner.getTokenEnd());
		lastEnd = scanner.getTokenEnd();
		if (!TRIVIA.has(kind)) {
			prior            = previous ;
			previous         = kind     ;
			separatedByBreak = false    ;
		}
	}
	skippedLineBreaks(text.length);
	if (context && (slashRoles.length !== context.slashes.size || opaqueTokens.length !== context.opaque.size)
		|| replay && (slashRoles.length !== replay.slashes.length || opaqueTokens.length !== replay.opaque.length)) throw new TypeScriptSlashAmbiguityError();
	return { slashes: slashRoles, opaque: opaqueTokens };
}

/** Token stream without horizontal whitespace. An optional parser snapshot must describe this exact text. */
export function tokenStream(text: string, parsed?: SourceFile): readonly string[] {
	const tokens: string[] = [];
	scan(text, (kind, value) => { if (kind !== SyntaxKind.WhitespaceTrivia) tokens.push(`${kind}:${value}`); }, parsed);
	return tokens;
}

/** Scanner-confirmed horizontal gaps, in UTF-16 offsets; an exact parser snapshot resolves otherwise ambiguous slashes. */
export function horizontalWhitespaceRanges(text: string, parsed?: SourceFile): readonly { readonly start: number; readonly end: number }[] {
	const ranges: { start: number; end: number }[] = [];
	try {
		scan(text, (kind, _value, start, end) => { if (kind === SyntaxKind.WhitespaceTrivia) ranges.push({ start, end }); }, parsed);
		return ranges;
	} catch (error) {
		if (error instanceof TypeScriptSlashAmbiguityError) return [];
		throw error;
	}
}

/** True for horizontal gaps only. Optional `parsed` is the parser snapshot of `before`, never a candidate supplied by a formatter. */
export function preservesTokens(before: string, after: string, parsed?: SourceFile): boolean {
	if (before === after) return true;
	try {
		const { left, right } = comparedTokens(before, after, parsed);
		return left.length === right.length && left.every((token, index) => token === right[index]);
	} catch (error) {
		if (error instanceof TypeScriptSlashAmbiguityError) return false;
		throw error;
	}
}

/**
 * Like `preservesTokens`, but line breaks may move, be inserted or be removed while every other token and comment
 * remains identical. Callers use a parser or a narrower edit contract to prove that the changed line structure is
 * safe for their operation.
 */
export function preservesTokensWithBreaks(before: string, after: string, parsed?: SourceFile): boolean {
	if (before === after) return true;
	try {
		const dropBreaks = (tokens: readonly string[]): readonly string[] => tokens.filter(token => !token.startsWith(`${String(SyntaxKind.NewLineTrivia)}:`)) ;
		const tokens     = comparedTokens(before, after, parsed)                                                                                               ;
		const left       = dropBreaks(tokens.left)                                                                                                             ;
		const right      = dropBreaks(tokens.right)                                                                                                            ;
		return left.length === right.length && left.every((token, index) => token === right[index]);
	} catch (error) {
		if (error instanceof TypeScriptSlashAmbiguityError) return false;
		throw error;
	}
}

function comparedTokens(before: string, after: string, parsed?: SourceFile): { readonly left: readonly string[]; readonly right: readonly string[] } {
	if (!parsed) return { left: tokenStream(before), right: tokenStream(after) };
	const left  : string[] = [] ;
	const right : string[] = [] ;
	const collect = (tokens: string[]) => (kind: SyntaxKind, value: string): void => {
		if (kind !== SyntaxKind.WhitespaceTrivia) tokens.push(`${kind}:${value}`);
	};
	const roles = scan(before, collect(left), parsed);
	// Replaying parser-confirmed roles does not trust candidate offsets: exact token bytes and
	// role count must still match, and the write pipeline independently reparses the final text.
	scan(after, collect(right), undefined, roles);
	return { left, right };
}
