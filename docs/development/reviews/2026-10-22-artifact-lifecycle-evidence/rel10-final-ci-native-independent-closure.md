# Independent closure — final clean-CI native raw logs

Date: 2026-10-22
Mode: read-only evidence review; preserves the earlier INCOMPLETE report unchanged

## Verdict

**PASS for the authorized four remote core lifecycle cells and two WSL HUD configuration-ownership cells; no mandatory finding.**

The missing-log condition recorded in `/tmp/boxbox-readiness/rel10-final-ci-native-independent-review.md` is closed. All 848 stdout/stderr references from the six lifecycle reports now resolve beside their original JSON filenames, the combined 854-file digest manifest verifies, and direct inspection of the decisive raw outputs agrees with the lifecycle metadata.

This verdict remains bounded to the exact clean-CI archive and these six cells. It does not claim overall workflow PASS while macOS smoke remains queued, publication/release, authenticated UI/model activity, hook delivery/trust, or native Windows HUD.

## Evidence integrity

- Combined manifest: `/tmp/boxbox-readiness/rel10-ci-raw-SHA256SUMS.txt`, 854 entries; every entry verified with `sha256sum -c`.
- Reference scan: 848 command stdout/stderr references, zero missing.
- Current archive: 263,896 bytes, SHA-256 `ebfe6a7796d9d85e9cf3088c955df4fb5477e60513e8ebda97d517746d93c665`.
- Candidate metadata: clean staging source `66eb97821d6b8bd81323175e071a107b2aa3f215`, workflow 39646320662 attempt 1.
- Core verifier: all four lifecycle files record `292b730c…`.
- HUD reports bind `ebfe6a…` and current setup `e888c903…`; the staged reviewed HUD verifier is `73da0018…`.
- WSL and native PowerShell delivery proofs bind the new Downloads directory `ci-39646320662-1-ebfe6a77` to the same archive digest and byte size.

## Raw core output checks

Direct stdout/stderr inspection closed each decisive boundary on both WSL Linux and native Windows:

- Cold-cache install fails with npm `ENOTCACHED`; immediately following host listings still show version/root 0.2.3.
- Codex direct transitions fail with the measured marketplace-source collision. Following plugin and marketplace output still points to 0.2.3; documented remove/install output then points to 0.2.4 and the engine prints `0.2.4`.
- Codex rollback follows the same measured collision/remove/install path and returns plugin, marketplace, and engine identity to 0.2.3.
- Claude direct upgrade exits zero, and subsequent plugin output shows version/cache 0.2.4 while marketplace `path` and `installLocation` both point to the 0.2.4 owned root.
- Claude manual rollback output shows version/cache 0.2.3, marketplace `path` and `installLocation` at the 0.2.3 root, and engine version `0.2.3`.
- Final Codex outputs are `installed: []`, `available: []`, and `marketplaces: []`; final Claude outputs are empty plugin and marketplace arrays.
- The lifecycle preservation checks remain consistent with the raw transition sequence: host settings preserved at every checkpoint, nine project/user paths retained, and both version roots inventoried as intentional residue.

Windows Codex output also confirms that the older 0.157.1 marketplace schema omits repeated source metadata while the plugin record and canonical root remain correctly bound; the extended drive prefix appears only in the plugin-side source and matches the reviewed Windows normalization boundary.

## Raw HUD output checks

The WSL Codex and Claude HUD raw logs substantiate all eight expected ownership refusals:

- Codex edited/foreign enable and disable attempts exit 1 with the owned-file refusal and empty inventory deltas.
- Claude edited/foreign enable attempts refuse an existing statusLine without changing settings; disable attempts refuse statusLine state not owned by the HUD, also with empty inventory deltas.
- Successful Codex rollback/removal logs report the exact launcher disabled; successful Claude removal reports the exact isolated settings path disabled.
- Lifecycle final states retain unrelated configuration and the documented Claude backup while removing only owned active state.

These are configuration-ownership results only. No raw log is interpreted as UI, tmux, model, authentication, hook, trust, or Windows HUD acceptance.

## Provenance wording

The frozen core limitation sentence referring to a “historical uncommitted candidate fixture” applies to the previous 0.2.3 `f07df7…` fixture. The current 0.2.4 input is independently bound by structured artifact fields, clean-CI `candidate.json`, remote delivery hashes, and repeated stage/final checks. The operations closure now states this distinction explicitly; no stale generic sentence is used as current-candidate provenance.

## Non-blocking evidence notes

- Four WSL Codex per-command `durationMs` values are negative from wall-clock movement. Raw outputs, exit states, transition ordering, and identities remain valid; those four timings are unsuitable for performance claims.
- The compact metadata directory alone omits the archive named by its SHA file, while the new raw directories close command-output review. Archive identity remains established by candidate metadata, three WSL path hashes, native PowerShell, and lifecycle artifact checks.
- HUD JSON does not self-record the verifier digest; its staged frozen runner plus archive/setup bindings remain the reviewed chain.

## Conclusion

The original INCOMPLETE review remains the accurate history of the flat-metadata gap. With the hash-bound raw logs now present and directly checked, the exact `ebfe6a…` clean-CI candidate passes the bounded WSL/native-Windows core lifecycle and supported WSL HUD configuration-ownership scope. Workflow and release-level claims remain separately gated.
