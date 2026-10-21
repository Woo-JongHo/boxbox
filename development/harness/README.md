# Release tracking harness

A run harness and evidence DB for continuously developing and tracking release readiness (`docs/development/plan.md` REL0–REL12).
Each run records the git fingerprint, host, preconditions and stage results as one line in `evidence/runs.jsonl`,
and only complete runs atomically replace `evidence/latest.json`. Both are git-tracked so history and evidence can be
reviewed as diffs (M1.7 decision "the DB is git-tracked JSON/JSONL").

The single source of REL status is the REL table in `docs/development/plan.md`. This harness never decides status;
it parses the table and only joins the latest machine evidence (machine evidence kept separate from human verdicts).

## Running

```bash
bun run harness --dry-run           # check only the run plan and preconditions (nothing runs or is recorded)
bun run harness --skip self-align   # quick run (minutes)
bun run harness                     # full run (including self-alignment, minutes to over ten minutes)
bun run harness --with-eval         # including the eval stage (paid model calls — skipped and recorded by default)
bun development/harness/report.ts               # report (human-readable)
bun development/harness/report.ts --json        # report (machine-readable)
```

Flags: `--stages a,b` (partial selection) · `--skip a,b` · `--with-eval` · `--note "…"` · `--dry-run` · `--json`.

## Stages

| id | Runs | Records |
|---|---|---|
| `self-align` | `00_normalize-imports` + `06_align-tables --file` over every repository .ts (`product/engine`, `scripts`, `test`, `harness`) | totals of files, changed, misaligned. A slow stage |
| `check` | `bun run check` | pass, skip, fail, test count |
| `pack` | `build:cli`, `build:node-artifact` + `npm pack --json` | bytes, sha256, file count and version per tarball |
| `artifact-journey` | `public-artifact` and `node-artifact` isolated install tests | pass count, fail count |
| `corpus-gate` | `development/tools/corpus-promote.ts --check` | checked·failures |
| `eval` | `development/tools/eval.ts run` + `grade` | **opt-in** — paid model calls, so recorded as skipped by default |

The verdict principle is the same as in `development/tools/eval.ts`: judge by the output, not the status code — each stage
parses metrics from its output and records them. If one stage fails, the rest still run to the end and everything is recorded,
and the exit code is 0 only for a complete run where everything is ok.

## Preconditions (warming the npm cache)

Because `artifact-journey` uses `npm install --offline`, the npm cache must contain the following. Without them
it fails with ENOTCACHED (the same reproduction condition as the 2026-10-06 release-readiness review):

```bash
npm cache add typescript@7.0.2
npm cache add @typescript/typescript-<platform>-<arch>   # e.g. @typescript/typescript-darwin-arm64
```

Before running, the harness inspects the cache index and records it in `preconditions.npmCache`; when empty, it
leaves the warming command in `limitations`. CI (`verify.yml`) already does this warming in the workflow.

## Schema and storage discipline

- One line of `runs.jsonl` = one run (`schemaVersion` 1). Partial runs are recorded too, with `completion.complete=false`.
- `latest.json` is updated only by complete runs (temporary file + rename). Partial runs stay only in `runs.jsonl`.
- Each line has `git` (branch, sha, dirty, ahead), `host` (platform, bun, node), `preconditions` (npm cache),
  `stages`(id·ok·skipped·exitCode·durationMs·metrics), `artifacts`(bytes·sha256·files·version),
  `completion`, `ok` and `limitations`.
- This harness is not a release artifact — it is unrelated to `product/packages/`, `dist/` and the public artifacts.
