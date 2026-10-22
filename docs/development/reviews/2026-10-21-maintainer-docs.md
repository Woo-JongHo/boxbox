# Maintainer documentation and consistency audit

Date: 2026-10-21. Source baseline: `07f568ccec77e70dd57da9aba63f8dc7ef7fcc5a`.
Scope: the user's request for detailed maintainable documentation, consistent inspection, storage/grammar checks and HUD status.
This change authors documentation and records evidence. It does not change the engine, approved rules, storage format or installed plugin.

## Deliverables

- [Maintainer index](../README.md): reading order and a common six-section documentation pattern.
- [Architecture](../architecture.md): responsibilities, interfaces and source ownership.
- [Inspection process](../inspection-process.md): current command semantics, ordered format stages, ten-language/parser matrix and proposed common lifecycle.
- [Storage](../storage.md): authority, schema and write guarantees for each store; validation gaps; bounded SQLite decision.
- [Change patterns](../change-patterns.md): repeatable recipes and proposed implementation order.
- [HUD](../hud.md): implemented on-request development panel and remaining surface/history work.

The design draft now points readers to current contracts. Its historical roadmap and examples are retained; they are
not treated as current command behavior. No grammar meaning or approved document section was rewritten.

## Findings and reproducible evidence

| Finding | Evidence | Interpretation |
| --- | --- | --- |
| Public check can return zero on invalid Python with no tables | [probe output](2026-10-21-maintainer-docs-evidence/process-syntax-probe.log), [script](2026-10-21-maintainer-docs-evidence/process-syntax-probe.ts) | Alignment check, `parse:not-run`; not syntactic validity |
| Runtime validators accept missing required fields | [probe output](2026-10-21-maintainer-docs-evidence/storage-probe.log), [script](2026-10-21-maintainer-docs-evidence/storage-probe.ts) | Validation/diagnostic gap; no approval bypass established |
| Common result suite omits Swift/Kotlin | [process inventory](2026-10-21-maintainer-docs-evidence/process-audit.md) | Their separate alignment tests exist; common contract enumeration incomplete |
| Storage guarantees vary by writer | [storage inventory](2026-10-21-maintainer-docs-evidence/storage-audit.md) | Source-review findings; concurrency/crash failures not experimentally reproduced |
| SQLite absent | Source/package inspection in the storage inventory | No migration or benchmark performed; JSONL remains authority |
| Installed HUD healthy, current receipt path unknown | [HUD output](2026-10-21-maintainer-docs-evidence/hud.json) | 0.2.2 enabled, runtime ready, two approved records; no per-file verification or native acceptance claim |

The preserved probe scripts reference this machine's source paths and use disposable inputs. To reproduce elsewhere,
update only the checkout import/root path in a scratch copy. They are audit artifacts, not a public CLI or new test suite.

## Verification performed

| Command scope | Result | Raw evidence |
| --- | --- | --- |
| Parser comparison/faults, line/TS write safety, format pipeline, result JSON, HUD (7 suites) | 59 pass, 1 skip, 0 fail; 196 assertions | [process tests](2026-10-21-maintainer-docs-evidence/process-tests.log) |
| Surface grammar and recommended preset (2 suites) | 23 pass, 0 fail; 168 assertions | [grammar tests](2026-10-21-maintainer-docs-evidence/grammar-tests.log) |
| Conventions, examples, approval, config, harness, lifecycle and shape (7 suites) | 61 pass, 0 fail | [storage tests](2026-10-21-maintainer-docs-evidence/storage-tests.log) |
| Surface and public-preset policy (2 suites) | 18 pass, 0 fail | [storage grammar tests](2026-10-21-maintainer-docs-evidence/storage-grammar-tests.log) |

Do not add these into a unique-test total: `surface.test.ts` appears in two runs. The skipped test is the real Rust
parse-comparison case; it is not a passing parser verification. No full suite, packaging, native host session,
SQLite benchmark or concurrent-write test was rerun for this documentation-only change.

## Implementation recommendation

First clarify/implement read-only syntax status and compatibility. Then complete shared runtime record validation,
cover all ten adapters' result contract, harden data writers according to actual concurrency needs, and measure
whether a derived SQLite index benefits corpus/HUD queries. Keep language-specific parsers and human approvals explicit.
These are proposed follow-ups; no runtime fix is claimed in this report.

## Independent review

[Sonnet 5.5 review](2026-10-21-maintainer-docs-evidence/sonnet.md) returned NEEDS_FIX with four small corrections.
The check script now links to the actual package manifest (which includes identity/layout), Go opt-in links to its
implementation, invalid-input reproduction is scoped to Python, and this section records the executed review.
The first packet omitted the package manifest and Go wrapper source; the final audit receives both, plus test logs.
Optional wording fixes distinguish report-mode lookup, implemented HUD scope and adoption of the new document pattern.
The [initial Opus 5.5 audit](2026-10-21-maintainer-docs-evidence/opus.md) closed all four Sonnet findings and requested
one wording correction: public format requires at least one candidate and approval for every `PASS`/`FIXABLE` group.
Both the interface and ordered-stage description now state this explicitly, with `SUGGEST` behavior distinguished.
[Scoped Opus 5.5 fix verification](2026-10-21-maintainer-docs-evidence/opus-fixes.md) returned PASS and confirmed the
corrected conditions against `approvedGroups`. This closes the documentation audit, not the proposed runtime fixes.
The independent CLI passes used no tools, no MCP servers and no write access; actual model IDs are preserved in the
raw JSON results. [Documentation checks](2026-10-21-maintainer-docs-evidence/documentation-check.json) cover relative
links, new prose language and placeholders; whitespace checks passed outside preserved raw evidence.
