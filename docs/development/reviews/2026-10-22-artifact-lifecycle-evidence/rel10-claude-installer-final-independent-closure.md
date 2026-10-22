# REL10 Claude installer transition — final independent closure

Date: 2026-10-22  
Prior reviews preserved:
- `/tmp/boxbox-readiness/rel10-claude-installer-independent-review.md`
- `/tmp/boxbox-readiness/rel10-claude-installer-second-independent-review.md`

Scope: read-only final source/test gate. No native installer or host mutation was executed.  
Verdict: **PASS — M1 through M4 and the signal-retention correction are closed in the final frozen source.**

## Final frozen files

All hashes match `/tmp/boxbox-readiness/rel10-installer-freeze-final.json`:

- `product/installer/install.mjs`: `ed1aaef067811388c65ea504b28a5baa7790de5d456386b9bf6717359f967fa4`
- `product/installer/entry.mjs`: `b55dd99b50fbc103ee56f1d1f75014bac470346ddf4757852bd96c0307caa141`
- `product/installer/install-state.mjs`: `2c127c6bc639f315dd485da08b3f293b7b086185dd376addc52b6707b69c72e7`
- `product/installer/claude-registration.mjs`: `b5bfdc71e0a451b3aed503537af5519db99cbc12a52eee182df44416c6f9b680`
- `product/installer/README.md`: `bf1c74dff0b9504b6c3bcaeaf31e508e6ec11b9a69995799e672af5fb60ffd93`
- `development/tools/build-installer-artifact.ts`: `e5ced9e6b958e38d489fe5582930fad3d8f74ff8d2d079667128628e9aee98f9`
- `test/installer-registration.test.ts`: `544b1d9581cc81b6eef19f2d1bfae817fc4859f4e9b8946aaeff327f9fd6e488`
- `test/installer-artifact.test.ts`: `13489356b5b7ef0deeba6e5077f1f1a1dcd4e74888542008f65564c01c22ad8e`

## Finding closure

### M1 — closed

Claude proves `plugin update --help` advertises `--scope` before the receipt reaches `host-registration-started`. The unsupported-help artifact test proves the prior skill bytes and simulated host JSON remain unchanged, the prepared-phase destination is restored, and only read-only version/help commands occurred.

### M2 — closed

Marketplace JSON must contain one local directory record whose `path` and `installLocation` both canonicalize to the same source. Exact post-add verification additionally binds that source to the intended permanent root.

### M3 — closed

The shared pure catalog validator requires the expected marketplace name and exactly one BoxBox entry sourced from `./plugin`. It rejects a second uninstalled catalog entry in addition to the existing installed-plugin sharing check. The child uses this validator for both existing and exact post-add sources.

### M4 — closed

The parent imports the same `assertClaudeCatalog` helper and invokes it for an existing Claude destination before creating a backup or copying payload bytes (`entry.mjs:21-28`). Existing catalog directories/files must be regular nonsymlink objects and exact single-entry BoxBox catalogs. A missing catalog is allowed only as a partial-repair condition; malformed, shared, and symlink catalog identities fail closed.

The real parent/artifact regression begins with an installed same-version destination, then independently exercises shared, malformed, and symlink catalogs. Each refusal proves:

- original catalog bytes remain unchanged;
- simulated host registration JSON remains unchanged;
- the complete host-command log remains unchanged;
- no new `.boxbox-repair-*` backup is created.

Thus the child preflight can no longer be bypassed by parent overlay ordering.

### Phase and signal boundary — closed

The internal receipt remains the small reviewed three-phase design. The parent distinguishes `child.signal` explicitly and retains destination/backup for every signaled outcome, even if the receipt still reads `prepared`. A real SIGTERM child test covers this behavior. Only a nonsignaled nonzero child with a valid prepared receipt authorizes restore/delete.

## Independent verification

- Frozen hashes: matched.
- Focused registration rerun: 6 pass, 0 fail, 48 assertions.
- Recorded rebuilt artifact plus focused suite: 13 pass, 0 fail, 310 assertions in 23.32 seconds.
- Node syntax checks for all four installer modules: pass.
- `git diff --check` on all eight files: pass.
- TODO/FIXME/skip/only scan on code/tests: empty.

The final README-only wording change occurred after the recorded artifact run and is separately pinned in the final manifest; executable and test bytes were unchanged. The parent must build a fresh final candidate containing that README before native acceptance.

This PASS authorizes progression to the separately controlled artifact build and native macOS/Linux/Windows lifecycle checks. It does not itself establish native Claude/Codex acceptance, publication readiness, model/session loading, hooks, trust, authentication, HUD, or UI behavior.
