# Isolated TypeScript API stage diagnostic

## Result

No failure or sustained hang was captured. The instrumented isolated checkout completed 160 whole-file runs at process parallelism 12. All 160 returned zero; 156 were alive at 15 seconds, five were alive at 30 seconds, none were alive at 60 seconds, and the maximum duration was 32.139 seconds. Green stress does not establish correctness or close the macOS CI timeout.

The instrumentation changes timing: every stage uses synchronous append-only file I/O, and p12 created substantial CPU/process contention. Its 15–32 second durations are not comparable to the earlier uninstrumented p8 median. The five 30-second samples showed active, newly created aligner/TypeScript children and all completed within about two seconds. They are latency under pressure, not stationary failures.

## Isolation and instrumentation

Checkout: `/tmp/boxbox-readiness/ts-stage-checkout`, detached at `9b20c44`. Before editing it was clean. SHA-1 values for `load-source-file.ts`, `06_align-tables.ts`, and the boundary test matched the main worktree.

Only the isolated checkout changed:

- `product/engine/typescript/load-source-file.ts`: PID-tagged stages for API construction, snapshot update, default-project lookup, source/diagnostics retrieval, and `API.close()`.
- `product/engine/typescript/06_align-tables.ts`: PID-tagged CLI start, result, and caught error.

Tracing is enabled only by `BOXBOX_DIAG_TRACE_DIR`, writes PID-specific files synchronously, and leaves stdout untouched. The temporary diff is `instrumentation.diff`; instrumented files are preserved beside it.

## Exact run

```text
cwd=/tmp/boxbox-readiness/ts-stage-checkout
python3 /tmp/boxbox-readiness/ts-stage-diagnostic/run_pressure.py
```

The harness ran:

```text
BOXBOX_DIAG_TRACE_DIR=<per-run-dir> bun test test/typescript-matrix-boundaries.test.ts --timeout 60000
```

It used 12 workers, at most 160 runs, process-tree and macOS `sample` capture at 15, 30, and 60 seconds, and an outer 65-second watchdog. A nonzero exit or watchdog would stop new scheduling.

## 30-second observations

Runs 144–148 were alive at 30 seconds and ended at 30.558–32.139 seconds with 13/13 tests passing. At capture:

- the Bun test parent had elapsed 30 seconds;
- its aligner child had elapsed 0–1 seconds and was processing a late test invocation;
- four samples had a live `tsc --api --async` grandchild elapsed 0–1 seconds;
- every traced child later ended at `cli:result exit=0`;
- no process survived to the 60-second sample.

This shows ordinary forward progress during the long runs. It does not identify whether the CI hang was API initialization, snapshot/project/source work, `API.close()`, or Bun child reaping because that failure did not recur under instrumentation.

## Evidence

- `instrumentation.diff`: complete temporary source diff.
- `run_pressure.py`: bounded p12 harness.
- `pressure-summary.json` and `pressure/results.json`: aggregate and per-run results.
- `pressure/run-*/test.log`: complete Bun test output.
- `pressure/run-*/traces/*.log`: PID-specific stage breadcrumbs.
- `pressure/run-*/{15s,30s}-ps.log` and `*-sample-*.txt`: process trees and samples.
- `smoke-traces/`: filtered-test trace proving the diagnostic seam.

## Conclusion

The safe isolated instrumentation did not reproduce the CI failure and may have changed its timing or probability. The root cause remains unknown. A future CI recurrence should use equivalent breadcrumbs or preserve the failing child before Bun kills it; no timeout increase, retry, or production fix is supported by this run.

Repository retention: this copy includes the report, complete temporary instrumentation diff, harness and aggregate summary. Instrumented source snapshots and full per-child traces remain in the named scratch directory; they are not duplicated in the repository.
