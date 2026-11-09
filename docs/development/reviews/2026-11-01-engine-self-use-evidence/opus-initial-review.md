**Verdict: FINDINGS**

I ran nothing: no tests, no CLI. Everything below comes from reading the frozen sources, the supplied patches and the recorded logs.

The write paths look safe. I found no new approvals, rules, languages or axis names, and nothing in the diff executes source code. There is still one gap in the invalid-source contract, one weakness in the mutation-test oracle, and two gaps in the evidence.

## Code findings (most important first)

**1. [Medium] Invalid Python still crashes check mode. The earlier invalid-f-string fix only covers writes.**
- **Where:** `common/align-cli.ts`, function `alignOnly` (lines 87–95). It calls `alignSource`, which runs `maskSource`, which calls `pythonStringRanges` with no try/catch. Only `alignAndWrite` (lines 102–109) catches `PythonSourceSyntaxError`.
- **Example:** a file containing `text=f"{1}"\na=1\nlonger=2\nthird=3\nif:\n`, run through the raw check path with no `--write` (`internal-runner.ts python --file x.py --json`, `python/06_align-tables.ts`, or `01_group-regions.ts`). The error is uncaught, so the run prints a traceback and no JSON.
- The same source without the `f` prefix gets a normal JSON report.
- The quick prefix check (line 45) can also fire on plain string content. In `x = "a:t"`, the `t"` matches because `:` is not an identifier character. So malformed files can crash even when they contain no real f-string.
- **Who is affected:** not the public CLI. `inspectFile` and `check` run `validateSyntax` first, and the format pipeline runs `parse` before `check`.
- **Tests:** they cover only `--write --json` (`line-write-safety.test.ts:167–180`).
- **Smallest fix to show:** catch the error the same way in `alignOnly`, and add a raw no-write `--json` test using the example above.

**2. [Medium] The mutation test does not show that "aligned" seeds were valid Python.**
- **Where:** `test/mutation.test.ts`, function `violation` (lines 54–70).
- **What happens:** an input is only rejected as invalid if it throws. It only throws if the f/t-prefix check on line 45 of `string-ranges.ts` matches. Neither fixture (`tables.py`, `tricky.py`) contains an f-string, so the 114 rejections were triggered by chance matches such as a mutated string ending in `:t'`.
- **Consequence:** an invalid seed that doesn't trigger that check is aligned and counted under `aligned`. Example: `a=1\nlonger=2\nthird=3\nif:\n`.
- All 1000 seeds are counted exactly once, and only confirmed-invalid errors are excused, so those two requirements hold. But "invalid inputs are not treated as aligned" does not hold by construction. The 886 should not be described as 886 valid aligned seeds.
- **Smallest fix to show:** run `syntaxDiagnostics` on every seed, then report valid-aligned, invalid-aligned and invalid-rejected separately.

**3. [Low] Python A12 silently drops every alarm when the Python helper fails.**
- **Where:** `common/report.ts:435–441`.
- **What happens:** the bare `catch { changed = strayLines; }` suppresses all A12 alarms for the file on any error: missing `python3`, a protocol error, a timeout, or invalid source with a prefix match.
- Alarms are only advisory, so this is not a safety problem. But the failure is hidden rather than reported.
- **Smallest fix to show:** catch only `PythonSourceSyntaxError`, or report that the check failed.

## Areas I checked and found sound

- **Residual invalid-f-string finding:** closed on the write path. The child script prints an exact marker only when `ast.parse` raises `SyntaxError`. The marker check is anchored and accepts LF or CRLF. Other failures (non-zero exit, stderr output, timeout, bad JSON, unbalanced or out-of-order ranges) still throw. In the write path, the catch accepts only Python plus `PythonSourceSyntaxError`, sets `parse=changed` and writes nothing. No range is ever guessed. The check-mode gap is finding 1.
- **AST guard vs. formatter diagnostics:** kept separate. `comparePythonStructure` runs only after `compareParse` returns `ok`. Anything other than `changed` from `compareParse` throws, so the AST guard cannot be skipped by a "skipped" status. `ast.dump(include_attributes=False)` catches changes to literal text, format specs and `=` debug text.
- **Offsets and line endings:** offsets are UTF-16 code units, computed per `\n`-split line from tokenize's character columns. Protected ranges blank only non-`\r`/`\n` characters, so line geometry is kept. In `preservation.ts`, ranges are computed on the original text before the sentinel replacement, which keeps the same length.
- **Scanner parity:** whitespace is reported before brace and regex handling and never updates `previous`, so `tokenStream` is unchanged. A12 candidate gaps must match one scanner whitespace token exactly. Comments, strings, templates and regexes are therefore rejected. A12 now runs only for TypeScript and Python, so JSON and YAML get no candidates. `straySemicolonPadding` keeps its signature and its per-candidate check.
- **TypeScript insert axes:** each new start point (`nameEnd`, `closeAnchor`, `close+1`, `expression.getEnd()`) reaches its token through `tokenAfter`. `tokenAfter` requires only `[ \t]` between the two points, so comments, trailing commas, `?` on optional methods and generics all stop row detection rather than being edited. Minimum gap stays 0, and axis and kind names are unchanged.
- **Tab start columns:** `cellWidth` uses `column % 4`, which matches `displayWidth`'s tab stops of 4. `columnWidths` and `rebuildCode` advance the column the same way.

## Evidence gaps (separate from the code findings)

- **Full check:** the log shows 677 pass, 0 fail, 4130 `expect()` calls, 75 files, 272.87s, and the mutation outcome line. The exit code 0 and `BOXBOX_REQUIRE_PARSERS=1` appear only in `freeze-verification-after-final-check.json`, not in the log itself.
- **Installed artifact:** `summary.json` records the tarball SHA `023f…398` and `unchanged: true`. Nothing I found ties that tarball to candidate `7af5b42b…`; the freeze file has no artifact entry.
- **Mechanical audit:** 49 files pass the supported public Check and 1 is unsupported (`05_inspect-hover.mjs`). That file only has a Node check, which is not a supported pass. `final-summary.json` also calls the candidate a "commit", which it is not.
- **Python 3.9 test:** it returns early unless `/usr/bin/python3` is 3.9, so it can pass without running. The log doesn't show which happened.

## Limits

- I did not execute anything.
- These are untested ideas, not findings:
  - Files that use a lone `\r` as a line ending, or start with a BOM, might give token rows or columns that don't match the `\n`-based offsets. If so, the helper either fails closed or protects the wrong span. The AST guard would still block literal changes on writes.
  - The smallest check would be targeted tests on CR-only and BOM-prefixed f-string files.
- I did not review the tests/devtools patch beyond the mutation test, or any untouched files.
- I did not verify the hashes in the 75-entry manifest.
- I did not certify that every block is semantically complete.
