# Candidate pipeline and installed BoxBox HUD

Date: 2026-10-21
Base checkout: `m1-safety-proof`, `34581a76384e91317b3563e475f564a3fb55778c` plus the authorized first-use worktree changes.

## User decisions and scope

The user selected issue forms → PR verification → release candidate generation, and BoxBox status inside Codex.
This implementation adds bug/feature/release forms, a linked-issue PR template, reusable verification, and manual
candidate generation. One delivery archive is checksummed and uploaded; Linux/macOS/Windows smoke jobs consume
that exact digest before extracting or executing it. No workflow publishes a package, tag, or GitHub release.

The development HUD reports the real installed Codex plugin and its permanent engine. Its project skill presents an
on-request conversation panel. Both the tool and skill remain outside release artifacts. The panel preserves the
distinction between configuration readiness, per-file verification, receipt observations and native host acceptance.

## Actual local installation and Codex acceptance

The previously verified `boxbox-plugin-0.2.1.tgz` was installed into the active local Codex with the real npm installer.
Archive SHA-256: `6fc35d7c92f6eeb1b442d6d21901ed6f27c06e9654f412750b4530b638b89b8f`; bytes: 126110.
The filtered host listing reports installed and enabled. The installed launcher runs doctor successfully, loading
two approved convention records with standalone formatting configured. An actual read-only check of
`product/engine/python/profile.ts` reports zero misaligned/refused groups. The first check invocation omitted `--file`;
it returned the expected usage error and was corrected before recording the successful check.

The canonical status skill is `development/skills/boxbox-status/SKILL.md`, with a local Git-excluded discovery symlink
at `.agents/skills/boxbox-status`. A fresh, read-only Codex CLI session invoked `$boxbox-status`, executed the HUD
script and returned the measured installed state in Korean. The existing active session needs restart to discover
newly installed plugins/skills. No hook trust settings were changed. No automatic native host event/output acceptance
is inferred from this test.

## Verification

- Initial combined full check: 489 pass / 5 existing Rust/Kotlin parser skips / 0 fail; 2289 assertions in 57 files.
  TypeScript and development installer shell checks passed.
- After review fixes: 8 focused HUD/candidate tests passed with 34 assertions; TypeScript passed. The HUD regression
  includes a receipt produced by the real hook writer, and checks malformed/unreadable receipt handling.
- actionlint 1.7.12, issue YAML parsing, plugin drift/layout, import/table checks, skill validation and strict plugin
  guard passed. The guard includes official validators, hook contracts and isolated host registration.
- The exact existing archive passed the new Node-only smoke on macOS Node 22.22.3 and native Windows Node 24.12.0 /
  Python 3.14.0. Both TypeScript and Python LF/CRLF examples passed preview preservation, approved apply, parser/approval
  gates, clean recheck and byte idempotence. The frozen smoke script SHA-256 was
  `2093988c272116b9dd3b615e524210baaf4ebf352d7a57264f4f96f4efe9f2d0` on both machines.
- Linux and real GitHub Actions runs remain unexecuted. A local Docker attempt found no running daemon and is not
  counted as Linux verification. Windows smoke does not establish full Windows development-suite support.

## Independent review

Read-only Sonnet 5 (`claude-sonnet-5-5`) passed the initial source snapshot with four low findings. The documentation
command was corrected, directory I/O failures now report incomplete hook observations, a real hook writer/reader
integration test was added, and candidate metadata now explicitly identifies the staging checkout while warning that
local archive build provenance is unverified. CI binds build/source through its clean checkout and same-job order.

The final full check passed: 490 pass / 5 existing parser skips / 0 fail, 2296 assertions across 57 files; TypeScript and shell checks passed. The initial Opus call timed out without a result. The retry (`claude-opus-5-5`) found F1 (session receipt paths), F2 (data environment precedence) and F3 (concurrency wording). All were fixed; the actual final Opus follow-up passed and closed all three. The final focused run passed 8 tests / 37 assertions with TypeScript. These narrow post-baseline changes do not modify the shipped engine. The Opus input misstated the focused assertion count
as 23; the actual count is 34 in `focused-final.log`, which is authoritative. This correction changes no source or
verification outcome.

Full reports, source hashes, commands and original output are in
[`2026-10-21-delivery-hud-evidence/`](2026-10-21-delivery-hud-evidence/). The frozen complete audit packets are retained
in `/tmp/boxbox-delivery-hud-20261021/`.

## GitHub integration and remaining decisions

The self-hosted SSH `origin` remains unchanged. A separate `github` remote points to private
`Woo-JongHo/rowgrid`; its `main` is fetched for comparison. It has ten commits absent from the development branch,
including a MIT LICENSE and earlier preset changes; the development branch has 34 other commits. No existing GitHub
history, license or presets were overwritten. The user explicitly chose to open a PR with the current development structure while preserving GitHub main changes. Integration is underway in the separate `ci/github-candidates` worktree/branch.

The first-use fix (`93b5b4f`), candidate pipeline (`c0d81b3`), Codex HUD (`485f96f`) and audited HUD corrections (`30e3356`) are committed locally. The self-hosted origin has not been pushed; no GitHub PR/default-branch merge or remote setting change has yet been made. The incoming GitHub MIT LICENSE is being retained byte-for-byte as part of the user-selected preservation, with preview installer metadata and CC0 example records unchanged. Manual workflow dispatch becomes available after the workflow reaches
GitHub's default branch. First real Actions execution, required-check protection and native host hook acceptance
remain separate from the local passes above. Repository/product licensing and registry publication remain outside
this candidate-only request.
