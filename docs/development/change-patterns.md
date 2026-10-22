# Change patterns

## Purpose and scope

Use this sequence to make BoxBox easier to extend without copying lifecycle logic into every language. The recipes
map to today's modules. Parser/detector expansion, new rule approval and runtime storage remain separate changes.

## Interface

Every change description should identify: affected command, input case, expected result/refusal, side effects,
source owner, regression evidence and current support scope. A design proposal must identify its compatibility
impact before changing JSON versions, exit codes or hook decisions.

## Process

### Diagnose and retain an issue

Search the [issue library](issue-library/README.md) by symptom, syntax boundary or affected module before proposing
a fix. Use its schema and template to record a new reproduction, cause, decision, work and verification evidence.
Append new events to an existing issue when the cause is the same; link related records when the cause differs.
Preserve failed approaches and distinguish an observed defect, a proposed fix and a verified resolution. Dated
reviews hold detailed evidence; the library is the searchable entry point, not a replacement for those artifacts.

### Add or change a language pattern

1. Capture a small synthetic positive fixture and a counterexample where alignment must not happen. Keep strings,
   comments, indentation, evaluation order and the existing row floor intact.
2. For a line-engine language, edit `product/engine/<language>/profile.ts`; use the shared table engine and thin
   `01_group-regions.ts` / `06_align-tables.ts` wrappers. For TypeScript, edit the AST detector/kind implementation
   and `typescript/grid-kinds.ts` as needed.
3. Update `test/fixtures/<language>/` and the language alignment suite. Check preservation, exact golden output,
   idempotence, parser behavior, traps and minimum rows. TypeScript has its own AST suite.
4. If role classification changes, update the applicable base surface mapping and grammar consistency tests.
   New grammar IDs or approved taste require the existing human decision procedure; detection alone is not approval.
5. For a newly added language, include it in the common JSON contract test and toolchain setup, then update discovery
   text/manifests together. Public CLI admission additionally requires configuration, approval, format-pipeline,
   installed-artifact and supported-platform coverage.

### Change an inspection or write stage

1. State whether the change affects read-only inspection, provisional readiness, candidate verification or commit.
2. Edit the owning common module; keep syntax-specific operations in adapters. Do not duplicate approval, fixed-point
   or commit logic in each language wrapper.
3. Test success and a meaningful refusal: invalid syntax with zero tables, missing/faulting parser, unapproved table,
   formatter failure, provenance change or external edit as applicable.
4. Verify output states and exit behavior in the public CLI. For a shared result change, check hook consumers.
   Missing verification must remain visible rather than becoming a green status.

### Change data storage

1. Fill the store-contract table in [storage.md](storage.md) for the affected store.
2. Separate record validation, approval proof and release policy. Define required fields and version compatibility
   before editing persistence code.
3. Select a commit/locking strategy matching the actual writer model. Reproduce malformed data and failure recovery
   before claiming resilience; add multi-process tests if concurrency is a requirement.
4. Preserve a deterministic export or rebuild path. A derived cache must not become the only copy of human decisions.

## Data and invariants

Canonical source ownership:

| Change | Edit | Derived output / verification |
| --- | --- | --- |
| Engine behavior | `product/engine/` | Engine/CLI safety tests |
| Rule vocabulary and approved data | `product/rules/` | Surface, proof and public-preset validation |
| Host plugin | `product/plugin/` | `bun run sync:plugin`; generated `plugin/`; strict host validation |
| Installer | `product/installer/` | Isolated installed-artifact journey |
| Corpus or development tools | `development/` | Development-only tests; artifact exclusion |
| Explanation of current behavior | Owning development document | Source links, commands and dated evidence |

Within `product/engine/`, TypeScript module imports use the engine-root `@/` alias. Do not translate the rules-owned
layout JSON import or `new URL(..., import.meta.url)` file lookups: those cross the engine module boundary or preserve
runtime file-relative semantics. `bun run check:layout` rejects missing, escaping, symbolic and unintended relative
engine module targets; module-specifier changes belong to Write/Refactor rather than whitespace-only Align.

See [layout.md](layout.md) for generation rules. Avoid editing generated files as their source. Keep machine evidence
as recorded; add an interpretation when a raw summary overstates what was measured.

## Change points — current completion and next work

| Priority | Bounded change | Acceptance evidence |
| --- | --- | --- |
| Closed in READINESS1 | Read-only syntax inspection, separate from alignment | Four-language valid/invalid/error results; invalid no-table cases stop before inspection |
| Closed in READINESS1 | Runtime convention/example/decision validation | Unknown runtime values are shape-checked; approval and publication policy remain separate |
| Next | Complete all-code-language shared result coverage; consolidate duplicated inspection dispatch where useful | Ten adapter result shapes and explicit capabilities; existing behavior preserved |
| 4 | Harden mutable data writers according to their stated writer model | Actual interruption/concurrency reproduction and recovery tests |
| Implemented development slice | Rebuildable SQLite pattern index | Nine families and 45 advisory cases; integrity, ownership and canonical-source checks |
| Later decision | Evaluate any runtime SQLite use | Measured need, migration and installed-platform evidence |

Closed rows record work implemented after the dated documentation audit; the remaining rows are not completion claims.
Use [plan.md](plan.md) for the single active execution task.

The pattern catalog and `.boxbox/cache/patterns.sqlite` are development-only advisory data. Canonical JSON rebuilds
the index, and neither the catalog nor the index grants approval. The default public preset still contains only the
existing TypeScript and Python rules.

## Verification and limits

Start with the affected suites named in [inspection-process.md](inspection-process.md) or [storage.md](storage.md).
For implementation changes, finish with `bun run check` and relevant artifact/host checks. Do not install new
language toolchains silently merely to hide skipped tests; record the environment and required CI verification.
For documentation-only changes, check source fidelity, relative links, English prose and an independent review.
