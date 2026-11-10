/** Hangul, Han and Kana. Terminals and editors render them at different widths, so no column may be placed after them. */
const WIDE = /[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

export function hasWideCharacters(value: string): boolean {
	return WIDE.test(value);
}

/**
 * Characters whose rendered width `displayWidth` cannot state for every monospace CJK font: combining marks,
 * conjoining Hangul jamo, zero-width and directional controls, emoji, CJK symbols and punctuation, enclosed and
 * compatibility CJK, and halfwidth/fullwidth forms. The `east-asian-width` policy still refuses columns after them.
 */
const AMBIGUOUS = /[\p{M}\p{Extended_Pictographic}\u1160-\u11FF\uD7B0-\uD7FF\u200B-\u200F\u202A-\u202E\u2060-\u206F\u2E80-\u303F\u3200-\u33FF\uFE10-\uFE6F\uFF00-\uFFEF]/u;

export function hasAmbiguousWidth(value: string): boolean {
	return AMBIGUOUS.test(value);
}

/** Language-agnostic pure utility. Computes screen display width with tab stops of 4 and Hangul, Han and Kana as 2 columns. */
export function displayWidth(value: string): number {
	let width = 0;
	for (const character of value) {
		if (character === "\t") {
			width += 4 - width % 4;
		} else if (WIDE.test(character)) {
			width += 2;
		} else {
			width += 1;
		}
	}
	return width;
}
