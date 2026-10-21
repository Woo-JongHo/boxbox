# Initial rule candidate approval packet

This document is material for a human to compare two rule candidates that are not approved yet. An approval below applies only to the stated lookup key and file scope; it does not mean a general style approval for other patterns, row counts, languages or containers.

## rule-ts-sourcefile-call-declarations

- Candidate ID: `ts-sourcefile-call-declarations`
- Exact lookup key: `v1|typescript|SourceFile|declaration-equals|equals>call-open-paren>call-close-paren>semicolon`
- Scope: `**/*.ts`
- Pattern: a `DEFINE` table of two or more consecutive variable declaration rows in a `SourceFile`, each with a single call expression as its initializer, which the engine groups as `declaration-equals` on exactly these axes. The `const` below is a representative example; the lookup key does not distinguish `const`/`let`/`var`.

Before approval:

```ts
const short = make(1);
const muchLonger = make(22);
const middle = make(333);
```

Expected shape after approval:

```ts
const short      = make(1  ) ;
const muchLonger = make(22 ) ;
const middle     = make(333) ;
```

Out-of-scope counterexample:

```ts
const only = make(1);
```

A single row is not detected as a table and is never aligned automatically. Conversely, this table kind has the existing engine's two-row exception, so two rows with the same lookup key are inside the approval scope.

Collected run evidence:

- Internal runner check JSON: `groups=1`, `misaligned=1`, `edits=7`, `kind=declaration-equals`, `rows=3`, `context=SourceFile`, `depth=0`.
- Safe write JSON: `parse.status=ok`, `tool=typescript`, `passes=2`.
- Recheck JSON: a fixed point where the table with the same key has `state=PASS`, `misaligned=0`, `edits=0`.
- The TypeScript 7 scanner's `preservesTokens(before, after)` is `true`.
- Two-row measurement with the same lookup key: check gives `rows=2`, `FIXABLE`, `edits=4`; the safe write gives `parse.status=ok`, `passes=2`; the recheck gives `PASS`, `misaligned=0`, `edits=0`.
- Single-row counterexample write JSON: `groups=0`, `misaligned=0`, `edits=0`; the SHA-256 before and after the run is the same, `2aa5675adbf864add211e0d9ddc9e5b3b5179bd805ec3acb387cd86e61e299b6`.

Human approval allows only one thing: accepting as a recommended convention two or more `SourceFile` single-call variable declaration rows the engine detects with this exact lookup key in the `**/*.ts` scope. It is not an approval to restrict the declaration kind to `const` or to change execution order, and it does not approve other AST containers, other initializer structures, other axis combinations or single-row input.

## rule-python-simple-assignments

- Candidate ID: `py-simple-assignments`
- Exact lookup key: `v1|python|-|table|name>equal>value`
- Scope: `**/*.py`
- Pattern: a `DEFINE` table of three or more consecutive simple name assignments at the same indentation, at any indentation depth

Before approval:

```python
if enabled:
  alpha = 1
  much_longer = 22
  mid = 333
```

Expected shape after approval:

```python
if enabled:
  alpha       = 1
  much_longer = 22
  mid         = 333
```

Out-of-scope counterexample:

```python
alpha = 1
much_longer = 22
```

Two rows are reported only as `SUGGEST` and are never aligned automatically. The minimum of three rows is an explicit boundary included in this candidate's approval.

Collected run evidence:

- Internal runner check JSON: `groups=1`, `misaligned=1`, `edits=2`, `kind=table`, `rows=3`, `depth=0`.
- Safe write JSON: `parse.status=ok`, `tool=python3`.
- Recheck JSON: a fixed point where the table with the same key has `state=PASS`, `misaligned=0`, `edits=0`.
- In the two-space indentation measurement, the same lookup key was produced even though the JSON had `depth=0`, and each row's existing two-space indent was preserved.
- The line engine's `changedLines(before, after, PYTHON_ALIGNER.syntax)` is an empty array, so there is no content change, indentation included, outside the horizontal alignment spaces.
- Two-row counterexample write JSON: `state=SUGGEST`, `suggested=1`, `misaligned=0`, `edits=0`; the SHA-256 before and after the run is the same, `fff7d9e30fae59f0d3dd2021c25d9c1813451dc95d6c9d4e428f97f9610a432c`.

Human approval allows only one thing: accepting as a recommended convention at least three consecutive simple name assignments at the same indentation, at any indentation, with this exact lookup key in the `**/*.py` scope. It does not approve two-row input, input mixing different indents, compound assignments, other axis combinations or assignment statements of other languages.
