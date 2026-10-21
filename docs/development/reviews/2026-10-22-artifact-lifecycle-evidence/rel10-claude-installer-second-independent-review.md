# REL10 Claude installer transition — second independent review

Date: 2026-10-22  
Prior review: `/tmp/boxbox-readiness/rel10-claude-installer-independent-review.md` (preserved)  
Scope: read-only. No native install, host registration, or product edit was performed.  
Verdict: **FAIL — M1–M3 are closed, but one pre-copy shared-catalog ownership gap remains.**

## Frozen source set

All hashes match `/tmp/boxbox-readiness/rel10-installer-freeze-second.json`. Changed frozen members are:

- `product/installer/claude-registration.mjs`: `4e358d7dd74c51f17ef966be0d60964a30a0e96281b02c0a16d4583f038180c7`
- `product/installer/entry.mjs`: `16b0e6c9be563c9b52d7298229efdd37e3a3d6e8cb2b12054c7472ee9643d60f`
- `test/installer-registration.test.ts`: `17bba17521b697033e2d1a82bb8718262c399e634ad4413ab7e2ff51d551dbbf`
- `test/installer-artifact.test.ts`: `43d5df1e785260011304c5e23777495974d560f64d3ff58824a35fce268c50b9`

The other four reviewed source/build/doc files retain their first-freeze hashes.

## Closed findings

- **M1 closed:** Claude preflight invokes `plugin update --help`, requires an advertised `--scope`, and does so before `host-registration-started`. The artifact-level negative case proves unsupported help leaves simulated host JSON and prior skill bytes unchanged and restores the prepared-phase destination.
- **M2 closed:** both marketplace `path` and `installLocation` must be strings, canonicalize to the same source, and the exact post-add check still binds that source to the intended root.
- **M3 closed for the catalog visible to child preflight:** the source catalog must have the expected marketplace name and exactly one BoxBox entry with `./plugin`; an uninstalled second entry is rejected before child host mutation.
- **Signal behavior is now explicit:** the first freeze would have treated a signal with a still-`prepared` receipt as safe cleanup because `child.status` was null and therefore nonzero. It had no signal regression, so the prior review's broad statement that signaled outcomes retained was inaccurate. The second freeze records `child.signal` and makes every signaled outcome uncertain/retained. A real SIGTERM child-process test now covers destination and backup retention.

## Mandatory finding

### M4 — Same-version repair overwrites the active catalog before the shared-catalog preflight can inspect it

For an existing same-version Claude destination, the parent currently:

1. validates only the installation receipt;
2. creates a backup;
3. overlays the shipped payload onto the existing destination with `cpSync(payload, destination, { recursive: true })` (`entry.mjs:21-47`);
4. then starts the child, whose `claudeRegistration.preflight()` reads the destination catalog.

If the active same-version marketplace catalog contains a user-added, currently uninstalled second plugin, step 3 replaces that catalog with the shipped single-entry catalog before the child can inspect it. The M3 child check then passes. On verified success the current repair backup is deleted, so the added catalog entry is silently removed even though the promised contract says a shared marketplace is refused. The existing M3 regression constructs a different-version/current source directly and therefore does not cover this parent overlay ordering.

This is not ordinary regeneration of an unreferenced shipped file: Claude's existing marketplace registration may actively point to this exact destination and expose the extra catalog entry. The installer must establish that replacing the catalog does not affect another plugin before overwriting it.

Required closure:

1. Add a narrow Claude-only parent pre-copy guard when the destination and its catalog already exist. Validate the existing catalog as the exact single-entry BoxBox catalog before backup/overlay. Reuse the same pure catalog validator as child ownership checks if practical.
2. Reject a malformed/shared existing catalog before modifying destination bytes or host state. Keep this as an ownership precondition; do not add a transaction framework or host rollback.
3. Add an artifact/real-parent regression starting with an existing same-version destination whose catalog has a second uninstalled plugin. Prove failure occurs before copy/spawn mutation, the original catalog and sentinel bytes remain exact, simulated host state is unchanged, and no new repair backup/receipt residue is created.

## Verification

- Focused registration suite in the closure log: 6 pass, 0 fail, 48 assertions.
- Combined registration/artifact closure log: 13 pass, 0 fail, 294 assertions in 24.05 seconds.
- Frozen hashes matched.
- No native installer command was run by this review.

Native acceptance should remain blocked until M4 is closed and independently rechecked. The current tests remain simulated orchestration evidence, not native-host proof.
