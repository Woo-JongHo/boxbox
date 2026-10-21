# Claude registration and installer phase safety implementation

Status: implemented and locally tested; independent source review and new-artifact native host acceptance are separate pending gates. No live host profile was touched by implementation tests. No commit was created.

## Native defect and bounded correction

The preserved diagnostic probe proved that Claude 2.1.286 marketplace retargeting plus plugin install can exit zero while its recorded plugin version/cache remains 0.2.3. One explicitly authorized scoped update repaired registration to 0.2.4, preserving project/config/user bytes. WSL Claude 2.1.280 independently reproduced the original failure. Neither observation establishes model/session loading behavior. Original failed lifecycle results remain unchanged.

`claude-registration.mjs` owns real JSON identity checks: one enabled user-scope exact ID; an installer-owned physical local marketplace sibling with matching bundle/manifest; no shared installed marketplace or foreign source. The child rechecks exact marketplace root after add, performs existing install, and invokes one exact scoped update only for stale recorded version. Final listing, cached manifest and runtime paths must match. Permanent engine --version must equal bundle version before registration. Existing Codex manual migration remains unchanged.

## Simplified phase receipt plan closure

The reviewed plan was narrowed from an external transaction directory to one reserved internal `.boxbox-install-state.json`, created exclusively by the parent after payload copy. `install-state.mjs` binds schema, real destination root, name/version/host/marketplace. Child requires prepared state and atomically transitions immediately before host mutation and after verification. No nonce, special exit code or transaction framework exists.

Only a failure with a valid prepared receipt can restore/delete destination. Mutation-started, missing/malformed/mismatched state, or zero without verified completion retains destination and previous backup with exact recovery paths. A valid retained same-root receipt allows deliberate exact-installer retry; its backup is copied before receipt replacement. Invalid/foreign/symlink reserved files are refused without overwrite. Earlier retained backups are never silently deleted by later attempts. Success removes only its own receipt/backup. README states partial-state retention, not host rollback. Direct child invocation now requires its parent-created receipt; use the public installer entry for repairs.

## Scope and structure

Product: entry.mjs, install.mjs, install-state.mjs, claude-registration.mjs, installer README. Build: helper copy into root and/or host payloads. Tests: exact payload allowlist, stateful simulated Claude and real Node parent/child failure paths. No runtime engine, rules, preset, manifests, hooks, HUD or lifecycle harness changes were authored in this task.

## Verification and evidence

- Pre-edit bytes: `/tmp/boxbox-readiness/rel10-installer-before/`.
- Frozen eight-file SHA-256 manifest: `rel10-installer-freeze-first.json`; hashes rechecked unchanged after artifact suite.
- First focused run: `bun test test/installer-registration.test.ts`, 5 pass / 40 assertions (`rel10-installer-focused-first.log`). Repeated after actual layout, same result (`rel10-installer-focused-aligned.log`).
- `node --check` on all four product JS files: exit 0.
- `bunx tsc --noEmit`: exit 0 (`rel10-installer-tsc-first.log`, final supplement `rel10-installer-tsc-final.log`).
- Actual current source 00 import normalization and 06 align writer, then both readonly checks on all seven changed code files: every exit 0. Pre-layout bytes and full logs: `rel10-installer-layout/`. This is authorized repository development formatting, not a public preset approval claim.
- `npm_config_cache=/tmp/boxbox-readiness/rel10-installer-test-cache bun test test/installer-artifact.test.ts test/installer-registration.test.ts --timeout 300000`: 12 pass / 0 fail / 280 assertions, 27.84 seconds (`rel10-installer-artifact-first.log`). This builds a fresh local installer, uses real npm/npx/Node and engine, and explicitly simulated host CLIs. It is not native host acceptance.
- Cache copied to a fresh task directory from the completed isolated Mac Codex cell; no live/global cache or retained evidence deleted. This bounded cache avoids the earlier whole-cache ENOSPC failure mode.
- Direct TODO/FIXME/test.skip/test.only/describe.skip/describe.only scan on owned code: no matches. `git diff --check`: exit 0.

## Limitations / next gate

The historical 0.2.3 archive is immutable and cannot inherit this fix; documented exact removal/reinstall is its rollback route. Native new-candidate checks on all platforms and installed CLI versions are parent/operations responsibility after review. Existing source-level Windows path resolver tests are not proof of native Claude acceptance. Plugin-guard broad script includes builds/native installations, so it was intentionally not invoked during source editing; parent release verification owns those frozen-artifact checks.

## Independent review corrections (second frozen snapshot)

The first source review identified three mandatory omissions, preserved in `rel10-claude-installer-independent-review.md`: scoped-update capability must be proved before mutation; marketplace installLocation must agree with source; shared catalog entries must be refused even when not installed. All three were implemented in the Claude helper. The update-help test uses a real Node installer child with a simulated host advertising no --scope and proves exact preflight order, host JSON unchanged, prior generated skill bytes restored and receipt cleanup. Separate negative fixtures cover split locations and uninstalled shared catalog entries. Signal termination now conservatively retains destination even with a prepared receipt, with real child SIGTERM evidence.

Second frozen manifest: `rel10-installer-freeze-second.json`. Focused: 6 pass / 48 assertions. Combined rebuilt artifact + focused: 13 pass / 294 assertions / 0 fail in 24.05 seconds (`rel10-installer-artifact-review-closure.log`). Typecheck: `rel10-installer-tsc-review-closure.log`, exit 0. Changed four files have repeated actual full-file 00/06 write+readonly checks, every exit 0 (`rel10-installer-layout-review-closure/`). Token/comment/literal preservation across that layout is recorded in `rel10-installer-layout-token-proof.log`.

Same-version boundary was surfaced to independent reviewer: parent payload copy precedes child ownership preflight, so a modified same-version catalog is regenerated before this check. Different-version source catalogs remain original. Awaiting review/parent decision on a minimal pre-copy ownership guard rather than claiming that boundary is already covered.

## Pre-copy ownership closure (third code snapshot)

Independent review classified the same-version catalog issue as mandatory. Pure `assertClaudeCatalog` is now shared by entry before any backup/copy and by child source ownership checks. Existing Claude catalog directories/files must be regular (no symlinks), exact named single-entry BoxBox catalogs; missing catalog is allowed for partial repair. Root payload explicitly includes this helper and the exact artifact allowlist was updated. Artifact-level shared/malformed/symlink cases prove unchanged catalog bytes, simulated host registration JSON, complete host command log, and no backup residue.

Third frozen code: `rel10-installer-freeze-third.json`. Parent requested a documentation-only stale Codex history correction while tests ran; no executable/test bytes changed, and the final manifest records the resulting README separately (`rel10-installer-freeze-final.json`). This built test artifact therefore does not claim to contain that last README wording; parent builds the final candidate after source review. The wording removes stale 0.2.0/0.2.1/0.2.2 history and states Codex manual/non-atomic marketplace replacement, without claiming new native acceptance.

Latest rebuilt artifact + focused run: `rel10-installer-artifact-precopy.log`. Typecheck and Node syntax checks pass (`rel10-installer-tsc-precopy.log`). Five changed code files passed actual full-file import/align write+readonly checks (`rel10-installer-layout-precopy/`) and token/comment/literal preservation (`rel10-installer-layout-precopy-token-proof.log`).

Latest final local verdict: **13 pass, 0 fail, 310 assertions, 23.32 seconds**. Final TODO/FIXME/test.skip/test.only/describe.skip/describe.only scan returned no matches; git diff --check exit 0. All source is frozen pending independent review closure and parent final candidate build/native acceptance.
