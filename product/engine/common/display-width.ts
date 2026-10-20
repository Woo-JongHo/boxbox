/** Language-agnostic pure utility. Computes screen display width with tab stops of 4 and Hangul, Han and Kana as 2 columns. */
export function displayWidth(value: string): number {
	let width = 0;
	for (const character of value) {
		if (character === "\t") {
			width += 4 - width % 4;
		} else if (/[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(character)) {
			width += 2;
		} else {
			width += 1;
		}
	}
	return width;
}
