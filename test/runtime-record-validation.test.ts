import      { describe, expect, test               } from "bun:test"                ;

import      { parseConventions, validateConvention } from "@/common/conventions.ts" ;
import      {
              contentHashOf                      ,
              parseRecords                       ,
              validateDecision                   ,
              validateExample                    ,
                                                   } from "@/common/examples.ts"    ;

const convention = {
	schemaVersion : 1,
	id            : "rule",
	key           : "v1|typescript|SourceFile|declaration-equals|equals>semicolon",
	pattern       : "DEFINE",
	status        : "candidate",
	scope         : "**",
	versions      : { grammar: 1 },
	approvedBy    : "",
	date          : "",
};

const before = "const a=1;\n"   ;
const after  = "const a = 1;\n" ;
const example = {
	schemaVersion : 1,
	id            : "example",
	status        : "candidate",
	versions      : { grammar: 1 },
	language      : "typescript",
	regime        : "table",
	patterns      : ["DEFINE"],
	rules         : ["rule"],
	before,
	after,
	contentHash : contentHashOf(before, after),
	verdict     : "after-better",
	asserts     : { after: { fixedPoint: true, lacks: ["A12"] } },
	source      : { kind: "synthetic", license: "local" },
	approvedBy  : "",
	date        : "",
};

const decision = {
	schemaVersion : 1,
	id            : "rule",
	kind          : "rule",
	layer         : "convention",
	ref           : "rules.md#Rule",
	docHash       : "sha256:value",
	examples      : ["example"],
	approvedBy    : "",
	date          : "",
};

function without(record: Readonly<Record<string, unknown>>, key: string): Record<string, unknown> {
	const copy = { ...record };
	delete copy[key];
	return copy;
}

describe("runtime record roots", () => {
	test("all validators reject null, arrays and primitives as records", () => {
		for (const value of [null, [], "record", 1, true]) {
			expect(() => validateConvention(value, "convention")).toThrow("record must be a JSON object") ;
			expect(() => validateExample(value, "example")      ).toThrow("record must be a JSON object") ;
			expect(() => validateDecision(value, "decision")    ).toThrow("record must be a JSON object") ;
		}
	});
});

describe("convention runtime shape", () => {
	test("requires every declared field and validates optional nested values", () => {
		for (const field of ["schemaVersion", "id", "key", "pattern", "status", "scope", "versions", "approvedBy", "date"]) {
			expect(() => validateConvention(without(convention, field), "convention")).toThrow();
		}
		expect(() => validateConvention({ ...convention, versions: [] }, "convention")                  ).toThrow("versions: record"   ) ;
		expect(() => validateConvention({ ...convention, versions: { grammar: "1" } }, "convention")    ).toThrow("finite numbers"     ) ;
		expect(() => validateConvention({ ...convention, examples: ["one", "one"] }, "convention")      ).toThrow("duplicate value one") ;
		expect(() => validateConvention({ ...convention, evidence: { rows: Number.NaN } }, "convention")).toThrow("finite numbers"     ) ;
	});

	test("keeps generic local fields and permits an empty candidate approval receipt", () => {
		const value = { ...convention, localMetadata: { owner: "team" } };
		expect(validateConvention(value, "convention") === value).toBe(true);
	});
});

describe("example runtime shape", () => {
	test("requires every declared field", () => {
		for (const field of ["schemaVersion", "id", "status", "versions", "language", "regime", "patterns", "rules", "before", "after", "contentHash", "verdict", "asserts", "source", "approvedBy", "date"]) {
			expect(() => validateExample(without(example, field), "example")).toThrow();
		}
	});

	test("validates nested versions, source and assertions", () => {
		expect(() => validateExample({ ...example, versions: null }, "example")                                ).toThrow("versions: record"  ) ;
		expect(() => validateExample({ ...example, source: [] }, "example")                                    ).toThrow("source: record"    ) ;
		expect(() => validateExample({ ...example, source: { kind: "internet", license: "local" } }, "example")).toThrow("source.kind"       ) ;
		expect(() => validateExample({ ...example, asserts: { after: { fixedPoint: "yes" } } }, "example")     ).toThrow("fixedPoint"        ) ;
		expect(() => validateExample({ ...example, asserts: { after: { has: ["A12", "A12"] } } }, "example")   ).toThrow("duplicate value"   ) ;
		expect(() => validateExample({ ...example, patterns: ["DEFINE", "DEFINE"] }, "example")                ).toThrow("unique grammar IDs") ;
	});

	test("permits local licenses, unknown fields and empty candidate approval strings", () => {
		const value = { ...example, localMetadata: true };
		expect(validateExample(value, "example") === value).toBe(true);
	});
});

describe("decision and JSONL runtime shape", () => {
	test("requires decision references and receipt fields with valid types", () => {
		for (const field of ["schemaVersion", "id", "kind", "layer", "ref", "docHash", "examples", "approvedBy", "date"]) {
			expect(() => validateDecision(without(decision, field), "decision")).toThrow();
		}
		expect(() => validateDecision({ ...decision, examples: ["example", "example"] }, "decision")).toThrow("duplicate value") ;
		expect(validateDecision({ ...decision, localMetadata: true }, "decision")).toHaveProperty("localMetadata", true)           ;
	});

	test("reports malformed JSON and duplicate ids with the source line", () => {
		expect(() => parseConventions("{\n", "project", "conventions.jsonl")).toThrow("conventions.jsonl:1: malformed JSON") ;
		expect(() => parseRecords("{\n", "examples.jsonl", validateExample)).toThrow("examples.jsonl:1: malformed JSON")      ;
		const line = JSON.stringify(decision);
		expect(() => parseRecords(`${line}\n${line}\n`, "decisions.jsonl", validateDecision)).toThrow("decisions.jsonl:2: duplicate id rule") ;
	});
});
