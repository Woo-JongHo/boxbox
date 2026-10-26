export interface ExpectedAxisCoverage {
	readonly axis   : string            ;
	readonly groups : number            ;
	readonly lines  : readonly number[] ;
}

export interface AxisExpectation {
	readonly requested : readonly string[]               ;
	readonly covered   : readonly ExpectedAxisCoverage[] ;
	readonly missing   : readonly string[]               ;
	readonly unknown   : readonly string[]               ;
}

interface GroupAxes {
	readonly startLine : number            ;
	readonly axes      : readonly string[] ;
}

/** `call-comma2=26` and `call-comma{i}` are the same axis: drop the column and the per-position index. */
export const baseAxis = (axis: string): string => axis.replace(/=\d+$/u, "").replaceAll("{i}", "").replace(/\d+/gu, "");

/**
 * Reconcile the axes a caller asked about with the axes the groups actually returned. A name outside `known` is
 * reported as `unknown` (a typo), never as `missing`. Without a vocabulary every name is judged only by coverage.
 */
export function axisExpectation(groups: readonly GroupAxes[], requested: readonly string[], known?: ReadonlySet<string>): AxisExpectation {
	const names   = [...new Set(requested.map(baseAxis))]                         ;
	const unknown = names.filter(name => known !== undefined && !known.has(name)) ;
	const covered = names.filter(name => !unknown.includes(name)).map(name => {
		const holders = groups.filter(group => group.axes.some(axis => baseAxis(axis) === name));
		return { axis: name, groups: holders.length, lines: holders.map(group => group.startLine) };
	});
	return {
		requested : names                                                                ,
		covered   : covered.filter(entry => entry.groups > 0)                            ,
		missing   : covered.filter(entry => entry.groups === 0).map(entry => entry.axis) ,
		unknown                                                                          ,
	};
}
