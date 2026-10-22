# Matrix authoring workflows and alignment-only candidate

Date: 2026-10-21. Version: **0.2.4**, unpublished. Source baseline: `07f568c` plus the existing uncommitted
worktree and AUTHOR1 changes. Prior HUD, documentation and localization work was preserved.

## Verdict

Implementation and the verification listed below passed. Initial Sonnet/Opus requests hit a session limit. After the
reported 21:20 Asia/Seoul reset, a tools-disabled Sonnet response produced no valid verdict; it is retained as
inconclusive. A fresh restricted read-only Sonnet 5.5 review returned PASS, with non-blocking follow-ups. The user
then explicitly selected **GLM instead of Opus** for this task's final audit. GLM 5.3 returned **PASS: no blocking
defect or mandatory fix**, using read/search/find tools only. Both reviews were static and did not rerun tests.
The bounded AUTHOR1 implementation is verified; broader authoring evaluations and public release remain separate.

## Implemented boundary

- Write and Refactor are host-agent workflows. The agent owns code edits and relevant behavior/performance checks.
- `guide --authoring` handles existing, empty and missing target files without reading or creating their contents.
  It resolves language/scope keys through the existing layered approval gate, returns the proved contract, positive
  examples and counterexamples, then rechecks provenance. `verification=not-run` and `writeAuthorized=false` are explicit.
- `align` excludes external formatters and adds an exact physical-layout/protected-content guard to the existing
  approval/parser/fixed-point/atomic-write pipeline. A vertical layout proposal is refused; the original survives.
- Align preview returns actual changed lines. Both JSON and text previews preserve the target. Existing `format`
  keeps its optional formatter and broader layout behavior.
- Generated Codex/Claude skills and EN/KO/Simplified Chinese README guidance share these routes. The approved
  preset is unchanged. Public execution remains TypeScript/Python; JSON/YAML remain planned.

Owner sources and maintenance flow are documented in [inspection process](../inspection-process.md);
user-facing commands and verification limits are in [modes](../../user/modes.md).

## Verification

| Check | Observed result | Evidence |
| --- | --- | --- |
| `bun run check` | 554 passed, 5 existing missing-parser skips, 0 failed; typecheck and shell syntax completed, exit 0 | [full log](2026-10-21-authoring-modes-evidence/check.log) |
| Targeted CLI, installed public artifact and plugin contract | 16 passed, 419 assertions | [log](2026-10-21-authoring-modes-evidence/targeted.log) |
| Alignment guard and existing format pipeline | 48 passed, 143 assertions; actual vertical proposal refused by Align and retained by format | [log](2026-10-21-authoring-modes-evidence/alignment-tests.log), [worker report](2026-10-21-authoring-modes-evidence/alignment-worker.md) |
| Plugin guard | Drift, both strict validations, contract/hooks and real isolated host registrations passed | [log](2026-10-21-authoring-modes-evidence/plugin-guard.log) |
| Final installer archive | Real offline npm execution registered both native CLIs in disposable profiles; each installed launcher completed authoring Guide, Align preview/apply and Check | [summary](2026-10-21-authoring-modes-evidence/installed.json), [transcript](2026-10-21-authoring-modes-evidence/installed-transcript.json) |
| Independent skill forward-test | Write, Align preview and Refactor preview executed with real source CLI; both previews preserved targets | [report](2026-10-21-authoring-modes-evidence/behavior.md), [observations](2026-10-21-authoring-modes-evidence/behavior/observations.json) |
| Static checks | README code blocks/link targets match; approved preset unchanged; source alignment and diff checks passed | [checks](2026-10-21-authoring-modes-evidence/static-checks.json) |
| Initial Sonnet / Opus requests | Unexecuted: provider session limit | [Sonnet](2026-10-21-authoring-modes-evidence/sonnet.json), [Opus](2026-10-21-authoring-modes-evidence/opus.json) |
| Sonnet 5.5 retry | PASS, static read-only review; no test execution claimed | [review](2026-10-21-authoring-modes-evidence/sonnet-review.json), [earlier inconclusive response](2026-10-21-authoring-modes-evidence/sonnet-inconclusive.json) |
| GLM 5.3 final audit | PASS, no mandatory fixes; user-selected replacement for Opus; static read-only audit | [full verdict](2026-10-21-authoring-modes-evidence/glm-review.md), [execution metadata](2026-10-21-authoring-modes-evidence/glm-execution.json) |

The skill test separately parsed/executed the new Python code and compared 160 original/proposed refactor inputs,
including NaN/infinity. This is bounded evidence, not a general semantic-equivalence or performance proof. Function
control flow produced zero detected groups and was explicitly reported outside matrix-check coverage. Automatic
skill selection/non-selection, broader authoring quality, native model conversations and Windows mode execution
remain unmeasured. An observed readiness hint recommending only `format` was updated to distinguish Align and format.

Recorded behavior artifacts are copied from the isolated workspace. Source/script snapshots retain their bytes
under `.txt` suffixes so intentionally misaligned fixtures are evidence rather than product sources; the
[path map](2026-10-21-authoring-modes-evidence/artifact-path-map.json) maps original names. Reports retain their recorded
temporary paths. [Source hashes](2026-10-21-authoring-modes-evidence/source-hashes.json) identify the tested candidate.

The existing persistent TypeScript API occasionally stalled in repeated in-process test workflows; the new vertical
integration uses fresh real subprocesses, as CLI calls do. The full suite passed without changing production behavior.
This observation and test-development corrections are retained in the worker report.

## Non-blocking follow-ups

Both reviewers found no reachable content corruption or approval bypass in the current writer/preset combination.
The underlying TypeScript token guard is not JSX-aware and its regex heuristic is incomplete; the Python guard has
an overly permissive digit/dot whitespace case. GLM traced the actual writer boundaries and found that these proposals
are not produced by the current writers. Keep these defense-in-depth gaps visible before extending editable shapes.
Other optional work is typed ENOTDIR errors for missing-target ancestors, clearer alignment/readiness output naming,
additional negative cases and a partial-guidance indicator. No new convention or parser coverage was approved here.

The full GLM event transcript stays in the recorded local scratchpad; its hash and complete final response are retained
above. The current source hashes still match the candidate verified by the tests and reviews.

## Candidate delivery

The archive is `boxbox-plugin-0.2.4.tgz`; its size and SHA-256 are in
[candidate metadata](2026-10-21-authoring-modes-evidence/candidate.json). Local active host profiles remain on 0.2.3;
0.2.4 installation was verified in isolated profiles. HUD2's earlier independent-review blocker remains separate.
The archive, metadata and test instructions were delivered through SSH `chacada` to
`C:\Users\woo\Downloads\BoxBox\0.2.4\modes-preview-20261021`. The
[remote checksum](2026-10-21-authoring-modes-evidence/remote-sha256.txt) matches the local archive. SFTP did not
progress, so the transfer used an SSH byte stream. No remote installation or npm publication was performed.
