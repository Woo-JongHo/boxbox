**Verdict: FIX_REQUIRED**

This is a static read-only review. I used only Read, Grep and Glob, and I did not run any command, test or code. All claims below come from reading the source and test files.

The implementation looks correct on contracts 1–3, 5 and 7–8, but the tests do not prove contracts 4, 5 and 2 at the CLI level.

## What I confirmed in the source

- **Contract 1 (parse with no groups):** `check()` calls `validateSyntax` before any group logic (`product/engine/cli.ts:363`). Invalid or error syntax returns exit 2 (`cli.ts:377`).
- **Contract 2 (no passing exit):**
  - `validateSyntax` (`syntax-validation.ts:26-44`) maps empty diagnostics to `valid` and non-empty to `invalid`. Any thrown error becomes `error`.
  - A missing parser, spawn error, signal, null status or unrecognized exit status all throw in `parse-check.ts:80-88,102`, and the timeout path throws via `run.error`. These therefore classify as `error` and are not swallowed.
  - `invalid` and `error` stay distinct in the public Check JSON (`syntax.status`).
- **Contract 3 (read-only):** Check only reads the target. Its only writes are temp files for the Python parse in `parse-check.ts`. `runTypeScriptAlign` is called without `--write`.
- **Contract 4 (shared inspect):** `inspectFile` validates syntax first (`cli.ts:230-231`). It returns a REFUSE group with `refused: 1` for non-valid syntax. Both guarded run and lifecycle hook consumers fail on `refused > 0`.
- **Contract 5 (structured dispatch):** `.json`, `.yaml` and `.yml` infer correctly; the mismatch check is language-agnostic; structured inputs dispatch before the TypeScript fallthrough; structured syntax uses the real parsers.
- **Contract 6 (comparative parse preserved):** `compareParse` is unchanged in meaning. `syntaxDiagnostics` is a separate single-input path and public syntax metadata is separate.
- **Contracts 7 and 8:** approval facts come from the effective project > user > preset registry with ID, layer, status and reasons; verification remains `not-run`; presets/runtime policy were not broadened in the scoped files.

## Mandatory findings

1. **Medium — contract 4 is untested at the CLI level.** No test exercises shared `inspectFile` with invalid syntax through guarded run or hook. Add CLI-subprocess tests proving an invalid file produced by `run` and an invalid file processed by `hook post` yield FAIL/nonzero.
2. **Low–Medium — contract 5 and 2 coverage is incomplete.** Structured tests do not assert unchanged bytes, unsupported-but-valid layout distinct from invalid syntax, or JSON/YAML explicit-language mismatch. Add those cases. A TypeScript parser failure/timeout unit would also close parser-error coverage, though CLI timeout injection is not currently exposed.

## Optional suggestions

- HELP and doctor limitations still name only TypeScript/Python despite JSON/YAML admission.
- Guard/hook receipts collapse invalid and parser error into a syntax REFUSE.
- Python BOM handling and TypeScript parser timeout are unverified.
- A comment could clarify `proofComplete` is not write authorization.

Raw invocation facts: model `claude-sonnet-5-5`; no fallback; no subagents; no web requests; no permission denials; terminal reason `completed`; CLI flags restricted tools to Read/Grep/Glob with safe mode, strict empty MCP and no session persistence.
