**Verdict: FINDINGS (low to medium).** I found no definite correctness or safety defect in the Python `-I` and NUL work or in the NEW04 read-only behavior. I found one probable false-`UNMEASURABLE` risk in the TypeScript collector and a test gap that hides it. This is static reasoning only. I ran nothing, and the author's logs are unverified by me.

## Findings

**1. Medium, unverified: a lone-row axis may force `UNMEASURABLE` on an already-aligned TypeScript group.** `typescript/06_align.ts:416-423`; the skip is at `:188`.
- `alignRows` does `if (entries.length < 2) continue;`. That axis gets no entry in `targets` and is not added to `skipped`.
- The collector then gives such a point `targetColumn: null` with the reason "axis has no horizontal planner target". Line 422 turns any null target into `missing`. Line 423 makes the group `UNMEASURABLE`, which exits 1.
- Counterexample, if `detect` emits optional boundaries: a 3-row table in which only one row has an optional slot (an initializer, a `?` marker or a type). Every other axis is already aligned. Actual 06 reports `edits=0` and treats it as clean. 04 reports `UNMEASURABLE`, exit 1, so the group can never be `MATCH`.
- I did not confirm that `detect` emits one-row boundaries. If it does, this breaks the requirement that optional slots are accounted for without being treated as failures. If `detect` does not emit them, the point is moot.
- A fix is to treat an axis with fewer than two entries as having no target needed, so it is not a refusal. If the author intends the stricter result, that should be documented.

**2. Low to medium: no test covers `MATCH` or the 04-specific edge cases.** `test/column-measurement.test.ts`.
- A grep for `"MATCH"` finds no test assertion on it for either language. I checked `column-measurement.test.ts` and grepped the snapshot for the 04 entry points.
- The tests cover `MISMATCH`, `UNMEASURABLE`, `NO_GROUPS`, `ERROR` and a CRLF/non-BMP Python case. Nothing covers these:
  - an already-aligned file exiting 0;
  - the optional-slot case from finding 1, where an aligned table with a one-row axis would turn up as `UNMEASURABLE`;
  - tab-indented rows, where Python uses `displayWidth`, planner `cellWidth` and `indexOf` on aligned text;
  - Hangul or Han text, where wide-character refusal should give `UNMEASURABLE` with a null target;
  - a TypeScript file with a skipped axis;
  - TypeScript source races (only Python has one);
  - Python rows with a trailing comment.
- Without a `MATCH` test, the exit-0 path for real aligned files is unproven in the suite. Only the 62-file self-use run bears on it, and zero emitted groups there is not proof.

**3. Low: pair collection in `measureTypeScriptGroups` re-runs `collect` with `minRows=2` on a fresh `seen` set** (`06_align.ts:426-436`).
- Actual 06 never runs with `minRows=2`.
- Side effects such as `seen.add(node)` for `object-properties` and `if-headers-return` differ at a lower minimum. A pair can be reported that actual 06 would not see as a pair.
- Pairs are always `UNMEASURABLE` and never `MATCH`, so the effect is limited to exit 1 noise or an extra group.
- I did not find a concrete mismatch. This is a divergence risk, not a defect.

**4. Info: TypeScript 04 accepts any `.[cm]?[jt]sx?` extension** (`typescript/04_measure-columns.ts:21`). `.mjs` and `.cjs` are accepted. The author says the public CLI rejects `.mjs`, so this is internal-only tooling. If the public path is truly separate, the language scope is unchanged. I did not trace `loadSourceFile` for `.js` and `.jsx` handling.

## Checks that passed (static reasoning)

- **Checklist 1, Python:**
  - Columns are consistent. `original` starts at the indent and adds each `gapBefore` and slot text. Every first slot has `gapBefore: ""` (`01_profile.ts` lines 153 and 248 and similar). The `lossless` formula ignores the first slot's gap, so there is no double counting. The target is `displayWidth(aligned.slice(0, at))`, found with a monotonic `indexOf` over a space-only gap, so there is no mis-location.
  - Pairs and wide-character refusals come out `UNMEASURABLE`. Preservation refusals use `details.includes(table)`.
  - The observer runs after `refuseUnsafeTables` with no mutation, and `apply:false` keeps the output equal to the source.
  - A `statSync` identity check plus a byte comparison runs after the read.
  - Exit codes follow the spec.
- **Checklist 1, TypeScript:**
  - The observer is `buildGroup`'s `observe` after `alignRows`, so it uses the real planner.
  - Conflict, overlap, vertical, skipped and preservation reasons match the order in actual 06.
  - Vertical rows get a null target, and `measureOnly` boundaries are `virtual` and non-editable.
  - The race check compares dev, ino, mtime, ctime and content.
- **Checklist 2:**
  - `-I` is on all three spawns: `parse-check.ts:45` and `:141`, and `shared_analysis.ts:49`.
  - NUL is normalized only where `'\x00' in source`. Escaping is right in both the raw template and the plain template.
  - The structure script normalizes each input separately. A `ValueError` from the other, non-NUL input still raises, giving a non-zero status and a thrown tool error.
  - The marker regexes are strict, as are the stderr, status and signal checks.
- **Checklist 3 (script only):**
  - Token and formatted intervals are validated and use original slices. There is no `unparse` or `exec`.
  - I did not re-audit the TypeScript coalesce and binary-search code in `shared_analysis.ts`. I read only the `-I` spawn at line 49 and the script.
  - The script still has no cap or timeout beyond the 60s spawn.
- **Checklist 4:** I did not read the fault-injection and portable-string-corruption tests in detail. I only read `column-measurement.test.ts`. BOM and lone-CR refusal is asserted at `test/column-measurement.test.ts:80-86`.

## Limits

- I did not read `shared_analysis.ts` beyond the spawn line, nor `parser-fault`, `line-write-safety`, `source-analysis` or `report` tests in detail. I relied on `closure.md` for the AST fix-delta behavior. I did not verify the performance, byte-identity or 3.9 results.
- I did not inspect `ROW_KINDS` or `detect` to confirm finding 1.
- I did not review self-use `summary.json`, artifact provenance, installer or native-host behavior.
- The final Opus audit and the full required-parser check are still pending.