/**
 * Whitespace-only edit check for TypeScript, based on the TypeScript 7 scanner. Two texts are equivalent when their
 * token streams — every token, comment and line break, with its exact text — are identical; only horizontal
 * whitespace trivia is ignored. Ambiguous slash contexts are unavailable without parser disambiguation; changed
 * comparisons refuse them and expose no editable gaps. Unambiguous templates and regular expressions are re-scanned.
 */
import      { SyntaxKind    } from "typescript/unstable/ast"         ;
import      { createScanner } from "typescript/unstable/ast/scanner" ;

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

function scan(text: string, visit: (kind: SyntaxKind, text: string, start: number, end: number) => void): void {
	const scanner                           = createScanner(false, undefined, text) ;
	const braces : ("block" | "template")[] = []                                    ;
	let previous                            = SyntaxKind.Unknown                    ;
	let prior                               = SyntaxKind.Unknown                    ;
	let separatedByBreak                    = false                                 ;
	let lastEnd                             = 0                                     ;

	// LS/PS are skipped between scanner tokens; token-internal separators remain in that token's exact text.
	const skippedLineBreaks = (end: number): void => {
		for (let start = lastEnd; start < end; start += 1) {
			const value = text[start]!;
			if (value === "\u2028" || value === "\u2029") visit(SyntaxKind.NewLineTrivia, value, start, start + 1);
		}
	};

	for (let kind = scanner.scan(); kind !== SyntaxKind.EndOfFile; kind = scanner.scan()) {
		skippedLineBreaks(scanner.getTokenStart());
		// The scanner skips Unicode LS/PS tokens but carries their line break on the next token, including trivia.
		separatedByBreak ||= scanner.hasPrecedingLineBreak();
		if (kind === SyntaxKind.WhitespaceTrivia) {
			visit(kind, scanner.getTokenText(), scanner.getTokenStart(), scanner.getTokenEnd());
			lastEnd = scanner.getTokenEnd();
			continue;
		}
		if (kind === SyntaxKind.OpenBraceToken) braces.push("block");
		else if (kind === SyntaxKind.TemplateHead) braces.push("template");
		else if (kind === SyntaxKind.CloseBraceToken && braces.pop() === "template") {
			kind = scanner.reScanTemplateToken(false);
			if (kind === SyntaxKind.TemplateMiddle) braces.push("template");
		} else if (kind === SyntaxKind.SlashToken || kind === SyntaxKind.SlashEqualsToken) {
			if (previous === SyntaxKind.CloseParenToken || previous === SyntaxKind.CloseBraceToken || separatedByBreak && DIVISION_AFTER.has(previous)) {
				throw new TypeScriptSlashAmbiguityError();
			}
			if (!DIVISION_AFTER.has(previous)) {
				if (!REGEX_AFTER.has(previous) || prior === SyntaxKind.DotToken || prior === SyntaxKind.QuestionDotToken) throw new TypeScriptSlashAmbiguityError();
				kind = scanner.reScanSlashToken();
			}
		}
		visit(kind, scanner.getTokenText(), scanner.getTokenStart(), scanner.getTokenEnd());
		lastEnd = scanner.getTokenEnd();
		if (!TRIVIA.has(kind)) {
			prior            = previous ;
			previous         = kind     ;
			separatedByBreak = false    ;
		}
	}
	skippedLineBreaks(text.length);
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
	try {
		scan(text, (kind, _value, start, end) => { if (kind === SyntaxKind.WhitespaceTrivia) ranges.push({ start, end }); });
		return ranges;
	} catch (error) {
		if (error instanceof TypeScriptSlashAmbiguityError) return [];
		throw error;
	}
}

/** True when `after` differs from `before` only in horizontal whitespace between tokens. */
export function preservesTokens(before: string, after: string): boolean {
	if (before === after) return true;
	try {
		const left  = tokenStream(before) ;
		const right = tokenStream(after ) ;
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
export function preservesTokensWithBreaks(before: string, after: string): boolean {
	if (before === after) return true;
	try {
		const dropBreaks = (tokens: readonly string[]): readonly string[] => tokens.filter(token => !token.startsWith(`${String(SyntaxKind.NewLineTrivia)}:`)) ;
		const left       = dropBreaks(tokenStream(before))                                                                                                     ;
		const right      = dropBreaks(tokenStream(after ))                                                                                                     ;
		return left.length === right.length && left.every((token, index) => token === right[index]);
	} catch (error) {
		if (error instanceof TypeScriptSlashAmbiguityError) return false;
		throw error;
	}
}
