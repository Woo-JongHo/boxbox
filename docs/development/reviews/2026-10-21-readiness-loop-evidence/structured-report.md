# R3 structured adapter implementation report

Date: 2026-10-21

## Ownership and scope

Created only:

- `product/engine/structured/index.ts`
- `test/structured-align.test.ts`
- `test/fixtures/json/tables.json`
- `test/fixtures/json/tables.aligned.json`
- `test/fixtures/yaml/tables.yaml`
- `test/fixtures/yaml/tables.aligned.yaml`

No CLI, project config, format pipeline, alignment-only, package, lock, or approved preset files were edited. All targets were new and did not need pre-existing-byte snapshots.

## Implemented contract

- `StructuredLanguage = "json" | "yaml"`
- `structuredDiagnostics(source, language): readonly string[]`
- `analyzeStructured(source, language, file = "input")`
- `preservesStructured(before, after, language): boolean`
- No disk writes.

Strict JSON syntax is checked with `JSON.parse`; source text is scanned without materializing or serializing JS objects. Object/array stack identities give each nested JSON object independent width ownership and retain duplicate key spelling and order.

YAML uses `yaml@2.9.1` `parseDocument` with YAML 1.2 core schema, strict parsing, standard duplicate-key rejection, AST scalar key/value ranges, and map identities. Only adjacent, same-map, same-indentation, single-line plain-key scalar rows form groups.

Groups require at least three rows. Blank lines, comments, unsupported rows, indentation changes, and parent changes break a group. Output uses `mapping`, axes `key-colon` and `value`, and contexts `object` / `block-map`.

Only the horizontal whitespace immediately before and after `:` is canonicalized. JSON strings, escapes, duplicate keys, commas, CRLF, and scalar bytes remain in place. YAML comments and scalar bytes remain in place. Directives/document markers, complex keys, sequence entries, flow collections, anchors, aliases, tags, block scalars, and other unsupported mapping shapes yield explicit line reasons and are not rewritten.

Invalid input returns byte-identical output, one REFUSE result group, a refusal reason, and parser status `skipped`.

`preservesStructured` reparses the candidate and compares every byte outside the two recognized horizontal gap ranges on accepted rows. It rejects changed line counts, content, indentation, trailing whitespace outside a recognized gap, and invalid candidates.

## Verification

Command:

```text
bun test test/structured-align.test.ts
```

Result:

```text
6 pass
0 fail
27 expect() calls
```

Covered exact fixture output, idempotence, JSON escapes and colon-in-string, duplicate JSON keys, CRLF, nested parent ownership, YAML comment separators, block scalar preservation, anchors/aliases/tags/flow/quoted-key refusals, invalid JSON/YAML, and preservation rejection for content/indentation/unverified whitespace edits.

`bunx tsc --noEmit --pretty false` completed with no output in an isolated retry. Other retries overlapped concurrent TypeScript alignment tests that temporarily created `test/typescript-align-*` fixtures; those retries reported only missing globals inside those transient files. No type error referenced the structured adapter or its test.

Placeholder scan:

```text
rg -n "TODO|test\.(skip|only)|describe\.(skip|only)|it\.(skip|only)" product/engine/structured test/structured-align.test.ts test/fixtures/json test/fixtures/yaml
```

Result: no matches.

## Integration boundary

This is a pure adapter/proposal surface. It does not admit JSON/YAML in the public CLI, connect the shared write pipeline, or authorize a public convention. The parent integration pass owns those surfaces after concurrent work settles.

## Mandatory review corrections

Parent source review identified five pre-integration issues; all were corrected in the adapter-owned files.

- `structuredDiagnostics` now returns syntax/dialect diagnostics only. Valid documents containing unsupported layout shapes return `[]`; layout coverage remains in `analyzeStructured(...).refusals` for additive public metadata.
- YAML row eligibility now comes from actual AST pair key/value ranges. Both nodes must be scalar, untagged/unanchored, and wholly single-line. Plain and quoted multiline scalars, all literal/folded block indicator variants, collections, aliases, tags and anchors remain byte-identical and yield layout refusals.
- JSON rows now retain exact suffix bytes after the scalar/comma and exact per-line CR. The preservation skeleton includes suffix and EOL, rejecting trailing-space/tab changes and CRLF-to-LF conversion even on eligible rows.
- YAML uses the parser's standard unique-key checking. Duplicate YAML keys are syntax refusals while duplicate JSON keys remain valid and source-preserved.
- The adapter enforces YAML 1.2: an explicit non-1.2 `%YAML` directive is rejected instead of being parsed under misleading fixed-schema behavior.
- Quoted YAML scalar content containing `*`, `&`, `!`, or `:` is classified by the AST rather than punctuation regexes and is preserved.

Corrected verification:

```text
bun test test/structured-align.test.ts
8 pass
0 fail
43 expect() calls
```

An error-filtered full TypeScript check produced no diagnostics for `product/engine/structured/index.ts` or `test/structured-align.test.ts`. Placeholder scan still has no matches.
