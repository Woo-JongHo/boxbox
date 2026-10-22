# Addendum — staged whitespace-check scope correction

Date: 2026-10-22 KST

This addendum corrects one verification-scope statement in `/tmp/boxbox-readiness/final-ci-independent-review.md`. The original review is preserved verbatim.

## Finding

The earlier statement that `git diff --check` passed applied before the then-untracked `ci-final/` evidence files were included in the staged diff. After all final evidence was staged, `git diff --cached --check` exited 2 and reported 31 trailing-whitespace lines, all and only at:

`docs/development/reviews/2026-10-22-continuation-evidence/ci-final/candidate-package-smoke-summary.txt:95-125`

Those lines are the retained Windows GitHub Actions raw excerpt with CRLF bytes. Repository policy says recorded evidence is kept as recorded, so this is an intentional raw-evidence exception and must not be normalized merely to satisfy a whitespace check.

An independent staged check excluding exactly that one raw evidence file exited 0:

```sh
git diff --cached --check -- . \
  ':(exclude)docs/development/reviews/2026-10-22-continuation-evidence/ci-final/candidate-package-smoke-summary.txt'
```

No other staged path produced a whitespace violation. This correction narrows the earlier verification claim; it does not change the audit's substantive PASS on CI identity, counts, smoke scope, archive comparison, SSH proof or authentication limits.

Raw checks:

- `/tmp/boxbox-readiness/final-ci-staged-diff-check.log`
- `/tmp/boxbox-readiness/final-ci-staged-excluding-raw-check.log`

## Revised verdict

**PASS with one documented raw-evidence whitespace exception; mandatory findings: 0.**
