# Decision: py-simple-assignments

Status: approved convention. Scope: `**/*.py`.

The engine may align runs of three or more consecutive simple name assignment
rows that share the same indentation level, regardless of how deep that level
is. The rows form a `DEFINE` table whose columns line up on the `=` axis.

Boundaries of this approval:

- Only the exact lookup key `v1|python|-|table|name>equal>value`.
- Only simple `name = value` assignment rows; compound assignments, mixed
  indentation, and other languages are out of scope.
- A run of only two rows is reported as a suggestion and is never rewritten
  automatically; three rows are the approved minimum.

Evidence recorded with the candidate: the safe write path reports
`parse.status=ok` with a runnable `python3`, a re-check reaches the
`PASS` fixed point with `misaligned=0` and `edits=0`, the line engine
reports no content change outside horizontal alignment spaces, and the
two-row boundary counterexample produces no edits with identical SHA-256
before and after.
