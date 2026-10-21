# TypeScript matrix proposal review

Date: 2026-10-22
Mode: read-only

## Verdict

**FIX_REQUIRED for one durable-evidence report defect. The proposed rule scopes, keys, minimums, examples, refusal evidence, approval boundary, and Issue 014 status are otherwise correct.**

## Finding

### [P1] Durable execution report still identifies the scratch copy as the complete evidence

Path: `docs/development/reviews/2026-10-22-continuation-evidence/ts-matrix-proposals-report.md:40`

The report says the complete machine-readable evidence is at `/tmp/boxbox-readiness/ts-matrix-proposals-evidence.json`. That path is ephemeral and will not exist for repository readers. The durable adjacent file exists at `docs/development/reviews/2026-10-22-continuation-evidence/ts-matrix-proposals-evidence.json`, is byte-identical to the current scratch copy (SHA-256 `8ee0e859...`), and is already linked correctly by the proposal and Issue 014. Replace the scratch-only evidence statement with a relative link to the adjacent durable JSON. The line describing the scratch harness may remain provenance, but it should not be the only claimed location of complete evidence.

## Rule-scope checks passed

- Return-guard key is exactly `v1|typescript|Block|return-guards|guard-return`; the detector owns one-line unbraced return guards and only the condition-close-to-return gap.
- Return-guard minimum is correctly 3 through the default aligner floor. The measured positive has rows 2/5/7; comment-separated pairs remain below the floor and unchanged.
- The documented barriers match `guardRegionBarrier` and gap/comment behavior. Ordinary non-barrier siblings bridge guards; nested blocks are collected independently.
- Member-call key is exactly `v1|typescript|SourceFile|declaration-call-envelope|equals>call-member-dot>call-envelope-open>call-envelope-close>semicolon`.
- Member-call minimum is correctly 2. `typescript-layout.json` sets declaration minimum 2 when every row has `equals`, and `withCallEnvelope` activates at two rows. The exact two-row `Array.from(items)` / `rows.filter(isVisible)` evidence produces the same five-axis key, so retaining the initial three-row proposal would be false.
- Supported and excluded call contexts match current code/tests: final property-access dot, nonempty direct calls, opaque arguments, adjacent SourceFile declarations; optional/computed/call-produced receivers, await/new/type arguments, boundary comments, trailing comma, close comment, zero-argument close-axis difference, direct nonmember dot-axis difference, and Block context are outside this exact key.
- All four before/after snippets match the durable JSON exactly. Positive outputs preserve tokens and reach a second-write fixed point. Counterexamples produce zero target-kind groups and remain byte-identical; the member counterexample may still report the distinct `declaration-equals` PASS group, which the prose does not misrepresent.

## Approval and issue checks passed

- Recommended preset remains exactly two conventions (one TypeScript and one Python); no source, preset, or test diff was introduced with these documents.
- Both public positive formats exit 2 with `FORMAT_NOT_ELIGIBLE`, report no matching convention, and preserve input bytes.
- Proposal and Issue 014 explicitly retain no rule approval and no example redistribution license. They do not infer family-wide approval from detector behavior.
- Issue 014 is correctly `open`: proposal preparation is done, independent review is in progress, approval/license decisions and installed workflow verification are pending.
- Issue index entry accurately describes detector-versus-preset coverage.

No source, preset, approval, or repository file was changed during this review.
