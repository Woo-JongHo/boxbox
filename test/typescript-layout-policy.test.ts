import      { describe, expect, test           } from "bun:test"                      ;
import      { cpSync, mkdtempSync              } from "node:fs"                       ;
import      { tmpdir                           } from "node:os"                       ;
import      { join, resolve                    } from "node:path"                     ;

import layoutData from "../product/rules/base/typescript-layout.json" with { type: "json" };

import      { AXIS_NOTES, KIND_AXES, ROW_KINDS } from "@/typescript/grid-kinds.ts"    ;
import type { DetectedRow                      } from "@/typescript/grid-kinds.ts"    ;
import      {
              IMPLEMENTED_LAYOUT_KINDS       ,
              minimumRowsOf                  ,
              TYPESCRIPT_LAYOUT_POLICY       ,
              validateLayoutAxisNotes        ,
              validateTypeScriptLayoutPolicy ,
                                               } from "@/typescript/layout-policy.ts" ;

const ROOT = resolve(import.meta.dir, "..");

function changed(mutator: (value: Record<string, unknown>) => void): unknown {
	const value = structuredClone(layoutData) as unknown as Record<string, unknown>;
	mutator(value);
	return value;
}

describe("TypeScript layout policy data", () => {
	test("retains the complete visible kind contract and normalized axis notes", () => {
		expect(Object.keys(KIND_AXES)).toEqual([...IMPLEMENTED_LAYOUT_KINDS]);
		expect(KIND_AXES["declaration-equals"]).toEqual({
			gap    : ["colon", "equals", "call-arg{i}", "list-value-comma{i}", "list-value-el{i}", "list-arg{i}-comma{i}", "list-arg{i}-el{i}", "semicolon"],
			insert : ["call-open-paren", "call-comma{i}", "call-close-paren", "list-value-open", "list-value-close", "list-arg{i}-open", "list-arg{i}-close", "subscript-close", "comment"],
		});
		expect(KIND_AXES["object-properties"]).toEqual({
			gap    : ["property-colon", "property-value", "property-comma", "property-colon{i}", "property-value{i}", "property-comma{i}"],
			insert : [],
		});
		expect(KIND_AXES["logical-chains"]).toEqual({
			gap    : ["comparison-operator{i}", "comparison-right{i}"],
			insert : ["logical-operator", "logical-not", "logical-operand"],
		});
		expect(KIND_AXES["declaration-call-expressions"]!.gap   ).toEqual(expect.arrayContaining(["call-arg{i}", "list-arg{i}-comma{i}", "comparison-operator{i}", "conditional-false{i}"])) ;
		expect(KIND_AXES["declaration-call-expressions"]!.insert).toEqual(expect.arrayContaining(["call-open-paren", "list-arg{i}-open", "subscript-close", "comment"])                    ) ;
		expect(KIND_AXES["if-headers-braced"]                   ).toEqual({ gap: ["if-open-brace"], insert: ["if-close-paren"] }                                                           ) ;
		expect(KIND_AXES["if-headers-return"]                   ).toEqual({ gap: ["if-return"], insert: ["if-close-paren"] }                                                               ) ;
		expect(KIND_AXES["vertical-call-arguments"]             ).toEqual({ gap: [], insert: ["vertical-call-comma"] }                                                                     ) ;
		expect(KIND_AXES.registration                           ).toEqual({ gap: ["colon", "value", "comma"], insert: [] }                                                                 ) ;
		expect(KIND_AXES["return-guards"]                       ).toEqual({ gap: ["guard-return"], insert: [] }                                                                            ) ;
		expect(() => validateLayoutAxisNotes(TYPESCRIPT_LAYOUT_POLICY, AXIS_NOTES)).not.toThrow();
	});

	test("keeps the declaration row-floor behavior and fallback", () => {
		const policy       = TYPESCRIPT_LAYOUT_POLICY.rowKinds.declaration                         ;
		const nestedPolicy = TYPESCRIPT_LAYOUT_POLICY.rowKinds["declaration-call-expressions"]     ;
		const declaration  = ROW_KINDS.find(kind => kind.name === "declaration")!                  ;
		const nested       = ROW_KINDS.find(kind => kind.name === "declaration-call-expressions")! ;
		const rows = (axes: readonly (readonly string[])[]): readonly DetectedRow[] => axes.map(boundaries => ({
			node       : null,
			boundaries : boundaries.map(axis => ({ axis, from: 0, at: 0 })),
		})) as unknown as readonly DetectedRow[];
		expect(policy.gap                                                    ).toBe("blank"  ) ;
		expect(declaration.gap                                               ).toBe("blank"  ) ;
		expect(minimumRowsOf(policy, [["colon", "equals"], ["equals"]])      ).toBe(2        ) ;
		expect(declaration.minRows?.(rows([["colon", "equals"], ["equals"]]))).toBe(2        ) ;
		expect(declaration.minRows?.(rows([["equals"], ["semicolon"]]))         ).toBeUndefined() ;
		expect(nestedPolicy.gap                                                       ).toBe("blank" ) ;
		expect(minimumRowsOf(nestedPolicy, [["call-open-paren"], ["call-open-paren"]])).toBe(2       ) ;
		expect(nested.minRows?.(rows([["call-open-paren"], ["call-open-paren"]]))     ).toBe(2       ) ;
		expect(nested.minRows?.(rows([["call-open-paren"], ["call-close-paren"]]))     ).toBeUndefined() ;
	});

	test("rejects incompatible schemas, unknown fields, operations, axes and classifications", () => {
		expect(() => validateTypeScriptLayoutPolicy(changed(value => { value.schemaVersion = 2; }))).toThrow("schemaVersion must be 1") ;
		expect(() => validateTypeScriptLayoutPolicy(changed(value => { value.extra = true; }))).toThrow("unknown fields: extra")         ;
		expect(() => validateTypeScriptLayoutPolicy(changed(value => {
			(value.kinds as Record<string, unknown>).invented = { gap: [], insert: [] };
		}))).toThrow("unknown fields: invented");
		expect(() => validateTypeScriptLayoutPolicy(changed(value => {
			((value.rowKinds as Record<string, unknown>).declaration as Record<string, unknown>).minRows = { operation: "count", axis: "equals", value: 2 };
		}))).toThrow("unknown operation count");
		expect(() => validateTypeScriptLayoutPolicy(changed(value => {
			((value.rowKinds as Record<string, unknown>).declaration as Record<string, unknown>).minRows = { operation: "every-row-has-axis", axis: "equals", value: 1 };
		}))).toThrow("at least 2");
		const unknownAxis = validateTypeScriptLayoutPolicy(changed(value => {
			((value.kinds as Record<string, unknown>).declaration as Record<string, unknown>).gap = ["unknown-axis"];
		}));
		expect(() => validateLayoutAxisNotes(unknownAxis, AXIS_NOTES)).toThrow("unknown axis policy unknown-axis");
		expect(() => validateTypeScriptLayoutPolicy(changed(value => {
			((value.kinds as Record<string, unknown>).declaration as Record<string, unknown>).insert = ["colon"];
		}))).toThrow("cannot be both gap and insert");
		expect(() => validateTypeScriptLayoutPolicy(changed(value => {
			((value.kinds as Record<string, unknown>).declaration as Record<string, unknown>).gap = ["colon", "colon"];
		}))).toThrow("duplicate axes are not allowed");
	});

	test("loads from an isolated development-skill copy through the same relative rules path", () => {
		const root = mkdtempSync(join(tmpdir(), "boxbox-layout-policy-"));
		cpSync(join(ROOT, "product/engine"), join(root, "engine"), { recursive: true });
		cpSync(join(ROOT, "product/rules" ), join(root, "rules" ), { recursive: true });
		const entry = join         (root, "engine/typescript/layout-policy.ts"                                                                                                                                                     ) ;
		const run   = Bun.spawnSync(["bun", "-e", `import { TYPESCRIPT_LAYOUT_POLICY as policy } from ${JSON.stringify(entry)}; console.log(policy.schemaVersion, policy.language)`], { cwd: root, stderr: "pipe", stdout: "pipe" }) ;
		expect(run.exitCode               ).toBe(0               ) ;
		expect(run.stdout.toString().trim()).toBe("1 typescript") ;
	});
});
