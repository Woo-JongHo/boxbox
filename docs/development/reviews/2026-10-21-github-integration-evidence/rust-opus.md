**Verdict: PASS.** This covers the code and docs scope in the packet only. Hosted re-verification of 0.2.2 is still pending and is not counted as a pass. Publication, tags and release are out of scope. This was a read-only review, and I ran nothing.

## Closure of prior findings

| Prior finding | Status | Evidence |
|---|---|---|
| Opus: wrong `0.2.0` archive path | Closed | `README.md:63` uses `<version>`; `:66` explains how to resolve it |
| Opus: formatter described as mandatory | Closed | `README.md:50` says "when one is configured"; `CONTRIBUTING.md:15` says "optional configured formatter"; matches `installer/README.md:84` |
| Opus: candidates directory (conditional) | Closed | You verified the tracked tree `2c71c475…` with four files; `CONTRIBUTING.md:41` points to it |
| Sonnet 1: update heading limited to 0.2.0 | Closed | `installer/README.md:42` covers any earlier version; `:52-53` limits the verified claim to 0.2.0→0.2.1 / Codex 0.157.1 and marks 0.2.1→0.2.2 unmeasured; `cicd.md:92` says "earlier-version" |
| Sonnet 2: "PR #2 is running" | Closed | `cicd.md:97` records the failed first run, the 0.2.2 correction and pending re-verification; review doc `:30` says it is not counted as a pass |
| Sonnet 3: stale `--check` wording | Closed (per your grep) | The review doc `:35-39` describes the new probe correctly |
| Sonnet 4: `rust` row padding | Closed | By my count, `keep:` in `parse-check.ts:46` lands in the same column as the `cpp` (`:44`) and `java` (`:45`) rows. `diagnosticOutput` (`:69-70`) is separated from the `run`/`output` table by a blank line and comment |

License and ancestry: `README.md:115`, `CONTRIBUTING.md:58` and `release-contract.md:51` consistently distinguish the MIT repository LICENSE from the UNLICENSED installer metadata. The `main` ancestry and the empty LICENSE diff are as you stated.

## New CI fixes

**Rust probe (`parse-check.ts:46`, `:70`, `:78-84`): sound.**
- `--emit stdout` is a stable, non-writing rustfmt mode. Formatting-needed input now exits 0, so the human-readable diff dependency that failed on hosted rustfmt is gone.
- Precedence at `:70` is correct (`??` binds tighter than `?:`).
- Formatted stdout, including any filename header rustfmt prints, is discarded and never written back.
- Unknown nonzero, signal, error and null-status paths (`:75-77`, `:82-84`) still throw before any write, so the change is fail-closed.

**Regression test (`parser-fault.test.ts:81-85`): discriminating.**
- Under the old `stdout+stderr` extraction, `error_macro!();` matched `/^error/u` with exit 1. Both sides would yield equal diagnostics, giving `ok`, and the test would fail.
- Under stderr-only extraction it throws "unrecognized status", which is correct.
- `rust-empty` (`:75-79`) still covers exit 1 with no output.

**Real Rust coverage (`parse-check.test.ts:14,19-22`): sufficient for CI.** The valid input needs reformatting, which now exits 0 with empty stderr. The broken input yields a stderr `error:` line with exit 1, so it reports `changed`. `BOXBOX_REQUIRE_PARSERS=1` prevents a silent skip. Whether rustfmt-version messages match is now an empirical question for the hosted run, not a blocker.

**Timeout deadline (`parser-fault.test.ts:63`): justified.** The `--version` probe uses `min(timeoutMs, 5000)` (`parse-check.ts:56`). At 500 ms, a slow Bun startup could be mislabelled "parser unavailable" instead of "execution failed". The probe-timeout case stays at 50 ms against a 5 s synchronous spin (`:34`, `:64`), so it remains deterministic.

**Version 0.2.2: consistent in the files shown.** These are `package.json:3`, `plugin/.codex-plugin/plugin.json:3`, `release-contract.md:30` and the review doc `:46`. `CHANGELOG.md`, `cli.ts` and the Claude manifest/marketplace were not in the packet. I rely on your statement plus `plugin-contract.test.ts` and `sync-product --check` in CI.

## Non-blocking observations

None of these warrant NEEDS_FIX for this PR.

1. **Ubuntu-only ENOENT is still unexplained** (`surface.test.ts:55-58`; review doc `:41-43`).
   - Both CI checkouts are clean, yet only Ubuntu failed. So on macOS (and locally) the path was resolvable by some other means. Likely causes are a case-variant tracked path on a case-insensitive filesystem, or another test creating it before `surface.test.ts` runs, where Linux ordering differs.
   - The fix is coverage-neutral if `corpus/` is a regular directory. Recursive `readdirSync` does not descend into a symlinked directory, so the claim at `:41-43` would be false if it is a symlink.
   - If another test writes there, the Python surface test's input set becomes order-dependent.
   - Suggested check: `git ls-files test/fixtures/python | grep -i corpus` and `grep -rn "fixtures/python/corpus" test development`.

2. **Local check counts in the review doc predate 0.2.2** (review doc `:30`). The "490 pass / 5 skips" figure describes the pre-fix integration. The 0.2.2 section (`:33-49`) records no post-fix local `bun run check` result. If one was run, add its counts and point to the evidence log (`rust-fix-focused-2.log` and so on). If not, say so, so readers do not take 490 as current.

3. **Pre-existing Rust gate gap, unchanged by this PR** (`parse-check.ts:57`, `:78-80`).
   - With a rustup proxy whose toolchain lacks the rustfmt component, `rustfmt --version` exits 1, which is non-null, so `hasTool` returns true.
   - Every run then prints the same stderr line, `error: 'rustfmt' is not installed…`, with exit 1. That is accepted as an identical diagnostic on both sides, so compareParse returns `ok` without any real parse.
   - Hosted CI would catch it, because the broken case would report `ok`. Rust is also outside the public TS/Python scope.
   - It is still worth a follow-up, for example requiring `--version` status 0.

4. **Rust output size.** `MAX_OUTPUT_BYTES` (`:52`) now has to hold the whole formatted file. A Rust file over about 1 MiB fails closed ("execution failed"). This is safe and could be documented later.

5. **Cosmetic, pre-existing.** The fault table (`parser-fault.test.ts:59-67`) has partly unaligned rows (`failure-error`, `probe-timeout`). The edited `timeout` row keeps consistent padding. The aligner reportedly leaves this table alone, so I am not raising it as a finding.

## Before merge (process gates, not findings)

- Hosted `plugin-contract (ubuntu-latest)` and `plugin-contract (macos-latest)` must both pass on the 0.2.2 head, including the real `rust` case in `parse-check.test.ts` under `BOXBOX_REQUIRE_PARSERS=1`.
- Record that run's ID in the review doc and in `cicd.md:97`, replacing "pending".
- 0.2.1→0.2.2 Windows marketplace migration remains unmeasured, as `installer/README.md:53` already states.
