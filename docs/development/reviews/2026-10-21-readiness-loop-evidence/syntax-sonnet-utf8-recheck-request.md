Final static read-only follow-up. Use only Read, Grep and Glob; do not run commands/tests/code, write files, or use web/MCP. The previous follow-up in `syntax-sonnet-recheck-request.md` returned PASS, but a separate structured-adapter review then identified a new integration issue: `readFileSync(path, "utf8")` could replace invalid UTF-8 and let Check parse different text from the raw target.

Review current `product/engine/common/syntax-validation.ts`, the public Check/inspect use in `product/engine/cli.ts`, and the focused invalid-byte tests in `test/cli.test.ts`. Verify:

- raw bytes are decoded only after a byte-for-byte UTF-8 roundtrip check;
- invalid UTF-8 becomes explicit syntax `error`, never `valid` or parser `invalid`;
- JSON and YAML invalid-byte tests invoke the real CLI, require exit 2, and prove target bytes unchanged;
- the change did not weaken the previously passed syntax, approvalFacts, guarded-run/hook or comparative-parse contracts.

Return PASS or FIX_REQUIRED with exact evidence and only concrete mandatory findings. State this is static read-only review and do not claim test execution.
