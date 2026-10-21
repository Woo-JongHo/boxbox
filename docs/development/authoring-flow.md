# Authoring flow design — writing new code and modifying code

Status: Codex cross-review applied (M1.8 S3.5–S3.6) · Date: 2026-09-30 · Review record: `docs/reviews/2026-09-30-codex-authoring-flow-review.md`

## 1. The main axis: NEW and MODIFY

An agent writes code in one of two situations. Their risks point in opposite directions, so they get separate rules.

| | NEW (writing new code) | MODIFY (changing existing code) |
|---|---|---|
| Goal | write in the patterns and conventions from the start | fit only the changed part to the conventions and leave the rest alone |
| Biggest risk | writing without knowing the conventions | changing untouched code and polluting the diff, review and git blame |
| Strictness | high: every alarm is this author's responsibility | low: existing and new alarms are told apart |

**The decision uses the pre-change baseline, not the path or the shape of the diff.**
- Before the edit, record the **baseline** (the file content right before the edit). If the file did not exist, the baseline is an empty file.
- For each table in the result, check whether the baseline had **a table of the same pattern in the same place**. If not, it is NEW; if so, MODIFY.
- So renames and delete-then-recreate are judged against the baseline, and an added section that adds rows to an existing table is MODIFY.

Generated code, vendored code, formatter-owned files and tests are not a top-level axis but a **scope and ownership policy**, set by the config's `scopes` (for example, `vendor/**` off, `test/**` genre `TEST`).

## 2. Flow

```
[before writing]  record the baseline + inject GUIDE
   NEW    : 3 core lines + this path's genre + a summary of this language's conventions and examples
   MODIFY : 3 core lines + only the patterns and conventions of the tables in the area being edited (short)
      ▼
the agent writes
      ▼
[after writing]  compare the report with the baseline
   · safety check failure → reported as a failed task (separate from alarms)
   · newly introduced alarms → sent to the agent; the agent simplifies and fixes
   · existing alarms → only marked separately (not this author's responsibility)
      ▼
alarms that need a verdict → review-queue (with evidence, baseline and proposed diff, duplicates grouped) → human approval → convention and example DB
```

## 3. MODIFY rules

1. **Judge per table:** look only at tables overlapping the edited lines. If the table **was already aligned** before the edit (PASS in the baseline), it becomes an alignment target again after the edit. If it was not aligned, only alarms are given. No ratio rule that declares the whole file legacy is used (the threshold is arbitrary and blocks even small edits).
2. **Responsible only for new alarms:** **pair** the baseline's and the result's alarms **by kind and target (pattern, table location)**, and give the agent only the newly introduced alarms. Never compare alarm totals (one disappearing and one appearing would pass).
3. **Recompute ranges:** when an edit or the formatter moves lines, table boundaries change. Ranges are recomputed from the result file.
4. **No behavior change:** the hook never changes the meaning of the edit the agent requested.

## 4. Hook execution contract

Before writing files automatically, confirm and settle the following on the real host. **On a host where this is not confirmed, automatic alignment stays off.**

- Is it guaranteed that boxbox runs after the formatter (charter invariant 11)?
- How are the final content and diff of a file the hook changed returned to the agent (so the agent's memory of the file does not go stale)?
- Multi-file edits: a baseline per file, failure handling per file, marking partial success.
- Preventing duplicate runs on retries.
- Latency: about 0.3 s per file for TypeScript. Measure the cumulative latency over consecutive edits and multiple files.

Common rules:
- Hooks are the host adapter layer (the Agent Skills standard has no hooks). Every hook only calls the same CLI.
- Users can turn them off: all off / report only / including alignment.

## 5. AI boundary

- Agents receive alarms and may write verdict suggestions to the review-queue.
- Agents **cannot call the approval path that writes to the convention and example DB.** Only humans run the approval command (charter invariant 8).
- Queue entries hold the evidence, the baseline and the proposed diff, and duplicate suggestions for the same target are grouped into one.

## 6. First release scope

| Include | Defer |
|---|---|
| one host (Claude Code) | Codex and Cursor adapters |
| GUIDE injection before writing | automatic whitespace alignment (after confirming the host execution contract) |
| a **read-only** report after writing | DB approval wiring |
| baseline recording, edit ranges, separating new and existing alarms | |
