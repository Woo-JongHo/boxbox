/**
 * STEP6: Detects contiguous rows per registered table kind (grid-kinds.ts), checks the axis columns
 * (`:`, `;`, `=`, `(`, `)`, `,`, `}`, `//`), and aligns them at minimum width with --write. Conditional-type `:`,
 * for-header `;`, empty statements and one-line execution blocks are not row candidates. Comments split all
 * tables; blank lines split ordinary tables, while return guards can bridge statements within one block region. --explain <line> reports which kind the line was detected as and its axes.
 * Every table's edits must pass the scanner-based whitespace-only check (token-preservation.ts); a table that does
 * not is refused and reported, never written. A declaration row whose call argument is the outlier of its column
 * (import rule B) takes the vertical form instead: its arguments one per line under the opening `(`, which only
 * inserts line breaks, so such a group passes the break-preserving variant of the token check.
 */
import      { isInterfaceDeclaration                     } from "typescript/unstable/ast"            ;
import type { Node, SourceFile                           } from "typescript/unstable/ast"            ;
import      { writeFileSync                              } from "node:fs"                            ;

import      {
              ROW_KINDS                                ,
              displayColumn                            ,
              runsOf                                   ,
              syntaxKindName                           ,
              verticalCallText                         ,
                                                         } from "@/typescript/grid-kinds.ts"         ;
import type { DetectedRow                                } from "@/typescript/grid-kinds.ts"         ;
import      { loadSourceFile, syntacticDiagnostics       } from "@/typescript/load-source-file.ts"   ;
import      { envelope, summarize                        } from "@/common/result-json.ts"            ;
import type { ResultGroup, ResultParse                   } from "@/common/result-json.ts"            ;
import      { updateFileAtomically                       } from "@/common/safe-file.ts"              ;
import      { preservesTokens, preservesTokensWithBreaks } from "@/typescript/token-preservation.ts" ;

interface Edit {
	readonly start : number ;
	readonly end   : number ;
	readonly text  : string ;
}

interface TableGroup {
	readonly kind      : string ;
	readonly startLine : number ;
	readonly endLine   : number ;
	readonly rowCount  : number ;
	/** Exact row membership for noncontiguous guard regions. */
	readonly rowLines? : readonly number[];
	/** Rows rendered as the declaration vertical form; their edits replace the whole row and may insert line breaks. */
	readonly vertical : number            ;
	readonly axes     : readonly string[] ;
	readonly skipped  : readonly string[] ;
	readonly edits    : readonly Edit[]   ;
	/** The immediate AST container of the table (SourceFile, Block, InterfaceDeclaration, …) and its nesting depth. */
	readonly context   : string            ;
	readonly depth     : number            ;
}

function alignRows(source: SourceFile, rows: readonly DetectedRow[]): { axes: readonly string[]; skipped: readonly string[]; targets: ReadonlyMap<string, number>; edits: readonly Edit[] } {
	// Axis processing order must follow the actual source order within a row. Some rows have `:` before `=`
	// and some have only `=`, so collect the precedence of adjacent boundary pairs into a topological order.
	// If this order breaks, shifts from later-axis edits leak into earlier-axis contracts and never converge.
	const edges = new Map<string, Set<string>>();
	for (const row of rows) {
		const sequence = [...row.boundaries].sort((left, right) => left.from - right.from);
		for (let index = 0; index + 1 < sequence.length; index += 1) {
			const before = sequence[index]!.axis     ;
			const after  = sequence[index + 1]!.axis ;
			if (before === after) continue;
			if (!edges.has(before)) edges.set(before, new Set());
			edges.get(before)!.add(after);
		}
	}
	const minFromOfAxis = new Map<string, number>();
	for (const row of rows) for (const boundary of row.boundaries) {
		minFromOfAxis.set(boundary.axis, Math.min(minFromOfAxis.get(boundary.axis) ?? Number.MAX_SAFE_INTEGER, displayColumn(source, boundary.from)));
	}
	const visited           = new Set<string>() ;
	const ordered: string[] = []                ;
	const visit = (axis: string): void => {
		if (visited.has(axis)) return;
		visited.add(axis);
		for (const next of [...(edges.get(axis) ?? [])].sort()) visit(next);
		ordered.push(axis);
	};
	for (const axis of [...minFromOfAxis.keys()].sort((left, right) => minFromOfAxis.get(left)! - minFromOfAxis.get(right)!)) visit(axis);
	const axisOrder                     = ordered.reverse()                      ;
	const shifts                        = new Array<number>(rows.length).fill(0) ;
	const edits   : Edit[]              = []                                     ;
	const axes    : string[]            = []                                     ;
	const skipped : string[]            = []                                     ;
	const targets : Map<string, number> = new Map()                              ;
	for (const axis of axisOrder) {
		const entries = rows.map((row, index) => ({ row, index, boundary: row.boundaries.find(candidate => candidate.axis === axis) })).filter(entry => entry.boundary !== undefined);
		if (entries.length < 2) continue;
		// The target column is set by the farthest anchor (from). Gap axes keep at least one space;
		// insert axes align at the existing column — an aligned table is never pushed right again.
		const minGap = entries.some(entry => entry.boundary!.insert) ? 0 : 1                                                          ;
		const target = Math.max(...entries.map(entry => displayColumn(source, entry.boundary!.from) + shifts[entry.index]!)) + minGap ;
		const pads   = entries.map(entry => target - displayColumn(source, entry.boundary!.from) - shifts[entry.index]!)              ;
		if (pads.some(pad => pad < minGap)) {
			skipped.push(axis);
			continue;
		}
		axes.push(`${axis}=${target}`);
		targets.set(axis, target);
		for (const [position, entry] of entries.entries()) {
			const boundary = entry.boundary! ;
			const pad      = pads[position]! ;
			if (pad !== boundary.at - boundary.from) edits.push({ start: boundary.from, end: boundary.at, text: " ".repeat(pad) });
			shifts[entry.index] += pad - (boundary.at - boundary.from);
		}
	}
	return { axes, skipped, targets, edits };
}

function buildGroup(source: SourceFile, kindName: string, groupName: string, run: readonly DetectedRow[], context: string, depth: number): TableGroup {
	const straight = run.filter(row => row.vertical === undefined) ;
	const marked   = run.filter(row => row.vertical !== undefined) ;
	const aligned  = alignRows (source, straight                 ) ;
	// The vertical rows take the table's `=` column; with no aligned equals axis, the widest anchor of the run sets it.
	const equalsRows   = run.filter(row => row.boundaries.some(boundary => boundary.axis === "equals"))                                                                                    ;
	const equalsTarget = aligned.targets.get("equals") ?? Math.max(...equalsRows.map(row => displayColumn(source, row.boundaries.find(boundary => boundary.axis === "equals")!.from))) + 1 ;
	const newline      = source.text.includes("\r\n") ? "\r\n" : "\n"                                                                                                                      ;
	// The render carries the statement's own indentation, so the edit replaces the whole line's code, from its start.
	const verticalEdits = marked.map(row => {
		const start     = row.node.getStart                     (source                                             ) ;
		const lineStart = source  .getPositionOfLineAndCharacter(source.getLineAndCharacterOfPosition(start).line, 0) ;
		return { start: lineStart, end: row.node.getEnd(), text: verticalCallText(source, row, equalsTarget, newline) };
	})                                                                                                                                                                                      ;
	const edits         = [...aligned.edits, ...verticalEdits]                                                                                                                              ;
	if (process.env.DEBUG_ALIGN) {
		for (const row of run) {
			const line = source.getLineAndCharacterOfPosition(row.node.getStart(source)).line + 1     ;
			const text = source.text.slice(row.node.getStart(source), row.node.getEnd()).slice(0, 50) ;
			console.error(`    row line=${line} [${text}] ${row.boundaries.map(b => `${b.axis}(from=${displayColumn(source, b.from)},at=${displayColumn(source, b.at)})`).join(" ")}`);
		}
	}
	const first = run[0]!.node     ;
	const last  = run.at(-1)!.node ;
	return {
		kind      : groupName                                                             ,
		startLine : source.getLineAndCharacterOfPosition(first.getStart(source)).line + 1 ,
		endLine   : source.getLineAndCharacterOfPosition(last.getEnd() - 1).line + 1      ,
		rowCount  : run.length                                                            ,
		...(kindName === "return-guards" ? { rowLines: run.map(row => source.getLineAndCharacterOfPosition(row.node.getStart(source)).line + 1) } : {}),
		vertical : marked.length   ,
		context  : context         ,
		depth    : depth           ,
		axes     : aligned.axes    ,
		skipped  : aligned.skipped ,
		edits,
	};
}

/** The gate a group's combined edit must pass: vertical rows may insert line breaks, nothing else may. */
export function groupPreserved(source: SourceFile, group: TableGroup): boolean {
	const after = applyEdits(source.text, group.edits);
	return group.vertical > 0 ? preservesTokensWithBreaks(source.text, after) : preservesTokens(source.text, after);
}

/** Every detected table of a loaded file, including the ones whose edits fail the token gate (the corpus census). */
export function censusGroups(source: SourceFile, minRows: number): readonly TableGroup[] {
	const result: CollectResult = { groups: [], candidates: [], compressed: [] };
	collect(source, source, minRows, new Set<Node>(), undefined, result);
	return result.groups;
}

interface CollectResult {
	readonly groups     : TableGroup[]                                          ;
	readonly candidates : Node[]                                                ;
	readonly compressed : { readonly line: number; readonly members: number }[] ;
}

/** Finds interfaces whose member table is compressed onto one physical line. Expanding is a structural change, so it is not fixed automatically. */
function collectCompressed(source: SourceFile, node: Node, result: CollectResult): void {
	if (isInterfaceDeclaration(node) && node.members.length >= 2) {
		const startLine = source.getLineAndCharacterOfPosition(node.getStart(source)).line ;
		const endLine   = source.getLineAndCharacterOfPosition(node.getEnd() - 1).line     ;
		if (startLine === endLine) result.compressed.push({ line: startLine + 1, members: node.members.length });
	}
	node.forEachChild(child => {
		collectCompressed(source, child, result);
		return undefined;
	});
}

function collect(source: SourceFile, node: Node, minRows: number, seen: Set<Node>, explainLine: number | undefined, result: CollectResult, path: readonly string[] = []): void {
	const isContainer = ROW_KINDS.some(kind => kind.containers(node, seen) !== undefined) ;
	const childPath   = isContainer ? [...path, syntaxKindName(node)] : path              ;
	for (const kind of ROW_KINDS) {
		const siblings = kind.containers(node, seen);
		if (!siblings) continue;
		if (kind.name === "object-rows") for (const sibling of siblings) seen.add(sibling);
		if (explainLine !== undefined) {
			for (const sibling of siblings) {
				if (source.getLineAndCharacterOfPosition(sibling.getStart(source)).line + 1 === explainLine) result.candidates.push(sibling);
			}
		}
		for (const run of runsOf(source, siblings, kind)) {
			if (run.length < (kind.minRows?.(run) ?? minRows)) continue;
			result.groups.push(buildGroup(source, kind.name, kind.groupName ? kind.groupName(run) : kind.name, run, syntaxKindName(node), path.length));
		}
	}
	node.forEachChild(child => {
		collect(source, child, minRows, seen, explainLine, result, childPath);
		return undefined;
	});
}

function applyEdits(text: string, edits: readonly Edit[]): string {
	let result = text;
	for (const edit of [...edits].sort((left, right) => right.start - left.start)) result = `${result.slice(0, edit.start)}${edit.text}${result.slice(edit.end)}`;
	return result;
}

interface Arguments {
	readonly file        : string             ;
	readonly write       : boolean            ;
	readonly minRows     : number             ;
	readonly explainLine : number | undefined ;
	readonly json        : boolean            ;
}

function parseArguments(raw: readonly string[]): Arguments {
	const write        = raw.includes("--write")                                      ;
	const minRowsIndex = raw.indexOf("--min-rows")                                    ;
	const explainIndex = raw.indexOf("--explain")                                     ;
	const minRows      = minRowsIndex < 0 ? 3 : Number(raw[minRowsIndex + 1])         ;
	const explainLine  = explainIndex < 0 ? undefined : Number(raw[explainIndex + 1]) ;
	if (
		raw[0] !== "--file"
		|| !raw[1]
		|| (!Number.isInteger(minRows)
		|| minRows < 3)
		|| (explainLine !== undefined && !Number.isInteger(explainLine))
	) {
		throw new Error("usage: 06_align-tables.ts --file <repository TypeScript file> [--write] [--min-rows 3] [--explain <line>] [--json]");
	}
	return { file: raw[1], write, minRows, explainLine, json: raw.includes("--json") };
}

function errorMessage(value: unknown): string {
	return value instanceof Error ? value.message : String(value);
}

/** Most passes one --write may take before the output must stop changing. */
const MAX_PASSES = 5;

export interface StagedPasses {
	readonly apply  : (working: string, pass: number) => Promise<boolean> ;
	readonly verify : (working: string) => Promise<boolean>               ;
}

/** Repeats passes changing only the working copy, then separately confirms a stable state. */
export async function runStagedPasses(working: string, passes: StagedPasses, maximum = MAX_PASSES): Promise<number> {
	for (let pass = 1; pass <= maximum; pass += 1) {
		if (!await passes.apply(working, pass)) return pass;
	}
	if (await passes.verify(working)) return maximum;
	throw new Error(`alignment did not converge within ${maximum} passes: ${working}`);
}

export type StagedDiagnostics = (text: string) => Promise<readonly string[]>;

/** After writing the working copy, throws and blocks the commit if fresh diagnostics differ or the parser fails. */
export async function writeDiagnosedOutput(working: string, beforeText: string, output: string, diagnostics: StagedDiagnostics, displayPath = working): Promise<void> {
	const before = await diagnostics(beforeText);
	writeFileSync(working, output);
	const after = await diagnostics(output);
	if (before.join("|") !== after.join("|")) {
		throw new Error(`aligned output parses differently (before ${before.join(",") || "none"}, after ${after.join(",") || "none"}); nothing written: ${displayPath}`);
	}
}

/** Applies one pass through the token gate and the re-parse gate to a temporary working file. */
async function writeGroups(root: string, workingRelative: string, displayRelative: string, text: string, groups: readonly TableGroup[]): Promise<boolean> {
	const edits = groups.flatMap(group => group.edits).sort((left, right) => left.start - right.start);
	for (let index = 1; index < edits.length; index += 1) {
		if (edits[index - 1]!.end > edits[index]!.start) throw new Error(`alignment edits overlap: ${displayRelative}`);
	}
	const output = applyEdits(text, edits);
	if (output === text) return false;
	// Vertical rows may insert line breaks; every other edit is whitespace-only between tokens on one line.
	const preserved = groups.some(group => group.vertical > 0) ? preservesTokensWithBreaks(text, output) : preservesTokens(text, output);
	if (!preserved) throw new Error(`combined alignment edits change more than whitespace; nothing written: ${displayRelative}`);
	// Compares before and after with a fresh server while keeping the working copy's original path effects (JSX extension, project settings).
	const absolute = `${root}/${workingRelative}`;
	await writeDiagnosedOutput(absolute, text, output, value => syntacticDiagnostics(root, absolute, value), displayRelative);
	return true;
}

/** Safe groups of a freshly loaded file: detected tables minus those whose edits fail the token check. */
function safeGroups(source: SourceFile, minRows: number): readonly TableGroup[] {
	const result: CollectResult = { groups: [], candidates: [], compressed: [] };
	collect(source, source, minRows, new Set<Node>(), undefined, result);
	return result.groups.filter(group => group.edits.length === 0 || groupPreserved(source, group));
}

export interface TypeScriptAlignOptions {
	readonly root?: string;
	readonly emit?: (line: string) => void;
}

export async function runTypeScriptAlign(args: readonly string[], options: TypeScriptAlignOptions = {}): Promise<number> {
	const root = options.root ?? process.cwd() ;
	const emit = options.emit ?? console.log   ;
	const { file, write, minRows, explainLine, json } = parseArguments(args);
	const say = (line: string): void => { if (!json) emit(line); };
	const { source, relative } = await loadSourceFile(root, file);

	const result: CollectResult = { groups: [], candidates: [], compressed: [] };
	collect(source, source, minRows, new Set<Node>(), explainLine === undefined ? undefined : explainLine, result);
	collectCompressed(source, source, result);
	const detected          = [...result.groups].sort((left, right) => left.startLine - right.startLine)         ;
	const refused           = detected.filter(group => group.edits.length > 0 && !groupPreserved(source, group)) ;
	const groups            = detected.filter(group => !refused.includes(group))                                 ;
	const compressedMembers = result.compressed.reduce((count, entry) => count + entry.members, 0)               ;

	const totalEdits = groups.reduce((count, group) => count + group.edits.length, 0);
	say(`align-tables file=${relative} groups=${groups.length} misaligned=${groups.filter(group => group.edits.length > 0).length} edits=${totalEdits} compressed=${result.compressed.length} compressed-members=${compressedMembers} refused=${refused.length}${write ? " write=true" : ""}`);
	for (const group of refused) say(`  ${String(group.startLine).padStart(4)}-${group.endLine}  ${group.kind} refused — the edit would change more than whitespace between tokens`);
	for (const entry of result.compressed) say(`  compressed  interface-members  line=${entry.line} members=${entry.members} — expanding is a structural change, so it is not fixed automatically`);
	for (const group of groups) {
		const range    = group.startLine === group.endLine ? `${group.startLine}` : `${group.startLine}-${group.endLine}` ;
		const axes     = [...group.axes, ...group.skipped.map(axis => `${axis}=skip`)].join(" ")                          ;
		const vertical = group.vertical > 0 ? `  vertical=${group.vertical}` : ""                                         ;
		say(`  ${range.padStart(9)}  ${group.kind.padEnd(18)} rows=${String(group.rowCount).padStart(2)}  ${axes}  edits=${group.edits.length}${vertical}`);
	}
	if (explainLine !== undefined) {
		if (result.candidates.length === 0) emit(`explain line=${explainLine} no row candidate`);
		for (const candidate of result.candidates) {
			emit(`explain line=${explainLine} node=${syntaxKindName(candidate)}`);
			let matched = false;
			for (const kind of ROW_KINDS) {
				try {
					const boundaries = kind.detect(source, candidate);
					if (!boundaries) continue;
					matched = true;
					emit(`  ${kind.name}: ${boundaries.map(boundary => `${boundary.axis}@${displayColumn(source, boundary.at)}`).join(" ")}`);
				} catch {
					// A detector failing to read this node is itself diagnostic information, so skip silently.
				}
			}
			if (!matched) emit("  no registered kind — classify with 01, then register the kind and axes in grid-kinds.ts");
		}
		return 0;
	}
	const report = (parse: ResultParse): void => {
		if (!json) return;
		const resultGroups: ResultGroup[] = [
			...groups.map(group => ({ kind: group.kind, startLine: group.startLine, endLine: group.endLine, rows: group.rowCount, rowLines: group.rowLines, axes: group.axes, state: group.edits.length > 0 ? "FIXABLE" as const : "PASS" as const, edits: group.edits.length, context: group.context, depth: group.depth })),
			...refused.map(group => ({ kind: group.kind, startLine: group.startLine, endLine: group.endLine, rows: group.rowCount, rowLines: group.rowLines, axes: group.axes, state: "REFUSE" as const, edits: group.edits.length, context: group.context, depth: group.depth })),
			...result.compressed.map(entry => ({ kind: "interface-members-compressed", startLine: entry.line, endLine: entry.line, rows: entry.members, axes: [], state: "SUGGEST" as const, edits: 0 })),
		].sort((left, right) => left.startLine - right.startLine);
		emit(JSON.stringify(envelope([{ file: relative, language: "typescript", mode: write ? "write" : "check", summary: summarize(resultGroups), groups: resultGroups, parse }]), null, 2));
	};
	if (result.compressed.length > 0) { report({ status: "not-run", tool: "typescript" }); return 1; }
	if (write && totalEdits > 0) {
		const target = `${root}/${relative}` ;
		let passes   = 0                     ;
		await updateFileAtomically(target, async ({ working }) => {
			const workingRelative = working.slice(root.length + 1);
			passes = await runStagedPasses(working, {
				apply: async () => {
					const next    = await loadSourceFile(root, workingRelative)                              ;
					const pending = safeGroups(next.source, minRows).filter(group => group.edits.length > 0) ;
					return writeGroups(root, workingRelative, relative, next.source.text, pending);
				},
				verify: async () => {
					const final = await loadSourceFile(root, workingRelative);
					return !safeGroups(final.source, minRows).some(group => group.edits.length > 0);
				},
			});
		});
		say(`  parse=ok tool=typescript passes=${passes}`);
		report({ status: "ok", tool: "typescript", passes });
	} else report({ status: "not-run", tool: "typescript" });
	return !write && totalEdits > 0 ? 1 : 0;
}

export { errorMessage };
