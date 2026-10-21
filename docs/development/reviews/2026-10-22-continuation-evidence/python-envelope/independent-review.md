# Independent source review — Python outer assignment projection

Date: 2026-10-22
Reviewer: Codex read-only review (not Sonnet; not a substitute for the planned final GLM review)
Scope: `product/engine/common/table-engine.ts`, `product/engine/python/assignment-envelope.ts`, `product/engine/python/profile.ts`, `test/python-assignment-envelope.test.ts`, `test/python-align.test.ts`

## Verdict

**One mandatory test-evidence finding.** I found no mandatory runtime correctness defect in the five-file implementation. The exact-native regression contract in the plan is not fully encoded in the source tests, so the frozen change should not be called fully covered until that test gap is corrected or explicitly accepted as an evidence-only limit.

## Mandatory finding

### M1 — The regression test does not execute the exact native fixture over the recorded 180-input domain

The plan requires reproducing the actual native fixture in a failing/regression test and says native behavior was preserved over 180 combinations. The retained native file is `def quote(...)`; its recorded domain is 5 unit prices × 3 quantities × 4 discounts × 3 shipping values = 180.

`test/python-assignment-envelope.test.ts` instead defines `def calculate(...)` and its behavior test uses 3 × 3 × 3 × 2 = 54 combinations. Its separate call-order fixture is useful but does not close this mismatch. The body shape is equivalent, and durable `native/independent-180.json` records the external 180-case result, but that durable record is not an executable regression test and will not catch a future engine change.

Reproduction/evidence:

- `docs/development/reviews/2026-10-22-continuation-evidence/native/quote.py` contains the exact `quote` fixture.
- `docs/development/reviews/2026-10-22-continuation-evidence/native/independent-180.json` records domains `[0,1,7,25,100] × [0,1,4] × [0,1,7,100] × [0,2,11]` and `cases: 180`.
- `test/python-assignment-envelope.test.ts` uses `calculate` and `[0,2.5,100] × [0,1,3] × [0,5,500] × [0,4]`, which prints `54`.

Required closure: make the focused test use the exact native source bytes or an exact inline equivalent named `quote`, and execute the recorded 180-case domain against original and aligned output. Retain the call-order test as an additional assertion.

## Runtime review results

- **Optional callback and purity:** `LineProfiler.project?` is optional; absence selects the prior `primary` path. The Python callback receives only `source`, allocates local state and returns a new map. No shared mutable profiler state was added.
- **Ownership and pairs:** primary runs meeting the effective floor reserve their row indexes; fallback tables claim rows before pairs are selected. Intersecting primary/fallback pairs are filtered, so selected runs have one owner. The focused tests cover adjacent detailed/projected tables and replacement of a detailed pair by one outer table.
- **Primary refusal:** reservation happens before the preservation gate. A later refused primary table is not offered to the projection. The focused injected-gap test exercises this and observes one refused primary table, no details and unchanged output.
- **Grammar bounds:** targets are simple ASCII names. The recursive RHS recognizer accepts numeric/name/property operands, arithmetic operators, parentheses and positional calls while rejecting unconsumed or unknown bytes. RHS is one opaque final slot and is never padded. Keyword arguments, strings, containers, indexing, comprehensions, conditional expressions, walrus, semicolons, unsupported targets and damaged delimiters have focused negatives.
- **Quote, mask and continuation interaction:** the scanner carries quote, bracket, explicit-continuation and uncertainty state across physical lines. Comment punctuation is excluded before assignment extraction; complete ordinary multiline strings are skipped; prefixed strings and mismatches conservatively disable later projections. This is intentionally over-conservative and fail-closed. Public syntax validation remains necessary because this detector is not a Python parser.
- **Approval isolation:** the emitted axes are `name>equal>assignment-value`. The test confirms that exact key is unknown while the old `name>equal>value` key remains approved. No preset file is changed in the reviewed diff.
- **Actual native bounded probe:** running `alignSource` on the retained `native/quote.py` produced one table with axes `name,equal,assignment-value` and only aligned the left assignment column. This confirms current behavior, but the probe is scratch evidence rather than the missing durable regression test.

## Commands and results

- `bun test test/python-assignment-envelope.test.ts test/python-align.test.ts --timeout 60000` — **33 pass, 0 fail, 185 assertions**.
- Bounded `bun -e` probe over retained `native/quote.py` — **groups 1, tables 1**, expected new axes and opaque RHS output.
- Diff inspection — no change to `product/rules/presets/recommended/conventions.jsonl`; old approval identity remains untouched.

## Scoped limits

This review did not run the repository-wide suite because the parent full check was already running. It did not review CLI, parser subprocess behavior, preset authoring, generated payloads or documentation outside the cited plan/fixture evidence. It is an independent Codex source review only and must not be represented as the unavailable Sonnet pass.
