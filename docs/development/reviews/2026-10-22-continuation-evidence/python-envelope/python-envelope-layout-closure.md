# Whole-file test layout closure

Changed only `test/python-align.test.ts`, using the actual TypeScript 06 command. Earlier changed-range fixed-point evidence did not establish a whole-file fixed point; this pass closes that specific gap.

Commands:

```sh
bun product/engine/typescript/06_align-tables.ts --file test/python-align.test.ts --write --json
bun product/engine/typescript/06_align-tables.ts --file test/python-align.test.ts --json
bun test test/python-align.test.ts test/python-assignment-envelope.test.ts test/corpus-signatures.test.ts --timeout 60000
bunx tsc --noEmit
```

The write applied 18 horizontal edits across six previously misaligned groups. Read-only whole-file recheck returned exit 0, 16 groups, zero misaligned, zero edits, zero refused. `assertAlignmentOnly` and `preservesTokens` independently confirm exact tokens, comments, literals/fixture strings, indentation and physical line breaks are preserved. Prebytes: `python-envelope-layout-before.test.ts`; machine proof: `python-envelope-layout-preservation.json`.

Focused tests: 39 pass, 0 fail, 208 assertions. Type check and `git diff --check`: exit 0. Logs use fresh `python-envelope-layout-*` names; prior full-suite evidence is untouched. No full-suite rerun or runtime source edit occurred in this pass. All three product source hashes and the other two test hashes remain unchanged.

Final test SHA-256: `20dcdbbb26cf28938970351445340428f1174a967b33fdae236503e5a02a23bf` (previous `e2055746f2a5489d2ff8810a7ea278cb41a9b139319973041a862392c9a0654d`). All frozen hashes and CLI summaries: `python-envelope-layout-frozen-hashes.json`.

All owned files are frozen again. No subprocess remains running.
