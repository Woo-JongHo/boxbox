# BoxBox first-use formatting: final read-only audit (direct snapshot)

I read only the supplied packet. I ran no commands and no tests, and I wrote no plan file because you asked for the report as the response. Every claim about a test result below comes from the supplied logs, not from my own execution. The earlier timed-out Opus audit is not counted as a review.

## Verdicts

| Scope | Verdict |
|---|---|
| Implementation scope (#1 contract) | **FAIL**, on one narrow scope-fidelity defect (N1). Write safety, proof checking, fixed point, provenance and atomic replacement all hold. |
| Carried-forward layout finding 1 (dangling links) | **PASS** |
| Carried-forward layout finding 2 (stale references) | **PASS** for the one location in the packet; the other locations are **UNVERIFIED** because their files were not supplied |

## Necessary defect

### N1. A Python chained assignment brings an attribute target into the approved `name>equal>value` table

- **Where:** `product/engine/python/profile.ts:46` and `:254-267`, against `py-simple-assignments.md:3`, which says "…attribute targets… are outside this approval".
- **Trigger:**
  ```
  alpha = 1
  much_longer = self.cache = 22
  mid = 333
  ```
  - The middle row fails every earlier profile: it is not a bundle, has no `(` for the call form, passes `isUnsafe`, and has no colon or quoted key.
  - `ASSIGNED` then matches it with name `much_longer` and lazy value `self.cache = 22`.
  - `valueSlot` (`:68-76`) rejects only an empty value, a value starting with `=`, or a value containing `;` or `,`. This value passes.
  - The row's axis is `name` because the name contains no `.`, so the run's key is `v1|python|-|table|name>equal>value`. That key is approved.
- **Consequence:**
  - `format` aligns a table that assigns to an attribute target, which the human-approved document excludes.
  - The edit is whitespace-only and parse-checked, so this is not a safety failure. It is the "apply only what a human approved" contract being exceeded.
  - The existing test `recommended-preset.test.ts:222-229` covers only the plain `self.x = …` form.
- **Minimum fix:**
  - In the `ASSIGNED` branch, refuse a row whose masked value contains a bare `=` that is not part of `==`, `!=`, `<=` or `>=`, for example with `/(?<![=!<>])=(?!=)/`. This also refuses `lambda a=1:` values, which is the conservative direction.
  - Add the trigger above as a denied case.
- **Status:** I found this by static trace only, and it is not executed. `table-engine.ts` was not supplied. If it adds a refusal I cannot see, this finding becomes "add the pinning test".

## Implementation scope traced as PASS

- **Standalone and formatter modes.**
  - `options.formatter` is the only switch (`format-pipeline.ts:109`, `:159`).
  - The formatter runs in both cycles, including during dry-run.
  - The run fails if the formatter is missing (`formatter-process.ts:63`), times out (`format-pipeline.ts:112`), exits non-zero (`:113`), or its executable changes (`:114`).
  - The CLI wraps every failure as `FORMAT_NOT_ELIGIBLE` (`cli.ts:372-374`) and never falls back to standalone mode.
- **Approval proof** (`approval-gate.ts:164-208`) checks each of these:
  - the decision exists with kind rule or exception and layer convention;
  - human receipts are present on the convention, the decision and each example;
  - all four version keys match;
  - the section hash matches;
  - convention and decision link the same examples;
  - each linked example is approved, has a correct content hash, and is relevant by language, pattern and rule;
  - there is at least one after-better example and at least one counterexample.
- **Layers and file gating.**
  - The project layer is searched first, and a project candidate or rejection does not fall through to the preset (`:146-157`).
  - In `approvedGroups` (`format-pipeline.ts:93-104`), any REFUSE group or any unapproved PASS/FIXABLE group refuses the whole file.
- **Two-cycle fixed point.**
  - The second cycle re-checks approval on the output of the first, so a group that only appears after alignment is caught.
  - Byte equality is enforced at `:142`.
- **Provenance and commit.**
  - Provenance is checked after both cycles (`:143`) and again inside `beforeCommit` (`:146-149`).
  - Replacement happens exactly once, after a lock, an identity and byte recheck, and a check that `nlink` is 1 (`safe-file.ts:84-98`).
  - Dry-run restores `initial`, so `commitUpdate` returns `false` (`:87`).
- **TypeScript scope.**
  - The key carries no `call-comma`/`call-arg` axis, so only one-argument calls with the same callee and arity match (`grid-kinds.ts:845`).
  - Type arguments, optional calls (`tokenAfter` fails on `?.`), non-null, `as`, and parenthesised initializers all drop the call layer.
  - `declarationGroupName` (`:614-623`) marks the whole run as extended if any row uses `using` or `await using`, or has an `await` or `new` initializer.
  - **`NodeFlags.Using` in TypeScript 7** was Sonnet's unverifiable point. It is now evidenced: the logged tests assert both "approval denied" and an unchanged file for `using` and `await using`. If the flag were undefined, those rows would carry the approved key and the format would have succeeded.
  - The container is limited to `SourceFile`, and the scope `**/*.ts` excludes `.tsx`, `.mts` and `.cts`.
- **Python scope.** Apart from N1:
  - dotted names get the `attribute` axis (`profile.ts:263`);
  - annotated, dict, bundle and call rows get keys that differ from the approved one;
  - compound assignments and mixed indentation are refused, and the logged tests show this.
- **Doctor.**
  - `cli.ts:236-243` resolves each configured formatter, and `formatConfigured` includes `formatter.ok` (`:246`).
  - The regression test that was missing earlier is now at `test/cli.test.ts:215-219`. It passes in both `doctor-crlf-recheck.log` and the final log, which closes Sonnet's open item 4.
- **Check eligibility stays provisional.** The output carries `verification: "not-run"` with a dry-run next step (`cli.ts:309`).
- **Hooks.**
  - Inspection only (`lifecycle-hook.ts:54`).
  - The launcher refuses to run without absolute host data (`launcher.mjs:16-18`).
  - The direct CLI falls back to `<root>/.boxbox/hooks` (`lifecycle-hook.ts:18-21`).
  - `SKILL.md:52-54` matches this behaviour.
- **Windows formatter process.**
  - Spawning uses `shell:false`; `.cmd`/`.bat` are refused, and `.js` runs through `execPath` (`formatter-process.ts:54-57`, `:107`).
  - Output is capped at 64 KiB per stream.
  - On timeout, the close handler awaits `taskkill /T /F` (`:154-158`). On POSIX the timeout kills the whole process group at once.
- **Unrelated `codex.exe`.** It is skipped after a bounded probe: 3 s, 4 KiB, and a strict `codex-cli X.Y.Z` match (`platform.mjs:22-34`). Real overflow and timeout probes are tested.
- **Marketplace migration and release claims.**
  - `installer/README.md:42-53` documents the explicit `marketplace remove` step and says there is no automatic migration.
  - The doctor reports `releaseReady: false`, and no general release claim is made.
- **Licence and receipts.**
  - CC0-1.0 appears only on the four synthetic examples, and the decision documents limit it to those examples.
  - The public receipt is `approvedBy: "maintainer"`.
  - The installer README keeps `UNLICENSED`.

## Carried-forward layout findings

**Finding 1 (dangling symlinks): closed.**
- Existence checks now use `lstat`:
  - `pluginFiles` reports a symlinked or non-directory `plugin` as an unexpected entry (`sync-plugin.ts:51-53`), and `syncPlugin` throws before any write (`:73-74`);
  - `pluginDrift` treats a link as drift (`:64-65`);
  - the parent walk and the target both refuse links (`:79-83`).
- `chmod` (`:87`) is only reached after any symlink has thrown.
- `test/layout.test.ts:44-60` covers a dangling `plugin/README.md` and a dangling `plugin/`, and asserts that no external file or directory is created.
- The final log excerpt does not name the layout tests individually. I rely on its "0 fail" summary.

**Finding 2 (stale references):**
- `grid-kinds.ts:5` now says `test/fixtures/table-kinds.ts`, so that one is closed.
- These were not supplied and are **UNVERIFIED**: `charter.md:65`/`:69`, `grammar.md:4`/`:132`, `development/harness/README.md:59` and `development/skills/boxbox/SKILL.md:122`.

**Prior optional items still present:**
- `PLUGIN_FILES` is a static list (`sync-plugin.ts:13-21`), so a new template is silently left out.
- `CLI_VERSION` is hard-coded (`cli.ts:26`).
- `pluginFiles` builds paths with `join` but compares them against `/` keys (`:55`), so on Windows every file would look unexpected.

## Optional notes (not blocking)

1. **An axis present in only one row drops out of the TypeScript key.**
   - `align.ts:86` skips axes with fewer than two entries, and `lookupKeyOf` hashes only the aligned axes.
   - Trigger: `const a: Foo = make(1);` followed by `const longer = make(22);`. The `colon` axis is dropped, and the key equals the approved one.
   - The TypeScript document defines scope as "the engine detects exactly the lookup key", so this is within the literal scope and stays whitespace-only. Pin it with a test, or mention it in the next approval.
2. **The scope wording is wider than the key, in the safe direction.**
   - "Single call expression" in the decision document and "single-call" at `installer/README.md:79` both mean one argument with an identical callee in practice.
   - Do not edit the hash-bound document. Clarify this in the README or release notes instead.
3. **`executableStable: true` overstates the recommended Windows form.**
   - With `node.exe` plus the script as an argument (`README:84`, and the error text at `formatter-process.ts:54`), the script is not fingerprinted. Only a direct `.js` command is (`:57`).
   - The output is still fully verified, so this concerns the label only.
4. **Misleading error text in standalone mode.**
   - `format-pipeline.ts:76` and `:80` say "formatter output does not parse" when the original file has a syntax error and no formatter is configured.
5. **Process edge cases (all fail closed).**
   - A formatter that exits 0 but leaves a detached descendant with redirected stdio is never killed (`:154-155`). The formatter is trusted code, so this is outside the boundary.
   - On Windows, if the child exits just as the timeout fires, `taskkill` on the dead PID fails. You get a cleanup error instead of the timeout message, and descendants of the exited child are not killed.
6. **`hooks install` on Windows writes commands that probably won't run.**
   - `lifecycle-hook.ts:84-91` emits POSIX single-quoted commands and no `commandWindows`. These would likely not parse in PowerShell.
   - The command already reports `nativeVerified:false`, and hook event delivery is out of scope, so record this as release work.
7. **Lock left behind after a crash.**
   - If BoxBox is killed, `.<name>.boxbox-write.lock` stays (`safe-file.ts:63-65`), and later runs keep failing with "another writer…".
   - Add recovery guidance to that error.
8. **Upgrade guidance.**
   - When Codex rejects the 0.2.0→0.2.1 registration, the installer could print the documented removal step.
   - The Claude-side upgrade was not measured.
9. **Wording mismatch on when to format.** `SKILL.md:37` says to apply approved rules, while `installer/README.md:82` and `install.mjs:92` say format follows an explicit request. Pick one.
10. **Doctor needs `python3` even for TypeScript-only projects.** `runtimeUsable` requires it (`cli.ts:245`).
11. **A Python test gap close to N1:** `x = y = 1` with plain names, which is currently aligned and arguably inside the approved scope.

## Unverifiable from the supplied packet

- **Hash values.** I did not compute the `docHash` or `contentHash` values. Their correctness rests on the logged preset tests that evaluate approval as `writable: true`, and on `validateExample` refusing a stale hash at load time.
- **Files not supplied:** `table-engine.ts`, `align-cli.ts`, `guarded-run.ts`, `conventions.ts` (`globToRegExp`), `load-source-file.ts` and `preservation.ts`.
  - Python minimum rows, indentation grouping and comment handling, and the Python write-path parse and preservation checks, rest on test evidence only.
  - Whether the hook snapshot excludes `.boxbox/` is unknown. If it does not, direct-CLI fallback receipts would show up as changed files and report UNSUPPORTED instead of PASS. That would be a reporting error only; it never blocks.
- **Native Windows evidence.**
  - `native-final-artifact.json` shows `ok: true` and a hash. It does not itemise the cases run: both languages, the configured formatter, or timeouts.
  - Nothing in the packet ties that artifact's hash to the current source tree.
- **Migration log.** It shows only the before and after states. The rejected automatic registration and the `remove` command transcript are not included.
- **Final check log.** It is an excerpt. I relied on its stated exit status 0, its 481 pass / 5 skip / 0 fail summary, and the stated SHA.
- **`examples-check.ts`.** The diff uses `PRESET` but adds no definition, so it must already be defined elsewhere in the file. I cannot confirm that.