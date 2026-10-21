# HUD remediation report

Date: 2026-10-21 Asia/Seoul
Scope owner: `product/hud/**` and focused HUD tests. No CLI engine files, active profiles, artifacts, remotes or trust settings were changed.

## Snapshot

Before editing, owned sources/tests were copied byte-for-byte to:

`/tmp/boxbox-readiness/hud-remediation-before/`

The HUD sources/tests are currently untracked in the shared worktree, so comparisons use `git diff --no-index` against that snapshot rather than ordinary `git diff`.

## Changes

### Qualified compact HUD

`product/hud/status.mjs` compact output now renders:

```text
session receipt: PASS, 12s ago | file not run | host unverified
```

It no longer presents an unqualified `session: PASS`. Receipt observation, per-file verification and native host acceptance remain distinct on the two-line Claude statusLine and four-row Codex HUD.

### Bounded long-session receipt selection

Receipt directories no longer become permanently `unknown` after 256 entries. The collector:

- enumerates the directory while retaining at most 256 names in memory;
- after the threshold, accepts only the lifecycle writer's `<13-digit-ms>-<uuid>.json` naming contract;
- keeps the lexically newest 256 generated receipts;
- reads/validates only that bounded set;
- fails closed when there are no generated records or a selected newest record is invalid.

The regression creates 300 valid writer-format records, verifies the newest PASS remains visible, then adds an invalid newest record and verifies state becomes `unknown`.

### Codex launcher ownership

`product/hud/setup.mjs` now requires the complete launcher bytes to match the generated owned content. A file retaining only the managed two-line header but with a user-edited body is refused for both enable and disable, and remains byte-preserved. Exact owned content is removable; an absent launcher remains an idempotent success.

This intentionally treats a launcher generated for a different `pluginRoot` as foreign. An update across installation roots may require the user to remove the old launcher explicitly; that is safer than deleting an edited file without a previously stored ownership digest.

### Claude disable idempotency

When `settings.statusLine` is already absent, disable now succeeds. It removes matching stale BoxBox state if present and leaves unrelated state untouched. Repeated disable also succeeds. A foreign statusLine is still refused.

No HUD-specific edit was needed in `product/installer/install.mjs` or `product/installer/launcher.mjs`.

## tmux finding

No speculative version gate was added. Local tmux is 3.6b. Its installed official manual states that `new-session` and `split-window` accept `shell-command [argument ...]` and execute multiple arguments directly without `sh -c`. The current code passes Node and its arguments separately. Evidence:

`/tmp/boxbox-readiness/tmux-direct-exec-evidence.txt`

Behavior on older unmeasured tmux versions remains a native support-matrix question, not a proven current defect.

## Verification

Final focused command:

```bash
bun test test/product-hud.test.ts test/hud-installation.test.ts test/codex-hud-launcher.test.ts --timeout 60000
```

Result: **21 pass, 0 fail, 149 assertions**.

Log: `/tmp/boxbox-readiness/hud-remediation-tests-final.log`

Additional checks:

- `node --check` passed for changed HUD modules.
- `git diff --check` passed for tracked worktree changes.
- Focused TODO/FIXME and `test.skip`/`test.only`/`describe.skip`/`it.only` search returned no matches.

## Independent closure

Initial Sonnet 5.5 audit: `FIX_REQUIRED`.

- Raw: `/tmp/boxbox-readiness/hud-sonnet-review-safe.json`
- Request: `/tmp/boxbox-readiness/hud-review-request.md`

Final safe-mode Sonnet 5.5 fix verification: **PASS, no mandatory findings**.

- Raw: `/tmp/boxbox-readiness/hud-sonnet-fix-verification-final.json`
- Request: `/tmp/boxbox-readiness/hud-fix-verification-request.md`

The final reviewer confirmed the qualified compact display, bounded newest-receipt validation, edited-launcher preservation, Claude disable behavior and lack of evidence for a mandatory tmux version gate. It correctly retained native Codex/Claude acceptance as unverified.

## Remaining evidence boundary

This closes the static independent HUD remediation pass. It does not establish current frozen-candidate native rendering, hook delivery or Windows editing-dependent events. Those remain covered by the prepared scripts:

- `/tmp/boxbox-readiness/native-macos-hud-scenario.sh`
- `/tmp/boxbox-readiness/native-windows-hooks.ps1`
