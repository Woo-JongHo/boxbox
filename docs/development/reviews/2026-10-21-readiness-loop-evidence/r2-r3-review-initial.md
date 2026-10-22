**Verdict: BLOCKED.** Scope A passes. Scope B has one blocker and two required fixes. I read the code only and ran nothing, so the reproduction below is traced by hand.

## Scope A: PASS

- **Schema is closed.** `exactKeys` is applied at the root, `rowKinds`, each kind, and `minRows`. Unknown kinds, a duplicate or overlapping gap/insert axis, and an unknown `operation`, `gap`, or `value < 2` are all rejected (`layout-policy.ts:55-109`). The kind list must equal `IMPLEMENTED_LAYOUT_KINDS` exactly.
- **Axes have notes.** I normalized every `{i}` axis in the JSON by hand and each maps to an `AXIS_NOTES` key. `validateLayoutAxisNotes` runs at `grid-kinds.ts:805`, so a bad policy fails at import.
- **Behavior looks unchanged.** `minRows` (`grid-kinds.ts:661`) is the old "every row has `equals` → 2, else undefined" rule. `KIND_AXES` is only an alias of the policy data (`:816`). Approval stays separate; no approval data is touched.
- **Packaging is fine.** The public CLI is a `Bun.build` bundle, so the JSON import is inlined. The isolated-copy test covers the development skill path.

Non-blocking nits:
- Nothing asserts that every `ROW_KINDS` name is a policy kind. A one-line test would do it.
- `{i}` is stripped before the notes lookup, so the data can put `{i}` on a non-indexed axis without error.
- `identifier` allows a trailing or double `-`.

## Scope B: BLOCKED

### B1 (blocker): YAML flow-map values can be silently corrupted

In `parseYaml` (`structured/index.ts:116-139`), `pairByLine.set(line, …)` overwrites earlier pairs on the same line. `visit` enters the outer Map first, so an inner flow-map pair replaces the outer pair.

Take `a: &x {k: 1}` or `a: !!map {k: 1}` as the first row of a 3-row run.
- The inner pair is accepted: its key is plain, its value is a scalar `1`, and `reason` is null.
- The `{`-prefix guard at `:154` misses it, because the tail starts with `&x` or `!!map`.
- The "value properties" guard at `:160` misses it too. It measures from the *inner* `keyEnd` and colon.
- The row becomes `key="a", tail="1", suffix="}"`, and `alignedLine` writes `a  : 1}`. That drops `&x {k: ` from the file.
- `preservesStructured` accepts the result. `a  : 1}` parses as a valid plain scalar, and `rowSkeleton` concatenates `tail+suffix`, so `"1"+"}"` equals `"1}"+""`.
- `alignment-only.ts` would catch it, because the space-stripped text differs. But `writeFileWithEngine` (`format-pipeline.ts:100`) relies only on `preservesStructured`, so a non-`alignmentOnly` run writes the corrupted file.

**Required fix:**
1. Do not overwrite a pair already on a line. Mark the line ambiguous and refuse it.
2. Require that the row reconstructs the original line exactly: `indent+key+beforeColon+":"+afterColon+tail+suffix+eol === text`. Also require `pair.keyStart - lineStart === indent.length`, and that the YAML_ROW key equals the AST key text.
3. Add regression tests for `a: &x {k: 1}`, `a: !!map {k: 1}`, and a multi-line flow map, each as a row in a 3-row run.

### B2 (required): `preservesStructured` is not a whitespace-only oracle

`rowSkeleton` (`:211`) ignores `beforeColon` and `afterColon`. For YAML those slots are plain slices (`:163`), not checked against `[ \t]*`. Any non-whitespace change confined to them passes. The generic whitespace check in `assertAlignmentOnly` covers only alignment-only mode, and the standalone and formatter paths lack it.

**Required fix:**
- In `preservesStructured`, require that every changed line differs from the original only in `[ \t]` characters, with leading and trailing whitespace identical. That is the same invariant as `alignment-only.ts:26-28`.
- Also require `beforeColon` and `afterColon` to match `^[ \t]*$` in both rows.
- Add a negative test that mutates a non-whitespace character inside those slots.

### B3 (required): unresolved YAML aliases pass as valid syntax

`composeAlias` (`yaml/dist/compose/compose-node.js:97-108`) does not check that an alias target exists. That check only happens at `toJS`/`resolve`. So `x: *nope` yields no `document.errors`, and `structuredDiagnostics` returns `[]`. That breaks "wrong syntax fails closed".

**Required fix:**
- In `parseYaml`, visit `Alias` nodes and require each to resolve against `document` (or call `document.toJS()` in a try). Throw if one does not.
- Add a test for `x: *nope`.

### B4 (required, smaller): non-roundtripping bytes can be rewritten

`checkFile` and `writeFileWithEngine` call `readFileSync(file, "utf8")`. Invalid UTF-8 becomes U+FFFD, and the file is rewritten whenever alignment changes any row. Only `alignmentOnly` guards this, at `alignment-only.ts:14`.

**Required fix:** refuse unless `Buffer.from(text, "utf8").equals(raw)`. A leading BOM already fails closed through `JSON.parse`.

### Checked and fine

- **JSON.** Syntax comes from `JSON.parse`, duplicate keys are kept deliberately, and JSON comments are rejected. `jsonParents` is string- and escape-aware, and strings cannot span lines. Multi-prop lines, closing braces, and nested objects are refused or split into separate runs.
- **Failure states.** Valid-but-unsupported constructs go into `unsupported` and are not groups, so they don't block approved scalar rows. Only a syntax error produces a REFUSE group, and `parse.status` is `not-run` for valid input.
- **Pipeline.** `format-pipeline.ts` still checks the parse first, then approval, then the atomic write, a second-cycle byte fixed point, and provenance. The structured branches are consistent with the others.

### Non-blocking

- The `escaped verified horizontal gap ranges` throw (`:206`) escapes `checkFile` as an exception instead of a REFUSE result. It still fails closed.
- The invalid-syntax `FileResult` carries no message. The reason is only in `refusals`, so JSON-only consumers lose it.
