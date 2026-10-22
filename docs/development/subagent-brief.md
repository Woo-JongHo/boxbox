# Subagent brief template

Parallel workers do not share context, so the spawning agent writes the briefing once instead of every worker
re-deriving it from `plan.md` and `status.md`. Copy the block below, fill every `<…>` field and delete lines that do
not apply. A field you cannot fill means the task is not ready to delegate.

```text
Task: <one sentence — the outcome, not the activity>
Why: <one or two sentences of context the worker cannot infer from the code>

Owned paths (you may edit): <path or glob, …>
Excluded paths (do not edit): <path or glob, …>
Back up before editing: save the target's current bytes under /tmp/boxbox-readiness/ and patch the live
worktree. Never stash, reset or checkout over user changes.

Read first (only these): <file:line-range, …>
Do NOT read plan.md, status.md or design.md in full. Active-phase facts you need:
- <fact 1>
- <fact 2>
- <fact 3>

Rules that apply:
- <rule, e.g. Align changes approved horizontal whitespace only>
- <rule, e.g. no new approval data; proposals stay labeled>

Acceptance (all must pass):
1. <command> → <expected result>
2. <command> → <expected result>
Run each only after the files it covers changed. If a check fails three times for the same cause, stop and report.

Output (keep it short):
- Changed paths
- Commands run, pass/fail
- Open questions or blockers
- Evidence path if you wrote logs (do not paste logs)
```

Notes:

- The "Active-phase facts" lines (three to five) are what keeps a worker from opening `plan.md`.
- Write acceptance as concrete commands, for example `bun test test/structured-align.test.ts → 0 fail`.
