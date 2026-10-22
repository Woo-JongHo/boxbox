# Independent design review — REL10 Claude transition repair

Date: 2026-10-22  
Mode: read-only preimplementation review. No installer source, host registration, failed isolated profile, or repository file was changed.

Reviewed:

- `/tmp/boxbox-readiness/rel10-claude-transition-diagnosis.md`
- `product/installer/install.mjs`
- `product/installer/entry.mjs`
- relevant installer artifact tests and the frozen lifecycle verifier
- REL10 lifecycle proposal and the measured macOS Claude commands 043–045 already summarized in the diagnosis

## Verdict

**ITERATE — one mandatory design correction; the Claude identity/update flow is otherwise appropriately bounded.**

The proposed Claude-specific preflight, exact scoped update, post-update identity verification, and fail-closed retention after host mutation directly address the measured defect. The proposed parent/child phase receipt is directionally necessary because the current parent deletes/restores the version directory after any child failure, even when the child may already have repointed host registration. However, a random transaction ID and separate transaction directory are unnecessary for the current ownership model. The exact destination is already a unique, parent-owned version path, and the parent controls its replacement/copy and child spawn.

## Mandatory correction

### M1 — simplify the phase receipt to the exact owned destination

Use one parent-created structured phase file at a fixed private path inside the exact destination, created **after** the parent has prepared/copied that destination and immediately before spawning its child. The parent must overwrite/create it itself for this invocation; it must not accept a pre-existing receipt as authority.

The receipt should bind at least schema version, exact canonical destination, package name/version, host, and phase. Required phases remain:

- `prepared`: parent created the current receipt and no host mutation has begun;
- `host-registration-started`: child atomically records this before the first host CLI mutation;
- `verified`: child records this only after the intended host identity/root/version/engine checks complete, or after engine-only work completes without host mutation.

The parent reads and validates that exact file after child termination:

- Valid `prepared` plus child failure permits existing pre-registration cleanup/restore.
- `host-registration-started`, an invalid/missing receipt, signal, or any state that cannot prove pre-mutation failure must retain the destination and any backup and report partial state with exact paths.
- Exit zero without valid `verified` is failure and must retain uncertain state.
- On verified success, the parent removes its receipt and backup with the existing cleanup-error reporting discipline.

No externally supplied receipt path, random nonce, sibling transaction directory, generalized transaction manager, global rollback, or cross-host atomicity layer is needed. The parent can pass an internal enable/binding flag to the child if useful, but it must set/override it itself and the receipt's authoritative location derives from the destination. This keeps the change specific to the destructive-cleanup decision while still failing closed after possible host mutation.

A same-version repair needs the same rule: the parent first makes its backup, refreshes/copies the owned destination, then creates the current receipt. A stale file from the prior installation or user data cannot authorize cleanup because the parent replaces the receipt for this spawn.

## Claude identity/update assessment

The proposed Claude flow is suitable after the receipt simplification:

1. Machine-readable plugin and marketplace listings plus measured `plugin update --help` are checked before mutation.
2. Existing registrations are accepted only when their exact real paths and package/host/marketplace/version manifests prove they are an owned target or previous BoxBox version under the permanent host/version parent. A same-name foreign, remote, shared, duplicate, or ambiguous-scope record refuses before replacement.
3. Marketplace registration is re-listed and bound to the intended permanent root.
4. Exactly one user-scope BoxBox plugin is re-listed. A stale recorded version invokes only `claude plugin update boxbox@boxbox-plugins --scope user`; fresh and already-correct same-version paths do not update unnecessarily.
5. Final acceptance requires measured agreement among listing identity/version, intended marketplace root, registered plugin manifest, runtime CLI binding, and permanent engine version. Human output and exit zero alone never establish success.
6. Success text is printed only after those checks.

This is the smallest safe product change at the host-adapter boundary. It does not alter Codex's documented manual transition, other plugin registrations, authentication, hook trust, HUD behavior, or public rule approval.

The authorized real `plugin update` probe remains a prerequisite for finalizing what Claude 2.1.286 exposes as its post-update `installPath` and whether the effective registered root is the cache or directory marketplace source. Assertions should encode the measured contract rather than assuming that the cache path must disappear. Until that probe completes, the diagnosis correctly avoids claiming that the old code was effective.

## Historical rollback boundary

The frozen 0.2.3 installer cannot inherit the new identity or receipt behavior. That is not a blocker to implementing the current installer:

- a new-version transition can use the corrected current installer;
- rollback through the historical installer may reproduce stale metadata;
- the lifecycle procedure may then use explicit plugin/marketplace removal and reinstall, with preservation and residue checks, as already permitted by the documented manual path.

Do not rewrite the historical archive or reinterpret its exit zero as verified rollback.

## Required tests and claim limits

Add source/artifact regression tests that exercise behavior through a **stateful fake host CLI** and real child processes. These tests verify installer orchestration; they are not native-host proof.

Required cases:

- fresh Claude install: exact listing/root/version verifies, no update call;
- same-version repair: verifies without an update and preserves an extra user file;
- stale plugin metadata after marketplace repoint: exactly one fully qualified user-scope update is issued, then exact new identity verifies;
- update exits nonzero or exits zero while version/root/manifest/runtime/engine remains stale: installer fails, prints no success, retains destination and any backup because the receipt reached host-mutation phase;
- malformed JSON, duplicate plugin records, wrong scope, foreign/local-unowned/remote/shared marketplace: refuse before mutation where observable;
- pre-registration dependency failure: receipt remains `prepared`; fresh partial destination is removed or prior same-version bytes and sentinel are restored;
- signal, missing/malformed/mismatched receipt, or zero exit without `verified`: retain destination/backup and return partial-state failure;
- forged pre-existing receipt inside the destination: parent replacement prevents it from authorizing cleanup;
- engine-only success: reaches `verified` without host commands;
- multi-host batch: an earlier successful host remains reported as installed if a later host fails.

Tests should assert concrete filesystem bytes, host-state JSON, exact command arguments/order, absence of success output on failure, retained recovery paths, and no mutation of unrelated host records. A fake host can model the measured Claude schemas and state transitions, but test names/results must say “simulated host contract” or “installer orchestration.” Only a retained real Claude CLI run on each claimed OS/version can establish native acceptance.

## Evidence and completion limits

The diagnosis accurately treats 0.2.3 as a historical uncommitted fixture and 0.2.4 as an unpublished candidate. It does not claim old-code execution, automatic or atomic migration, host rollback, or release readiness.

The parent has since copied the frozen macOS Codex PASS, Claude FAIL, all raw logs, diagnosis and reviews into the durable artifact-lifecycle evidence directory. That improves provenance but does not convert the failed Claude transition into a pass. Issue 017 can be linked to those durable paths in a later documentation pass; no issue or repository edit was made by this review.

## Native update probe addendum

The subsequently authorized one-time probe in the retained disposable macOS Claude 2.1.286 cell supports the proposed exact update branch. One command, `claude plugin update boxbox@boxbox-plugins --scope user`, exited zero and changed the machine-readable plugin record from version/cache 0.2.3 to version/cache 0.2.4. The resulting 0.2.4 cache manifest and runtime binding point to the intended permanent 0.2.4 engine; the marketplace remained on the exact 0.2.4 root. All recorded project, approval and user-file hashes matched before and after, the unrelated setting remained, source hashes were unchanged, and the original failed lifecycle report/log hashes remained unchanged.

This closes the earlier uncertainty about the positive macOS 2.1.286 update behavior and justifies invoking one exact scoped update when the post-install plugin record is stale. It does not remove mandatory correction M1, prove failure-path cleanup safety, or substitute for Windows/Linux native execution of the corrected installer. Final design verdict remains **ITERATE — one mandatory correction** until the receipt is simplified as described above.
