# R3 structured shared-pipeline integration

Date: 2026-10-21

## Owned changes

- `product/engine/common/project-config.ts`: public `json` and `yaml` language admission in config and formatter maps.
- `product/engine/common/format-pipeline.ts`: structured check, strict parse gate, approved working-copy alignment and preservation gate.
- `product/engine/common/alignment-only.ts`: structured byte/range preservation participates in the shared Align safeguard.
- `test/structured-pipeline.test.ts`: synthetic local approval proofs only; public preset data is unchanged.

Existing bytes of all three common files were saved under `/tmp/boxbox-readiness/structured-pipeline-before/` before edits. CLI, parse-check, syntax-validation, public preset, package, lock and artifact files were not edited.

## Pipeline behavior

JSON/YAML use `analyzeStructured` for check results and strict syntax status. Invalid syntax fails before approval evaluation and the atomic helper leaves the original unchanged. Valid scalar mapping groups use the same exact lookup-key approval proof as existing languages. The engine writes only the guarded working copy, verifies `preservesStructured`, runs the complete cycle twice for a byte fixed point, retains approval provenance checks and commits through the existing atomic replacement helper.

Unsupported valid YAML rows stay byte-identical and do not block an independent approved scalar group. Their detailed layout reasons remain available from `analyzeStructured.refusals`; the parent public result integration owns the additive unsupported metadata because `result-json.ts` is outside this task's ownership.

## Verification

Focused structured adapter and pipeline:

```text
bun test test/structured-align.test.ts test/structured-pipeline.test.ts
13 pass / 0 fail
```

Broader owned-neighbor run:

```text
bun test test/structured-align.test.ts test/structured-pipeline.test.ts test/alignment-only.test.ts test/config-layers.test.ts
55 pass / 1 fail
```

The sole failure is the existing `test/config-layers.test.ts` assertion that hard-codes default languages as `["typescript", "python"]`; the new product requirement makes the actual default `["typescript", "python", "json", "yaml"]`. That test is outside this worker's assigned test ownership and needs its owner/integration pass to update it.

`bunx tsc --noEmit --pretty false` reported one unrelated concurrent error in `test/typescript-layout-policy.test.ts:28` about a readonly tuple passed to a mutable matcher. No diagnostic referenced the structured adapter, pipeline integration, alignment-only change or structured pipeline test.

The new pipeline tests cover JSON/YAML dry-run, apply, exact expected output, no approval, invalid syntax, mixed unsupported YAML, repeated fixed-point execution, suffix preservation, original-byte preservation and temporary-file cleanup. Existing alignment-only tests also passed in full.

Placeholder scan over all owned changes returned no TODO, `test.skip`, `test.only`, `describe.skip/only`, or `it.skip/only` matches.
