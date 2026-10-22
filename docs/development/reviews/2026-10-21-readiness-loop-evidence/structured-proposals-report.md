# Structured rule proposal execution report

## Repository artifact

- Added only `docs/development/proposals/2026-10-21-structured-rules.md` in the repository.
- No engine, test, catalog, approval record, decision, or recommended-preset file was edited.
- The document contains two candidate rules and exactly four short synthetic examples: one positive and one counterexample for JSON, and one positive and one counterexample for YAML.

## Proposed identities

- JSON: `v1|json|object|mapping|key-colon>value`, initial scope `**/*.json`.
- YAML: `v1|yaml|block-map|mapping|key-colon>value`, initial scope `**/*.yaml`.
- Both require at least three adjacent rows with the same parent and indentation.
- Both remain unapproved and absent from `product/rules/presets/recommended/`.

## Execution method

`/tmp/boxbox-readiness/run-structured-proposals.ts` imports the current
`product/engine/structured/index.ts` and runs every exact proposal example through `analyzeStructured`. For each case it
asserts:

1. exact expected output;
2. exact group metadata;
3. expected refusal-reason coverage;
4. `preservesStructured(before, output, language) === true`;
5. a second-pass fixed point.

The complete serialized inputs, expected outputs, actual results, refusals and assertions are in
`/tmp/boxbox-readiness/structured-proposals-evidence.json`.

## Results

| Scenario | Groups | Refusals | Exact output | Preservation | Fixed point |
| --- | ---: | ---: | --- | --- | --- |
| JSON positive | 1 `FIXABLE`, 3 rows, 3 edits | 0 | pass | pass | pass |
| JSON counterexample | 0 | 2 collection-valued rows | unchanged | pass | pass |
| YAML positive | 1 `FIXABLE`, 3 rows, 3 edits | 0 | pass | pass | pass |
| YAML counterexample | 0 | 7 bounded refusal records | unchanged | pass | pass |

The JSON positive case preserved duplicate keys and order. The YAML positive case preserved the comment-only line and
inline comment. The YAML counterexample exercised block scalar, anchor, alias, collection/sequence, flow mapping and
explicit-tag boundaries.

## Licensing and authority

The proposal requests CC0-1.0 only for the four newly written synthetic examples, and only if the user separately
approves that license. It does not apply CC0 now and does not extend the request to implementation, documentation,
fixtures, rules or third-party content. Execution evidence does not create approval authority or public write access.

## Concurrent-work note

The BoxBox PostToolUse hook reported dirty-worktree/source-race failures involving concurrently created test staging
paths. The owned proposal document was inspected independently, and the direct adapter assertion script completed
successfully.
