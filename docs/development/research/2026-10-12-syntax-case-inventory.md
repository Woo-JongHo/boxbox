# Syntax case inventory before alignment policy

Date: 2026-10-12. Scope: TypeScript 7.0.2 and Python 3.14.2, the current first public language scope. The other eight engine languages are not covered by this collection. This is research data, not approved conventions or a change to Hard/Lite behavior.

## Why collect cases first

The current detector sees only its registered forms. Existing corpus evidence contains 18,613 detected observations and 88 candidate keys; those keys are detector-selected, not a census of all language syntax. TypeScript currently has 14 row-kind registry entries, and the Python profiler documents six table forms. These counts use different units and must not be compared as coverage percentages.

The project grammar defines semantic patterns, not a complete language grammar. New catalog IDs therefore use research namespaces (`typescript.syntax`, `python.ast`, `python.grammar`, and language-specific example IDs), not new approved pattern IDs.

## Collected artifacts

| Artifact | Current result | Meaning |
| --- | --- | --- |
| `development/corpus/syntax/parser-inventory.json` | 351 TS syntax kinds | Canonical enum entries; token, keyword, trivia, source-node and documentation categories; aliases retained |
| Same inventory | 133 Python AST classes | Includes abstract and compatibility classes; 113 are current concrete nodes |
| Same inventory | 250 Python grammar productions | 188 syntax productions and 62 error-recovery productions |
| `development/corpus/syntax/typescript-examples.json` | 177 synthetic examples | All parse without syntactic diagnostics in the pinned TS parser |
| `development/corpus/syntax/python-examples.json` | 114 synthetic examples | All parse and collectively observe all 113 current concrete AST node classes |
| `development/corpus/syntax/example-coverage.json` | TS: 139 of 148 non-documentation enum node kinds observed | Nine remaining kinds are explicitly listed; this denominator includes parser/compiler-related entries, not just source statements |
| `development/corpus/syntax/variation-axes.json` | 11 dimensions, 130 listed values | A checklist for expanding variants; not an exhaustive cross-product or formatting policy |

The TypeScript remainder is: SyntheticExpression, MissingDeclaration, SyntaxList, JSTypeAliasDeclaration, JSImportDeclaration, NotEmittedStatement, PartiallyEmittedExpression, SyntheticReferenceExpression, NotEmittedTypeElement. Do not manufacture source syntax to claim coverage of synthetic/internal entries. These entries are collected but their source-example applicability still needs triage. Tokens, trivia and documentation have their own inventory categories and are not included in this structural-node occurrence ratio.

Node occurrence is not case-combination coverage. For example, observing `Call` does not prove every nesting, keyword argument, spread, multiline or delimiter combination has been sampled. A valid parser result is not semantic type checking, execution verification or approval to align.

## Families included in the examples

- Declarations and targets: typed/untyped, initialized/uninitialized, attributes, indices, optional/definite members, destructuring, chained and multiple declarations.
- RHS expressions: literals, names, access, calls, constructors, operators, conditional expressions, lambda/arrow/functions, assertions, templates, collections and comprehensions.
- Calls and parameters: empty/positional/keyword/spread/star arguments, defaults, optional/rest parameters, nesting, trailing commas, multiline syntax and type parameters.
- Types: aliases, generics, bounds/defaults, tuples, unions/intersections, mapped/conditional/indexed/query types, predicates and assertion signatures.
- Program structure: classes, interfaces, namespaces, modules, imports/exports, loops, branches, exceptions, context managers, asynchronous and generator forms, pattern matching, decorators, JSX and basic documentation.
- Operator families are enumerated separately so a single binary-expression example does not stand in for every operator.

## Review record for each future layout case

Keep these questions separate:

1. What syntax family and context is this? Which optional fields and nested shapes are present?
2. Which tokens are structural separators, and what are their roles? A comma inside a string is data; argument, parameter, literal and sequence commas have different contexts.
3. Which separators should become alignment axes? Every current record remains `unreviewed`; collection does not authorize layout.
4. Which rows share width at each level? A matching outer assignment must not automatically require matching inner calls.
5. What are the empty-cell, outlier, paragraph, comment, nesting, display-width and row-floor counterexamples?
6. What evidence permits a rule to enter the approval DB?

Hard can use approved case patterns to guide new structure; Lite can inspect only the approved losslessly recognized layout cases. Neither mode should treat the entire parser inventory as automatically fixable.

## Sources and reproducibility

- Python grammar: [exact CPython v3.14.2 source](https://github.com/python/cpython/blob/v3.14.2/Grammar/python.gram), SHA-256 `34f0f9b2e8a22760ca4e6e7e56857cb22f4c73e0853e5452b7e93e48ddb17361`. [Grammar reference](https://docs.python.org/3.14/reference/grammar.html) and [AST reference](https://docs.python.org/3.14/library/ast.html) explain the underlying parser surfaces. The live 3.14 docs can have a newer patch version; collection uses the exact local 3.14.2 runtime and source.
- TypeScript inventory: the installed exact `typescript@7.0.2` package's `typescript/unstable/ast.SyntaxKind`, not a guessed syntax list. Official language context: [objects](https://www.typescriptlang.org/docs/handbook/2/objects.html), [functions](https://www.typescriptlang.org/docs/handbook/2/functions.html), [types from types](https://www.typescriptlang.org/docs/handbook/2/types-from-types.html), and [ECMAScript statements/declarations](https://tc39.es/ecma262/multipage/ecmascript-language-statements-and-declarations.html).

```bash
mkdir -p .boxbox/cache/syntax-case-inventory
curl -fsSL https://raw.githubusercontent.com/python/cpython/v3.14.2/Grammar/python.gram \
  -o .boxbox/cache/syntax-case-inventory/python-3.14.2.gram
bun development/tools/collect-syntax-cases.ts --write
python3 development/tools/build-syntax-variants.py
bun development/tools/verify-syntax-cases.ts
```

The grammar cache directory must exist before downloading. The collector verifies the inspected grammar hash and exact Python patch version. The verifier parses examples without executing them and closes its TypeScript API server in `finally`. Full local verification output and parser scratch inputs are in `.boxbox/cache/syntax-case-inventory/`.

## Remaining collection work

The finite parser inventories for the selected versions are collected. Further variant interactions, real-code context coverage, documentation/token-specific cases and source applicability of the nine unobserved TS node kinds are not complete. The variation matrix is a backlog of dimensions, not evidence that every combination is generated. Other eight languages require their own version-pinned inventories before claiming ten-language coverage. No new alignment policy, threshold, automatic structural rewrite or human approval was added.

## Bounded variation pass

`development/corpus/syntax/variant-examples.json` adds 1,200 valid multirow examples and 16 intentionally malformed examples. The reproducible generator is `development/tools/build-syntax-variants.py`.

For each language, the valid cross-product is six shapes × five width distributions × four row counts × five layouts = 600 cases. Shapes include same/different callees, different arity, alternating annotated and unannotated definitions, and matching/mismatching nested calls. Widths include a long final-row outlier, escaped wide Unicode and combining characters. Layouts include blank lines, separator comments, trailing comments and CRLF. Row counts 1, 2, 3 and 6 expose the detection floor without prescribing its value.

The complete parsing pass contains 785 TypeScript inputs (777 valid, eight rejected as expected) and 722 Python inputs (714 valid, eight rejected as expected): 1,507 total. No unexpected parsing outcome occurred. Python still covers all 113 current concrete AST classes. TypeScript observes 139 of 148 catalogued non-documentation node kinds in valid source; the remaining nine remain unresolved, not fabricated or automatically excluded. Invalid-source recovery nodes do not inflate positive node coverage.

These inputs are parsed without execution. Syntactic validity does not establish type correctness, runnable programs, engine recognition, content preservation or preferred output. All alignment decisions remain `unreviewed`. This pass covers only the documented bounded cross-product; parameters, destructuring, every delimiter role, container nesting and all combinations across the eleven variation dimensions still need further cases. It adds no engine or approval DB rules.
