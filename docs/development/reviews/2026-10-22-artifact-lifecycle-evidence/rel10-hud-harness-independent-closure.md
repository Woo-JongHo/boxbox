# REL10 HUD lifecycle harness — independent closure review

Date: 2026-10-22  
Initial review: `/tmp/boxbox-readiness/rel10-hud-harness-independent-review.md` (preserved)  
Scope: read-only; no HUD setup, installer, host, model, hook, trust, tmux, or UI command was executed.  
Verdict: **FAIL — M2, M3, and launcher mode are closed, but M1 retains one exact-scope allowlist defect.**

## Frozen inputs verified

- `development/tools/release-hud-lifecycle.mjs`: `6703d4e160186f64dbc68172fc0081f7b145a005462e6260e75248b068a80cd7`
- `test/release-hud-lifecycle.test.ts`: `2ed4c23cfca959ea97978a446ecf2b3cdd42ecfd0e6434f6f9c0c584a8ac001a`
- Both match `/tmp/boxbox-readiness/rel10-hud-harness-hashes.txt` and the author closure report.
- Focused test rerun: 8 pass, 0 fail, 35 assertions.
- Node syntax and `git diff --check` passed. Placeholder/skip/only scan was empty.
- Read-only binding against the actual successful macOS Codex core passed with a common stable HUD path. The failed macOS Claude core remains rejected at `ok:false`.

## Closure results

### M2 — closed

Reported residue roots and plugin roots must be nonsymlink directories. Setup, runtime metadata, runtime CLI, runtime Node, and the core report must be regular nonsymlink files before canonical containment/binding. Negative fixtures cover symlinked residue and setup paths.

### M3 — closed

Expected refusals require the pinned ownership-specific diagnostic in addition to exit 1 and unchanged inventory/bytes. The negative unit case proves an unrelated `SyntaxError` exit 1 is rejected.

### Launcher mode — closed

`assertExactOwned` now requires mode 0755, regular nonsymlink identity, and exact full bytes. The test covers wrong mode, edit, and symlink rejection.

### M1 — substantially implemented, but not closed

The non-following inventory correctly records file content/mode, directories, and symlink targets without traversal. It surrounds every setup invocation and harness mutation. Per-command scopes include host configuration, stable HUD data, Codex bin where applicable, and both installed HUD-script directories. Complete version roots are inventoried before the journey and compared at completion.

The full-version begin/end compromise is acceptable for this bounded harness: the exact pinned executable HUD script trees are checked at each transition, while the large immutable dependency/version trees are checked across the complete journey. The report should describe this distinction rather than claim complete version-root snapshots at every command.

However, `assertInventoryDelta` does not bind allowed mutations to a scope. Inventory keys are `${root}:${relativePath}`, but the check accepts either exact equality with a bare allowed name or any key ending in `:${path}` (`release-hud-lifecycle.mjs:59-63`). Calls pass values such as `settings.json`, `claude-statusline.json`, and `boxbox-codex`. Therefore, during a Claude setup command, an unexpected top-level `settings.json` created or modified under the shared HUD root or either version HUD-script root would be allowed. During a Codex command, an unexpected top-level `boxbox-codex` mutation in any tracked root would likewise be allowed. The current unit test uses only one scope and cannot detect this cross-scope collision.

This contradicts the claimed “precise allowlist” and leaves the foreign-preservation boundary porous.

Required closure:

1. Represent each allowed mutation by its exact inventory key (canonical scope root plus relative path), or use a structured `{ root, relativePath }` identity.
2. Make `assertInventoryDelta` compare exact identities only; remove suffix matching.
3. Add a test with two tracked scopes containing the same relative filename and prove that allowing the file in one scope still rejects mutation in the other.

## Boundary assessment

The verifier continues to separate configuration ownership/handoff from UI acceptance. It invokes only installed Node plus pinned setup scripts, and the report explicitly excludes host, model, hook, trust, tmux, and UI claims. The failed Claude core must remain ineligible; no relaxation is warranted.
