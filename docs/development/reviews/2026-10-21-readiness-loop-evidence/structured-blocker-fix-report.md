# R3 structured blocker correction

Date: 2026-10-21
Review source: `/tmp/boxbox-readiness/r2-r3-review.json`

## Before-fix trace status

No pre-fix adapter snapshot exists under `/tmp/boxbox-readiness/`, so the unsafe version could not be executed after the review. The failure was traced by the independent reviewer, not experimentally reproduced: `a: &x {k: 1}` and `a: !!map {k: 1}` passed through the old `pairByLine.set` overwrite path, which could propose `a  : 1}` and pass the old skeleton. Packaging work stopped immediately when the finding arrived. The exact inputs are now executable regression tests against the corrected adapter.

## Corrections

- Multiple AST pairs on one physical YAML line now mark that line ambiguous; no later pair overwrites the first candidate.
- YAML candidates require the AST key start to equal indentation width, exact AST/source key equality, whitespace-only colon gaps, and exact reconstruction of every original row byte.
- `preservesStructured` independently enforces horizontal-space/tab-only changes, identical leading/trailing whitespace and EOL bytes, whitespace-only before/after-colon gaps, and equal protected row skeletons. This applies to normal format as well as Align.
- YAML parsing visits Alias nodes and calls `Alias.resolve(document)` without materializing or expanding the document. Missing and forward alias targets fail syntax validation; valid and cyclic alias graphs remain valid and byte-identical.
- Structured pipeline reads raw buffers and requires an exact UTF-8 round trip before check or write. Invalid bytes remain unchanged in standalone and Align paths.

## Regression evidence

```text
bun test test/structured-align.test.ts test/structured-pipeline.test.ts
17 pass
0 fail
85 expect() calls
```

New cases cover anchored flow maps, tagged flow maps, multiline flow maps, unresolved aliases, valid existing aliases, cyclic aliases, non-whitespace gap mutation, invalid UTF-8 in normal format and Align, and byte-identical originals after every refusal. Repository formatting ran on the owned structured TypeScript files; the adapter reparse was successful. An error-filtered TypeScript check produced no diagnostics for the owned structured or pipeline files.

## Packaging state

Packaging edits made before the blocker notification remain unbuilt and unverified. No artifact builder was run. Work on packaging is paused pending parent review of this blocker correction.
