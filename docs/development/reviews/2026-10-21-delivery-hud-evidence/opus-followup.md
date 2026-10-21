# Final read-only follow-up: delivery HUD (F1/F2/F3)

**Verdict: PASS**

Scope: static review of the sources quoted in the request. I did not run any tools or tests. The test counts (8 tests, 37 assertions, tsc, the earlier 490-pass full check) are as reported and were not reproduced by me.

## Closure status

**F1: session receipt directory. Closed.**
- The writer (`product/engine/common/lifecycle-hook.ts:21`) writes to `<data>/hooks/<sha256(root)[0:16]>/<sha256(session_id)>`. Line 41 reports that exact path in SessionStart `additionalContext`.
- `development/tools/hud.mjs:25-28` treats a path as a session directory only when all of these hold:
  - the grandparent is named `hooks`
  - the parent is 16 lowercase hex characters
  - the leaf is 64 lowercase hex characters
- Those widths match the writer's key widths. `resolve()` removes a trailing slash.
- A different project key returns `location-mismatch` (`hud.mjs:29`) before any directory is read.
- A matching key maps back to the data root (`hud.mjs:31`). The scan then uses the same `hooks/<project>` layout as the writer.
- `test/hud.test.ts:85-104` takes the real SessionStart stdout path, passes it to the HUD unchanged and reads the real PostToolUse `NO_CHANGES` receipt. It also covers a substituted key returning `location-mismatch`.
- The data-root path and the inaccessible-root `incomplete` path stay covered (`test/hud.test.ts:94`, `:120-123`).

**F2: environment precedence. Closed.**
- `hud.mjs:60` uses `CLAUDE_PLUGIN_DATA || PLUGIN_DATA`, the same order as `lifecycle-hook.ts:19`.
- The default parameter is evaluated per call. So `test/hud.test.ts:106-118` really exercises precedence with two different values, and it restores the environment in `finally`.
- The CLI path (`hud.mjs:109`) passes `pluginData: undefined` when no flag is given, which correctly falls through to the same default.

**F3: candidate concurrency wording. Closed (documentation only).**
- `docs/development/cicd.md:37-39` now says the running candidate is kept and that a newer pending dispatch replaces an older pending one. This is GitHub's concurrency-group behavior with `cancel-in-progress: false`.
- The release-candidate workflow file was not in the supplied sources. Closure assumes its `concurrency` block is keyed per ref with `cancel-in-progress: false`, as the earlier review established.

## New necessary defects

None.

## Non-blocking observations (no change required for this gate)

1. **Fallback receipt path gives a false negative.** If a host runs the plugin hook without either data variable, the writer falls back to `<root>/.boxbox/hooks/<session64>` (`lifecycle-hook.ts:20`) and reports that path.
   - Passing it to `--plugin-data` fails the session-directory test (the parent is `hooks`, not a 16-hex key).
   - It is then treated as a data root and reports `not-observed`.
   - This understates rather than overstates, and `SKILL.md:11` already says a missing receipt is not a successful check. It only matters if real-host evidence shows plugin hooks run without plugin data, which is still unverified.
2. **Symlinked paths change the project key.** The writer hashes `input.cwd` as given; the HUD hashes `resolve(root)`. With a symlinked path (for example macOS `/var` → `/private/var`), the keys can differ.
   - Session-directory input then reports `location-mismatch`, which is conservative.
   - Data-root input reports `not-observed`, also conservative.
   - Neither case produces a false `recorded`.
3. **Scan scope is per project, not per session.** A supplied session directory is widened to the whole project key, so `latest` may come from another session of the same project. `hud.md:22-24` does not say the result is limited to that session, so this is consistent with the docs.
4. **Explicit `undefined` is not isolated from the environment.** `test/hud.test.ts:50` passes `pluginData: undefined`, which still picks up the default from the environment. The test asserts only `hostAcceptance`, so it stays deterministic.

## Unchanged limitations (correctly disclosed)

- Native host trust and hook-event acceptance are still unverified. The HUD always reports `hostAcceptance: "unverified"` and `releaseReady: false`.
- Receipt existence is not presented as host acceptance (`hud.md:26`, `SKILL.md:11-12`).
- No shipped product file changed in this round. The HUD and its skill are development-only and excluded from both release artifacts (`hud.md:28`).