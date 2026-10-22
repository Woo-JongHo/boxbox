# Readiness continuation — native authoring and remaining matrix coverage

Date: 2026-10-22. Parent task: READINESS1. This is a continuing implementation record, not a release verdict.

## Current findings

The exact installer archive `c18a7da980cfcbd42bd4cfef4c1676b13a9c12759a3d4c9fc2689b0d7af0fb84` ran authenticated
native Codex Write and structural Refactor using its installed skill and launcher. Guide preceded authoring in both
workflows. Independent verification checked file scope, AST structure and 180 input combinations per final function.
However, valid syntax and correct behavior did not provide matrix coverage: both final files had zero detected groups
and public Align refused. The middle `max(0, subtotal - discount)` call broke the existing exact-signature assignment
run. [Issue 015](../issue-library/records/BBX-20261022-015-python-assignment-envelope.json) tracks the implementation
under the [bounded outer-column plan](../proposals/2026-10-22-python-assignment-envelope.md).

The [native evidence review](2026-10-22-continuation-evidence/native/independent-review.md) links retained exact fixture
bytes, selected tool events, final engine JSON and independent behavior results. Claude HUD ready/error/recovery has
retained raw screen evidence. A supplemental independent review verified the rerun Codex companion
ready/error/recovery raw captures, exact candidate digest and owned-resource cleanup. The narrow pane truncates the
end of its qualifier text; it does not independently expose every qualifier or prove host acceptance. The interactive upper pane initially displayed sign-in. Later retained diagnosis tied that state to an already-running
candidate daemon; restarting it with the same environment reached the authenticated folder-access prompt. The prompt
was not accepted in that diagnostic run, so this does not establish a fully ready interactive session. Direct authenticated
execution and interactive readiness remain distinct observations. That c18 HUD/interactive evidence did not verify native hook acceptance.

## Approval scope

The recommended preset remains two conventions, four previously approved CC0 examples and two decisions. Reviewed
[TypeScript proposals](../proposals/2026-10-22-typescript-matrix-rules.md) cover the bounded return-guard key and the exact
two-row `Array.from` / `rows.filter` member-call key. Their public refusal is expected until separate rule and snippet
license decisions are received. [Issue 014](../issue-library/records/BBX-20261022-014-preset-coverage.json) keeps this gap
visible. Earlier JSON/YAML rule and snippet-license questions, and release metadata licensing, also remain pending.
No new approval or license has been inferred from test success.

## CI and timeout diagnosis

At committed head `9b20c44`, [PR verification run 39625594819](https://github.com/Woo-JongHo/rowgrid/actions/runs/39625594819)
passed Linux with 638 tests and 3,290 assertions. macOS never acquired a hosted runner and executed no test steps.
The unchanged candidate retry also failed to acquire a macOS runner. These outcomes do not repair or reproduce the
prior macOS 60-second child-process timeout at source commit `3811e34`; candidate packaging and three-OS smoke remain
gated. Retained [current-head metadata](2026-10-22-continuation-evidence/ci-current-head.json) and
[Linux summary](2026-10-22-continuation-evidence/ci-current-ubuntu-test-summary.txt) record the terminal results.

An isolated instrumented checkout completed 160 whole-file stress runs at concurrency 12. Five observations reached
30 seconds while children continued to make progress; none captured a stationary 60-second process. Synchronous
instrumentation can affect timing, so this is not evidence that the original defect is fixed. Main runtime source and
deadlines were not changed by that experiment. See [the diagnostic report](2026-10-22-continuation-evidence/ts-stage-diagnostic/report.md)
and [issue 007](../issue-library/records/BBX-20261021-007-validation-timeout.json).

The later frozen source head `35b61780ae122744f39d9cb0b935db5f8bccd14b` completed both current pipelines.
[PR run 39635921495](https://github.com/Woo-JongHo/rowgrid/actions/runs/39635921495) passed Ubuntu and macOS with
653 tests and zero failures on each. [Candidate run 39637622755](https://github.com/Woo-JongHo/rowgrid/actions/runs/39637622755)
verified the same source, built one archive with SHA-256
`bec626435e525c2d7324d156f85d2c114427d875725abcecb42fed561b2b92be`, and passed engine-only smoke with that
downloaded archive on Ubuntu, macOS and Windows. The smoke covered doctor, approved TypeScript/Python LF and CRLF
preview/apply/recheck/idempotence, JSON/YAML candidate detection and refusal/preservation boundaries. It did not run
host registration or native hook events. These macOS passes did not reproduce the old timeout, but they do not identify
its cause or prove a fix; issue 007 remains investigating. The [terminal metadata and smoke outputs](2026-10-22-continuation-evidence/ci-final/)
retain the exact scope.

The CI archive and local `2b43d24…` archive have different compressed SHA-256 identities. Comparison found only the
two embedded host-package gzip streams byte-different; their decompressed tar bytes and all file contents are equal.
This content comparison does not transfer local native host or hook evidence to the CI archive. The candidate is bound
to source `35b6178`; the subsequent documentation-only commit records these results and is not the candidate source.

The exact CI archive and its safe manifest/smoke records were delivered to the new Windows directory
`C:\Users\woo\Downloads\BoxBox\0.2.4\ci-39637622755-1-bec62643`. WSL `sha256sum -c` and native PowerShell
both verified SHA-256 `bec626435e525c2d7324d156f85d2c114427d875725abcecb42fed561b2b92be`. This was delivery and
digest verification only: it did not reinstall the candidate, change live profiles, or add Windows native-host evidence.
The retained transport record preserves an abandoned non-completing scp attempt and a premature verification failure
before the successful tar-over-SSH delivery; neither failed attempt supports an acceptance claim.

## Work in progress and artifact boundary

The new Python projection has a distinct exact rule key and no inherited approval. The earlier 632-pass local
integration result and GLM source audit apply to the previous source snapshot, and the delivered `c18a7da9…` archive
does not contain it. The later local `2b43d24…` archive now has current-source and independent installed-artifact
evidence; it is not a CI-produced artifact and does not authorize the proposed rule.

## Python source verification follow-up

The implementation is now frozen. The exact retained native `quote.py` bytes and 180 input combinations are pinned
in the regression, after an independent review found the initial similar fixture/54-case coverage insufficient.
The first full run failed an obsolete corpus-signature expectation and npm extraction with `ENOSPC`. The expectation
now verifies both the new outer identity and preserved detailed arity identities. Seven completed task-owned logs were
losslessly compressed, with decompressed SHA-256 equality checked before removing redundant originals; no unrelated
user data or caches were removed. [Issue 016](../issue-library/records/BBX-20261022-016-validation-disk-space.json) records
the environmental failure and recovery separately from the unresolved earlier CI timeout.

The [final full check](2026-10-22-continuation-evidence/python-envelope/full-check-final.log) passed **648 tests**, with
five existing Rust/Kotlin parser skips, zero failures, and successful TypeScript/shell checks. Sonnet could not execute
because of its provider session limit; no Sonnet verdict is claimed. Independent Codex source review and exact-fixture
closure passed. Fresh local installed-candidate verification and its cleanup closure passed; the scoped GLM source review subsequently passed. The rebuilt local installer
SHA-256 is `2b43d24eabfdde00ae8019b204aabd2cc8d04f1604a8ffd540ec3170606649f0`; this is not a CI-produced artifact
or a public release. The new [Python rule proposal](../proposals/2026-10-22-python-calculation-rule.md) and its two new
example-license decisions remain pending.

The subsequent actual whole-file `06_align-tables.ts` check found six old unaligned declaration pairs in the touched
Python test file that the worker's changed-range census had not covered. Applying 18 horizontal edits preserved all
tokens, fixture strings, indentation and physical lines; the actual second check reported zero misalignment. The
[layout closure](2026-10-22-continuation-evidence/python-envelope/python-envelope-layout-closure.md) records the final
test hash, 39 focused passing tests and TypeScript success. Runtime hashes and the rebuilt archive remain unchanged.
The 648-test full result precedes this verified whitespace-only test cleanup; it is not presented as a third full run.

## Local `2b43` installed-artifact follow-up

The [independent artifact audit](2026-10-22-continuation-evidence/python-envelope/native-2b43/independent-review.md)
binds the local archive to SHA-256 `2b43d24eabfdde00ae8019b204aabd2cc8d04f1604a8ffd540ec3170606649f0`.
It verified doctor, the new Python key as unknown with Guide empty and both Align modes refusing without writes, and
the existing approved Python/TypeScript preview/apply/recheck/second-pass journeys. An independent retained check
matched the quote implementation against its reference on 180 inputs.

The Codex upper pane reached the authenticated normal prompt for the disposable project. Folder trust was limited to
that fixture and the hook-review choice explicitly continued without trusting hooks. The companion remained qualified
as project history/unknown/file-not-run. Claude's installed statusLine showed ready → malformed-config not-ready →
ready and retained unknown/file-not-run/host-unverified. These results do not prove native hook delivery or receipt
acceptance.

The first independent audit found that the disposable project trust table remained in the isolated candidate config,
contradicting the initial cleanup sentence. The exact table was subsequently removed; independent closure verified
zero project tables, mode 0600 with unrelated candidate settings preserved, no temporary candidate auth file and no
candidate-root process. The finding and correction history are both retained. This closes local cleanup only. The scoped GLM source review passed; SSH/native Windows verification subsequently passed independent review. At that local-cleanup stage, same-archive CI/OS remained open; the final CI section above records its later engine-only closure on the distinct source-`35b6178` CI archive.

## Final scoped GLM source verdict

[GLM-5.3 returned PASS](2026-10-22-continuation-evidence/python-envelope/python-review-glm-final-report.md) with no mandatory findings for the complete shared table engine, complete Python assignment-envelope detector and registration excerpt. The final packet omitted the detailed legacy Python profile, registry and tests; GLM did not execute tests or recompute hashes. Independent Codex review and the measured tests remain separate evidence. Runtime hashes match commit `1152779`. Two earlier JSON transports produced no verdict; the bounded text-mode attempt completed successfully. No new public rule or example-license approval follows from this review.

## Exact-archive Windows delivery

The same `2b43d24e…` local development archive was delivered to `C:\Users\woo\Downloads\BoxBox\0.2.4\python-native-2b43d24e-20261022T0115KST`. [Independent Windows review](2026-10-22-continuation-evidence/python-envelope/windows-2b43/independent-review.md) verified WSL/PowerShell/post-run digests, native installation/doctor, the unknown calculation key and no-write refusal, approved TypeScript/Python preview/apply/recheck/idempotence and 180-input behavior. The remote README records runtime source commit `1152779`, the local frozen-worktree build and the scoped GLM result. This is not a CI artifact, public release or Windows hook/HUD acceptance. Isolation is demonstrated by environment and command scope; a complete external before/after filesystem snapshot was not taken.

## Current macOS Codex native hook closure

[Independent retained-evidence review](2026-10-22-continuation-evidence/python-envelope/codex-hooks-2b43/independent-review.md) passed the corrected two-call native scenario on the same `2b43` archive. Native metadata proves SessionStart context, one failing file change with PostToolUse FAIL/tool rejection, exactly one Stop continuation, the second Stop receipt before task completion, and an inverse recovery patch with PASS and no continuation. Final bytes equal the starting fixture. Hooks remained untrusted outside the scoped invocations, and owned auth/project trust/receipts/processes were cleaned.

The initial evidence was incomplete: its inventory drifted, streamed patch fragments were ambiguous, and Stop order was insufficient. The corrected run retained lifecycle/time metadata; a further raw-path mapping error was repaired by byte-identical copies of existing original receipts. Both INCOMPLETE reviews and the final closure remain in history. No raw reasoning, credentials or session identities were committed. This verifies current macOS Codex hook delivery/control flow only; Claude/current Windows native hooks, desktop behavior, HUD hostAcceptance and release completion remain separate.

## Final staged whitespace check

The complete staged diff reports whitespace in recorded terminal captures, Windows CRLF output, failed-test excerpts and the retained instrumentation diff. These evidence bytes remain unchanged under the repository recorded-evidence contract. The scoped check excluding that evidence directory passed for authored source/documentation; no claim is made that the full raw-evidence diff is whitespace-clean.
