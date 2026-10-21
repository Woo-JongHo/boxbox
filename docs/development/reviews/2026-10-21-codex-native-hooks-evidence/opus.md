**Verdict: NEEDS_FIX.** There are two narrow fixes, both to authored prose and the evidence manifest. No re-run is needed. The measurement itself holds: macOS shows the full controlled flow, and Windows correctly stays PARTIAL. I found no secrets and no stronger product claim.

**Scope.** I reviewed only the pasted packet. I did not recompute any hashes or byte counts, and I did not open the unpasted full rollouts.

## Necessary findings

**1. macOS SessionStart is still called "accepted" on the same evidence that Windows was narrowed to "delivered".**
- The only macOS evidence for SessionStart is the `hooks.additional_context` developer message at ordinal 9 in the native rollout. That is the same class of evidence as Windows ordinal 8.
- No macOS model output acknowledges it:
  - In `edit-exact`, the final answer never mentions the startup receipt directory.
  - In the excluded `edit` run, the model explicitly returned `session_receipt_directory: null`.
- PostToolUse and Stop are different, and they do support the stronger wording:
  - The host turned PostToolUse output into a rejected tool promise and turned Stop into a `<hook_prompt>` user continuation.
  - The model then quoted both receipt paths verbatim.
- Three places overstate SessionStart:
  - `plan.md`: "sessions accepted SessionStart context".
  - The verdict in `2026-10-21-codex-native-hooks.md`: "host dispatch and model-facing acceptance PASS", applied to the whole flow including SessionStart.
  - The "Misaligned fixture → Accepted" table row in the same report, which bundles startup context into "Accepted".
- **Fix:**
  - Define "accepted" once: the host parsed the hook output and acted on it in the model's input or control flow.
  - State that SessionStart is shown only as delivered into native response history, on both platforms, and that model acknowledgment is not claimed.
  - Apply that wording in `plan.md` and in the main report's verdict and table.

**2. Authored provenance points to evidence that is not in the committed set.**
- `windows/report.md` says the raw exec JSONL/stderr, prompts/argv and the other materials are "under `/tmp/boxbox-native-windows-20261021/evidence/`". That is a transient local path. The durable location is the committed `windows/` directory.
- Both reports cite stderr:
  - The main report says "Original CLI JSONL/stderr … are in the evidence directory".
  - The Windows report says the exact error appears "in both stderr and the original tool-output response item".
- The packet contains no stderr file for either platform. `list-hooks.py` writes `hooks-after.stderr.log`, but it is also absent.
- The main report also claims "exact prompts/argv", but there is no macOS `untrusted.command.json`.
  - The untrusted `jsonl` lacks the bypass-warning items, which does corroborate that the flag was absent.
  - That is inference, not the recorded argv the report promises.
- **Fix:**
  - Point `report.md` at the committed directory.
  - Then either commit the stderr files and the macOS untrusted argv, or restrict both reports to what is present. For the Windows error, the tool-output response item at ordinal 17 already carries the exact text.
  - If these files are in the tree and were only left out of the packet, this finding reduces to the `/tmp` path wording.

## Verified (challenged, holds)

**macOS failing edit**
- One native `tools.apply_patch` call (ordinal 16) produced a `file_change` with status completed.
- The PostToolUse FAIL developer context (ordinal 19) carries the same receipt path as the tool error (ordinal 20).
- The receipt reports `misaligned: 1` and `FIXABLE`, with `automaticFixPerformed: false`.
- There was one `stop:2` hook_prompt (ordinal 26). A second Stop FAIL receipt and the `stop-blocked` marker show bounded completion.
- The report does not claim which mechanism suppressed the second continuation (`stop_hook_active` or the marker). That is correct.

**macOS recovery**
- The recovery baseline is `d9b7fd…`, not `674d4b…`. This independently corroborates `misalignedFixtureObservedBeforeRecovery`.
- PostToolUse PASS was delivered as context, the tool output was `Script completed`, and a Stop PASS receipt followed.
- The HUD's `latest.at` equals the Stop PASS receipt. `hostAcceptance` stays `unverified` and `releaseReady` stays false.

**Handlers and trust**
- On both platforms, the before/after keys and hashes are identical, all untrusted, and only `boxbox@boxbox-plugins` appears.
- `list-hooks.py` asserts this.
- The trust flag matches the installed help: "automation that already vets hook sources".

**Timeline**
- macOS order: untrusted 04:49:34Z, list 04:50:08, edit 04:50:46, edit-exact 04:52:03, recovery 04:52:46, HUD 04:53:48, after-list 04:54:20.
- Windows order: list 04:58:00, untrusted 04:58:31, edit 04:59:28, after-list 05:00:20.
- Every admitted run came after its review listing.

**Windows provenance**
- The turn_context at line 8 (ordinal 7) has the same turn id as ordinals 8, 15 and 17.
- The thread id matches `edit.jsonl` line 1.
- The rollout SHA and byte count (`2be70b1d…`, 82291) agree across provenance, thread-link, `native-case-proof.json` and `verification.json`.
- The fixture is 36 bytes. Recounted as 11 + 12 + 13, that is consistent.

**Windows narrowing**
- `verification.json` still says "accepted", but it is kept as recorded machine output.
- `interpretation.json` and both reports narrow it, citing `limitations[1]`.
- PostToolUse FAIL, failing Stop and recovery are explicitly unmeasured.
- The native refusal was respected: no retry, no bypass, no host upgrade.

**Exclusions**
- The macOS Delete+Add attempt, its null self-report and the first setup failure are preserved but labeled excluded.
- The untrusted controls are correctly limited to "SessionStart/Stop skipped; PostToolUse not exercised".

**Secrets**
- No tokens or auth content appear in the packet.
- The Windows `credential-field-scan` found 0 matches, and the macOS `credentialFieldScan` reports "no matches".
- Every cleanup receipt reports the auth copy removed.

**Baseline and source comment**
- The archive is `611858a6…` / 126691 B, baseline `e8362d2`.
- The stale `stop_hook_active` comment is correctly deferred, with no claim of behavior change.

## Non-blocking

1. **macOS integrity artifacts are thinner than Windows.**
   - Windows records before/after launcher and engine hashes. macOS has a single `cachedHookFileSha256` and only `global-config-before.sha256`, plus booleans.
   - Two macOS statements therefore rest on booleans rather than recorded before/after artifacts: "installed launcher/engine were unchanged" and the unchanged global config.
2. **The integrity check proves fidelity, not completeness.**
   - `extractLinesAreExactOriginalLines` shows the selected lines are exact copies. It does not show that the selection is complete.
   - Counts such as recovery `stopContinuationPrompts: 0` therefore rely on the generator's scan of the full rollout.
3. **Windows Stop dispatch is understated.** Windows Stop dispatch is evidenced by the NO_CHANGES receipt, and the reports understate this, which is acceptable. The cause of the read-only/never fallback despite workspace-write argv is not diagnosed, and the reports correctly do not speculate about it.
4. **Identifiers in the RPC transcripts.**
   - The transcripts contain hostnames, including one that embeds a personal name (`gimdonghyeon-ui-MacBookAir.local`), plus `installationId` values and `C:\Users\woo` paths.
   - These are not secrets and are acceptable under the recorded-evidence rule while the repository stays private.
   - Revisit them before any publication.
5. **No plugin-list artifact.** No plugin-list artifact backs the claim "account-synced remote plugins remained visible". Only the hooks lists show that none contributed handlers.

**Result: NEEDS_FIX.** The two prose and manifest corrections above are needed. After them I expect PASS without new host sessions.
