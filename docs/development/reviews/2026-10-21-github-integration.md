# GitHub development-structure integration

The user chose to open a GitHub PR with the current development structure while preserving existing main changes.
Integration occurs in `ci/github-candidates`; the original `m1-safety-proof` checkout remains separate.

GitHub main `4e146bb37edf4a620aef5899afc071926c879230` diverged by ten commits from the development line. The merge
preserves its ancestry. Current canonical `product/`, `development/` and generated `plugin/` implementations replace
obsolete duplicate projections. The original incoming delta and conflict-resolution map are retained in
`2026-10-21-github-integration-evidence/`. Older host/preset proof is historical evidence, not current acceptance.

Preserved content and intent:

- Retain GitHub's MIT LICENSE byte-for-byte. This preserves an existing main file; installer preview metadata remains
  UNLICENSED, the four current synthetic examples retain their separately approved CC0-1.0 metadata, and publication
  remains outside this PR.
- Adapt CONTRIBUTING, CHANGELOG and rule-proposal intake to BoxBox names, current paths, optional formatter behavior
  and the current supported host/Node contract. The new bug form supersedes the old bug-report template.
- Keep the 2026-10-21 approved preset rather than restoring older hashes/license metadata into the active database.
  The merge parents and the original incoming patch preserve the prior records.
- Port `39d3592`'s deterministic parser-probe timeout fixture into the current test path. A synchronous five-second
  spin survives until the configured 50ms probe deadline; the former interval followed by process.exit was racy.
- Preserve the existing Ubuntu/macOS full-check coverage. Linux installs Swift 6.0; macOS checks its runner Swift.
  Required-parser behavior, action pins, least permissions and same-archive three-OS candidate smoke remain intact.
- Keep the current Codex marketplace and BoxBox IDs. One-time retired-name migration tools and duplicate old package,
  rules, docs and plugin outputs remain out of active paths.

The three-way rename merge produced a nested marker in the TypeScript aligner even after stage-2 selection. It was
caught immediately by layout/type checks, restored from the canonical development HEAD, and checked again. That restored baseline had no intentional product change. The first real Actions run then exposed the Rust parser-probe defect described below; its fix is an explicit additional engine change.

Local integrated checks: 490 pass / 5 existing parser skips / 0 fail, 2299 assertions; TypeScript/shell and actionlint passed. Focused checks: 19 pass / 62 assertions. Integration Sonnet 5.5 passed with documentation corrections, now applied. The initial final Opus integration audit required two README corrections (local archive version and optional formatter), now applied; its conditional candidates-directory concern was verified against the tracked directory. [PR #2](https://github.com/Woo-JongHo/rowgrid/pull/2) triggered the [first real Actions verification](https://github.com/Woo-JongHo/rowgrid/actions/runs/39539836883), which failed and is not counted as a pass.


## Real CI failures and 0.2.2 correction

Both hosted OSes exposed the old Rust parser check's dependence on a human-readable rustfmt diff. Rustfmt 1.99.1
returned 1 for formatting differences that the legacy recognizer did not accept. The probe now uses the documented
non-writing `--emit stdout` mode, discards formatted source, and reads Rust diagnostics from stderr only. Missing
tools, signals, timeouts and unexplained nonzero exits still fail closed. An added regression ensures stdout that
begins with `error_macro!()` cannot disguise an unexplained failure. Existing real Rust tests must pass in hosted CI.

Ubuntu also exposed an absent optional `test/fixtures/python/corpus` directory. The fixture test already recursively
traverses `test/fixtures/python`; removing its redundant second traversal preserves coverage of any corpus children
and requires the actual fixture parent. The execution-timeout fake gets a 2-second test deadline to avoid confusing
slow startup with the separately tested 50ms version-probe timeout.

Version 0.2.2 distinguishes the changed engine bundle from the previously tested 0.2.1 archive. The candidate installer
examples now use the actual version placeholder. The exact 0.2.0-to-0.2.1 Windows migration evidence stays historical.
The failed diagnostic Rust installation was cleaned up, including only its exact temporary source lines in shell
profiles; no usable global Rust toolchain was installed.

Local 0.2.2 full check passed: 491 tests / 5 existing Rust/Kotlin parser skips / 0 failures, 2301 assertions; TypeScript
and shell checks passed. Focused parser/surface checks passed 21 tests / 97 assertions. Plugin guard, drift and actionlint
passed. Fresh Sonnet found no parser-safety blocker and required only docs/alignment corrections, now applied; final
Opus follow-up passed (`claude-opus-5-5`) and closed the README, update-guidance and alignment findings. The next hosted run is [39543011360](https://github.com/Woo-JongHo/rowgrid/actions/runs/39543011360).

Branch-protection inspection returned HTTP 403: this private repository's current GitHub plan cannot enforce required
checks. No setting/visibility was changed. The workflow still runs and exposes both PR checks; making them required
needs a plan change or a separately authorized visibility decision.

The final Opus report records a pre-existing, non-blocking development-only Rust limitation: a rustup proxy with a
missing rustfmt component can return a nonzero version probe and repeat an infrastructure `error:` diagnostic.
This PR preserves existing tool probing; tightening version probes needs per-tool semantics (gofmt lacks `--version`)
and remains follow-up work. The public first-release formatting scope is TypeScript/Python. Hosted CI explicitly
installs rustfmt and tests a syntax-changing Rust case rather than treating proxy presence as parser proof.

The Ubuntu-only fixture difference was traced to `test/corpus-promote.test.ts`: its gate fixture creates
`test/fixtures/python/corpus/099-gateprobe-1234abcd`, then removes only that child, leaving the empty parent.
Suite ordering explains why an unconditional second traversal sometimes worked. The new surface test requires
only the tracked fixture parent and recursively sees any actual regular corpus children. No corpus fixture paths
are tracked, and the Python fixture root has no symlinked children.

## Final operational result

PR #2 merged as `6e74c9327c44b4121a7ec4803d3acad66ee0f071` after final run39543306308 passed 496 tests with no skips
on both Ubuntu and macOS. Manual candidate run39543872402 then passed all six jobs, including same-archive
Linux/macOS/Windows smoke. The exact 0.2.2 archive is installed/enabled in local Codex. See the
[delivery record](2026-10-21-github-delivery.md) for the digest, original reports and remaining boundaries.
