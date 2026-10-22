import      { evaluateApproval                   } from "@/common/approval-gate.ts"  ;
import type { ApprovalRegistry, DocumentResolver } from "@/common/approval-gate.ts"  ;
import      { globToRegExp                       } from "@/common/conventions.ts"    ;
import      { sectionHash, sectionText           } from "@/common/examples.ts"       ;
import      { LOOKUP_KEY_VERSION                 } from "@/common/signature.ts"      ;
import type { PublicLanguage                     } from "@/common/project-config.ts" ;

/** Pre-authoring examples are scoped advice, never proof about a file's contents or permission to write it. */
export function authoringGuide(
	registry: ApprovalRegistry,
	file: string,
	language: PublicLanguage,
	resolveDocument: DocumentResolver
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
	readonly kind     : string            ;
	readonly columns  : readonly string[] ;
	readonly approved : boolean           ;
}

/**
 * Column-set candidates for the row designer: every registered kind with its ordered columns, marked approved when
 * an approved rule for the file is keyed to that kind. Axis notes are included only for axes some kind uses.
 * `{i}` marks a per-position column. This is vocabulary for designing rows, never approval to write them.
 */
export function columnSetGuide(
	kinds: Readonly<Record<string, { readonly gap: readonly string[]; readonly insert: readonly string[] }>>,
	notes: Readonly<Record<string, string>>,
	approvedKeys: readonly string[]
) {
	const approvedKinds = new Set(approvedKeys.map(key => key.split("|")[3]));
	const columnSets: ColumnSet[] = Object.entries(kinds).map(([kind, axes]) => ({
		kind     : kind                          ,
		columns  : [...axes.gap, ...axes.insert] ,
		approved : approvedKinds.has(kind)       ,
	}));
	const used      = new Set(columnSets.flatMap(set => set.columns.map(column => column.replaceAll("{i}", "")))) ;
	const axisNotes = Object.fromEntries(Object.entries(notes).filter(([axis]) => used.has(axis)))                ;
	return { columnSets, axisNotes };
}
