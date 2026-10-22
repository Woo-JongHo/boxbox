# REL10 artifact lifecycle verifier — static source review

Method note: this is a source-only review of the three frozen files as supplied. The pinned SHA-256 values are treated as given evidence, not verified. Nothing here implies the macOS/Windows/Linux native cells passed or were executed.

## Mandatory findings

None. I traced each required area against the source and found no concrete release-safety defect:

1. **Scope isolation / fail-closed.** `isolatedEnvironment()` (`release-lifecycle.mjs`) allowlists only OS/PATH essentials, overrides every home, XDG, host (`CODEX_HOME`, `CLAUDE_CONFIG_DIR`), temp and npm cache/config location, and pins empty `npm_config_userconfig/globalconfig` (created `wx`). Credentials, `NODE_OPTIONS`, `BOXBOX_INSTALL_HOME` and plugin-root overrides are dropped. Archives are pinned by exact SHA-256 at pre-execution and re-verified per stage via `boundArchive()`; `verifyArchive()` rejects non-regular files and symlinks. Ambiguous host JSON, unrecognized failure text, and unexpected exit states all assert rather than proceed.
2. **Real host/version acceptance.** `hostRecords()` enforces explicit per-host schemas, rejects duplicates and any foreign plugin/marketplace by assertion (never by deletion), and `registered()` proves version, `enabled`, marketplace root (`samePath` against `platform.installationRoot`), manifest version, `runtime.json` CLI path, and `inside(workspace, pluginRoot)`. A zero-exit direct transition that did not actually switch is caught by re-verifying the `to` version.
3. **Cold/warm recovery.** Cold run asserts nonzero exit, `ENOTCACHED` plus `typescript` in output, no partial `roots.current`, and prior registration/engine intact. Warm repairs re-run the pinned installer offline against the untouched default cache and re-verify registration, engine journey and sentinels.
4. **Manual transition/rollback.** `transition()` only takes the manual path when `isMarketplaceCollision()` matches, and verifies the prior registration and engine *before* `unregister()`; unrecognized nonzero output stops the cell with retained evidence. `unregister()` removes only the exact plugin and marketplace names after confirming owned state.
5. **Preservation/residue honesty.** Byte digests are re-checked after every phase (`checkPreserved`), including a semantic check of the unrelated host setting (Claude `settings.json` env value; Codex top-level `hide_agent_reasoning` exactly once and still `true`). Steps record `filesystemRemoval: false`; `limitations` state no filesystem uninstall claim; residue inventories the retained roots; final assertion requires the roots to still exist.
6. **Tests.** The six focused tests cover argument strictness (duplicates, same-path archives), env filtering (secrets/overrides dropped, both casings), digest/symlink/directory rejection, foreign/duplicate/unknown-schema refusal, retained failure evidence with zero commands and non-reused output, and collision-matcher true/false positives. This is adequate for the static contracts; simulating native cells is explicitly not required.

## Optional observations (non-blocking)

1. `verifyArchive()` has a lstat→readFile TOCTOU and extraction happens after verification; per-stage re-verification mitigates but cannot eliminate a race. Dev-tool risk only.
2. The `findCommand` probe spawns inherit no harness timeout unless `platform.mjs` supplies one; a hanging probe candidate could stall the cell (availability, not safety). `run()`'s 180 s timeout and 8 MB `maxBuffer` can likewise convert a slow/verbose-but-correct native install into a retained failure — fail-closed false negatives.
3. Residue inventory covers only the two expected `roots` with names/sizes (no per-file digests); npm/host cache droppings or files created in `project` outside the remembered set are not enumerated. Honesty currently rests on the `limitations` text, which is acceptable.
4. `hostRecords()` treats *any* other plugin/marketplace in the isolated profile as fatal. A host that auto-lists built-ins would fail the cell rather than be distinguished — fail-closed, but may need schema refinement after native evidence.
5. `install("warm-cache-*-repair", …)` re-runs the installer while the same version is already registered and requires exit 0; the collision matcher is not consulted there. If the installer refuses same-version reinstall, the cell fails closed rather than taking the documented path — consistent with the proposal's "require success", but worth confirming natively.
6. `isMarketplaceCollision()` could in principle misclassify an unrelated failure whose text happens to contain "boxbox-plugins", "marketplace" and a collision word; the consequence is bounded (prior state is verified intact before the documented manual removal, and full logs are retained).
7. `inside()`, `samePath()`, `inventory()` and the Codex TOML top-level check are exercised only through the full lifecycle, not unit-tested; acceptable because real archives are digest-pinned, but exporting them would cheapen regression coverage.
8. Proposal step 8 (HUD adapters) is out of this harness's scope and is honestly listed under `limitations`; keep that separation when reporting native results.

VERDICT: PASS
