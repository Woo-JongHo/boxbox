# Corrected current `2b43` Codex native-hook evidence

Date: 2026-10-22
Corrected run evidence: `/tmp/boxbox-2b43-hooks-rerun/evidence/`
Private retained sources for independent closure: `/tmp/boxbox-2b43-hooks-rerun/raw-private/`
Prior report and independent INCOMPLETE review remain unchanged at `/tmp/boxbox-readiness/current-hook-acceptance-report.md` and `/tmp/boxbox-readiness/current-hook-independent-review.md`.

## Verdict

**The corrected two-call run closes the three stated evidence defects and is ready for independent review.** This report does not replace the independent verdict. The original run remains historically INCOMPLETE because its deleted raw sources cannot recover M2 or M3.

The corrected run used the same installed current candidate, workspace-write sandbox, hook-only trust bypass, exactly two model calls, and no approval or sandbox bypass. Calls completed in 14.143 and 11.630 seconds. The installed hook manifest and launcher hashes were reverified after the run and match the retained `2b43` binding.

## M1 — final sanitized inventory

`evidence-inventory.json` was generated only after the final sanitized evidence set existed. A separate verification recalculated all 14 listed byte counts and SHA-256 values with zero mismatches. The inventory deliberately excludes itself. `raw-source-binding.json` binds the sanitized derivation to retained private raw sources using logical names; it exposes no native IDs or receipt filenames.

## M2 — ordered second Stop and terminal bound

`ordered-native-events.json` retains ordinal, timestamp, native type/subtype and selected non-reasoning payloads. `receipt-chronology.json` retains receipt timestamps and states.

The failure chronology is directly ordered:

1. completed native file change at `16:26:18.575Z`;
2. PostToolUse FAIL receipt at `16:26:18.803Z` and developer delivery at `16:26:18.812Z`;
3. first Stop FAIL receipt at `16:26:22.426Z`;
4. exactly one HookPrompt at rollout ordinal 25 (`16:26:22.434Z`), completed at ordinal 26;
5. continuation final response at ordinal 28 (`16:26:24.653Z`);
6. second Stop FAIL receipt at `16:26:24.935Z`;
7. terminal `task_complete` at ordinal 31 (`16:26:24.944Z`).

There is no second HookPrompt between the continuation response and terminal event. Thus the second Stop occurred after the single continuation and was bounded without another continuation.

## M3 — one completed file-change identity, not fragments

`public-tool-lifecycle.json` derives from the native public JSON event stream. On each call it records exactly one private item identity, mapped to `file-change-1`, with one `item.started` and one `item.completed`. Failure has `distinctPrivateItemCount: 1` and `completedFileChangeCount: 1`; recovery has the same. `ordered-native-events.json` independently retains one completed custom tool call mapped to `tool-call-1` and one completed `FileChange` event per run.

No streamed patch fragment is counted as a call. The corrected evidence does not reproduce the original sanitizer's ambiguous fragment record. The failure call changed only the requested row; the recovery call made the exact inverse. `fixture-final.py` and `fixture-aligned.py` are byte-identical with SHA-256 `02bcd0267d69a76892826327e78e55c70f3fd6960b73ccd6cb7446c48927daf3`.

## Cleanup and hygiene

Temporary auth is absent, the exact owned receipt namespace and source rollouts are absent, the candidate config contains zero canonical disposable-project trust occurrences and remains mode 0600, no owned external process remains, and managed daemon stop returned `notRunning` with exit code 0. The private copied raw sources remain mode-contained in scratch solely for independent closure, as requested.

The final sanitized evidence contains zero UUIDs, reasoning markers, private-key markers, bearer values, JWT patterns and email addresses. Repository files were not modified.

## Limits

This corrected evidence concerns current-candidate macOS Codex native hook delivery and control flow only. It does not establish Claude, Windows, desktop, persistent trust, HUD host acceptance, publication readiness or release completion. Acceptance remains pending an independent read-only review of the corrected evidence and retained private raw sources.
