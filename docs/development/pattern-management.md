# Pattern management

## Purpose and scope

BoxBox should apply consistent, explainable policies to comparable structural roles across diverse code. A pattern
is a relationship between rows and corresponding syntax positions, not a repeated punctuation character. This
contract organizes the READINESS1 implementation; it does not grant automatic-write approval or claim new support.
The current rule registry already controls public write eligibility and authoring examples. Most grouping, axis
extraction and row-floor policies still live in code. SQLite is not currently a runtime dependency.

## Interface

Use the same decision record for every pattern family:

| Question | Required information |
| --- | --- |
| What is a row? | Language, syntactic construct, container and structural role |
| What can share a group? | Supported candidate policy, row order, scope and separation rules |
| What is a column? | Ordered, versioned axis IDs with nesting ownership |
| What stays inside a cell? | Opaque expressions, strings, comments or nested structures |
| What changes the decision? | Missing slots, differing arity, long rows, blank lines, comments and nesting |
| What is the action? | Inspect, approved horizontal alignment, agent structural advice or explicit refusal |
| What proves it? | Positive examples, counterexamples, exact outputs, preservation and applicability evidence |
| Who authorized it? | Exact rule version, scope, layer, example hashes and human decision |

The inventory is distinct from approval. A known family can contain supported, unsupported and unapproved shapes.
A passed recognized group does not establish coverage for the surrounding file. Changes to structural equivalence,
normalization or grouping require explicit version/proof review; new policies cannot inherit an old approval key.

## Process

The target sequence is bounded candidate extraction → policy lookup → deterministic candidate selection →
layout proposal → independent per-write safety checks → result. During migration the existing detector remains
behaviorally authoritative until a tested policy adapter replaces that specific behavior.

Language adapters own parsing, masking, source ranges and finite supported grouping primitives. They enumerate
only candidates whose row/axis ownership can be explained. Policies select among those candidates; they cannot
execute arbitrary scripts, invent parser capabilities or relax content/indentation preservation. Overlapping or
ambiguous candidates must be explicitly resolved by a documented rule or refused, never chosen by file order.

Start with exact existing lookup keys. If a policy affects grouping before the current key exists, introduce a
separate versioned candidate-family selector and keep the final exact-key approval check after grouping. Do not
silently reuse an old key for a broader candidate set. Avoid enumerating all combinations of groupings: supported
primitives bound work per source region, and their behavior/performance needs tests.

Check, Guide and Align must expose the same effective rule selection and layer precedence. Check still does not
prove a future write safe; Guide examples do not prove the agent's generated structure matches a rule. Structural
Refactor decisions remain agent-owned and require behavior/type verification beyond layout checks.

## Data and invariants

### Family inventory

This table is a coverage map and design checklist, not a claim that each case can be automatically aligned.
The first release targets TypeScript, Python, strict JSON and YAML; other language adapters retain existing scope.

| Family | Row/cell model | Distinguishing cases and exclusions |
| --- | --- | --- |
| Imports and exports | Imported names, alias, `from`, module path | Side-effect imports, type-only imports, dynamic paths; alias normalization is Refactor |
| Declarations and assignments | Name, optional type, equals, value | Const/let semantics, destructuring, multiline values, type erasure |
| Function signatures | Name, parameters, defaults, return type | Overloads, optional/rest parameters, decorators, long signatures |
| Calls and chains | Receiver, terminal dot, method, outer parentheses, arguments | Different arities, optional/computed receivers, nested calls; inner punctuation stays inside its owning cell |
| Branches and exits | Condition, branch action, return/throw value | Nested blocks, intervening statements, else, comments, blank lines |
| Object/type members | Key/name, optional marker, colon, value/type | Methods versus fields, nested object types, computed keys, documentation |
| Arrays and repeated records | Element or object row and corresponding fields | Missing/optional fields, nested collections, heterogeneous rows |
| Operators and expressions | Operand, operator, result position | Precedence, short circuiting, ternaries, assignment versus comparison |
| Structured documents | Sibling mapping key, delimiter, scalar value | JSON duplicate keys/escapes; YAML indentation, comments, flow collections, anchors/tags and block scalars |

For each family, record at least one comparable case, one superficially similar but different-role case, one unsupported case, one nesting
case and one whitespace/comment separation case. Long-row behavior remains a separate authoring evaluation. Reuse common dimensions rather than creating a new rule for every
combination. Every case carries related fixture/test evidence and a `design-only` verification label: these snippets are not
claimed to have been executed merely because their broader family has engine tests.

### Current bounded follow-up: Python calculation assignments

Native authoring exposed a difference between shared outer roles and identical inner shapes: arithmetic, a positional
call and arithmetic can all be assignment rows while their right-hand expressions differ. The
[outer-projection implementation plan](proposals/2026-10-22-python-assignment-envelope.md) keeps those expressions
opaque and introduces a separate `name > equal > assignment-value` candidate identity. Existing detailed tables keep
exclusive ownership of their rows; the fallback cannot cross them. This bounded implementation passed source tests,
independent review, the scoped GLM audit, and local/native Windows installed verification on the `2b43d24…` candidate.
The later source-`35b6178` CI candidate also passed its three-OS engine smoke; native-host evidence remains separately scoped.
It is not a new approved rule or coverage for every expression. Its regression and evidence are tracked in
[issue 015](issue-library/records/BBX-20261022-015-python-assignment-envelope.json). The 45 advisory catalog cases keep
their existing design-only labels.

### Policy and evidence ownership

- Engine code: syntax interpretation, safe source ranges, bounded operations, column calculation and safety checks.
- Policy data: supported operation IDs/versions, applicability, group separation, row floors and column selection.
- Evidence: original source locator/hash/license, observed shape, candidate output, tool versions, validation results.
- Approval: reviewable rule/example/decision files; human approval bound to scope, versions and content hashes.
- History: append-only decisions and failed/passed experiments; the issue library records distinct failure mechanisms.

Blank lines are a dimension, not a universal delimiter. Existing declaration groups and spanning return-guard groups
can legitimately use different gap policies. No new global blank-line behavior was authorized by the one-word message.
Nested structures retain separate axis ownership; equal punctuation at different nesting levels is not a shared column.
Widths depend on actual content within a selected group, never on stored absolute column numbers.

### Storage and distribution

Approved JSON/JSONL remains the canonical approval source for the first implementation. Corpus manifests, source
files and recorded observations retain their respective provenance. A development SQLite index may import these
records for cross-family queries, coverage and history; it must declare source hashes/schema version and be
rebuildable. Its rows cannot silently update canonical approvals. Direction: canonical files → derived SQLite.

The shipped rule knowledge is the approved subset plus required examples/policies. It is central to runtime
judgment even when serialized as JSON. Raw corpus, private source and development failures stay out of the payload.
A runtime SQLite dependency requires measured need and a separate compatibility/migration decision; a count such
as 5,000 rules is not an evidence-based threshold. The first implementation must demonstrate a useful query and
rebuild/validation behavior before claiming a SQLite index adds value.

## Change points

Current sources: [signature.ts](../../product/engine/common/signature.ts) owns normalized keys;
[grid-kinds.ts](../../product/engine/typescript/grid-kinds.ts) and
[Python profile](../../product/engine/python/profile.ts) own supported structures;
[conventions.ts](../../product/engine/common/conventions.ts) and
[approval-gate.ts](../../product/engine/common/approval-gate.ts) own selection and proof;
[authoring-guide.ts](../../product/engine/common/authoring-guide.ts) consumes approved guidance.

The first policy experiment uses an existing approved rule without widening its accepted shapes. Guard returns,
heterogeneous calls, nested members and structured documents provide separate counterpressure on the design;
no single family establishes generality. New public conventions require concrete reviewed examples and decisions.
Use [the execution plan](plan.md#completion-loop--readiness1-2026-10-21) for task ownership and order.

## Verification and limits

Acceptance combines golden output, negative applicability, unchanged scope/key authority, syntax validation,
horizontal/content preservation, idempotence and deterministic conflicts. Run the same contracts through installed
artifacts. An observation count or database integrity check cannot replace those checks. Agent authoring quality
requires actual host scenarios in addition to deterministic engine tests. Parser skips and unsupported shapes are
reported separately. The development catalog and derived SQLite index are implemented for nine families and 45 advisory cases. Run:

```bash
bun development/tools/pattern-catalog.ts check
bun development/tools/pattern-catalog.ts index
bun test test/pattern-catalog.test.ts
```

The index is `.boxbox/cache/patterns.sqlite` (ignored). Query `cases` by `kind`, `language` and `family_id` to find
unsupported or different-role examples; `families.policy` retains the complete decision record. Metadata records
the normalized catalog hash (parsed JSON serialization), schema and advisory authority. Rebuilding preserves canonical source bytes; invalid input and
unmanaged output databases are rejected. This is a measured development-only SQLite use, not runtime rule selection.
The current index covers catalog cases, not all corpus observations or approval records.
Implementation uses [Bun's SQLite module](https://bun.com/docs/runtime/sqlite); public Node bundles do not import it.
The bounded runtime policy experiment and recorded installed/native/CI checks passed within their documented scopes.
Public rule decisions, authenticated Claude/current-Windows host journeys and the REL10 artifact lifecycle matrix
remain open in [the execution plan](plan.md).
