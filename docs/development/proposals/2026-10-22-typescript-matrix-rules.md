# Proposed TypeScript matrix alignment rules

**Status: candidate proposals only. Not approved. Not present in the recommended preset.**

These proposals cover two exact TypeScript lookup keys implemented in `product/engine/typescript/grid-kinds.ts` and
exercised by `test/typescript-matrix-boundaries.test.ts`. They do not approve the surrounding syntax families. The
current public `format` command refuses both positive examples with `approval denied: no matching convention` and
leaves their files unchanged.

The four snippets below are new synthetic examples. They remain **UNLICENSED** unless the user makes a separate,
explicit license decision. A future license decision for these snippets would not approve either rule or license code,
documentation, existing fixtures, tests, or third-party material.

## Candidate nonconsecutive return-guard rule

| Field | Proposed value |
| --- | --- |
| Candidate ID | `candidate-ts-block-return-guards-v1` |
| Lookup key | `v1\|typescript\|Block\|return-guards\|guard-return` |
| Language / scope | `typescript` / `**/*.ts` |
| Context / kind / axes | `Block` / `return-guards` / `guard-return` |
| Minimum rows | 3 supported guard rows in one bounded region |
| Candidate operation | Insert horizontal spaces between the condition close and `return` until the return starts share one column |
| Authorization | None; a separate human decision and complete proof records are required |

A candidate row is a one-line, unbraced `if (condition) return expression;` statement whose condition-to-return gap
contains spaces only. Rows belong to the same TypeScript block and bounded guard region. They may be nonconsecutive:
ordinary declarations, expression statements, loops and blank lines can remain between guards, and execution order is
never changed. Nested blocks own independent regions.

The detector ends a region at comment boundaries, unsupported guard forms, terminal `return`/`throw`/`break`/`continue`
statements, nested function declarations and nested class declarations. Braced guards, `else`, and comments between a
condition and its return are excluded. Fewer than three supported rows in a region produce no table. Only the
condition-to-return horizontal gap may change; tokens, indentation, line count and statement order must be preserved.

### Return guards positive example — proposed `after-better`

Before:

```ts
function read(value: unknown) {
	if (!value) return undefined;
	const declared = value;

	if (declared === undefined) return undefined;
	observe(declared);
	if (typeof declared !== 'string') return undefined;
	return declared;
}
```

After:

```ts
function read(value: unknown) {
	if (!value)                       return undefined;
	const declared = value;

	if (declared === undefined)       return undefined;
	observe(declared);
	if (typeof declared !== 'string') return undefined;
	return declared;
}
```

The raw development aligner detected one group spanning lines 2–7 with row lines 2, 5 and 7, context `Block`, depth 1,
and axis `guard-return`. It preserved tokens and indentation and reached a fixed point. This observation establishes
the exact proposed key; it is not public approval.

### Return guards counterexample — proposed `bad`

Before and required unchanged result:

```ts
function read(value: unknown) {
	if (!value) return undefined;
	if (!ready) return fallback;
	// semantic section boundary
	if (!other) return undefined;
	if (!finalValue) return fallback;
}
```

The comment splits the block into two regions of two supported guards. Neither region meets the three-row floor. The
raw development aligner reported no `return-guards` group and returned this example unchanged.

## Candidate final member-call envelope rule

| Field | Proposed value |
| --- | --- |
| Candidate ID | `candidate-ts-source-member-call-envelope-v1` |
| Lookup key | `v1\|typescript\|SourceFile\|declaration-call-envelope\|equals>call-member-dot>call-envelope-open>call-envelope-close>semicolon` |
| Language / scope | `typescript` / `**/*.ts` |
| Context / kind / axes | `SourceFile` / `declaration-call-envelope` / `equals`, `call-member-dot`, `call-envelope-open`, `call-envelope-close`, `semicolon` |
| Minimum rows | 2 adjacent supported declarations when every row has the declaration `equals` axis |
| Candidate operation | Align declaration equals signs, the final receiver/method dot, outer call parentheses and semicolons; keep argument text opaque |
| Authorization | None; a separate human decision and complete proof records are required |

A candidate row is a single-line `const`/`let` declaration accepted by the existing declaration detector whose value is
a supported, direct, nonempty member call. The `call-member-dot` axis is the **final** separator between receiver and
method. Earlier receiver dots such as the dot in `registry.rows` remain inside the receiver cell. Argument expressions,
their inner dots, nested calls, literals and differing arities remain one opaque cell; this proposal does not align
argument commas or individual arguments.

The minimum is not a new exception invented by this proposal. The current declaration row policy returns a two-row
floor when every detected row carries `equals`; `withCallEnvelope` also requires at least two rows. Because row count is
not encoded in the lookup key, the exact key below cannot honestly approve only three-row groups while silently
excluding the user's two-row case.

All rows in this exact proposal carry every listed axis. This bounds the key deliberately:

- zero-argument calls omit `call-envelope-close` and therefore have a different key;
- direct nonmember calls omit `call-member-dot` and therefore have a different key;
- block-local declarations use context `Block`, not `SourceFile`;
- optional calls, computed calls, `await`, `new`, type arguments, call-producing receivers such as `factory().method`,
  comments at the member/open/close boundary, trailing commas and comments before the close parenthesis are excluded by
  the current detector.

The rule does not reuse the existing approved same-callee declaration key. It applies only to the exact lookup key in
the table above. Rows must stay adjacent and in their original execution order. Only horizontal whitespace owned by the
listed boundaries may change; token, indentation and line-count preservation remain mandatory.

### Member-call envelope positive example — proposed `after-better`

Before:

```ts
const rows = Array.from(items);
const over = rows.filter(isVisible);
```

After:

```ts
const rows = Array.from  (items    ) ;
const over = rows .filter(isVisible) ;
```

This is the user's exact two-row `Array.from` / `rows.filter` scenario. The raw development aligner detected one two-row
group in `SourceFile` with all five proposed axes and the same lookup key as the earlier three-row mixed-arity probe. It
aligned only the final member dots and outer envelopes, then reached a token-preserving fixed point. The existing matrix
tests separately show that differing argument arities remain opaque under this key; they do not broaden it to a
different axis set or context.

### Member-call envelope counterexample — proposed `bad`

Before and required unchanged result:

```ts
const aa = Array /* keep */ .from(items) ;
const bb = object?.filter(value)         ;
const cc = object[key](value)            ;
```

The first row has a comment at the member boundary, the second is optional, and the third is computed. The raw
development aligner reported no `declaration-call-envelope` group and left the already stable surrounding declaration
spacing unchanged. The exact proposed key therefore cannot authorize any of these rows.

## Evidence and approval boundary

The exact four snippets were executed through the raw TypeScript development aligner in write mode and then check mode.
The evidence asserts exact output, exact target-group count, exact normalized lookup key, token preservation and a second
write fixed point. Both positive snippets were also passed to the current public `format` command without project
approvals; each exited with code 2, reported `FORMAT_NOT_ELIGIBLE` / `approval denied: no matching convention`, and kept
the source byte-identical.

Raw machine-readable evidence and the execution report are retained at:

- [proposal evidence](../reviews/2026-10-22-continuation-evidence/ts-matrix-proposals-evidence.json)
- [execution report](../reviews/2026-10-22-continuation-evidence/ts-matrix-proposals-report.md)

Relevant repository evidence:

- `product/engine/typescript/grid-kinds.ts`
- `product/engine/typescript/align.ts`
- `product/engine/common/signature.ts`
- `test/typescript-matrix-boundaries.test.ts`
- `test/recommended-preset.test.ts`

These observations make the candidates reviewable. They do not create approval records, authorize a license, or modify
`product/rules/presets/recommended/`.
