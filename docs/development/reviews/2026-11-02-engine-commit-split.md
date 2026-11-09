# Semantic reconstruction of the engine commit

Original commit `93fc6c3` combined engine behavior, measurement tools, formatting, evidence and source numbering.
The user requested semantic commits. A new branch, `refactor/engine-stability-split`, starts at `13e9ced`;
the original branch and pushed commit are preserved.

| Commit | Boundary |
|---|---|
| `afd6ef5` | Correct minimum-width alignment columns |
| `bf54c29` | Preserve Python source through AST analysis |
| `8100518` | Expose read-only planner column measurements |
| `cbcf95e` | Exclude protected content from padding alarms |
| `f9ba2fe` | Align supporting engine tables |
| `05f215b` | Retain frozen engine verification evidence |
| `57cc86e` | Number flat engine files contiguously |
| `fce37e7` | Align mutable inspection records |
| `613241b` | Combine equivalent detector admission guards |

The first seven commits reconstruct the original content exactly: `57cc86e` and `93fc6c3` both have Git tree
`064efd2222506d4b53243c03fd0099b45304afcd`. Tests travel with each behavior change. Historical cross-feature
evidence is retained unchanged in its own commit. Current source paths move only with the numbering contract.

The following CI closure is separate. `fce37e7` aligns fourteen mutable issue records, their Python validator and
the Python analysis helper; JSON values/history, Python AST/token strings and TypeScript tokens/comments are
preserved. `613241b` combines three identical-outcome registry admission guards in the original short-circuit
order. This resolves competing return-guard/if-header column targets. Four exact before/after CLI captures and
57 TypeScript tests pass; both current and pinned checkers accept the registry.

The pinned local gate initially found seventeen violations among 156 targets. The unchanged 139 passing files
retain their verified hashes; scoped reruns pass the sixteen formatting files and the registry. All 156 final
file hashes match actual passing receipts under the same checker, bundle and configuration identities. This is
impact-scoped local verification, not a hosted Actions result.

The final frozen required-parser full run recorded **732 pass / 3 fail / 735 tests / 78 files** and zero drift
across 1,521 inputs. Two installer failures reported ENOSPC; one layout test reached its 60-second timeout.
After clearing regenerable caches while preserving pinned dependencies, the exact three tests passed:
**3 pass / 0 fail / 23 filtered out / 113 expectations**, with source unchanged. The original failed full receipt
is retained and is not relabeled as a successful full invocation. TypeScript, shell syntax, plugin drift and both
official strict plugin validators subsequently passed. The source candidate is `ee0e4a3686e2fe13`.

The CI document now records the observed public repository and active main-branch checks; the release inventory
uses current source filenames. No rule approval, release version, lint baseline or publishing policy changes.

The read-only GLM source/history attempt reached 180 seconds without a final verdict; a smaller no-tool closure
attempt reached 120 seconds without a response. Neither is PASS, and neither replaces the earlier bounded engine
reviews. Native Windows/WSL host verification remains unrun. The reconstruction loop used 12 of 12 bounded cycles.

The [portable evidence record](2026-11-02-engine-commit-split-evidence.json) binds the commit series, tree identity,
source hashes, actual full-run failure, scoped recovery, pinned-checker composition and incomplete review attempts.
Full transcripts remain private. This documentation closure records those bounds without changing the frozen engine.
