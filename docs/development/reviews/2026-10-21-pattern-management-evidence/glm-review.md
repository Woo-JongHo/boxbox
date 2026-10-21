# Architectural Review: BoxBox Pattern Management

## Verdict

**Sound direction, with required revisions.** The proposal's core commitments are correct: safety invariants live in code, data selects among tested policies, one approval authority, evidence-gated expansion (all consistent with supplied facts about the current design). But it under-specifies four things that will determine success: where axis-normalization policy lives, how rules can select grouping without circularity, what happens to grouping policies already hardcoded in the engine, and what the runtime contract for SQLite would be. Adopt only after these are resolved.

## Sharpening the objective

The product goal is not visual uniformity — making text look alike — but **equivalence of role**: when rows occupy the same structural role (same slot structure, same container semantics), they deserve consistent columns; when they merely *look* similar, forcing alignment is wrong. The supplied key design already encodes role judgments: `normalizeAxis` collapsing callees to `call:*` asserts "different function names share a pattern" (fact), and `{i}` asserts positional equivalence. **These equivalence classes are the product's actual judgment, and they currently live in code, invisible to the approval process.** That is the central inconsistency to fix.

Measurable success should be stated now, e.g.: (1) every table the engine groups in a labeled corpus maps to an approved rule or is emitted as an unapproved key — zero unexplained groupings; (2) Align is idempotent and whitespace-only (AST-hash equal) on the corpus; (3) approved counterexamples never match; (4) check and refactor agree on rule applicability. None of these requires SQLite.

## Top risks

1. **Grouping-before-lookup circularity (architectural, highest priority).** The lookup key contains `kind` and axes, which are products of detection and grouping (fact). So grouping is decided before the rule is known; a rule that wants different grouping — guard returns spanning intervening statements — cannot be expressed, because the key presupposes a grouping it never authorized. *Fix:* the engine enumerates a bounded set of **candidate groupings** (including gap-spanning candidates); the key is computed per candidate; rules approve/reject candidates and select column policies. No rule creates groupings the engine didn't enumerate; unknown structure means a new adapter (as proposed). This converts circularity into a pipeline.

2. **Semantic role ambiguity.** "Share outer parens across different callees/arities" requires deciding that arity is not a role. `call:*` already ignores callee (fact); whether paren count collapses is unstated — hypothesis: it currently doesn't, which would silently split the requested pattern across keys. Every equivalence-class decision must be data-visible and per-rule, not buried in `normalizeAxis`.

3. **Rules are less data than claimed; hardcoded policy is a live conflict.** `gap: "blank"` and `minRows` (2+ for equals-bearing rows) live in `ROW_KINDS` (fact) — a universal blank-line policy already ships with no approved rule, predating the user's refusal to authorize one. The registry cannot express exceptions. The pivot from "rules as documentation keyed by structure" to "rules as selected policies" is the real change being proposed; migrating existing hardcoded policy into rule data must be explicit, or you will have two sources of truth.

4. **Overlapping rules and key collisions.** The key admits one convention per structural shape; two valid policies for the same key cannot coexist without scope disambiguation, and `declaration`/`type-members` can both fire on nested structures (fact). Precedence exists for scopes (project > user > preset, fact) but not for two rules matching one candidate. Also: the report-only loader omits user records (fact) — check may report nonconformance for code the user already approved. False negatives erode trust faster than false positives.

5. **False confidence from approval.** Approval asserts "this layout is wanted," never "this write is safe." Check doesn't validate syntax; record validation has gaps (facts). The `evidence` field counts toward nothing (fact), and both rules were approved the same day by "maintainer" — history depth of one. Decisions must record *basis* (corpus result, counterexample analysis), and rejection records are as valuable as approvals.

## Minimal conceptual data model

- **Engine (code, tested):** parsing, adapters, row extraction, bounded candidate-grouping primitives, alignment transforms, safety invariants (idempotence; Align whitespace-only), versioned key functions. Normalization equivalence classes should be *declared per language pack as data* and validated by the engine, so the key remains a public contract (as documented) while its policy content becomes reviewable.
- **Rule data:** id, lookup key(s), selection predicate over candidates (bounded vocabulary — no general DSL), column policy, row floor, **gap/blank-line policy scoped to the rule's context**, depth policy, scope, status, versions, example/counterexample ids with hashes.
- **Evidence:** observations keyed by key/scope (counts, corpus results, idempotence/AST-equality outcomes). Never approval-eligible (fact-preserved).
- **Approval:** human decision record — who, when, basis, artifact hashes — from exactly one canonical authority; precedence resolves conflicts but not authority.
- **History:** append-only decision log including rejections, key-version migrations (explicit, never loose matching — fact preserved).

**Blank lines and nesting are contextual policy fields on a rule, not punctuation rules**: a guard-return rule may tolerate N blank lines within its container; depth sensitivity rides on the diagnostic signature (which retains depth, fact) without polluting lookup identity.

## Storage options

- **Dev-only SQLite:** right tool for the actual pain — querying evidence across keys, finding near-duplicate or orphan keys, measuring hit rates and rule-overlap. Risk: export drift.
- **Runtime SQLite:** unjustified now. Two rules (fact); lookup is trivial at any plausible scale; it adds driver packaging, migrations, and a second writable surface that invites the DB-becomes-authority failure the user originally imagined.
- **JSON/JSONL-first:** matches current distribution, diffable, reviewable in PRs.

**Recommendation:** JSON/JSONL is the canonical approved artifact; SQLite is a derived, development-only analysis index. Deterministic one-way export (SQLite → canonical JSONL: sorted, stable serialization, hash manifest) with CI verifying the shipped artifact equals the export. Runtime never opens a database. **Triggers to revisit:** runtime rule count exceeding scan budgets (e.g., >5k entries or measurable startup cost); runtime need for cross-rule conflict queries; per-project decision stores growing into thousands of records. Even then: a read-only derived cache, exported from the canonical authority — never a writable runtime DB.

## Smallest useful experiment

The proposed trial (data-driven execution on one existing approved rule, authority unchanged) is right. Concretely, the TypeScript `ts-sourcefile-call-declarations` rule:

- **Positive:** two same-call declarations → columns per the rule's declared policy, byte-identical to today's output on a golden corpus.
- **Negative:** single-row declaration (the rule's own counterexample) and mixed callees → no match, key emitted in report-only output.
- **Acceptance:** idempotence (align twice → identical bytes); AST-hash equality pre/post; zero change on files outside scope; report-only loader either loads user records or the divergence is explicitly documented as excluded (it is currently a known gap, fact).
- **Migration/rejection:** unknown keys surface verbatim in reports; `LOOKUP_KEY_VERSION`/`SIGNATURE_VERSION` bumps require explicit migration (existing contract, fact); rejected candidates recorded with reason.

Run the guard-return decision table **on paper first** — it is a role-classification exercise (which returns are "the same thing"?) that only produces a rule after cases agree. Do not build a rule DSL; a bounded predicate vocabulary over engine-emitted candidates suffices.

## Three decisions needed from the user now

1. **Confirm the objective** as role-equivalence consistency with safe defaults elsewhere — and that hardcoded `gap: "blank"` and row floors migrate under rule authority as contextual policy.
2. **Name the canonical approval authority** and whether user-scope decisions participate in read-only Check (fixing or formally excluding the loader divergence).
3. **Define "same role" for guard returns** — what intervening statements and arity variation are tolerable. This is a semantic judgment no architecture can supply.

Everything else — schema details, SQLite DDL, export tooling — is deferrable engineering.
