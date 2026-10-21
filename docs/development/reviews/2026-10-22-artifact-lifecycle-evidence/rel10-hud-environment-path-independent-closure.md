# REL10 HUD environment-path fix — independent closure

Date: 2026-10-22  
Scope: read-only focused review. No HUD setup or native host command was executed.  
Verdict: **PASS.**

## Correction to prior gate

The prior static PASS did not exercise `hudLifecycle` far enough to detect that scalar environment flags were passed to canonical path validation. The preserved first native attempt correctly remains a failed, pre-command result: `ok:false`, `commands:[]`, with `realpath(.../1)` caused by `CI="1"` / `NO_COLOR="1"`. It provides no HUD behavior evidence and caused no setup-script mutation.

## Frozen files

- `development/tools/release-hud-lifecycle.mjs`: `c6baf652055571c7871638acf8fe8e23d22e3cdedf8b01a628e53b7364a430d2`
- `test/release-hud-lifecycle.test.ts`: `be240f00e63d5e7d8bd46982f578ed5e59b0b26e09ab53c6e697e5a2e29c8fdd`

Both match `/tmp/boxbox-readiness/rel10-hud-harness-hashes.txt` and the author closure report.

## Closure assessment

`ISOLATED_PATH_ENVIRONMENT_KEYS` names exactly the eight workspace-owned path variables constructed by `hudLifecycle`: `HOME`, `USERPROFILE`, `CODEX_HOME`, `CLAUDE_CONFIG_DIR`, and the four `XDG_*_HOME` roots. `validateEnvironmentPaths` requires every declared key to contain a string and requires its existing canonical path to remain inside the core workspace.

`PATH`, `NO_COLOR`, and `CI` are deliberately excluded. This is correct: `PATH` is inherited executable search configuration, while `NO_COLOR` and `CI` are scalar flags rather than filesystem paths. The production call now uses this explicit validator instead of iterating all environment values.

The focused regression exercises all eight keys, confirms the three nonpath values are ignored, rejects a declared path outside the workspace, and rejects a missing declared key with a specific diagnostic. The test directly covers the observed failure class without invoking setup or a host.

## Independent verification

- Frozen hashes: matched.
- Preserved failed native report: `ok:false`, zero commands, pre-command `/1` realpath error confirmed.
- Focused test: 9 pass, 0 fail, 43 assertions.
- `node --check`: pass.
- `git diff --check` on the frozen files: pass.

The harness is eligible for a fresh isolated native run in a new output directory. This PASS covers the environment-path correction and previously reviewed static safeguards; it does not convert the failed first attempt into runtime evidence and does not itself establish HUD behavior or UI acceptance.
