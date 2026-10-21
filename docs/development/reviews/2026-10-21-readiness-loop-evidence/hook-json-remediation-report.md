# Lifecycle hook JSON self-observation remediation

Date: 2026-10-21
Status: focused implementation verified; final integrated check/audit pending

## Failure

The integrated suite exposed `test/hud.test.ts:98`: expected `NO_CHANGES`, received `PASS`. JSON became a tracked source extension, so project-local `PLUGIN_DATA=plugin-data` caused SessionStart's own `baseline.json` and later receipt JSON to enter the project snapshot. PostToolUse then treated BoxBox-owned evidence as a user source change.

Durable initial failure: `docs/development/reviews/2026-10-21-readiness-loop-evidence/full-check-initial.log`.

## Fix

- `snapshot()` now accepts an optional explicit set of absolute directory paths to exclude and propagates it during recursion. Its default remains empty, so guarded-run and every existing caller retain prior behavior.
- Lifecycle hooks compute the exact namespace they own for the current project: `<plugin-data>/hooks/<project-hash>`. They exclude that namespace only when it resolves lexically inside the project root. The exclusion covers all BoxBox sessions for that project, avoiding session-to-session receipt feedback.
- The plugin-data root, other project hashes, ordinary JSON files and unrelated receipt-like folders remain visible.
- No JSON extension was globally ignored and no fixture/expectation was weakened.

## Focused evidence

`bun test test/lifecycle-hook.test.ts test/hud.test.ts` passed **9 tests, 57 assertions, 0 failures**. It proves:

- the real HUD writer scenario remains `NO_CHANGES`;
- project-local BoxBox baseline/receipt writes do not self-trigger;
- `plugin-data/user.json` is still checked;
- `plugin-data/hooks/unrelated-project/receipt.json` is still checked;
- existing failure/blocking, plugin-data location and error behavior remain intact.

`bunx tsc --noEmit` passed. `git diff --check` passed for the three owned files. BoxBox alignment was applied to those files, re-parsed successfully in two passes, and subsequent check-mode outputs were saved to:

- `/tmp/boxbox-readiness/hook-json-guarded-align.json`
- `/tmp/boxbox-readiness/hook-json-lifecycle-align.json`
- `/tmp/boxbox-readiness/hook-json-test-align.json`

The temporary alignment paths are supplementary only. Final integrated suite and independent final audit remain required before issue resolution.
