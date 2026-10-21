# Independent final closure — current `2b43` Codex native hooks

Date: 2026-10-22
Mode: read-only review. Private raw files were parsed only for structural and receipt metadata; no reasoning, credentials, native IDs or private content is reproduced or committed.

## Verdict

**PASS for bounded current-candidate macOS Codex native hook delivery and control flow.** The original run remains historically INCOMPLETE. The corrected two-call run and raw-layout correction close all three independent evidence findings without new model calls or reconstructed receipts.

This is not a release verdict. It does not establish Claude, Windows, desktop, persistent hook trust, HUD host acceptance, publication or release completion.

## M1 — sanitized evidence integrity

Closed. The final sanitized inventory contains 15 entries, matching the 15 evidence files excluding the inventory itself. Independent byte-count and SHA-256 recalculation found zero mismatches.

## M2 — bounded Stop continuation

Closed. Programmatic comparison of retained private raw receipts to `receipt-chronology.json` matched exactly for event, state, timestamp, checked/file counts and `automaticFixPerformed`:

1. completed file change;
2. PostToolUse FAIL receipt and developer delivery;
3. first Stop FAIL receipt;
4. exactly one HookPrompt;
5. one continuation final response;
6. second Stop FAIL receipt;
7. terminal `task_complete`.

The verified timestamps order the second continuation response before the second Stop receipt and the second Stop receipt before task completion. The rollout contains no second HookPrompt. Thus the second Stop was observed after one continuation and was bounded without another continuation.

All seven repaired logical raw paths match the pre-existing `raw-source-binding.json` sizes and SHA-256 values. Each logical copy also has exactly one byte-identical original under the retained per-run receipt directory. No receipt or baseline was reconstructed.

## M3 — native file-change count

Closed. Each private public stdout stream contains exactly one `item.started` and one `item.completed` for the same file-change identity, with one change and status `in_progress` → `completed`. Each private rollout independently contains one completed native patch tool call and one completed FileChange event. The corrected sanitized lifecycle records match these facts.

## Candidate, behavior and cleanup

- Archive SHA-256: `2b43d24eabfdde00ae8019b204aabd2cc8d04f1604a8ffd540ec3170606649f0`.
- Installed manifest and launcher hashes match the candidate binding.
- SessionStart developer context was delivered on both calls.
- Failure delivered PostToolUse FAIL as developer context and tool rejection, followed by the bounded Stop behavior above.
- Recovery applied the exact inverse patch, delivered PostToolUse PASS and produced no HookPrompt; its Stop PASS is retained in the verified raw receipt chronology.
- Initial and final fixture bytes are identical at SHA-256 `02bcd0267d69a76892826327e78e55c70f3fd6960b73ccd6cb7446c48927daf3`.
- Hook behavior did not auto-fix the file; all receipts have `automaticFixPerformed: false`.
- Temporary candidate auth and owned source rollouts/receipt namespace are absent; candidate config is mode 0600 with zero disposable-project trust occurrences; no scratch-root process remains; daemon stop reports not running.
- The committed sanitized subset contains no reasoning markers, native session/message/thread IDs, credential material, auth hashes, bearer/JWT/private-key data or email addresses.

## Evidence history

The durable set retains the initial author report, first independent INCOMPLETE review, corrected author report, second independent INCOMPLETE review, raw-layout correction report and this final closure. This preserves why the original evidence was insufficient and how each defect was closed.
