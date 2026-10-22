# Independent review — proposed Python calculation-assignment rule

Date: 2026-10-22
Scope: `docs/development/proposals/2026-10-22-python-calculation-rule.md`, `python-rule-proposal-evidence.json`, `python-rule-proposal-report.md`, checked against the frozen projection/selection implementation and shipped preset.

## Verdict

**PASS within proposal scope. No mandatory finding.** The proposal describes one unapproved exact key, two newly authored unlicensed examples, the three-row floor, implementation grammar and barriers, ownership priority, and current public refusal accurately. It does not create or imply a human approval or inherited license.

## Findings

- Exact identity is consistently `v1|python|-|table|name>equal>assignment-value`, with candidate ID `candidate-python-calculation-assignment-v1`, Python scope `**/*.py`, table kind and no container context. Search found neither candidate identity nor the new key in the recommended preset/base rule data.
- The proposal contains exactly two proposed examples: one `after-better` positive and one `bad` counterexample. Both are explicitly UNLICENSED and unapproved, and the text separates a future license decision from a future human rule decision. It creates no approval receipt, decision, content hash or preset entry.
- Minimum scope is three consecutive eligible physical rows at identical indentation. This matches the shared effective `Math.max(3, options.minRows)` floor and projection grouping by physical adjacency plus signature, whose signature includes indentation.
- Supported RHS grammar matches the implementation: ASCII simple-name targets; names/numbers, attributes, unary signs, listed arithmetic, parentheses and positional/nested calls. The RHS remains one opaque final `assignment-value` slot. Unsupported targets, keyword arguments, strings/containers/indexing, control expressions, unknown tokens, trailing whitespace, explicit/prior continuation, quote/bracket uncertainty and depth limit are described consistently.
- Ownership statements match `projectedRuns`: complete primary tables reserve before fallback selection and remain reserved after a preservation refusal; fallback tables claim before intersecting pairs; no selected table/pair owns a row twice.
- Positive machine evidence is internally exact: one three-row table, axes `name/equal/assignment-value`, widths `10/1/27`, two edits, alignment-only preservation and zero second-pass edits.
- Counterexample machine evidence proves detector eligibility only: raw aligner groups/tables/edits are zero and bytes remain unchanged. It does **not** execute or establish business behavior for the keyword-call function. The execution report explicitly says both examples were run through the frozen raw aligner, so the proposal's “executed independently” sentence is bounded by its linked report and does not substantiate a behavior claim.
- Public evidence records Check exit 1 with valid syntax and unknown approval, empty Guide, both Align modes refused with `ALIGN_NOT_ELIGIBLE`, and unchanged bytes. This is consistent with the preset containing only the old `name>equal>value` Python approval.

## Mechanical checks

- Proposal evidence JSON parsed successfully and all recorded positive/counterexample assertions inspected consistently.
- Four public-run records are present and each records `unchanged: true`.
- Search of `product/rules/presets/recommended` and `product/rules/base` found no candidate ID or new exact key.

## Limits

This review validates the proposal against the current frozen source and retained evidence; it does not approve the rule, license either example, independently rerun the public CLI commands, or establish counterexample business behavior. The separate source-test review's exact-native 180-case finding remains outside this proposal-document verdict and is being closed independently.
