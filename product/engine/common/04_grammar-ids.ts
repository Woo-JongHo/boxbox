/**
 * Grammar ID registry (layer 1, `references/grammar.md`). Lower layers (surface forms, conventions, examples) use only the IDs listed here.
 * `test/surface.test.ts` checks that this list matches the table in grammar.md, so changing only one side fails the test.
 */
export const UNITS              = ["WORD", "SENTENCE", "PARAGRAPH", "TEXT"] as const                                                             ;
export const ROLES              = ["NAME", "TYPE", "VALUE", "KEY", "ITEM", "SOURCE", "TARGET", "ACTION", "ARGS", "CONDITION", "RESULT"] as const ;
export const PATTERNS           = ["IMPORT", "DEFINE", "DESCRIBE", "MAP", "LIST", "DO", "CHANGE", "WHEN", "EXIT"] as const                       ;
export const PARAGRAPH_PURPOSES = ["CHECK", "PREPARE", "DECIDE", "ACT", "RESULT"] as const                                                       ;
export const GENRES             = ["BUSINESS", "ALGORITHM", "TEST", "CONFIG"] as const                                                           ;

export type Pattern = (typeof PATTERNS)[number];

export function isPattern(value: unknown): value is Pattern {
	return typeof value === "string" && (PATTERNS as readonly string[]).includes(value);
}
