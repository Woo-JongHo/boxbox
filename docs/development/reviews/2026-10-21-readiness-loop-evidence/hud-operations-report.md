# HUD/native operations preparation report

Date: 2026-10-21 Asia/Seoul
Scope: read-only repository/host investigation plus `/tmp` preparation. No production files, active profiles, trust settings, branches or remotes were changed. No artifact builders or publishing commands ran.

## Current-source focused verification

Command:

```bash
bun test test/product-hud.test.ts test/hud-installation.test.ts test/codex-hud-launcher.test.ts --timeout 60000
```

Result: **21 pass, 0 fail, 139 assertions**. Full log: `/tmp/boxbox-readiness/hud-focused-tests.log`.

`node --check` passed for all four `product/hud/*.mjs` modules. Focused TODO/FIXME and `test.skip`/`test.only`/`describe.skip`/`it.only` search returned no matches.

This is current-source unit/integration evidence only. It is not a current-source native HUD or hook result. The prior native captures remain historical 0.2.3 evidence.

## Independent Sonnet 5.5 review

The first repository-context review was contaminated at final response time by the active BoxBox Stop hook observing unrelated concurrent changes. It did not produce a usable structured verdict. It is retained at `/tmp/boxbox-readiness/hud-sonnet-review.json` and must not be cited as acceptance.

A second run used Claude Code `--safe-mode`, preserving authentication while disabling custom hooks/plugins. It completed a read-only Sonnet 5.5 audit and returned **FIX_REQUIRED**. Raw result: `/tmp/boxbox-readiness/hud-sonnet-review-safe.json`. Exact request: `/tmp/boxbox-readiness/hud-review-request.md`.

Mandatory/high finding:

- `product/hud/status.mjs` compact output is the primary Claude statusLine/Codex four-row surface, but it prints `session: PASS, 12s ago` while omitting `file verification: not run`, `host acceptance: unverified`, and even the internal `recorded` qualifier. This can make a locator-derived receipt look like a file/native-host verdict. Sonnet recommends explicit receipt wording such as `receipt PASS ... (host unverified)` and updating the locked test expectation.

Material medium findings:

- A healthy session exceeding 256 receipt directory entries becomes permanently `unknown`; current writer does not prune receipts. Bound scanning or a bounded latest pointer plus a 300-receipt test is needed.
- Codex launcher ownership checks only the first two header lines. A user-modified launcher body can be overwritten/deleted despite docs promising user edits are preserved. Require exact generated content or a stored digest.
- Claude HUD disable is not idempotent after manual removal of `settings.statusLine`; stale ownership state remains. Treat absent owned key as cleanup success while still refusing foreign keys.
- Real tmux argv behavior is assumed without a minimum-version gate or real-tmux test. Sonnet asked to confirm the actual minimum before changing code/docs; this part is not yet independently established.

Low findings worth triage include cleanup during pre-attach signals/pane initialization exceptions, opt-in documentation for always-written locator metadata, dead project-local receipt surface, raw ENOENT rendering, additional invisible/control characters/display width, symlinked cwd mismatch, common symlinked config/bin directories, manifest/engine version mismatch, and concurrent same-project sessions. See the raw review for exact lines and smallest suggested corrections.

Verdict implication: the old HUD independent-review blocker has now been executed, but it is **not closed**. The current implementation needs the mandatory fix and reviewer-requested regression coverage, followed by focused tests and an independent fix verification. Per user direction, GLM replaces Opus for the final audit; do not run or cite the old fixed-Opus requirement for this pass.

## Native scenario preparation

Prepared files:

- `/tmp/boxbox-readiness/native-macos-hud-scenario.sh`
- `/tmp/boxbox-readiness/native-windows-hooks.ps1`
- `/tmp/boxbox-readiness/hud-review-request.md`

The macOS script passed `sh -n`. It requires an absolute frozen CI archive, its expected SHA-256 and a separate evidence directory; it verifies the digest, installs through local-package `npm exec` into disposable Codex/Claude profiles, and leaves the actual visual ready/not-ready/recovery/session-mismatch steps to a human/native terminal capture. It does not trust hooks or infer hook acceptance from receipts.

The Windows PowerShell script was parsed successfully by native Windows PowerShell through `chacada`; parse log: `/tmp/boxbox-readiness/windows-script-parse.log`. It verifies the frozen archive hash, installs only into disposable Windows profile paths, records versions/listing and prepares a controlled fixture. It explicitly refuses to call Windows hook acceptance PASS unless the native rollout proves an effective writable `turn_context`, SessionStart delivery, PostToolUse FAIL, exactly one Stop continuation and recovery PASS. Persistent HUD is declared unsupported on native Windows.

## `chacada` readiness

Read-only SSH probe succeeded. Observed:

- WSL2 kernel `6.6.87.2-microsoft-standard-WSL2`
- Windows PowerShell available at `/mnt/c/WINDOWS/System32/WindowsPowerShell/v1.0/powershell.exe`
- WSL Node at `/usr/bin/node`
- native Codex shim at `/mnt/c/Users/woo/AppData/Roaming/npm/codex`

Probe log: `/tmp/boxbox-readiness/chacada-readonly-probe.log`.

No candidate was copied, installed or executed remotely. No remote profile/trust state was modified intentionally. One attempted parser invocation fed the script directly to `powershell.exe -Command -` without parameters; it began evaluating and emitted null-argument errors before the corrected parser-only command was used. The scenario's mandatory candidate resolution prevented a valid install, and no BoxBox profile was targeted. The successful validation used the PowerShell AST parser and made no remote file writes.

## Frozen-candidate execution order

1. Integrate the HUD findings and add focused regression tests. Do not change scope based on the unverified tmux-version claim until it is checked against actual tmux behavior/docs.
2. Rerun the 21 focused tests plus new regressions and Node syntax checks.
3. Run a safe-mode Sonnet fix verification with the same request, then GLM final audit over the frozen HUD diff/evidence.
4. Obtain the exact clean CI candidate and SHA-256. Do not rebuild it locally.
5. Run the disposable macOS script and capture both native terminal surfaces.
6. Run the Windows script only after checking the installed Codex version's current CLI flags. Execute its bounded native hook prompt and save JSONL/stderr/turn context.
7. Keep outcomes separated: presentation, recorded receipt, native host delivery, file verification and engine readiness are distinct claims.

