# Independent evidence review — REL10 macOS Codex lifecycle

Date: 2026-10-22  
Mode: read-only review of the completed macOS Codex cell. No install, mutation, cleanup, test rerun, or repository edit was performed.

Reviewed:

- `/tmp/boxbox-readiness/rel10-macos-codex-1/lifecycle.json`
- all 110 sibling numbered stdout/stderr log pairs referenced by that report
- `docs/development/proposals/2026-10-22-artifact-lifecycle.md`
- `/tmp/boxbox-readiness/rel10-harness-independent-review.md`
- frozen `development/tools/release-lifecycle.mjs` and the two archive paths recorded by the report

## Verdict

**PASS — mandatory findings: 0.**

The terminal report and its raw command logs support a bounded macOS arm64 / Codex CLI 0.163.0 core lifecycle pass. This proves real isolated Codex registration, installed-engine operation, dependency-cache failure recovery, documented manual update and rollback, final host removal, preservation, and residue inventory for the exact two archive byte streams. It does not prove HUD, hooks, trust, authentication, model/UI behavior, filesystem uninstall, publication readiness, or any Claude cell.

## Evidence integrity

- `lifecycle.json` is terminal: `ok: true`, start `2026-10-21T17:16:12.316Z`, finish `2026-10-21T17:17:00.307Z`, 110 recorded commands, 11 lifecycle steps, 21 preservation checkpoints, and two final residue inventories.
- Every command references an existing stdout and stderr log. Command states are 107 `passed` and three intentionally `observed` failures: cold-cache dependency failure, forward marketplace collision, and reverse marketplace collision.
- The recorded harness SHA-256 is `1b8a197be252133fb5792194d74f80e43a227c8feb747dc8a69998afb0a4ef49`; the current harness file independently hashes to the same value and matches the pre-gate review.
- The archive files independently rehash to the report values:
  - 0.2.3: `f07df7ada9aa234c2935ed500b4fe15b1a5d53f7b7a6de7d8ec107f53c8f572c`, 137322 bytes.
  - 0.2.4: `bec626435e525c2d7324d156f85d2c114427d875725abcecb42fed561b2b92be`, 260734 bytes.
- Twelve artifact checkpoints bind the applicable archive before initial install, cold attempt, repairs, forward/reverse transitions and at final completion.
- Provenance is stated correctly: 0.2.3 is a historical uncommitted candidate fixture and is neither an approved nor published release; 0.2.4 is the unpublished source-`35b6178` CI candidate.

## Real host and installed roots

- The executable was the real `/Users/jonghoPro/.local/bin/codex`; `codex --version` reported `codex-cli 0.163.0`. npm reported 10.9.8 and Node was 22.22.3.
- Initial Codex JSON listings showed no installed plugins or marketplaces in the isolated profile.
- Fresh 0.2.3 listing showed `boxbox@boxbox-plugins`, version 0.2.3, enabled, with both plugin source and marketplace root inside the exact isolated 0.2.3 permanent directory.
- Forward install after documented removal showed version 0.2.4 and the exact 0.2.4 plugin/root. Reverse install similarly restored version/root 0.2.3.
- Installed launchers themselves reported 0.2.3 or 0.2.4 at the relevant stages; doctor reported `ok: true` and `runtimeUsable: true`.
- These are isolated real-CLI results. They do not assert live-profile registration.

## Engine journey

For fresh 0.2.3, retained-old-engine checks after failures, repaired 0.2.3, installed/repaired 0.2.4, retained-current checks after rollback collision, and final rolled-back 0.2.3, the raw logs show the expected approved TypeScript journey:

1. initial check reports one FIXABLE `declaration-equals` group and exits 1;
2. dry-run reports eligible, approved, fixed point, and no write;
3. apply reports `written: true`;
4. recheck reports PASS, zero edits, and exits 0;
5. second apply reports `boxboxChanged: false`, `written: false`, and fixed point.

The harness correctly treats the initial check exit 1 as the product's “misalignment found” result, rather than a command failure.

## Failure and recovery

- The fresh isolated npm-cache attempt of 0.2.4 used `npm_config_offline=true` and exited 1 with `ENOTCACHED` for the TypeScript registry request.
- After that expected dependency-cache failure, Codex still listed the exact active 0.2.3 registration/root; the previous installed engine completed doctor and the full alignment journey. No 0.2.4 active registration was accepted.
- Warm-cache same-version repair succeeded offline for 0.2.3 and later for 0.2.4. Registration/root/version, doctor, alignment, preservation, and idempotence were rechecked after each repair.
- This is dependency-cache-offline evidence only. It is not whole-process or OS-wide network isolation.

## Update, rollback, and removal

- Direct 0.2.3 → 0.2.4 returned the precise Codex marketplace collision: the same marketplace was already added from a different source. The following JSON listings and engine journey showed that 0.2.3 remained active and usable.
- The documented manual path then removed the exact plugin and marketplace. Empty JSON listings followed before installing 0.2.4.
- Direct 0.2.4 → 0.2.3 produced the same narrow collision. The 0.2.4 registration/root and engine remained intact before the symmetric manual removal and 0.2.3 reinstall.
- Final removal used the exact plugin and marketplace CLI commands. Final JSON listings contain no installed plugin and no marketplace.
- The evidence supports a **manual, non-atomic host transition**, consistent with the installer README. It does not show or claim automatic marketplace migration.

## Preservation and residue

- The report records nine pinned preserved files: per-version user sentinels, project config, inactive copies of approved convention/decision/example bytes and two public decision documents, plus an unrelated project note.
- The files remain present at terminal state and their independently recalculated SHA-256 values match the report. Twenty-one checkpoints also report semantic preservation of the isolated host setting.
- Both permanent version directories intentionally remain after host unregistration. The final inventory records 604 entries for 0.2.3 and 605 for 0.2.4, including each bundled engine/runtime and the per-version user sentinel.
- This is an honest residue result under the documented manual-cleanup contract. It is not evidence of a filesystem uninstaller, and the harness did not delete the version roots.

## Scope limits

This PASS covers only the macOS Codex **core lifecycle** cell for the exact archive bytes above. It does not transfer release status to the historical 0.2.3 fixture, approve either artifact for publication, establish same behavior on Windows or Linux/WSL, or cover Claude. The concurrently running `rel10-macos-claude-1` directory was not reviewed or treated as terminal evidence. HUD ownership handoff is a separate evidence surface under the proposal.
