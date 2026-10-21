# Exact-artifact lifecycle verification

## Gap and scope

The READINESS1 completion audit found an unexecuted REL10 requirement: a clean install, cross-version update,
rollback and host removal while preserving user configuration and project approval data. Existing candidate CI
proves fresh engine-only installation on three operating systems. Development install-shell tests and mocked host
artifact tests do not prove a real host plugin manager accepts these transitions.

Use the existing archives without rebuilding or modifying their bytes:

| Role | Version | SHA-256 | Provenance |
| --- | --- | --- | --- |
| Previous fixture | 0.2.3 | `f07df7ada9aa234c2935ed500b4fe15b1a5d53f7b7a6de7d8ec107f53c8f572c` | Retained local preview built from an uncommitted worktree; not a released or independently approved baseline |
| Current candidate | 0.2.4 | `bec626435e525c2d7324d156f85d2c114427d875725abcecb42fed561b2b92be` | Clean source `35b6178`, CI run 39637622755, three-OS engine smoke passed |

Registration and removal commands need no model request. This work does not satisfy authenticated Claude UI,
Claude/current-Windows hook acceptance, persistent trust, public rule approvals, licensing or publication.
Keep those prerequisites open. A Linux run under WSL is explicitly a Linux/WSL process result, not a hosted-CI
lifecycle result or Windows native-host result.

## Execution and ownership

1. Inspect actual host CLI help/version and isolated-platform prerequisites; never infer commands from memory.
2. Add a reusable Node harness under `development/tools/release-lifecycle.mjs`. Bind archive hashes before extraction,
   validate package identity, and isolate HOME, user/config/data locations, both host homes and npm cache.
3. Exercise each real host separately: install 0.2.3, initialize a project, and run doctor and the existing approved
   check/format/recheck journey. With that registration still present, attempt the 0.2.4 install using a fresh npm
   cache and `npm_config_offline=true`: require the dependency-cache failure before host registration, the prior
   version still usable, preservation sentinels unchanged and no mixed active registration. Retain failed-install residue.
4. Attempt the direct version transition with normal dependency access. For a known marketplace collision/refusal,
   verify the prior registration/engine/data remain intact, then use the documented manual unregister/reinstall
   procedure. A successful direct transition must prove the actual installed version and root changed; a stale installed
   cache cannot count as success. Unexpected errors stop the cell. Verify 0.2.4, then perform a warm-cache offline
   same-version repair and require success. Repeat the reverse transition to exact 0.2.3, recheck, and remove registration.
   Report manual migration as manual and non-atomic: the installer does not promise automatic marketplace migration.
   npm dependency-offline mode is not OS-wide network isolation or proof of an entirely offline host CLI.
5. Preserve representative user settings semantically when the host rewrites its own config; preserve project config,
   existing approved-rule fixture bytes and unrelated user files byte-for-byte. Do not create new canonical approvals.
6. Record host listings and permanent-directory residue before cleanup. The public installer has no filesystem
   uninstall command: documented host removal may leave permanent version directories. Do not present a harness
   deletion as a product uninstaller or broadly delete a parent/shared directory.
7. Run the same bound archives on macOS, native Windows and Linux. If Linux uses WSL, retain that qualifier. Core
   lifecycle registration must not be replaced with fake hosts, engine-only mode or model/hook evidence.
8. For supported macOS/Linux HUD adapters, separately verify the documented owned-launcher disable/update/removal
   handoff and preservation of unrelated settings. Windows HUD remains unsupported. Retain failures and distinguish
   partial plugin installation from a later HUD setup failure.
9. Independently review command evidence, archive identities, preservation and residue claims. Fix any actual defect,
   run relevant regressions and the requested GLM review for product changes, then update REL10 with measured cells.

The main agent owns plan/integration and documentation. The harness worker owns only its new verifier and focused
verifier tests. The platform investigator owns read-only prerequisite evidence. No live profile, credential copy,
login, model call, hook trust or public publication is part of this work.

## Completion criteria

Each host/OS cell needs actual command acceptance, registration pointing to the expected version, working engine
checks after update and rollback, fresh-cache dependency failure with prior-version recovery, warm-cache offline repair,
successful exact-plugin/marketplace removal, preserved user-owned data and an honest residue inventory. Version directories may remain under the documented manual-cleanup contract; deleting
those directories is not evidence of automated ownership-aware removal. Unsupported or unavailable cells stay open.

The overall release journey remains incomplete while its authenticated-host or human-approval prerequisites remain
unmet. These lifecycle results extend the existing CI evidence; they do not change the artifact source identity or
transfer the local 2b43 native-hook evidence to the byte-distinct CI archive.

## First execution findings

macOS Codex 0.163.0 passed the complete core lifecycle with the exact archives above. Both upgrade and rollback
required the documented marketplace removal/reinstall sequence; they were manual and non-atomic. The independent
evidence review found no mandatory defect. HUD configuration and other host/OS cells require their own evidence.

macOS Claude Code 2.1.286 stopped at the direct upgrade acceptance gate. The installer returned zero and the
marketplace moved to the 0.2.4 directory, but `plugin list --json` retained version 0.2.3. The host output states that
the local plugin loads in place from the new directory and that `plugin update` re-records its version. Therefore
the failure establishes inconsistent recorded installation identity, not that the host necessarily loads old code.
Preserve this failed cell and diagnose the actual cache target, metadata and supported update command before a fix.
Do not weaken the verifier to accept an unverified version or count an installer exit code as host acceptance.

The same mismatch was reproduced with Claude 2.1.280 under WSL. A separately recorded, one-time scoped update
on the retained macOS cell refreshed the listing, cache manifest and runtime to 0.2.4 while preserving user data;
the original failed report remains unchanged. Issue [017](../issue-library/records/BBX-20261022-017-claude-marketplace-transition.json)
tracks the installer correction and its required independent and native verification.

## Corrected-candidate verification

The installer correction changes the archive, so later tests must bind its new digest explicitly. Both verifiers
accept `--current-sha256 <64 lowercase hexadecimal characters>`; omitting it retains the original `bec626…` binding.
An override proves byte identity only and is labeled caller-bound/unpublished. Record source/build provenance
separately; never reuse the original candidate's CI claim for different bytes. The previous fixture remains pinned
to `f07df7…`, and both versions remain fixed at 0.2.3/0.2.4. HUD setup hashes are checked independently.

Use `--manual-rollback` for Claude when returning to the immutable historical 0.2.3 installer. That installer
cannot acquire the new version-refresh behavior. The option explicitly removes the owned registration and reinstalls
the old fixture, recording that a direct rollback was not attempted and the transition is non-atomic. Direct-upgrade
acceptance still requires correct host version, marketplace, manifest and runtime; no stale-success exception is added.

Native Windows Codex 0.157.1 exposes a measured marketplace record containing only `name` and `root`. The verifier
accepts that exact older schema only for that host version while retaining the plugin-level provenance and all
canonical root/runtime checks. Its measured extended drive path prefix is normalized only on Windows before strict
`realpath` comparison; extended UNC and relative forms remain rejected. Preserve the initial transport and schema
failures separately from product failures.

The first corrected local candidate is `1f1343e91d2799998884ed5d75e1a26d7858226d2f9f51f07621bfeedaf6ecd3`
(263,448 bytes). Its frozen installer source passed independent review and GLM static review, and the complete
local check passed 672 tests with five existing parser skips and zero failures. It was built from the dirty worktree
based on `a4e14a9`, so it is explicitly a local unpublished candidate. The installer correction was then committed as
`6bf7e76`, and the lifecycle verifiers as `66eb978`; a new clean CI candidate is being produced from the latter.

Both macOS hosts passed this exact local candidate's full core lifecycle: Codex 0.163.0 used documented manual
upgrade/rollback, while Claude 2.1.286 accepted the direct upgrade after one exact scoped update and used explicit
manual rollback to the historical fixture. Both supported HUD configuration ownership cells passed separately.
Independent evidence reviews confirmed the bounded results. Windows/WSL cells and final CI-byte verification remain
separate work; these results establish no authenticated UI, hook acceptance or public release.

## Final clean-source execution checkpoint

The corrected local candidate completed all six core host/OS cells and four supported HUD configuration cells.
The separately built clean CI candidate from source `66eb97821d6b8bd81323175e071a107b2aa3f215` has SHA-256
`ebfe6a7796d9d85e9cf3088c955df4fb5477e60513e8ebda97d517746d93c665` (263,896 bytes), recorded by run
39646320662 attempt 1. The same full native matrix was rerun on these exact bytes and independently passed.
The historical fixture still uses the original `f07df7…` bytes; Claude rollback remains explicit and manual.

Both clean-source CI verification jobs passed 677 tests without failures or parser skips. Hosted Linux/Windows
engine smoke passed; the hosted macOS smoke job is queued, so the candidate workflow is not yet a completed PASS.
The ordinary source PR verification passed both platforms. The exact archive was delivered to a new chacada
Downloads directory with WSL and native PowerShell digest agreement. The
[final evidence index](../reviews/2026-10-22-artifact-lifecycle-evidence/README.md#final-clean-ci-candidate) binds source,
archive, platform, raw command output, reviews and delivery. New public approval data, authentication/trust and
publication remain outside these measurements.
