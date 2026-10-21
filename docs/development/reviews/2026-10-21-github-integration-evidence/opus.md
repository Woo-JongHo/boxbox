# Opus 5.5 audit: GitHub main integration (final, read-only)

**Verdict: NEEDS_FIX (documentation only).** I found no correctness, preservation, or wiring defect in the workflows, the test port, the LICENSE, or the merge narrative. Two user-facing statements in `README.md` are false or contradict the other integrated documents. A third finding depends on whether a path exists. All three are small text fixes and need no code changes.

## Scope and limits

- I reviewed only the post-merge contents supplied above. I had no repository, diff, or network access.
- I did not check:
  - byte identity of `LICENSE` against `4e146bb`
  - merge-parent ancestry
  - the empty product-tree diff
  - action SHA-to-tag mapping
  - path existence
  - the status of PR #2 run 39539836883
- Those claims rest on the recorded local evidence. The PR run is not treated as passed.
- The Sonnet report was used as context only. Its applied corrections are confirmed in the text:
  - `cicd.md:99` names the matrix contexts.
  - `cicd.md:97` no longer has the slug and uses the correct tense.
  - `integration.md:31` gives the results inline.
  - `CONTRIBUTING.md:35` sits under Development.
  - `CHANGELOG.md:15` reads "a permanent".
  - `AGENTS.md:61` and `README.md:100` describe the populated preset.
  - MIT vs UNLICENSED is distinguished in `README.md:115`, `CONTRIBUTING.md:58` and `cicd.md:104`.

## Necessary findings

1. **`README.md:63`: the local install command names the wrong archive.**
   - **Scenario:** a user follows "try a locally built installer" on the current checkout.
   - `pack:installer` emits `boxbox-plugin-<version>.tgz` (`cicd.md:48`), and the product version is 0.2.1 (`release-contract.md:30`; the Windows acceptance is also 0.2.1).
   - The command references `boxbox-plugin-0.2.0.tgz`.
   - **Impact:** `npx` fails on a file that does not exist, on the repository landing page.
   - **Fix:** use `boxbox-plugin-<version>.tgz` and state that the version comes from `package.json`, or write `0.2.1`. A placeholder avoids future drift.

2. **`README.md:50`: the formatter is described as required; every other integrated document says optional.**
   - README says `format` "additionally requires an explicit project formatter … It runs the project formatter".
   - These all say the formatter is optional:
     - `CONTRIBUTING.md:15`: "optional configured formatter"
     - `CHANGELOG.md:21`
     - `release-contract.md:25`: "the optional formatter order"
     - `integration.md:16`, which says contribution docs were adapted to "optional formatter behavior"
   - The native smoke (`cicd.md:82-86`) also runs `init` and then `format` without describing a formatter configuration.
   - **Impact:** a false precondition for the safety pipeline in the primary user document. The integration record implies the other documents were reconciled to product behavior, but the README was not.
   - **Fix:** check the product `format` command and correct whichever side is wrong. If optional is correct (the integration record says so), use wording such as: "runs the project formatter first when one is configured, then verifies parsing, checks rule approvals…". The final sentence about external formatter changes still holds.

3. **`CONTRIBUTING.md:41`: `docs/development/candidates/` (conditional).**
   - This directory appears in neither the `AGENTS.md:75-77` structure map nor `README.md:100`, which says only "Research candidates are kept separately".
   - **Impact if absent:** the rule-intake procedure, one of the preserved main intents, points contributors at a non-existent location.
   - **Fix:** confirm the path. If it does not exist, name the actual candidate location, or describe the step without a path.

## Verified as consistent (no action)

- **`verify.yml` concurrency and gating**
  - Concurrency: inside `workflow_call`, `github.workflow` resolves to the caller, so the group becomes `verify-release-candidate-<ref>`. That is distinct from the caller's `release-candidate-<ref>`, so there is no self-cancel or deadlock.
  - Caller-side `cancel-in-progress: false` serializes dispatches.
  - The Swift steps are mutually exclusive by `runner.os`.
  - `kotlinc` reaches `GITHUB_PATH` before `bun run check`.
  - `BOXBOX_REQUIRE_PARSERS=1` is scoped to the check step.
  - The `--prefix` npm seed warms the default cache with the pinned `typescript@7.0.2`.
- **Required-check names** (`cicd.md:99-102`) match the matrix job, and the doc keeps the "check the observed name first" caution.
- **`parser-fault.test.ts:34,64` port**
  - The shebang execs Bun directly, so the 50 ms kill reaches the spinning process.
  - Whether the kill lands before or during the spin, the probe fails, so the `parser unavailable` expectation is deterministic.
  - No orphan process survives, and the other modes are unchanged.
- **Licensing statements**
  - The MIT root, UNLICENSED preview metadata, and CC0-1.0 examples are described consistently across README, CONTRIBUTING, cicd, release-contract and the integration record.
  - No document claims publication, a registry entry, a tag, a release, or host hook trust.
- **Integration record** (`integration.md:27-29`): it discloses the nested-marker incident and its restoration, and limits the behavior change to the timeout fixture. It agrees with the reported empty product diff.

## Non-blocking observations

- **`integration.md:31`**
  - Replace "Final Opus integration audit is pending" with this verdict once the findings are resolved.
  - Keep the PR run described as running until a conclusion is observed.
  - The `rowgrid` URLs are the factual repository links in a dated review record outside shipped files, so they are acceptable.
- **`release-candidate.yml:72-73`**
  - The Windows smoke relies on `python3` after `setup-python` on `windows-latest`. Hosted Windows Python may expose only `python`.
  - The local native-Windows pass does not prove the hosted runner, and no document claims it does (`cicd.md:117`). The first manual dispatch is the evidence.
- **`parser-fault.test.ts:60-66`**: rows `failure`, `failure-error` and `probe-timeout` are not column-aligned with their neighbours. This is a style convention only (`AGENTS.md:111`) and has no correctness impact.
- **`AGENTS.md:82`**: the structure map lists only `verify.yml`. `release-candidate.yml` and `.github/ISSUE_TEMPLATE/` could be added.
- **`CONTRIBUTING.md:55-58`**: the inbound licence is MIT, while the preset examples are CC0-1.0. Future contributed preset examples would need explicit CC0 consent. That is a later licensing-wording decision, not an integration defect.
- **`release-contract.md:12`**: it does not yet record the Linux WSL smoke of the frozen candidate. This under-claims rather than over-claims.

## Approval statement

After findings 1 and 2 are corrected, and finding 3 is confirmed or corrected, this audit would be PASS for the integration. That PASS would not depend on PR #2's in-progress run, which must still conclude green before its status is claimed. This verdict does not authorize publication, tagging, a registry release, or host hook trust.