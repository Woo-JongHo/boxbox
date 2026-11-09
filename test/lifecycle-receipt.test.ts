import      { afterEach, expect, test                         } from "bun:test"                         ;
import      { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"                          ;
import      { tmpdir                                          } from "node:os"                          ;
import      { join                                            } from "node:path"                        ;
import      {
              LIFECYCLE_RECEIPT_MAX_BYTES                   ,
              encodeLifecycleReceipt                        ,
              parseLifecycleReceipt                         ,
              readLifecycleReceipt                          ,
              validateLifecycleReceipt                      ,
                                                              } from "@/common/29_lifecycle-receipt.ts" ;
import type { LifecycleReceiptV1, LifecycleReceiptV2          } from "@/common/29_lifecycle-receipt.ts" ;

const workspaces: string[] = [];

afterEach(() => {
	for (const root of workspaces.splice(0)) rmSync(root, { recursive: true, force: true });
});

function workspace(): string {
	const root = mkdtempSync(join(tmpdir(), "boxbox-lifecycle-receipt-"));
	workspaces.push(root);

	return root;
}

function receipt(): LifecycleReceiptV1 {
	return {
		schemaVersion : 1             ,
		event         : "PostToolUse" ,
		state         : "NO_GROUPS"   ,

		files   : ["sample.json"]                                                                          ,
		checked : [{
			file: "sample.json",
			result: {
				file     : "sample.json"                                                    ,
				language : "json"                                                           ,
				mode     : "check"                                                          ,
				summary  : { groups: 0, misaligned: 0, edits: 0, refused: 0, suggested: 0 } ,
				groups   : []                                                               ,
				parse    : { status: "not-run", tool: "JSON.parse" }                        ,
			},
		}],
		unsupported : []                                                                                                        ,
		deleted     : []                                                                                                        ,
		coverage    : { changedFiles: 1, checkedFiles: 1, unsupportedFiles: 0, deletedFiles: 0, filesWithGroups: 0, groups: 0 } ,

		tool: "Write",
		at  : "2026-11-09T00:00:00.000Z",

		automaticFixPerformed: false,
	};
}

test("schema-1 lifecycle receipts round-trip with exact coverage counts", () => {
	const value = receipt               ()      ;
	const text  = encodeLifecycleReceipt(value) ;

	expect(parseLifecycleReceipt(text)                                                                ).toEqual(value                ) ;
	expect(() => validateLifecycleReceipt({ ...value, coverage: { ...value.coverage, groups: 1 } })   ).toThrow("counts do not match") ;
	expect(() => validateLifecycleReceipt({ ...value, unknown: true })                                ).toThrow("unknown field"      ) ;
	expect(() => validateLifecycleReceipt({ ...value, state: "PASS" })                                ).toThrow("expected NO_GROUPS" ) ;
	expect(() => validateLifecycleReceipt({ ...value, checked: [...value.checked, ...value.checked] })).toThrow("duplicate file"     ) ;
	expect(() => validateLifecycleReceipt({
		...value,
		unsupported: ["sample.json"],
		coverage: { ...value.coverage, unsupportedFiles: 1 },
	})).toThrow("disjoint partition");
});

test("schema-1 receipts accept every ResultJson parse status and an explicit deleted-only partition", () => {
	for (const status of ["ok", "changed", "skipped", "not-run"] as const) {
		const value   = receipt          ()                                                                                                                              ;
		const checked = value.checked.map(item => ({ ...item, result: { ...item.result, parse: { status, tool: "test", ...(status === "ok" ? { passes: 1 } : {}) } } })) ;
		expect(validateLifecycleReceipt({ ...value, checked }) .checked[0]?.result.parse.status).toBe(status);
	}
	const value = receipt();
	const deletedOnly: LifecycleReceiptV1 = {
		...value,
		state    : "DELETED_ONLY"                                                                                            ,
		files    : ["gone.py"]                                                                                               ,
		checked  : []                                                                                                        ,
		deleted  : ["gone.py"]                                                                                               ,
		coverage : { changedFiles: 1, checkedFiles: 0, unsupportedFiles: 0, deletedFiles: 1, filesWithGroups: 0, groups: 0 } ,
	};
	expect(validateLifecycleReceipt(deletedOnly).state).toBe("DELETED_ONLY");
});

test("receipt parsing rejects malformed and oversized input before accepting it as evidence", () => {
	expect(() => parseLifecycleReceipt("{")) .toThrow("malformed JSON");
	expect(() => parseLifecycleReceipt(" ".repeat(LIFECYCLE_RECEIPT_MAX_BYTES + 1))).toThrow("exceeds");
});

test("baseline-shaped unversioned PASS receipts stay readable without promotion", () => {
	// Shape captured from baseline 329c9c7; private paths and outer probe metadata are intentionally omitted.
	const legacy = {
		event : "PostToolUse" ,
		state : "PASS"        ,
		files : ["sample.py"] ,
		checked: [{
			file: "sample.py",
			result: {
				file     : "sample.py"                                                      ,
				language : "python"                                                         ,
				mode     : "check"                                                          ,
				summary  : { groups: 0, misaligned: 0, edits: 0, refused: 0, suggested: 0 } ,
				groups   : []                                                               ,
				parse    : { status: "not-run", tool: "" }                                  ,
			},
		}],
		unsupported           : []                         ,
		tool                  : "Write"                    ,
		at                    : "2026-11-08T15:28:55.707Z" ,
		automaticFixPerformed : false                      ,
	};
	const parsed = parseLifecycleReceipt(JSON.stringify(legacy));

	expect(parsed.schemaVersion).toBeUndefined();
	expect(parsed.state                            ).toBe   ("PASS"         ) ;
	expect(parsed.checked[0]?.result.summary.groups).toBe   (0              ) ;
	expect(() => validateLifecycleReceipt(legacy)  ).toThrow("schemaVersion") ;

	const legacySuggestion = {
		...legacy,
		checked: [{
			...legacy.checked[0],
			result: {
				...legacy.checked[0]!.result,
				summary: { groups: 1, misaligned: 0, edits: 0, refused: 0, suggested: 1 },
				groups: [{ kind: "pair", startLine: 1, endLine: 2, rows: 2, axes: ["name", "equal", "value"], state: "SUGGEST", edits: 0 }],
			},
		}],
	};
	const oldSuggestion = parseLifecycleReceipt(JSON.stringify(legacySuggestion));
	expect(oldSuggestion.state).toBe("PASS");
	expect(oldSuggestion.checked[0]?.result.summary.suggested).toBe(1);
});

test("receipt file reads reject symbolic and oversized files", () => {
	const root     = workspace()                      ;
	const regular  = join     (root, "receipt.json" ) ;
	const symbolic = join     (root, "symbolic.json") ;
	writeFileSync(regular, encodeLifecycleReceipt(receipt()));
	symlinkSync(regular, symbolic);

	expect(readLifecycleReceipt(regular)).toEqual(receipt());
	expect(() => readLifecycleReceipt(symbolic)).toThrow("regular file");

	const oversized = join(root, "oversized.json");
	writeFileSync(oversized, " ".repeat(LIFECYCLE_RECEIPT_MAX_BYTES + 1));
	expect(() => readLifecycleReceipt(oversized)).toThrow("exceeds");
});


function modeReceipt(): LifecycleReceiptV2 {
	const original = receipt();
	return {
		...original,
		schemaVersion         : 2                                   ,
		state                 : "PASS"                              ,
		mode                  : "align"                             ,
		aligned               : [{ file: "sample.json", edits: 2 }] ,
		automaticFixPerformed : true                                ,
		checked  : original.checked.map(item => ({ ...item, result: {
			...item.result,
			summary: { groups: 1, misaligned: 0, edits: 0, refused: 0, suggested: 0 },
			groups: [{ kind: "table", startLine: 1, endLine: 3, rows: 3, axes: ["colon"], state: "PASS", edits: 0 }],
		} })),
		coverage : { ...original.coverage, filesWithGroups: 1, groups: 1 },
	};
}

test("schema-2 mode receipts retain coverage and recorded alignment without weakening schema 1", () => {
	const value = modeReceipt();
	expect(validateLifecycleReceipt(value)                                              ).toEqual(value          ) ;
	expect(parseLifecycleReceipt(JSON.stringify(value))                                 ).toEqual(value          ) ;
	expect(parseLifecycleReceipt(encodeLifecycleReceipt(value))                         ).toEqual(value          ) ;
	expect(() => validateLifecycleReceipt({ ...receipt(), mode: "align" })              ).toThrow("unknown field") ;
	expect(() => validateLifecycleReceipt({ ...receipt(), automaticFixPerformed: true })).toThrow("must be false") ;
	for (const mode of ["off", "check", "align", "refactor"] as const) {
		const quiet = { ...value, mode, aligned: [], automaticFixPerformed: false };
		expect(validateLifecycleReceipt(quiet)).toEqual(quiet);
	}
});

test("schema-2 automatic alignment requires matching mode, event, checked files and positive edit evidence", () => {
	const value = modeReceipt();
	for (const altered of [
		{ ...value, mode: "check" },
		{ ...value, event: "Stop" },
		{ ...value, automaticFixPerformed: false },
		{ ...value, aligned: [] },
		{ ...value, aligned: [{ file: "missing.json", edits: 2 }] },
		{ ...value, aligned: [{ file: "sample.json", edits: 0 }] },
		{ ...value, aligned: [{ file: "sample.json", edits: -1 }] },
		{ ...value, aligned: [{ file: "sample.json", edits: 1.5 }] },
		{ ...value, aligned: [...value.aligned, ...value.aligned] },
		{ ...value, aligned: [{ ...value.aligned[0], arbitrary: true }] },
		{ ...value, mode: "unknown" },
		{ ...value, unknown: true },
	]) expect(() => validateLifecycleReceipt(altered)).toThrow();
});

test("both versioned receipts preserve display-only Python group metadata without changing lookup fields", () => {
	const mode = modeReceipt();
	const checked = mode.checked.map(item => ({
		...item,
		result: { ...item.result, groups: item.result.groups.map(group => ({
			...group,
			semanticKind: "assignments",
			sourceContext: "Module",
		})) },
	}));
	const current = { ...mode, checked };
	const { mode: _mode, aligned: _aligned, ...shared } = current;
	const old: LifecycleReceiptV1 = { ...shared, schemaVersion: 1, automaticFixPerformed: false };

	expect(parseLifecycleReceipt(encodeLifecycleReceipt(current))).toEqual(current) ;
	expect(parseLifecycleReceipt(encodeLifecycleReceipt(old))    ).toEqual(old    ) ;
	expect(checked[0]?.result.groups[0]?.kind                    ).toBe   ("table") ;
	expect(checked[0]?.result.groups[0]?.context).toBeUndefined();
});
