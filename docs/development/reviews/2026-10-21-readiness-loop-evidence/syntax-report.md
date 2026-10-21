# R2 public Check syntax-validation implementation design

Date: 2026-10-21
Status: design only; no repository edits made
Snapshot: current dirty `m1-safety-proof` worktree after R1

## Required behavior

`boxbox check` must parse the selected TypeScript or Python file even when no alignment groups exist. A syntactically invalid file, unavailable parser, timeout, abnormal parser exit, or unclassified parser failure must never return a passing exit code. Syntax validation is a read-only fact and must stay separate from format/write verification.

The existing low-level aligner result remains unchanged. Its `FileResult.parse` describes comparative reparse during writes and says `not-run` in check mode. Overloading that field with input validity would mix two different claims and force changes through every language runner. R2 should add distinct public-check syntax metadata.

## Proposed reusable interface

Add `product/engine/common/syntax-validation.ts`:

```ts
import type { PublicLanguage } from "./project-config.ts";

export type SyntaxValidationStatus = "valid" | "invalid" | "error";

export interface SyntaxValidation {
  readonly status      : SyntaxValidationStatus;
  readonly tool        : string;
  readonly diagnostics : readonly string[];
}

export interface SyntaxValidationInput {
  readonly root     : string;
  readonly file     : string; // project-relative, already path-validated by CLI
  readonly language : PublicLanguage;
}

export async function validateSyntax(input: SyntaxValidationInput): Promise<SyntaxValidation>;
```

Semantics:

- `valid`: parser ran successfully and returned no syntax diagnostics.
- `invalid`: parser ran successfully and returned one or more normalized syntax diagnostics.
- `error`: parser availability/execution/timeout/project-resolution failed. `diagnostics` contains one bounded, stable message; it is never treated as a skip/pass.
- `tool`: `typescript` for the bundled TypeScript parser, `python3` for Python. R3 can add `json`/the chosen YAML parser without changing CLI semantics.
- Diagnostics must be normalized and bounded. TypeScript can retain current `line:code` keys. Python should return `line: error: message`, excluding temporary paths and columns that alignment may shift.

Implementation dispatch should be exhaustive over `PublicLanguage`. When R3 extends that union, TypeScript compilation should force the new JSON/YAML cases to be supplied.

### Parser reuse

TypeScript: call existing `syntacticDiagnostics(root, absolute, text)` from `typescript/load-source-file.ts` with the actual file path and text. Catch project/parser failures and map them to `error`.

Python: reuse the existing `parse-check.ts` subprocess logic, but not `compareParse(source, source)`. That function returns `ok` before diagnostics when the strings are equal. The smallest sound reuse is to expose a single-input helper from `parse-check.ts`, for example:

```ts
export interface SyntaxDiagnostics {
  readonly tool        : string;
  readonly diagnostics : readonly string[];
}

export function syntaxDiagnostics(language: string, source: string, options?: ParseCheckOptions): SyntaxDiagnostics;
```

It should run the existing tool lookup, timeout validation and private `diagnostics()` unconditionally. `compareParse` then calls this helper for left/right, preserving its current write behavior. `syntax-validation.ts` calls it for Python. This avoids a second subprocess/diagnostic implementation.

One deliberate choice is needed while refactoring: current `compareParse` skips all parser work when `before === after`, after tool availability probing. Preserve that optimization for write comparison unless tests require otherwise; the new single-input helper must never skip parsing.

## CLI integration

Owned file: `product/engine/cli.ts`.

1. In `check`, after effective-language admission and before/alongside alignment inspection, call `validateSyntax` for the same validated file.
2. Inspection may still run for `invalid`; returning both syntax facts and detected layout groups is useful, but syntax controls the final exit code. If the TypeScript aligner cannot inspect malformed input reliably, validate first and skip inspection on `invalid/error`, returning a minimal unchanged result only if a canonical helper exists. Prefer validate-first and avoid claiming layout results on malformed input.
3. JSON output remains one object and adds a sibling field:

```json
{
  "schemaVersion": 1,
  "tool": "boxbox",
  "results": [ ...existing FileResult... ],
  "syntax": {
    "status": "valid",
    "tool": "python3",
    "diagnostics": []
  },
  "formatReadiness": { ... }
}
```

This is an additive public-check envelope change; the low-level `ResultEnvelope` and `RESULT_SCHEMA_VERSION` stay unchanged. If the repository treats any additive field as a breaking schema change, bump the public command envelope separately rather than changing the engine result schema.

4. Text output adds exactly one stable line, such as `syntax status=valid tool=python3 diagnostics=0`; invalid/error diagnostics follow on prefixed lines.
5. Exit precedence:
   - syntax `invalid` or `error`: `2` (cannot establish a trustworthy check);
   - otherwise alignment refusal: `2`;
   - otherwise pending misalignment: `1`;
   - otherwise `0`.
6. `formatReadiness.verification` remains `not-run`. Syntax-valid does not prove preservation, approval, fixed point, provenance stability or atomic write safety. Add a readiness reason when syntax is not valid and force `approvalEligible:false` for the displayed readiness, while keeping the exact syntax fact in `syntax`.

Do not change `inspectFile`, low-level `runAlignCli`, `runTypeScriptAlign`, `FileResult.parse`, format/align, hooks, or guarded runs in R2 unless a focused test proves the public Check requirement needs it. This keeps R2 bounded and avoids implying all host/hook inspection now validates syntax.

## Effective approval facts in public Check

`formatReadiness` already evaluates groups through `approvalContext(root)`, which includes project, user and preset sources and verifies examples/decisions/doc hashes. It does not use the report-only `loadConventions` loader. However the output reduces those facts to a Boolean and flattened reasons, so users cannot see which effective rule/layer/status produced the result.

Return a read-only `approvalFacts` list from the existing evaluated results:

```ts
interface CheckApprovalFact {
  readonly key           : string;
  readonly status        : "approved" | "rejected" | "unknown" | "conflict";
  readonly conventionId? : string;
  readonly layer?        : "project" | "user" | "preset";
  readonly proofComplete : boolean; // evaluated writable fact, named as proof rather than write authorization
  readonly reasons       : readonly string[];
}
```

Use `EvaluatedApproval.query.key` and `EvaluatedApproval.result` directly. Deduplicate identical lookup keys while preserving first detected order. `proofComplete` mirrors the approval proof evaluation only; it must not be called `writable` or `writeAuthorized` in public Check because Check has not run parser-preservation/fixed-point/provenance/atomic-write verification. Keep `approvalEligible` provisional and `verification:"not-run"`.

For files with no eligible groups, return `approvalFacts: []` and the existing `no verified approval rule applies` reason. For malformed registry/proof data, return no invented facts and surface the caught error in reasons.

This satisfies the requested unification without touching `product/engine/report.ts` or its report-mode `loadConventions` contract.

## Focused tests

Primary owned tests: add cases to `test/cli.test.ts`. A small dedicated `test/syntax-validation.test.ts` is preferable for parser behavior; if ownership is limited strictly to CLI tests, cover the public behavior there and rely on existing parse-check tests for subprocess details.

Required CLI cases:

1. Valid Python with zero groups: exit `0`, `syntax.status=valid`, `tool=python3`, empty diagnostics, original bytes unchanged.
2. Invalid Python with zero groups (the DOC1 reproduction): exit `2`, `syntax.status=invalid`, nonempty diagnostics, original bytes unchanged, `formatReadiness.approvalEligible=false`, `verification=not-run`.
3. Valid TypeScript with zero groups: exit `0`, `syntax.status=valid`, original bytes unchanged.
4. Invalid TypeScript with zero usable groups: exit `2`, `syntax.status=invalid`, stable `line:code`, original bytes unchanged.
5. Python unavailable: invoke with a PATH that still permits the Node/Bun test process but excludes `python3`, or inject a narrow parser runner if current test helpers allow it. Exit `2`, `syntax.status=error`; never `skipped` or `valid`.
6. Misaligned but syntactically valid Python: retain exit `1`; syntax is `valid` and alignment summary stays intact.
7. Effective approval facts:
   - bundled preset yields the preset convention ID/layer for the existing Python group;
   - a valid project override wins and is displayed as project;
   - candidate/rejected/conflict/stale proof displays the effective status/reasons and never claims proof completeness;
   - no group returns an empty fact list.
8. Plain-text Check includes one syntax line and remains read-only.

Low-level reuse tests in `test/parse-check.test.ts` if that file is in scope:

- single-input helper parses valid Python and reports invalid Python;
- identical invalid input is still parsed by the new helper;
- timeout/unavailable/abnormal exit throws and maps to public `error`;
- existing comparative parse tests remain unchanged.

Avoid mutating global `PATH` inside the same process when tests can run concurrently. Prefer subprocess environment isolation (the current `invoke` helper already supports env overrides).

## Exact files for R2

Expected edits:

- new `product/engine/common/syntax-validation.ts`
- `product/engine/common/parse-check.ts` only to expose/reuse unconditional single-input diagnostics
- `product/engine/cli.ts`
- `test/cli.test.ts`
- `test/parse-check.test.ts` and optionally new `test/syntax-validation.test.ts`

Expected non-edits in this slice:

- `product/engine/common/result-json.ts`
- low-level aligners and language profiles
- format pipeline and write safety
- report-mode convention loader/report CLI
- JSON/YAML adapters, policy/catalog, presets and docs

## Verification commands

```bash
bun test test/parse-check.test.ts test/cli.test.ts
bunx tsc --noEmit
bun run check
```

Before editing, re-run `pwd` and `git status --short --branch` and snapshot the owned files because the worktree is shared and `cli.ts` already contains R1/user changes. After editing, search changed files for `TODO`, `test.skip`, `.only`, placeholder branches, and confirm the diff contains only the owned behavior.

## Implementation record

Implemented on the shared `m1-safety-proof` worktree after authorization. The pre-edit snapshot is `/tmp/boxbox-readiness/r2-before-1792592842` with recorded SHA-1 hashes for the four pre-existing owned files.

Owned changes:

- Added `product/engine/common/syntax-validation.ts` with a public-language validator returning `valid`, `invalid`, or `error`; it uses the real TypeScript project parser, Python `ast.parse`, strict `JSON.parse`, and the pinned YAML 1.2 parser.
- Added `syntaxDiagnostics()` to `product/engine/common/parse-check.ts`. It always invokes the parser for a single input. Existing `compareParse()` and low-level `FileResult.parse` semantics remain unchanged.
- Updated `product/engine/cli.ts` to infer/admit `.json`, `.yaml`, and `.yml`, inspect structured adapters, validate syntax before public Check classification, emit separate `syntax` metadata, return exit 2 on invalid/parser-error input, and make guarded/hook `inspectFile` return a syntax `REFUSE` instead of silently passing.
- Public Check now exposes deduplicated `formatReadiness.approvalFacts` from the effective project → user → preset approval registry. It reports convention ID, layer, evaluated status, proof completeness and reasons while retaining `verification: "not-run"`.
- Added focused CLI tests for no-group valid/invalid TypeScript and Python, missing and failed Python parsers, byte-identical read-only behavior, preset/project/candidate/rejected/conflict/stale approval facts, and strict JSON/YAML admission without inherited approvals.

Verification evidence:

```text
bun test test/structured-align.test.ts test/parse-check.test.ts test/cli.test.ts
35 pass / 1 existing Rust parser skip / 0 fail / 237 assertions

bunx tsc --noEmit
exit 0

git diff --check -- <five owned files>
exit 0
```

The focused two-suite run after the final approval-fact assertions was `27 pass / 1 existing Rust parser skip / 0 fail / 194 assertions`. The new single-input Python test is mandatory rather than skipped; the remaining skip belongs to the pre-existing multi-language comparative parser matrix.

The local BoxBox PostToolUse hook repeatedly reported FAIL or source-changed during concurrent shared-worktree edits. Its receipt listed unrelated active files and transient staging paths; it did not identify a focused test failure. Direct focused tests, type checking and diff checks above are the implementation evidence. No full suite, artifact builder, host trust change, approved preset change or publication action was run.

## Independent review closure

- Initial Sonnet 5.5 static review: `FIX_REQUIRED`, with missing guarded-run/hook invalid-syntax regressions and incomplete structured/mismatch/parser-error coverage. Full result: `docs/development/reviews/2026-10-21-readiness-loop-evidence/syntax-sonnet-review.md`.
- Follow-up after fixes: `PASS`, no mandatory findings. Full result: `docs/development/reviews/2026-10-21-readiness-loop-evidence/syntax-sonnet-recheck.md`.
- A separate adapter review then identified invalid UTF-8 replacement risk. R2 added raw Buffer UTF-8 roundtrip rejection, exact JSON/YAML byte-preservation tests, and plain-text unsupported diagnostics. Focused final verification: `32 pass / 1 existing Rust parser skip / 0 fail / 227 assertions`; TypeScript and diff checks passed.
- Final Sonnet 5.5 static recheck: `PASS`, no mandatory findings. Full result: `docs/development/reviews/2026-10-21-readiness-loop-evidence/syntax-sonnet-utf8-recheck.md`.
