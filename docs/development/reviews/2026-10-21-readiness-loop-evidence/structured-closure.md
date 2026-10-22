**PASS.** All four required fixes hold up on source reading. I found no new blocking regression. I did not run anything. The "17 pass / 85 asserts" figure is unverified, though the test count does add up to 17: 11 in `structured-align.test.ts` and 6 in `structured-pipeline.test.ts`. Per your note, B1–B4 come from the earlier review trace, not from executing the old adapter.

**B1 (inner pair overwrites outer): fixed**
- `parseYaml` (`structured/index.ts:120-154`) keeps the first pair on a physical line. A second pair adds the line to `ambiguousLines` instead of overwriting, and the line is refused as "multiple YAML pairs" before any row is built.
- Row construction is now strict:
  - The AST key range must equal the regex key.
  - The key must start at the indent.
  - Key, value and line-end ranges must stay on that line.
  - The row must reconstruct the line exactly from horizontal whitespace, with the value taken from the AST value range (`:173-175`).
- Lone-CR lines, non-ASCII keys, multi-line scalars, flow values and null values all fail the regex or range checks. They refuse; they don't misalign.
- Multi-line flow maps like `x: {\n a: 1,\n bb: 2,\n ccc: 3\n}` can still form a run. The edit there is horizontal whitespace only and is checked by `preservesStructured`, so it is safe.

**B2 (whitespace oracle): fixed**
- `preservesStructured` (`:227-244`) no longer trusts the aligner. It re-parses both sides and requires:
  - equal line counts;
  - an alignable row on each changed line on both sides;
  - whitespace-only `beforeColon` and `afterColon` on both sides;
  - identical leading indent and identical trailing whitespace plus CR;
  - identical content once spaces and tabs are removed;
  - an identical `rowSkeleton` (indent, key, tail, suffix, eol).
- Because the skeleton compares tail and key exactly, whitespace inside values or keys cannot change, even though the strip-whitespace comparison alone would allow it.
- The final test covers a trailing-whitespace change and an EOL change (CRLF to LF).

**B3 (unresolved aliases): fixed**
- The `Alias` visitor (`:105-110`) calls `node.resolve(document)` with no context. I checked `node_modules/yaml/dist/nodes/Alias.js:23-45`: it scans anchors and aliases in document order and stops at the alias itself. Missing and forward anchors therefore return `undefined` and throw.
- Self-referential `&cycle [*cycle]` still resolves, because the anchor is registered before the inner alias.
- There is no `toJS`, so nothing expands.
- The syntax check, `analyzeStructured` and `assertParses` all go through `parse`.

**B4 (invalid UTF-8 rewrite): fixed within scope**
- `readStructuredUtf8` (`format-pipeline.ts:113-118`) does a decode and re-encode round trip. It is used in `checkFile`, `assertParses` and `writeFileWithEngine`.
- `assertParses` runs first in `cycle` (`:144`), so a bad file throws before any write.
- The test covers both `alignmentOnly` values and compares raw bytes afterwards.
- `assertAlignmentOnly` has its own round-trip guard as a second layer.
- A BOM round-trips fine; JSON then refuses it through `JSON.parse`.

**Non-blocking suggestions (not mandatory for PASS)**
1. No test asserts the "multiple YAML pairs on one physical line" reason. The ambiguous-flow-map test (`structured-align.test.ts:62-69`) only checks that refusals are non-empty and the output is unchanged. It would still pass if the `ambiguousLines` branch were deleted, because the first-wins pair is already refused as non-scalar. Add `expect(refusals.map(r => r.reason)).toContain("multiple YAML pairs on one physical line are not alignable")` for `a: {k: 1}`.
2. There is no forward-alias test, such as `x: *a\na: &a 1`. The code handles it, but only the missing-anchor case is covered.
3. `Alias.resolve(document)` without a context rescans the whole document for every alias, so cost grows as aliases × nodes. That is not an expansion risk, but a very alias-heavy file will be slow. Sharing one `aliasResolveCache` context across the visitor would fix it.
4. When a formatter is configured, the formatter runs before the first UTF-8 check (`cycle` `:136-144`). Invalid input bytes are therefore never checked directly; only the formatter's output is. Standalone and Align modes are covered. Check this against your threat model, since the syntax-module byte validation is in the separate CLI review.

No preset approval or publication verdict is given.
