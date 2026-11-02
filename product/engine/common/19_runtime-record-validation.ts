export type RuntimeRecord = Readonly<Record<string, unknown>>;

export function runtimeRecord(value: unknown, where: string): RuntimeRecord {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${where}: record must be a JSON object`);
	return value as RuntimeRecord;
}

export function runtimeString(value: unknown, where: string, empty = false): string {
	if (typeof value !== "string" || (!empty && value === "")) throw new Error(`${where}: must be ${empty ? "a string" : "a non-empty string"}`);
	return value;
}

export function runtimeStringArray(value: unknown, where: string): readonly string[] {
	if (!Array.isArray(value) || !value.every(item => typeof item === "string")) throw new Error(`${where}: must be an array of strings`);
	const duplicate = value.find((item, index) => value.indexOf(item) !== index);
	if (duplicate !== undefined) throw new Error(`${where}: duplicate value ${duplicate}`);
	return value;
}

export function runtimeNumberRecord(value: unknown, where: string): Readonly<Record<string, number>> {
	const record = runtimeRecord(value, where);
	for (const [key, item] of Object.entries(record)) {
		if (key === "" || typeof item !== "number" || !Number.isFinite(item)) throw new Error(`${where}: values must be finite numbers with non-empty keys`);
	}
	return record as Readonly<Record<string, number>>;
}
