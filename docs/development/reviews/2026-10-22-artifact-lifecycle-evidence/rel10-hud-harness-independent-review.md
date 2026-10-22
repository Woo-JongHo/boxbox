# REL10 HUD lifecycle harness — independent pre-mutation review

Date: 2026-10-22  
Scope: read-only review; no HUD setup, installer, host, model, hook, trust, tmux, or UI command was executed.  
Verdict: **FAIL — three mandatory findings must be resolved before native HUD mutation.**

## Frozen inputs checked

- `development/tools/release-hud-lifecycle.mjs`: `91718c4888d71fbe22097856d34771e1beec2bb41c8f2294ea0df7f220f81672`
- `test/release-hud-lifecycle.test.ts`: `0505c7fbe884e8126144b574ff33235c2b2d48de7a34ece49e528e336f91344a`
- The hashes match `/tmp/boxbox-readiness/rel10-hud-harness-hashes.txt`.
- Focused pure test: 5 pass, 0 fail, 25 assertions.
- `node --check` and `git diff --check` for the two owned files passed.

## Confirmed gates and boundaries

- The successful macOS Codex report is accepted and canonicalizes its workspace and both residue roots under `/private/tmp/...`.
- The installed setup hashes match the pinned historical/current values (`4ad73e…` and `e888c…`), and both inspected setup files are regular nonsymlink files in the actual successful cell.
- The current failed macOS Claude report is rejected at `report.ok !== true` before any HUD command. The observed rejection was `Core lifecycle did not pass`; therefore the stale Claude discovery result cannot currently feed this HUD verifier.
- The command runner invokes only the bound installed Node and installed `setup.mjs`, uses `shell:false`, and records bounded execution results. The report limitations correctly restrict a pass to configuration ownership; it makes no host/UI/tmux/rendering claim.
- The Codex historical disables have exact full-byte launcher assertions immediately before invocation. Harness-created edited/foreign replacements and deletion are also preceded by exact-byte comparisons. Claude edited/foreign settings are byte-compared before harness restoration.

## Mandatory findings

### M1 — The verifier does not implement the required non-following inventory boundary, so it cannot prove narrow writes or preservation of unrelated HUD/version content

The approved plan requires snapshots of settings, HUD data, both version roots, and the selected bin directory before every mutation, plus pre/post inventories and hashes at every transition. The implementation has no inventory function or transition snapshots. It checks only two harness sentinels, the Codex config hash, and the core report's limited `preserved` list (`release-hud-lifecycle.mjs:132-139, 152-177`). The version roots are never re-inventoried, and existing unrelated files in the shared HUD directory or selected bin directory are not enumerated or hashed.

Consequently, a setup command could alter or remove an unrelated shared-HUD pointer/receipt file, add an unexpected file, mutate a version-root file, or modify an unrelated bin entry while every current assertion still passes. The design document's statement that “Version directories are not inventoried recursively” directly contradicts the accepted plan and weakens the intended foreign-preservation claim.

Required closure: implement a non-following-symlink inventory/hash snapshot for the four planned scopes at each mutation boundary, define the exact expected delta for that transition, and fail on every other addition/removal/content/type/link-target change. Add a focused pure test demonstrating detection of an unexpected unrelated mutation.

### M2 — Canonicalization follows symlinks instead of rejecting them, contrary to the prerequisite contract

`validateCoreReport` calls `realpathSync` through `canonicalInside` for reported residue roots but never checks that each reported root itself is a nonsymlink directory (`release-hud-lifecycle.mjs:31-36, 46-60`). `binding` likewise canonicalizes `plugin`, `setup.mjs`, and `runtime.json` without rejecting a symlink at the supplied path (`92-103`). A report can therefore bind a symlinked residue/plugin/setup path to an in-workspace target and pass. The only explicit nonsymlink gate covers the core JSON and runtime Node.

This violates the plan's “reject symlinks/non-directories” gate and leaves the command target/path identity weaker than the frozen artifact binding claims. The current fixture happens to contain regular directories and regular setup files, but the verifier does not enforce that fact.

Required closure: lstat and require nonsymlink directories for residue and plugin roots and nonsymlink regular files for setup/runtime metadata (and a regular file for runtime CLI if it is part of the binding). Add fixture tests for residue-root and setup-file symlink rejection.

### M3 — Expected nonzero status alone is treated as an ownership refusal

All edited/foreign enable and disable cases accept any exit status `1`, then assert unchanged bytes (`140-150, 158, 161, 169, 171`). They never assert the ownership/refusal diagnostic required by the plan. A syntax error, dependency failure, unrelated validation error, or other generic exit 1 could therefore be reported as a successful ownership refusal.

Required closure: assert the exact stable refusal class/message from each pinned setup version (or another structured ownership-specific signal) as well as unchanged bytes/state. Add focused tests showing that an unrelated exit-1 diagnostic does not satisfy the refusal assertion.

## Additional observations

- The plan asks the Codex launcher check to include executable mode `0755` and exact marker/exec structure. Exact expected bytes are checked, but mode is not. Add the mode assertion while closing M1; this is smaller than the three blockers above.
- `validateCoreReport` proves that a `final-remove` claim exists in a successful core report; it does not independently inspect live registration. That is acceptable only because this verifier is explicitly chained to a completed, successful core cell and the HUD run does not claim another core lifecycle result.
- No conclusion is made about the failed Claude source/list inconsistency. Keeping `ok:true` strict is correct; do not weaken it to run the HUD journey.

## Review basis

Read directly: both frozen source files, the HUD harness design, the HUD plan, frozen hashes, and the actual macOS Codex/Claude lifecycle reports. The only executions were pure unit/static checks and direct read-only `validateCoreReport` calls. No lifecycle mutation function was invoked.
