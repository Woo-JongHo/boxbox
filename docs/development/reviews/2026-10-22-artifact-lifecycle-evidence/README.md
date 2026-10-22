# Exact-artifact lifecycle evidence

This directory retains the initial REL10 execution, including the failed Claude transition. The frozen source
snapshots and per-command output are evidence, not files to format or modernize. `manifest.sha256` binds the retained
files; it does not certify a release.

## Initial artifact identities

- Previous: 0.2.3, `f07df7ada9aa234c2935ed500b4fe15b1a5d53f7b7a6de7d8ec107f53c8f572c`.
  This is an unpublished historical fixture built from an uncommitted worktree.
- Current: 0.2.4, `bec626435e525c2d7324d156f85d2c114427d875725abcecb42fed561b2b92be`.
  This is the unpublished CI candidate from source `35b6178`, run 39637622755 attempt 1.
- Initial core verifier: `1b8a197be252133fb5792194d74f80e43a227c8feb747dc8a69998afb0a4ef49`.

## Initial measured cells

| Cell | Result | Evidence |
| --- | --- | --- |
| macOS Codex 0.163.0 | PASS; upgrade and rollback required manual marketplace removal/reinstall | [Core report](rel10-macos-codex-1/lifecycle.json), [independent review](rel10-macos-codex-evidence-review.md) |
| macOS Claude Code 2.1.286 | FAIL at upgrade identity acceptance; installer exit zero and new marketplace source did not refresh the listed plugin version | [Core report](rel10-macos-claude-1/lifecycle.json), [diagnosis](rel10-claude-transition-diagnosis.md) |
| Linux/WSL Codex 0.163.0 | PASS; documented manual transitions | [Core report](rel10-wsl-codex-pass/lifecycle.json), [independent review](rel10-wsl-evidence-review.md) |
| Linux/WSL Claude Code 2.1.280 | FAIL at the same installed-version acceptance gate | [Core report](rel10-wsl-claude-failure/lifecycle.json), [independent review](rel10-wsl-evidence-review.md) |
| Native Windows Codex 0.157.1 | PASS after separately recorded launch-transport and exact older-host schema corrections | [Core report](rel10-windows-codex-pass/lifecycle.json), [independent review](rel10-windows-codex-evidence-review.md) |

Each cell retains numbered stdout/stderr logs beside its report. No failed report is rewritten into a passing one.
The CLI's in-place loading message does not establish what an authenticated session actually loaded; no model
session was run in these cells. The old cache's manifest/runtime and the new permanent plugin were inspected separately.

Core verification covers real host registration, engine behavior, dependency-cache failure/recovery, manual
transitions, registration removal, user-data preservation and retained version directories. It does not establish
HUD ownership, host UI, hooks, authentication, publication, or a filesystem uninstaller. Later diagnostics and corrected
candidates need separately bound evidence. See the [execution plan](../../proposals/2026-10-22-artifact-lifecycle.md).

## Corrected local candidate

The installer fix candidate is `1f1343e91d2799998884ed5d75e1a26d7858226d2f9f51f07621bfeedaf6ecd3`.
It is local/unpublished, built from the reviewed dirty worktree based on `a4e14a9`; it is not the original CI archive.
The [source freeze](rel10-installer-freeze-final.json), [final independent closure](rel10-claude-installer-final-independent-closure.md)
and [GLM result](rel10-installer-glm/summary.md) bind the implementation. Mandatory source findings are closed.
The [complete local check](rel10-full-check-closure.log) passed 672 tests, five existing parser skips and zero failures;
the [plugin guard](rel10-plugin-guard.log) also passed. The earlier full-check failure is retained and explained by
[issue 018](../../issue-library/records/BBX-20261022-018-evidence-test-autodiscovery.json).

| Cell | Core lifecycle | HUD configuration ownership | Independent evidence review |
| --- | --- | --- | --- |
| macOS Codex 0.163.0 | [PASS, 110 commands](rel10-fixed-macos-codex-1/lifecycle.json); manual upgrade/rollback | [PASS, 10 commands](rel10-fixed-hud-macos-codex-1/hud-lifecycle.json) | [PASS](rel10-fixed-macos-codex-evidence-review.md) |
| macOS Claude Code 2.1.286 | [PASS, 93 commands](rel10-fixed-macos-claude-1/lifecycle.json); direct upgrade, explicit manual rollback | [PASS, 8 commands](rel10-fixed-hud-macos-claude-1/hud-lifecycle.json) | [PASS](rel10-fixed-macos-claude-evidence-review.md) |

These cells verify exact host registration, installed engine journeys, cold-cache failure recovery, warm-cache repair,
preservation, removal and residue. HUD cells verify setup ownership and configuration handoff/refusal/rollback/removal;
they do not open tmux, invoke a model, grant trust or verify visible UI. Windows HUD is unsupported.
The corrected archive also passed Codex and Claude core lifecycles on native Windows and Linux/WSL, plus both
supported WSL HUD configuration ownership cells. See the [six remote cell records](rel10-fixed-native-report.md)
and [independent review](rel10-fixed-native-independent-review.md). The complete corrected local matrix is six core
cells and four HUD configuration cells. Some WSL per-command wall-clock durations are negative after clock adjustment;
they are not performance evidence. State, exit-code, identity and preservation checks remain independently verified.
Final clean CI-byte verification is separate and pending.

## Evidence storage

Only compact reports, numbered command outputs, source snapshots, review requests/results and identities are retained.
No tarballs, temporary host homes, dependency trees, credentials or unrelated process inventories belong here.
Historical executable snapshots use a `.txt` suffix so automatic test discovery cannot execute them. Where names
changed, [the storage map](rel10-hud-pre-current-digest/storage-map.json) retains original names and exact byte hashes.
Recorded failures remain failures; later successful candidates have separate directories and artifact bindings.

## Final clean CI candidate

Source `66eb97821d6b8bd81323175e071a107b2aa3f215` produced the exact archive
`ebfe6a7796d9d85e9cf3088c955df4fb5477e60513e8ebda97d517746d93c665` (263,896 bytes) in
[candidate run 39646320662](https://github.com/Woo-JongHo/rowgrid/actions/runs/39646320662), attempt 1.
The [candidate manifest](ci-candidate-39646320662-1/candidate.json) records a clean source checkout.
Both source verification jobs passed 677 tests without failures or parser skips. The ordinary source PR verification
also [passed both platforms](rel10-final-source-pr-verification.json). Linux and Windows hosted engine smoke passed;
the hosted macOS smoke job remains queued for runner capacity, so the candidate workflow is not yet recorded as PASS.

| Platform | Codex core | Claude core | Supported HUD configuration |
| --- | --- | --- | --- |
| macOS | [PASS](rel10-ci-macos-codex/lifecycle.json) | [PASS](rel10-ci-macos-claude/lifecycle.json) | [Codex PASS](rel10-ci-macos-hud-codex/hud-lifecycle.json), [Claude PASS](rel10-ci-macos-hud-claude/hud-lifecycle.json) |
| Linux/WSL | [PASS](rel10-ci-wsl-codex/core/lifecycle.json) | [PASS](rel10-ci-wsl-claude/core/lifecycle.json) | [Codex PASS](rel10-ci-wsl-codex/hud/hud-lifecycle.json), [Claude PASS](rel10-ci-wsl-claude/hud/hud-lifecycle.json) |
| Native Windows | [PASS](rel10-ci-windows-codex/core/lifecycle.json) | [PASS](rel10-ci-windows-claude/core/lifecycle.json) | Unsupported |

[macOS independent review](rel10-ci-macos-independent-review.md) and
[remote independent closure](rel10-final-ci-native-independent-closure.md) passed after checking actual command
output. The initial remote [INCOMPLETE review](rel10-final-ci-native-independent-review.md) and
[raw-log recovery](rel10-final-ci-raw-log-closure.md) are retained. Flat compact metadata is accompanied by the
complete per-cell logs; metadata alone did not establish host acceptance. All current bytes are CI-produced; the
historical-uncommitted limitation in the generic core report applies to the previous `f07df7…` fixture.

The [final payload audit](rel10-ci-public-assets-audit.md) passed the exact public allowlist and exclusion checks.
Only nested compressed engine streams differ from the local candidate; extracted files match, but these remain
separate archive identities with their own native evidence. The exact CI archive and metadata were delivered to
`C:\Users\woo\Downloads\BoxBox\0.2.4\ci-39646320662-1-ebfe6a77`; both WSL and native PowerShell verified the digest.
See the [delivery report](rel10-final-ci-native-report.md) and [hash evidence](rel10-final-ci-native-ebfe6a77/remote-native-powershell-hash.txt).

[Release-document corrections](rel10-release-docs-independent-closure.md) passed independent review. The installed
0.2.3 development [whole-session hook limitation](session-hook-boundary.json) is recorded separately; passing
focused checks does not turn that historical-input/refused-profile result into a whole-session hook PASS.

Pending release gates remain: the hosted macOS CI job, new rule/example decisions, release-package license alignment,
authenticated Claude/current Windows hook and applicable UI acceptance, and publication authorization/access.
The candidate has not been published; no live host profile, persistent trust or repository visibility was changed.

## Durable path map

Recorded review prose and manifests retain the scratch paths they originally inspected. The
[machine-readable path map](durable-path-map.json) resolves those retained references without changing original
reports. Except for its listed exceptions, `/tmp/boxbox-readiness/<path>` maps to `<path>` beneath this directory.

| Scratch reference | Retained repository evidence |
| --- | --- |
| `ci-candidate-39646320662-1-early/candidate.json` | [Clean CI candidate](ci-candidate-39646320662-1/candidate.json) |
| `rel10-ci-raw-SHA256SUMS.txt` | [854-file remote raw manifest](rel10-ci-raw-SHA256SUMS.txt) |
| `rel10-final-ci-native-independent-review.md` | [Initial INCOMPLETE review](rel10-final-ci-native-independent-review.md) |
| `rel10-final-ci-native-independent-closure.md` | [Independent raw-log closure](rel10-final-ci-native-independent-closure.md) |
| `rel10-ci-macos-independent-review.md` | [macOS independent review](rel10-ci-macos-independent-review.md) |
| `rel10-ci-wsl-codex/core/lifecycle.json` | [WSL Codex core and adjacent logs](rel10-ci-wsl-codex/core/lifecycle.json) |
| `rel10-ci-wsl-claude/core/lifecycle.json` | [WSL Claude core and adjacent logs](rel10-ci-wsl-claude/core/lifecycle.json) |
| `rel10-ci-windows-codex/core/lifecycle.json` | [Windows Codex core and adjacent logs](rel10-ci-windows-codex/core/lifecycle.json) |
| `rel10-ci-windows-claude/core/lifecycle.json` | [Windows Claude core and adjacent logs](rel10-ci-windows-claude/core/lifecycle.json) |

The primary `manifest.sha256` uses repository-relative paths and binds the complete retained directory.
Older absolute-path manifests require the mapping above. Tarballs, temporary workspaces and dependency caches are
not retained; their absence is intentional and is not treated as a successful local archive rehash.
