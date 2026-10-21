import      { spawnSync        } from "node:child_process"        ;
import      {
              mkdirSync      ,
              readFileSync   ,
              writeFileSync  ,
                               } from "node:fs"                   ;
import      { resolve          } from "node:path"                 ;

import      { API              } from "typescript/unstable/async" ;
import      { formatSyntaxKind } from "typescript/unstable/ast"   ;
import type { Node             } from "typescript/unstable/ast"   ;

interface Example {
	readonly id                    : string  ;
	readonly code                  : string  ;
	readonly extension?            : string  ;
	readonly expectedParseFailure? : boolean ;
}

/** Validate research examples without executing them or treating parser coverage as alignment approval. */
export async function verifySyntaxCases(root: string) {
	const directory = resolve(root, ".boxbox/cache/syntax-case-inventory/typescript-examples")                                                                                     ;
	const examples  = JSON.parse(readFileSync(resolve(root, "development/corpus/syntax/typescript-examples.json"), "utf8")) as { cases: readonly Example[] }                       ;
	const variants  = JSON.parse(readFileSync(resolve(root, "development/corpus/syntax/variant-examples.json"), "utf8")) as { cases: readonly (Example & { language: string })[] } ;
	examples.cases = [...examples.cases, ...variants.cases.filter(example => example.language === "typescript")];
	if (new Set(examples.cases.map(example => example.id)).size !== examples.cases.length) throw new Error("Duplicate TypeScript example IDs");
	mkdirSync(directory, { recursive: true });
	const files = examples.cases.map((example, index) => {
		if (example.extension !== ".ts" && example.extension !== ".tsx") throw new Error(`Unsupported example extension: ${example.id}`);
		const path = resolve(directory, `example-${index}${example.extension}`);
		writeFileSync(path, example.code + "\n");

		return path;
	});
	const api                                                                                              = new API({ cwd: root }) ;
	const results: Array<{ id: string; diagnostics: readonly number[]; observedKinds: readonly string[] }> = []                     ;
	try {
		const state = await api.updateSnapshot({ openFiles: files });
		for (const [index, path] of files.entries()) {
			const project = await state.getDefaultProjectForFile(path);
			if (!project) throw new Error(`Missing parser project: ${path}`);
			const source = await project.program.getSourceFile(path);
			if (!source) throw new Error(`Missing source AST: ${path}`);
			const kinds = new Set<string>();
			const visit = (node: Node): void => {
				kinds.add(formatSyntaxKind(node.kind));
				node.forEachChild(child => { visit(child); return undefined; });
			};
			visit(source);
			const diagnostics = await project.program.getSyntacticDiagnostics(path);
			results.push({ id: examples.cases[index]!.id, diagnostics: diagnostics.map(diagnostic => diagnostic.code), observedKinds: [...kinds].sort() });
		}
	} finally {
		await api.close();
	}
	const python = spawnSync("python3", ["-c", `
import ast, json, pathlib, sys
root = pathlib.Path(sys.argv[1])
cases = json.loads((root / "development/corpus/syntax/python-examples.json").read_text())["cases"]
cases += [case for case in json.loads((root / "development/corpus/syntax/variant-examples.json").read_text())["cases"] if case["language"] == "python"]
inventory = json.loads((root / "development/corpus/syntax/parser-inventory.json").read_text())["python"]
if sys.version.split()[0] != inventory["version"]:
    raise ValueError("Python version differs from the inventory")
if len({case["id"] for case in cases}) != len(cases):
    raise ValueError("Duplicate Python example IDs")
observed = set()
negative_count = 0
for case in cases:
    try:
        tree = ast.parse(case["code"], mode=case["parseMode"], type_comments=True)
    except SyntaxError:
        if not case.get("expectedParseFailure", False):
            raise
        negative_count += 1
        continue
    if case.get("expectedParseFailure", False):
        raise ValueError("Expected syntax rejection: " + case["id"])
    kinds = {type(node).__name__ for node in ast.walk(tree)}
    if "observedKinds" in case and sorted(kinds) != case["observedKinds"]:
        raise ValueError("Python example kind coverage drift: " + case["id"])
    observed.update(kinds)
expected = {node["name"] for node in inventory["nodes"] if not node["abstract"] and not node["deprecatedCompatibility"]}
print(json.dumps({"examples": len(cases), "expectedSyntaxRejections": negative_count, "concreteKinds": len(expected), "observedConcreteKinds": len(expected & observed), "missingConcreteKinds": sorted(expected - observed)}))
`, root], { encoding: "utf8", timeout: 30_000 });
	if (python.error || python.status !== 0) throw new Error(python.error?.message ?? python.stderr);
	const inventory = JSON.parse(readFileSync(resolve(root, "development/corpus/syntax/parser-inventory.json"), "utf8")) as { typescript: { kinds: readonly { name: string; category: string }[] } } ;
	const observed  = new Set(results.filter(result => result.diagnostics.length === 0).flatMap(result => result.observedKinds))                                                                     ;
	const nodes     = inventory.typescript.kinds.filter(kind => kind.category === "node")                                                                                                            ;
	return {
		schemaVersion     : 1,
		verification      : "syntax-parsing-and-node-occurrence-only",
		alignmentApproved : false,
		typescript: {
			examples                        : results.length,
			expectedSyntaxRejections        : examples.cases.filter(example => example.expectedParseFailure).length,
			parseFailures                   : results.filter((result, index) => (result.diagnostics.length > 0) !== Boolean(examples.cases[index]!.expectedParseFailure)),
			cataloguedNonDocumentationNodes : nodes.length,
			observedNonDocumentationNodes   : nodes.filter(kind => observed.has(kind.name)).length,
			missingNonDocumentationNodes    : nodes.filter(kind => !observed.has(kind.name)).map(kind => kind.name),
			results,
		},
		python: JSON.parse(python.stdout) as { examples: number; concreteKinds: number; observedConcreteKinds: number; missingConcreteKinds: readonly string[] },
	};
}

if (import.meta.main) {
	const root   = resolve(import.meta.dir, "..", "..") ;
	const result = await verifySyntaxCases(root)        ;
	writeFileSync(resolve(root, "development/corpus/syntax/example-coverage.json"), JSON.stringify(result, null, "\t") + "\n");
	console.log(JSON.stringify({ typescript: { ...result.typescript, results: undefined }, python: result.python }, null, 2));
	if (result.typescript.parseFailures.length > 0 || result.python.missingConcreteKinds.length > 0) process.exitCode = 1;
}
