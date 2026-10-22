# Current `2b43` macOS Codex native-hook acceptance

Date: 2026-10-22
Candidate: `boxbox-plugin-0.2.4.tgz`, SHA-256 `2b43d24eabfdde00ae8019b204aabd2cc8d04f1604a8ffd540ec3170606649f0`
Evidence: `/tmp/boxbox-2b43-hooks.cZ5Zei/evidence/`

## Verdict

**PASS for bounded current-candidate macOS Codex native hook delivery and control flow.** This is not a release verdict and does not cover Claude, Windows, desktop, persistent trust, HUD hostAcceptance or publication.

## Binding and admission

The current archive, installed 0.2.4 hook manifest and launcher matched their audited hashes before testing. Native `hooks/list` exposed exactly three BoxBox handlers: SessionStart, PostToolUse and Stop. All were enabled, sourced from the installed 0.2.4 candidate and `untrusted`. No unrelated eligible hook appeared. The same keys, hashes and untrusted states remained after both calls.

Codex ran with the disposable candidate `CODEX_HOME`, workspace-write sandbox and the hook-only `--dangerously-bypass-hook-trust` flag scoped to each invocation. No approvals/sandbox bypass was used. Exactly two model calls ran, both well below six minutes.

## Intentional failure

The project began with the actually aligned approved three-row Python fixture. One native `apply_patch` changed only `alpha       = 1` to `alpha = 1`. Native rollout evidence, not receipts alone, shows:

- SessionStart developer context was inserted into response history;
- PostToolUse FAIL was inserted as developer context and returned as the tool error;
- a real user `<hook_prompt>` carried Stop FAIL once;
- the second Stop FAIL was bounded by the stop marker and recorded without another continuation;
- hooks did not repair the source and every receipt says `automaticFixPerformed: false`.

The failing receipt summaries report one group, one misaligned row and one proposed edit. The model made one `apply_patch`; its preliminary read did not modify source.

## Exact recovery

A second invocation applied the exact inverse patch once. Native rollout evidence shows SessionStart context and PostToolUse PASS developer context. There was no recovery `<hook_prompt>`. The non-blocking Stop PASS is retained as a receipt summary, which is the appropriate evidence for that non-injecting path. Final fixture bytes equal the initial aligned bytes, with identical SHA-256 `02bcd0267d69a76892826327e78e55c70f3fd6960b73ccd6cb7446c48927daf3`.

## Cleanup and one finding

The temporary candidate auth copy was removed; candidate daemon status was not running; the exact owned receipt namespace and two owned native rollouts were removed after sanitized extraction; no scratch-root process remains. Candidate config is mode 0600 and hook states remained untrusted.

Codex nevertheless persisted a normal project-trust table for the disposable fixture during `codex exec`. This was candidate-only, not live-profile state. Cleanup removed exactly that one canonical project block by exact byte replacement and independently verified zero project paths/tables afterward while retaining the other candidate config bytes. Thus persistent state is absent at closure, but the run demonstrates that one-invocation hook bypass does not itself prevent ordinary disposable-project trust persistence.

## Evidence hygiene and claim limits

`native-selected.json` retains only selected SessionStart/PostToolUse/hook-prompt/apply-patch events with session and message IDs omitted. `receipt-summary.json` omits receipt paths and UUIDs. Raw rollout JSONL, reasoning events and raw stderr receipt IDs were removed after extraction. Credential scan found zero private keys, bearer headers, token assignments, JWTs and email addresses. Auth contents and hashes were never retained.

This proves current-candidate Codex host delivery/control flow on this macOS CLI. SessionStart delivery into response history is not a model-acknowledgment claim. Receipt presence alone is not used as proof. Claude native event acceptance remains unverified because no authenticated disposable Claude profile was available.
