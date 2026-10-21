# READINESS1 completion loop

Status: in progress. This record is not a release verdict.

The user authorized a documented autonomous implementation/verification loop across the remaining open-source
plugin requirements and broad pattern management. [The canonical plan](../plan.md#completion-loop--readiness1-2026-10-21)
tracks phase acceptance; [pattern management](../pattern-management.md) owns the target model.

## R0 plan

The [initial plan review](2026-10-21-readiness-loop-evidence/plan-review-result.md) supported the direction and required
concrete ownership, measurable coverage, separate authorization states and bounded repeated-failure investigation.
The plan now specifies nine families, five scenario kinds each, disjoint paths, pre-edit snapshots and explicit
implementation versus approval states. Its retry rule requires reassessment, not artificial blocker declarations.

## R1 implementation and verification

- [Record validators](2026-10-21-readiness-loop-evidence/validators-report.md): unknown-shape/nested validation,
  local-record compatibility and located JSONL failures; 27 focused tests and 26 approval regressions reported passed.
- [Alias infrastructure](2026-10-21-readiness-loop-evidence/alias-report.md): copied-skill resolution/dependencies,
  alias escape checks and user-owned installation preservation; 11 focused tests reported passed. Broad source
  import conversion was subsequently completed; see the later inventory below.
- [Catalog](2026-10-21-readiness-loop-evidence/catalog-report.md): nine families, 45 advisory scenarios; no approvals.
- [Integrated focused run](2026-10-21-readiness-loop-evidence/r1-integrated.log): 21 tests, 153 assertions, zero failures.
  Includes index reconstruction/source preservation and unmanaged DB rejection. [Type check](2026-10-21-readiness-loop-evidence/r1-typecheck-final.log) exited zero.

Initial independent reviews blocked installer ownership and catalog evidence gaps. Remediation added identity-bound
ownership, safe dependency preflight, explicit design-only case evidence and stricter path/index validation.
The [closure review](2026-10-21-readiness-loop-evidence/r1-closure.md) found no mandatory findings;
[installer regression](2026-10-21-readiness-loop-evidence/alias-remediation-tests.log) passed 14 tests and
[catalog regression](2026-10-21-readiness-loop-evidence/catalog-remediation-tests.log) passed eight.
The earlier failures remain in the evidence and issue 009 history. The derived development SQLite index exists under ignored `.boxbox/cache/`;
no runtime or public artifact imports its Bun-only implementation. No comparative performance or crash-durability
claim is made. R2 syntax/policy work and R3 adapter preparation use disjoint source ownership while review runs.

## External prerequisites

[Operations inventory](2026-10-21-readiness-loop-evidence/inventory-operations.md) separates old 0.2.2 cross-platform
artifacts and 0.2.3 HUD captures from the current dirty 0.2.4 candidate. npm publication currently requires valid
authentication (observed E401), a concrete reviewed release and final publication authorization. Existing local/SSH
candidate delivery authorization is preserved. No publication or host trust change occurred in this loop.

## R2/R3 source integration

The static policy experiment executes declaration gap/minimum-row selection from versioned data.
`KIND_AXES` remains descriptive metadata; detector-owned boundaries still determine column edits.
The public Check now reports actual single-input syntax and effective approval facts separately from write verification.
JSON/YAML adapters share the guarded format pipeline; valid unsupported rows remain unchanged and visible.
The integrated adapter/pipeline/config run passed 21 tests. Independent source review is in progress.
New public rules and four example licenses are unapproved proposals; no preset records were promoted.

The compact HUD independent review found ambiguous `session: PASS` reporting plus ownership/retention issues.
HUD remediation is active; historical native captures do not establish current candidate acceptance.

## Integrated discovery and repair

The first whole-suite discovery run reported 624 passes, five existing missing-parser skips and four failures.
Its inputs were being repaired after failures appeared, so it is not a frozen-candidate verdict.
The failures were project-local JSON hook-receipt self-observation, the new YAML notice missing from an installer
archive allowlist, and two public-preset assertions expecting the older validation messages/ordering.
The receipt namespace is now narrowly excluded; user JSON stays visible. The allowlist includes the exact notice.
The preset shape error assertion now expects a located diagnostic, while a numeric unknown version field still
proves the stricter publication allowlist. All affected tests were retained. The frozen rerun passed 629 tests, with five existing missing-parser skips and zero failures; TypeScript and shell checks also passed. See [full output](2026-10-21-readiness-loop-evidence/full-check-final.log).

Source aliases now cover 169 internal module specifiers across 57 files. AST inventory retains one explicit
engine-external rules JSON import and three runtime URL paths. Copied-skill TS/JSON/YAML execution passed.
Three pre-existing Kotlin/Rust/Swift structural alignment refusals remain unchanged and are recorded in the alias report.
These are development-language layout limits, not unsupported mutations that were silently forced.

The latest public syntax review passed after guard/hook tests, UTF-8 validation and visible unsupported diagnostics
were added. Structured source review passed B1–B4; later flow-map exclusion and pre-formatter byte gates have focused
regressions and await final integrated audit. Final human rule/license decisions are still pending.

## Native validation after the first frozen integration pass

The locally built installer had SHA-256 `13e099e00f160f95481a38afeb7ed717bf44afe9aa04ad11e347bcf5e9fc0177`.
Its engine-only archive journey passed. Actual disposable-profile HUD installation then exposed a distinct macOS
entry-point bug: `/tmp` in argv and `/private/tmp` in the module URL differed lexically, causing the HUD entry guard
to skip execution and exit zero. This invalidates a native HUD success claim for that archive. Remediation, a regression
using a symlinked invocation path, and a newly hashed archive are required. This local artifact is not a CI candidate.

## Post-native-fix integration and source audit

The entry guards now compare canonical filesystem paths and safely remain inert for nonexistent import-only argv.
[The remediation](2026-10-21-readiness-loop-evidence/hud-entryguard-remediation.md) passed 24 focused tests. The later
[full check](2026-10-21-readiness-loop-evidence/full-check-post-native-fix.log) passed **632 tests, five existing missing-parser
skips, zero failures**, 3,274 assertions, type checking and shell validation. One subsequent test-only addition covers
Codex disable-before-upgrade and Claude in-place update; its six-test installation suite passed separately. These counts
are not added together as a fictitious full-suite result.

[GLM-5.3 final source review](2026-10-21-readiness-loop-evidence/glm-final-result.md) found no mandatory defect in the
supplied eight-boundary snapshot. It was read-only and did not execute tests. The
[hash check](2026-10-21-readiness-loop-evidence/glm-source-binding-check.json) found all runtime sources unchanged;
only the added installation regression differed. The [supplementary GLM review](2026-10-21-readiness-loop-evidence/glm-closure-result.md)
passed with no mandatory findings. A current-tree TypeScript check also exited zero after that test addition.

The rebuilt local installer is SHA-256 `c18a7da980cfcbd42bd4cfef4c1676b13a9c12759a3d4c9fc2689b0d7af0fb84`.
Its [exact-archive engine-only journey](2026-10-21-readiness-loop-evidence/local-candidate-smoke-post-native-fix.log) passed
installation, doctor, TS/Python approved writes, JSON/YAML checks and missing-approval refusals, invalid syntax and
unsupported-source preservation. Native host acceptance and CI evidence are separate work. The superseded archive
`13e099...0177` is failure evidence, not the current delivery candidate.

The public hygiene scan found no secret signature or development data in runtime archives; its sole generated Python
bytecode finding is excluded by `.gitignore`. Raw audit output is retained. Release metadata licensing remains a
[separate prepared decision](../proposals/2026-10-21-release-license.md), alongside the two proposed structured rules
and four new synthetic example licenses. No pending decision has been treated as approval.
