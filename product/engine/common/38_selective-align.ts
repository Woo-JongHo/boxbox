import      { readFileSync, writeFileSync } from "node:fs";

import      { assertAlignmentOnly        } from "@/common/10_alignment-only.ts"        ;
import      { comparePythonStructure     } from "@/common/08_parse-check.ts"            ;
import      { evaluateApproval           } from "@/common/18_approval-gate.ts"           ;
import      { structuredOptions          } from "@/common/15_project-config.ts"          ;
import      { toTableGroup               } from "@/common/22_align-cli.ts"                ;
import      { lookupKeyOf                } from "@/common/02_signature.ts"                ;
import      { validateSyntax             } from "@/common/11_syntax-validation.ts"       ;
import      { alignSource                } from "@/common/06_table-engine.ts"             ;

import type { FormatPipelineOptions      } from "@/common/21_format-pipeline.ts"           ;
import type { PublicLanguage            } from "@/common/15_project-config.ts"          ;
import type { ResultGroup                } from "@/common/24_result-json.ts"                ;

import      { PYTHON_ALIGNER              } from "@/python/03_profile.ts"                   ;
import      { analyzeStructured           } from "@/structured/00_index.ts"                 ;
import      { planTypeScriptAlignment     } from "@/typescript/12_align.ts"                   ;
import      { compareTypeScriptLayout     } from "@/typescript/17_layout-preservation.ts"    ;
import      { loadSourceFile              } from "@/typescript/15_load-source-file.ts"       ;

import type { Edit                       } from "@/typescript/12_align.ts"                   ;

interface TablePlan {
	readonly group    : ResultGroup     ;
	readonly edits    : readonly Edit[] ;
	readonly vertical : boolean         ;
}

type SkipCategory = "approval" | "structural" | "safety" | "overlap";

export interface SkippedAlignmentGroup {
	readonly kind      : string            ;
	readonly startLine : number            ;
	readonly endLine   : number            ;
	readonly key       : string            ;
	readonly category  : SkipCategory      ;
	readonly reasons   : readonly string[] ;
}

export class AlignmentSelectionError extends Error {
	readonly skippedGroups: readonly SkippedAlignmentGroup[];

	constructor(message: string, skippedGroups: readonly SkippedAlignmentGroup[]) {
		super(message);
		this.skippedGroups = skippedGroups;
	}
}

function lineOffsets(lines: readonly string[]): number[] {
	let start = 0;
	return lines.map(line => {
		const offset = start;
		start += line.length + 1;
		return offset;
	});
}

function containsLine(group: ResultGroup, line: number): boolean {
	return group.rowLines?.includes(line) ?? (group.startLine <= line && line <= group.endLine);
}

function overlaps(left: ResultGroup, right: ResultGroup): boolean {
	if (left.startLine > right.endLine || right.startLine > left.endLine) return false;
	if (left.rowLines                                                   ) return left.rowLines.some(line => containsLine(right, line));
	if (right.rowLines                                                  ) return right.rowLines.some(line => containsLine(left, line));
	return true;
}

async function plansFor(options: FormatPipelineOptions, working: string, source: string): Promise<readonly TablePlan[]> {
	if (options.language === "typescript") return planTypeScriptAlignment(options.root, working);

	const lines   = source.split     ("\n"        ) ;
	const offsets = lineOffsets      (lines       ) ;
	const config  = structuredOptions(options.root) ;

	const editAt = (index: number, text: string): Edit => ({
		start : offsets[index]!                        ,
		end   : offsets[index]! + lines[index]!.length ,
		text                                           ,
	});

	if (options.language === "python") {
		const aligned = alignSource(source, PYTHON_ALIGNER, { minRows: 3, apply: false, ...config });
		return [
			...aligned.details.map(table => ({
				group    : toTableGroup(table, table.edits.length ? "FIXABLE" : "PASS") ,
				edits    : table.edits.map(({ index, after }) => editAt(index, after))  ,
				vertical : false                                                        ,
			})),
			...aligned.refused.map(table => ({ group: toTableGroup(table, "REFUSE"), edits: [], vertical: false })),
		].sort((left, right) => left.group.startLine - right.group.startLine);
	}

	const aligned   = analyzeStructured   (source, options.language, working, config                                                ) ;
	const candidate = aligned.output.split("\n"                                                                                     ) ;
	const edits     = lines         .map  ((line, index) => line === candidate[index] ? undefined : editAt(index, candidate[index]!)) ;
	return aligned.result.groups.map(group => ({
		group                                                                                                                          ,
		edits    : group.state === "FIXABLE" ? edits.slice(group.startLine - 1, group.endLine).filter(edit => edit !== undefined) : [] ,
		vertical : false                                                                                                               ,
	}));
}

function applyPlans(source: string, plans: readonly TablePlan[]): string {
	const edits = plans.flatMap(plan => plan.edits).sort((left, right) => left.start - right.start);

	let cursor             = 0  ;
	const chunks: string[] = [] ;

	for (const edit of edits) {
		if (cursor > edit.start) throw new Error("selected alignment edits overlap");

		chunks.push(source.slice(cursor, edit.start), edit.text);
		cursor = edit.end;
	}
	chunks.push(source.slice(cursor));
	return chunks.join("");
}

function verifyOwnedLines(before: string, after: string, language: PublicLanguage, selected: readonly TablePlan[]): void {
	const separator = language === "typescript" ? /\r\n|[\r\n\u2028\u2029]/u : "\n" ;
	const left      = before.split(separator)                                       ;
	const right     = after .split(separator)                                       ;

	for (let index = 0; index < left.length; index += 1) {
		if (left[index] === right[index]) continue;
		if (!selected.some(({ group }) => containsLine(group, index + 1))) throw new Error(`alignment changed a line outside the approved selection: L${index + 1}`);
	}
}

function description(group: SkippedAlignmentGroup): string {
	return `L${group.startLine}-${group.endLine} ${group.kind} (${group.reasons.join(", ")})`;
}

async function requireValidSyntax(options: FormatPipelineOptions, working: string): Promise<void> {
	const syntax = await validateSyntax({ root: options.root, file: working, language: options.language });
	if (syntax.status !== "valid") throw new Error(`input does not parse (${syntax.tool}): ${syntax.diagnostics.join(", ")}`);
}

/** Applies only the original approved groups and proves that their identities survive each pass. */
export async function alignApproved(options: FormatPipelineOptions, working: string, display: string) {
	const source = readFileSync   (working) ;
	const text   = source.toString("utf8" ) ;

	await requireValidSyntax(options, working);

	const plans                                   = await plansFor(options, working, text) ;
	const selection                               = new Map<string, TablePlan>()           ;
	const approvals                               = new Set<string>()                      ;
	const skippedGroups : SkippedAlignmentGroup[] = []                                     ;

	const keyOf     = (group: ResultGroup) => lookupKeyOf(options.language, group.context, group.kind, group.axes)                                    ;
	const identity  = (group: ResultGroup) => JSON.stringify([keyOf(group), group.startLine, group.endLine, group.rowLines, group.rows, group.depth]) ;
	const proofFor  = (group: ResultGroup) => evaluateApproval(options.registry, { key: keyOf(group), file: display }, options.resolveDocument)       ;
	const conflicts = (plan: TablePlan, others: readonly TablePlan[]) => others.some(other => other !== plan && overlaps(plan.group, other.group))    ;

	const skip = (group: ResultGroup, category: SkipCategory, reasons: readonly string[]) => {
		const { kind, startLine, endLine } = group;
		skippedGroups.push({ kind, startLine, endLine, key: keyOf(group), category, reasons });
	};

	for (const plan of plans) {
		const { group } = plan;
		if (group.state === "SUGGEST" || group.state === "REFUSE") {
			skip(group, group.state === "SUGGEST" ? "structural" : "safety", [group.reason ?? "engine safety refusal"]);
			continue;
		}

		const approval = proofFor(group);
		if (approval.status !== "approved" || !approval.writable) {
			if (group.state === "FIXABLE") skip(group, "approval", approval.reasons);
			continue;
		}
		if (plan.vertical                                       ) {
			skip(group, "structural", ["alignment-only refusal: requires vertical layout"]);
			continue;
		}
		if (group.state === "FIXABLE" && conflicts(plan, plans) ) {
			skip(group, "overlap", ["rows overlap another detected group"]);
			continue;
		}

		approvals.add(approval.conventionId!);
		if (group.state === "FIXABLE") selection.set(identity(group), plan);
	}

	if (approvals.size === 0) {
		if (skippedGroups.length === 0) throw new Error("no verified approval rule applies to this file");
		const first   = skippedGroups[0]!                                                        ;
		const visible = skippedGroups.slice(0, 5).map(description)                               ;
		const rest    = skippedGroups.length - visible.length                                    ;
		const message = first.category === "approval" ? "approval denied" : "no eligible groups" ;

		throw new AlignmentSelectionError(`${message}: ${first.reasons.join(", ")}. ${visible.join("; ")}${rest ? `; +${rest} groups` : ""}`, skippedGroups);
	}
	const parsed = options.language === "typescript" ? (await loadSourceFile(options.root, working)).source : undefined;

	let current    = text                    ;
	const original = [...selection.values()] ;
	const selected = [...original]           ;
	for (let pass = 0; pass < 5 && selected.some(plan => plan.edits.length > 0); pass += 1) {
		const candidate = applyPlans(current, selected)                                                                        ;
		assertAlignmentOnly(source, Buffer.from(candidate), options.language, parsed);
		verifyOwnedLines(text, candidate, options.language, original);

		if (options.language === "typescript") {
			const layout = await compareTypeScriptLayout(options.root, working, current, candidate);
			if (layout.status !== "preserved") throw new Error(`layout preservation failed: ${layout.reason}`);
		}
		if (options.language === "python") {
			const structure = comparePythonStructure(current, candidate);
			if (structure.status !== "ok") throw new Error(`Python AST preservation failed: ${structure.delta.join(", ")}`);
		}

		writeFileSync(working, candidate);
		current = candidate;

		await requireValidSyntax(options, working);
		const verified = await plansFor(options, working, candidate);
		for (const [index, [id, initial]] of [...selection].entries()) {
			const same = verified.filter(plan => identity(plan.group) === id) ;
			const plan = same[0]                                              ;
			if (!plan || same.length !== 1 || plan.group.state === "REFUSE" || plan.group.state === "SUGGEST" || plan.vertical || conflicts(plan, verified)) {
				throw new Error(`alignment selection changed at L${initial.group.startLine}-${initial.group.endLine}`);
			}
			selected[index] = plan;
		}

		// An edit may expose a newly eligible shape outside the selected ranges.
		const nextEligible = verified.some(plan => {
			const { group } = plan;
			if (group.state !== "FIXABLE" || selection.has(identity(group)) || plan.vertical || conflicts(plan, verified)) return false;

			const approval = proofFor(group);
			return approval.status === "approved" && approval.writable;
		});
		if (nextEligible) throw new Error("alignment introduced a newly eligible group");
	}

	if (selected.some(plan => plan.edits.length > 0)) throw new Error("alignment did not reach a byte fixed point");
	return { approvals: [...approvals].sort(), skippedGroups, boxboxChanged: current !== text };
}
