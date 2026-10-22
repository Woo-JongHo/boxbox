import { expect, test } from "bun:test";
import { readFileSync    } from "node:fs";

const FILES = ["README.md", "README.ko.md", "README.zh-CN.md"] as const;

const read     = (name: string): string                  => readFileSync(new URL(`../${name}`, import.meta.url), "utf8")           ;
const blocks   = (text: string): string[]                => [...text.matchAll(/^```[^\n]*\n(.*?)^```/gmsu)].map(match => match[1]) ;
const links    = (text: string): string[]                => [...text.matchAll(/\]\(([^)]*)\)/gu)].map(match => match[1])           ;
const headings = (text: string): number                 => [...text.matchAll(/^## /gmu)].length                                    ;

test("the localized root READMEs keep the English structure, command blocks and link targets", () => {
	const [english, ...translations] = FILES.map(read);
	for (const translation of translations) {
		expect(headings(translation)).toBe   (headings(english)) ;
		expect(blocks  (translation)).toEqual(blocks  (english)) ;
		expect(links   (translation)).toEqual(links   (english)) ;
	}
});

test("every root README links the same three language versions", () => {
	for (const name of FILES) expect(read(name)).toContain("[English](README.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md)"); // cjk-test-data
});

test("no root README still claims the retired ten-language scope", () => {
	for (const name of FILES) expect(read(name)).not.toMatch(/ten development engines|10개 언어|十种语言/u); // cjk-test-data
});
