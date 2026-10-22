# REL10 release documentation — independent closure review

Date: 2026-10-22 KST  
Mode: read-only re-review against current source, installer README and durable lifecycle evidence  
Initial review retained unchanged: `/tmp/boxbox-readiness/rel10-release-docs-independent-review.md`  
Repository edits: none

## Verdict

**PASS — mandatory findings 0.**

Both prior ITERATE sets are closed:

- `docs/user/codex-windows-test.md`: G1 and G2 closed.
- `docs/development/release-contract.md`: M1 through M4 closed; the added Guide/Align command descriptions and development commit/push boundary are accurate.

## Windows guide closure

- The guide now distinguishes the repository's retained root MIT license from the installer preview's `UNLICENSED` metadata and lack of an open-source grant. It leaves release-package metadata/notices alignment pending and does not transfer MIT rights to the preview artifact.
- It now states that non-dry-run Align writes approved horizontal whitespace, Format owns the broader formatter-plus-alignment pipeline, and both dry-run forms preserve the original. This matches `product/engine/cli.ts`, the root README and `docs/user/modes.md`.
- The local `npm exec --package ... -- boxbox --codex` and Windows `npm.cmd` commands remain valid. The manual Codex marketplace handoff, Windows HUD exclusion, Claude scoped update, fail-closed retained-state guidance, Node minimum and historical Windows-evidence qualification match current source and the installer README.
- Publication, registry command success, publisher authentication, package-name reservation and release authorization remain explicitly unclaimed.

## Release contract closure

- The support table now identifies Node `>=22.22.3`, separates measured macOS/WSL/native-Windows host versions, and avoids inferring Linux distributions, architectures or host-version ranges from those measurements.
- The local unpublished `1f1343e9…` candidate is correctly described as dirty-worktree and non-CI. Durable reports record six terminal core lifecycle passes across macOS, WSL and native Windows, plus four supported macOS/WSL HUD configuration-ownership passes. The document keeps Windows HUD unsupported and final clean CI-byte verification pending.
- Host-manager lifecycle/configuration acceptance is separated from authenticated sessions, UI/hooks, registry publication and a final release support matrix. The text does not inherit the local candidate's passes into CI source `66eb978` or claim the currently running CI has completed.
- The public command list now covers Check, Guide, Align, Format, Init and Doctor consistently. Guide is read-only; Align is approval-gated horizontal-whitespace writing with a dry-run; Format retains formatter-plus-alignment and dry-run semantics.
- The four-language implementation, default TypeScript/Python approvals, unapproved JSON/YAML preset state, structured adapter and public artifact boundary remain source-accurate.
- Current independent/GLM audits replace the stale “audit skipped” statement. The package-name/authentication paragraph no longer treats historical npm authentication as current release access.
- Development commit/push and `chacada` candidate delivery are recorded as separately authorized development actions. Release tag, registry publication and repository-visibility changes remain unauthorized.

## Verification

- Both Markdown files passed `git diff --check`.
- All local Markdown links in the two files resolve.
- The stale phrases identified in the initial review are absent.
- No executable command, installer, host mutation, CI action or repository edit was performed by this review.

## Limits

This closure validates current documentation wording only. It does not independently approve the still-running remote-evidence review or CI run, convert `1f1343e9…` into clean/CI provenance, establish authenticated host UI/hooks, approve JSON/YAML preset rules, grant an installer license, reserve the npm name, verify publisher access, or authorize publication.
