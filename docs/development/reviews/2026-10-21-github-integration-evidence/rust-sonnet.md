**Verdict: NEEDS_FIX.** The fixes are low severity and limited to docs and formatting. I found no parser-safety blocker. This is a read-only review of the packet only; I did not run anything or verify test execution.

## Parser safety (`product/engine/common/parse-check.ts`): sound

- **Exit-status handling.** Switching to `--emit stdout` is correct. A formatting-needed file now exits 0 instead of 1, so the legacy `Diff in …` recognizer is no longer needed. Removing `rustfmtDiff` also removes the only path that accepted exit 1 with no diagnostic. Unknown nonzero, signal, timeout and null-status paths (`:74-76`, `:81-83`) still throw, so the write gate stays fail-closed.
- **No stdout spoofing.** `:69` reads `run.stderr` only for rustfmt. Operator precedence (`a ? (b ?? "") : c`) is correct. Formatted source on stdout can no longer match `/^error/u` (for example a line like `error_macro!();`). The new regression at `test/parser-fault.test.ts:81-85` hits that case.
- **No file mutation.** `--emit stdout` does not write files, and the input is a temp file anyway. The stdout text is discarded and never fed back into a write.
- **Existing real-tool tests still hold.** `test/parse-check.test.ts:14` should behave as intended with the new probe:
  - The valid snippet needs reformatting, which is exactly the CI failure, so it now exits 0 with empty stderr.
  - The broken `let a = = 1;` yields a stderr `error:` line with exit 1, so it reports "changed".
  - The whitespace edit reports "ok".
  - The `skipIf(!parserAvailable)` guard still throws under `BOXBOX_REQUIRE_PARSERS=1`, so CI cannot silently skip these.
- **Test timeout change.** 500→2000 ms in the `timeout` case (`test/parser-fault.test.ts:63`) is justified. The `--version` probe uses `min(timeoutMs, 5000)`, so 500 ms could mislabel a slow start as "parser unavailable". `probe-timeout` stays deterministic at 50 ms because the fake spins for 5 s.
- **Python surface test.** Dropping the explicit `corpus` child is coverage-neutral. `readdirSync(dir, { recursive: true })` already includes any `corpus/` subtree, and an absent directory contributes nothing.

Observations that do not block this PR:
- `maxBuffer` is 1 MiB (`:52`). Rust stdout now carries the whole formatted file for every valid input, not just a diff. A Rust file over about 1 MiB now fails closed with "execution failed", which is safe but may be worth one line in the docs.
- Rust diagnostics have no line numbers because they come from `error:` header lines only. This is the same as before the change.
- There is no fake-tool test for the positive branch (stderr `error:` plus exit 1 is recognized). Real rustfmt covers it in CI, but a small `rust-stderr-error` fake mode would make it deterministic across rustfmt message changes. This is optional.

## Findings

1. **Update guidance is stale after the 0.2.2 bump** (`product/installer/README.md:42-53`; same assumption at `docs/development/cicd.md:93`).
   - **Scenario:** The text says Codex rejects the same marketplace name at a different versioned install path. That applies to every version bump, including 0.2.1 → 0.2.2. The heading and the claim are scoped to "from 0.2.0" and "0.2.0 → 0.2.1 … verified with Codex 0.157.1".
   - **Impact:** Someone with the 0.2.1 local candidate hits the rejection with no instructions.
   - **Fix:** Retitle to "Updating a local Codex candidate from an earlier version". Keep the `marketplace remove boxbox-plugins` steps. Say the procedure was verified for 0.2.0 → 0.2.1 only and has not been re-verified for 0.2.2. Likewise reword `cicd.md:93` to say "earlier-version marketplace-source migration" instead of naming only 0.2.0.

2. **A CI status statement is now inaccurate** (`docs/development/cicd.md:97`).
   - **Scenario:** It says "PR #2 is running verification". Run 39539836883 already failed on Ubuntu and macOS, and the fixes are in this change.
   - **Impact:** A reader sees an in-progress state that no longer matches the history.
   - **Fix:** State that the first run failed on the Rust parse probe (and the Ubuntu Python corpus ENOENT). Say it was fixed in 0.2.2 and that a re-run is pending, or point to the evidence directory.

3. **Possible stale `rustfmt --check` references elsewhere** (not shown in the packet).
   - **Scenario:** Docs may still describe the Rust parser probe as `rustfmt --check` or "diff recognition". Candidates are `docs/development/implementation.md`, `release-contract.md`, `status.md`, `SKILL.md` and `references/`.
   - **Fix:** Grep for `rustfmt` and `--check` in those files and update them to "`rustfmt --emit stdout`, diagnostics from stderr".

4. **Column alignment in the touched file** (`parse-check.ts:46`, also `:68-70`).
   - **Scenario:** The `rust` row's `command` cell grew by 9 characters (`"--emit", "stdout"` replaces `"--check"`) but the 20-space padding before `keep:` was not reduced. By my count that pushes `keep` 9 columns right of the other rows. `AGENTS.md` requires running the relevant aligner on touched files.
   - **Fix:** Run `product/engine/typescript/06_align-tables.ts` on this file. Also check whether the new `diagnosticOutput` declaration at `:69` should join the aligned `run`/`output` block or sit apart under the grammar's paragraph rule. This is cosmetic.

## Could not verify (not in the packet)

- `CHANGELOG.md`, `docs/development/status.md`, `release-contract.md`, and the plugin manifests/marketplace diffs for 0.2.2. Please confirm they all say 0.2.2 and that `test/plugin-contract.test.ts` and the sync check pass.
- That `development/README.md`, linked from `README.md:73`, exists.
- Why only Ubuntu hit the missing `test/fixtures/python/corpus`. If it is a gitignored or generated path, grep for other references to it in `test/` and `development/tools/`.
- Preserved main intents look intact from the shown text: MIT `LICENSE`, contribution and rule-proposal intake, and the existing `docs/development/candidates/` directory. The `README.md` and `CONTRIBUTING.md` formatter/gate wording is now consistent with `cicd.md`. The MIT repository versus UNLICENSED installer distinction is stated explicitly at `README.md:115` and `CONTRIBUTING.md:58`.
