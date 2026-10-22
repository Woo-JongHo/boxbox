# REL10 lifecycle plan closure review

Date: 2026-10-22
Mode: independent read-only review; no native lifecycle installation was run in this pass

Reviewed:

- `docs/development/proposals/2026-10-22-artifact-lifecycle.md`
- `docs/development/plan.md` R5 follow-up and REL10 contract
- `product/installer/README.md` update, dependency and removal contract
- relevant failure/repair coverage in `test/installer-artifact.test.ts`

## Verdict

**PASS — mandatory findings: 0.**

The amended proposal closes both mandatory gaps from the initial ITERATE review without adding an unsupported product promise. The initial review remains the historical record; this document records closure of those findings only.

## Closure matrix

| Initial finding | Amended plan | Contract match | Result |
| --- | --- | --- | --- |
| Update/rollback path did not test the occupied-registration boundary | Step 3 leaves 0.2.3 registered; step 4 attempts 0.2.4 directly, requires either a measured known collision/refusal with unchanged prior state followed by the documented manual unregister/reinstall path, or proof that an actual direct transition changed the installed version/root | Installer README explicitly says Codex rejects the same marketplace name at a different versioned path, prescribes marketplace removal then reinstall, and says the installer does not migrate marketplace sources automatically | Closed |
| Offline/error acceptance was absent | Step 3 uses a fresh npm cache with `npm_config_offline=true`, requires dependency failure before host registration, prior-version usability, unchanged sentinels and no mixed active registration; step 4 requires warm-cache offline same-version repair success and a valid reverse transition | README states nested pinned dependencies require internet or a primed cache and failed repair restores the previous directory; existing artifact tests cover offline repair failure preservation, successful retry and recovery-backup faults | Closed |

## Exact-scope checks

- The transition is accurately described as **manual and non-atomic** where the host marketplace collision requires unregister/reinstall. The proposal does not claim automatic in-place migration.
- The direct-transition branch is evidence-driven: success counts only if the installed version and root actually change; known refusal must leave registration, engine and data intact; unexpected errors stop the cell.
- The offline claim is correctly bounded to **npm dependency-offline mode**. The text explicitly excludes OS-wide network isolation and an entirely offline host CLI claim. No firewall or security-setting change is required by REL10 or the installer contract.
- Update and rollback preserve semantic host settings plus byte-exact project config, approval fixture and unrelated-file sentinels. The proposal does not create or approve new rules.
- Removal distinguishes host registration removal from filesystem cleanup. Remaining version directories are recorded as residue under the documented manual-cleanup contract, and harness deletion cannot be reported as product uninstall behavior.
- Real host registration remains required for every supported cell; fake hosts, engine-only smoke and hook/model evidence cannot substitute for it.
- Platform boundaries remain explicit: WSL is Linux/WSL evidence, native Windows is separate, Windows HUD is unsupported, and authenticated Claude UI/current Windows hook acceptance remain open.

## R5 linkage

`docs/development/plan.md` lines 113–121 links the exact proposal, binds the retained 0.2.3 and CI 0.2.4 archives, identifies real-host update/rollback/removal as the uncovered journey, and preserves the authentication, approval, live-profile and publication boundaries. The linked proposal supplies the detailed collision, dependency-offline, repair, rollback and residue acceptance criteria, so the concise R5 entry is startable without duplicating those details.

## Evidence limits

This is a plan-quality closure only. It does not establish that any native lifecycle cell passed. Archive availability, real CLI behavior, exact command outputs, preservation hashes, registration state, offline failure phase, residue and reverse transition still require execution evidence and independent review as specified by step 9.

No whole-OS network-denial test or automatic marketplace migration is an explicit REL10 requirement. Either may be future hardening, but making it mandatory here would expand the documented installer contract.
