import      { lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs" ;
import      {
              dirname                 ,
              extname                 ,
              isAbsolute              ,
              relative                ,
              resolve                 ,
                                        } from "node:path"                       ;
import      { SyntaxKind                } from "typescript/unstable/ast"         ;
import      { createScanner             } from "typescript/unstable/ast/scanner" ;

const ROOT                       = resolve(import.meta.dir, "../..")                                                 ;
const ENGINE_RELATIVE_EXCEPTIONS = new Set(["typescript/layout-policy.ts\0../../rules/base/typescript-layout.json"]) ;

export function containedRelative(value: string, absolute = isAbsolute(value)): boolean {
	if (absolute) return false;
	let depth = 0;
	for (const part of value.replaceAll("\\", "/").split("/")) {
		if (!part || part === ".") continue;
		if (part === "..") {
			if (depth === 0) return false;
			depth -= 1;
		} else depth += 1;
	}
	return true;
}

/** Product imports stay inside product/ or use external packages. Development consumes product/. */
export function layoutViolations(root = ROOT): readonly string[] {
	const product            = resolve(root, "product")             ;
	const engine             = resolve(product, "engine")           ;
	const failures: string[] = []                                   ;
	const scanner            = new Bun.Transpiler({ loader: "ts" }) ;
	function aliasDestination(specifier: string): string | undefined {
		const destination = resolve (engine, specifier.slice(2)) ;
		const lexical     = relative(engine, destination       ) ;
		if (!containedRelative(lexical)) return;
		try {
			let cursor = destination;
			while (cursor !== engine) {
				if (lstatSync(cursor).isSymbolicLink()) return;
				const parent = dirname(cursor);
				if (parent === cursor) return;
				cursor = parent;
			}
			if (!lstatSync(destination).isFile()) return;
			const physical = relative(realpathSync(engine), realpathSync(destination));
			if (!containedRelative(physical)) return;
			return destination;
		} catch {
			return;
		}
	}
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
			if (specifier.startsWith("@/")) {
				if (!aliasDestination(specifier)) failures.push(`${relative(root, path)}: invalid engine alias ${specifier}`);
				return;
			}
			if (!specifier.startsWith(".") && !isAbsolute(specifier)) return;
			if (specifier.startsWith(".")) {
				const importer = relative(engine, path).replaceAll("\\", "/");
				if (containedRelative(importer)) {
					const exception   = `${importer}\0${specifier}`                         ;
					const destination = relative(engine, resolve(dirname(path), specifier)) ;
					const internal    = containedRelative(destination)                      ;
					if (!ENGINE_RELATIVE_EXCEPTIONS.has(exception)) failures.push(`${relative(root, path)}: ${internal ? "engine module must use @/ alias" : "engine relative module outside alias root"}: ${specifier}`);
					return;
				}
			}
			const destination = relative(product, resolve(dirname(path), specifier));
			if (!containedRelative(destination)) failures.push(`${relative(root, path)}: product dependency escapes product/: ${specifier}`);
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
