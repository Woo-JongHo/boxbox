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
