# Native Windows Codex hook acceptance

Date: 2026-10-21. Verdict: **PARTIAL**. Native SessionStart developer-context delivery passed; the authorized edit and its dependent event scenarios were blocked by the native Windows sandbox/approval policy. This is not a full Windows hook-acceptance pass.

## Frozen scope and actual host

The experiment used the exact delivered BoxBox 0.2.2 GitHub Actions archive at `C:\Users\woo\Downloads\BoxBox\0.2.2\gha-20261021T043246Z\boxbox-plugin-0.2.2.tgz`, SHA-256 `611858a6b7f72e1a27aaddf9593d5a1404a0baf7c705bb2ec21ea2f2bbec7137`.

The actual official OpenAI npm entry in the remote user's installation reported **Codex CLI 0.157.1**. Native Node was v24.12.0 and Python was 3.14.0. Existing host help explicitly supported app-server stdio and `--dangerously-bypass-hook-trust`; native app-server `hooks/list` also worked. No pinned alternative host was required or installed, and no global host upgrade was attempted.

The isolated engine-only installation, Codex profile and disposable project were under:

`C:\Users\woo\Downloads\BoxBox\native-hooks-20261021T045654Z`

No repository source file was edited. The installer ran with `--engine-only`, isolated LOCALAPPDATA/config/cache paths and a separate CODEX_HOME. Plugin registration was subsequently performed only in this test CODEX_HOME against the isolated installation's local marketplace. Global plugin registration, PATH, hook trust and config were not changed.

Official contracts inspected: [OpenAI hooks](https://learn.chatgpt.com/docs/hooks) and the native installed CLI help. The official hooks documentation permits the one-invocation hook-trust option for automation that has already reviewed hook sources. It does not grant an approval/sandbox bypass.

## Review gate before hook admission

Native hooks/list exposed exactly three enabled, non-managed BoxBox handlers, all **untrusted**:

| Event | Reviewed command suffix | Current handler hash |
|---|---|---|
| PostToolUse | Node launcher, hook post; matcher Write/Edit/MultiEdit/apply_patch | sha256:e49eee5e228ea01bccde56d387cb228b698eb54bbc894e156a07385fbdcedf1c |
| SessionStart | Node launcher, hook session | sha256:a4b8495cb5069bd8e42619ae0d2f0e58804054cd3e504d7bb7ad8f0a7b153d92 |
| Stop | Node launcher, hook stop | sha256:9da909b36a8ac67af7f4c6061719816d4a58c2eb5d4c9675e76ee21d63517f81 |

The exact native Windows commands use the absolute reviewed Node executable and the cached plugin's launcher through `$env:PLUGIN_ROOT`; they are preserved in hooks-before-trust.json and hook-review.json. Cached hook bytes and launcher bytes matched the reviewed isolated installation. The engine, cached hook and launcher hashes/byte counts were recorded and rechecked unchanged. No non-BoxBox handler was exposed by the native list. No one-invocation hook admission was used until this review gate passed.

## Native observations

| Scenario | Native evidence | Result |
|---|---|---|
| Untrusted read-only control, no tools | No startup BoxBox developer message, no native tool call, no baseline or receipt, no Stop continuation | Untrusted SessionStart/Stop skipped as expected |
| Reviewed hooks, workspace-write requested | Original response_item contains one BoxBox SessionStart developer context with receipt directory | SessionStart delivered into the native response history |
| Exact single Update File patch | Native apply_patch call attempted once; tool output and stderr reject before writing | BLOCKED by native sandbox/approval policy |
| Completion after rejected patch | One Stop receipt, state NO_CHANGES, automaticFixPerformed false | No edit occurred; FAIL/continuation scenario not exercised |
| Explicit recovery | Not attempted because the fixture never changed and the dependent scenario was blocked | Not measured |

The no-tool control does not exercise PostToolUse and is not evidence of a PostToolUse skip. The reviewed-hook edit used the exact single Update File patch, with no Delete+Add retry, shell command, manual engine call or manual hook invocation.

The precise native error in both stderr and the original tool-output response item was:

> patch rejected: writing is blocked by read-only sandbox; rejected by user approval settings

The recorded argv explicitly requested `--sandbox workspace-write`. The actual native rollout turn_context reported `approval_policy: never` and `sandbox_policy.type: read-only`. Those selected permission fields are preserved in effective-permission-context.json. The added edit-permission-provenance.json and edit-permission-thread-link.json bind them to edit thread 01a15cd4-2127-7e22-9f92-99b80a57fbf7, turn 01a15cd4-217c-7bb1-b820-84e65129669d and original physical line 8 (record ordinal 7), with source and line hashes. No broad approval/sandbox bypass, policy override, managed-hook workaround or alternative host upgrade was attempted after the refusal. The parent agent explicitly confirmed stopping dependent scenarios at this boundary.

The original aligned fixture remained exactly:

~~~python
a      = 1
longer = 22
mid    = 333
~~~

Its length was 36 bytes and its SHA-256 was `674d4bffc3636d08d66c317889e311c6f05d1a6328ccbe911f6003bd08232539` before/after the attempted edit. The hook performed no automatic fix. Native PostToolUse FAIL, Stop FAIL continuation/two receipts, recovery PostToolUse PASS and Stop PASS remain unmeasured on Windows.

The model's final self-report incorrectly said no hook message had been received. The original native rollout contains the startup developer context, so that native transcript, rather than model self-report, establishes SessionStart delivery into the native response history. The nonblocking Stop systemMessage's visual rendering was not separately verified.

## Evidence provenance

Full raw native exec JSONL/stderr, final messages, exact prompts/argv, native hooks/list RPC JSONL, before/after lists, source hashes, fixture byte snapshots and the original Stop receipt are in [this committed evidence directory](.). Local transport helpers and their raw transport output remain separately in the private `/tmp/boxbox-native-windows-20261021/` scratch directory.

Selected rollout files contain exact original response_item lines for native tool calls/results and BoxBox messages. Session metadata and unrelated instructions were omitted from the extracted evidence; full native rollout originals remain in the remote disposable profile. Their identities are recorded in native-case-proof.json and verification.json:

| Case | Full native rollout bytes | Full native rollout SHA-256 |
|---|---:|---|
| Untrusted | 73053 | 42073214112a414103efb347a090a507e8e69431507ea70a838d0677be66bbe2 |
| Edit | 82291 | 2be70b1de343ea3002120d2ea52cc423f7e21ff85d432f603b0b894caf146100 |

The final verification asserts exactly three unchanged handler keys/hashes, all still untrusted after the one-invocation test; stable cached source hashes; byte-identical fixture; and unchanged global config.

Global config SHA-256 before and after: `0d29e520750479a93b6108671d5e9a7e88cf4655be63e98bdba8e17439d24990`.

The test credential file was copied only into the isolated profile when needed and removed in each helper's finally cleanup. The cleanup receipts confirm removal after both native app-server listings and both sessions. Credentials were not printed, collected into local evidence or committed. The global credential source was not edited.

The original generated verification.json uses "accepted" as shorthand for SessionStart. The corrected interpretation
is delivery into native response history only; it does not establish model acknowledgment or the Windows edit/event chain.
See interpretation.json. Original machine output is retained unchanged.

## Final boundary

This experiment establishes native Windows Codex CLI 0.157.1 startup hook delivery for reviewed hooks admitted for one invocation. It does not establish the requested edit/FAIL/Stop/recovery chain, persistent trust in the remote current user profile, desktop-session acceptance, a global installation change or registry publication. macOS's completed control-flow scenario is a separate measurement.
