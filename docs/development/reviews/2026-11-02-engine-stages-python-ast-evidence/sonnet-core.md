**Verdict: FINDINGS** (Python AST core phase only)

I read the frozen `post-ast/` sources and the delta patch, and executed nothing. I did not re-read untouched repo code. Everything below is static reasoning, and the author's logs were not independently verified. The reported runtime model is claude-sonnet-5-5; this comes from my system prompt and I can't verify it.

## Findings, by priority

**1. Medium (checklist 3, no user code execution): module shadowing from the working directory.**
- `analysis.ts:49` runs `spawnSync("python3", ["-c", SCRIPT])` with no `cwd` and no `-I`. `python3 -c` puts the current directory first on `sys.path`.
- The script's first line is `import ast,io,json,re,sys,token,tokenize,warnings`. Of these, `ast`, `json`, `token` and `tokenize` are not preloaded by Python at startup.
- Reproduction: run the CLI or `check` from a project root containing `json.py`, `token.py`, `tokenize.py` or `ast.py`. That repo-controlled file executes during analysis, or the analysis fails.
- `parse-check.ts` (`PYTHON_PARSE`, `PYTHON_STRUCTURE`) has the same weakness. But `analyzePython` now runs for every Python file on the read-only `alignOnly` path, where before it ran only for f-string files.
- Fix: add `-I`, or spawn from a neutral `cwd`.

**2. Medium, performance with no bound: quadratic scans in `analysis.ts`.**
- Line 85 is `tokens.some(t => formatted.some(...))`, which is O(tokens × f-strings) on every analysis.
- `safeEdit` (lines 96–102) filters the whole token array and the whole `formatted` array once per edited line. It re-runs for every `refuseUnsafeTables` iteration.
- A large generated file with tens of thousands of f-strings and edits can take minutes. The only bound is the 60s spawn timeout, and the quadratic work happens in-process after the spawn returns.
- Both token and formatted arrays are sorted, so a sweep or binary search would fix it.

**3. Low–Medium (checklist 5): a NUL byte surfaces as a tool error, not a syntax result.**
- The script catches only `SyntaxError` around `ast.parse`.
- Source `"a=1\n\x00\n"` is valid UTF-8 and invalid Python. As I recall, `ast.parse` raises `ValueError` ("source code string cannot contain null bytes") on 3.9–3.11. I could not confirm this by execution.
- If so, the child exits non-zero and `analyzePython` throws a plain `Error("Python source analysis failed…")`. The raw CLI then reports a crash, not `parse=changed` with exit 1. On 3.12+ it is a `SyntaxError`.
- There is no NUL test in the touched suites. I grepped them.
- Fix: map a NUL pre-check or `ValueError` to `syntax-invalid`.

**4. Low–Medium (checklist 7): stage-targeting and version coverage in tests.**
- `parser-fault.test.ts:87–95` sets `FAKE_MODE=failure` for every `python3` call. The CLI now fails at the first analysis call. It no longer reaches the `compareParse` or `comparePythonStructure` stage, and the test only asserts "Python source analysis failed".
- I found no CLI-level fault injection that passes analysis and then fails the write-stage parser. The one race test (`line-write-safety.test.ts:97`) covers only the AST stage.
- `line-write-safety.test.ts:123–141` uses a PEP 701 nested f-string, which is valid only on 3.12+. It expects "Python AST differs". On a 3.9–3.11 default `python3` the original is invalid, so the guard reports "Python source is invalid" and the test fails.
- `line-write-safety.test.ts:203–206` and `parse-check.test.ts:92–95` return early unless `/usr/bin/python3` is 3.9. They pass vacuously on any other host. The real 3.9 evidence exists only in the author's `usrbin39` and `compat39` logs, not in the suite.

**5. Low: regression for BOM or lone-CR sources that contain f-strings.**
- `pythonStringRanges` now throws a plain `Error` ("Unsupported Python source encoding or line endings") through `analyzePython`.
- `report.ts:274–278` catches only `PythonSourceSyntaxError`, so the error propagates uncaught. Previously a BOM was a `SyntaxError` and was caught, and lone CR was accepted.
- The path is reachable only if a file with a BOM or lone CR plus an f-string reaches the stray-padding branch. I did not trace whether upstream guards prevent that.
- It is consistent with the "refuse explicitly" goal, but the failure mode is different.

**6. Info / pre-existing (checklist 6): the format guard before the formatter is encoding-only.**
- `format-pipeline.ts:188–193` rejects non-UTF-8, BOM and lone CR before the formatter runs. It does not check that the initial Python is syntactically valid.
- `cli.ts` `format` never calls `validateSyntax`, and `pythonEngine.parse` validates only the formatter output.
- With a configured formatter that rewrites `if:\n` into valid code, the invalid original is silently replaced.
- This predates the phase, and "initially invalid bytes" may mean encoding only. Please confirm the intended scope.

## Checklist assessment (static)

1. **Preparation context:** Passes. `alignSource` calls `prepareSource` once, so there is one analysis and no per-table process. Non-prepared profilers keep the prior behavior: `region` is null on both sides, the comment is trimmed, and transparent rows map to null. Analysis failure propagates with no fallback to legacy admission.
2. **AST owners:** Mostly passes.
   - `(node, field)` owners are validated strictly on the TypeScript side. The `arguments` owner is unified across posonly, args and kwonly. The `*,` and `/,` markers require the same owner.
   - Row kind is cross-checked against exactly one AST row of that kind on the line.
   - The AST row `start` and `end` are validated but never compared with the profile span. Safety rests on the kind, the single row and the profile regexes.
3. **Coordinates and source slices:** Passes in design.
   - UTF-8 byte columns (AST) and code-point columns (tokenize) are mapped separately to UTF-16.
   - All token text comes from original slices, with no unparse and no `exec`.
   - BOM, lone CR and lone surrogates are refused. Non-UTF-8 is refused in `align-cli`.
   - Only item 1 and item 3 above weaken this.
4. **`unsafeEditLines`:** Sound for the cases I reasoned through.
   - It requires an exact indent, exact trailing bytes, exact token text and order, whitespace-only gaps, and no whitespace removal except before `,:]){}` or after an opening bracket.
   - Multi-line tokens and lines inside f-strings are refused.
   - A refused table is dropped, and primary rows stay reserved, so there is no retry through projection.
5. **Error mapping:** Mostly passes. Only a confirmed `ast.parse` `SyntaxError` becomes `PythonSourceSyntaxError`. Tokenize and tool faults throw plain `Error`. NUL on older Python is the exception (item 3). The final `comparePythonStructure` AST guard remains.
6. **Format guard:** See item 6. `alignment-only` still runs `changedLines`, and the TS and structured paths are untouched.
7. **Tests:** The 1000-mutation oracle uses an independent parser call, which is meaningful. But with mandatory analysis, `invalid-aligned = 0` holds by construction. See item 4 for stage and version coverage.

## Limits

- I executed nothing and did not verify the author's logs.
- The 1000-mutation result predates the f-string helper consolidation, so I do not treat it as final proof.
- Only 3.9.6, 3.9.7 and 3.14.2 were exercised by the author. I could not assess 3.10–3.13. Known tokenizer position quirks on some 3.12.x versions for `{{` in FSTRING_MIDDLE would fail closed (a tool error), but I did not verify them.
- Stage 04 measurement code and the whole-candidate tests, artifact and Opus review are outside this phase and unreviewed. Callers in `development/tools` also use `PYTHON_ALIGNER` and were not reviewed.
