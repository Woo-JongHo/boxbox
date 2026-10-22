# Corpus signature regression closure

Scope: only `test/corpus-signatures.test.ts` changed in this pass. Runtime source and both Python test files remain at their prior frozen hashes.

The full suite exposed an obsolete assertion that heterogeneous Python call assignments can never form a table. It now explicitly asserts the new outer corpus signature `python||table|name>equal>assignment-value|d0`, stable before/after alignment, and unchanged RHS bytes. The adjacent complete three-row arity-2 and arity-3 tables still assert their two exact original detailed signatures; no fallback table replaces them. The test name describes these separate contracts.

The original full-suite failure log `/tmp/boxbox-readiness/python-envelope-full-check.log` is untouched. The separate npm ENOSPC failure and full-suite rerun remain parent-owned; no environmental cleanup occurred here.

Verification:

- `bun test test/corpus-signatures.test.ts test/python-assignment-envelope.test.ts test/python-align.test.ts --timeout 60000`: 39 pass, 0 fail, 208 assertions, 1.47s. Log `python-envelope-corpus-tests.log`.
- `bunx tsc --noEmit`: exit 0. Log `python-envelope-corpus-typecheck.log`.
- Changed test block aligned by current-source preserved proposals; read-only second pass reports zero edits. Receipts `python-envelope-corpus-format.json` and `python-envelope-corpus-format-fixedpoint.json`.
- `git diff --check`: exit 0. Direct placeholder/skip/only search empty (`python-envelope-corpus-placeholders.log`).
- All three runtime sources unchanged by SHA-256. Frozen test hashes in `python-envelope-corpus-frozen-hashes.json`:
  - corpus-signatures: `3132f8deff559dc1426a00b9d032a508799c0fa4ea632a6518183c0562851795`
  - python-assignment-envelope: `563e9a1845699616851638155dac319440624e98dc558ab60fa1c67b5b79d1b5`
  - python-align: `e2055746f2a5489d2ff8810a7ea278cb41a9b139319973041a862392c9a0654d`

Source and all three tests are frozen. No running subprocess remains; no hang or retry occurred in this pass.
