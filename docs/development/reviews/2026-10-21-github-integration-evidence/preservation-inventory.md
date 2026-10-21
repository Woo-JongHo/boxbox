# GitHub preservation inventory — 2026-10-21

## Scope and ancestry

- Working tree: `/Users/jonghoPro/woo/00_project/98_BoxBox`.
- Current branch: `m1-safety-proof`, `HEAD` `34581a7`; the worktree is intentionally dirty with the current BoxBox CI/CD/HUD and first-use changes. Do not reset or merge over this state.
- GitHub remote: `https://github.com/Woo-JongHo/rowgrid.git`; self-hosted `origin` remains `woojongho:git/xxx.git`.
- `github/main` merge-base with the current branch: `4ea1cd59d64ff89341b3f966ee866d4589326d98`.
- `github/main` contains 10 commits and 37 commits total; current local history contains 62 commits. The GitHub-only commits are:
  - `6913f91` checkpoint/import of the pre-layout distribution snapshot.
  - `f164eec` REL9 real-host acceptance evidence.
  - `2f91a97` first two approved preset rules and marketplace contract completion.
  - `443a3e5` first preset-approved format journey evidence.
  - `45b29b0` MIT `LICENSE` and Ubuntu/macOS verification matrix.
  - `b7e678c` deterministic parser probe-timeout fix and tracked Codex marketplace file.
  - `39d3592` follow-up probe-timeout fake fix.
  - `10f0767` `CONTRIBUTING.md`, `CHANGELOG.md`, issue templates and status refresh.
  - `43d8fbd` one-pass rename script and REL status refresh.
  - `4e146bb` DATA2 candidate order record.

The development branch already supersedes the old `skills/xxx`, `scripts`, `packaging`, `harness`, `docs/*` and `corpus/*` layout with `product/`, `development/`, `test/fixtures/` and `docs/development/`. The correct integration is a content port in a PR, not a Git merge of `github/main` into the current dirty branch.

## Preserve or port

### Preserve as content, adapted to current layout

1. **Parser probe race fix** (`b7e678c`, `39d3592`): preserve the behavioral change in the current `test/parser-fault.test.ts`. The current test already contains the BoxBox paths and `BOXBOX_REQUIRE_PARSERS`; its fake probe currently uses a keep-alive interval rather than the GitHub commit's synchronous spin. The deterministic timeout intent must remain. Compare the current implementation and CI runner timing before changing it; do not copy the stale `skills/xxx` file.

2. **Codex marketplace registration** (`b7e678c`, `.agents/plugins/marketplace.json`): preserve the current generated `.agents/plugins/marketplace.json` if present. It must point to `./plugin` and use BoxBox IDs after `sync:plugin`; do not restore the old `xxx` values.

3. **Approved preset records** (`2f91a97`): preserve the two approved rules, four synthetic examples and two decision records, but use the current canonical paths `product/rules/presets/recommended/{conventions,examples,decisions}.jsonl` and `product/rules/presets/recommended/docs/public/decisions/*.md`. The current 2026-10-21 records supersede GitHub's 2026-10-08 records. Their lookup keys and example bytes are equivalent, while approval dates, hashes, CC0-only synthetic licensing and narrowed safety checks are newer. Never overwrite current records with GitHub's stale hashes or MIT example metadata.

4. **Issue intake** (`10f0767`): preserve the idea and fields from `bug_report.md` and `rule_proposal.md`, but keep the current untracked BoxBox templates, which add the current product name, acceptance criteria and evidence expectations. Review the generated templates in the PR; do not copy old `xxx` commands.

5. **Contribution/changelog prose** (`10f0767`): port useful policy into current product naming and current commands. The old `CONTRIBUTING.md` points at `skills/xxx/presets`, `xxx check`, `install.sh`, and the old release layout. It cannot be copied unchanged. The current `docs/development/cicd.md` already captures issue → PR → verify → candidate flow; a current-root `CONTRIBUTING.md`/`CHANGELOG.md` may be added only after adapting these paths and the unresolved license/publication policy.

6. **Verification workflow** (`45b29b0`): preserve the intent that CI installs all parser toolchains and runs the full check on Linux and macOS, plus the offline TypeScript cache warm-up and deterministic parser requirement. The current `.github/workflows/verify.yml` is newer: Ubuntu full check with action SHAs, generated-plugin drift check, `BOXBOX_REQUIRE_PARSERS=1`, reusable `workflow_call`, concurrency, permissions, timeout and persisted-credential protection. Do not replace it with the old two-OS YAML without an explicit reason. If macOS full verification is still required, add it deliberately after measuring the current layout.

### Preserve only as historical evidence

- `f164eec` real-host acceptance and `443a3e5` format journey are valuable evidence, but their paths and `xxx@0.2.0`/old host instructions are stale. Keep the historical records where they belong under `docs/development/reviews/` only if they remain truthful; do not present them as current BoxBox release proof.
- `4e146bb` DATA2 candidate order is superseded by current `docs/development/plan.md`, `docs/development/corpus-data.md` and current product rule data. Retain as history if useful; do not reintroduce old `docs/plan.md` or `.xxx` references.
- `43d8fbd` `scripts/rename-product.ts` is a one-time migration tool. Do not restore it to the shipped product/development surface unless there is a current migration requirement.

### License decision blocker

`45b29b0` adds a root MIT `LICENSE`, and the old examples claim MIT. Current user authorization explicitly applies CC0-1.0 only to the four synthetic examples; it does not decide the project-wide/product license. Therefore preserve the license commit as a review candidate, but do not silently add or advertise MIT in the integration PR. The current preset example metadata is the authoritative version and must remain CC0-1.0 for those four examples only.

## Recommended PR integration shape

Create the GitHub PR from the current BoxBox development branch against `rowgrid/main`, with the current dirty work committed as the implementation candidate after the normal review gate. Port the six content categories above in separate commits or clearly separated PR sections: current CI/CD/HUD, issue/PR templates, adapted contribution/release docs, parser-race behavior, marketplace manifest, and historical evidence. Keep GitHub's existing main-only files visible in the PR review so that `LICENSE`, presets, race fixes, issue templates, `CONTRIBUTING`, `CHANGELOG`, status, and marketplace changes are consciously preserved, adapted or deferred.

The PR must run the current `verify` workflow. After merge, manually dispatch `release-candidate` on the selected ref; it should upload one archive plus `SHA256SUMS` and candidate metadata, then smoke that exact archive on Ubuntu, macOS and Windows. This candidate workflow is a review artifact and must not publish npm, push a tag, create a GitHub release, or install into an active host until the separate license/publication decision is made.

## Direct conclusion

The existing GitHub main changes are not disposable, but most are already represented by newer BoxBox changes. Preserve their behavior and evidence selectively; do not merge their old tree wholesale. The only clearly missing high-value behavior to carry forward is the deterministic parser probe-timeout regression and the marketplace/issue intake intent, both of which must be expressed under current `product/` and `development/` paths. The MIT license is a human policy decision and remains unmerged pending that decision.
