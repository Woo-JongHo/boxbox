Static review is done. The result is below.

```text
VERDICT: FIX_REQUIRED
FINDINGS:
- [severity: high] product/hud/status.mjs:147 (also :144) — Compact output, which is what Claude's statusLine and the 4-row Codex pane use, prints a bare `session: PASS, 12s ago`. It drops the "file verification: not run" and "host acceptance: unverified" qualifiers that only the full layout carries (:150, :152). The internal `recorded` state is never shown either. On the two primary surfaces, a locator-derived receipt reads as a file or host verdict. test/product-hud.test.ts:185 asserts `session: PASS`, so the test locks this in. Smallest fix: label it as a receipt, e.g. `receipt PASS 12s ago (host unverified)`, or add one more qualifier line. Update the tests that expect the current text.
- [severity: medium] product/hud/status.mjs:79 with product/engine/common/lifecycle-hook.ts:60 — The engine writes one new `<ms>-<uuid>.json` per PostToolUse or Stop and never prunes them. The HUD throws once a directory holds more than 256 entries. A long, healthy session therefore turns the HUD to `unknown` permanently. This is fail-closed, but it will happen in ordinary use. Smallest fix: sort names (the ms prefix is lexically ordered) and validate only the newest few, or have the hook write a bounded `latest.json`. Add a test with 300 valid receipts.
- [severity: medium] product/hud/setup.mjs:45 and :46 — Ownership of `boxbox-codex` is checked only by its two header lines. Edits below the header are still treated as owned. `--disable` deletes them and re-enabling overwrites them. docs/user/hud.md says later user edits are preserved. Smallest fix: store a sha256 of the written launcher, or require the whole file to match the generated form, and otherwise refuse. Add a test that edits the body and then disables.
- [severity: medium] product/hud/setup.mjs:61-63 — `--disable` for Claude throws "not owned" when the statusLine key is already gone, for example after the user removed it manually. The stale `claude-statusline.json` is never cleaned up, so disable is not idempotent. Smallest fix: if `settings.statusLine` is undefined, remove the state file and report success. Keep the refusal for a foreign statusLine.
- [severity: medium] product/hud/codex.mjs:140 and :138 — The code assumes tmux runs multiple shell-command arguments through execvp without a shell. No tmux version is checked. An old tmux would join the arguments into a shell string, which breaks the argv-preservation claim for paths with spaces, quotes or `$()`. Smallest fix: run `tmux -V`, refuse anything below the minimum version that supports direct exec (confirm that version), and mention it in the docs. The tests mock `run`, so no test exercises a real tmux.
- [severity: low] product/hud/codex.mjs:134-143 and :156-171 — (a) Signal handlers are installed only inside `attach`. A SIGINT, SIGTERM or SIGHUP during the synchronous tmux setup skips cleanup. The HUD pane then outlives the main pane and leaks the server until the user kills it. (b) `runPane` has no try/finally. If state parsing or the gate wait throws, the Codex pane dies but the HUD pane and the attached client stay up with no result file. Smallest fix: register the handlers at the start of `launch`, and make `runPane` always write a result and call `kill-server`.
- [severity: low] product/installer/launcher.mjs:39-41 with product/hud/record.mjs:6 — The locator is written after every successful hook, including for users who never ran `--hud` and on Windows. It also creates `…/hud`. The docs present the HUD as opt-in, and docs/user/hud.md does not mention this write. Smallest fix: document it, or only write when `hudData` already exists (setup creates it).
- [severity: low] product/hud/status.mjs:69-70 — The `local` branch accepts `<root>/.boxbox/hooks/<hash>`, which a repository could ship. The CLI cannot reach it today, because only the `pluginData` API argument can supply such a location, and receipts live in host plugin data. It is dead, project-controllable surface. Smallest fix: delete the branch, or test that a pointer can never select it.
- [severity: low] product/hud/status.mjs:57-59, :96 — A missing locator, which the docs call expected, surfaces as `unknown` plus a raw `ENOENT …lstat '<abs path>'` message. Smallest fix: map ENOENT to `not-observed` or `location-unknown` with no raw error.
- [severity: low] product/hud/status.mjs:10 — The sanitizer does not strip U+200B–U+200F, U+2028/2029, U+061C or U+FEFF. Truncation counts code points, not display width, so wide characters can overflow the 4-row pane. Smallest fix: add those ranges. Use a width-aware cut or leave a margin.
- [severity: low] product/hud/status.mjs:60 vs codex.mjs:63 — The Codex HUD pins `realpathSync(root)`. The hook locator keys on the raw `input.cwd` and requires `root === resolve(root)` (record.mjs:9). Where Codex reports a symlinked cwd (for example macOS `/tmp` vs `/private/tmp`), the pointer never matches and the HUD stays `unknown`. This is fail-closed. Document it, or compare against both forms.
- [severity: low] product/hud/setup.mjs:25 — Setup refuses a symlinked config or bin directory. Dotfile-managed `~/.claude` and `~/.local/bin` are common, so `--hud` fails after the plugin is already installed. It is safe but not documented. Add it to the troubleshooting docs.
- [severity: low] product/hud/status.mjs:115-126 — The manifest version is never cross-checked against the engine that `doctor` ran. `BoxBox <manifest version> | engine ready` can pair a manifest from one build with an engine from another. Smallest fix: compare against a version field if `doctor` emits one, otherwise note the limit.
- [severity: low] product/hud/status.mjs:94 — The pointer holds only the newest session per project (record.mjs:20). With two concurrent sessions in one project, the older one shows `session-mismatch` even though its receipts exist. This fails closed and the docs say a locator for another session reports unknown. Add a two-session test to pin the behavior.

Other questions:
- Q1: I found no path escape. Manifests, runtime files, pointers and receipts go through lstat, O_NOFOLLOW and a 256 KiB cap, and pointer paths must have the expected `hooks/<project>/<sha256>` shape. A forged pointer needs write access to the user-owned `hudData` directory, which is the same trust domain as `runtime.json`.
- Q2: Setup shell quoting is sound, and the existing test covers quotes, `$()` and trailing `;`. `tmuxArgument` correctly escapes a trailing `;` (an arg ending in `\;` becomes `\\;`). Codex arguments travel through `state.json`, not tmux argv.
- Q6: Windows and desktop limits are consistent across `entry.mjs:75`, `setup.mjs:36`, `codex.mjs:110` and the docs.
- Q7: The locator stays best-effort. The engine output is inherited before the record call, the record is wrapped in try/catch, and the exit code is untouched.

Tests missing (each could expose a release-blocking behavior):
- Compact render includes the host-unverified and not-run qualifiers.
- More than 256 valid receipts.
- `--disable` after the user edited the launcher body, and after the statusLine key was manually removed.
- Hook locator error paths: unwritable or symlinked `hudData`, non-object stdin JSON, root symlink mismatch. Each must leave stdout and exit code identical.
- Signal arrival before attach.
- A real-tmux argv test for names with spaces, quotes and `$()`.
- Two sessions in one project.

EVIDENCE_LIMITS:
- This is a static read of the listed files. I did not run the tests, tmux, Claude or Codex, and I did not read the full contents of the test files, only the key tests plus the installer-artifact HUD match.
- I cannot confirm that `doctor`, run with cwd set to the project root on every refresh, never executes project-configured formatters. Check this in the engine.
- The minimum tmux version for direct exec of multiple arguments is from memory and unverified.
- How real Codex and Claude populate `cwd`, `session_id`, `PLUGIN_DATA` and statusLine stdin is unknown here. So is the Claude rule that statusLine needs a trusted workspace.
- Historical 0.2.3 native captures do not prove behavior of any later frozen candidate. Nothing here is native acceptance.

REQUIRED_NATIVE_SCENARIOS:
- Frozen candidate, macOS: `--hud` for both hosts. Check that the Claude statusLine shows the qualified receipt and that a second session or another project reports unknown, not PASS.
- A real hook run in Claude and in Codex produces the locator, and the HUD ties it to the correct session or project. Check the realpath and symlink case.
- `boxbox-codex` in real tmux with a project path containing spaces, a quote, `$()` and a trailing `;`. Confirm that argv reaches Codex literally, that the exit code propagates, and that Ctrl-C, SIGHUP, detach and killing the terminal leave no tmux server or temp directory behind.
- `--disable` and repair for both hosts with foreign and user-edited state preserved, then a Claude restart.
- A long session (more than 256 hook receipts) still shows current state.
- Windows: `--hud` is refused, and the plugin and hooks still install and run with no HUD requirement.
```
