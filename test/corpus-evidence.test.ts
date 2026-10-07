import      { describe, expect, test  } from "bun:test"                        ;

import      { observationOf           } from "../scripts/corpus-signatures.ts" ;
import type { CensusRow, CorpusSource } from "../scripts/corpus-signatures.ts" ;

const source: CorpusSource = {
	id         : "fixture",
	language   : "python",
	repository : "example/fixture",
	commit     : "0123456789012345678901234567890123456789",
	license    : "MIT",
	paths      : [],
};

const row: CensusRow = {
	signature  : "python||table|name>equal>value|d0",
	lookupKey  : "v1|python|-|table|name>equal>value",
	language   : "python",
	kind       : "table",
	state      : "FIXABLE",
	rows       : 3,
	edits      : 2,
	spot       : { source: "fixture", file: "sample.py", startLine: 4, endLine: 6, rows: 3 },
	sourceHash : `sha256:${"a".repeat(64)}`,
};

describe("raw corpus evidence", () => {
	test("preserves the lookup key, diagnostic signature, provenance and whole-file hash losslessly", () => {
		const observation = observationOf(row, source);
		expect(observation).toMatchObject({
			schemaVersion : 1,
			lookupKey     : row.lookupKey,
			signature     : row.signature,
			source        : { id: source.id, repository: source.repository, commit: source.commit, license: source.license },
			file          : "sample.py",
			startLine     : 4,
			endLine       : 6,
			sourceHash    : row.sourceHash,
		});
	});

	test("IDs are stable without time and change when the location or provenance changes", () => {
		const first  = observationOf(row       , source       ) ;
		const repeat = observationOf({ ...row }, { ...source }) ;
		const moved  = observationOf(
			{ ...row, spot: { ...row.spot, startLine: 5 } },
			source
		);
		const repin  = observationOf(
			row                                  ,
			{ ...source, commit: "f".repeat(40) }
		);
		expect(first.id )    .toMatch(/^sha256:[0-9a-f]{64}$/) ;
		expect(repeat.id)    .toBe   (first.id               ) ;
		expect(moved.id ).not.toBe   (first.id               ) ;
		expect(repin.id ).not.toBe   (first.id               ) ;
	});
});
