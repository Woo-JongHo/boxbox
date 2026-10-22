# Inspector model pilot: results

Protocol: [PROTOCOL.md](PROTOCOL.md), committed as `e25e71a` before the first run. Log of events and deviations:
[LOG.md](LOG.md). Raw per-run material is in [runs/](runs/): the CLI's JSON result and the inspector's full report for each run.
This is a small descriptive pilot (one file, three runs per condition); it supports no significance claim and does not
by itself change what the plugin ships.

## Setting

Claude Code 2.1.280, native Windows, boxbox 0.2.5 (CI archive `5fe739f5…2196a`). Condition A: the installed inspector,
which inherits the caller's model (`claude-opus-5-5`, effort medium). Condition B: the same definition with one added line
`model: sonnet`, which resolved to `claude-sonnet-5` in the session records. The main session was Opus in both. File:
the repository's `approval-gate.ts` at its first commit (228 lines); the engine's own `check` reports 20 groups, 8 `FIXABLE`.
Order A B A B A B, each run a fresh session; the file hash and the agent-definition hash were checked after every run and
matched the protocol.

## Runs

"Printed cost" is the figure Claude Code printed; it is not recomputed. In A the Opus figure covers the main session and the
inspector together; in B the Sonnet figure is the inspector (the main session never used Sonnet). Subagent output tokens are
derived (see Errata). "Points at" counts the engine's 8 `FIXABLE` groups whose lines the report cites (lenient scorer).

| Run | Cond | Printed cost (USD) | Opus part | Sonnet part | Wall time (s) | Subagent turns | Subagent output tokens | Subagent cache-read tokens | Points at |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | A | 0.7112 | 0.7112 | none | 92 | 4 | 7,479 | 105,916 | 7 of 8 |
| 2 | B | 0.5187 | 0.2558 | 0.2629 | 115 | 6 | 8,590 | 219,803 | 7 of 8 |
| 3 | A | 0.6553 | 0.6553 | none | 86 | 3 | 6,562 | 70,896 | 8 of 8 |
| 4 | B | 0.4839 | 0.2522 | 0.2317 | 110 | 5 | 6,828 | 168,386 | 8 of 8 |
| 5 | A | 0.8069 | 0.8069 | none | 144 | 6 | 10,169 | 242,898 | 5 of 8 |
| 6 | B | 0.8293 | 0.2771 | 0.5522 | 306 | 15 | 21,260 | 859,528 | 8 of 8 |

| | A (inherited Opus) | B (sonnet inspector) |
| --- | --- | --- |
| Printed cost, mean (range) | 0.7244 (0.6553 to 0.8069) | 0.6107 (0.4839 to 0.8293) |
| Printed cost, median | 0.7112 | 0.5187 |
| Wall time, mean (s) | 107 | 177 |
| Subagent turns, mean | 4.3 | 8.7 |
| Subagent output tokens, mean | 8,070 | 12,230 |
| FIXABLE groups pointed at, mean | 6.7 of 8 (0.83) | 7.7 of 8 (0.96) |

Total printed cost of the six runs: 4.0053 USD, under the 6.00 USD budget in the protocol.

## Outcome under the pre-registered decision rule

The rule needed both conditions: strict recall of B at least that of A minus 1/8, and B's mean printed cost at most 70% of A's.

- **Strict recall:** 0 of 8 in all six runs. This measure is uninformative. The reports are written in Korean and give
  line numbers as bare ranges such as `25–28`, while the strict scorer reads only explicit `line N` or `L N` references.
  The criterion is met only trivially (0 against 0). The error is the author's: the scorer was tested on English text
  and not on a realistic report.
- **Cost:** mean ratio B to A is 0.843, above the 0.70 threshold. **Not met.**
- **Result of the rule:** Sonnet is **not carried forward** on the cost criterion.

The lenient scorer, defined in the protocol as a secondary measure, gives B at least A's recall in every pair of means
(0.96 against 0.83). It also credits any in-file number range, so it cannot tell a correct finding from a number mentioned in
passing, and it says nothing about false alarms: both conditions list the passing groups too.

## Exploratory observations (not pre-registered)

- Median cost ratio is 0.73, because one B run (run 6) cost more than any A run. The mean is the pre-registered statistic.
- A fixed part of every run is outside the plugin's reach: the main Opus session cost about 0.26 USD per run in B
  (0.2522 to 0.2771). Taking that as the main-session share, the inspector alone cost about 0.46 USD in A (estimated as total minus
  0.26) and 0.35 USD in B (the Sonnet figure), a ratio of about 0.75. The A figure is an estimate.
- Sonnet used about twice the subagent turns (8.7 against 4.3), about 1.5 times the output tokens and read much more context
  (mean 416K against 140K cache-read tokens). Run 6 took 15 subagent turns and 306 seconds.
- Spot check of the reports' own factual claims against the file, by hand, six claims in three reports: the comma and
  `return` columns (relative positions matched; absolute values were consistently one lower than counted here, consistent with not counting
  the leading tab), the 13 and 1
  spaces to add on lines 151 and 154, that line 152 is not a guard, that the `;` of lines 1, 2, 10, 21 and 22 sits in column
  91, and that lines 214, 218 and 219 exceed 200 characters (208, 232 and 267). All were accurate. This is not a grading of
  the advice and not a check of all six reports.
- Both conditions added unrelated remarks about the machine's MCP connectors to the end of some reports. Review the saved
  texts before publishing them.

## Errata for earlier records

1. **Output tokens in subagent records are lower bounds.** Input, cache-read and cache-write figures matched Claude Code's own
   accounting exactly in all ten non-interactive runs (4 baseline, 6 pilot). Output tokens matched exactly for the three runs
   without a subagent, were 10% low for the baseline inspector run and 4.3 to 8.6 times low for the six pilot runs. The cause
   is not established; the subagent record's `usage.output_tokens` evidently does not carry the final count. Subagent
   output tokens above are derived as the CLI's total minus the main session's recorded output.
2. This corrects the earlier baseline record and proposal table. For the baseline inspector request the CLI reports 3,370
   output tokens (not 3,026) and the subagent produced about 2,131 of them (63%, not 59%). The turn counts, cache figures,
   printed costs and the check, write and align rows were right. The usage reader now says so in its output.
3. The two earlier measured sessions (this development session and the Windows project session) had no subagent records, so
   their figures are unaffected.
4. The strict scorer failure above.

## Limits

One file, one operator, three runs per condition; the model's own variance is not estimated. The Opus and Sonnet runs differ in
turns as well as in model, so cost differences mix price, verbosity and process. Quality of advice was not graded.
The conclusion is only that this pilot does not support switching the inspector to Sonnet for cost. A larger run would use
more files, a scorer that reads the reports, and a human grading of the advice.
