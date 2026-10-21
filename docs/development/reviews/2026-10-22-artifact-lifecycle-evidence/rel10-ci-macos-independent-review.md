# Independent review — final CI candidate macOS lifecycle evidence

Date: 2026-10-22
Mode: read-only bounded evidence review; no host, source, profile, artifact, or documentation mutation

## Verdict

**PASS for the four reviewed macOS cells; no mandatory finding.**

The two real-host core lifecycle reports and two HUD configuration-ownership reports are internally consistent and bind to the exact clean CI candidate archive. This verdict is limited to those four terminal exit-zero cells. Workflow run 39646320662 must not be described as wholly passed while macOS smoke remains queued.

## Candidate and verifier binding

- Candidate manifest: `/tmp/boxbox-readiness/ci-candidate-39646320662-1-early/candidate.json`.
- Source: clean staging checkout commit `66eb97821d6b8bd81323175e071a107b2aa3f215`, run 39646320662 attempt 1.
- Archive: `boxbox-plugin-0.2.4.tgz`, 263,896 bytes, SHA-256 `ebfe6a7796d9d85e9cf3088c955df4fb5477e60513e8ebda97d517746d93c665`.
- Direct local hash and byte-size checks match the manifest.
- Both core reports bind that digest/size and self-record frozen core verifier SHA-256 `292b730c…`, matching `development/tools/release-lifecycle.mjs`.
- Both HUD reports bind the same candidate digest and current setup SHA-256 `e888c903…`. The reviewed HUD verifier remains SHA-256 `73da0018…`.
- The historical 0.2.3 fixture remains separately identified as `f07df7…`; its unpublished historical provenance is not transferred to the current CI artifact.

## Core lifecycle evidence

Both reports record `platform: darwin`, `arch: arm64`, `ok: true`, and no unexpected command state.

| Host | Version | Commands | Passed | Expected observed | Preservation checkpoints | Preserved files |
|---|---|---:|---:|---:|---:|---:|
| Codex | 0.163.0 | 110 | 107 | 3 | 21 | 9 |
| Claude | 2.1.286 | 93 | 91 | 2 | 18 | 9 |

The evidence supports:

- fresh exact 0.2.3 registration and installed engine doctor/check/format/recheck/fixed-point behavior;
- expected cold-cache offline 0.2.4 dependency failure while the old registration, engine behavior, host state, and user/project bytes remain usable;
- warm-cache 0.2.3 repair;
- Codex direct upgrade and rollback collision with prior state retained, followed by explicit documented host removal/install transitions;
- Claude direct upgrade acceptance only after separate plugin, marketplace, cache/runtime, engine, and behavior checks;
- current-version warm repair;
- Claude rollback through the explicit manual remove/reinstall path for the immutable historical installer;
- final plugin and marketplace absence;
- retained, inventoried 0.2.3 and 0.2.4 version roots rather than a filesystem-uninstall claim.

Every preservation checkpoint reports host settings preserved. The nine preserved paths cover the project config, approved fixture records/documents, unrelated project data, and version-local user sentinels. All command durations are nonnegative in these macOS reports.

## HUD configuration evidence

Both HUD reports record `platform: darwin`, `ok: true`, the exact `ebfe6a…` archive binding, and exact previous/current setup hashes.

- Codex: 10 commands; four expected exit-1 edited/foreign ownership refusals; refusal inventory deltas are empty; final launcher absent and unrelated bin/config/data preserved.
- Claude: eight commands; four expected exit-1 edited/foreign ownership refusals; refusal inventory deltas are empty; owned state removed, unrelated settings preserved, and backup retained.

The HUD reports correctly limit their verdict to configuration ownership. They do not establish actual UI/tmux rendering, authentication/model use, hook delivery/trust, or Windows HUD support.

## Workflow boundary

The supplied workflow state supports only these statements at review time:

- verification passed;
- package plus Linux and Windows engine-smoke jobs passed;
- the exact candidate manifest binds the clean source and archive;
- the four separately run macOS core/HUD lifecycle cells passed;
- macOS smoke remained queued.

Therefore this review does **not** claim workflow run 39646320662 overall PASS, public release, registry publication, authenticated UI/hook acceptance, or completion of human approval/licensing gates. When macOS smoke terminates, its result must be recorded separately rather than inferred from these native lifecycle cells.

## Evidence reviewed

- candidate manifest and exact archive bytes;
- `rel10-ci-macos-codex/lifecycle.json` plus 110 command logs;
- `rel10-ci-macos-claude/lifecycle.json` plus 93 command logs;
- `rel10-ci-macos-hud-codex/hud-lifecycle.json` plus 10 command logs;
- `rel10-ci-macos-hud-claude/hud-lifecycle.json` plus eight command logs;
- frozen local verifier hashes.
