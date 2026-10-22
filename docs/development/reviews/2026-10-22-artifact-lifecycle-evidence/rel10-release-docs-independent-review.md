# REL10 release documentation — independent review

Date: 2026-10-22 KST  
Mode: read-only documentation/source/evidence comparison  
Repository edits: none

## Verdict

- `docs/user/codex-windows-test.md`: **ITERATE**, 2 mandatory source/metadata corrections.
- `docs/development/release-contract.md`: **ITERATE**, 4 mandatory stale-current-state corrections.

## Windows user guide

The installer commands, host transition guidance and unpublished-candidate boundary are otherwise source-consistent, but two current sentences need correction.

- Lines 6 and 28–32 correctly separate a local unpublished `0.2.4` archive from registry installation, package-name acceptance, publisher authentication and licensing. It does not imply publication or an approved public channel.
- The local command at lines 23–26 uses the actual installer binary contract: `npm exec --yes --package <archive> -- boxbox --codex`. The PowerShell update command at lines 39–42 uses `npm.cmd`, the exact `boxbox` bin and the documented manual Codex marketplace removal. The `<version>` substitution is explained and avoids another stale hard-coded candidate version.
- Node `>=22.22.3`, permanent per-user installation, Windows HUD exclusion, Claude's exact user-scoped update, phase-receipt/backup retention and non-atomic recovery language agree with `product/installer/entry.mjs`, `platform.mjs`, `claude-registration.mjs`, `install-state.mjs` and the installer README.
- Lines 55–57 accurately state the two currently approved preset families and do not assign JSON/YAML approval or automatic write authority to other patterns.
- Lines 59–61 correctly classify the Windows Node/Python/Codex result as historical evidence that does not verify the current archive, and keep native hook delivery separate.

The post-publication `npx.cmd boxbox-plugin` commands remain explicitly conditional and are not represented as currently verified registry commands.

### G1 — line 32 misstates the license decision

The repository already has an MIT root `LICENSE`, and the root README explicitly retains it. What remains undecided is whether and how release-package metadata/notices align with that repository license; the current installer preview is deliberately `UNLICENSED` and grants no open-source rights. Replace “a general open-source license is undecided” with that exact split. Do not imply that the repository itself lacks a license or that MIT already applies to the unpublished installer artifact.

### G2 — line 58 omits the writing Align mode

`align --file <file> --json` can write an approved horizontal-whitespace transformation; only `--dry-run` is non-writing. The current sentence “Only an explicit `format` writes” is false. State the mode distinction used by the root README and `docs/user/modes.md`: explicit non-dry-run Align writes approved alignment only, explicit Format writes through the broader formatter-plus-alignment pipeline, and both dry-run forms preserve the original.

## Release contract — correct changes

The new four-language implementation and write-boundary text is supported:

- `PUBLIC_LANGUAGES`, CLI parsing/dispatch and the structured format pipeline cover TypeScript, Python, JSON and YAML.
- The installed public-artifact test covers JSON/YAML syntax, default refusal, and an explicitly supplied synthetic JSON approval path.
- The recommended preset currently contains exactly two conventions, four examples and two decisions; neither JSON nor YAML is default-approved.
- The structured adapter belongs in the write inventory, and the builder/public-artifact tests enforce the current excluded-writer/package boundary.
- Version `0.2.4`, `UNLICENSED` preview metadata, incomplete REL11, undecided release-package licensing and absence of publication authorization are correctly stated.

## Mandatory corrections in the release contract

### M1 — lines 16–23 mix historical artifacts with the current support verdict

The OS row still says native Windows `0.2.1` acceptance and Linux CI setup is not artifact acceptance, while the current record includes later exact-artifact lifecycle evidence: the prior `bec626…` candidate passed native Windows Codex and WSL Codex lifecycles, and the distinct corrected local `1f1343e9…` candidate passed macOS Codex and Claude core/HUD ownership cells. The corrected candidate has not yet completed Windows/WSL or final clean CI binding.

Rewrite the OS/host verdict around exact artifacts and dates. Preserve `0.2.1` as historical evidence if useful, but do not let it read as the current support basis. State that `1f1343e9…` is local, dirty-source, unpublished and macOS-only so far; Windows/WSL and final clean CI remain pending.

### M2 — line 17's host verdict is stale and refers to a nonexistent published-engine acceptance gate

The sentence reports only the 2026-10-07 isolated homes and says “real host acceptance with the published engine is unconfirmed.” No BoxBox installer has been published. Real host CLI lifecycle acceptance now exists for exact unpublished artifacts, while authenticated model/session, hook trust/UI and registry installation remain separate.

Replace this with the actual current split: exact unpublished artifact lifecycle/configuration acceptance has bounded passes and failures; the corrected candidate currently has macOS Codex/Claude passes; authenticated session/UI/hooks and published-registry journeys are not established.

### M3 — line 21 incorrectly says all runtime/platform minima are frozen

The executable source does freeze Node at `>=22.22.3`, but the document itself says the final OS/host matrix remains unconfirmed and current plans keep Windows/WSL and clean-CI proof open. State the measured Node minimum directly and leave Linux distributions, architectures and supported host-version ranges pending the final exact-candidate matrix.

### M4 — lines 63 and 69 make stale current-session/authentication claims

“A separate audit was skipped this session” is false for the current work: multiple independent reviews and a GLM audit have run. Remove it or qualify it as dated historical context.

“npm authentication is complete” conflicts with the corrected Windows guide's current statement that publisher authentication remains unverified. Earlier evidence can be described as historical authentication for a prior candidate, but it cannot establish current credentials or publication access. Change line 69 to the same current boundary: package name availability/reservation, publisher authentication, license/channel decisions and registry publication remain unverified or pending.

## Limits retained by this review

This review does not turn local artifacts into releases, approve JSON/YAML preset rules, grant a package license, authorize npm publication, or establish authenticated model/session, native hook/UI, Windows HUD or final supported-matrix acceptance. It inspected documentation, source and durable evidence only; no installer or host command was run.
