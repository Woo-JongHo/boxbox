# Release candidate rerun binding review

Scope: read-only source and official-interface review at HEAD 522887d, 2026-10-22. No workflow dispatched, rerun, or repository file changed by this review. Static approval is not hosted execution proof.

## Finding and recommended future fix

The package upload name includes its execution attempt; smoke recomputes that name from the consumer attempt. A smoke-only rerun can therefore seek attempt 2 although its successful producer uploaded attempt 1. GitHub defines run_attempt as increasing with reruns, while run_id remains associated with the workflow run. Missing context properties evaluate to an empty string. [Official contexts reference](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts).

Use the immutable upload result as the dependency contract:

1. Give the existing package upload step `id: upload`.
2. Export `artifact-id: ${{ steps.upload.outputs.artifact-id }}` from the package job alongside its existing sha256.
3. After Node setup and before downloading, require exactly one positive decimal artifact ID via an environment variable (`^[1-9][0-9]*$` and safe integer check). Require the existing independent digest to be 64 lowercase hex characters too. Throw on empty/malformed values; do not skip the download and report success.
4. Set download `artifact-ids: ${{ needs.package.outputs.artifact-id }}`; remove download `name`; set `merge-multiple: true`; retain current destination directory.
5. Retain producer upload name containing its own run_attempt, with overwrite false. Retain per-attempt smoke evidence names. Preserve all three OS matrix entries and existing digest verification.

The pinned upload action exposes artifact-id, distinct from artifact-digest (the Actions ZIP envelope digest). Continue comparing the package archive SHA separately. [Exact pinned upload interface](https://github.com/actions/upload-artifact/blob/ea165f8d65b6e75b540449e92b4886f43607fa02/action.yml).

The pinned download action accepts artifact-ids OR name. Its source treats only a name-selected download as single-artifact; ID selection otherwise nests output under artifact name unless merge-multiple is true. Empty ID input enters the unfiltered download-all branch. It parses numeric IDs permissively, and only warns if some requested IDs are missing. Hence require one strict ID before invoking it. Existing archive SHA verification remains necessary because the action reports envelope digest mismatches as warnings. [Exact pinned download implementation](https://github.com/actions/download-artifact/blob/d3f86a106a0bac45b974a628896c90dbdf5c8093/src/download-artifact.ts), [interface](https://github.com/actions/download-artifact/blob/d3f86a106a0bac45b974a628896c90dbdf5c8093/action.yml).

A job output mapped from a step and read via needs is the documented cross-job mechanism. [Official job outputs](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/pass-job-outputs). Partial reruns skip completed work and rerun downstream dependents. [GitHub partial rerun announcement](https://github.blog/news-insights/product-news/save-time-partial-re-runs-github-actions/). The current official pages read here do not explicitly guarantee persistence of every prior successful output across partial reruns; verify that behavior with an actual bounded rerun before claiming the fix operationally proven. Missing output must fail closed. No fallback to a guessed attempt/name or newest artifact.

## Historical candidate recovery is separate

A new workflow patch cannot retrofit run 39646320662: GitHub reruns preserve original SHA/ref. [Official rerun documentation](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs).

Read-only API observation during this review:

- Artifact 12366659186: boxbox-candidate-39646320662-1, 263989 bytes, expired=false.
- Artifact 12367871883: boxbox-smoke-Linux-39646320662-1.
- Artifact 12368571263: boxbox-smoke-Windows-39646320662-1.

The ZIP envelope size is not installer archive size. Parent-provided exact ebfe archive/native results were not independently rehashed here.

For the old exact archive, either preserve the hosted-macOS cancellation as unresolved infrastructure evidence or run a separately named recovery smoke workflow bound explicitly to original run, artifact ID, archive SHA, and source commit. Cross-run download requires a token and explicit run-id, per the pinned download interface. Checkout the original source for its smoke script; verify archive SHA against the externally supplied original digest and source metadata before execution. Such a recovery provides new evidence about old bytes; it must not rewrite the original cancelled run into success. Do not rebuild and silently treat new archive bytes as the original candidate.

## Existing tests and required verification

`test/release-candidate.test.ts` has four tests for staging archive bytes/source identity, wrong-package refusal, altered archive/metadata refusal, required digest and escaping filename. These do not inspect workflow wiring or simulate reruns.

Small relevant regression coverage should validate actual configured download inputs/job output wiring and execute the pre-download guard against blank, whitespace, zero, negative, comma-separated, trailing-junk, unsafe-integer and valid IDs. Verify the guard precedes the download, merge-multiple is true, all three OS jobs remain, and smoke still receives the independent package SHA. Preserve existing archive tests.

Acceptance additionally requires a real smoke-only rerun of a newly created candidate: same upload artifact ID and archive SHA as the successful producer, no package rebuild, and successful native smoke on the intended OS. A local test cannot prove GitHub control-plane output replay or hosted runner availability.

Verdict: recommended design is suitable with the strict pre-download guard and merge-multiple setting. Historical run recovery and future rerun resilience remain separate evidence tasks.
