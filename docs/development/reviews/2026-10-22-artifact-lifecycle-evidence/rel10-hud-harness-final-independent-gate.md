# REL10 HUD lifecycle harness — final independent gate

Date: 2026-10-22  
Prior reviews (preserved):
- `/tmp/boxbox-readiness/rel10-hud-harness-independent-review.md`
- `/tmp/boxbox-readiness/rel10-hud-harness-independent-closure.md`

Scope: read-only. No HUD setup, installer, host, model, hook, trust, tmux, or UI command was executed.

## Verdict

**PASS — the residual exact-scope M1 defect is closed. The frozen harness is eligible for the separately authorized isolated HUD lifecycle mutation.**

This verdict covers harness safety and evidence boundaries only. It does not establish HUD behavior, host/UI rendering, authentication, hooks, trust, tmux, publication, or release readiness; those require the planned execution and separate evidence.

## Frozen inputs

- `development/tools/release-hud-lifecycle.mjs`: `23793bf18e1dfa24b623b6a22843365ea80c00662d26bb5807b1c14191dc21a8`
- `test/release-hud-lifecycle.test.ts`: `626a2b8f1cb10d80484c9452bc0a3d4cf301b7eafd45840f2d855ed966b66316`

Both match `/tmp/boxbox-readiness/rel10-hud-harness-hashes.txt` and the author exact-scope closure report.

## Residual M1 closure

`inventoryKey(root, relativePath)` now produces the same complete identity as `inventoryScopes`. `assertInventoryDelta` accepts only exact complete-key membership and contains no basename/suffix fallback. Production allowlists bind:

- the Codex launcher to the canonical selected bin root;
- Claude settings to the canonical Claude configuration root;
- Claude state and backup to the canonical stable HUD root.

The two-scope regression creates the same relative filename in separate roots, changes only the second root, proves that allowing the first root fails, and proves that allowing the second root admits exactly one delta. This directly covers the prior collision.

The previously accepted full-version inventory compromise remains bounded: executable HUD-script trees participate in each transition inventory, while complete version roots are compared across the full journey. The report must retain that precise distinction.

## Retained closures

- M2: residue/plugin directories and setup/runtime/core files have nonsymlink identity gates before binding.
- M3: refusal cases require pinned ownership diagnostics, expected status, and unchanged inventories/bytes.
- Codex owned launcher requires regular nonsymlink identity, exact bytes, and mode 0755.
- Failed Claude core remains ineligible through the strict `ok:true` prerequisite.
- Configuration ownership/handoff claims remain explicitly separate from host and UI acceptance.

## Independent verification

- Frozen hashes: matched.
- Focused test: 8 pass, 0 fail, 37 assertions.
- `node --check`: pass.
- `git diff --check` on the two frozen files: pass.
- TODO/FIXME/skip/only scan: empty.
