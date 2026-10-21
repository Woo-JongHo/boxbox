# Issue library

Search this library when investigating any problem in BoxBox: engine behavior, installation,
host integration, storage, automation, documentation or verification. Each JSON record preserves
the symptom, cause, decisions, work and evidence for one failure mechanism. The initial
records cover the current matrix-layout work and its validation; they are not an exhaustive reconstruction of
historical issues. Add other cases when their actual observations and evidence are available.

This is development history. Current component contracts remain authoritative; for example,
the [readability contract](../../../product/rules/references/readability-contract.md) owns
layout rules, and the approved-rule registry owns automatic-write authority.

## Browse by type

| Category | Meaning | Records |
| --- | --- | --- |
| `grouping` | Which rows share a region or scope | [001: return columns](records/BBX-20261021-001-return-column.json), [015: Python assignment envelope](records/BBX-20261022-015-python-assignment-envelope.json) |
| `syntax-boundary` | Which tokens define columns within those rows | [002: call parentheses](records/BBX-20261021-002-call-envelope.json), [004: member dot](records/BBX-20261021-004-member-dot.json), [010: YAML AST ownership](records/BBX-20261021-010-yaml-ownership.json) |
| `structural-layout` | Layout changes requiring an authored structural edit | [003: nested interface types](records/BBX-20261021-003-nested-type-layout.json) |
| `verification-gap` | A check or completion claim missed the requested property | [005: coverage versus PASS](records/BBX-20261021-005-coverage-vs-pass.json), [006: report row membership](records/BBX-20261021-006-report-row-membership.json), [014: detector versus preset coverage](records/BBX-20261022-014-preset-coverage.json) |
| `runtime` | Execution behavior, crashes, performance or resource handling | Available; no records yet |
| `installation` | Installation, updates, removal or platform setup | [008: internal import aliases](records/BBX-20261021-008-import-alias.json), [009: install ownership](records/BBX-20261021-009-install-ownership.json), [017: Claude marketplace transition](records/BBX-20261022-017-claude-marketplace-transition.json) |
| `host-integration` | Codex/Claude discovery, hooks, HUD or host contracts | [011: HUD evidence state](records/BBX-20261021-011-hud-evidence-state.json), [012: hook JSON self-observation](records/BBX-20261021-012-hook-json-self-observation.json), [013: HUD entry path alias](records/BBX-20261021-013-hud-entryguard-alias.json) |
| `storage` | SQLite, persistence, migrations or data integrity | Available; no records yet |
| `ci-release` | Issue/PR automation, builds, packaging or releases | [007: validation timeout](records/BBX-20261021-007-validation-timeout.json), [016: validation disk space](records/BBX-20261022-016-validation-disk-space.json), [018: evidence test auto-discovery](records/BBX-20261022-018-evidence-test-autodiscovery.json) |
| `documentation` | Missing, misleading or inconsistent instructions | Available; no records yet |

Records 001–003 capture implemented changes with pre-dot test evidence. Records 004–005
capture the subsequent dot-boundary and workflow correction, including 38 passing targeted
TypeScript tests. Record 006 tracks the report defect found in the initial Sonnet review.
Record 007 preserves an integrated-suite timeout and the unchanged targeted retry.
Records 001–006 are resolved within their documented support scope after the final 571-pass,
5-skip, zero-failure repository check and independent review. Record 007 is investigating again: the earlier unchanged retry and serialized suite passed, but a later macOS CI
run hit a 60-second child-process deadline. The underlying cause remains unconfirmed.
Record 008 is resolved after source migration, isolated copy/bundle checks and final GLM review. Records 010 and 012
are also resolved within their documented source scope after the post-native-fix integrated check and GLM closure.
HUD native acceptance remains separate in records 011 and 013.
Record 014 keeps the requested TypeScript boundaries and Python calculation envelope open at the public approval layer, despite their implemented detectors.
Record 015 resolves the bounded heterogeneous Python detector gap after source, local installed and native Windows verification; new public approval remains separate in record 014.
Record 016 is resolved after full validation and the bounded GLM transport completed; it preserves the local disk/stream failures separately from the unresolved CI timeout.
Record 017 is verifying the confirmed Claude transition repair: source/GLM, local and exact clean-CI `ebfe6a77…` six-core/four-HUD matrices passed independent review, including closure of a preserved raw-log evidence gap; PR source verification passed, while hosted macOS candidate smoke remains queued and the original product failures stay preserved.
Record 018 resolves a full-check failure caused by Bun discovering a historical `.test.ts` evidence snapshot; byte-identical `.txt` storage plus an original-name/hash map preserves the evidence without skipping or removing an active test.
Earlier snapshots and failures remain in history; no new public preset approval is implied.

## Find an earlier case

Run from the repository root. Search by the observed error, component, platform, command or
syntax token. Searches target factual records, excluding the template; no match means this
library has no matching record, not that the program has never had that problem.

```bash
# Search current syntax examples; replace these terms with the observed problem.
rg -n 'Array\.from|call-member-dot|guard-return' docs/development/issue-library/records

# List records in one category.
rg -l '"category": "syntax-boundary"' docs/development/issue-library/records

# Find work that still needs evidence, then read the containing record.
rg -n '"status": "(failed|pending|not-run|verifying)"' docs/development/issue-library/records

# Follow a known issue ID wherever it is referenced.
rg -n 'BBX-20261021-004' docs/development/issue-library
```

For an exact conjunction, use Bun already required by this repository:

```bash
bun -e 'for await (const p of new Bun.Glob("docs/development/issue-library/records/*.json").scan(".")) { const r = await Bun.file(p).json(); if (r.category === "syntax-boundary" && r.status !== "resolved") console.log(r.id, r.title, p); }'
```

## Add or update a record

1. Search by symptom and affected component first. Extend an existing record when the cause
   is the same; create a related record for a distinct failure mechanism.
2. Copy [the template](templates/issue.json) into `records/`. Replace its instructional
   values, assign the next unused `BBX-YYYYMMDD-NNN` ID for the report date and use that ID
   in the filename. IDs remain stable when titles, categories or diagnoses change.
3. Record the observed example and requested outcome before the proposed solution. Label
   an untested cause `hypothesis`. State actions and check scopes precisely enough to tell
   whether the original example is covered.
4. Add repository-root-relative code, test, contract and evidence paths. Record raw output
   under a review evidence directory or this library's `evidence/`; temporary paths alone
   are not durable evidence. Link the corresponding review rather than copying current
   rules into every issue.
5. Append a numbered `history` event after a decision, diagnosis correction, implementation,
   verification or reopening. Keep earlier causes and results in history when updating the
   current `rootCause`, `actions`, `verification` and `status` summary. A corrected diagnosis
   explains what changed; it does not erase the first interpretation.
6. Run `python3 docs/development/issue-library/validate.py`. This dependency-free checker
   supports the keywords currently used in [issue.schema.json](issue.schema.json), rejects
   unknown schema keywords and checks IDs, repository references, history sequencing and
   resolved-state evidence. It is not a complete JSON Schema 2020-12 validator; use a full
   validator if the schema grows beyond its documented subset. Keep the README index current
   when adding a record or category.

The template is deliberately instructional and is not a factual record or a valid instance
until its ID, date and other values are filled. Only `records/*.json` is the record set.

[validate.py](validate.py) prints its result as JSON and exits nonzero on invalid input. It
does not modify records or evidence. To inspect a draft outside the library, pass its path:
`python3 docs/development/issue-library/validate.py /tmp/BBX-20261021-007-draft.json`.
Default validation checks all records, unique IDs and the index; explicit paths validate the
selected records against the same schema and repository references.
Draft IDs are checked against the canonical record set as well; an existing canonical file
can be validated explicitly, but a different file cannot claim its ID. Template field and
enum agreement is checked while allowing its instructional ID/date placeholders.

## States and evidence

- Issue `status` is the current lifecycle: `open`, `investigating`, `implementing`,
  `verifying`, `resolved` or `deferred`. `resolved` requires evidence for the requested
  outcome, including its known support limits and required independent review. `deferred`
  records the reason and remaining work.
- Action `status` tracks work: `pending`, `in-progress` or `done`. A completed edit does not
  imply that its verification passed.
- Verification `status` distinguishes an observed `passed` or `failed` result from a planned
  `pending` check and a `not-run` check explicitly outside the evidence. Every passed or
  failed result names durable evidence and the exact scope. Skipped parser checks count as
  skips, not passes. Evidence from an older engine version does not verify new boundaries.
- Current `verification` entries summarize the latest check for each scope. When replacing
  a failed result with its successful rerun, retain the earlier result in `history` using
  `event: "verification-failed"` and `status: "failed"`, with its evidence. History may also
  carry `passed`, `pending` or `not-run` status. Record diagnosis evidence under `diagnosed`;
  establishing why a defect exists is not a passing verification of its fix.
- `related[].path`, `verification[].evidence[]` and `history[].evidence[]` use repository-root-
  relative paths. A `related` note explains why the reader should open the target.

These records convey no approval for reusable preset rules. Local user authorization,
detector coverage, syntax/type checks and public write eligibility remain separate facts.

## Evidence provenance

[pre-dot-check.txt](evidence/pre-dot-check.txt) preserves the repository suite's result tail,
source-log location and SHA-256 before the member-dot follow-up. It is an excerpt, not the
full log or a replay of the current source. [example-layout-report.md](evidence/example-layout-report.md)
is the verbatim worker report from `/tmp/boxbox-matrix-example/report.md`; references to
files in its directory refer to that original scratch directory. It preserves the reported
scoped checks and their limitations, not an independently rerun audit.

[dot-red.log](evidence/dot-red.log) and [dot-targeted.log](evidence/dot-targeted.log) preserve
the reproduction failure and the subsequent targeted test output.
[initial-sonnet-review.md](evidence/initial-sonnet-review.md) retains the initial read-only
review result and its advisory findings; its PASS applies to the reviewed source before
the dot/report follow-up. [structure-validation.json](evidence/structure-validation.json)
records the library's own validation method and scope.

[sonnet-dot-blocked.md](evidence/sonnet-dot-blocked.md) preserves the later blocked review.
[check-before-audit-corrections.log](evidence/check-before-audit-corrections.log) is a snapshot
of the then-running integrated log containing the missing-axis-note failure; it is not a
completed suite result. The resulting fixes and their eventual verification remain separate
history entries. [validator-rejection.json](evidence/validator-rejection.json) records the
checker rejecting an external draft that claimed resolution with unfinished actions.

[validator-review-cases.json](evidence/validator-review-cases.json) records draft ID collision,
premature-resolution and canonical-path probes. The temporary drafts are not retained; their
mutations and observed outcomes are described in that artifact.
[records-before-final-closure.json](evidence/records-before-final-closure.json) preserves the
earlier current-verification lists before final evidence replaced them. See the
[matrix review](../reviews/2026-10-21-matrix-columns.md) for the final integrated evidence.
[final-validation.json](evidence/final-validation.json) records the closed record-set check;
[validator-final-negative-cases.json](evidence/validator-final-negative-cases.json) records rejection
of a failed result mislabeled as verified and a canonical record missing its ID, without a traceback.
