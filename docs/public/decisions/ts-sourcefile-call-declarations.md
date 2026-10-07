# Decision: ts-sourcefile-call-declarations

Status: approved convention. Scope: `**/*.ts`.

The engine may align consecutive `const` declaration rows at the top level of a
TypeScript source file (the `SourceFile` context) when every row is a single
call assignment of the form `name = call(...)`. Two or more consecutive rows
form a table; a single row is not a table and is never rewritten by this rule.

Boundaries of this approval:

- Only the exact lookup key `v1|typescript|SourceFile|declaration-equals|equals>call-open-paren>call-close-paren>semicolon`.
- Only rows whose value is one call expression terminated by a semicolon.
- Other AST containers, other initializer shapes, other axis combinations, and
  one-row inputs are out of scope and stay unaligned.

Evidence recorded with the candidate: `check` reports the table as FIXABLE,
the safe write path passes parsing twice (`passes=2`), a re-check reaches
`PASS` with `misaligned=0` and `edits=0`, and the one-row boundary
counterexample produces no edits with identical SHA-256 before and after.
