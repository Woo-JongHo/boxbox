/** Overall measurement result, including the distinct no-groups outcome. */
export type MeasurementState = "MATCH" | "MISMATCH" | "UNMEASURABLE" | "NO_GROUPS" | "ERROR";
/** A known file type outside a measurement command's supported language. */
export class UnsupportedMeasurementError extends Error {}
/** One original-source boundary and its planner target, in zero-based display columns. */
export interface MeasurementPoint {
	readonly rowLine       : number                 ;
	readonly currentColumn : number | null          ;
	readonly targetColumn  : number | null          ;
	readonly anchor        : "physical" | "virtual" ;
	readonly editable      : boolean                ;
	/** Explains an unavailable or special boundary when present. */
	readonly reason?       : string                 ;
}
/** Points that share one detected axis. */
export interface MeasurementAxis {
	readonly axis: string;
	readonly points: readonly MeasurementPoint[];
}
/** One detected row group and its measurement status. */
export interface MeasurementGroup {
	readonly kind     : string                                ;
	readonly rowLines : readonly number[]                     ;
	readonly axes     : readonly MeasurementAxis[]            ;
	readonly state    : "MATCH" | "MISMATCH" | "UNMEASURABLE" ;
	/** Explains why the group cannot be measured, when applicable. */
	readonly reason?  : string                                ;
}
/** Complete read-only measurement for one source file. */
export interface Measurement {
	readonly file     : string                                                                                                        ;
	readonly language : "typescript" | "python"                                                                                       ;
	readonly state    : MeasurementState                                                                                              ;
	readonly groups   : readonly MeasurementGroup[]                                                                                   ;
	readonly counts   : { readonly groups: number; readonly match: number; readonly mismatch: number; readonly unmeasurable: number } ;
	/** Describes a usage, parser, or tool failure when present. */
	readonly reason?  : string                                                                                                        ;
}
export function measurement(file: string, language: Measurement["language"], groups: readonly MeasurementGroup[], reason?: string): Measurement {
	const counts = {
		groups       : groups.length                                                 ,
		match        : groups.filter(group => group.state === "MATCH").length        ,
		mismatch     : groups.filter(group => group.state === "MISMATCH").length     ,
		unmeasurable : groups.filter(group => group.state === "UNMEASURABLE").length ,
	};
	const state: MeasurementState = reason ? "ERROR" : counts.unmeasurable ? "UNMEASURABLE" : counts.mismatch ? "MISMATCH" : counts.match ? "MATCH" : "NO_GROUPS";
	return { file, language, state, groups, counts, ...(reason ? { reason } : {}) };
}
export function measurementArguments(args: readonly string[]): { file: string; json: boolean } {
	if (args.length !== 2 && args.length !== 3 || args[0] !== "--file" || !args[1] || args[1].startsWith("--") || args.length === 3 && args[2] !== "--json") throw new Error("usage: --file <path> [--json]");
	return { file: args[1], json: args.length === 3 };
}
export function reportMeasurement(value: Measurement, json: boolean): number {
	if (json) console.log(JSON.stringify(value));
	else {
		console.log(`${value.language} ${value.file}: ${value.state}${value.reason ? ` — ${value.reason}` : ""}`);
		console.log(`groups=${value.counts.groups} match=${value.counts.match} mismatch=${value.counts.mismatch} unmeasurable=${value.counts.unmeasurable}`);
		for (const group of value.groups) {
			console.log(`  ${group.kind} lines=${group.rowLines.join(",")} ${group.state}${group.reason ? ` — ${group.reason}` : ""}`);
			for (const axis of group.axes) for (const point of axis.points) console.log(`    ${axis.axis} line=${point.rowLine} current=${point.currentColumn ?? "-"} target=${point.targetColumn ?? "-"} ${point.anchor}${point.editable ? "" : " measure-only"}${point.reason ? ` — ${point.reason}` : ""}`);
		}
	}
	return value.state === "ERROR" ? 2 : value.state === "MISMATCH" || value.state === "UNMEASURABLE" ? 1 : 0;
}
