# Codex native hook acceptance

Date: 2026-10-21. Verdict: SessionStart delivered into native response history on both platforms;
macOS PostToolUse/Stop control flow PASS; Windows editing blocked by native sandbox/approval policy.
This does not enable permanent trust in the active user profile or publish a package.

"Accepted" below means the host parsed hook output and acted on it in its model input or control flow.
For SessionStart, only delivery into native response history is established on either platform; model acknowledgment
is not claimed. PostToolUse tool feedback and Stop continuation provide the separate control-flow evidence.

## Frozen scope

The actual Codex CLI 0.163.0 loaded the already installed BoxBox 0.2.2 candidate in a separate CODEX_HOME and a
disposable Python project, using its existing launcher/engine. Native `hooks/list` exposed exactly three
BoxBox plugin handlers and their hashes; all were enabled/untrusted before and after testing.
No remote app tool was invoked.
The evidence filenames `hooks-before-trust.json` and `hooks-after-trust.json` refer to before/after the test runs;
they do not record a persistent trust transition.

The hooks were reviewed against the existing audited candidate and cached hook bytes before using the documented
`--dangerously-bypass-hook-trust` option for those test invocations only. Workspace-write sandboxing stayed enabled.
No broad approval/sandbox bypass or managed-hook workaround was used. The active user config SHA-256 matched its
pre-test digest in post-run integrity checks and later evidence capture; this is endpoint equality, not continuous
monitoring. The temporary credential copy was removed without printing or committing its contents.

## Actual results

| Scenario | Native action and evidence | Outcome |
|---|---|---|
| Default untrusted control | No tools; no BoxBox developer context, receipt or baseline for that thread | SessionStart/Stop skipped; PostToolUse not exercised |
| Misaligned fixture | One native apply_patch; startup developer context, PostToolUse FAIL context/tool feedback, one Stop continuation prompt, two Stop FAIL receipts | Startup delivered; PostToolUse/Stop accepted; bounded completion |
| Explicit recovery | One native apply_patch restores the exact aligned fixture; PostToolUse PASS context and one Stop PASS receipt; no continuation | PASS context delivered; completed |

The failing edit stayed misaligned until the explicit recovery patch; hooks performed no automatic fix. The native
PostToolUse receipt names `apply_patch`, and the code-mode tool promise rejected with that exact receipt's reason.
The Stop result became a real `<hook_prompt>` user continuation. The second Stop completed without another
continuation. In recovery, the host delivered PASS context and completed after its passing Stop invocation.
The non-blocking Stop systemMessage's visual rendering was not separately measured.

The HUD, run against the same test profile and canonical project path, read the actual recovery receipts and showed
recorded/PASS. Its hostAcceptance field remains unverified by design: receipts alone do not attest native delivery.
The independent native transcript proof is kept separately.

An earlier edit attempt used invalid Delete+Add patch syntax. It changed no fixture bytes and is excluded from edit
acceptance. Its model also reported null startup context even though the native rollout contains the delivered
developer message. All conclusions use native transcript/receipt evidence rather than model self-report. The first
profile-setup assumption of exactly one installed plugin failed before any host session; eligibility was subsequently
determined from the actual native hook list.
The initial listing and excluded edit used the `/tmp` alias; valid edit/recovery used its canonical `/private/tmp`
path. The corresponding receipt root hashes differ. Assertions and the HUD use the canonical valid-run directory.

## Native Windows result

On chacada, the existing official Codex CLI 0.157.1 loaded the same 0.2.2 archive in an isolated installation/profile.
Native hooks/list exposed exactly three reviewed BoxBox handlers, enabled/untrusted before and after testing.
The no-tool untrusted control skipped SessionStart/Stop; PostToolUse was not exercised. The reviewed-hook invocation
delivered SessionStart developer context in its native rollout, even though the model's final self-report denied it.

The exact single Update File patch was attempted once and rejected before writing:

> patch rejected: writing is blocked by read-only sandbox; rejected by user approval settings

Although argv requested workspace-write, the native turn_context reported read-only sandbox and approval_policy never.
The added Windows permission provenance binds that context to the qualifying edit thread/turn and original line 8,
with source and line hashes. SessionStart establishes delivery into native response history only; the original
generated summary's broader "accepted" wording is narrowed by interpretation.json while raw output stays unchanged.
The fixture stayed byte-identical. Only a Stop NO_CHANGES receipt was recorded; PostToolUse FAIL, failing Stop
continuation and recovery were not measured. Dependent trials stopped without an approval/sandbox bypass or host upgrade.
Global config hashes remained identical and each temporary credential copy was removed. Persistent hook trust was unchanged.
See [the full Windows report and original evidence](2026-10-21-codex-native-hooks-evidence/windows/report.md).

## Reproduction and boundaries

Original CLI JSONL/stderr, saved prompts/argv, native hooks/list responses, receipts and extracted rollout lines are
in [the evidence directory](2026-10-21-codex-native-hooks-evidence/). Selected rollout lines are preserved byte-for-byte;
provenance records the full private source file's hash and byte count. Session metadata and unrelated instructions
are omitted from committed extracts. Full originals remain in the temporary test profile, without its auth copy.
Exact macOS untrusted-control argv was not saved; its native output and absence of hook context/state establish the
reported observation. Edit/recovery argv and both Windows invocations are recorded. The evidence includes stderr
files, including empty stderr where the command produced none.

These measurements cover the macOS flow and Windows SessionStart with reviewed hooks admitted for one invocation.
Windows editing-dependent events remain blocked. Persistent `/hooks` trust, the current desktop session,
Claude event delivery and registry publication remain separate.
The existing 0.2.2 archive already delivered to chacada is unchanged; no new candidate is needed for this evidence.

Primary contracts: [OpenAI hooks](https://learn.chatgpt.com/docs/hooks) and the installed CLI's help/generated protocol
schema. Current documentation defines Stop.stop_hook_active; the older engine comment claiming Codex lacks it is
stale. The implementation already checks that flag and has a session marker fallback; behavior was not changed.

## Independent review

Read-only Sonnet 5.5 required exact Windows permission provenance and narrower SessionStart wording;
[its fix verification passed](2026-10-21-codex-native-hooks-evidence/sonnet-fixes.md).
Final Opus 5.5 required the same delivery distinction on macOS and durable evidence links/argv limits;
[its final fix verification passed](2026-10-21-codex-native-hooks-evidence/opus-fixes.md).
Original findings and machine output are retained alongside these follow-ups. The plugin guard, product dependency
check, document checks and unchanged candidate/source checks passed. No new package was built or published.
