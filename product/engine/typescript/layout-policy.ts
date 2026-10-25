import layoutData from "../../rules/base/typescript-layout.json" with { type: "json" };

export const TYPESCRIPT_LAYOUT_SCHEMA_VERSION = 1;
export const IMPLEMENTED_LAYOUT_KINDS          = [
	"declaration",
	"declaration-equals",
	"declaration-extended-equals",
	"declaration-call-expressions",
	"return-guards",
	"declaration-call-envelope",
	"guard-statements",
	"type-alias",
	"method-signature",
	"class-method",
	"interface-members",
	"type-members",
	"class-members",
	"enum-member",
	"case-clause",
	"assignments",
	"call-statements",
	"object-rows",
	"object-properties",
	"registration",
	"logical-chains",
	"if-headers-braced",
	"if-headers-return",
	"vertical-call-arguments",
] as const;

export interface AxisPolicy {
	readonly gap    : readonly string[] ;
	readonly insert : readonly string[] ;
}

export interface MinimumRowsPolicy {
	readonly operation : "every-row-has-axis" ;
	readonly axis      : string               ;
	readonly value     : number               ;
}

export interface RowKindPolicy {
	readonly gap     : "blank" | "comma"  ;
	readonly minRows : MinimumRowsPolicy   ;
}

export interface TypeScriptLayoutPolicy {
	readonly schemaVersion : 1            ;
	readonly language      : "typescript" ;
	readonly rowKinds      : Readonly<{
		readonly declaration                    : RowKindPolicy ;
		readonly "declaration-call-expressions" : RowKindPolicy ;
	}>;
	readonly kinds : Readonly<Record<string, AxisPolicy>> ;
}

type JsonRecord = Readonly<Record<string, unknown>>;

function recordOf(value: unknown, where: string): JsonRecord {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${where}: object expected`);
	return value as JsonRecord;
}

function exactKeys(record: JsonRecord, keys: readonly string[], where: string): void {
	const missing = keys.filter(key => !(key in record))                   ;
	const unknown = Object.keys(record).filter(key => !keys.includes(key)) ;
	if (missing.length > 0) throw new Error(`${where}: missing fields: ${missing.join(", ")}`);
	if (unknown.length > 0) throw new Error(`${where}: unknown fields: ${unknown.join(", ")}`);
}

function identifier(value: unknown, where: string): string {
	if (typeof value !== "string" || !/^[a-z][a-z0-9-]*(?:\{i\})?(?:-[a-z0-9]+(?:\{i\})?)*$/u.test(value)) throw new Error(`${where}: normalized axis or kind ID expected`);
	return value;
}

function axisList(value: unknown, where: string): readonly string[] {
	if (!Array.isArray(value)) throw new Error(`${where}: axis array expected`);
	const axes = value.map((axis, index) => identifier(axis, `${where}[${index}]`));
	if (new Set(axes).size !== axes.length) throw new Error(`${where}: duplicate axes are not allowed`);
	return axes;
}

function axisPolicyOf(value: unknown, where: string): AxisPolicy {
	const record = recordOf(value, where);
	exactKeys(record, ["gap", "insert"], where);
	const gap     = axisList(record.gap, `${where}.gap`      ) ;
	const insert  = axisList(record.insert, `${where}.insert`) ;
	const overlap = gap.find(axis => insert.includes(axis)   ) ;
	if (overlap !== undefined) throw new Error(`${where}: axis ${overlap} cannot be both gap and insert`);
	return { gap, insert };
}

function rowKindPolicyOf(value: unknown, where: string): RowKindPolicy {
	const record = recordOf(value, where);
	exactKeys(record, ["gap", "minRows"], where);
	if (record.gap !== "blank" && record.gap !== "comma") throw new Error(`${where}.gap: unknown gap policy ${String(record.gap)}`);
	const minimum = recordOf(record.minRows, `${where}.minRows`);
	exactKeys(minimum, ["operation", "axis", "value"], `${where}.minRows`);
	if (minimum.operation !== "every-row-has-axis") throw new Error(`${where}.minRows: unknown operation ${String(minimum.operation)}`);
	const axis = identifier(minimum.axis, `${where}.minRows.axis`);
	if (!Number.isInteger(minimum.value) || Number(minimum.value) < 2) throw new Error(`${where}.minRows.value: integer of at least 2 expected`);
	return { gap: record.gap, minRows: { operation: minimum.operation, axis, value: Number(minimum.value) } };
}

export function validateTypeScriptLayoutPolicy(value: unknown, where = "TypeScript layout policy"): TypeScriptLayoutPolicy {
	const root = recordOf(value, where);
	exactKeys(root, ["schemaVersion", "language", "rowKinds", "kinds"], where);
	if (root.schemaVersion !== TYPESCRIPT_LAYOUT_SCHEMA_VERSION) throw new Error(`${where}: schemaVersion must be ${TYPESCRIPT_LAYOUT_SCHEMA_VERSION}; got ${String(root.schemaVersion)}`);
	if (root.language !== "typescript") throw new Error(`${where}: language must be typescript`);
	const rowKindRecords = recordOf(root.rowKinds, `${where}.rowKinds`);
	exactKeys(rowKindRecords, ["declaration", "declaration-call-expressions"], `${where}.rowKinds`);
	const rowKinds = {
		declaration                    : rowKindPolicyOf(rowKindRecords.declaration, `${where}.rowKinds.declaration`)                                         ,
		"declaration-call-expressions" : rowKindPolicyOf(rowKindRecords["declaration-call-expressions"], `${where}.rowKinds.declaration-call-expressions`) ,
	};
	const kindRecords = recordOf(root.kinds, `${where}.kinds`);
	exactKeys(kindRecords, IMPLEMENTED_LAYOUT_KINDS, `${where}.kinds`);
	const kinds: Record<string, AxisPolicy> = {};
	for (const [name, policy] of Object.entries(kindRecords)) kinds[identifier(name, `${where}.kinds`)] = axisPolicyOf(policy, `${where}.kinds.${name}`);
	return { schemaVersion: TYPESCRIPT_LAYOUT_SCHEMA_VERSION, language: "typescript", rowKinds, kinds };
}

/** Fails when data names an axis that has no visible normalized contract. */
export function validateLayoutAxisNotes(policy: TypeScriptLayoutPolicy, notes: Readonly<Record<string, string>>, where = "TypeScript layout policy"): void {
	for (const [kind, axes] of Object.entries(policy.kinds)) {
		for (const axis of [...axes.gap, ...axes.insert]) {
			const normalized = axis.replaceAll("{i}", "");
			if (notes[normalized] === undefined) throw new Error(`${where}.kinds.${kind}: unknown axis policy ${axis}`);
		}
	}
	for (const [kind, row] of Object.entries(policy.rowKinds)) {
		if (notes[row.minRows.axis] === undefined) throw new Error(`${where}.rowKinds.${kind}: unknown axis policy ${row.minRows.axis}`);
	}
}

export function minimumRowsOf(policy: RowKindPolicy, rows: readonly (readonly string[])[]): number | undefined {
	if (policy.minRows.operation !== "every-row-has-axis") throw new Error(`TypeScript layout policy schema ${TYPESCRIPT_LAYOUT_SCHEMA_VERSION}: unknown operation ${String(policy.minRows.operation)}`);
	return rows.every(axes => axes.includes(policy.minRows.axis)) ? policy.minRows.value : undefined;
}

export const TYPESCRIPT_LAYOUT_POLICY = validateTypeScriptLayoutPolicy(layoutData);
