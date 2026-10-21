**BLOCKED**, on one defect cluster: failed attempts are recorded under a "verified" label. Everything else I found is minor. I read the files and ran nothing, including `validate.py`.

## Blocking defects

1. **Failed attempts are labeled as successes and can't be found by status.**
   - 004 history #6 and 005 history #5 are `event: "verified"` with a summary starting "FAILED ATTEMPT:". The schema has no failure event, so the only signal is that text prefix.
   - Neither record has a `verification[]` entry with `status: "failed"`. The README search for non-passing work covers `pending|not-run|verifying` but not `failed`. Searching `"status": "failed"` over `records/` finds nothing, even though `sonnet-dot-blocked.md` and `check-before-audit-corrections.log` document a blocked review and a failing `plugin-contract` test.
   - Fix:
     - Add a `failed` verification entry to 004 pointing at those two evidence files.
     - Reclassify those history events (for example `reopened`, or add a `failed` event to the schema and template).
     - Add `failed` to the README search recipe.

2. **`passed` is used for checks that passed only in the sense of confirming a defect.**
   - 005 "Historical coverage gap" and 006 "Independent initial diagnosis" are `passed`. The first confirms the defect existed. The second is a review that found a defect.
   - A reader filtering on `passed` will take these as fix evidence. The result text disclaims this, but the status doesn't.
   - Fix: reword them as diagnosis evidence, or define in the README that `passed` can mean "the check ran and produced its expected observation".

3. **The validator can't catch an ID collision in draft mode.**
   - README step 2 says to assign "the next unused" ID. In explicit-path mode, `validate.py` only checks duplicates among the paths given (`validate.py:116-124`).
   - A draft in `/tmp` with an ID or filename that already exists in `records/` passes.
   - Fix: in explicit mode, also load the IDs in `records/` and reject a different file with the same ID.

## Non-blocking defects

- **Stale or duplicated wording.**
  - 004 `related` says the regression tests "are being extended", but its action is `done`.
  - 005 history #6 repeats 004 history #7 word for word, including "Added the axis note", and cites `grid-kinds.ts`, which is 004's change.
- **No drift guard between template and schema.**
  - Today they agree: all 14 required keys are present, the enum values are valid, and `$schema` matches.
  - Nothing enforces that. `validate.py` never touches `templates/issue.json`. A cheap check would compare the template's key set to the schema's `required` and check its enum values.
- **The README index is only weakly checked.** The validator checks that each ID string appears somewhere in the README, plus link targets. It doesn't check that a record is listed under its own category, or that the README categories match the schema enum.
- **Advisory findings from the initial review aren't tracked.** Only finding #1 became a record (006). The others (#2 stricter public format refusal, #3 zero-argument runs renamed, #4 two-row allowance widened, #5 trailing comments splitting regions, #6 contract table omissions) have no record or note saying they're unresolved. The README says the review "retains" them, but a search of `records/` won't find them.

## What I checked and found correct

- **Unsupported schema keywords fail visibly.** `validate_schema` recurses through `properties` and `items` and raises on any keyword outside the whitelist. That covers `$ref`, `oneOf`, `format`, a `type` list and an `additionalProperties` schema.
- **Reference paths.** The repository-relative paths I spot-checked exist: `product/*`, `test/typescript-matrix-boundaries.test.ts` and the three reviews.
- **Evidence figures match the logs.**
  - 565 pass, 5 skip, 0 fail.
  - 38 pass with 175 assertions.
  - 44 pass with 187 assertions.
  - 22 tests, 168 to 71 columns.
  - `structure-validation.json` says 65 references. I counted 65 by hand across the six records.
- **History order and wording.** The sequence numbering is contiguous. Records 001–003 say the pre-dot snapshot doesn't cover later edits, and 004–006 say the same of their targeted runs. The `verifying` statuses and pending "Final integrated review" entries are consistent with the README.
- **`check-before-audit-corrections.log`** does end mid-run, at `test/public-artifact.test.ts`, as the README says.

## Limitations to note

- The evidence is partly self-reported:
  - Record 003 rests on a narrative worker report whose underlying artifacts stayed in `/tmp`.
  - The `/tmp` source logs, and the SHA-256 in `pre-dot-check.txt`, can't be re-checked.
  - `validator-rejection.json` and the two Sonnet reviews are also copies of scratch output.
- The validator checks sequence numbers 1..n but not append-only edits, date order, or whether `status` matches the latest history event. The "independent review" requirement for `resolved` is policy only, and `resolved` doesn't require a confirmed root cause.
- Some malformed schemas (a non-dict `properties`, a bad `pattern`) would end in a traceback rather than a clean message. They still exit nonzero.
