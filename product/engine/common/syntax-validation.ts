import      { readFileSync                                  } from "node:fs"                          ;
import      { resolve                                       } from "node:path"                        ;

import      { syntaxDiagnostics                             } from "@/common/parse-check.ts"          ;
import type { PublicLanguage                                } from "@/common/project-config.ts"       ;
import      { structuredDiagnostics                         } from "@/structured/index.ts"            ;
import      { syntacticDiagnostics as typeScriptDiagnostics } from "@/typescript/load-source-file.ts" ;

export type SyntaxValidationStatus = "valid" | "invalid" | "error";

export interface SyntaxValidation {
	readonly status      : SyntaxValidationStatus ;
	readonly tool        : string                 ;
	readonly diagnostics : readonly string[]      ;
}

export interface SyntaxValidationInput {
	readonly root     : string         ;
	readonly file     : string         ;
	readonly language : PublicLanguage ;
}

export interface SyntaxValidationDependencies {
	readonly typeScriptDiagnostics?: typeof typeScriptDiagnostics;
}

const messageOf = (value: unknown): string => value instanceof Error ? value.message : String(value);

/** Validates one public input with its real parser. Parser failures are explicit error results, never skips. */
export async function validateSyntax(input: SyntaxValidationInput, dependencies: SyntaxValidationDependencies = {}): Promise<SyntaxValidation> {
	const absolute = resolve(input.root, input.file) ;
	const tool = {
		typescript : "typescript",
		python     : "python3",
		json       : "JSON.parse",
		yaml       : "yaml@2.9.1",
	}[input.language];
	try {
		const raw    = readFileSync(absolute) ;
		const source = raw.toString("utf8"  ) ;
		if (!raw.equals(Buffer.from(source, "utf8"))) throw new Error("input is not valid UTF-8");
		let diagnostics: readonly string[];
		if (input.language === "typescript") diagnostics = await (dependencies.typeScriptDiagnostics ?? typeScriptDiagnostics)(input.root, absolute, source);
		else if (input.language === "python") diagnostics = syntaxDiagnostics("python", source).diagnostics;
		else diagnostics = structuredDiagnostics(source, input.language);
		return { status: diagnostics.length === 0 ? "valid" : "invalid", tool, diagnostics };
	} catch (error) {
		return { status: "error", tool, diagnostics: [messageOf(error)] };
	}
}
