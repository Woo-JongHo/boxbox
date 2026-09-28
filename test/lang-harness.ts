/**
 * Harness for per-language alignment suites. Each language test checks preservation, idempotence, golden,
 * traps and no alignment of 2-row groups with this one function. Language-specific properties are added by each test file's own test() calls.
 */
import { readFileSync }      from "node:fs";
import { expect, test }      from "bun:test";
import { alignSource }       from "../skills/xxx/scripts/common/table-engine.ts";
import type { LineProfiler } from "../skills/xxx/scripts/common/table-engine.ts";

export interface LanguageSuiteInput {
	readonly aligner     : LineProfiler;
	/** Absolute path to fixtures/<language>/. The new URL("../../..", import.meta.url) form is recommended. */
	readonly fixturesDir : string ;
	readonly tableFile   : string ;
	readonly alignedFile : string ;
	readonly trickyFile  : string ;
}

const stripWhitespace = (value: string): string => value.replace(/\s+/gu, "");

export function defineLanguageSuite(input: LanguageSuiteInput): void {
	const { aligner } = input;
	const read    = (name: string): string => readFileSync(`${input.fixturesDir}/${name}`, "utf8")                                ;
	const align   = (source: string): ReturnType<typeof alignSource> => alignSource(source, aligner, { minRows: 3, apply: true }) ;
	const source  = read(input.tableFile)                                                                                         ;
	const aligned = read(input.alignedFile)                                                                                       ;
	const tricky  = read(input.trickyFile)                                                                                        ;

	test(`${aligner.language}: alignment preserves content — equal to the original with all whitespace removed`, () => {
		expect(stripWhitespace(align(source).output)).toBe(stripWhitespace(source));
	});

	test(`${aligner.language}: alignment is idempotent — running twice gives the same result`, () => {
		const once = align(source);
		const twice = align(once.output);
		expect(twice.output).toBe(once.output);
		expect(twice.misaligned).toBe(0);
	});

	test(`${aligner.language}: matches the golden aligned file`, () => {
		expect(align(source).output).toBe(aligned);
	});

	test(`${aligner.language}: the already aligned golden has 0 changes`, () => {
		const result = align(aligned);
		expect(result.misaligned).toBe(0);
		expect(result.output).toBe(aligned);
	});

	test(`${aligner.language}: the string/comment trap file has 0 changes`, () => {
		expect(align(tricky).misaligned).toBe(0);
	});

	test(`${aligner.language}: 2-row groups are not aligned`, () => {
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
