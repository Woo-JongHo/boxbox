# Python simple assignments

Three or more consecutive simple-name assignments at the same indentation may be aligned when the engine detects exactly the lookup key `v1|python|-|table|name>equal>value`. The scope is `**/*.py`; the pattern is `DEFINE`. Any existing indentation depth is allowed, and indentation must be preserved. Two-row inputs, mixed-indentation runs, compound assignments, attribute targets, other axis combinations and other languages are outside this approval. Execution order and all non-whitespace tokens must be preserved.

The positive example `py-simple-assignments-positive` records the approved transformation at two-space indentation. In `py-simple-assignments-two-row-counterexample`, the aligned after form has verdict `bad` because automatically rewriting fewer than three rows violates the approved minimum; this is not a general style judgment about manually written whitespace. The engine must leave the before form unchanged and may report the pair as a suggestion.

A human maintainer approved this exact scope, the positive example and the excluded boundary on 2026-10-21. The public receipt uses the anonymous role `maintainer`; it does not grant approval for additional rules. The linked short synthetic examples are provided under CC0-1.0.
