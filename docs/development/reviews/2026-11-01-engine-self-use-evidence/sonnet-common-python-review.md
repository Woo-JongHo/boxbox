**Verdict: FINDINGS.** I read the supplied diffs and complete sources and made two narrow caller lookups. I executed nothing. The author logs are author evidence, not my runs.

## Prioritized findings

**1. [High, probable regression] The stderr-must-be-empty gate turns harmless Python warnings into hard failures.**
- Location: `product/engine/common/parse-check.ts`, `comparePythonStructure`, line `run.error || run.signal || run.status !== 0 || run.stderr !== ""`. The same gate is in `product/engine/python/string-ranges.ts`.
- Both child scripts call `ast.parse(...)`. As I recall, CPython 3.12 and later report invalid escape sequences such as `"\d+"` as a `SyntaxWarning` during parsing. That warning goes to stderr, and the author's environment is Python 3.14.2.
- Counterexample: `PAT = "\d+"\na=1\nlonger=2\nthird=3\n`, aligned with `--write`.
  - The diagnostic `compareParse` passes. Its `PYTHON_PARSE` keeps only `error:` lines.
  - `comparePythonStructure` then sees non-empty stderr and throws `Python structure parser failed`.
  - The write is blocked for a valid file with a very common idiom.
- Any file that has both an f/t-string prefix and such a warning makes `pythonStringRanges` throw. That breaks check, preview and write, not just writes.
- `PYTHONWARNINGS=error` in the environment would do the same.
- No test uses such a fixture. The fault tests only simulate empty output, exit 9, a signal, a timeout and oversized output.
- The fail-closed intent is fine, but the empty-stderr requirement is too broad. Suppress warnings in the child (`warnings.simplefilter('ignore')`) or stop treating stderr as an error when the exit status is 0.

**2. [Medium, probable regression] The AST guard throws instead of reporting when the source already has a syntax error.**
- Location: `align-cli.ts`, `alignAndWrite`.
- If the original and the aligned output have identical diagnostics (`compareParse` status `ok`), the guard now runs. `ast.parse(before)` raises `SyntaxError`, the child exits 1 with a traceback, and `comparePythonStructure` throws.
- The throw happens inside `updateFileAtomicallySync` and nothing in `runAlignCli` catches it. The CLI crashes where it previously reported `parse=ok` and wrote.
- Whether the public wrapper maps this to the old exit code is unverified. This changes the failure shape for already-invalid Python files.
- The same applies to `pythonStringRanges` on invalid Python that contains an f-prefix. It also affects `alignment-only.ts` line 33, which calls `changedLines` with `PYTHON_SYNTAX`; I did not check whether that caller catches the throw.

**3. [Medium, demonstrable on Python 3.9–3.11] The STRING fallback ignores uppercase `F`.**
- Location: `string-ranges.ts`, `if 'f' in prefix or 't' in prefix`.
- `prefix` is matched case-insensitively with `(?i)`, but the membership test is case-sensitive.
- `F"..."` has prefix `"F"`, so `'f' in "F"` is false and the span is not protected. `RF"..."` and `FR"..."` miss the same way. `Rf` and `fR` are caught by accident.
- The probe regex does flag these files (the `i` flag), so the subprocess runs and then returns no range.
- Python 3.9–3.11 tokenize f-strings as a single STRING token, so this branch is the only protection there. The tests with `Fr"""` only run on 3.12+, where `FSTRING_START` is used.
- The fix is `prefix.lower()`.

**4. [Low–Medium] A12 verification on TypeScript is O(candidates × file size).**
- Location: `report.ts`, `strayPadding`.
- Each candidate joins all lines and runs `preservesTokens` on the whole file.
- The exported `straySemicolonPadding` now verifies too. `development/tools/strip-stray-padding.ts` calls it per line, so cleanup of a large file is quadratic.
- The author benchmark was 100 candidates in 1000 lines (about 122 ms). It does not cover large inputs.

**5. [Low] A12 for non-TypeScript, non-Python languages uses `PYTHON_SYNTAX` (the JSON and YAML engines exist in `format-pipeline.ts`).**
- Location: `report.ts`.
- YAML containing an apostrophe or a `f"` text can be mis-masked, or can start a tokenizer subprocess.
- A tokenizer failure is caught and suppresses all A12 alarms, so the result is silent loss of alarms, not a crash.
- `common/report.ts` also now imports from the `typescript/` and `python/` language modules. That is a layering inversion, though it follows the author's chosen design.

**6. [Low, Node/Windows compatibility] The exact stdout match depends on newline translation.**
- Location: `parse-check.ts`, `run.stdout === "BOXBOX_AST_EQUAL\n"`.
- Python's text-mode stdout on Windows would emit `\r\n`, which makes this throw `invalid response`. Trimming would fix it.
- A leading BOM in the source also makes `ast.parse` fail, so BOM-prefixed files that contain an f-prefix become unusable. I have not shown how `readFileSync("utf8")` callers treat a BOM.

## Checks I could assess from code

- **Tab widths.**
  - `cellWidth` measures at the actual start column, with the prefix bounded to 0–3 characters.
  - `columnWidths` and `rebuildCode` advance columns identically, so the start columns agree.
  - Bytes are retained.
  - The `continuing` filter matches the old `measured` selection.
  - I found no defect.
- **Whole-span opacity, newline accounting and UTF-16.**
  - Protected spans mask everything except `\n` and `\r`, and the line counters advance inside the span.
  - Sentinel replacement preserves UTF-16 length, and ranges come from the original source.
- **Fail-closed behavior.**
  - Range validation rejects non-array, wrong-length, overlapping and out-of-bounds ranges, and a timeout is passed through.
  - Non-zero exits, signals, timeouts and stderr output all throw.
  - Aside from findings 1 and 2, this is sound.
- **Ordinary files** skip the subprocess via the probe regex. The one test fixture I saw covers the `'off'` case with an empty PATH.
- **No eval or exec.**
  - The product code only parses.
  - The test evaluates a fixed synthetic snippet.
- **A12 false alarms** in comments, templates and multiline strings are excluded by token or preservation checks.
- **No new approvals or public JSON fields** appear in the diff.

## Limits

I ran no tests. My claim about `SyntaxWarning` on `ast.parse` is from CPython behavior as I recall it. I could not verify it here, so finding 1 should be reproduced first. I did not check lone-`\r` line endings against the tokenizer's row numbering. I did not review the TS grid-kinds work or the pending whole-tree layout.
