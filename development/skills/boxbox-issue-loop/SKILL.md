---
name: boxbox-issue-loop
description: Resolve recurring BoxBox implementation or readability mistakes through reproduction, primary-rule review, an issue, a scoped fix, and verification before authorized commit and push. Use for repeated failures or disputed rule exceptions in this repository.
metadata:
  version: "0.1.0"
---

# BoxBox issue loop

This is a repository-local developer skill, separate from the shipped `boxbox` skill. Work within the current user request and existing permissions. Read repository `AGENTS.md` and the relevant contract reached through `docs/development/README.md`; keep commands in their current owners (`package.json`, tool `--help`, CI configuration).

## Establish the case

1. **Locate.** At entry, after resuming or switching worktrees, inspect `pwd`, `git status --short --branch`, the real Git root, branch and HEAD. Recheck that identity before staging or publishing. Identify the intended GitHub repository from the actual remote URLs; this repository's `origin` can point elsewhere. Set a finite attempt budget and list owned paths, unrelated changes and checks needed for this case. Complete when the working copy and intended destination are explicit.
2. **Reproduce.** Save the smallest input and exact command that demonstrate the observed failure, expected result and baseline result. Preserve the input bytes and record how the user-visible defect is observed. Complete when a second run can expose the same defect; a claim that cannot yet be reproduced remains a hypothesis.
3. **Ground the rule.** Read the primary rule with its scope and the closest counterexample before choosing a fix. Record their paths/sections and the exact construct being judged. For example, public Port/method JSDoc exceptions do not establish an exception for same-role `readonly` data fields such as `Slot.axis`, `Slot.text` and `Slot.gapBefore`. Test the boundary with both applicable and inapplicable examples. Complete when every disputed exception has direct authority or is explicitly unresolved.
4. **Track.** Find a matching issue in the verified repository; reuse it or create a focused issue when already authorized. Include the reproduction, primary rule, counterexample, acceptance criteria and verification limits. An existing authorization remains valid; ask only for a genuinely missing required fact or permission. If issue writes are outside the current scope, prepare a reviewable issue draft and report that limit. Complete when the issue URL or pending draft is recorded.

For the confirmed data-field case, measure both the colon and the type start from the longest actual field name. This accepted example keeps both boundaries equal despite the JSDoc:

```ts
interface Slot {
	/** Cell role. */
	readonly axis      : string;
	/** Original content. */
	readonly text      : string;
	/** Original preceding gap. */
	readonly gapBefore : string;
}
```

Record the measured columns for every proposed row before accepting a layout. Derive them again when names or types change. The example is a data-record case, not authority to combine documented Port methods or capabilities.

## Close the findings

5. **Fix narrowly.** Implement the smallest change that closes the reproduction and preserves behavior outside it. Use the current language tools on touched files; after manual edits, inspect literal whitespace, indentation and recalculated column widths. Token/AST preservation proves a different property from readable indentation. `NO_GROUPS` means no detected groups; inspect uncovered regions directly. Complete when regression cases pass and all visual findings have an evidence-backed disposition.
6. **Challenge the interpretation.** Give an independent read-only reviewer the diff, raw rule sections, closest counterexample, reproduction and a concrete checklist. Give ownership/exclusions and acceptance commands when delegating. Treat every reviewer assertion as a hypothesis: record the claimed scope, concrete lines, evidence, and an `accepted`, `rejected` or `unresolved` disposition with reasons. Provider agreement does not prove correctness. Apply the repository's required review models; record unavailable required review as a blocker. Complete when all findings are resolved by evidence, including whitespace/coverage findings; postpone the full check until then.

Store full delegated/CLI logs in a private scratch directory outside tracked source. Keep only a 3–5 line verdict, relevant artifact hashes and raw-log paths in the main conversation. Public records contain reproducible facts needed by contributors, without depending on private logs. After three attempts for the same cause, stop retrying, write the diagnosis and choose a materially different experiment before another run.

## Freeze and verify

7. **Freeze the selected candidate before full checks.** Finish edits and stop any test, watcher or worker that temporarily mutates files or the changed-file set. Recheck root/branch/status and explicitly enumerate the selected existing files, including untracked inputs that matter to the change. Record selected deletions and intentional Git symlinks separately, including each link's target; the helper never follows them. Capture regular files with [the snapshot helper](scripts/snapshot.py) to a new file outside the checkout. This capture is a prerequisite for the full check and final review; a snapshot created afterward cannot attest to an earlier run. Complete when scope is explicit and no writer is still active.
8. **Run full checks once per candidate.** Verify the captured snapshot immediately before starting the current full repository check and required final read-only review. Focused regressions can already have run while editing; repeat them only for affected changes. Independent read-only work can run in parallel only if neither command alters the other's inputs. After mutation tests exit, run the current changed-file lint with a stable selection and its intended base/target. Inspect its file list, exclusions, unsupported ranges, checker identity and report, rather than just its exit status. Verify the same selected snapshot again after the checks, and bind each result to that capture. Complete when every required check has a result on these bytes and all gaps are named.

Changes to shipped source invalidate checks they can affect; fix, refreeze and rerun those checks. Documentation/evidence-only edits do not force host-matrix reruns. Report local checks as local: source CI and native host cells count only when actually run. A snapshot match covers only its listed files, root and branch; separately compare the final changed-path inventory so newly added or deleted paths cannot escape the candidate.

When a confirmed new shape conflicts with an older immutable checker, use the [checker-pin transition](references/checker-pin.md). Preserve the old/new reproduction and the source's accepted layout; this branch of the workflow needs separate evidence before publication.

## Deliver within authorization

9. **Review the final diff.** Inspect every owned path, scan changed files for unfinished placeholders, disabled tests and unimplemented branches, and account for every changed path. Compare the working-copy identity and selected bytes with the frozen candidate. Complete when the issue criteria, review dispositions, test results, skipped checks and remaining blockers are reviewable.
10. **Commit and push when authorized.** Respect authorization already given; do not ask for it again. Stage only the intended paths, inspect the staged diff, commit, and push to the verified remote and branch explicitly. Confirm the resulting commit and remote branch; recheck selected bytes after the commit. HEAD advancing alone does not invalidate unchanged source evidence. Complete when the requested local/remote result is confirmed, or a concrete authorization/environment blocker is reported. Never infer network-write permission from loading this skill.

## Selected-file snapshots

Use Python 3 and explicit repository-relative regular-file paths; directories, symlinks, missing files and traversal are refused at capture. Runtime snapshot files live outside the checkout. Invoke the helper relative to this skill's directory, with actual task paths:

```text
python3 scripts/snapshot.py capture --root REPOSITORY --snapshot PRIVATE_JSON -- FILE_A FILE_B
python3 scripts/snapshot.py verify --root REPOSITORY --snapshot PRIVATE_JSON
```

The JSON output and snapshot have schema version 1. Exit `0` means capture succeeded or selected files match; `1` means verification found content, mode, deletion or root/branch changes; `2` means invalid input or an unsafe/unreadable file. A different HEAD is reported as provenance only. The helper performs no checks, Git mutations, network calls or approvals. Run its own tests with `python3 -m unittest discover -s development/skills/boxbox-issue-loop/tests -v` from the repository root when changing it.
