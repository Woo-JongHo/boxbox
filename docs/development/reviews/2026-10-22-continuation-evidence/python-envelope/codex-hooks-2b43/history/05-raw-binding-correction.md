# Current `2b43` hook raw-binding correction

Date: 2026-10-22
Trigger: `/tmp/boxbox-readiness/current-hook-independent-closure.md`
Evidence: `/tmp/boxbox-2b43-hooks-rerun/evidence/`
Private raw: `/tmp/boxbox-2b43-hooks-rerun/raw-private/`

## Result

No model rerun was needed. All seven sources reported missing by the second independent review still existed as exact original files beneath `raw-private/fail-receipts/` and `raw-private/recovery-receipts/`. They had not been deleted or reconstructed.

The defect was a layout mismatch introduced during sanitization: `raw-source-binding.json` advertised privacy-safe logical names such as `fail.receipt-1.json`, while the retained originals remained only in per-run subdirectories under their native filenames. The binding did not include a path mapping, so the independent reviewer correctly treated the seven logical root paths as absent.

## Correction

Each retained original was checked against the already recorded byte count and SHA-256 before copying. All seven matched. Each was then copied byte-for-byte to its declared logical root path; the originals remain untouched. Every copied file was checked again against the pre-existing binding.

Current raw-binding audit:

- declared bindings: 16
- present at declared logical paths: 16
- byte/SHA-256 matches: 16
- missing: 0
- mismatched: 0
- restored from retained originals: 7
- reconstructed or synthesized receipts: 0
- new model calls: 0

`raw-layout-correction.json` records the cause, method and per-entry match result without native IDs. The sanitized evidence inventory was regenerated after adding that correction record and now contains 15 entries; independent recalculation found zero inventory mismatches.

## Evidence scope

The retained raw receipt files now allow an independent reviewer to verify the second Stop receipt timestamp and state against `receipt-chronology.json`, in addition to the already verified rollout ordering of one HookPrompt, one continuation response and terminal completion. This correction itself does not issue the independent PASS; the second review remains historical INCOMPLETE until a new read-only closure verifies the restored binding.

The original report, first independent review, corrected report and second independent review remain unchanged. Auth, trust, daemon, owned source rollout and process cleanup remain complete. Private raw evidence remains retained until independent closure. No repository file was modified.
