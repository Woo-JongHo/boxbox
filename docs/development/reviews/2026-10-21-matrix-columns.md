# Matrix columns: guard returns, outer calls and exceptional type members

The user's correction is about shared syntax columns. The preceding
[paragraph-only correction](2026-10-21-self-use-boundaries.md) did not implement that request.
This change extends the TypeScript detector and applies its verified proposals to the actual source examples.

## Rules and implementation

- `return-guards` aligns the start of `return` in at least three supported one-line `if (...) return ...`
  statements in one immediate block. Ordinary statements, loops and blank lines may intervene. Nested blocks
  calculate their own widths. Comments between statements, unsupported guards/else, unconditional exits and
  function/class declarations terminate a region. No statement changes position.
- `declaration-call-envelope` aligns outer parentheses of consecutive call-valued declarations from two rows,
  including different callee names/arities and one trailing non-null assertion. The argument list is opaque.
  Empty calls retain `()`. Optional/computed/call-produced callees, generic calls, await/new wrappers and comments
  on edited boundaries are excluded. Compatible legacy direct calls retain their old inner axes and lookup key.
- The subsequent user correction adds `call-member-dot`: the final separator between a receiver and its called method
  is a distinct column. The missing implementation treated the entire callee as opaque. The skill also lacked an
  explicit comparison between requested boundaries and returned checker axes, so a passing check could hide this gap.
  Its authoring workflow now inventories boundaries first and reconciles every requested axis after checking.
- `Example.asserts` and `Example.source` move below the ordinary interface members and expand into independent
  nested tables. Names, types, readonly/optional modifiers and emitted JavaScript are unchanged. This is a local
  agent-authored type-layout refactor; the deterministic aligner does not move members or runtime statements.

The guide/reference contract now distinguishes a shared column region from a contiguous paragraph. Runtime
evaluation order takes precedence over moving a visually exceptional row downward.

## Actual self-use

`subjectCall`, `subscriptPartsOf` and `callLayer` now align sibling guard returns, including across their
intervening preparation and loops. `authoring-guide.ts` uses the requested outer call columns:

```ts
const decision = registry.decisions.get(convention.id                 )! ;
const document = resolveDocument       (decision.ref, convention.layer)  ;
```

The engine proposed 52 horizontal edits across 17 new-kind groups in `grid-kinds.ts`. Combined token preservation,
non-overlap and fresh syntax diagnostics were checked before applying the patch. Three stale padding gaps in
`subscriptPartsOf` were removed as part of the same user example. New-kind findings in already touched
`examples.ts`, `report.ts` and its test were also applied after token/syntax verification.

## Authority and limits

The user's direct request authorizes these local edits. No preset convention, approval decision or example was
invented. The two new kinds have distinct lookup keys. Installed public `align` still refuses their unapproved
findings and leaves source bytes unchanged. Check support and public automatic-write approval are separate.

This is TypeScript support for the specified shapes. It does not establish universal column coverage, a new
Python implementation, automatic type-member relocation or a general function-numbering system. The two-field
`asserts` block is below the ordinary type-member three-row floor; its layout was inspected manually.

## Verification

Recorded evidence is in [the evidence directory](2026-10-21-matrix-columns-evidence/).

- The pre-dot baseline passed 565 tests with five existing missing-parser skips. The new dot case first failed,
  then both targeted TypeScript suites passed 38 tests. Metadata/report regressions passed 44 tests.
- Independent Sonnet review exposed the report-span issue: intervening preparation lines were counted as table
  rows. Optional `rowLines` now supplies exact guard membership through normal/refused JSON output and report
  calculations. Ordinary groups retain the existing span fallback and schema version.
- Sonnet and GLM then blocked the dot change because its axis note was missing. The whole-suite contract check
  independently reproduced that failure. The note was added; eight plugin-contract tests and the Sonnet closure
  review passed. The skill also reconciles axes after final Align and scopes issue-history writes to authorization.
- GLM's final immutable-snapshot audit passed for dot safety, metadata, legacy-key compatibility and the skill
  workflow. Its carried-forward note about missing contract-table rows is stale: both rows are now present in
  `readability-contract.md`. Reviewers performed static review, not test execution.
- Fresh isolated Codex and Claude installations recognize the member-dot axis and exact guard rows. Both preserve
  the existing approved TypeScript/Python write journeys and refuse new unapproved kinds without changing source.
  Native plugin registration was verified; live user profiles were not replaced and native model sessions were not run.
- A later full run hit the existing 20-second child deadline in the vertical-candidate integration test. The unchanged
  targeted rerun passed all 35 tests in 3.32 seconds. Concurrent packaging was present; its causal role is unconfirmed.
  The final whole-suite rerun is recorded separately; the failed attempt is retained.

The [issue library](../issue-library/README.md) indexes the causes, decisions, failures and later verification by type.

Final result: `bun run check` exited 0 with **571 pass, 5 existing parser skips, 0 fail and 2799 assertions**.
Type checking and installer shell syntax passed. Current-source Check reports zero misalignments in the eight
changed TypeScript files and the library's Python validator (three Python pairs remain advisory). Plugin guard
passed. The final source rebuild produced the same tested installer SHA-256:
`32eeff70322ab9ae0fccf669904ff4346a972c37f3a3eaa26bc8e391dccd486c`.

The library's independent Sonnet review passed after machine-readable failed history, diagnosis separation and
canonical/draft ID collision checks were corrected. Records 001–006 are resolved; timeout incident 007 remains
deferred with its causal hypothesis explicit. The library checker implements the documented JSON Schema subset,
not a full Draft 2020-12 implementation. Live installed plugin profiles were not updated.
