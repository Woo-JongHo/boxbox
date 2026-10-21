**Verdict: NEEDS_FIX.** Two narrow fixes, both about exactness. The macOS flow audited earlier is untouched. The bounded Windows claims otherwise hold, and I found no secrets.

I reviewed only the pasted text. I did not recompute hashes or open the unpasted raw rollouts.

## Necessary findings

**1. The read-only/never permission evidence is not tied to the qualifying edit run.**
- `windows/effective-permission-context.json` is a single-entry array with `approval_policy: never` and `sandbox_policy: read-only`. It carries no thread id, turn id, or run label.
- The untrusted control also ran with `--sandbox read-only`, so this entry could belong to that run instead of the edit run (thread `01a15cd4…`, turn `01a15cd4-217c-7bb1-b820-84e65129669d`).
- `edit.selected-rollout.jsonl` does not include the `turn_context` line.
- The report and `docs/development/reviews/2026-10-21-codex-native-hooks.md` both say the edit run's native `turn_context` reported read-only/never "despite workspace-write argv". That claim is the centre of the Windows result, and at present it rests on an unlabeled file.
- The edit run's tool error ("blocked by read-only sandbox") does corroborate read-only for that run. It does not corroborate `approval_policy: never`.
- **Fix:** Add the edit thread and turn id to that file, or preserve the edit run's `turn_context` line verbatim. If neither is possible, limit the claim to the tool error text and drop the `turn_context` attribution.

**2. "Accepted" overstates the Windows SessionStart result.**
- `windows/report.md` says "SessionStart model-facing acceptance PASS", and `verification.json` says "SessionStart accepted".
- What the native `response_item` (ordinal 8) shows is that the host placed the developer message in the model's input history. The model's own final message denied receiving any hook message.
- The user's own scope statement is "delivered". The main review and `status.md` already say "delivered".
- **Fix:** Use "delivered into the native response history" in the report table and the `verification.json` status. Keep "accepted" for the macOS flow, where PostToolUse and Stop feedback came back as tool errors and a continuation prompt.

## Checks that passed

- **Windows result is correctly PARTIAL.**
  - It records one native `apply_patch` attempt, rejected before writing.
  - The fixture is unchanged at 36 bytes, SHA `674d4bff…`, the same hash as the macOS baseline.
  - PostToolUse FAIL, failing Stop continuation, and recovery are explicitly unmeasured.
  - The only Stop receipt is NO_CHANGES with `automaticFixPerformed: false`.
- **Native host refusal was respected.**
  - There was no retry, bypass, or host upgrade.
  - `persistentTrustUsed` and `broadApprovalOrSandboxBypassUsed` are both false.
  - `--dangerously-bypass-hook-trust` was used only after the review gate.
- **Handlers, config and credentials.**
  - The three handler keys and hashes (`e49e…`, `a4b8…`, `9da9…`) are identical before and after, all untrusted.
  - The cached hook, launcher and CLI hashes are unchanged.
  - The global config hash `0d29e520…` is unchanged.
  - Four cleanup files confirm the auth copy was removed.
- **Evidence over self-report.**
  - SessionStart delivery rests on the native rollout, not the Korean self-report that denied it.
  - The untrusted control is correctly limited to "SessionStart/Stop skipped; PostToolUse not exercised".
- **Failed attempts are kept apart from qualifying trials.** The macOS invalid Delete+Add patch, the null self-report, and the first setup assertion failure are excluded in both `verification.json` and the review. The Windows evidence shows no invalid-patch or setup-failure runs to separate.
- **No contradictions in scope.**
  - macOS proves the full controlled flow.
  - HUD `hostAcceptance` is unverified.
  - Persistent trust, Claude events, desktop sessions and registry publication are out of scope in the review, the report and `status.md`.
- **No credentials found.** The evidence has no tokens or auth content. `installationId` values, hostnames (`DESKTOP-WOO`, the MacBook name) and `C:\Users\woo` paths appear in the RPC transcripts. They are identifiers rather than secrets and fall under the "recorded as-is" rule.

## Non-blocking

- The macOS `evidence-integrity.json` includes a `credentialFieldScan`. The Windows folder has no equivalent artifact, so the claim that credentials were not committed is asserted rather than evidenced. A one-line grep result would close that.
