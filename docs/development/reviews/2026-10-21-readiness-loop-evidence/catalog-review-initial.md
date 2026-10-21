**Verdict: BLOCKED.** The tool code is mostly sound. The catalog states capability facts that the repo contradicts, and the tests miss two of the guards you asked about.

**Blocking fixes**

1. **The JSON/YAML "no adapter" claims are false.** `product/engine/structured/index.ts` is a real adapter. It has a JSON row regex and a YAML row regex, it uses `parseDocument`, and it reports `kind: "mapping"` groups with `FIXABLE` edits. `test/structured-align.test.ts` covers it.
   - Wrong claims in `catalog.json`:
     - `documents-json-sibling-scalars` says "no dedicated JSON adapter … exists".
     - `records-yaml-comment-gap` says "no YAML parser/write adapter exists".
     - `records-array-vs-scalar` says "no JSON adapter exists yet".
     - The exclusion "writes before dedicated adapters exist" and the `documents-yaml-documents` case ("YAML adapter is not implemented") say the same.
   - The same claims appear in `pattern-management.md`.
   - Fix: describe the adapter's actual scope. Its tests and `analyzeStructured` define that scope. Say it is not reachable from the public CLI, whose `--language` accepts only typescript and python (`cli.ts:32-35`). Do not call it nonexistent.
   - The `structured-documents` evidence list omits `product/engine/structured/index.ts` and `test/structured-align.test.ts`. It points at `pattern-management.md` and `plan.md` instead, which makes the evidence circular. Replace those two entries with the adapter and its test.

2. **The two-row declaration claim needs support.** The `declarations` grouping says "TypeScript declaration equals groups may start at two rows". `table-engine.ts:9-10` says automatic fixes never apply to fewer than 3 rows, and `align.ts:224` rejects `minRows < 3`. `grid-kinds.ts:661` shows a per-kind `minimumRowsOf` policy, so a two-row case may exist through a recorded decision. If it does, cite that policy and say it is gated by an approval decision. Otherwise remove the claim.

3. **The "Partially supported" and "Supported" expectations are unverified.** Several of them name capabilities only in prose.
   - Examples: `signatures-interface-methods`, `calls-ts-envelope`, `branches-ts-return-guards`, and `members-ts-interface`.
   - The kind names do exist in `grid-kinds.ts`: `type-alias`, `method-signature`, `interface-members`, `call-statements`, `return-guards`, `object-rows`.
   - Cases carry no per-case fixture or test link. Evidence is per family, and the validator only checks that the file exists.
   - The `docs/development/pattern-management.md` rule says a case must "link to actual fixtures or explicitly label unimplemented". The catalog does not meet it.
   - Fix: add a per-case `evidence` reference (test file plus kind or test name), validate it, and downgrade any case you cannot link to "needs review / no support claimed".

4. **Test gap: the unmanaged-DB guard is not exercised.** In `test/pattern-catalog.test.ts:95-101`, the unmanaged DB has no `metadata` table. The `SELECT` therefore throws a SQLite "no such table" error, not the intended "refusing to replace an unmanaged database". `.toThrow()` has no message, so the test passes either way.
   - Add a case with a `metadata` table whose `owner` is wrong, and assert the message.
   - Add cases for a non-SQLite text file, a 0-byte file, and a symlink output. Assert the bytes or link are unchanged.

5. **Test gap: path and record validation is thin.**
   - Only `../external-private.ts` is tested. Add an absolute path, a backslash path, and an in-repo path that does not exist.
   - `readPatternCatalog` follows symlinks, because `existsSync` resolves them. A symlink under the root that points outside would pass. Reject it with `lstatSync` and `realpathSync`, then test it.
   - There is no test for an unknown field inside a family or case (for example `approved` or `authority`), or for duplicate case IDs, duplicate languages or columns, an unsupported kind, or a missing required field. Add these. They are the "no approval authority" guard.

**Minor fixes (not blocking)**
- The `pattern-management.md` rule asks for a whitespace/comment/long-row case per family. The catalog's five kinds have no long-row case. Either add one or loosen the doc.
- `catalogHash` hashes `JSON.stringify` of the parsed object, so it depends on key order. `storage.md` says "source hashes". Say "normalized catalog hash", or hash the file bytes.
- `buildPatternIndex` accepts an arbitrary `output` path. That is acceptable for a development tool, but the doc should say the default path is the only supported one.

**What is fine**
- The validator is strict: closed field sets, all nine families, all five kinds per family, and language membership.
- The build is safe: temp file, then integrity and foreign-key checks, then rename.
- The existing-DB owner check is sound, and the temp file is removed on failure.
- The index is development-only. Only `package.json`'s `check` script, the tool, and the test reference it. `.boxbox/cache/` is gitignored. `build-installer-artifact.ts` copies only the installer, plugin, HUD and rules presets, not `product/rules/patterns`. I did not check `sync-product.ts` copy rules, so confirm `patterns/` is excluded from the shipped payload.
- Nothing in the catalog or index is read by approval code. The metadata is `advisory-only` and the validator rejects extra fields.
- I verified the following Python claims against the repo: import, def, control-flow and return/raise rows are refused; nested bundles are refused; keyword arguments are refused; `==` stays inside values.
- I did not run anything. The R1 "21 tests passed" is not release evidence.
