# Independent closure review — corrected `2b43` Codex native-hook evidence

Date: 2026-10-22
Mode: read-only. Private raw files were parsed only for structural, non-reasoning metadata; no reasoning, credentials, IDs or private content is reproduced here.

## Verdict

**INCOMPLETE — original M1 and M3 are closed, but M2 is not independently closed because seven sources declared by the raw binding are absent.** The corrected rollout metadata proves one HookPrompt followed by one continuation and terminal `task_complete`, and the public tool stream proves one started/completed file-change identity per run. However, the second Stop exists only in the sanitized receipt chronology. Its declared raw receipt source is missing, so the chronology cannot be independently rebound to retained raw evidence.

No files were copied into `docs/development/reviews/2026-10-22-continuation-evidence/python-envelope/codex-hooks-2b43/`. Publishing the evidence as PASS would overstate the retained proof.

## Closure status

### Original M1 — sanitized inventory mismatch

**Closed.** `evidence-inventory.json` has 14 entries and the evidence directory has exactly 14 files excluding the inventory itself. Independent byte-count and SHA-256 recalculation found zero mismatches.

### Original M2 — bounded second Stop

**Still open.** The corrected retained rollout structurally orders:

1. completed FileChange;
2. PostToolUse FAIL developer delivery;
3. first HookPrompt;
4. one continuation final answer;
5. terminal `task_complete`.

It contains exactly one HookPrompt and no second HookPrompt before task completion. Separately, `receipt-chronology.json` reports two Stop FAIL receipts, with the second between the continuation and task completion.

The required binding is incomplete: `raw-source-binding.json` declares three failure receipts, two recovery receipts and two baseline files, but all seven are absent from `/tmp/boxbox-2b43-hooks-rerun/raw-private/`. The surviving raw rollout does not itself contain the second Stop receipt event. Therefore an independent reviewer cannot verify that the sanitized second receipt timestamp/state came from the declared source.

Required closure: restore the seven exact files matching the already recorded sizes/hashes, or provide a retained raw container/digest plus a reproducible non-reasoning extractor that independently regenerates `receipt-chronology.json`. Then recalculate all raw bindings.

### Original M3 — exactly one native file-change call

**Closed.** Programmatic inspection of each private public stdout JSONL finds exactly one `item.started` and one `item.completed` for the same private file-change identity, status transitions `in_progress` → `completed`, and one change. The corrected private rollout has one completed custom tool call and one completed FileChange per invocation. This matches `public-tool-lifecycle.json` and removes the prior fragment ambiguity.

## Other independently verified facts

- Archive SHA-256: `2b43d24eabfdde00ae8019b204aabd2cc8d04f1604a8ffd540ec3170606649f0`.
- Installed manifest and launcher hashes match the corrected candidate binding.
- Failure rollout metadata shows SessionStart developer context, completed native patch, PostToolUse FAIL developer delivery, one HookPrompt/continuation and terminal completion.
- Recovery rollout metadata shows SessionStart context, one inverse file change, PostToolUse PASS, no HookPrompt and terminal completion.
- Final and initial fixture files are byte-identical at SHA-256 `02bcd0267d69a76892826327e78e55c70f3fd6960b73ccd6cb7446c48927daf3`.
- Direct present-state checks show temporary candidate auth absent, config mode 0600, zero current disposable project paths/tables and zero scratch-root processes. Daemon status is retained as not running.
- Sanitized evidence scan found no reasoning markers, session/message/thread IDs, authorization values, private-key blocks, auth file contents or email addresses.

## Raw binding audit

- Declared raw bindings: 16
- Present and matching: 9
- Missing: 7 (`fail.receipt-1..3`, `fail.baseline`, `recovery.receipt-1..2`, `recovery.baseline`)
- Present-file hash mismatches: 0

This review makes no future outcome, Claude, Windows, desktop, persistent-trust, HUD host-acceptance, publication or release claim.
