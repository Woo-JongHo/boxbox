# Independent audit — final CI documentation and artifact identity

Date: 2026-10-22 KST

## Verdict

**PASS — no mandatory finding.** The docs-only update accurately binds source, CI runs, candidate artifact, cross-OS smoke, local/CI comparison and remaining native-host limits. It does not transfer the local `2b43d24…` native evidence to the byte-distinct CI archive.

## Direct checks

- Git scope is exactly the five declared current docs/records plus the new `ci-final/` evidence directory. No product, test, rule, manifest or release metadata file changed in this update.
- PR run `39635921495` metadata binds success to exact head `35b61780ae122744f39d9cb0b935db5f8bccd14b`; retained raw summaries support 653 pass / 0 fail / 71 files on each OS. The macOS job started only after roughly ten minutes of zero-step queueing, then actually completed tests; docs do not mislabel the old timeout as fixed.
- Candidate run `39637622755` binds the same exact head and records both verification jobs, package, and all three smoke jobs as success. Raw summaries support candidate Verify counts of 653/0/71 on both Ubuntu and macOS.
- Package logs and `candidate.json` bind archive SHA-256 `bec626435e525c2d7324d156f85d2c114427d875725abcecb42fed561b2b92be` to clean source head `35b6178`, workflow run 39637622755 attempt 1. The Actions artifact ZIP digest `66648ab…` is not confused with the inner installer archive digest.
- Ubuntu, macOS and Windows smoke JSON all have `ok=true`, the same `bec626…` digest, doctor success, approved TS/Python LF+CRLF preview/apply/recheck/idempotence, JSON/YAML unapproved candidate preservation, invalid/unsupported structured refusal, and explicit engine-only/native-hook limitations.
- Local/CI comparisons support 40 entries each with only the two embedded host engine `.tgz` members compressed-byte different. Both host copies within each outer archive match; inner file entries match 9/9; decompressed tar bytes and gzip headers match with no tar metadata difference. Docs correctly say payload-content equality within this measurement, not archive byte identity or transferred host evidence.
- SSH evidence binds the exact CI digest to the fresh Windows path via WSL and PowerShell, while explicitly classifying it as delivery/digest verification only. Failed transport attempts remain described without acceptance claims.
- Issue 007 remains `investigating` with non-recurrence separated from cause/fix. Issue 011 remains `verifying`/pending for unauthenticated isolated Claude and Windows Codex native-hook journeys.
- The evidence manifest validates every retained `ci-final/` file. Issue-library validation independently passed 16 records, 2,070 values and 335 existing reference occurrences. `git diff --check` passed.

## Claim limits retained

The update continues to leave public rule/license decisions, publication, Claude native-hook acceptance and authenticated Windows Codex hook acceptance open. CI smoke does not claim plugin registration, native host-event delivery or public release. The future docs-only commit is explicitly distinguished from candidate source `35b6178`.
