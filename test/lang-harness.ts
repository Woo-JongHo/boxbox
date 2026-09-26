/**
 * 언어별 정렬 스위트 하네스. 각 언어 테스트는 이 함수 하나로 보존·멱등·골든·함정·
 * 2행 미정렬 성질을 전부 검사한다. 언어 고유 성질은 각 테스트 파일이 test()를 더해 보강한다.
 */
import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { alignSource, type LineProfiler } from "../skills/woo-code-readability/scripts/common/table-engine.ts";

export interface LanguageSuiteInput {
	readonly aligner     : LineProfiler;
	/** fixtures/<언어>/ 절대 경로. new URL("../../..", import.meta.url) 형태를 권장한다. */
	readonly fixturesDir : string;
	readonly tableFile   : string;
	readonly alignedFile : string;
	readonly trickyFile  : string;
}

const stripWhitespace = (value: string): string => value.replace(/\s+/gu, "");

export function defineLanguageSuite(input: LanguageSuiteInput): void {
	const { aligner } = input;
	const read  = (name: string): string => readFileSync(`${input.fixturesDir}/${name}`, "utf8");
	const align = (source: string): ReturnType<typeof alignSource> => alignSource(source, aligner, { minRows: 3, apply: true });
	const source = read(input.tableFile);
	const aligned = read(input.alignedFile);
	const tricky = read(input.trickyFile);

	test(`${aligner.language}: 정렬은 내용을 보존한다 — 모든 공백을 지우면 원본과 같다`, () => {
		expect(stripWhitespace(align(source).output)).toBe(stripWhitespace(source));
	});

	test(`${aligner.language}: 정렬은 멱등하다 — 두 번 돌려도 같다`, () => {
		const once = align(source);
		const twice = align(once.output);
		expect(twice.output).toBe(once.output);
		expect(twice.misaligned).toBe(0);
	});

	test(`${aligner.language}: 골든 정렬본과 같다`, () => {
		expect(align(source).output).toBe(aligned);
	});

	test(`${aligner.language}: 이미 정렬된 골든은 0 변경`, () => {
		const result = align(aligned);
		expect(result.misaligned).toBe(0);
		expect(result.output).toBe(aligned);
	});

	test(`${aligner.language}: 문자열·주석 함정 파일은 0 변경`, () => {
		expect(align(tricky).misaligned).toBe(0);
	});

	test(`${aligner.language}: 2행 그룹은 정렬하지 않는다`, () => {
		const result = align(source);
		expect(result.pairs.length).toBeGreaterThan(0);
		const sourceLines = source.split("\n");
		for (const pair of result.pairs) {
			for (let index = pair.startLine - 1; index < pair.endLine; index += 1) {
				expect(result.output.split("\n")[index]).toBe(sourceLines[index]);
			}
		}
	});
}
