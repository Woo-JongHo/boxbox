/**
 * 문법 ID 레지스트리 (1층, `references/grammar.md`). 아래 층(표현형·약속·예문집)은 여기 있는 ID만 쓴다.
 * `test/surface.test.ts`가 이 목록과 grammar.md의 표가 같은지 확인하므로, 한쪽만 바꾸면 테스트가 실패한다.
 */
export const UNITS              = ["WORD", "SENTENCE", "PARAGRAPH", "TEXT"] as const                                                             ;
export const ROLES              = ["NAME", "TYPE", "VALUE", "KEY", "ITEM", "SOURCE", "TARGET", "ACTION", "ARGS", "CONDITION", "RESULT"] as const ;
export const PATTERNS           = ["IMPORT", "DEFINE", "DESCRIBE", "MAP", "LIST", "DO", "CHANGE", "WHEN", "EXIT"] as const                       ;
export const PARAGRAPH_PURPOSES = ["CHECK", "PREPARE", "DECIDE", "ACT", "RESULT"] as const                                                       ;
export const GENRES             = ["BUSINESS", "ALGORITHM", "TEST", "CONFIG"] as const                                                           ;

export type Pattern = (typeof PATTERNS)[number] ;

export function isPattern(value: unknown): value is Pattern {
	return typeof value === "string" && (PATTERNS as readonly string[]).includes(value) ;
}
