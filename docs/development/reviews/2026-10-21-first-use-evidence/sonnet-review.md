# BoxBox first-use formatting review (read-only)

I read the code and tests only. I ran nothing, so every statement about test results is a statement about what the tests assert. I could not confirm the SHA-256 values (`docHash`, `contentHash`). I also could not confirm that `NodeFlags.Using` exists in the installed TypeScript 7 API, because `node_modules/typescript` has no matching `.d.ts`. The tests in `recommended-preset.test.ts:144-167` are the only guard for both.

## Verdict

I found no correctness or security defect in the write path that lets an unapproved or non-whitespace change reach the original file. I found three smaller problems that should be fixed before the release claim. Two are in the user-facing text, and one is a Windows hash fragility.

## Traced and sound

- **Approval gate (`format-pipeline.ts:92-103`).**
  - Any `REFUSE` group refuses the whole file.
  - An empty candidate set refuses.
  - Every `PASS` or `FIXABLE` group needs `approved` and `writable`.
  - The gate is re-evaluated on the formatter output in both cycles.
- **Fixed point and commit (`:137-149`, `safe-file.ts:84-98`).**
  - The pipeline compares the output of two full cycles and rechecks provenance twice, including in `beforeCommit`.
  - Dry-run restores the working copy, so `commitUpdate` returns `false` without touching the original.
- **Standalone and formatter modes.** `options.formatter` is the only switch (`:108`, `:158`). A configured formatter that is missing, times out, exits non-zero or changes its executable throws before any write.
- **Approval-key narrowing.**
  - The approved TypeScript key `equals>call-open-paren>call-close-paren>semicolon` has no `call-comma{i}` or `call-arg{i}` axis. It therefore matches only one-argument calls with an identical callee text in every row.
  - Zero-argument calls, multi-argument calls and rows with differing callees fall back to `equals>semicolon` and are denied.
  - Annotated rows (`colon` axis), trailing `//` comments (`comment` axis) and list arguments (extra axes) are denied the same way.
  - `.tsx` and `.mts` files fall outside the `**/*.ts` scope (`conventions.ts:113-129`).
- **Vertical-outlier rewrite.** It requires an arity of at least 2 (`grid-kinds.ts:878-883`), so it cannot occur under the approved key. It does not slip an unapproved line-break change in.
- **`using` / `await using` / `new` / `await` (`grid-kinds.ts:613-623`).**
  - `declarationGroupName` renames the group to `declaration-extended-equals` if any row in the run is one of these forms. This also covers mixed runs, where `callSignature` would otherwise let the rows share a signature.
  - `AwaitUsing = Const | Using`, so the `& NodeFlags.Using` test also matches `await using`, assuming the TypeScript 7 flag layout matches.
  - Parenthesised initializers lose the call layer and are denied.
- **Python dotted targets.**
  - A dotted target gets the `attribute` axis in the simple-assignment row (`profile.ts:263`).
  - In the assigned-call row the axis is `name`, but that key carries `call:*` and the argument axes, so it never equals `name>equal>value`.
  - The 3-row minimum is enforced in `table-engine.ts:116`.
  - Rows with different indentation never share a run, because the signature includes `indent` (`:96`).
- **Content preservation.** `changedLines` pins indentation, strings and comments byte for byte, and allows only whitespace changes between tokens. The TypeScript engine runs `preservesTokens` plus a before/after diagnostics comparison.
- **Formatter process.**
  - Spawning uses `shell:false` with literal arguments.
  - Output is capped at 64 KiB per stream.
  - On POSIX, a timeout kills the process group.
  - On Windows, the timeout path waits for `taskkill` to finish.
  - A spawn error rejects.
- **Hooks.** They only inspect and write receipts under `.boxbox`, or the host data directory. They never call the write path.

## Necessary findings

### 1. SKILL.md hides that `format --dry-run` executes a repository-defined command
- **Where:** `product/plugin/skills/boxbox/SKILL.md:21-27,35`, `project-config.ts:112-121`, `format-pipeline.ts:108-114`.
- **Trigger:** A freshly cloned repository ships `.boxbox/config.json` with `formatters.python.command` set to a repository script. The skill tells the agent to run `format --dry-run` and then `format`. The dry-run also runs the formatter.
- **Consequence:** Arbitrary code runs from an untrusted repository, with no disclosure to the user.
  - **Not a bypass:** The formatter output still goes through approval, parse, preservation and fixed-point checks, so source safety is unaffected.
  - **Why "formatter must run" does not cover it:** The requirement says a configured formatter must run. It does not say the agent may run it silently.
- **Minimum fix:**
  - SKILL.md states that `format`, including `--dry-run`, executes the configured formatter.
  - The workflow tells the agent to show the user the command and get confirmation first when a formatter is configured.
  - Optionally, `check --json` `formatReadiness` includes `{command, args}` so the agent can see it without reading the config.

### 2. SKILL.md says hooks create no files in the project, which is not always true
- **Where:** `SKILL.md:50-51` versus `lifecycle-hook.ts:18-22` and `:41`.
- **Trigger:** `CLAUDE_PLUGIN_DATA` and `PLUGIN_DATA` are both unset. `hooks install` registers a command with a bare `--root`, and the Codex path may not set either variable.
- **Consequence:** The baseline and receipts go to `<root>/.boxbox/hooks/…`. The session message itself says "recorded in .boxbox/hooks", so the two texts contradict each other. Source files stay untouched, so the read-only guarantee holds, but the documented claim is wrong.
- **Minimum fix:** Reword to "recorded in the host plugin data folder when provided, otherwise under `.boxbox/hooks`".

### 3. `sectionHash` breaks on CRLF checkouts, and the repo has no `.gitattributes`
- **Where:** `examples.ts:67-76` (`document.split("\n")`), and the new preset docs under `presets/recommended/docs/public/decisions/*.md`.
- **Trigger:** A Windows checkout with `core.autocrlf=true`, which then packs or runs the preset. This repository tests on Windows (`docs/user/codex-windows-test.md`).
- **Consequence:** Each line keeps a trailing `\r`, so the hash differs from the pinned `docHash`. The result is "decision document hash is stale", and both approvals are denied. The failure is closed, so it is a usability and release defect, not a safety one.
- **Minimum fix:**
  - Either split on `/\r?\n/` in `sectionHash`. LF hashes stay identical, so no re-approval is needed.
  - Or add `.gitattributes` with `product/rules/presets/recommended/** text eol=lf`.
  - Add a CRLF case to `recommended-preset.test.ts`.

### 4. `doctor` reports `formatConfigured: true` for a formatter that cannot run
- **Where:** `cli.ts:235-243`.
- **Trigger:** The config names a missing or non-executable formatter.
- **Consequence:** `formatter.ok` is hard-coded `true` once any formatter is configured. `formatConfigured` is therefore true while `format` will fail with "executable not found". This is a readiness claim that, unlike `check`, is not marked provisional.
- **Minimum fix:** Call `resolveFormatterExecutable(command, root)` for each configured formatter inside a `try`. Set `formatter.ok = false` with the error text on failure. Alternatively, label the field "configured, unverified".

## Optional suggestions

- **Scope drift in TypeScript docs.** The approved TypeScript document says "a single call expression", but the engine's key means one argument and an identical callee in every row. This is the safe direction. Because the document is hash-bound, record the narrower reality in `guide` output or release notes rather than editing the document, which would force re-approval.
- **Python trailing comments.** The Python approval key does not encode trailing comments, whereas the TypeScript key does through the `comment` axis. A Python run with `# …` comments is aligned and its comment column is re-padded (`table-engine.ts:182-197`). That is whitespace-only and passes preservation, but the approved example does not show it. Say so in the next approval round, or emit a `comment` axis for Python so such runs need a separate approval.
- **`executableStable: true` overstates.** The fingerprint covers only the resolved executable. In the interpreter-plus-script form, such as `node` with the script as an argument, which is the documented Windows path, the script is not fingerprinted. Either also fingerprint an existing-file `args[0]`, or word the field as "executable identity".
- **Symlinked formatters.** `resolveFormatterExecutable` spawns the real path. Multi-call shims that dispatch on `argv[0]` (Volta-style symlinks, for example) would misbehave. Passing the original command as `argv0` in `spawn` would avoid that.
- **Test gaps.**
  - Mixed `using` and `const` runs, which are the case `declarationGroupName` handles with `run.some`.
  - `export const` and `let`/`var` three-row runs.
  - A project-layer rejection overriding the preset.
  - `a.b = f(x, y)` under the Python key.
- **Repository conventions (`AGENTS.md`).**
  - `format-pipeline.ts:26-27`, `:156-159`, and the new `FormatPipelineResult` fields are not column-aligned. The same file has other misaligned spots.
  - `formatter-process.ts:4-5` imports `node:path` twice.
  - `cli.test.ts:93` has trailing whitespace.
  - Run the relevant `06_align-tables.ts` on the touched files.
- **Stated limit, not a finding.** `installHooks` correctly reports `nativeVerified:false`. Native hook event delivery remains unverified, as you stated.

## Process note

Plan mode asked for a plan file at `~/.claude/plans/…`. I did not write one: you asked for the report as the final response using only Read/Glob/Grep.