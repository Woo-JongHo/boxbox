**Verdict: PASS.** All three first-Opus code findings are closed within this fix-only scope, and the evidence gate is closed. I ran no tests or CLI commands. Every result below comes from logs and receipts the author recorded.

## Finding closure

**1. Raw align-only/check invalid-source JSON: closed.**
- `align-cli.ts` (around lines 88–117 in the repo copy): `alignOnly` now catches the error only when the language is Python and the error is a `PythonSourceSyntaxError`. Anything else is re-thrown.
- That error type is thrown in only one place, `string-ranges.ts:51`, when the helper prints exactly `BOXBOX_STRING_SYNTAX_INVALID`. A missing helper (line 49), an invalid response (54/55) and an invalid range (58/61) all throw a plain `Error`, so they still surface.
- On a caught rejection, `invalidSourceRun` returns zero groups, edits, pairs, details and refusals, so no ranges are made up. The write path uses the same helper, so both paths behave identically.
- Regression coverage:
  - Raw check and `--groups` on `text=f"{1}"` and the plain-string false match `text="a:t"`: exit 1, `parse.status` "changed", 0 edits, bytes unchanged, no leftover files.
  - With an empty PATH, `--json` still fails non-zero with "Python string tokenizer failed".
  - Both tests pass in the full-check log (lines 694–703).

**2. Python A12 error visibility: closed.**
- `report.ts:275–277`: the bare `catch` is now narrowed to `PythonSourceSyntaxError`. Only that error falls back to `strayLines`; anything else is re-thrown.
- The existing test for invalid source returning no A12 alarm is kept. A new subprocess test checks both a missing `python3` ("tokenizer failed") and a fake `python3` printing a non-JSON response ("invalid response"). It passes (full-check log line 818).
- I did not re-review the bare-code/comment behaviour; this diff does not touch it.

**3. Mutation-seed validity categories: closed.**
- `violation()` runs `syntaxDiagnostics("python", variant)` on every seed before alignment. Validity is therefore decided independently of whether the aligner refuses.
- A refusal of syntax-valid Python is now classed as `broken` and fails the test. Non-`PythonSourceSyntaxError` errors are re-thrown.
- `total === VARIANTS` is asserted, so no seed can be dropped silently.
- Hard-coding `"python"` is correct because `LANGUAGES` contains only `PYTHON_ALIGNER` (`mutation.test.ts:30–32`).
- The `mutation-oracle-v2/full.log` matches the packet: valid-aligned 505, invalid-aligned 381, invalid-rejected 114, total 1000; 3 pass, 0 fail, exit 0.
- That patch compares against the pre-fix baseline, not the first-Opus test, and I have not described it otherwise.

## Evidence gate

- **Full check:** `full-check/command.log` reports 679 pass, 0 fail, 4159 `expect()` calls, 75 files, 305.68s, with footer exit code 0 at 306.512s.
- **Receipt:** `full-check/receipt.json` records `candidateId` da1e93b36a6ca63a, `BOXBOX_REQUIRE_PARSERS=1`, exit code 0, and empty `inputDrift`.
- **Same candidate and tarball across receipts:** `candidate.json`, `artifact-provenance.json` and `final-acceptance.json` all name candidate SHA `da1e93b3…36a8`. They also give the same artifact and installed-artifact SHA `86ba0423…0880`, with build exit 0, build-input drift empty and current-candidate drift empty.

## Non-blocking observation (no action required)

- Both the check path and the write path report invalid source as `parse.status: "changed"` with tool `python3`, even when nothing was written. This matches the earlier write-path behaviour and the tests expect it. API consumers may read "changed" as meaning a write happened. The wording comes from the existing design and was not introduced by this fix.

## Limits

- I executed nothing; all test and runtime results are the author's recorded logs.
- I could not hash files with read-only tools. My code reading used the working-tree copies in `/Users/jonghoPro/woo/00_project/98_BoxBox`. That they match the candidate rests on the recorded hashes in the receipts, which show no drift.
- **Python 3.9:** I did not re-open `python39-final.log`. The claims about it stay limited to that recorded `/usr/bin/python3` 3.9.6 run. Refusing PEP 701 syntax on older interpreters is a stated compatibility limit, not a verified host matrix.
- I did not repeat a whole-repository review. The first Opus review's positive analysis and its limits still apply, and that review did not certify every source block.
- The host matrix beyond the recorded runtimes was not assessed: Python 3.14.2, Python 3.9.6, Node v22.22.3 and npm 10.9.8.
