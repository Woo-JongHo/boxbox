# BoxBox first-use formatting: follow-up audit of the N1 delta

I only read the supplied sources and records. I ran no commands or tests, and every result cited below comes from the supplied logs. I did not write a plan file, because you asked for the report as the response.

## Verdicts

| Scope | Verdict |
|---|---|
| Implementation scope (#1 contract) | **PASS** |
| Carried-forward layout finding 1 (dangling links) | **PASS** |
| Carried-forward layout finding 2 (stale references) | **PASS** |

**No necessary defects remain.**

## N1 closure, traced

**The fix.** `profile.ts:260-261` tests the masked value slice with `/(?<![=!<>:])=(?!=)/`. Tracing the cases:

- **Exact trigger** `much_longer = self.cache = 22`:
  - `NAME` cannot contain whitespace or `=`, so the target is `much_longer` and the value is `self.cache = 22`.
  - The bare `=` makes the axis `chain-target`, so the key is `chain-target>equal>value`, which is not the approved key.
- **Mixed run** (`alpha` / chain / `mid`):
  - `signatureOf` (`table-engine.ts:95-97`) includes the axes, so the run splits into three one-row runs.
  - No three-row `name>equal>value` table can form.
- **Valid values that must keep the normal key:**
  - The lookbehind and lookahead exclude `==`, `!=`, `<=` and `>=`.
  - String interiors are masked, and trailing comments are cut before profiling (`table-engine.ts:135-140`).
  - The `:` exclusion only affects `:=`. An unparenthesised `:=` is invalid Python, and a parenthesised one is refused by `isUnsafe`.
- **Other ways a non-simple target could reach the approved key:**
  - Subscript, tuple and starred targets fail `NAME` or `isUnsafe`.
  - `x = y = f(...)` fails the call regex and is then refused by `isUnsafe`.
  - Dotted names get the `attribute` axis.
  - Annotated chains are invalid Python and use a different key anyway.
  - I found no remaining path by which a non-plain target reaches `name>equal>value`.

**Tests.**
- `recommended-preset.test.ts:231-258` runs the real `product/packages/cli/entry.ts` on three inputs: plain chains, the exact mixed N1 trigger, and all-attribute chains.
- For each it asserts exit code 2, `FORMAT_NOT_ELIGIBLE` and unchanged bytes. Comparisons and quoted `=` are covered as positive controls.
- Before the fix the mixed case was approved and writable (`chained-assignment-repro.json`), so this test genuinely tells the two versions apart.
- It passes in `chained-assignment-tests.log` and in `check-final.log` (482 pass / 5 skip / 0 fail).

**Native Windows run.**
- The installed 0.2.1 artifact reports `chain-target` axes for `chained.py` and refuses to format it. That shows the shipped artifact contains the fix.
- The mixed and attribute-chain variants were exercised only from source. They go through the same profile path, so this is acceptable.

## Previously unverifiable items, now resolved

- **`table-engine.ts`:** nothing hidden changes the N1 analysis.
  - The minimum-row floor of 3 is at `:116`.
  - The lossless gap check is at `:145-148`.
  - A table whose edit changes anything but whitespace is refused as a whole (`:232-247`).
- **`guarded-run.ts:23`** excludes `.boxbox`, so receipts from direct-CLI hooks cannot show up as changed files.
- **`globToRegExp`:** `**/*.ts` compiles to `^.*[^/]*\.ts$`, so `.tsx`, `.mts` and `.cts` do not match.
- **`repositoryFile`** (`load-source-file.ts:12-21`) refuses lexical and physical escapes and non-regular files.
- **`examples-check.ts:31`** defines `PRESET`.
- **Provenance:**
  - `sourceManifestSha256` equals the supplied manifest hash.
  - `artifactSha256` equals the native artifact SHA (`6fc35d…`).
  - `sourceStableDuringBuild` is true.
  - I did not recompute any hash.
- **Native transcripts** now itemise each case:
  - an empty npm cache;
  - Python LF and CRLF;
  - TypeScript LF and CRLF, with scanner token equality;
  - attribute and chain refusal;
  - a configured formatter (`executableStable: true`);
  - a timeout, with the started descendant killed and the file bytes unchanged.
- **Migration:**
  - `native-upgrade.log` records the rejected automatic registration.
  - The upgrade evidence shows an explicit `marketplace remove` followed by a successful install, which matches the installer README.
- **`SKILL.md:37-38`** now distinguishes fix/format requests from check/review requests, which resolves prior optional note 9.

## Carried-forward layout

**Finding 1.** `layout.test` "dangling output links never create external files or directories" now appears by name as passing in `check-final.log`.

**Finding 2.** Every remaining reference resolves according to the supplied existence checks:

| Reference | Resolves to |
|---|---|
| `charter.md:65` | `docs/development/design.md` |
| `charter.md:69` | `docs/development/plan.md` |
| `grammar.md:4` | the 2026-09-30 Codex grammar review |
| `grammar.md:132` | `development/corpus/manifest.json` |
| `harness/README.md:59` | `product/packages/` |
| dev `SKILL.md:122` | `test/fixtures/table-kinds.ts` and `test/typescript-align.test.ts` |

## Non-blocking observations (new)

1. **Charter invariant 11 is stale.** `charter.md:59` still says "not implemented (M2)", but the format pipeline now runs the formatter first, then BoxBox, with a two-cycle fixed point. The shipped reference understates what exists, which is the safe direction. Update it through the charter's §7 procedure.
2. **Possibly wrong path in the charter.** `charter.md:63` points to `.boxbox/rules/`, but project conventions load from `.boxbox/conventions.jsonl` (`conventions.ts:106`). It may be a planned design path.
3. **Profile header is out of date.** The comment at `profile.ts:5-16` does not mention the `chain-target` axis. It also does not mention that `lambda a=1:` values are now excluded as a side effect.
4. **Delta list may be incomplete.**
   - `python.json:9` adds the `chain-target` surface form, but the delta list names only three files.
   - If `python.json` was in the original audit manifest, the list is incomplete.
   - The content itself is consistent (the surface tests pass), and the manifest hash covers the file.
5. **Same class of gap as N1 in call rows.**
   - `assignedCallProfile` (`profile.ts:159`) labels dotted targets with the `name` axis.
   - This has no effect today, because call-row keys are unapproved.
   - A future call-row approval would silently include attribute targets. Split out an `attribute` axis before approving any call-row rule.
6. **Test layout.**
   - `recommended-preset.test.ts:231-258` interleaves definitions, actions and `expect` lines without the blank-line paragraphs AGENTS.md requires in touched files.
   - It also repeats the spawn call. A helper like `inspectTypeScript` would fix both.
7. **TypeScript native evidence is not self-identifying.** `native-final-typescript-evidence.json` has no root or artifact field. It is tied to the same installation only by how `native-typescript.mjs:6-9` is written.

## Still open, not blockers

The prior optional notes remain open as release work:
- the TypeScript single-row axis dropping out of the key;
- Windows hook quoting;
- lock-recovery guidance;
- the doctor requiring `python3` for TypeScript-only projects;
- `pluginFiles` path separators on Windows;
- the static `PLUGIN_FILES` list;
- the hard-coded `CLI_VERSION`.

These remain explicitly unverified, and this report makes no completion claim about them:
- native hook event delivery;
- automatic marketplace-source migration;
- the Claude-side upgrade;
- public release and licensing.