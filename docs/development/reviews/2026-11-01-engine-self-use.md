# Engine self-use review — 2026-11-01

**Status: verified for candidate `da1e93b36a6ca63a`; final Opus fix-only review returned PASS (`claude-opus-5-5`).** Candidate `7af5b42b29c34e48` remains historical: its 677-test check passed, then the first Opus audit returned FINDINGS. Candidate v2 closes all three code findings and the evidence gate. Its full check, mechanical audit, artifact smoke, and fixed-model review passed. The separate global public-source status remains **STALE, not PASS** (its latest result is a one-file check). The native host matrix was not run.

## Capture boundary and provenance

The first raw engine capture used the supplied 49-path baseline manifest, including the `.mjs` development helper. The raw TypeScript aligner returned exit 0 for 39 paths and exit 1 for 10. The `product/engine/python/string-ranges.ts` helper adds a fiftieth current source path. These numbers describe the initial discovery snapshot only. The original baseline was 49 files / 590 groups / 31 misaligned / 126 edits. A later pre-mechanical capture was 50 / 592 / 30 / 122. Candidate v1 and v2 each report 50 / 592 / 0 / 0; v2 is current and independently hash-checked against all 75 frozen manifest paths.

Public language support remains TypeScript, Python, JSON and YAML. The raw development line-engine wrappers are TypeScript and Python. JSON/YAML structured adapter support does not imply an A12 lexical implementation, and unsupported row forms or zero detected groups are not evidence of `PASS`. `syntax.status: valid` means syntax acceptance only. A group-level `PASS` covers only rows and axes actually emitted by the detector; it does not prove exhaustive coverage or minimum width for every syntax boundary.

### Requested and actual models

| Stage | Requested model/effort | Actual model evidence |
| --- | --- | --- |
| Collection | `gpt-6-luna` | Codex runtime model metadata was not surfaced. |
| Investigation | `gpt-6.1-terra` | Codex runtime model metadata was not surfaced. |
| Design and implementation | `gpt-6.1-sol` | Codex runtime model metadata was not surfaced. The author ledger attributes tab and Python implementation to Sol, and A12 investigation to Terra; no actual Codex model is inferred. |
| Independent cross-provider review | Claude Sonnet 5.5 | Raw review metadata reports `claude-sonnet-5-5`. The Common/Python review returned FINDINGS; the separate bounded TypeScript review returned PASS. Neither ran tests. |
| First final audit | Claude Opus (`opus`) | Actual model `claude-opus-5-5`; FINDINGS; read-only/no tests or CLI. Verbatim result and sanitized metadata are in evidence. |
| Follow-up fix-only audit | Claude Opus (`opus`) fixed/no fallback | Actual `claude-opus-5-5`; PASS; read-only, no tests or CLI executed. |

The first Opus result is preserved verbatim with non-sensitive actual-model metadata in [review evidence](2026-11-01-engine-self-use-evidence/). Candidate v2 adds a portable 75-path manifest, 50-path hash/result ledger, full-check receipt summary, artifact/build linkage, and installed-smoke result. Raw per-command transcripts remain in private scratch storage; evidence hashes and exact commands are recorded for reproduction.

## Findings and reproductions

### 022 — Tab-bearing cells use the wrong start column

**Observation.** Before the correction, the shared line engine measured each tab-bearing slot from display column zero. Tab stops depend on the slot's actual start column, so the output could retain excess or inconsistent separator columns. The bounded reproducer is the Python-shaped source:

```python
source = "a: X\t| Y = 1\nbb: Z | Y = 2\nccc: X | Y = 3"
```

Expand tabs at the configured stops and compare separator columns; the recorded expected columns are `:` at 4 and `=` at 12. The current regression adds first/middle/last-slot, mixed-indentation, quoted-tab, optional-default prefix, terminal punctuation, and trailing-comment cases in `test/engine.test.ts`.

**Checkout command and author result.**

```bash
bun test --timeout 60000 test/engine.test.ts test/python-align.test.ts test/python-assignment-envelope.test.ts test/preservation.test.ts test/structured-align.test.ts
```

The author report records 79 passed, 0 failed, 478 assertions. It also records a bounded width-allocation refinement and additional tab-focused runs; these are author evidence, not a frozen-candidate or independent approval. Claude's Common/Python review examined tab-width math and found no concrete defect, while its overall verdict remained FINDINGS for other scope items.

**Limits.** This finding concerns tab-stop-aware width measurement. It does not change display-width policy, Unicode behavior, grouping, minimum-row rules, approvals, or public support. Candidate v2 retains the zero-misalignment result; the first Opus audit found this tab-width logic sound. The fix-only follow-up review returned PASS for the bounded findings; see current evidence below.

### 023 — TypeScript insert axes preserve over-padding

**Observation.** A deliberately over-padded `if` header remained at closing-parenthesis column 18 although the longest condition required column 15; the raw checker reported PASS with zero edits. A representative form is:

```typescript
if (a         ) { one(); }
if (bbbbbbb   ) { two(); }
if (ccc       ) { three(); }
```

Inspection found the same `from`-boundary selection in method-signature parentheses and case-clause colons. The bounded repair now makes whitespace before the token available only when it is horizontal whitespace, with comments, optional names, trailing commas and empty-paren behavior excluded or preserved. Regression coverage is in `test/typescript-b-layout.test.ts`.

**Checkout command and author result.**

```bash
bun test --timeout 60000 test/typescript-registration-comma.test.ts test/typescript-write-safety.test.ts test/b-layout-public.test.ts test/typescript-align.test.ts test/typescript-b-layout.test.ts test/typescript-matrix-boundaries.test.ts
```

The author report records 74 passed, 0 failed, 384 assertions, six suites. The independent TypeScript Sonnet review returned PASS for the supplied `grid-kinds.ts` diff, but ran no tests and did not inspect the full aligner, layout policy, or writer. Its limited scope and metadata are preserved in evidence. Candidate v2 full-check/self-use passed; the fix-only Opus follow-up returned PASS.

**Limits.** The observed defect is limited to the inspected `if-close-paren`, method-signature, and case-clause boundaries. It does not establish that all insert axes are defective or that all TypeScript syntax is covered. No preset approval identity changed.

### 024 — PEP 701 nested f-string contents enter an approved alignment candidate

**Observation.** On Python 3.14.2, the following valid PEP 701 shape made inner literal lines look like assignment rows:

```python
text = f"""{ """
a = 1
longer = 2
third = 3
""" }"""
```

The real public dry-run reported `ok=true`, `fixedPoint=true`, `parserChecked=true`, and `approvals=["py-simple-assignments"]`, while proposing whitespace edits inside the f-string. It reported `written=false`; no destructive disk write is claimed. Parser-owned formatted-string ranges are now derived from the original source, mapped to UTF-16 offsets while retaining physical line separators, and an independent AST-structure guard protects changed Python write candidates. Ordinary source without a possible formatted-string prefix stays on the fast path. No approved-rule expansion occurred.

**Checkout command and author result.** Use an isolated project/file with the source above, then run the public entry point; the same boundary is exercised by the public-path regressions:

```bash
bun product/packages/cli/entry.ts align --file <isolated-python-file> --dry-run --json
bun test --timeout 60000 test/engine.test.ts test/preservation.test.ts test/python-align.test.ts test/python-assignment-envelope.test.ts test/alignment-only.test.ts test/line-write-safety.test.ts test/format-pipeline.test.ts test/parse-check.test.ts test/parser-fault.test.ts
```

The author report records 153 passed, 0 failed, 712 assertions, nine suites, plus scoped typecheck and parser-fault checks. These passed results predate the follow-up counterexamples below and do not close them.

**Independent review and follow-up compatibility cases.** Claude Sonnet 5.5 returned FINDINGS and ran no tests. Subsequent read-only reproductions confirmed additional cases against the reviewed implementation snapshot:

```bash
bun product/packages/cli/entry.ts align --file <isolated-python-file> --dry-run --json
bun product/engine/python/06_align-tables.ts --file <isolated-invalid-python-file> --write --json
```

The second command is only for a disposable reproduction copy; it must never target a working source file. These commands describe the reviewed pre-correction behavior. The current regression suites below exercise the author-reported corrections.

- On Python 3.14.2, `PAT = "\d+"` with a three-row table is valid but `SyntaxWarning` on stderr causes the independent AST helper to fail; the public dry-run returns `ALIGN_NOT_ELIGIBLE`. A formatted-string prefix can fail earlier in range extraction. `PYTHONWARNINGS=error` changes the warning into a syntax error. The subprocess must handle known warnings without accepting arbitrary stderr.
- For pre-existing invalid input `a=1\nlonger=2\nthird=3\nif:\n`, refusing a write is correct, but the reviewed raw `--write --json` path exited 1 with traceback and no JSON where the baseline emitted schema-v1 JSON and exited 0. The public dry-run baseline/current both returned the same `ALIGN_NOT_ELIGIBLE`. The raw error shape needs a bounded correction without accepting invalid syntax.
- On Python 3.9.6, uppercase fallback prefixes `F`, `RF`, `FR`, `rF`, and `Fr` yielded no protected range. This confirms a range-coverage gap on the older STRING-token path; the reproduction did not show runtime corruption from uppercase alone.
- A controlled fake Python child printing `BOXBOX_AST_EQUAL\r\n` failed the strict LF protocol marker. This is a simulated CRLF-output case, not a native Windows run. Only the known LF and CRLF marker forms should be admitted.
- BOM rejection is attributed to the pre-existing public syntax check, not solely to this change. Lone-CR line accounting was not tested.

These follow-ups are recorded under issue 024. The follow-up author report says both Python child scripts suppress `SyntaxWarning` and `DeprecationWarning` while still rejecting arbitrary stderr and subprocess failures; invalid syntax returns the bounded changed/refused JSON result without writing; the older STRING-token fallback lowercases prefixes; and the child protocol accepts only exact LF or CRLF markers. It reports Python 3.9.6 regression execution. These are author-reported corrections, not independent closure. The fix-only Claude Sonnet review identified a write-path invalid-source response gap; the first Opus review found a separate raw no-write/check-mode JSON gap. Candidate v2 updates `align-cli.ts` to return a controlled result for classified invalid source without guessed ranges, including plain-string false-prefix matches; focused tests and Opus fix-only review passed. BOM remains a pre-existing unsupported admission case; lone-CR line accounting remains untested.

### 025 — A12 treats inline-comment punctuation as code padding

**Observation.** On `const a = 1; // note ;`, the pre-fix `straySemicolonPadding` returned 1 and the report emitted A12, even though the final semicolon and preceding space belonged to the inline comment. The fix added source-aware token/preservation checks. The bounded regression path is:

```bash
bun test test/report.test.ts test/strip-stray-padding.test.ts test/hook.test.ts
```

The author report records 39 passed, 0 failed, 116 expectations. It also reports a narrowly measured candidate-scan cost: about 122 ms for 100 TypeScript candidates across 1,000 lines, and about 111 ms for one Python sample with an f-string after batching. Those are local samples, not large-file performance bounds.

**Independent review follow-ups.** The Common/Python Sonnet review returned FINDINGS, not PASS. Follow-up reproductions found that valid YAML `value: test ;` can report A12 with advice that changes the decoded value (`test ;` to `test;`); a literal block has the same issue. The checked JSON sample was clean. At the time of the Sonnet review, the A12 language gate and lexical choices needed re-verification; candidate v2's bounded corrections and review closure are recorded below. JSON/YAML structured-adapter support does not authorize A12 there. The performance result likewise remains a bounded measurement, not a general guarantee. No lasting source write from the inline-comment example was demonstrated; the writer's preservation gate restores comment mutations.

The follow-up author report says A12 is now limited to TypeScript/Python and includes YAML/JSON regression cases. Its measured 5,000-line/500-candidate sample reports 3,338 ms before and 10.5 ms after for report generation, plus 7.4 ms cleanup. This is a single local run, not a CI assertion or general performance bound. A public YAML repro uses `bun product/packages/cli/entry.ts check --file <isolated-yaml-file> --json` on a disposable project/file.

**Limits.** Keep the false alarm, cross-language YAML case, and candidate-scan cost within this A12 issue record while retaining their distinct history. The follow-up author report says A12 is restricted to TypeScript/Python, includes YAML/JSON regressions, and batches candidate classification. Its single-run 5,000-line/500-candidate sample reports 3,338 ms before and 10.5 ms after for report generation, with 7.4 ms cleanup. These are local observations, not CI thresholds or general performance guarantees. Preserve the bare-code A12 case and report schema. Candidate v1’s Opus review found that broad Python A12 helper errors were hidden. Candidate v2 changes this handling so only classified invalid-source syntax is suppressed and unavailable/malformed helper failures surface; focused report tests and Opus fix-only review passed.

## Current evidence state

- Candidate v2 is `da1e93b36a6ca63a`, parent `7af5b42b29c34e48`. The portable 75-path source manifest recomputes to the recorded candidate SHA. All 75 candidate inputs match the final-check receipt with zero drift. The only shipped source delta from v1 is `common/align-cli.ts` and `common/report.ts`; mutation classification is test-only.
- The 50-file mechanical audit reports 592 emitted groups, 0 misaligned, 0 edits/refusals/suggestions, and 0 import changes/errors. All per-file hashes match candidate-manifest, audit-before, audit-after, and current source. 49 supported TypeScript public Checks had valid syntax and exit 0. The `.mjs` helper is `UNSUPPORTED_LANGUAGE` on public Check (not a public PASS) and passed `node --check` separately.
- `BOXBOX_REQUIRE_PARSERS=1 bun run check` completed with exit 0: 679 passed, 0 failed, 4,159 expectations, 75 files, 305.68 seconds test time / 306.512 seconds total; TypeScript no-emit and shell syntax gates passed. Exact argv, cwd, environment, exit, input drift, log SHA and receipt SHA are in structured evidence.
- Build receipt, candidate manifest and artifact provenance bind the same content identity; build input drift is zero and inputs match. The final tarball and installed smoke summary share SHA-256 `86ba04237ed5082e6c173010f8f4450620d3f354ff4868a5d6c654294fed0880`. All four installed smoke scenarios passed. Actual installed-smoke runtime: Node v22.22.3, Python 3.14.2, npm 10.9.8; Bun absent from child PATH.
- Corrected mutation categories are 505 valid-aligned, 381 invalid-aligned, 114 invalid-rejected (1,000 total, no dropped seeds). The v1 `886 combined aligned` value is historical and did not prove every seed valid; v2 replaces that classification. The original 676/1 failure, transient ENOSPC run, and old reviewer findings remain in history.
- The actual Python 3.9.6 record is [python39-runtime-and-tests.log](2026-11-01-engine-self-use-evidence/python39-runtime-and-tests.log): explicit `/usr/bin/python3 --version`, followed by two conditional tests passed and five expectations. This is separate from installed-smoke Python 3.14.2.
- First Opus review: actual `claude-opus-5-5`, FINDINGS, read-only; full result and non-sensitive metadata are preserved separately. Fix-only Opus review: actual `claude-opus-5-5`, PASS, read-only; it closed the three findings and evidence gate without running tests/CLI. The author logs/receipts remain the source of test and build outcomes.
- Records 022–025 are resolved based on v2 artifact-backed evidence. Global public-source status remains **STALE, not PASS**: the recorded latest status is one target and is not promoted to whole-checkout evidence. Native host matrix was not run. Counts represent detector-emitted groups, not semantic-completeness certification.


## Candidate v1 historical verification (2026-11-01)

This section is historical and superseded by the candidate v2 section below. Candidate v1 passed its full check and sampled artifact smoke, but the first Opus review returned FINDINGS, so these results did not close the task.

This section records candidate v1 `7af5b42b29c34e48` (content identity, not a Git commit), verified against source HEAD `13e9ced56559f14c91766f5e962992a40cd816f9`. The post-check freeze record reports 75 manifest files with zero drift and 50 mechanical audit files with zero drift. Exact v1 per-file hashes and results are in [candidate-v1-self-use-files.json](2026-11-01-engine-self-use-evidence/candidate-v1-self-use-files.json); the historical verification summary is in [candidate-v1-verification-history.json](2026-11-01-engine-self-use-evidence/candidate-v1-verification-history.json).

The final mechanical audit reports 50 files, 592 reported groups, 0 misaligned rows, 0 alignment edits, and 0 import-layout changes/errors. The public source CLI reported 49 supported TypeScript files passing and one development `.mjs` helper unsupported by that language admission path; `node --check product/engine/typescript/05_inspect-hover.mjs` passed separately. The unsupported result is not a public Check PASS, and zero detected groups or unsupported syntax are not coverage proof. The separate public-source status file is **STALE** after a later test edit; its historical one-target run `fcdc05a9-ffaf-46af-aa86-7906097d6fd3` checked one file and passed, not the whole checkout.

The final gate was `BOXBOX_REQUIRE_PARSERS=1 bun run check`: exit 0, 677 passed, 0 failed, 4,130 expectations, 75 files, 272.87 seconds; TypeScript no-emit and shell syntax gates passed. The transcript SHA-256 and freeze details are in the summary evidence. Installed-artifact smoke also passed all four scenarios against the final CLI tarball (SHA-256 `023f727732854301d292f5d1371948de2026d202a37ed1a72b3384c1662dd398`), using Node v22.22.3, Python 3.14.2 and npm 10.9.8; the installed package bin was used and Bun was absent from child PATH. See the private complete scenario record where authorized or the sanitized public summary. Native host matrix was not run.

The first full-check attempt failed (676 passed / 1 failed) on mutation-test invalid-source classification. A later v1 full check passed 677 / 0, but the initial test-only oracle still grouped 886 aligned seeds without proving all were valid. Opus identified that gap. V2 now independently parses every seed and reports 505 valid-aligned, 381 invalid-aligned and 114 invalid-rejected. All earlier outcomes remain historical and are not erased.

## Candidate v2 final verification (current)

The v2 candidate ID `da1e93b36a6ca63a` is the first 16 characters of SHA-256 `da1e93b36a6ca63a7c629edd17ca57f6e24617b39a602038e1e9cf4d75b136a8`, computed from the canonical sorted 75-entry source manifest. The manifest and digest procedure are in [candidate-manifest.json](2026-11-01-engine-self-use-evidence/candidate-manifest.json); the per-file alignment, public Check, and before/after/current hashes are in [final-self-use-files.json](2026-11-01-engine-self-use-evidence/final-self-use-files.json).

The complete frozen mechanical count is 50 engine TS/MJS files, 592 emitted groups, 0 misaligned, 0 edits, 0 refused/suggested, 0 import changes/errors. The 49 supported `.ts` files had public Check syntax-valid/exit 0; all were approval-ineligible for writing, and Check facts never authorize writes. The `.mjs` helper is `UNSUPPORTED_LANGUAGE` on public Check (not a public PASS) and passed explicit Node syntax checking. All 50 path hashes match the v2 manifest, mechanical before/after capture and current files.

Final full gate: `BOXBOX_REQUIRE_PARSERS=1 bun run check`, exit 0, 679 pass / 0 fail / 4,159 expectations / 75 test files; tests 305.68s and total 306.512s. `tsc --noEmit` and `bash -n development/install.sh` passed. The structured record includes argv, cwd, explicit `BOXBOX_REQUIRE_PARSERS=1`, process exit, before/after input drift 0, candidate-receipt match, full-check log SHA-256 and receipt SHA-256.

Artifact provenance binds the same candidate content ID and source manifest to `bun run pack:cli`, build exit 0, build-input drift 0 and `sourceInputsMatch: true`. The immutable CLI tarball and installed smoke share SHA-256 `86ba04237ed5082e6c173010f8f4450620d3f354ff4868a5d6c654294fed0880`. All four installed scenarios passed: approved TypeScript declarations, approved Python assignments, PEP 701 literal preservation and unapproved TypeScript refusal. Runtime was Node v22.22.3, Python 3.14.2, npm 10.9.8; Bun was absent from the child PATH.

Focused v2 Opus-finding corrections and actual runtimes are summarized in [the fix report](2026-11-01-engine-self-use-evidence/opus-fix-only-v2.md). Candidate v1 finding histories are preserved. First Opus review text is verbatim at [opus-initial-review.md](2026-11-01-engine-self-use-evidence/opus-initial-review.md); its actual-model metadata is separate. The follow-up Opus fix-only review returned PASS (`claude-opus-5-5`) for all three code findings and the evidence gate; the raw review and bounded metadata are in the evidence directory. The reviewer ran no tests/CLI. The four issue records are resolved with appended v2 evidence and history.

The global public-source status remains **STALE, not PASS**. Its latest status snapshot is a one-target historical check, not a whole-checkout pass. The native host matrix was not run. All counts describe emitted group coverage; they do not establish semantic completeness for every block or syntax form.

### Reproduction commands and limits

From repository root, the frozen full gate is:

```bash
BOXBOX_REQUIRE_PARSERS=1 bun run check
```

The per-file audit used the raw TypeScript development commands below for each supported `.ts` source (with raw stdout/stderr and exit captured separately); the actual public-source check used the package CLI entry. The `.mjs` helper was separately syntax checked with Node.

```bash
bun product/engine/typescript/06_align-tables.ts --file <path> --json
bun product/engine/typescript/00_normalize-imports.ts --layout-only <path>
bun product/packages/cli/entry.ts check --file <path> --json
node --check product/engine/typescript/05_inspect-hover.mjs
```

The installed smoke is a distinct artifact check; it does not substitute for source checks. It exercises the public installed CLI version, approved TS declaration and Python assignment preview/apply/recheck, exact PEP 701 literal preservation through those stages, and refusal of unapproved TypeScript object properties. These results verify the sampled flows, not all syntax or all groups. The full self-use counts are detector-emitted groups, not a semantic completeness certificate. Public rule approvals and minimum-row policies were not expanded.

### Independent review gate

Initial and fix-only Sonnet findings remain in the historical evidence and are not relabeled PASS. First Opus reviewed v1 read-only, returned FINDINGS, and confirmed the other examined source invariants; its three code findings were addressed in v2 and covered by focused author runs/full check. Candidate v2 also closes the artifact linkage and full-check receipt gaps. The follow-up Opus fix-only review returned PASS (`claude-opus-5-5`); metadata and bounded review text are preserved in the evidence directory. Issue records 022–025 are resolved for this bounded scope. The separate global public-source status remains STALE, and the native host matrix was not run.
