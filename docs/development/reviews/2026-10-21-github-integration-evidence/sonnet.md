# Sonnet 5.5 review: GitHub main integration (exact changed files)

**Verdict: PASS.** I found nothing that should block opening the draft PR or triggering real verification. Items 1-3 below are worth fixing before the PR leaves draft.

**Limits of this review.** I saw only the post-merge file contents, not diffs. I could not check that paths exist, that action SHAs resolve, or what `release-candidate.yml` and `AGENTS.md` currently say. Those checks are marked "verify" below.

## Fix before ready-for-review (low severity)

1. **Required-check name in `docs/development/cicd.md:7-9, 102`**
   - `verify.yml:17-22` has a two-entry matrix, so the real contexts are `verify / plugin-contract (ubuntu-latest)` and `verify / plugin-contract (macos-latest)`.
   - Via the candidate workflow they become `release-candidate / verify / plugin-contract (…)`.
   - The diagram and prose say `verify / plugin-contract`. The existing "check the exact name first" warning covers the risk, but the doc should name the matrix suffix. Otherwise someone configuring branch protection from the doc alone could block every merge.

2. **`cicd.md:97-100` repo slug and stale tense**
   - The text names the GitHub repo `Woo-JongHo/rowgrid`. `AGENTS.md` forbids reintroducing the author's private or retired project names into shipped files.
   - If `rowgrid` is a retired name, say "the GitHub repository" instead. `docs/` is not in the plugin payload, but the PR may become public.
   - The paragraph also says the files "must be pushed or mirrored … before GitHub can show the forms". That reads oddly now that this PR does exactly that, so reword it to past tense.

3. **`docs/development/reviews/2026-10-21-github-integration.md:31`**
   - It ends with "recorded below when available", but nothing follows. Either append the results (local pass counts, the review verdicts, the Actions run link) or reword the line. A dangling promise in a review artifact tends to stay.
   - Line 18 says "Both GitHub parent commits". Presumably this means "both merge parents".

## Non-blocking observations

- **`CONTRIBUTING.md:56`**
  - The CI-workflow sentence sits under `## License`. Move it to `## Development`, and keep only the MIT / CC0 / UNLICENSED-preview disclosure in the License section.
  - Verify that `docs/development/candidates/` (line 39) exists. `AGENTS.md`'s structure map doesn't list it. "Candidate" also now means two things: a rule candidate here, and a release candidate in `cicd.md` and `CHANGELOG.md:34`.
  - Verify that `check --json` (line 48) is a real flag.

- **`cicd.md:107`**
  - It says the "repository/product license … [is] unresolved", while the MIT `LICENSE` is deliberately retained.
  - Narrowing it would avoid a contradiction: "package license metadata and publication authorization remain unresolved (installer preview is UNLICENSED)". This is wording only, not a new licensing decision.

- **`CHANGELOG.md:14`:** "an permanent" should be "a permanent".

- **`AGENTS.md` vs `CHANGELOG.md:16-20`**
  - `AGENTS.md` still says `presets/recommended/` is "currently empty". The CHANGELOG and integration doc say two approved rules, backed by four CC0 examples, are active.
  - If the preset is populated, `AGENTS.md` is stale. It is outside this diff, so it is a follow-up.

- **`.github/ISSUE_TEMPLATE/rule_proposal.md:5`:** the `rule-proposal` label must exist in the GitHub repo, or the issue is created without it. Create the label when settings are configured. The template content is otherwise consistent with `CONTRIBUTING.md:37-38` and the non-negotiables.

## Workflow (`verify.yml`)

- **Steps and gating**
  - Swift: Linux-only `setup-swift` and the macOS `swift --version` probe are correctly gated by `runner.os`.
  - `kotlinc` is added via `GITHUB_PATH` in a step before `bun run check`, and `setup-java` precedes it. `BOXBOX_REQUIRE_PARSERS=1` is set only on the check step, and the parser-fault tests override it to `0` in their own child env, so there is no leakage.
  - The npm cache seed uses `--prefix` plus a trap cleanup, and warms the default cache that the offline artifact tests need. Its `typescript@7.0.2` matches the `AGENTS.md` note.

- **Concurrency:** the group is prefixed `verify-`, so a call from the candidate workflow cannot collide with the caller's own group. It would only matter if `release-candidate.yml` used the same prefix, so verify that. `cancel-in-progress: true` here is safe only because candidate dispatches queue at the caller level.

- **Kotlin zip (lines 55-57):** it is downloaded without a checksum. That is inconsistent with the "full commit pins" claim in `cicd.md:37`. Adding a SHA-256 check would keep the doc's claim true. This is inherited from main, so it is optional.

- **`sync:plugin -- --check` (line 60):** confirm that Bun forwards `--check` to the script rather than passing a literal `--`. Introduce deliberate drift once and confirm the step fails.

- **Action SHAs:** I can't confirm that the pinned SHAs match the stated tags. The doc says they were resolved via the API on 2026-10-21, so spot-check the `checkout` and `setup-node` pins against their release pages.

## Test (`test/parser-fault.test.ts`)

- **Probe-timeout port (line 34): correct.** The five-second synchronous spin runs only on `--version`, and `timeoutMs: 50` kills it deterministically. Whether the kill lands before or after the script starts, the probe fails and the error is `parser unavailable`. This assumes the probe honors `timeoutMs`, which your focused 19-pass run supports.
- **Alignment (line 64):** the new row `["probe-timeout", "parser unavailable", 50]` is not aligned with its neighbors. The first column is 13 characters wide, as `failure-error` is, but the other rows are padded to 7, and the third column is unpadded. The repo convention is to run the aligner on touched files. The file may already have been misaligned at line 61, but this row adds a second offender.