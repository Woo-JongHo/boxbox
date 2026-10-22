# Independent review — final clean-CI native remote evidence

Date: 2026-10-22
Mode: read-only bounded evidence review; no source, artifact, host, profile, or documentation mutation

## Verdict

**INCOMPLETE pending bounded raw command logs.**

The compact lifecycle metadata is internally consistent for the exact clean-CI archive `ebfe6a77…`, but the flat evidence directory does not contain the command stdout/stderr files referenced by each lifecycle entry. Therefore this review cannot independently validate the actual host listing, marketplace, runtime, engine, refusal, or final-absence outputs behind the recorded `passed` states. The earlier PASS wording is withdrawn. It does not support, and the report does not assert, overall workflow PASS while macOS smoke remains queued, public release/publication, authenticated UI/model activity, hook delivery/trust, or native Windows HUD.

## Mandatory evidence gap

The lifecycle JSON files refer to relative command logs such as `043.stdout.log` and `043.stderr.log`, but those files are absent from the compact directory and no per-cell directory layout resolves the references. Metadata fields such as `state: passed`, exit code, preservation counts, and artifact checks are verifier assertions; they are not a substitute for inspecting the captured host output when this task explicitly requires an independent evidence review.

Required closure: copy the bounded original stdout/stderr files into separate per-cell directories while preserving their original report names/relative bindings, then independently sample every decisive transition and identity boundary: cold-cache failure, retained prior host identity, Codex collision/remove/install, Claude direct update, manual rollback, current/previous engine version and behavior, final plugin/marketplace absence, and HUD edited/foreign refusal outputs. No rerun is required if the original bytes remain available.

## Candidate identity and proof chain

The copied `candidate.json` identifies:

- clean staging source `66eb97821d6b8bd81323175e071a107b2aa3f215`;
- workflow 39646320662, attempt 1;
- `boxbox-plugin-0.2.4.tgz`, 263,896 bytes;
- SHA-256 `ebfe6a7796d9d85e9cf3088c955df4fb5477e60513e8ebda97d517746d93c665`;
- unpublished candidate status.

The proof chain is coherent:

1. candidate metadata and `PROVENANCE.txt` agree on source, workflow, digest, byte size, version, and unpublished status;
2. WSL `sha256sum` records the same digest at the Linux staging path, Windows task staging path, and new Downloads delivery `ci-39646320662-1-ebfe6a77`;
3. native PowerShell independently records the Downloads copy at the same digest and 263,896 bytes;
4. every core lifecycle records the same current digest/size and repeats it at pre-execution, transition, and final artifact checks;
5. both HUD lifecycle files bind the same current archive digest and setup-script digest.

The four core reports self-record verifier SHA-256 `292b730c…`, matching the frozen core verifier. The WSL HUD runner/report chain uses the reviewed HUD verifier `73da0018…`; HUD reports bind the installed old/current setup digests.

## Platform and core lifecycle results

The platform claims are accurate:

- WSL reports identify `platform: linux`, x64, Node 22.22.3, Codex 0.163.0 / Claude 2.1.280.
- Native Windows reports identify `platform: win32`, x64, Node 24.12.0, Codex 0.157.1 / Claude 2.1.280.
- WSL is never presented as native Windows.

All four core reports have `ok: true`, exact expected command distributions, no unexpected state, 9 preserved paths, and retained inventories for both version roots:

| Cell | Commands | Passed | Expected observed | Preservation checkpoints |
|---|---:|---:|---:|---:|
| WSL Codex | 110 | 107 | 3 | 21 |
| WSL Claude | 93 | 91 | 2 | 18 |
| Windows Codex | 110 | 107 | 3 | 21 |
| Windows Claude | 93 | 91 | 2 | 18 |

The command and step records support:

- fresh exact 0.2.3 registration and installed engine doctor/check/format/recheck/fixed-point behavior;
- expected cold-cache 0.2.4 offline dependency failure with prior registration, engine behavior, settings, and user/project bytes preserved;
- warm-cache previous-version repair;
- Codex direct upgrade/rollback collision followed by explicit documented remove/install transitions, with prior state verified before transition;
- Claude direct 0.2.4 acceptance followed by separate plugin/marketplace/runtime/engine and behavior checks;
- current-version warm repair;
- Claude explicit manual rollback for the immutable historical 0.2.3 installer;
- final plugin and marketplace absence in all four cells;
- retained 0.2.3/0.2.4 version directories recorded as residue, without a filesystem-uninstaller claim.

Every preservation checkpoint has `hostSettingPreserved: true`. The preserved paths cover project config, approved fixture records and decision documents, unrelated project data, and version-local user sentinels.

## WSL HUD configuration results

Both HUD reports have `ok: true`, `platform: linux`, the exact `ebfe6a77…` archive binding, and the expected current setup SHA `e888c903…`.

- Codex: 10 commands, four expected exit-1 edited/foreign ownership refusals, empty refusal deltas, final launcher absent, unrelated state preserved.
- Claude: 8 commands, four expected exit-1 edited/foreign ownership refusals, empty refusal deltas, owned state removed, unrelated settings preserved, backup retained.

The report correctly limits these cells to configuration ownership. It makes no host UI/tmux, authentication/model, hook delivery/trust, or Windows HUD claim.

## Provenance wording assessment

Each core lifecycle contains the frozen generic limitation:

> Historical uncommitted candidate fixture; not an approved or published release.

For this run, “historical uncommitted candidate fixture” correctly describes the previous `f07df7…` fixture but is stale/ambiguous if read as describing the current archive. It does **not** override the structured current-artifact entry, which labels the current input caller-bound, or the external clean-CI `candidate.json` and repeated digest checks. The final report explicitly calls out this mismatch and uses the structured clean-CI metadata as authority. Therefore no lifecycle result needs to be rejected, but durable summaries should avoid quoting that generic sentence as current-candidate provenance.

## Evidence-quality advisories

1. Four WSL Codex command entries have negative `durationMs`, consistent with wall-clock adjustment. Exit/state, ordered step results, artifact checks, and later behavioral checks remain valid; do not use those individual timings as performance evidence.
2. `SHA256SUMS.txt` names `boxbox-plugin-0.2.4.tgz`, which is present in the remote Downloads delivery but intentionally absent from the compact evidence directory. Consequently `sha256sum -c` cannot run inside the compact directory alone. The included WSL/native hash records plus lifecycle artifact checks preserve the identity proof, but the compact directory is not a self-contained archive verifier.
3. As in the prior reviewed HUD format, HUD JSON does not self-record the HUD verifier digest. The runner/frozen filename and exact archive/setup bindings form the evidence chain; a future schema could record its own verifier hash.

These advisories are separate from the mandatory missing-log gap. Metadata consistency is not a terminal lifecycle verdict until the referenced command logs are reviewed.

## Workflow boundary

At the stated last poll, verification and package/Linux/Windows smoke jobs were terminal PASS while macOS smoke remained queued. This review therefore does not claim workflow run 39646320662 overall PASS. The four macOS lifecycle cells reviewed separately and these six remote cells do not substitute for the queued workflow job.

## Files reviewed

- `/tmp/boxbox-readiness/rel10-final-ci-native-report.md`
- all currently available files under `/tmp/boxbox-readiness/rel10-final-ci-native-ebfe6a77/` (flat metadata only; referenced command logs absent)
- frozen local core and HUD verifier hashes
