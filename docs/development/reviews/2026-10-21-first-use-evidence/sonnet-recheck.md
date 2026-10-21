## Follow-up review: three findings closed, one closed in code but missing its regression test

I read files only and ran nothing. I make no claims about test results, only about what the code and tests assert.

| # | Finding | Status |
|---|---|---|
| 1 | `format --dry-run` runs a repo-defined formatter | Closed |
| 2 | Hook-storage text contradicted the code | Closed |
| 3 | `sectionHash` broke on CRLF checkouts | Closed |
| 4 | `doctor` reported `formatConfigured: true` for an unrunnable formatter | Code closed; claimed regression test not found |

### 1. Closed
- `product/plugin/skills/boxbox/SKILL.md:26-29` now says three things:
  - `format` runs a configured formatter first.
  - `--dry-run` also runs it twice.
  - The agent must inspect the effective command and arguments first, use existing authorization, and ask only when executing that command is outside the authorized work.
- `product/plugin/README.md:23` says the same ("including during dry-run").
- The generated `plugin/skills/boxbox/SKILL.md` carries the same hook text. I did not diff the generated copy for the formatter lines.
- The spec does not require `formatReadiness` to expose the command, and I did not treat that as a blocker.

### 2. Closed
- `launcher.mjs:17-18` throws when the host data folder is missing or not absolute, with "no project files were written". `SKILL.md:53-54` now matches: the npm launcher requires host data, and direct `hooks install` hooks may fall back to `.boxbox/hooks`.
- `lifecycle-hook.ts:41` now reports the actual `${directory}`. That is the real state directory in both the host-data and fallback cases.
- **Residual inconsistency:** `product/plugin/README.md:21` says "No files are created in the target project." That is true for the plugin and launcher path it describes. It does not mention the direct-CLI fallback, but `SKILL.md` covers that, so I'm not counting it as a defect.

### 3. Closed
- `examples.ts:68` now splits on `/\r?\n/u` and rejoins with `\n`. LF hashes are unchanged, so no re-approval is needed.
- `test/examples.test.ts:98-101` checks two things:
  - The hash is identical for CRLF and LF text.
  - The hash differs when the content changes substantively.
- `test/recommended-preset.test.ts:103-113` runs every shipped convention through `evaluateApproval` with CRLF-converted decision documents and expects `writable: true`.
- Because that last test passes all conventions, it covers both the TypeScript and Python proofs.

### 4. Code closed; regression test not found
- **Fix:** `cli.ts:236-243` resolves each configured executable without running it. On failure it sets `formatter = { ok: false, detail }`. `formatConfigured` at `cli.ts:246` includes `formatter.ok`.
- **Test gap:** the regression test you describe is not in the repository.
  - The only `formatConfigured` assertions are the default `true` cases at `test/cli.test.ts:276` and `test/public-artifact.test.ts:117`.
  - The missing-formatter case at `test/cli.test.ts:209-214` only checks that `format` fails with "executable not found". It never calls `doctor`.
- **Minimum addition:** after `test/cli.test.ts:209`, add `invoke(root, ["doctor","--json"])` and assert `checks.formatter.ok === false` and `formatConfigured === false`. This is a test gap, not a spec defect. Treat it as open only if you require test-backed closure.

### Newly introduced defects
None found in the changed paths I read.
- `formatter-process.ts:4` now has a single merged `node:path` import, which resolves the earlier duplicate-import note.
- `cli.ts:239` resolves with `configured.command`, the same path `format` uses, so the doctor and format checks agree.

Native Windows event delivery stays unverified, as you stated.

I did not write a plan file because the task is a read-only report.