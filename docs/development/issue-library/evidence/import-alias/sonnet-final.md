**PASS**

I found no contradictions in the pasted SKILL.md, issue record and plan text. This review covers only that text. I did not open `AGENTS.md`, `check-layout.ts` or `tsconfig.json` to confirm the constraints they describe.

**Align does not authorize alias rewriting**
- The workflow table limits Align to "approved horizontal whitespace only".
- The `align` bullet says it "preserves line structure, indentation and non-layout content".
- Write/Refactor step 3 says "Path changes belong to Write/Refactor, not Align".
- The issue record's third decision repeats that "horizontal Align never rewrites module specifiers".
- The plan says "Align remains whitespace-only".

**The product alias ban is retained until migration**
- SKILL.md tells the agent to "retain relative imports where its current contract requires them" and to use an alias only "where equivalent resolution is verified". This does not override the repository's product-source restriction.
- The plan says product sources "keep relative imports until the resolver, checker and installation migration … is implemented and verified".
- The issue record's third decision matches the plan. Its action items and the `not-run` verification both show the migration is not implemented.
- The plan's item 2 migrates the resolver, checker, tests and convention together, and says the existing `@/*` meaning is retained.

**Non-blocking wording notes**
1. The issue record says "Keep the existing `@/*` engine-root meaning during investigation", while the plan says "unless a migration requires an explicit configuration change". These are compatible, but you could align the wording.
2. SKILL.md allows changing resolver configuration "only within the authorized scope". In this repo that could let an agent start the resolver migration piecemeal. The "current contract requires relative" clause and the plan's "together" requirement already cover it, so I wouldn't block on it. Adding "do not migrate product imports before the plan's item 2 lands" to the repo-specific docs would close the gap.
