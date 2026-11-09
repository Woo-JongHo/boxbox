import      { evaluateApproval                   } from "@/common/18_approval-gate.ts"   ;
import type { ApprovalRegistry, DocumentResolver } from "@/common/18_approval-gate.ts"   ;
import      { globToRegExp                       } from "@/common/16_conventions.ts"     ;
import      { sectionHash, sectionText           } from "@/common/17_examples.ts"        ;
import      { LOOKUP_KEY_VERSION, lookupKeyOf    } from "@/common/02_signature.ts"       ;
import type { PublicLanguage                     } from "@/common/15_project-config.ts"  ;
import      {
              PYTHON_COLUMN_SETS               ,
              PYTHON_AXIS_NOTES                ,
              PYTHON_UNSUPPORTED_KINDS
                                                 } from "@/python/08_kind-vocabulary.ts" ;

/** Pre-authoring examples are scoped advice, never proof about a file's contents or permission to write it. */
export function authoringGuide(
	registry        : ApprovalRegistry ,
	file            : string           ,
	language        : PublicLanguage   ,
	resolveDocument : DocumentResolver
) {
	const path = file.replaceAll("\\", "/");
	const scopedKeys = registry.conventions
		.filter(record => record.key.startsWith(`v${LOOKUP_KEY_VERSION}|${language}|`)
			&& globToRegExp(record.scope).test(path))
		.map(record => record.key);
	const keys = [...new Set(scopedKeys)].sort();

	const rules       = [] ;
	const unavailable = [] ;

	for (const key of keys) {
		const result = evaluateApproval(registry, { key, file: path }, resolveDocument);
		if (!result.writable || result.status !== "approved") {
			unavailable.push({ key, status: result.status, reasons: result.reasons });
			continue;
		}

		const convention = registry.conventions.find(record => record.id === result.conventionId
			&& record.layer === result.layer)!;

		const decision = registry.decisions.get(convention.id                 )! ;
		const document = resolveDocument       (decision.ref, convention.layer)  ;
		if (sectionHash(document.document, document.heading) !== decision.docHash) {
			throw new Error("approval document changed while preparing guidance");
		}

		const counterexamples = (convention.examples ?? [])
			.map(id => registry.examples.get(id)!)
			.filter(example => example.verdict === "bad" || example.verdict === "before-better")
			.map(example => ({
				id      : example.id     ,
				before  : example.before ,
				after   : example.after  ,
				verdict : example.verdict
			}));

		rules.push({
			id              : convention.id                                    ,
			key             : key                                              ,
			scope           : convention.scope                                 ,
			layer           : convention.layer                                 ,
			contract        : sectionText(document.document, document.heading) ,
			examples        : result.guide                                     ,
			counterexamples : counterexamples                                  ,
		});
	}

	return { rules, unavailable };
}

export interface ColumnSet {
	readonly kind         : string            ;
	readonly columns      : readonly string[] ;
	readonly approved     : boolean           ;
	readonly approvedKeys : readonly string[] ;
}

/**
 * Column-set candidates for the row designer: every registered kind with its ordered columns, marked approved when
 * an approved rule for the file is keyed to that kind. Only approvedKeys identify the exact approved contexts and axes;
 * the kind's complete vocabulary is not an approved row shape. Axis notes are included only for axes some kind uses.
 * `{i}` marks a per-position column. This is vocabulary for designing rows, never approval to write them.
 */
export function columnSetGuide(
	kinds        : Readonly<Record<string, { readonly gap: readonly string[]; readonly insert: readonly string[] }>> ,
	notes        : Readonly<Record<string, string>>                                                                  ,
	approvedKeys : readonly string[]
) {
	const columnSets: ColumnSet[] = Object.entries(kinds).map(([kind, axes]) => {
		const keys = approvedKeys.filter(key => key.split("|")[3] === kind);

		return {
			kind         : kind                          ,
			columns      : [...axes.gap, ...axes.insert] ,
			approved     : keys.length > 0               ,
			approvedKeys : keys                          ,
		};
	});
	const used      = new Set(columnSets.flatMap(set => set.columns.map(column => column.replaceAll("{i}", "")))) ;
	const axisNotes = Object.fromEntries(Object.entries(notes).filter(([axis]) => used.has(axis)))                ;
	return { columnSets, axisNotes };
}

/** Python display families carry several exact identities; approval of one variant never approves its siblings. */
export function pythonColumnSetGuide(approvedKeys: readonly string[]) {
	const approved = new Set(approvedKeys);
	const columnSets = PYTHON_COLUMN_SETS.map(set => {
		const key = lookupKeyOf("python", set.approvalContext ?? undefined, set.approvalKind, set.approvalAxes);
		return { ...set, key, approved: approved.has(key) };
	});
	return { columnSets, axisNotes: PYTHON_AXIS_NOTES, unsupportedKinds: PYTHON_UNSUPPORTED_KINDS };
}
