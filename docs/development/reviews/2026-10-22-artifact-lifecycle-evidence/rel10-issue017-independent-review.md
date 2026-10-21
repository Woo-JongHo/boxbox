# Independent review — issue 017 final record and index

Date: 2026-10-22
Mode: read-only; no repository or evidence mutation

## Verdict

**CHANGES REQUIRED — one bounded durable-evidence reference finding.**

The issue lifecycle, status enums, chronology, current verifying state, and README summary are otherwise accurate. The issue must not be resolved while hosted macOS candidate smoke remains queued.

## Mandatory finding

### M1 — final clean-CI raw proof is present in the repository but the issue's closure chain still points readers to temporary paths

Issue 017's “Clean CI candidate native lifecycle matrix” verification and history sequences 9–10 cite the durable review and closure Markdown files. Those files were copied byte-for-byte from scratch and still name only temporary sources at decisive points:

- rel10-final-ci-native-independent-closure.md:10 links the preserved INCOMPLETE review through /tmp;
- rel10-final-ci-native-independent-closure.md:16 identifies the verified 854-entry manifest only through /tmp;
- rel10-ci-macos-independent-review.md:14 identifies candidate metadata only through /tmp;
- the preserved INCOMPLETE review's reviewed-files list likewise names only scratch paths.

The repository actually contains the corresponding durable raw manifest, per-cell logs, candidate metadata, preserved INCOMPLETE review, and closure under docs/development/reviews/2026-10-22-artifact-lifecycle-evidence/.

I verified the durable 854-entry manifest from its repository directory; every entry passed. Therefore this is a documentation/provenance-link defect, not missing evidence or a lifecycle failure.

Required bounded correction: add repository-relative durable paths to the final closure (or a small adjacent durable path map without rewriting the preserved original report), and add direct issue 017 evidence/related references to the raw manifest and clean candidate metadata. Preserve the scratch paths as execution history if desired, but do not leave them as the only route to the proof. Re-run the issue validator afterward.

## Checks that passed

### Record structure and enums

- The focused issue validator passed: 267 checked values and 61 existing reference occurrences.
- Top-level status verifying is consistent with four done actions plus one in-progress hosted macOS smoke action.
- Verification states are coherent: original reproduction failed, completed source/native scopes passed, hosted macOS smoke pending with no fabricated evidence.
- History sequences are contiguous 1–10. Sequence 9 explicitly describes an evidence-review gap rather than a product lifecycle failure, and sequence 10 closes it without erasing the original INCOMPLETE report.

### Chronology and scope

The history correctly preserves this order:

1. original macOS mismatch failure;
2. independent WSL reproduction and diagnosis;
3. one scoped update probe, expressly not promoted to lifecycle PASS;
4. repair decision and initial open review gates;
5. source/GLM closure;
6. first local fixed macOS acceptance;
7. complete dirty-source 1f1343e9… six-core/four-HUD matrix;
8. clean-CI ebfe6a77… macOS core/HUD acceptance;
9. remote review held INCOMPLETE for missing raw logs;
10. hash-bound raw-log closure plus PR source verification.

The local 1f1343e9… and clean-CI ebfe6a77… identities remain separate. HUD claims stay limited to configuration ownership. UI/hooks/authentication, Windows HUD, publication, and workflow completion are not inferred.

### Current state and README

- The final action and verification correctly retain hosted macOS candidate engine smoke as queued/pending.
- Clean source PR verification is recorded separately as passed and is not substituted for candidate smoke.
- Top-level verifying is therefore correct; resolved would be premature.
- README category links include issue 017 under installation, and its summary accurately preserves original failures, the raw-log gap/closure, exact clean-CI matrix, PR pass, and queued hosted macOS smoke.
- All 61 repository-root-relative references in the JSON exist; no temporary path occurs directly in the JSON record.

## Validation performed

- Focused issue-library validator: PASS.
- Programmatic reference existence scan: 61 occurrences, 29 unique paths, zero missing, zero direct temporary paths.
- Durable raw manifest check from the repository evidence directory: 854/854 files PASS.
- Read-only comparison of the original INCOMPLETE review, terminal closure, macOS review, issue history, and README index summary.
