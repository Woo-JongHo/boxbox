# Inspector model pilot: protocol (written before any run)

Recorded 2026-10-22 and committed before the first run of this pilot. It is a small descriptive pilot, not a statistical
test: with three runs per condition no significance claim is made. Everything that happens is logged in `LOG.md`,
including deviations. The results go into `RESULTS.md` only after this file is committed.

Related: [issue 020](../../issue-library/records/BBX-20261022-020-model-effort-assignment.json), the
[proposal](../../proposals/2026-10-22-model-effort-assignment.md) and the earlier single-run
[baseline](../../issue-library/evidence/inspector-baseline-sessions.txt) on a three-line file ("pilot 0").

## Question

BoxBox's `readability-inspector` subagent inherits the caller's model. Would a lighter model (`sonnet`) do the same job on a
realistic TypeScript file for less, as measured by the engine's own result? This is the only AI step whose model the plugin
can set (see the proposal).

## Conditions

| | A: inherited | B: sonnet |
| --- | --- | --- |
| Inspector model | The caller's model. The test machine's default is `claude-opus-5-5`; the resolved ids are recorded from the session records | `model: sonnet` added to the installed agent definition |
| Inspector effort | `medium` (the installed definition) | `medium` (unchanged) |
| Main session model | The machine default, identical in both conditions | identical |

Condition B is made by inserting one line, `model: sonnet`, after `effort: medium` in the installed
`plugin/agents/readability-inspector.md` and restoring the backup afterwards. This is the same frontmatter the proposal's
`product/models.json` generates for the next candidate. The installed definition before the pilot has SHA-256
`6baf37d743491c8ae10468d30b8649540fd56af514b43da3dcee23d6dcddb55e` (2,277 bytes); its hash must match again after the pilot.

## Material

- File: `approval-gate.ts.txt` here, installed as `approval-gate.ts` in an otherwise empty folder on the test machine.
  It is `product/engine/common/approval-gate.ts` as of commit `5e47bdd` (the repository's first commit), 228 lines, SHA-256
  `6df6d87b96ce7070dc806ee6db4f3b7f2a0d01854c4b338242f1cb59b133a60b`. It is this repository's own open-source code.
- Selection: among files whose first-commit version has 100 to 300 lines and at least three misaligned groups under the 0.2.5
  engine, take the one with the most misaligned groups. Seven candidates were scanned by engine counts only, and the rule
  was written down after that scan, as a description of it, not before. Outcome: out of the line range were `report.ts`
  (348 lines, 6 misaligned), `project-config.ts` (323, 6) and `eval.ts` (631, 10); below the threshold were `examples.ts` (1) and
  `corpus-triage.ts` (1); two qualified, `approval-gate.ts` (228 lines, 8) and `format-pipeline.ts` (238 lines, 3). No model ran
  on any candidate before the choice, so no model output influenced it.
- Ground truth: `ground-truth-check.json`, the installed 0.2.5 engine's `check` on the installed file. 20 groups, 8 `FIXABLE`,
  12 `PASS`, 0 `REFUSE`, syntax valid, no approved rule applies (`approvalEligible: false`).

| Lines | State | Kind |
| --- | --- | --- |
| 25-28 | FIXABLE | registration |
| 87-89 | FIXABLE | declaration-call-envelope |
| 94-95 | FIXABLE | declaration-call-envelope |
| 128-129 | FIXABLE | declaration-call-envelope |
| 131-132 | FIXABLE | declaration-call-envelope |
| 135-136 | FIXABLE | declaration-call-envelope |
| 149-150 | FIXABLE | declaration-call-envelope |
| 151-154 | FIXABLE | return-guards |

The other twelve groups are `PASS` (interface members, equals declarations).

## Procedure

- Host: Claude Code 2.1.280, native Windows, `boxbox@boxbox-plugins` 0.2.5 installed from CI archive
  `5fe739f5bacc814873d971cb9a01a2af12d0a7c30586ac90fe8a8a22c2d2196a`.
- Each run is a fresh non-interactive session: `claude -p --dangerously-skip-permissions --max-turns 15 --output-format json`,
  prompt on standard input, working folder = the pilot folder. Prompt, identical for every run:
  `Use the readability-inspector agent to inspect only approval-gate.ts and report its findings.`
- Six runs, interleaved A B A B A B, to spread machine and time drift evenly. The agent definition is set for each run
  immediately before it. The file hash is checked after every run (the inspector is read-only; a changed hash invalidates the run).
- Saved per run: the CLI's JSON result (final report text, session id, turns, duration, the cost Claude Code printed), the
  session record and the subagent record measured with `development/tools/session-usage.ts`.

## Measures

1. Tokens by main session and subagent, turns and wall time, and the cost Claude Code printed. Prices are not recomputed.
2. Report score from `development/tools/score-inspector-report.ts`, defined and tested before the first run:
   how many of the 8 `FIXABLE` groups the report points at by line number (strict: an explicit "line(s) N" or "L N" reference;
   lenient: also a bare `a-b` range), how many `PASS` groups it points into, the misaligned counts it claims, and citations
   outside the file.
3. The full report text is kept. A human reading is **not** part of this pilot's score and has not been done; the score
   measures only whether the inspector located what the engine found, not whether its advice is sound.

## Decision rule (descriptive)

Sonnet is worth a larger evaluation if, over the three runs per condition, its mean strict recall is at least the inherited
condition's mean minus 1/8, and its mean printed cost is at most 70% of the inherited condition's. Otherwise it is not
carried forward. Either way the pilot is reported as it is; it does not by itself change what the plugin ships.

## Budget

At most six runs plus any rerun of an invalid one. The earlier single runs cost 0.31 to 0.51 USD each. The pilot stops and
reports if the printed costs of its runs exceed 6.00 USD in total.

## Known limits (stated in advance)

- One file, one operator, three runs per condition: model variance is not estimated well, and the result will not generalize.
- The scorer reads line numbers from free text. It can miss a correct finding written without line numbers and can credit a
  number mentioned in passing; the strict and lenient scores bracket this. The saved texts allow a manual check.
- The engine marks formatting groups, not design quality. A good inspector answer also covers execution flow and risks that
  this score does not see.
- Model aliases (`sonnet`) resolve at run time; the resolved ids are taken from the session records.
- The machine's own settings, hooks and other plugins are unchanged and apply to both conditions.

## Disclosure

The pilot is run by the Claude Code assistant at the repository owner's instruction, on the owner's machine and account;
the cost is the owner's. Local user names in saved outputs are replaced by `<user>`; no other edits are made to saved raw
results, and any other edit would be listed in `LOG.md`.
