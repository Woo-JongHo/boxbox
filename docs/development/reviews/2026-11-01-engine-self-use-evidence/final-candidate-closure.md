**Historical candidate v1 closure record.** Its counts are superseded by candidate v2. See [current v2 verification](final-candidate-verification.json), [portable source manifest](candidate-manifest.json), and [fix-only Opus PASS](opus-fix-only-v2.md).

# Final candidate closure evidence

This public summary records the frozen engine self-use and repository gate for candidate `7af5b42b29c34e48` (source HEAD `13e9ced56559f14c91766f5e962992a40cd816f9`). Detailed sanitized path/hash/result mapping is in [final-self-use-files.json](final-self-use-files.json); structured gate and provenance summary is in [final-candidate-verification.json](final-candidate-verification.json). Full CLI transcripts and intermediate scratch harnesses remain private.

## Final checks

- Command: `BOXBOX_REQUIRE_PARSERS=1 bun run check` — exit 0; 677 pass, 0 fail, 4,130 expectations, 75 files, 272.87 seconds. `bunx tsc --noEmit` and `bash -n development/install.sh` passed as the trailing gates. The candidate freeze manifest has 75 entries and zero drift; the mechanical audit's 50 file hashes also have zero drift.
- Final source audit: 50 TS/MJS engine files, 592 detector-emitted groups, 0 misaligned, 0 edits, 0 refused/suggested groups, 0 import changes/errors. Public source Check: 49 supported TypeScript files pass; the development `.mjs` helper is unsupported by that public language-admission path and separately passes `node --check`.
- Installed CLI tarball SHA-256: `023f727732854301d292f5d1371948de2026d202a37ed1a72b3384c1662dd398`; runtime Node v22.22.3, Python 3.14.2, npm 10.9.8, no Bun on child PATH. All four smoke scenarios passed: approved TypeScript declarations, approved Python assignments, PEP 701 literal preservation, and unapproved TypeScript refusal.

## Historical baseline and failed attempt

Initial 49-file baseline: 590 groups, 31 misaligned, 126 edits. The later pre-mechanical capture was 50 files, 592 groups, 30 misaligned, 122 edits. These are separate time points; the final 50-file capture is 592 / 0 / 0. The first full-check attempt failed (676 pass, 1 fail) on the mutation-test invalid-source oracle. The correction changed only test classification: the parser-required 1,000-seed run counted 886 aligned and 114 independently syntax-confirmed invalid refusals, with no dropped seeds (3 tests passed). The failed attempt and diagnosis remain part of the history and are not replaced with a PASS claim.

## Scope and remaining review gate

The audit counts only detector-emitted groups and is not proof of semantic completeness. Unsupported syntax or zero detected groups is not a PASS. Public approval rules and minimum-row policy were not expanded. The current public source status is stale after a later test edit; historical one-target run `fcdc05a9-ffaf-46af-aa86-7906097d6fd3` checked one file only and cannot be reported as a whole-checkout PASS. Native host matrix was not run.

The initial and follow-up Common/Python Sonnet reviews remain FINDINGS, with correction evidence for all identified points; the bounded TypeScript Sonnet review remains a narrow source-review PASS and ran no tests. The final Opus audit returned FINDINGS; follow-up corrections and a read-only closure review are required. Issue records therefore remain `verifying`.

## Reproduction commands

```bash
BOXBOX_REQUIRE_PARSERS=1 bun run check
bun product/engine/typescript/06_align-tables.ts --file <path> --json
bun product/engine/typescript/00_normalize-imports.ts --layout-only <path>
bun product/packages/cli/entry.ts check --file <path> --json
node --check product/engine/typescript/05_inspect-hover.mjs
BOXBOX_REQUIRE_PARSERS=1 bun test --timeout 60000 test/mutation.test.ts
```

The per-file result ledger states which single development helper was unsupported by public Check. The package CLI command above is the public source entry. Installed-artifact coverage is separately represented by the tarball hash and runtime/scenario summary; it does not execute repository source in place.
