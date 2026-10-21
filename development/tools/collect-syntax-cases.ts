import      { createHash      } from "node:crypto"                ;
import      { spawnSync       } from "node:child_process"         ;
import      {
              mkdirSync     ,
              readFileSync  ,
              writeFileSync ,
                              } from "node:fs"                    ;
import      { resolve         } from "node:path"                  ;

import      { SyntaxKind      } from "typescript/unstable/ast"    ;
import      { ROW_KINDS       } from "@/typescript/grid-kinds.ts" ;

interface PythonNode {
	readonly name                    : string                           ;
	readonly category                : string                           ;
	readonly abstract                : boolean                          ;
	readonly deprecatedCompatibility : boolean                          ;
	readonly fields                  : readonly string[]                ;
	readonly fieldTypes              : Readonly<Record<string, string>> ;
}

const PYTHON_INSPECTION = `
import ast, inspect, json, sys
abstract = {"AST", "mod", "stmt", "expr", "expr_context", "boolop", "operator", "unaryop", "cmpop", "excepthandler", "pattern", "type_param", "type_ignore"}
legacy = {"Num", "Str", "Bytes", "NameConstant", "Ellipsis", "Index", "ExtSlice", "Suite", "slice", "AugLoad", "AugStore", "Param"}
families = ["stmt", "expr", "pattern", "type_param", "operator", "unaryop", "boolop", "cmpop", "expr_context", "mod", "excepthandler", "type_ignore"]
nodes = []
for name, cls in inspect.getmembers(ast, inspect.isclass):
    if not issubclass(cls, ast.AST):
        continue
    category = next((family for family in families if issubclass(cls, getattr(ast, family))), "helper")
    nodes.append({"name": name, "category": category, "abstract": name in abstract, "deprecatedCompatibility": name in legacy,
                  "fields": list(cls._fields), "fieldTypes": {key: str(value) for key, value in getattr(cls, "_field_types", {}).items()}})
print(json.dumps({"version": sys.version.split()[0], "nodes": nodes}))
`;

/** Enumerate finite parser inventories; do not infer alignment approval or claim all combinations are covered. */
export function collectSyntaxCases(root: string, grammarPath: string) {
	const pythonRun = spawnSync("python3", ["-c", PYTHON_INSPECTION], { encoding: "utf8", timeout: 30_000 });
	if (pythonRun.error || pythonRun.status !== 0) throw new Error(pythonRun.error?.message ?? pythonRun.stderr);
	const python = JSON.parse(pythonRun.stdout) as { version: string; nodes: readonly PythonNode[] };
	if (python.version !== "3.14.2") throw new Error(`This collection pins Python 3.14.2; found ${python.version}`);

	const grammar     = readFileSync(grammarPath, "utf8")                  ;
	const grammarHash = createHash("sha256").update(grammar).digest("hex") ;
	if (grammarHash !== "34f0f9b2e8a22760ca4e6e7e56857cb22f4c73e0853e5452b7e93e48ddb17361") throw new Error("Python grammar differs from the inspected official v3.14.2 artifact");
	const productions = [...grammar.matchAll(/^([a-z][a-z_0-9]*)(?:\[[^\]\n]*\])?(?:\([^\)\n]*\))?\s*:/gmu)].map(match => match[1]!);
	if (productions.length === 0 || new Set(productions).size !== productions.length) throw new Error("Missing or duplicate Python grammar productions");
	const packageMetadata = JSON.parse(readFileSync(resolve(root, "node_modules/typescript/package.json"), "utf8")) as { version: string } ;
	const allKinds        = Object.entries(SyntaxKind).flatMap(([name, value]) => typeof value === "number" ? [{ name, value }] : [])      ;
	const kinds           = allKinds.filter(entry => !/^(?:First|Last)/u.test(entry.name) && entry.name !== "Count")                       ;
	if (new Set(kinds.map(kind => kind.value)).size !== kinds.length) throw new Error("Duplicate canonical TypeScript syntax kinds require explicit review");

	return {
		schemaVersion   : 1,
		purpose         : "research-inventory-not-approved-rules",
		scope           : ["typescript", "python"],
		coverageMeaning : "Parser inventory entries collected; semantic roles, variants, examples and alignment decisions remain separate review work.",
		typescript: {
			version: packageMetadata.version,
			source: "typescript/unstable/ast.SyntaxKind in the installed exact-version package",
			kinds: kinds.map(entry => ({
				id: `typescript.syntax.${entry.name}`,
				...entry,
				category          : entry.value >= SyntaxKind.FirstJSDocNode && entry.value <= SyntaxKind.LastJSDocNode ? "documentation-node" : entry.value >= SyntaxKind.FirstNode ? "node" : entry.value >= SyntaxKind.FirstKeyword && entry.value <= SyntaxKind.LastKeyword ? "keyword" : "token-or-trivia",
				aliases           : allKinds.filter(other => other.value === entry.value && other.name !== entry.name).map(other => other.name),
				alignmentDecision : "unreviewed",
			})),
			existingRowKinds: ROW_KINDS.map(kind => kind.name),
		},
		python: {
			version       : python.version,
			source        : `https://github.com/python/cpython/blob/v${python.version}/Grammar/python.gram`,
			grammarSha256 : grammarHash,
			nodes         : python.nodes.map(node => ({ id: `python.ast.${node.name}`, ...node, alignmentDecision: "unreviewed" })),
			productions   : productions.map(name => ({ id: `python.grammar.${name}`, name, category: name.startsWith("invalid_") ? "error-recovery" : "syntax-production", alignmentDecision: "unreviewed" })),
		},
	};
}

if (import.meta.main) {
	if (process.argv.slice(2).some(arg => arg !== "--write")) throw new Error("usage: collect-syntax-cases.ts [--write]");
	const root   = resolve(import.meta.dir, "..", "..")                                                              ;
	const result = collectSyntaxCases(root, resolve(root, ".boxbox/cache/syntax-case-inventory/python-3.14.2.gram")) ;
	const summary = {
		typescriptKinds                : result.typescript.kinds.length,
		typescriptExistingRowKinds     : result.typescript.existingRowKinds.length,
		pythonAstClasses               : result.python.nodes.length,
		pythonConcreteCurrentNodes     : result.python.nodes.filter(node => !node.abstract && !node.deprecatedCompatibility).length,
		pythonSyntaxProductions        : result.python.productions.filter(rule => rule.category === "syntax-production").length,
		pythonErrorRecoveryProductions : result.python.productions.filter(rule => rule.category === "error-recovery").length,
	};
	if (process.argv.includes("--write")) {
		mkdirSync(resolve(root, "development/corpus/syntax"), { recursive: true });
		writeFileSync(resolve(root, "development/corpus/syntax/parser-inventory.json"), JSON.stringify(result, null, "\t") + "\n");
	}
	console.log(JSON.stringify(summary, null, 2));
}
