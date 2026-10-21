# Review: Codex native hook acceptance (2026-10-21)

**Verdict: PASS.** No necessary fixes. The report's claims are supported by the evidence in the packet. I did not open the repository, so I did not recompute hashes or read the evidence files that were not pasted (CLI JSONL/stderr, prompts/argv, fixture hashes).

## Claims checked against evidence

| Claim | Evidence | Result |
|---|---|---|
| Exactly 3 BoxBox handlers, hashes stable, all `enabled`/`untrusted` before and after | `hooks-before-trust.json` and `hooks-after-trust.json` have identical keys and `currentHash` values (`b02a…`, `a5a0…`, `6000…`), `warnings`/`errors` empty, only `pluginId boxbox@boxbox-plugins` | Supported |
| Failing edit: one native `apply_patch`, PostToolUse FAIL as developer context and tool rejection | `edit-exact` rollout ordinals 16, 19, 20: the code-mode `exec` calls `tools.apply_patch`, the developer message says `PostToolUse: FAIL`, and the output is `Script failed … Script error: [boxbox] PostToolUse: FAIL.` The receipt path (`1792558330085-c2c6…`) is identical in the context message and the error. | Supported |
| Stop became a real user continuation once | Ordinal 26 is `role: user` containing `<hook_prompt hook_run_id="stop:2:…">`. `stopContinuationPrompts: 1` matches, and there is one `hook_prompt` in the extract. | Supported |
| Two FAIL Stop receipts, then completion | `verification.json` lists PostToolUse FAIL, Stop FAIL, Stop FAIL, all with `automaticFixPerformed: false`. The second Stop is evidenced by its receipt only. The report says nothing stronger. | Supported |
| Hooks did not repair the fixture | `hookDidNotRewriteFixture`, `misalignedFixtureObservedBeforeRecovery`, and the patch text, which changes `a      = 1` to `a = 1` | Supported at the level of the summary flags. The fixture hashes are in files I was not shown. |
| Recovery: one patch, PASS context, one Stop PASS, no continuation | Recovery patch is the inverse of the failing one. Ordinal 17 is `PostToolUse: PASS`, output is `Script completed`, `stopContinuationPrompts: 0`, and receipts are PostToolUse PASS then Stop PASS. | Supported |
| HUD `recorded`/PASS, `hostAcceptance: unverified` | `hud.json` matches. The latest Stop receipt timestamp `1792558377823` is 04:52:57.823Z, which equals `hooks.latest.at`. `fileVerification: not-run` and `releaseReady: false` are not over-claimed. | Supported |
| Untrusted control skipped hooks | 0 startup developer messages, 0 tool calls, `receiptDirectory: null`, empty extract. A SessionStart or Stop run would at least create the state directory, because `lifecycle-hook.ts` calls `mkdirSync` before its baseline check. | Supported |
| Stale `stop_hook_active` comment, no product fix needed | `lifecycle-hook.ts` already has `input.stop_hook_active === true \|\| existsSync(stopMarker)`. The comment ("Codex, which has no Claude-style stop_hook_active") is stale as stated. | Supported |
| Limitations are honest | The report states scope (macOS CLI, per-invocation bypass), the invalid Delete+Add attempt, the model's null self-report, and that Stop `systemMessage` rendering was not measured. | Supported |

## Non-blocking observations

None of these change the verdict. They are optional wording or hygiene points.

1. **File names `hooks-before-trust.json` / `hooks-after-trust.json` can mislead.** Both show every handler as `untrusted`, and no persistent trust was granted (`persistedTrustUsed: false`). A reader skimming file names may infer a trust transition. Consider a one-line note in the report: "before/after refers to before/after the test runs, not a trust change."

2. **The untrusted control proves less than "hooks skipped" for PostToolUse.** The control made no tool call, so PostToolUse non-dispatch was never exercised. SessionStart and Stop non-dispatch are evidenced (no developer message, no state directory). The wording "Skipped as expected" is acceptable, but "SessionStart and Stop were skipped; PostToolUse was not exercised" would be exact.

3. **The Stop PASS in recovery and the second Stop FAIL in `edit-exact` are evidenced by receipts only.** They are non-injecting `systemMessage` paths, so no rollout line would exist. This is consistent with the report's text. The report's phrase "host delivered PASS context" correctly applies only to PostToolUse and SessionStart.

4. **The path alias differs between runs.**
   - `hooks-before-trust.json` uses `cwd: /tmp/…`, while the after-listing and later runs use `/private/tmp/…`.
   - The first (invalid) edit's receipt directory hash `164d800c464c6630` differs from the later `5fb646832fdbed35`, which suggests a different `cwd` string for that run.
   - This is harmless, because plugin hook listing is project-independent and the first run is excluded. A short sentence explaining the difference would pre-empt questions, since the report stresses "canonical" paths.

5. **`hud.json` contains `/Users/jonghoPro/.local/share/boxbox/codex/0.2.2/plugin`** as `plugin.source`. The report's "no private user IDs" statement covers the rollout extracts only, which is accurate. If the repo prefers no local home paths in committed evidence, this file is the one place it appears. Recorded evidence is machine output, so under the repo's rule it can stay as recorded. The report also does not claim the HUD's `plugin.state: enabled` came from the test profile; only the receipts did.

6. **Stale source comment.** The report correctly leaves it unchanged under the "no product changes" scope. It would be worth a plan.md follow-up item so the contradiction between the `lifecycle-hook.ts` comment and the current docs does not persist.

## Inference discipline

- The report separates host dispatch and model-facing delivery (transcript) from host acceptance in the HUD (`unverified`).
- It excludes the invalid patch attempt and the model's self-report, and relies on the native rollout plus receipts.
- It does not generalize to persistent `/hooks` trust, the desktop session, Windows, Claude events, or publication.
- Account-synced remote plugins are described as visible but absent from the eligible hook list. I could not confirm that from the packet, because no plugin-list file was included. The `hooks-*.json` files do show only the three BoxBox handlers.

**Result: PASS.** The evidence supports the stated scope and no stronger.
