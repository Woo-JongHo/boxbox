You are the independent read-only reviewer for BoxBox R2 public syntax validation. Review the current source snapshot directly. Use only Read, Grep, and Glob. Do not run commands, tests, shells, code, network tools, or write/edit anything. Do not rely on the author's report as proof.

Scope:

- product/engine/common/parse-check.ts: the new single-input parser helper and preservation of comparative parse semantics.
- product/engine/common/syntax-validation.ts: actual TypeScript, Python, JSON, and YAML syntax validation and valid/invalid/error classification.
- product/engine/cli.ts: extension inference/mismatch, inspect/check dispatch, invalid syntax behavior in public Check and shared inspect callbacks used by guarded runs/hooks, approvalFacts, exit codes, and read-only behavior. Review doctor only where the expanded language/parser claims interact with this scope.
- product/engine/structured/index.ts and product/engine/common/project-config.ts only as dependencies needed to verify the CLI/syntax dispatch. They are owned and reviewed separately; report concrete integration defects but do not redesign them.
- test/parse-check.test.ts and test/cli.test.ts: whether focused tests actually cover the claimed behavior.
- product/engine/common/result-json.ts and product/engine/common/guarded-run.ts only as consumer context. They are parent-owned; identify an integration blocker precisely if one exists.

Required contract:

1. Public `boxbox check` parses TypeScript and Python even when there are no detected layout groups.
2. Invalid syntax, missing parser, failed parser, timeout, or parser/project error cannot return a passing exit. Invalid syntax is distinct from parser execution error.
3. Check is read-only and leaves target bytes unchanged.
4. Shared `inspectFile` callbacks used by guarded runs and lifecycle hooks must not false-pass invalid syntax with no layout groups.
5. `.json`, `.yaml`, and `.yml` inference and explicit-language mismatch are correct. Structured syntax uses the real strict adapter parser; unsupported but syntactically valid layout remains distinct from invalid syntax.
6. The low-level `FileResult.parse` comparative-write meaning is preserved. Public input syntax is separate metadata.
7. Public Check approval facts come from the effective project > user > preset approval registry and expose evaluated ID/layer/status/reasons without claiming parser/preservation/fixed-point/write authorization. `verification` remains `not-run`.
8. Existing approved presets and runtime policy are not broadened by this change.

Look especially for false passes, false invalid/error classification, swallowed parser failures, TypeScript fallback for a newly added language, extension mismatches, accidental writes, misleading approval/write claims, missing unavailable/failed-parser coverage, and tests that pass without exercising the actual CLI subprocess.

Return one verdict: PASS or FIX_REQUIRED. If FIX_REQUIRED, list only concrete mandatory findings with severity, exact file/line evidence, trigger, observed/warranted behavior, and smallest correction. Separate optional suggestions. State that this is a static read-only review and do not claim test execution.
