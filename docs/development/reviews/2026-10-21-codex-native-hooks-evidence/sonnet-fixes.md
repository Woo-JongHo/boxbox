**PASS**

**Fix 1 (permission provenance):** Resolved. `edit-permission-provenance.json` ties the `turn_context` to edit thread `01a15cd4-2127-…` and turn `01a15cd4-217c-7bb1-b820-84e65129669d`, at physical line 8 and record ordinal 7. These checks hold on the pasted text:
- The turn id matches the `turn_id` on the `apply_patch` call and its rejection output in `edit.selected-rollout.jsonl`. That ties the read-only/never context to the turn that was actually rejected.
- The thread id matches `thread.started` in `edit.jsonl`, and `edit-permission-thread-link.json` records that association.
- The rollout SHA-256 and byte count (`2be70b1d…`, 82291) agree across the provenance file, the thread link, `native-case-proof.json` and `verification.json`.
- The ordinals are consistent. The `turn_context` at ordinal 7 (04:59:31.603) comes before the SessionStart developer message at ordinal 8 (04:59:32.125), and one-based line 8 corresponds to zero-based ordinal 7.
- The fields in `effective-permission-context.json` are identical to the provenance fields, so the formerly unlabeled file is now covered.

**Fix 2 (SessionStart wording):** Resolved. The report now says "delivered into the native response history", states that the model's self-report was wrong, and says in the final boundary that this is delivery only. `interpretation.json` corrects the right fields (`status` and `limitations[1]`, which is the "was accepted" line). It states that the original `verification.json` is unchanged and that delivery is not model acknowledgment. Leaving the original machine output unchanged is consistent with the recorded-evidence contract.

**Bounded report:** The Windows scope stays PARTIAL, and no Windows edit, FAIL, continuation or recovery pass is claimed. The macOS result is unaffected. The credential-field scan I flagged earlier as non-blocking now exists, with 0 matches.

I did not recompute any hashes or byte counts. I checked consistency across the pasted artifacts only, and I'm relying on your statement that the local hashes were recomputed.
