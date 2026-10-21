# GitHub candidate delivery and installed Codex status

Date: 2026-10-21. This is an unpublished candidate, not a public release.

## Integration and operational pipeline

[PR #2](https://github.com/Woo-JongHo/rowgrid/pull/2) merged the current development structure into private GitHub main
as `6e74c9327c44b4121a7ec4803d3acad66ee0f071`, preserving the existing ten main-only commits in ancestry and the MIT
LICENSE byte-for-byte. Current approved preset records remain 2 conventions, 4 examples and 2 decisions; only the
four synthetic examples have the separately approved CC0-1.0 metadata. Preview package metadata stays UNLICENSED.

The bug/feature/release-candidate forms and rule-proposal template exist on the default branch, and the missing
rule-proposal label was created. YAML was parsed and compared with official form syntax; the issue chooser UI was
not exercised. GitHub GraphQL lists only the Markdown template, so it is not used as YAML acceptance proof.

[Final PR verification](https://github.com/Woo-JongHo/rowgrid/actions/runs/39543306308) passed 496 tests with zero skips
and zero failures on both Ubuntu and macOS (2321 assertions on macOS, 2313 on Ubuntu). TypeScript/shell checks passed.
This includes real Rust/Kotlin parsers, unlike the local 491-pass/5-unexecuted baseline. The first failed run and
Rust/Python corrections are retained in [the integration record](2026-10-21-github-integration.md). Actual Sonnet 5.5
reviews and final Opus 5.5 PASS reports are committed there; no lower model substituted for Opus.

The [manual candidate workflow](https://github.com/Woo-JongHo/rowgrid/actions/runs/39543872402) succeeded in all six jobs:
two full verification jobs, one package job, and three installed-archive smoke jobs. It built once from a clean main
checkout and passed the same independently checked digest to every smoke job. Artifacts are retained for 14 days.

## Frozen archive

- Filename: `boxbox-plugin-0.2.2.tgz`
- Bytes: `126691`
- SHA-256: `611858a6b7f72e1a27aaddf9593d5a1404a0baf7c705bb2ec21ea2f2bbec7137`
- Source commit: `6e74c9327c44b4121a7ec4803d3acad66ee0f071`; dirty: false
- Workflow: `39543872402`, attempt 1; Bun 1.4.0; Node 22.22.3
- Local download: `dist/candidates/gha-39543872402/` (Git-excluded)

| Hosted OS | Architecture | Node | Python | Installed journey |
|---|---|---|---|---|
| Linux | x64 | 22.22.3 | 3.13.16 | PASS |
| macOS | arm64 | 22.22.3 | 3.13.16 | PASS |
| Windows | x64 | 22.22.3 | 3.13.16 | PASS |

Each smoke installed the frozen archive in an isolated profile/cache, ran doctor, and exercised TypeScript call
declarations plus Python simple assignments with LF and CRLF. Dry-run preserved original bytes, explicit format
matched approved output, recheck passed and a repeated format was byte-identical. These are engine-only journeys;
they do not establish native host hook-event acceptance or full Windows development-suite support.

## Actual local Codex update

The active local Codex was updated through the exact downloaded archive. Its old BoxBox marketplace registration
was removed through the host CLI, then the installer registered the permanent 0.2.2 marketplace and plugin. Codex
reports installed/enabled 0.2.2; the permanent installed engine's doctor succeeds with two approved rules and standalone
formatting. A real installed-engine read-only check of `product/engine/python/profile.ts` succeeds.

The development HUD reads that installed 0.2.2 engine and reports ready configuration, file verification not run,
hook location unknown and host acceptance unverified. A prior fresh Codex session already exercised the unchanged
project status skill; start a new session in this checkout and invoke `$boxbox-status`. This remains an on-request
conversation panel outside the release artifact. Hook trust was not changed.

## Verified chacada handoff

The exact Actions archive, original candidate metadata/checksum and English README were transferred to a new folder:

```text
C:\Users\woo\Downloads\BoxBox\0.2.2\gha-20261021T043246Z
```

Native Windows PowerShell verified all four files, including archive SHA-256 and 126691-byte length, source commit
and clean metadata. Existing version folders were preserved. No candidate execution, remote host installation or
hook-trust change occurred. Full worker output, exact verification script and destination receipts are in the
evidence directory. A local preparation quoting error was corrected before any transfer and is retained there.

## Evidence and remaining boundaries

Original run logs, three native smoke JSON reports, candidate metadata/checksum, and local installation/doctor/HUD
receipts are retained in [the evidence directory](2026-10-21-github-delivery-evidence/). The exact archive is downloaded
from Actions, not rebuilt locally. Remote delivery passed an independent native PowerShell destination hash and size check.

The private repository's current GitHub plan returns HTTP 403 for branch protection. PR checks run, but server-side
required-check enforcement remains unavailable without a plan change. Visibility is unchanged. No registry
publication, tag, GitHub release or automatic hook trust is part of this work.
