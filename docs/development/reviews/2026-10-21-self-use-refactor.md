# BoxBox self-use: authoring guidance refactor

Follow-up: the user directly requested the missing import/property alignment. The
[boundary correction](2026-10-21-self-use-boundaries.md) resolves the three recorded alignment
findings and adds guard paragraphs in two grid-kind helpers. The original evidence below is
retained as the first-pass result; it is not the current source status.

Scope: the user requested using BoxBox on its own code and a reading guide. Only
`product/engine/common/authoring-guide.ts` was edited in this pass; earlier uncommitted
work remains intact. This is a Refactor workflow under AUTHOR1, not a new preset approval.

## Product workflow and change

The installed 0.2.4 candidate launcher ran `guide --authoring`, pre-edit `check`, post-edit
`check`, and `align --dry-run` against the real repository file. The agent edited the file;
the CLI did not generate the refactor. No `boxbox run` wrapper receipt is claimed.

- Name the existing filter/map result `scopedKeys`, then deduplicate and sort it.
- Wrap the function signature, selection predicates and approval-document guard.
- Give counterexample and returned rule properties separate physical lines.
- Preserve evaluation order, output property order, approval checks and the public function signature.

With tabs expanded to four columns, the maximum line width changed from 153 to 111;
lines over 120 changed from seven to zero. Physical lines increased from 37 to 62.
This trades vertical space for visible inputs, conditions and returned fields. It adds
no helper function or collection pass. No workload performance benchmark was run.

## Readability findings remain open

Before: two detected groups, zero misaligned. After: four detected groups, three
misaligned (ten proposed line edits). The remaining groups are the local decision/document
declarations and two object-property groups. The installed hook reported `FAIL` after
the edit; the explicit Check report agrees. These findings are not treated as a pass.

The public preset approves only source-file call declarations for TypeScript, not these
Block declarations or ObjectLiteral registrations. `align --dry-run` returned
`ALIGN_NOT_ELIGIBLE` (exit 2); the source SHA-256 stayed unchanged. No raw writer,
manual column padding or fabricated approval receipt was used to bypass this boundary.
The existing approved examples were guidance, not authorization for additional patterns.

This self-use exposes a product gap: the detector recognizes more groups than the public
preset permits fixing. A future rule proposal needs concrete positive/counterexamples
and human approval; this pass does not grant it. Functional checks and layout approval
are separate results. Check also reports parsing as `not-run`; syntax/type evidence
comes from the separate repository checks.

## Verification

- Baseline authoring-mode tests: 7 pass, 0 fail, 113 assertions.
- Post-edit authoring-mode and approval-gate tests: 19 pass, 0 fail, 149 assertions.
- `bun run check`: exit 0; 554 pass, 5 existing parser-dependent skips, 0 fail; 2661 assertions.
  Identity/layout checks, TypeScript checking and installer shell syntax also completed.
  This command does not clear the separately recorded BoxBox alignment findings.
- Independent Sonnet review: PASS for behavioral preservation. Its first attempt was blocked by
  the read-only workspace boundary for the `/tmp` baseline; the retry received the exact baseline
  in the prompt and read the current product file. Both reports are preserved.
- Independent GLM 5.3 audit: passed for the scoped refactor. Read-only tools, no test-execution
  claim. The user selected GLM instead of Opus. Neither review clears the three layout findings.
- Completion recheck of the eight files tracked by the session hook: seven have zero detected
  misalignments; this file retains three. Full reports are in `session-checks.json`.
- No TODO/FIXME placeholders or skipped/only tests were added to the changed product file.

## Reading order

1. `product/engine/common/authoring-guide.ts`: scope selection, approval, counterexamples, result.
2. `product/engine/common/approval-gate.ts`, `evaluateApproval`: why examples alone cannot authorize a write.
3. `product/engine/typescript/grid-kinds.ts`, `RowBoundary` and `RowKind`: rows and syntax-defined axes.
4. `product/engine/common/format-pipeline.ts`, `runFormatPipeline`: temporary copy, preservation, fixed point and commit.
5. `test/authoring-modes.test.ts`: observable mode behavior and rejection cases.

Evidence: [self-use artifacts](2026-10-21-self-use-refactor-evidence/).
The before/after snapshots use `.txt` extensions so historical source is not rechecked as live code.
