# Proposed Python calculation-assignment rule

**Status: candidate public rule only. Not approved. Not present in the recommended preset.**

This proposal turns the frozen Python assignment-envelope implementation into one reviewable public-rule candidate. It
does not approve the implementation, the rule, or its examples. The shipped Python simple-assignment rule has a
different identity and cannot authorize this candidate.

The two example records below are newly written for this proposal. They are **UNLICENSED** pending a separate explicit
license decision. The existing repository MIT license and the CC0 status of older preset examples do not automatically
apply to these records. A future example-license decision would remain separate from rule approval.

## Exact candidate identity

| Field | Proposed value |
| --- | --- |
| Candidate ID | `candidate-python-calculation-assignment-v1` |
| Lookup key | `v1\|python\|-\|table\|name>equal>assignment-value` |
| Language / scope | `python` / `**/*.py` |
| Context / kind / axes | no container context / `table` / `name`, `equal`, `assignment-value` |
| Minimum rows | 3 consecutive eligible physical rows |
| Candidate operation | Align the outer simple-name and `=` columns; keep every RHS byte in one opaque final cell |
| Authorization | None; separate example-license and human rule decisions are required |

The candidate applies only to consecutive, same-indentation, one-physical-line assignments to simple ASCII names.
Their nonempty right-hand sides may contain the implementation's bounded calculation grammar: identifiers, decimal
numbers, attribute access, unary `+`/`-`, arithmetic `+ - * / // % **`, grouping, and positional calls including nested
calls. The RHS is not decomposed. It is copied byte-for-byte into `assignment-value`, receives no right padding, and is
never reordered or normalized.

The exact key differs from the shipped approved key
`v1|python|-|table|name>equal>value`. Approval lookup is exact, so the older rule, its CC0 examples and its decisions do
not transfer to this proposal.

## Selection and ownership

Existing detailed Python tables have priority. A complete detailed run of at least three rows reserves its physical
rows, including when its later preservation gate refuses an edit. The projection cannot retry or broaden those rows.
Remaining projected rows are grouped only by consecutive physical index, identical indentation and identical projected
signature. A blank line, comment-only line, unsupported statement, indentation change, continuation context or reserved
detailed table splits the candidate run.

A selected outer table owns each row once. Existing detailed pairs are retained only when they do not intersect a
selected outer table; projected pairs likewise cannot overlap an existing pair. This proposal authorizes no layered or
overlapping edit and no alignment inside a call or arithmetic expression.

## Conservative exclusions

The new projection excludes attribute, subscript, destructuring, annotated and chained targets; compound assignments;
comparisons and walrus expressions; strings, prefixed strings, f-strings, containers and indexing; keyword arguments;
lambda, `await`, `yield`, conditional expressions and comprehensions; semicolons, trailing whitespace, empty RHS and
unknown tokens. Unbalanced or mismatched delimiters are ineligible.

Explicit backslash continuations, a row beginning or ending inside any bracket continuation, and assignment-looking
text inside multiline strings are excluded. The source scanner tracks prior-line continuation, bracket and quote state.
A prefixed quote or damaged delimiter conservatively disables further new projections rather than guessing where safe
independent rows resume. Comments are masked from eligibility parsing and retained separately; punctuation inside a
comment cannot become calculation syntax. Recursion in the bounded expression recognizer stops at depth 64.

These are detection limits, not Python correctness claims. Public syntax validation and the existing preservation,
alignment-only and fixed-point checks remain mandatory.

## Positive example — proposed `after-better`

Before:

```python
def calculate(unit_price, quantity, discount, shipping):
    subtotal = unit_price * quantity
    discounted = max(0, subtotal - discount)
    total = discounted + shipping
    return total
```

After:

```python
def calculate(unit_price, quantity, discount, shipping):
    subtotal   = unit_price * quantity
    discounted = max(0, subtotal - discount)
    total      = discounted + shipping
    return total
```

The current raw aligner detects one table on lines 2–4 with axes `name`, `equal`, `assignment-value`, widths 10/1/27,
and exactly two horizontal edits. The RHS strings remain exact. The output passes the alignment-only preservation check
and a second alignment produces zero edits.

## Counterexample — proposed `bad`

Before and required unchanged result:

```python
def rejected(unit_price, quantity, shipping):
    subtotal = unit_price * \
        quantity
    discounted = max(value=0, other=subtotal)
    total = discounted + shipping
    return total
```

The first assignment uses an explicit continuation and the second uses keyword arguments. Neither is eligible for the
new projection, and the remaining assignment cannot meet the three-row floor. The current raw aligner reports no table,
no edit and no `assignment-value` group, and returns the source unchanged at its fixed point. Absence of a group is a
conservative noncandidate result, not a claim that arbitrary unsupported code is readable or approved.

## Current public behavior

The exact positive example was exercised against the current public commands using the shipped preset:

- `check` exits 1, reports valid Python syntax and the exact axes, and marks the key `unknown` with
  `approvalEligible: false`;
- `guide` exits 1 with `ok: false`, no guides and no conventions because it returns approved guidance only;
- `align --dry-run` and `align` both exit 2 with `ALIGN_NOT_ELIGIBLE` and keep the file byte-identical.

This is the required pre-approval state. Raw detector success and isolated synthetic test approval do not make this a
default-supported public write rule.

## Evidence and decision boundary

The dedicated source test is
[`test/python-assignment-envelope.test.ts`](../../../test/python-assignment-envelope.test.ts). It covers the real
calculation, RHS/evaluation preservation, CRLF and indentation, detailed-table priority, unique row ownership,
continuations and unsupported forms, exact approval isolation, public Check/Guide behavior, refused public writes, and a
test-only complete proof path.

The exact proposal examples were also executed independently for this document. Durable evidence and the execution
report are stored at:

- [proposal evidence](../reviews/2026-10-22-continuation-evidence/python-rule-proposal-evidence.json)
- [execution report](../reviews/2026-10-22-continuation-evidence/python-rule-proposal-report.md)

Relevant implementation sources:

- `product/engine/python/assignment-envelope.ts`
- `product/engine/python/profile.ts`
- `product/engine/common/table-engine.ts`
- `product/engine/common/signature.ts`

This document supplies reviewable syntax, scope, examples and counterpressure for a later human decision. It creates no
approval record, decision receipt, content hash, example license, recommended-preset entry or release claim.
