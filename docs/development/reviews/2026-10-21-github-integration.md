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
  Both GitHub parent commits and the original incoming patch preserve the prior records.
- Port `39d3592`'s deterministic parser-probe timeout fixture into the current test path. A synchronous five-second
  spin survives until the configured 50ms probe deadline; the former interval followed by process.exit was racy.
- Preserve the existing Ubuntu/macOS full-check coverage. Linux installs Swift 6.0; macOS checks its runner Swift.
  Required-parser behavior, action pins, least permissions and same-archive three-OS candidate smoke remain intact.
- Keep the current Codex marketplace and BoxBox IDs. One-time retired-name migration tools and duplicate old package,
  rules, docs and plugin outputs remain out of active paths.

The three-way rename merge produced a nested marker in the TypeScript aligner even after stage-2 selection. It was
caught immediately by layout/type checks, restored from the canonical development HEAD, and checked again. No product
engine file is intentionally changed by this integration. The only test behavior change is the incoming timeout fix.

Focused checks, the full suite, cross-provider review and actual PR Actions results are recorded below when available.
