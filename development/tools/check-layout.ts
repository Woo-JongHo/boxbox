import      { readdirSync, readFileSync } from "node:fs"                         ;
import      {
              dirname                 ,
              extname                 ,
              isAbsolute              ,
              relative                ,
              resolve                 ,
                                        } from "node:path"                       ;
import      { SyntaxKind                } from "typescript/unstable/ast"         ;
import      { createScanner             } from "typescript/unstable/ast/scanner" ;

const ROOT = resolve(import.meta.dir, "../..");

/** Product imports stay inside product/ or use external packages. Development consumes product/. */
export function layoutViolations(root = ROOT): readonly string[] {
	const product            = resolve(root, "product")             ;
	const failures: string[] = []                                   ;
	const scanner            = new Bun.Transpiler({ loader: "ts" }) ;
	for (const entry of readdirSync(product, { recursive: true, withFileTypes: true })) {
		if (entry.isSymbolicLink()) failures.push(`${relative(root, resolve(entry.parentPath, entry.name))}: symbolic product source`);
		if (!entry.isFile() || ![".ts", ".mjs"].includes(extname(entry.name))) continue;
		const path    = resolve(entry.parentPath, entry.name)                             ;
		const text    = readFileSync(path, "utf8").replace(/^#![^\n]*\n/u, "")            ;
		const imports = new Set(scanner.scanImports(text).map(imported => imported.path)) ;
		// Bun removes type-only imports; retain their module specifiers with the TS scanner.
		const tokens       = createScanner(true, undefined, text) ;
		let previous       = SyntaxKind.Unknown                   ;
		let beforePrevious = SyntaxKind.Unknown                   ;
		for (let kind = tokens.scan(); kind !== SyntaxKind.EndOfFile; kind = tokens.scan()) {
			if (tokens.getTokenEnd() === tokens.getTokenStart()) kind = tokens.reScanInvalidIdentifier();
			if (kind === SyntaxKind.StringLiteral && (previous === SyntaxKind.FromKeyword || (previous === SyntaxKind.OpenParenToken && beforePrevious === SyntaxKind.ImportKeyword))) imports.add(tokens.getTokenValue());
			beforePrevious = previous;
			previous = kind;
		}
		function check(specifier: string): void {
			if (specifier.startsWith("@/")) failures.push(`${relative(root, path)}: repository alias ${specifier}`);
			if (!specifier.startsWith(".") && !isAbsolute(specifier)) return;
			const destination = relative(product, resolve(dirname(path), specifier));
			if (destination === ".." || destination.startsWith("../") || isAbsolute(destination)) failures.push(`${relative(root, path)}: product dependency escapes product/: ${specifier}`);
		}
		for (const imported of imports) check(imported);
	}
	return failures;
}

if (import.meta.main) {
	const failures = layoutViolations();
	for (const failure of failures) console.error(failure);
	console.log(`product dependencies: ${failures.length === 0 ? "PASS" : "FAIL"}`);
	process.exitCode = failures.length ? 1 : 0;
}
