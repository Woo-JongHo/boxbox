# Independent review — current `2b43` Codex native-hook evidence

Date: 2026-10-22
Mode: read-only review of `/tmp/boxbox-2b43-hooks.cZ5Zei/evidence/`; the author report was not treated as proof.

## Verdict

**INCOMPLETE — two evidence-integrity findings and one event-count ambiguity block independent acceptance.** Candidate binding, hook registration/stability, final byte restoration and present cleanup state are independently supported. The selected event set supports SessionStart context, PostToolUse FAIL/tool rejection, one Stop continuation prompt, recovery PostToolUse PASS and no recovery hook prompt. It does not yet prove the requested bounded second-Stop behavior or exactly one failure-side native `apply_patch` call.

No evidence was copied into `docs/` because the retained inventory is internally inconsistent and the missing distinctions should be fixed at the scratch-evidence source first.

## Mandatory findings

### M1 — The evidence inventory does not bind the current selected native evidence

`evidence-inventory.json` records `native-selected.json` as 2,741 bytes with SHA-256 `87cacc8923b568076f8a3e19a6003dfae9aa5fa48b5d93c2eb57d66952b15ec7`. The file currently present is 2,132 bytes with SHA-256 `47381dd9517ce9d99c76791d50ce2cfad13986f321e0c102db86d4b536c1380f`. Every other listed file matched its inventory entry.

Required closure: regenerate the inventory from the final sanitized files, then independently compare every entry again. Preserve the old inventory separately only if it is explicitly labeled as pre-sanitization history.

### M2 — The retained evidence does not independently prove the bounded second Stop

The failure selection contains exactly one `hook_prompt` at ordinal 29. `receipt-summary.json` contains two Stop FAIL receipts, but it omits ordering/timestamps and cannot show that the second receipt occurred after the one continuation or that no second continuation was injected. `fail.final.txt` is the model's statement, not host control-flow evidence. The raw rollouts were removed, and no sanitized terminal/second-Stop event is retained.

Required closure: retain a sanitized ordered tail that includes the first Stop FAIL injection, the continuation/final response, the second Stop observation/marker and terminal end, with IDs, receipt paths and reasoning omitted. Alternatively provide a machine-generated ordered event summary bound by hash to the raw source before deletion.

### M3 — “Exactly one native apply_patch” is ambiguous in the selected failure events

The failure selection labels two entries as `kind: "apply_patch"`: ordinal 14 contains only `"\n*** End Patch"`, while ordinal 19 contains the intended complete patch. `verification.json` says `failApplyPatchCalls: 1`, but no retained field explains whether ordinal 14 is a streamed partial/abandoned call rather than a second native tool invocation. The final file state and PostToolUse receipt support one successful edit, but they do not resolve the event-count claim.

Required closure: classify selected entries by native item lifecycle/tool-call identity after removing the identity value itself, or retain a sanitized count derivation that distinguishes streamed fragments from executed tool calls.

## Independently supported facts

- Current archive SHA-256 is `2b43d24eabfdde00ae8019b204aabd2cc8d04f1604a8ffd540ec3170606649f0`.
- Installed hook manifest and launcher hashes match `candidate-binding.txt` (`150abf…4202`, `68644a…c47f`).
- Before/after hook lists are byte-identical and contain exactly enabled, untrusted SessionStart, PostToolUse and Stop handlers from installed 0.2.4 paths. No hook trust change is recorded.
- The selected failure events show SessionStart developer context, the intended complete patch, PostToolUse FAIL developer context and FAIL tool output, followed by one Stop FAIL user hook prompt.
- The recovery selection shows SessionStart developer context, the exact inverse patch, PostToolUse PASS developer context and zero hook prompts.
- `receipt-summary.json` reports FAIL summaries with one group/one misaligned row/one edit and PASS summaries with zero misalignment/edits; every entry records `automaticFixPerformed: false`.
- Current `sample.py` is byte-identical to `fixture-aligned.py`; SHA-256 is `02bcd0267d69a76892826327e78e55c70f3fd6960b73ccd6cb7446c48927daf3`.
- Direct present-state checks find candidate auth absent, config mode 0600, zero canonical disposable-project path/table occurrences, owned receipt namespace absent and no process referring to the hook scratch root. The managed daemon status record says not running.
- The remaining candidate rollout does not contain the current hook scratch-root or either controlled hook-test prompt; it belongs to prior retained candidate activity. The two current owned rollouts are absent.
- The sanitized evidence scan found no credential contents, auth hashes, bearer/token/JWT values, email address, reasoning text or session/message/thread IDs.

## Claim limits

This evidence does not establish Claude delivery, Windows behavior, desktop behavior, persistent hook trust, HUD host acceptance, publication readiness or release completion. It also cannot currently establish the second-Stop bound or exact failure-side tool-call count for the reasons above.
