# REL10 fixed candidate — macOS Claude core and HUD evidence review

Date: 2026-10-22  
Scope: independent read-only review of the frozen candidate, core lifecycle cell, HUD lifecycle cell, retained original failure, and final source audit. No installer, host, or HUD mutation was executed by this review.  
Verdict: **PASS for the macOS Claude terminal core and configuration-ownership HUD cells.**

## Candidate binding and provenance

- Candidate archive: `/tmp/boxbox-readiness/rel10-fixed-candidate-1f1343e9/boxbox-plugin-0.2.4.tgz`
- SHA-256: `1f1343e91d2799998884ed5d75e1a26d7858226d2f9f51f07621bfeedaf6ecd3`
- Size: 263448 bytes
- `candidate.json` truthfully records source `a4e14a9e3636e8103c4282ca835488ba0fac134a`, `sourceDirty:true`, and local unpublished/non-CI provenance.
- The archive hash matches `SHA256SUMS`, the core report's current artifact and every current artifact check, and the HUD report's current archive binding.
- Direct extraction confirmed that the packed Claude installer, public entry, receipt helper, Claude-registration helper, and README hashes exactly match the final frozen source manifest. The candidate contains the final README rather than the earlier test-only wording snapshot.
- The core verifier hash is the independently reviewed `292b730c…` follow-up verifier. The report labels the custom candidate as explicit caller-bound unpublished 0.2.4 and does not inherit the earlier CI candidate provenance.

## Core lifecycle result

`/tmp/boxbox-readiness/rel10-fixed-macos-claude-1/lifecycle.json` is schema 1, `ok:true`, macOS arm64, Node 22.22.3, Claude Code 2.1.286, npm 10.9.8. It records 93 commands, no command with `state:"failed"`, both permanent version roots present, and final host registration removal.

### Fresh, cold, and warm behavior

- Fresh historical install binds the exact immutable `f07df7…` archive, lists one 0.2.3 user plugin/cache and the 0.2.3 marketplace root, and passes engine version, doctor, check/format/content/idempotence gates.
- Cold-cache current installation exits nonzero with the expected `ENOTCACHED` TypeScript dependency failure. The report proves no partial current root, retained 0.2.3 registration, and a still-usable prior engine through the same engine gates.
- Warm-cache historical repair succeeds and preserves the registered 0.2.3 identity and engine behavior.

### Fixed direct upgrade

The direct candidate invocation exits zero. Its recorded stdout shows the marketplace changing from the permanent 0.2.3 root to the permanent 0.2.4 root, the install no-op detecting stale 0.2.3 metadata, and one fully qualified user-scope update succeeding from 0.2.3 to 0.2.4.

The immediate machine-readable acceptance evidence then shows:

- plugin ID/version/cache: `boxbox@boxbox-plugins`, 0.2.4, cache `.../boxbox/0.2.4`;
- marketplace `path` and `installLocation`: exact permanent 0.2.4 root;
- cached manifest: BoxBox 0.2.4;
- cached and permanent `runtime.json`: byte-equivalent Node/CLI targets pointing to the permanent 0.2.4 engine;
- installed engine `--version`: 0.2.4;
- doctor/check/format/content/idempotence gates: passed;
- historical 0.2.3 engine: still directly usable from its retained permanent root.

Warm-cache current repair subsequently succeeds without another stale-version transition and repeats the 0.2.4 registration/runtime/engine gates.

### Historical rollback and removal

The historical artifact is not credited with the new transition behavior. The cell explicitly verifies current registration, performs documented plugin/marketplace removal, reinstalls 0.2.3, and records rollback as `directTransition:"not-attempted"`, `manualRemovalRequested:true`, `atomic:false`. The restored 0.2.3 cache/root/runtime and engine gates pass. Final plugin and marketplace removal succeeds while both version directories remain as documented permanent residue.

### Preservation

Nine pinned user/project/approval files retain their recorded hashes across the lifecycle, including user sentinels in both version roots. The unrelated Claude setting remains present. Every preservation checkpoint reports success, including after cold failure, upgrade, repair, rollback removal/reinstall, and final removal.

## HUD lifecycle result

`/tmp/boxbox-readiness/rel10-fixed-hud-macos-claude-1/hud-lifecycle.json` is schema 1 and `ok:true`. It binds the exact successful core workspace, `f07df7…` previous archive, `1f1343e9…` current archive, and the pinned old/current HUD setup hashes.

Eight setup commands complete with their expected statuses and exact-scope inventory deltas:

- old enable creates only settings/status state/initial backup changes;
- current in-place enable changes only settings and status state;
- edited enable and disable both exit 1 with the pinned ownership diagnostics and zero inventory delta;
- old rollback enable and old remove change only settings/status state;
- foreign enable and disable both exit 1 with the pinned ownership diagnostics and zero inventory delta.

The final state has no Claude HUD ownership state, preserves both unrelated settings witnesses, retains the documented first-settings backup, and preserves the unrelated stable-HUD sentinel. Complete version roots match their pre-HUD inventories. The observed changes stay within the verifier's exact allowed keys.

This proves isolated configuration ownership, handoff, refusal, rollback, and removal. It does not prove a rendered Claude status line, a model/session reload, authentication, hooks, trust, tmux, desktop UI, Windows HUD, publication, or release readiness.

## Original failure preservation

The original `bec626…` macOS Claude failure remains unchanged:

- `lifecycle.json`: `e6beceffe5f4d94113c72b5032de5f1a7bdb05f24e2ece81ccd25b9fbfcfff7f`, byte-identical to the durable evidence copy;
- original logs 043/044/045: `489acfb…`, `b3c80c…`, and `20c687…`, matching the previously recorded transition-hash manifest.

The new PASS is a distinct candidate/cell and does not rewrite or reinterpret the old failure.

## Review boundary

The frozen-source GLM audit at `/tmp/boxbox-readiness/rel10-installer-glm/review.md` is PASS and keeps native/platform/UI limitations explicit. This evidence review independently checked artifact bytes, reports, machine-readable listings, runtime files, command logs, preservation hashes, and refusal diagnostics rather than relying on that audit's conclusion.

No mandatory evidence inconsistency was found. This PASS applies only to the exact local unpublished candidate and the reviewed macOS Claude terminal cells. Linux, Windows, Codex for this new candidate, final clean/CI provenance, and native UI/session behavior remain separate gates.
