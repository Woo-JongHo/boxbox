# BoxBox issue → PR → candidate pipeline and HUD: independent review

**Verdict: PASS.** I found no defect that breaks the stated scope (issue forms → PR verification → manual candidate without publication, plus the local Codex install and on-request HUD). The source/development/artifact boundary holds in the snapshot, permissions are least-privilege, and the digest chain is sound. The low-severity items below are worth fixing but do not block.

The snapshot has no line numbers, so locations are given as file plus function or region. I had no tools and did not execute anything. Everything here comes from reading the code.

## What I checked and found sound

- **Permissions:**
  - Both workflows are `contents: read` and use `persist-credentials: false`.
  - There is no `pull_request_target` and no secrets.
  - The caller and callee concurrency group strings differ, so the reusable-workflow call cannot deadlock.
- **Digest chain:**
  - `release-smoke.mjs` `verifyCandidate` runs before any extraction or execution.
  - It checks the filename regex, the `basename`, `lstat` regular-file status, the byte count, the archive digest and the `SHA256SUMS` content against a digest supplied independently through the job output.
  - The tests cover tampered bytes, a replaced metadata digest, a missing digest and an escaping filename.
- **Candidate staging:** it never builds, and it checks the archive's real `package.json` against `product.json` and `package.json`.
- **Smoke journey:**
  - The journey is isolated through XDG, `LOCALAPPDATA`, `CODEX_HOME` and the npm cache.
  - It covers both LF and CRLF input.
  - The Windows install path matches `installationRoot`.
- **HUD:**
  - It never falls back to the checkout engine.
  - `hostAcceptance` is hard-coded `"unverified"`, and `fileVerification` is `"not-run"`.
  - Output control characters are stripped in the text rendering.
  - Receipt reads are capped at 256 KiB, and symlinks are skipped because `Dirent.isFile()` is false for them.

## Findings (all low, non-blocking)

**1. `docs/development/hud.md` (first paragraph) contradicts the skill.**
- The doc says the skill runs `bun run hud -- --json`. `development/skills/boxbox-status/SKILL.md` runs `node development/tools/hud.mjs --json`.
- Impact: this is not a runtime failure, since both reach the same script. It is a wrong claim in a doc that is meant to be the source of truth for the HUD, and it also misstates the Bun dependency.
- Fix: change the doc sentence to the `node` command, or change the skill to `bun run hud -- --json`.

**2. `hud.mjs` `hookStatus`: an I/O error discards the hook state.**
- The `readdirSync` calls sit outside the per-file `try`. A permission error, or a session directory removed mid-scan, throws into `collectHud`'s outer `catch`.
- That sets `report.error` but leaves `hooks` at `location-unknown` even though a data directory was supplied. It also exits 1 with a misleading hook line.
- Fix: wrap the directory walk in a `try` and increment `unreadable` on failure, so the result is `incomplete`.

**3. `test/hud.test.ts`: the receipt test is circular.**
- It hand-builds the directory layout (`hooks/<sha256(root)[:16]>/<session>/*.json`) and the receipt schema (event ∈ {PostToolUse, Stop}). The HUD reader duplicates the same assumptions.
- I could not see the real writer in `lifecycle-hook.ts`. If it hashes a different root (a git root or a `realpath`), or writes another event name such as a session-start receipt, the HUD would report `not-observed` or `incomplete` against real data while all 3 HUD tests stay green.
- Fix: add one test that produces a receipt through the real hook writer in a temp `PLUGIN_DATA` and asserts that `collectHud` reads it. Alternatively, import the key and schema from a shared constant.

**4. `release-candidate.ts` local staging can record a wrong source identity.**
- `source.commit` and `dirty` describe the current tree, not the tree the archive was built from. With a stale `dist/installer/` archive of the same version, local staging records `dirty:false` and the current HEAD for bytes built from an older commit.
- The CI path is safe, because it builds in a clean checkout of the same job.
- Fix: either have the builder stamp the commit into `pack-result.json` and compare it in `stageCandidate`, or have `stageCandidate` refuse any archive older than the newest tracked-file change. Alternatively, document that the identity is only authoritative for CI-built candidates.

**Related observation (not a defect):** the Kotlin compiler zip in `verify.yml` is downloaded and unzipped with `sudo` without a checksum, while `go-version: stable` and Rust `stable` float. The docs claim commit pins only for actions, so there is no false statement. Because that gate feeds the candidate, a pinned SHA-256 for the Kotlin zip would close the one unpinned fetch. I could not tell from the snapshot whether this step is new.

## Not defects: remote or unexecuted checks that may fail on first GitHub run

None of these has been executed. They are risks to confirm on the first real run, not findings.

- **Windows `tar`:** `release-smoke.mjs` spawns bare `tar` with `C:\…` paths. If a GNU tar from Git's `usr\bin` resolves first, it fails with a "resolve failed" error. It should be fine with System32 bsdtar.
- **Windows `python3`:** the Python step and the smoke require `python3` on Windows. It fails visibly if `setup-python` does not provide a `python3.exe`.
- **Windows temp cleanup:** `rmSync(workspace)` in the `finally` block has no `maxRetries`. A transient `EBUSY` on Windows would fail an otherwise green smoke.
- **Offline npm cache:** the smoke uses an empty npm cache and so needs network access for `typescript@7.0.2`. That is fine on hosted runners.
- **Action SHAs and versions:** the SHA-to-version comments, such as `setup-node # v7`, cannot be verified from the snapshot.
- **Branch divergence:** these workflows and the `verify.yml` changes exist only in the self-hosted tree. Nothing has run on GitHub, and the divergent GitHub `main` (10/34 commits) must be reconciled before `workflow_dispatch` is even available.
- **Host-side claims:** hook trust and native hook-event delivery remain unverified. The HUD, docs and templates state this accurately, so I found no overclaim.