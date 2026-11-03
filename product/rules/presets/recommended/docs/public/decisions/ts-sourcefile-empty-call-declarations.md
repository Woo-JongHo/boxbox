# TypeScript source-file empty call declarations

Two or more consecutive variable declaration rows in a TypeScript source file may be aligned when each initializer is one direct call and the engine detects exactly the lookup key `v1|typescript|SourceFile|declaration-call-envelope|equals>call-envelope-open>semicolon`. The opening parentheses align. The scope is `**/*.ts`; the pattern is `DEFINE`. Execution order and all non-whitespace tokens must be preserved.

This key covers rows with empty calls, same-callee empty calls, and a run where only one row has arguments. Member calls, including a run where only one row is a member call, report the `call-member-dot` axis and are outside this approval, as are type annotations and comments outside the call, including one on only one row, `new`, `await`, other AST containers and other axis combinations.

The positive example `ts-sourcefile-empty-call-declarations-positive` records the approved transformation. A single declaration is outside the rule and must remain unchanged. In `ts-sourcefile-empty-call-declarations-single-row-counter`, the padded after form has verdict `bad` because automatically rewriting a single row violates that boundary; this is not a general style judgment about manually written whitespace.

Frequency evidence: this shape is justified by the first-run path, not by measured frequency. It occurred in 0 of 196 fixable groups across 220 non-test TypeScript files of two public repositories measured on 2026-11-03.

A human maintainer approved this exact scope, the positive example and the excluded boundary on 2026-11-03. The public receipt uses the anonymous role `maintainer`; it does not grant approval for additional rules. The linked short synthetic examples are provided under CC0-1.0.
