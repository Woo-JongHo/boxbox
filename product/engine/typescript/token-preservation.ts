/**
 * Whitespace-only edit check for TypeScript, based on the TypeScript 7 scanner. Two texts are equivalent when their
 * token streams — every token, comment and line break, with its exact text — are identical; only horizontal
 * whitespace trivia is ignored. Template literals and regular expressions are re-scanned the way the parser does,
 * so whitespace inside them is compared as part of the token text.
 */
import      { SyntaxKind    } from "typescript/unstable/ast"         ;
import      { createScanner } from "typescript/unstable/ast/scanner" ;

/** After these tokens a `/` is division; anywhere else it starts a regular expression. */
const DIVISION_AFTER = new Set<SyntaxKind>([
	SyntaxKind.Identifier,
	SyntaxKind.NumericLiteral,
	SyntaxKind.BigIntLiteral,
	SyntaxKind.StringLiteral,
	SyntaxKind.NoSubstitutionTemplateLiteral,
	SyntaxKind.TemplateTail,
	SyntaxKind.CloseParenToken,
	SyntaxKind.CloseBracketToken,
	SyntaxKind.CloseBraceToken,
	SyntaxKind.PlusPlusToken,
	SyntaxKind.MinusMinusToken,
	SyntaxKind.ThisKeyword,
	SyntaxKind.SuperKeyword,
	SyntaxKind.TrueKeyword,
	SyntaxKind.FalseKeyword,
	SyntaxKind.NullKeyword,
]);

const TRIVIA = new Set<SyntaxKind>([SyntaxKind.NewLineTrivia, SyntaxKind.SingleLineCommentTrivia, SyntaxKind.MultiLineCommentTrivia]);

function scan(text: string, visit: (kind: SyntaxKind, text: string, start: number, end: number) => void): void {
	const scanner                           = createScanner(false, undefined, text) ;
	const braces : ("block" | "template")[] = []                                    ;
	let previous                            = SyntaxKind.Unknown                    ;
	for (let kind = scanner.scan(); kind !== SyntaxKind.EndOfFile; kind = scanner.scan()) {
		if (kind === SyntaxKind.WhitespaceTrivia) {
			visit(kind, scanner.getTokenText(), scanner.getTokenStart(), scanner.getTokenEnd());
			continue;
		}
		if (kind === SyntaxKind.OpenBraceToken) braces.push("block");
		else if (kind === SyntaxKind.TemplateHead) braces.push("template");
		else if (kind === SyntaxKind.CloseBraceToken && braces.pop() === "template") {
			kind = scanner.reScanTemplateToken(false);
			if (kind === SyntaxKind.TemplateMiddle) braces.push("template");
		} else if ((kind === SyntaxKind.SlashToken || kind === SyntaxKind.SlashEqualsToken) && !DIVISION_AFTER.has(previous)) {
			kind = scanner.reScanSlashToken();
		}
		visit(kind, scanner.getTokenText(), scanner.getTokenStart(), scanner.getTokenEnd());
		if (!TRIVIA.has(kind)) previous = kind;
	}
}

/** Token stream of `text` without horizontal whitespace: `kind:text` per token, comment and line break. */
export function tokenStream(text: string): readonly string[] {
	const tokens: string[] = [];
	scan(text, (kind, value) => { if (kind !== SyntaxKind.WhitespaceTrivia) tokens.push(`${kind}:${value}`); });
	return tokens;
}

/** Scanner-confirmed horizontal whitespace spans, in UTF-16 offsets. */
export function horizontalWhitespaceRanges(text: string): readonly { readonly start: number; readonly end: number }[] {
	const ranges: { start: number; end: number }[] = [];
	scan(text, (kind, _value, start, end) => { if (kind === SyntaxKind.WhitespaceTrivia) ranges.push({ start, end }); });
	return ranges;
}

/** True when `after` differs from `before` only in horizontal whitespace between tokens. */
export function preservesTokens(before: string, after: string): boolean {
	const left  = tokenStream(before) ;
	const right = tokenStream(after ) ;
	return left.length === right.length && left.every((token, index) => token === right[index]);
}

/**
 * Like `preservesTokens`, but line breaks may move, be inserted or be removed while every other token and comment
 * remains identical. Callers use a parser or a narrower edit contract to prove that the changed line structure is
 * safe for their operation.
 */
export function preservesTokensWithBreaks(before: string, after: string): boolean {
	const dropBreaks = (tokens: readonly string[]): readonly string[] => tokens.filter(token => !token.startsWith(`${String(SyntaxKind.NewLineTrivia)}:`)) ;
	const left       = dropBreaks(tokenStream(before))                                                                                                     ;
	const right      = dropBreaks(tokenStream(after ))                                                                                                     ;
	return left.length === right.length && left.every((token, index) => token === right[index]);
}
