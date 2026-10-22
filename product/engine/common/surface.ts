import { ruleData } from "@/rule-data.ts";
/**
 * Surface forms (layer 2, M1.8 S3): map the tables the engine finds (kind or axis order) to grammar patterns (layer 1).
 * The mapping data lives in `product/rules/base/<language>.json`; this module only reads, validates and looks it up.
 * It never changes the engine's alignment behavior — a pattern is a name attached to a table.
 */
import      { readFileSync            } from "node:fs"                 ;
import      { isPattern, type Pattern } from "@/common/grammar-ids.ts" ;

export const SURFACE_SCHEMA_VERSION = 1;

/** One surface form: TypeScript is matched by kind, line-engine languages by the leading part of the axis order. */
export interface SurfaceForm {
	readonly kind?       : string            ;
	readonly hasAxis?    : string            ;
	readonly axesPrefix? : readonly string[] ;
	readonly pattern     : Pattern           ;
	/** Other patterns the engine cannot distinguish. If present, this table's pattern is ambiguous. */
	readonly alternatives? : readonly Pattern[]    ;
	readonly note?         : string                ;
}

export interface SurfaceData {
	readonly schemaVersion : number                 ;
	readonly language      : string                 ;
	readonly forms         : readonly SurfaceForm[] ;
}

export interface PatternMatch {
	readonly pattern      : Pattern            ;
	readonly alternatives : readonly Pattern[] ;
}

/** Validates one data set. An ID missing from the grammar, or a form with no matcher or with both, is an error. */
export function validateSurface(value: unknown, language: string): SurfaceData {
	const data = value as SurfaceData;
	if (data?.schemaVersion !== SURFACE_SCHEMA_VERSION) throw new Error(`surface ${language}: schemaVersion must be ${SURFACE_SCHEMA_VERSION}`);
	if (data.language !== language) throw new Error(`surface ${language}: language field is ${String(data.language)}`);
	if (!Array.isArray(data.forms) || data.forms.length === 0) throw new Error(`surface ${language}: forms must be a non-empty array`);
	for (const [index, form] of data.forms.entries()) {
		const where = `surface ${language} form ${index}`;

		if (!isPattern(form.pattern)) throw new Error(`${where}: unknown pattern ${String(form.pattern)}`);
		for (const alternative of form.alternatives ?? []) {
			if (!isPattern(alternative)) throw new Error(`${where}: unknown alternative ${String(alternative)}`);
		}

		const byKind = typeof form.kind === "string"                                ;
		const byAxes = Array.isArray(form.axesPrefix) && form.axesPrefix.length > 0 ;
		if (byKind === byAxes) throw new Error(`${where}: exactly one of kind or axesPrefix is required`);
	}
	return data;
}

const loaded = new Map<string, SurfaceData>();

/** Reads `product/rules/base/<language>.json`. undefined for a language without data. */
export function surfaceOf(language: string): SurfaceData | undefined {
	const cached = loaded.get(language);
	if (cached) return cached;

	let text: string;
	try {
		text = readFileSync(ruleData(`base/${language}.json`), "utf8");
	} catch {
		return undefined;
	}

	const data = validateSurface(JSON.parse(text), language);
	loaded.set(language, data);
	return data;
}

/** Strips the column position (`=17`) from an axis id. */
const bareAxis = (axis: string): string => axis.split("=")[0]!;

/** The pattern of one table. The first matching form wins. undefined if none matches (target of alarm A8). */
export function patternOf(language: string, table: { readonly kind?: string; readonly axes: readonly string[] }): PatternMatch | undefined {
	const data = surfaceOf(language);
	if (!data) return undefined;

	const axes = table.axes.map(bareAxis);
	for (const form of data.forms) {
		if (form.kind !== undefined) {
			if (form.kind !== table.kind) continue;
			if (form.hasAxis !== undefined && !axes.includes(form.hasAxis)) continue;
		} else if (!form.axesPrefix!.every((axis, index) => axes[index] === axis)) continue;
		return { pattern: form.pattern, alternatives: form.alternatives ?? [] };
	}
	return undefined;
}
