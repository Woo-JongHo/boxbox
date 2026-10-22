# Inspector model pilot: log

Entries are appended as things happen. Times are KST on the test machine unless stated.

## Before the runs

- Earlier single-run baseline on a three-line file (check, write, align, inspector request on the inherited model), recorded in
  `docs/development/issue-library/evidence/inspector-baseline-sessions.txt`. Not part of this pilot's comparison.
  Deviations there: the measuring tool was extended mid-analysis to read subagent records and the Windows `node -e` bridge, and
  the evidence was re-generated with the final tool; a shell loop failed once in the assistant's own shell and was redone.
- The assistant's remote shell on the test machine does not expand shell variables set inside the same `ssh` command; all
  remote commands in this pilot use literal paths.
- File chosen and hash-checked on both machines (SHA-256 `6df6d87b…a60b`). Ground truth taken from the installed engine.

## Runs (2026-10-22, KST on the test machine)

Protocol committed as `e25e71a` at 2026-10-22T17:25:04+09:00 (git committer date), before the first run.

- First attempt of stage 1: a helper script was loaded with dot-sourcing and the machine's execution policy refused it, so
  nothing ran. Checked afterwards: agent definition and file hashes unchanged, no session created. The execution policy was
  not changed or bypassed; the helper was merged into one encoded command.
- Stage 1 (runs 1 and 2): both ran, but the script's per-run summary line was swallowed by PowerShell's pipeline (a bug in
  the assistant's script), so only `cumulative_cost=0` was printed. The runs were recovered from the saved JSON files; session
  ids, costs and durations are taken from those.
- Stage 2 (runs 3 to 6): fixed to print the summary directly. Per run, the agent-definition hash was `6baf37d74349…` for A and
  `f0b2ef6a95d2…` for B, the file hash was unchanged, exit code 0. Run starts (KST): run3 17:41:36, run4 17:43:05,
  run5 17:44:59, run6 17:47:27. After the last run the installed definition was restored and its hash matched the protocol.
- Cost guard: stage 2 stopped at a stage total of 4.7 USD or more; it did not trigger (stage total 2.7754 USD).
- Condition B was confirmed from the data, not assumed: B runs show `claude-sonnet-5` in the CLI's `modelUsage`; A runs do not.

## After the runs

- The pre-registered strict scorer returned 0 of 8 for every run. Reading the reports showed why (Korean text, bare ranges).
  The strict result is reported as it was; no scorer was changed and re-run to produce a better number.
- Comparing the CLI's `modelUsage` with the session records showed that subagent records undercount output tokens. This
  invalidated output-token figures published earlier in this repository's baseline record and proposal; corrections are in
  RESULTS.md (Errata). Cache and input figures were unaffected.
- Saved raw files: Windows user names were replaced by `<user>` in the CLI JSON copies (`runs/*.cli.json`). The report texts
  are the models' output, unedited. The copy of the analysis script has local paths replaced by placeholders.
- Cost to the machine owner's account: 4.0053 USD for these six runs; with the 1.4797 USD baseline runs earlier the same day,
  5.4850 USD in total.
