# Proposed structured-document alignment rules

**Status: candidate proposals only. Not approved. Not present in the recommended preset.**

These two proposals describe the bounded behavior implemented by
`product/engine/structured/index.ts`. The JSON/YAML adapters are connected to the CLI and guarded format pipeline,
but the public recommended preset contains no approval for either lookup key. Until a human separately approves a
rule, its examples, scope and proof records, the approval gate must refuse automatic application.

The four examples below are new synthetic text written for this proposal. Their metadata is descriptive only. If the
user separately approves it, CC0-1.0 is requested **only for these four example texts**. That request does not license
repository code, documentation, existing fixtures, rules, or third-party material, and does not itself approve either
alignment rule.

## Candidate JSON scalar mapping rule

| Field | Proposed value |
| --- | --- |
| Candidate ID | `candidate-json-scalar-mapping-v1` |
| Lookup key | `v1\|json\|object\|mapping\|key-colon>value` |
| Language / initial scope | `json` / `**/*.json` |
| Context / kind / axes | `object` / `mapping` / `key-colon`, `value` |
| Minimum rows | 3 adjacent rows |
| Candidate operation | Horizontal whitespace alignment before `:` and after `:` only |
| Authorization | None; a separate human decision and complete proof records are required |

Candidate applicability is one run of at least three adjacent, same-parent JSON object properties. Every property must
occupy one line, use a quoted JSON key, and have a scalar JSON value: string, number, `true`, `false`, or `null`.
Parsing uses strict `JSON.parse`. Rows must have the same indentation. Width derives from the keys in the selected run;
the rule pads the key-to-colon gap and normalizes the value start to one space after the colon. Key order, duplicate
keys, key/value bytes, escapes, comma presence, trailing spaces, indentation and line endings stay unchanged.

Objects, arrays and multiline property forms are excluded. A comment cannot occur in strict JSON. Invalid JSON is
refused before approval lookup. A blank line, noncandidate property, parent change or indentation change ends a run;
fewer than three candidate rows produce no group. The adapter's preservation check and parse check remain mandatory.

### JSON positive example — proposed `after-better`

Before:

```json
{
  "id":1,
  "displayName" : "BoxBox",
  "id"  :2
}
```

After:

```json
{
  "id"         : 1,
  "displayName": "BoxBox",
  "id"         : 2
}
```

The duplicate `"id"` properties are intentionally preserved in their original order. The executed adapter result was
one `FIXABLE` group on lines 2–4 with three rows, axes `key-colon,value`, three edits, context `object`, and depth 1.

### JSON counterexample — proposed `bad`

Before and required unchanged result:

```json
{
  "object": {"nested": 1},
  "array": [1, 2],
  "plain": 3
}
```

The object and array values are outside the scalar-row contract. The remaining scalar row cannot meet the three-row
floor. The executed adapter produced no group, reported both collection-valued rows as nonalignable single-line scalar
properties, and returned the source byte-for-byte unchanged.

## Candidate YAML 1.2 scalar mapping rule

| Field | Proposed value |
| --- | --- |
| Candidate ID | `candidate-yaml-scalar-mapping-v1` |
| Lookup key | `v1\|yaml\|block-map\|mapping\|key-colon>value` |
| Language / initial scope | `yaml` / `**/*` (language-gated to recognized `.yaml` and `.yml` files) |
| Context / kind / axes | `block-map` / `mapping` / `key-colon`, `value` |
| Minimum rows | 3 adjacent rows |
| Candidate operation | Horizontal whitespace alignment before `:` and after `:` only |
| Authorization | None; a separate human decision and complete proof records are required |

Candidate applicability is one run of at least three adjacent, same-parent YAML 1.2 core block-mapping pairs. Every key
must be a simple single-line plain scalar matching the adapter's bounded key form, every value must be a single-line
scalar, and every row must have identical space indentation. The adapter pads the key-to-colon gap and normalizes the
value start to one space after the colon. Key and value bytes, mapping order, comment suffixes, indentation and each
line ending stay unchanged.

Quoted or complex keys, empty values, mappings and sequences as values, sequence entries, flow collections, anchors,
aliases, explicit tags, block literal/folded scalars, multiline pairs, directives and document markers are excluded.
Tabs are not accepted as row indentation. A blank line, comment-only line, excluded pair, parent change or indentation
change ends a run; fewer than three candidate rows produce no group. YAML must parse under the 1.2 core schema, and the
adapter's preservation and parse checks remain mandatory. The proposed `**/*` scope is constrained by the exact `yaml` language key and the CLI's `.yaml`/`.yml` admission. It does not enable formatting other file types. This is the scope submitted for the pending human decision; no approval has been recorded.

### YAML positive example — proposed `after-better`

Before:

```yaml
# settings retained exactly
id: 1 # keep
display_name : BoxBox
enabled:  true
```

After:

```yaml
# settings retained exactly
id          : 1 # keep
display_name: BoxBox
enabled     : true
```

The comment-only line and inline comment remain byte-identical. The executed adapter result was one `FIXABLE` group on
lines 2–4 with three rows, axes `key-colon,value`, three edits, context `block-map`, and depth 0.

### YAML counterexample — proposed `bad`

Before and required unchanged result:

```yaml
block: |
  keep: exact
anchored: &shared value
alias: *shared
list:
  - one
flow: { key: value }
tagged: !!str value
```

The block scalar, anchor, alias, collection value, sequence entry, flow mapping and explicit tag are outside the
candidate contract. The executed adapter produced no group, emitted the corresponding bounded refusal reasons, and
returned the source byte-for-byte unchanged.

## Evidence and approval boundary

The exact four examples were executed directly through `analyzeStructured`. Each asserted exact output, exact group
metadata, expected refusal coverage, `preservesStructured`, and a second-pass fixed point. Raw machine-readable results
are preserved in [proposal evidence](../reviews/2026-10-21-readiness-loop-evidence/structured-proposals-evidence.json);
the [original execution report](../reviews/2026-10-21-readiness-loop-evidence/structured-proposals-report.md) records
the earlier `.yaml`-only scope. The current pending proposal includes `.yml` through the language-gated scope above;
the exact four executable example texts are unchanged.

Relevant implementation evidence:

- `product/engine/structured/index.ts`
- `product/engine/common/format-pipeline.ts`
- `test/structured-align.test.ts`
- `test/structured-pipeline.test.ts`

These results show that the current adapter implements the proposed boundaries for these inputs. They do not supply a
human decision, approve a convention, authorize CC0, create content hashes, or add either key to the recommended preset.
