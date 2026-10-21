# BoxBox storage and grammar audit

Date: 2026-10-21. Repository: `/Users/jonghoPro/woo/00_project/98_BoxBox`. Baseline: `07f568ccec77e70dd57da9aba63f8dc7ef7fcc5a`, branch `m1-safety-proof`. Read-only audit; all new probe/log files are in `/tmp`. No product, preset, approval or user data was changed.

## Result

SQLite is not currently used by the inspected runtime, development tools or tests. There is no SQLite dependency in `package.json` and no tracked `.db`, `.sqlite` or `.sqlite3` file. The explicit current decision is Git-tracked JSON/JSONL as authority, with SQLite potentially added later only as a cache index (`docs/development/plan.md:609`). This audit recommends retaining that boundary and standardizing validation and write guarantees before a storage migration.

The existing safety system is substantial, but storage contracts are uneven. A repeatable probe demonstrated incomplete validation of required fields in three runtime record validators. Public packaging performs stricter checks. This establishes a validation/diagnostic gap, **not** an automatic-format authorization bypass. The write gate separately verifies proof links, approval markers, versions and document hashes, and malformed values can fail through exceptions.

## Actual stores and boundaries

| Store | Authority and format | Implementation and safeguards | Remaining boundary |
|---|---|---|---|
| Approved preset | Shipped read-only JSONL: 2 conventions, 4 examples, 2 decisions | `product/engine/common/conventions.ts`, `examples.ts`, `approval-gate.ts`; `development/tools/public-preset.ts` applies release allowlists, license checks, hashes and links | Runtime record shape checks are less complete than packaging checks; no multi-file snapshot manifest in runtime loader |
| User/project configuration | `~/.config/boxbox/config.json` or XDG location, project `.boxbox/config.json`; schema 2 | `project-config.ts` rejects unknown fields, unsupported versions/languages and symlink files; schema 1 migration is in memory only; deterministic raw/config fingerprints | Automatic mutation/migration command not implemented; config creation is exclusive creation, not a general transactional editor |
| User/project approvals | User/project `conventions.jsonl`, `examples.jsonl`, `decisions.jsonl` | User `db init` creates only missing empty files with `wx`, 0600 and path-component checks; approval registry restricts roots, refuses symlink/nonregular files and duplicate proof IDs | `db status` counts lines/bytes only: it is **not** schema or approval verification; no common approval-record writer or cross-file atomic transaction |
| Corpus research | Pinned manifest, human verdicts, suggestions, observations and candidate caches | `corpus-signatures.ts` emits linked fingerprints/versioned snapshots; `corpus-candidates.ts` validates observation linkage and source hashes, stages a directory with rename/rollback | `corpus-judge.ts:185-186` reads and rewrites the entire verdict log without lock/atomic replace; `corpus-triage.ts:126` similarly rewrites suggestion queue. Concurrent use can lose updates; interrupted writes can damage a log. This is static analysis, not a reproduced race |
| Shape observations | Derived `.boxbox/cache/shape.jsonl` and previous snapshot | `typescript/09_observe-shapes.ts:230-264`: exclusive lock, bounded bytes, temp write, current/previous rotation, rollback on caught rename failure; only completed scans replace cache; fingerprint includes source/parser/extractor/config inputs | Basic lock file has no stale-owner recovery; no fsync durability promise or crash-atomic transaction across the two rename operations. Scope is named TypeScript functions, not all languages |
| Guarded execution evidence | `.boxbox/runs/<id>.json` | `common/guarded-run.ts:159-172` checks evidence directory, creates exclusive temp and renames; status uses OS advisory/process-lock mechanism and freshness comparison | Latest record deserialization uses a TypeScript cast; this is not the same validator as development harness records |
| Hook receipts | Per-host plugin data/root/session directories, falling back to `.boxbox/hooks/<session>` | `lifecycle-hook.ts:19-68`: hashed root/session, exclusive baseline creation, UUID receipt filenames with `wx`, read-only source inspection, no automatic edits | Receipt records/baseline have no schemaVersion or dedicated validator; direct file writes rather than temp+rename; no collection-level transaction/lock. Stop-marker existence test/write is not an atomic once-only acquisition under parallel callbacks. Concurrency/crash behavior was not exercised here |
| Development harness | Git-tracked `runs.jsonl` and `latest.json` | `development/harness/db.ts`: append-only history, read-time minimal record validation, latest temp+rename only for complete runs | Appending history and replacing latest are separate operations; no cross-file lock/transaction; append/update functions do not themselves call validator; validator is explicitly minimal |

Do not conflate source-code write safety with storage safety: `common/safe-file.ts` has exclusive target locks, nonregular/symlink/hardlink refusal, identity/bytes recheck, and same-directory atomic replacement, but most data stores do not use it. Its comment explicitly scopes the lock to cooperating writers. No inspected writer uses fsync, so atomic replacement must not be described as a verified power-loss durability guarantee.

## Validation probe

Command: `bun /tmp/boxbox-storage-probe-20261021.ts`.
Raw results: `/tmp/boxbox-storage-probe-20261021.log`.
The probe read the first shipped record, deleted declared required fields in memory, and called its runtime validator:

- `validateConvention` accepted a convention without `versions`.
- `validateExample` accepted an example without `rules`, `language`, `versions`, `approvedBy`, or `date`.
- `validateDecision` accepted a decision without `examples`, `approvedBy`, or `date`.

Relevant code: `conventions.ts:49-61`, `examples.ts:78-103`. Those validators use casts plus selected field checks. Later proof/guide consumers assume fields exist, so some malformed inputs can produce a generic TypeError instead of a precise path/line/field error. A stricter storage boundary should reject malformed records before indexing or evaluating any decision. The public preset validator already supplies useful stricter patterns but adds publication-specific requirements which must remain separate from generic record schema.

Additional consistency issue: report `loadConventions` loads project+preset and chooses deterministic equal-status ties; approval registry loads project+user+preset and treats any equal-priority multiplicity as conflict. This distinction is explicit in code but should be documented, or unified when changing the inspection contract. An informational report is not proof that writing is authorized.

## Grammar checks already present

`common/grammar-ids.ts` owns WORD/SENTENCE/PARAGRAPH/TEXT, role, pattern, paragraph-purpose and genre IDs. `test/surface.test.ts` checks its arrays against the corresponding Markdown tables and validates TypeScript/Python surface mappings. Every TypeScript kind must map to a pattern; Python fixture table shapes map with explicit ambiguity (e.g. DEFINE versus CHANGE). Unknown kinds stay unmapped, rather than becoming approvals.

These are **BoxBox classification-grammar checks**, not language-parser checks. Parser correctness, masking/token preservation and source-file reparsing remain separate language-engine concerns. The surface registry currently covers TypeScript and Python, not all ten language adapters. `surface.test.ts` therefore cannot establish ten-language semantic parity. Approval examples and decision section hashes have separate validation/tests.

## Recommended maintainable contract

This is a proposal, not an implemented abstraction or a new approval decision.

1. Give each record family one runtime validator accepting `unknown` and returning a typed record, with complete required-field checks and path/line/field errors. Separate generic schema validation from approval proof evaluation and public-distribution policy. Reuse that validator in CLI status validation, readers, writers, tests and any future index importer.
2. Declare for every store: owner, path, authoritative versus derived status, schema version, ID/uniqueness rules, read failure behavior, writer model, atomic boundary, retention, migration, and recovery. A small store catalog is preferable to a generic database layer that hides these differences.
3. Preserve human approvals as reviewable canonical JSONL. Use a validated import/export boundary; do not make corpus counts, SQLite rows or hook receipts silently become approvals. If editing the three linked approval files programmatically, introduce a validated generation manifest and single published pointer, or another explicitly tested bundle transaction.
4. First harden existing mutable research logs and receipts only where their intended writer model requires it. Add temp-file rename, serialized writers, precise corruption diagnostics and recoverable journal policy. Do not label process-crash cleanup as power-loss durability.
5. Add negative tests for missing required fields, malformed/truncated JSONL, duplicate IDs, broken cross-references, unsupported schemas and deterministic round trips. Add real multi-process/interruption tests when introducing concurrent writing; do not substitute self-mirroring tests.
6. Keep migration rules explicit. Config v1-to-v2 already migrates in memory; stale lookup versions are ignored as stale; corpus/shape caches rebuild when fingerprints change. Those are three different policies and should remain visible.

## Bounded SQLite decision

A small optional SQLite index for derived observations, receipts and HUD history is a reasonable future candidate **if measurements show repeated scan/query cost or transactional grouping is needed**. Public approved presets and human-editable configuration should remain canonical files under the current decision. Proposed index rows would carry source hash, schema/index version, run/session ID and completion state; the entire index should be deletable/rebuildable without losing approvals. Validate records before insertion; a database engine does not define domain semantics or validate grammar automatically.

SQLite officially describes local application storage and internal analysis/cache use as appropriate use cases, and permits one writer at a time per database file ([appropriate uses](https://www.sqlite.org/whentouse.html)). SQLite documents atomic, consistent, isolated and durable transactions, including interrupted transactions ([transactional guarantees](https://www.sqlite.org/transactional.html)). These general capabilities have **not** been integrated or measured in BoxBox. Node/Bun packaging support, supported OS behavior, locking, migrations and backup/rebuild must be validated before selecting a driver. No SQLite migration or dependency addition was done in this audit.

Suggested decision gate: benchmark current JSONL load and the actual HUD query with representative bounded datasets, compare a temporary derived SQLite index, then choose based on latency, memory, startup cost, cross-platform packaging and recovery evidence. No measured performance problem has been established here.

## Verification performed

- `bun test --timeout 60000 test/conventions.test.ts test/examples.test.ts test/approval-gate.test.ts test/config-layers.test.ts test/harness.test.ts test/lifecycle-hook.test.ts test/shape-observation.test.ts`: **61 pass, 0 fail**, 7 files, 3.16s. Log `/tmp/boxbox-storage-tests-20261021.log`.
- `bun test --timeout 60000 test/surface.test.ts test/public-preset.test.ts`: **18 pass, 0 fail**, 2 files, 95ms. Log `/tmp/boxbox-storage-grammar-tests-20261021.log`.
- Missing-field probe: **3 accepted malformed variants**, as specified above; no write path invoked.
- Search of runtime/tools/tests and package manifest found no SQLite integration; tracked SQLite filename search found none.
- Initial inventory mistakenly included nonexistent `test/db.test.ts`; rg reported the missing path. Correct user database integration coverage is in `test/public-artifact.test.ts`, which was inspected but **not rerun** during this audit. No nonexistent test is counted as passed.
- No full test suite, native host event test, concurrent write test, crash injection or SQLite benchmark was run. Existing tests establish their tested properties only.
