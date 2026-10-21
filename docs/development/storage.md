# Storage and validation

## Purpose and scope

BoxBox's runtime and approval authority use JSON and JSONL. READINESS1 adds a development-only SQLite index of
nine pattern families and 45 advisory cases; it is not a runtime dependency or approval source. Human approvals
remain reviewable files; derived observations remain separate. This document records the current contracts and hardening proposals, not a completed migration.
The [dated audit](reviews/2026-10-21-maintainer-docs.md) contains probes, tests and source references.

## Interface

`boxbox db init` creates missing empty user-layer `conventions.jsonl`, `examples.jsonl` and `decisions.jsonl` files.
`boxbox db status` reports presence, nonempty line counts and bytes. **It is not an integrity or approval validator.**
No general public approval editor, import/export, backup or SQLite migration command exists today.

The approval gate (`loadApprovalRegistry` and `evaluateApproval`) evaluates exact rule keys, scope/layer selection, linked examples and decisions, human approval
markers, version agreement and referenced document hashes. Reading a syntactically valid JSON record is only the
first step; it is not enough to authorize formatting.

## Process

The current conceptual data flow is:

```text
observations → candidates → human decision + examples → validated approval proof → GUIDE / public format
                   ↓
          research-only proposals
```

An observation, model suggestion or hook receipt cannot promote itself into an approved rule. Generic record shape,
rule-proof evaluation and public-distribution policy are three separate validation responsibilities.

| Store | Authority and location | Current protection | Important limit |
| --- | --- | --- | --- |
| Recommended preset | `product/rules/presets/recommended/`; shipped read-only JSONL | Runtime proof checks plus stricter release field/license/hash/link checks | Generic complete shape validation; publication requirements remain stricter |
| Configuration | User config root and project `.boxbox/config.json` | Schema 2; unknown fields rejected; schema 1 migrates in memory; fingerprints | Not a general transactional config editor |
| User/project approval records | User config root or `.boxbox/`; three JSONL files | Exclusive initialization; guarded loader; duplicate proof checks | No transaction covering all three files; no general record writer |
| Corpus observations and candidates | Development manifests and ignored research cache | Provenance/version hashes; candidate staging and rollback | Guarantees vary by tool; research verdict/queue rewrites are not serialized transactions |
| Shape observations | `.boxbox/cache/shape.jsonl` and previous snapshot | Exclusive lock, temporary write, rotation and caught-error rollback | Stale-lock recovery and power-loss durability not established |
| Guarded run evidence | `.boxbox/runs/<id>.json` | Temporary file and rename; execution locking | Latest-record read is not a full schema validator |
| Hook receipts | Host plugin data/root/session, or project fallback | Unique exclusive receipt files; read-only source inspection | No schemaVersion/dedicated receipt validator; concurrent Stop marker acquisition not proved atomic |
| Development harness | `development/harness/evidence/runs.jsonl` and `latest.json` | Append history, minimal read validation, atomic latest-file replacement | History and latest are separate writes, not one transaction |

Owners: [project-config.ts](../../product/engine/common/project-config.ts),
[approval-gate.ts](../../product/engine/common/approval-gate.ts),
[conventions.ts](../../product/engine/common/conventions.ts), [examples.ts](../../product/engine/common/examples.ts),
[public-preset.ts](../../development/tools/public-preset.ts),
[shape observer](../../product/engine/typescript/09_observe-shapes.ts),
[lifecycle-hook.ts](../../product/engine/common/lifecycle-hook.ts),
[guarded-run.ts](../../product/engine/common/guarded-run.ts), [harness DB](../../development/harness/db.ts).

## Data and invariants

For any new or modified store, explicitly record:

| Contract field | Required answer |
| --- | --- |
| Authority | Human-approved source, observed evidence, or rebuildable cache? |
| Schema | Version, required fields, unknown-field policy, IDs and uniqueness |
| References | Which hashes, decisions, examples, source versions and files must match? |
| Reader | Missing, malformed, truncated, stale and incompatible-record behavior |
| Writer | Single writer or cooperating concurrent writers; lock owner and recovery |
| Commit | Atomic unit: one record, file, directory generation or transaction |
| Recovery | Interrupted writes, stale locks, backup/restore or deterministic rebuild |
| Retention | Size limits and which records may be deleted without losing authority |
| Evidence | Negative tests, concurrency/crash tests when relevant, and supported platforms |

READINESS1 closes the previously reproduced missing-field gaps in `validateConvention`, `validateExample` and
`validateDecision`. Their shared runtime helper validates unknown input, required/nested fields and reference arrays;
JSONL failures include source and line information. Local extensions and candidate records remain supported.
`test/runtime-record-validation.test.ts` pins malformed input and compatibility cases. This is shape validation,
not an approval grant; proof and public-distribution license checks still run separately.

The report-mode loader (`loadConventions`) reads project+preset, while the approval registry includes user records too and has
stricter equal-priority conflict handling. Treat informational lookup and write authorization as distinct until their
interfaces are deliberately unified.

Atomic replacement of source files is not evidence that all stores are atomic, concurrent-safe or durable after power
loss. The inspected data writers do not establish an fsync-based durability guarantee. Suspected corpus lost-update
and hook-marker races are source-review findings; concurrent failure was not reproduced in this audit.

## Change points — proposed hardening and SQLite decision

Runtime record validators are implemented. Any future approval editor must reuse them at entry and retain separate
proof and publication policies. Record and registry tests cover malformed shapes and broken proof references.

Second, choose an explicit transaction unit before adding an approval editor. A three-file approval update needs a
validated generation/publication strategy or a transaction with a tested canonical export. Do not add independent
rewrites and call their combination atomic. Mutable corpus logs need a stated writer model and recovery tests.

**Implemented bounded SQLite use:** [pattern management](pattern-management.md) documents the development catalog
index, built by `development/tools/pattern-catalog.ts` using Bun's built-in SQLite module. Canonical catalog JSON
flows one way into `.boxbox/cache/patterns.sqlite`; it cannot promote candidates or edit approval records. Targeted
tests cover cross-family queries, integrity, source preservation, repeatable rebuild and invalid-input rejection.
Corpus-wide and HUD-history indexing remain proposals; no runtime SQLite driver is selected.
SQLite documents local application storage and analysis as suitable uses, with one writer at a time per database file.
See [SQLite's usage guidance](https://www.sqlite.org/whentouse.html).

Before expanding SQLite to runtime or authoritative stores, benchmark representative JSONL scans against an isolated index, including startup, latency,
memory, archive size and Node/Bun/Windows/macOS/Linux installation. Record source hashes, index schema and completed
run IDs; prove deletion/rebuild preserves approvals. Add migration, rollback and interrupted-transaction tests.

For every additional SQLite store, explicitly enable and verify foreign-key enforcement per connection where used. Run both
`PRAGMA integrity_check` and `PRAGMA foreign_key_check`: integrity_check does not check foreign-key violations.
Neither validates BoxBox grammar or human approval. See [foreign-key documentation](https://www.sqlite.org/foreignkeys.html)
and [integrity_check](https://www.sqlite.org/pragma.html#pragma_integrity_check). The development pattern index executes both checks; migration to other stores remains proposed.

## Verification and limits

```bash
bun test --timeout 60000 test/conventions.test.ts test/examples.test.ts test/approval-gate.test.ts test/config-layers.test.ts test/harness.test.ts test/lifecycle-hook.test.ts test/shape-observation.test.ts
bun test --timeout 60000 test/surface.test.ts test/public-preset.test.ts
```

The [audit](reviews/2026-10-21-maintainer-docs.md) records actual results and probes. The pattern-index tests are a later bounded addition. No comparative SQLite benchmark, runtime migration,
concurrent-writer test or crash-recovery experiment was performed. Runtime record hardening has its own later
focused tests; historical audit results alone do not establish that closure.
