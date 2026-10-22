# macOS TypeScript matrix timeout diagnosis

## Scope and result

No repository source or test file was changed. The CI failure is real, but the root cause remains unknown. Local stress did not reproduce the CI failure with the exact input or a single filtered Bun test. One early full-file pressure run produced a 30-second stall without stage capture; 120 subsequent p4 full-file runs and 80 p8 full-file runs completed. Therefore the early stall is a useful nondeterminism signal, but it cannot be asserted to be the same 60-second CI failure.

## CI observation

- Bun 1.4.0 on macOS ran the first two tests in `typescript-matrix-boundaries.test.ts` successfully.
- The third test, `keeps member-boundary comments outside the call-envelope contract`, blocked in its first synchronous child invocation (`--write --json`).
- At 60 seconds Bun reported `killed 1 dangling process`; `Bun.spawnSync` returned `exitCode === null`.
- Later tests in the same file continued and passed.
- The log does not contain child stdout/stderr or a process tree, so it does not distinguish aligner work, TypeScript API initialization, API close, or Bun child reaping.
- Extracted window: `ci-failure-window.log`; full input log: `/tmp/boxbox-readiness/ci-macos-failure.log`.

## Reproduction matrix

| Condition | Runs | Result | Timing |
|---|---:|---|---|
| Exact two-line input, actual CLI, fresh temp dir, async watchdog, p4 | 640 | 0 failures/timeouts | last 400: p50 346ms, p95 431ms, max 506ms |
| Exact filtered Bun test, p4 | 200 | 0 failures/timeouts | p50 568ms, p95 617ms, max 657ms |
| Whole boundary test file, p4, first non-capturing harness | 40 | 1 external 30s timeout | other runs p50 6.75s, p95 7.40s |
| Whole file, p4, stage-capturing harness | 40 | 0 failures/timeouts | 6.9–7.8s |
| Whole file, p4, stage-capturing harness | 80 | 0 failures/timeouts | 6.9–11.6s |
| Whole file, p8, samples at 15/30s, 65s watchdog | 80 | 0 failures/timeouts | median 14.4s, max 20.4s |

The p8 run had 23 processes alive at 15 seconds and none at 30 seconds. Their logs ended with all 13 tests passing. The 15-second process trees showed ordinary forward progress at different tests: a Bun test parent, an aligner child (`--write --json` or `--json`), and sometimes a newly started `tsc --api --async` child with elapsed time 0–1 seconds. These are pressure-induced latency samples, not stationary hangs.

## Hypotheses tested

1. **The exact input deterministically hangs the CLI.** Falsified locally by 640 direct runs.
2. **Bun test's `spawnSync` boundary alone commonly fails.** Not supported by 200 filtered-test runs.
3. **Repeated TypeScript server lifecycle under suite/process pressure exposes a rare liveness race.** Still plausible. The uncaptured 1/40 stall appeared only with the full file at p4, while all captured follow-ups completed.
4. **macOS runner resource pressure causes TypeScript server startup/close or Bun reaping trouble.** Still plausible but unproven. p8 raised normal latency and showed active short-lived aligner/`tsc` children; it did not produce a sustained process.

Upstream issues `oven-sh/bun#39584`, `oven-sh/bun#32067`, and `microsoft/typescript-go#4042` are related leads only. No captured BoxBox process stage has established equivalence.

## Evidence and harnesses

- `repro.ts`: exact CLI input harness.
- `baseline-p4.log`, `repeat200-p4.log`, `repeat400-p4.log`: direct CLI results.
- `test-runner-p4-200.log`: filtered Bun test results.
- `full-file-p4-40.log`: early 1/40 30-second signal; no stage capture.
- `capture_hang.py`, `capture_hang_80.py`, `capture-summary.log`, `capture-summary-80.log`: p4 capture attempts.
- `capture_pressure_p8.py`, `capture-pressure-p8-summary.log`, `captures-p8/`: p8 outputs, process trees, and `sample` reports.

## Next diagnostic seam

A future recurrence needs child-stage breadcrumbs before the enclosing test timeout: child PID/command, timestamps around TypeScript API construction, snapshot/project/source retrieval, `API.close()`, and child exit/reap. The current assertion discards child stdout/stderr when `exitCode` is null, so CI cannot localize the wait. This is a diagnostic improvement proposal, not a timeout increase, retry, or claimed fix.

The repository retains aggregate outputs, reproduction harnesses, and all p8 live-process captures with their matching test logs. Other successful per-run logs remain in the scratch directory; they are not duplicated here. The harnesses contain recorded local paths and must be adapted before use on another machine.
