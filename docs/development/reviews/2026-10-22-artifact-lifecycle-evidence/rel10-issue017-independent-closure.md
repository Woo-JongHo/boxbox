# Independent closure — issue 017 durable evidence references

Date: 2026-10-22  
Mode: read-only; no repository or evidence mutation

## Verdict

**PASS — the sole mandatory finding from the initial independent review is closed.**

The initial review at `/tmp/boxbox-readiness/rel10-issue017-independent-review.md` remains unchanged and records the original `CHANGES REQUIRED` result. This closure assesses only its M1 durable-reference correction.

## M1 closure

The evidence index now contains a `Durable path map` section and a machine-readable `durable-path-map.json`. Together they define the default mapping from retained `/tmp/boxbox-readiness/<path>` references to the repository evidence directory while preserving the original recorded reviews byte-for-byte.

The mapping is complete for the bounded exception cases:

- the renamed clean-CI candidate metadata maps to `ci-candidate-39646320662-1/candidate.json`, which exists;
- the unpublished archive is explicitly marked uncommitted rather than falsely mapped to a local file;
- both `.txt`-renamed HUD verifier snapshots map to existing retained files.

The README directly links the clean candidate, the 854-file raw manifest, the original INCOMPLETE review, its independent closure, the macOS review, and all four WSL/native-Windows core lifecycle reports with their adjacent command logs. Every one of the section's 10 repository-relative links exists.

Issue 017 now directly cites the durable candidate metadata, raw digest manifest, path map, and evidence README in the clean-CI verification, history sequence 10, and related records. The record still preserves the original failure and INCOMPLETE-to-closure chronology, keeps the hosted macOS candidate smoke pending, and remains `verifying`; it does not claim workflow-level or issue-level completion.

## Validation

- `python3 docs/development/issue-library/validate.py`: PASS — 18 records, 2,458 checked values, 422 existing reference occurrences.
- Machine-readable exception target check: all three non-null stored paths exist; the archive's null mapping has an explicit reason.
- Durable README link check: 10/10 local links exist.
- Prior raw-manifest verification remains applicable: 854/854 retained files passed the repository-local SHA-256 manifest check recorded in the initial review.
- Repository status was inspected before review; this pass made no repository changes.

## Mandatory findings

None.
