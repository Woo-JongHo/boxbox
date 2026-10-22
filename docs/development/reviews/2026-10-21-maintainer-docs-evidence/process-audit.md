# BoxBox inspection-process audit

Date: 2026-10-21. Repository: `/Users/jonghoPro/woo/00_project/98_BoxBox`. Read-only source audit against baseline `07f568ccec77e70dd57da9aba63f8dc7ef7fcc5a`. No repository edits or toolchain installations. One isolated runtime probe was executed, repeated once to capture a durable script/log, and cleaned up; test-suite coverage below describes source, not a new full-suite execution.

## Outcome

The engine already has substantial shared structure: nine line-engine profiles use one masking/grouping/alignment engine, all ten aligners emit the same result-envelope shape, and the public TypeScript/Python format operation uses one approval/verification/atomic-write pipeline. The public product does not expose all ten languages: `check`, `guide`, `format`, configuration and the private packaged runner accept TypeScript and Python only. The other eight languages are development runners. Documentation must separate these capability levels.

The most important semantic gap is that `check` means alignment inspection, not syntax validation or a dry run of `format`. A valid-looking check result cannot establish syntactic correctness, approval eligibility, formatter stability or safe write readiness. The design document currently describes a stronger check contract than the implementation.

## Actual public command ordering

Source: `product/engine/cli.ts:118`, `:165`, `:198`, `:299`, `:315`, `:330`, `:351`.

1. Parse exactly one explicit file and supported language; ensure extension/language agreement and containment in the project.
2. Resolve layered configuration and ensure the language is enabled.
3. For `check`: inspect through the Python line engine or TypeScript AST aligner; evaluate approval eligibility separately; emit group result plus `formatReadiness.verification="not-run"`; return 2 for refused groups, otherwise 1 for misalignment, otherwise 0. It does not execute the formatter, parser diagnostics comparison or fixed-point pipeline. Python temporarily changes process cwd and restores it; TypeScript receives an explicit root.
4. For `guide`: inspect, select PASS/FIXABLE groups, evaluate exact approval proofs, deduplicate verified guide examples and convention IDs, emit guidance; no write or syntax validation. Exit 1 when no guide applies.
5. For `format`: resolve formatter and approval context, reject empty approval registry, run the shared pipeline with a config/approval provenance fingerprint; report verified result or FORMAT_NOT_ELIGIBLE.

`format --dry-run` runs the same verification as format but restores the working copy before the atomic helper reaches its final replacement decision, leaving original bytes unchanged.

## Actual public format pipeline

Source: `product/engine/common/format-pipeline.ts:58-177` and `product/engine/common/safe-file.ts`.

- Validate physical root/target containment, formatter argument contract and timeout.
- Capture configuration/approval provenance; stage an original-preserving working copy using the atomic helper.
- Cycle 1: optionally run the configured formatter, validate timeout/exit and executable fingerprint; require zero syntactic diagnostics on formatter output (or original input in standalone mode); inspect groups; reject any REFUSE and require verified approvals for PASS/FIXABLE candidate groups; align the working copy through the underlying engine.
- The underlying write path verifies token/content preservation and parser diagnostic equivalence before committing its changes to the outer working copy.
- Save first-cycle bytes; run the entire formatter/approval/engine cycle again; require exact byte equality.
- Recheck provenance, and recheck it again immediately before commit; the atomic helper checks original identity/content and performs one final original replacement.
- In dry-run, restore initial working bytes after verification, so the original remains unchanged.

A full-project compiler/type check is not part of this pipeline. Parser availability and parse equivalence are narrower guarantees. The syntax-zero requirement at the public format entry is stronger than the low-level aligner rule of preserving preexisting diagnostics.

## Engine ordering

### TypeScript

Sources: `product/engine/typescript/load-source-file.ts:25`, `product/engine/typescript/align.ts:178`, `:248`, `:289`, `product/engine/typescript/grid-kinds.ts:629`.

- Load a TypeScript 7 AST through a fresh async server, closing it after extraction.
- Traverse AST containers with ordered row-kind detectors; build compatible contiguous row groups and minimum-width edits; detect compressed interface members as advisory structural work.
- Reject groups failing scanner-based preservation (a distinct token-preserving-with-line-breaks variant supports vertical forms).
- Read-only check emits groups, suggestions/refusals and parse `not-run`.
- Write stages a temporary file, checks combined edits for overlap and token preservation, compares before/after syntactic diagnostics from fresh servers, repeats until stable with a five-pass bound, then commits atomically.
- Compressed interface members cause early suggestion/nonzero result rather than automatic structural expansion.
- TypeScript initializer declarations can have a two-row minimum. This is an intentional kind policy (`grid-kinds.ts:636`), not the line engine's universal floor.

### Nine line-engine languages

Sources: `product/engine/common/table-engine.ts:124`, `product/engine/common/align-cli.ts:42`.

- Mask strings/comments; split lines preserving CRLF.
- Profile each eligible line into verbatim slots and require exact lossless reconstruction, with whitespace-only gaps.
- Group only contiguous rows sharing indentation and slot signature; boundaries break groups.
- Report groups below the enforced minimum of three rows as suggestions; compute minimum widths within each remaining group; preserve trailing comments and line endings.
- Reject an entire table if reconstructed edits alter non-whitespace token content.
- Read-only mode emits results without running a parser.
- Write mode stages a safe copy, aligns, compares original/output parser diagnostics only when there are edits, writes staged output only if diagnostics match, then atomically replaces the original.
- The low-level line writer itself does not run a second alignment cycle at runtime; shared fixture tests cover engine idempotence. Public Python format adds the complete two-cycle runtime fixed-point proof.

## Language capability and parser matrix

All paths below are under `product/engine/`; all low-level nine line profiles have `01_group-regions.ts` and `06_align-tables.ts` wrappers.

| Language | Detection | Public check/guide/format | Write parser/tool | Parse scope |
|---|---|---|---|---|
| TypeScript | TypeScript 7 AST + kind registry | Yes | TypeScript 7 async program syntactic diagnostics | Project/file-aware syntactic diagnostics, not semantic type check |
| Python | Shared line engine + profile | Yes | `python3 -c` with `ast.parse` | Isolated source syntax |
| JavaScript | Shared line engine + profile | No; development runner | `node --check` | Isolated `.js` input, runtime module assumptions |
| Java | Shared line engine + profile | No; development runner | `javac -proc:none -Xlint:none -d` | Standalone `Input.java`; compiler diagnostics can include unresolved context |
| Go | Shared line engine + profile | No; development runner | `gofmt -e -l` | Parse only; alignment is not thereby gofmt-stable |
| Rust | Shared line engine + profile | No; development runner | `rustfmt --edition 2021 --emit stdout` | Edition 2021 parser; only stderr used as diagnostics |
| C | Shared line engine + profile | No; development runner | `clang -fsyntax-only -w` | Standalone temporary source without project build flags |
| C++ | Shared line engine + profile | No; development runner | `clang++ -std=c++20 -fsyntax-only -w` | Standalone C++20 without project build flags |
| Swift | Shared line engine + profile | No; development runner | `swiftc -parse` | Standalone source parse |
| Kotlin | Shared line engine + profile | No; development runner | `kotlinc ... -d` | Standalone compiler diagnostics |

Source of line parser commands: `product/engine/common/parse-check.ts:41-51`. Public restrictions: `product/engine/common/project-config.ts:7`, `product/engine/cli.ts:111-148`, `product/engine/internal-runner.ts:7-20`.

The parser gate compares normalized before/after diagnostic sets and counts, dropping unstable file paths and column numbers. Existing equal errors can be preserved by the low-level writer. Missing parser, timeout, signal, unknown/nonrecognized failure status fail closed. `compareParse` short-circuits equal input after checking executable availability; an `ok` there is not proof of zero errors. The 5-second `--version` availability probe does not establish a successful parse and produces a generic unavailable error on several distinct failure types. These distinctions belong in the docs and status fields.

## Runtime reproduction: check does not validate syntax

Executed the exported `runCli` against a temporary root outside the repository containing `invalid.py` with exactly `def broken(:\n`, then removed the root. Observed:

```json
{"schemaVersion":1,"tool":"boxbox","results":[{"file":"invalid.py","language":"python","mode":"check","summary":{"groups":0,"misaligned":0,"edits":0,"refused":0,"suggested":0},"groups":[],"parse":{"status":"not-run","tool":""}}],"formatReadiness":{"mode":"standalone","approvalEligible":false,"verification":"not-run","reasons":["no verified approval rule applies to this file"],"next":"format --dry-run verifies parser, preservation and fixed point before writing"}}
```

Reproduction command: `bun /tmp/boxbox-process-syntax-probe-20261021.ts`. Full script: `/tmp/boxbox-process-syntax-probe-20261021.ts`; combined output: `/tmp/boxbox-process-syntax-probe-20261021.log`. Both invocations returned the same result.

Exit: 0. This is current declared check behavior, not evidence that syntax is valid. A syntax-check request needs an explicit syntax stage or documented dedicated command, including files with zero detected tables.

## Existing test evidence and coverage boundaries

Source inspected, not newly rerun:

- `test/lang-harness.ts`: all nine profiles call one seven-property suite: preservation, parser diagnostic equivalence, idempotence, golden output, aligned stability, traps, minimum-row behavior. Local missing tools mark parser tests skipped; CI `BOXBOX_REQUIRE_PARSERS=1` makes absence fail.
- `test/typescript-align.test.ts`: separate AST-kind/row-floor/token-preservation tests. TypeScript is not in the shared line-engine harness.
- `test/result-json.test.ts`: common envelope checks cover TypeScript plus seven line languages. **Swift and Kotlin are absent from `LINE_ENGINE`**, despite having alignment tests.
- `test/parser-fault.test.ts`: unavailable/failing/timed-out parser scenarios and byte preservation; rustfmt stdout cannot disguise unexplained failure.
- `test/line-write-safety.test.ts` and `test/typescript-write-safety.test.ts`: staged/atomic writes, links, external edits, cleanup and refusal paths.
- `test/format-pipeline.test.ts`: real public TS/Python pipelines, standalone and formatter paths, dry-run, approvals, parser/formatter failure, two-cycle fixed point, provenance and external edits.
- `test/cli.test.ts`: public supported-language limits, clean-project first use, approval proof, doctor/readiness separation, path guards.
- `.github/workflows/verify.yml`: Ubuntu/macOS parser installation and required-parsers mode. Version availability diagnostics are not detailed enough to isolate the previously observed Kotlin probe failure by themselves.

## Concrete standardization recommendation

Preserve the two detection backends. Uniformity should mean a single externally meaningful process and result semantics, not forcing the AST engine into line regexes or making every language share a parser implementation.

1. Write one current implementation contract with stable stage names: target/config -> syntax inspection -> detection/grouping -> approval lookup -> proposal -> preservation -> parser comparison -> fixed point -> commit/report. Mark each command's executed, not-run, refused and unavailable stages explicitly. This is a proposed unified contract; current check does not execute syntax inspection and current low-level paths differ as recorded above.
2. Define per-language capability rows: public/development availability, syntax tool/options, detection backend, minimum-row policy, context support, formatter coexistence and fixtures. Keep TS two-row initializer policy and Python three-row policy explicit rather than flattening approval semantics.
3. When implementing, first extract the already duplicated TS/Python dispatch in `cli.ts` and `format-pipeline.ts` behind a small shared inspection adapter returning typed `FileResult`; do not build a broad provider framework or extend public languages just to fill the table. Avoid global cwd mutation by making root/path explicit.
4. Add actual syntax inspection as a separately observable operation before claiming check validates grammar. Distinguish valid/invalid/unavailable/not-run from the existing write-stage changed/unchanged diagnostic comparison. Check syntax even if no table is detected. Preserve the public result compatibility strategy explicitly when changing schema/exit behavior.
5. Extend the common JSON contract test to Swift/Kotlin; add a shared behavior suite for implemented adapters covering invalid syntax, no-table input, missing/faulting parsers, stable result shape, refusal, no write in inspection, idempotence and unchanged original on failed write. Execute only toolchain-backed claims when the tool is installed or CI requires it.
6. Centralize language/parser capability metadata only after the consumers and fields are concrete; first use it for the capability matrix and test enumeration. Leave specialized AST detection and line profiles in their current modules.
7. Document that parser equivalence is not project compilation, approval eligibility is not completed format verification, and low-level development writers are not the public approved format route.

## Documentation drift to resolve

- `docs/development/design.md` is explicitly Draft and contains target behavior mixed with old implementation notes. Its fixed-order Parse->Mask contract is not what read-only line checking currently runs; its section 3.5 description of check computing formatter+BoxBox fixed point is not public check behavior.
- Design wording about a universal three-row automatic floor conflicts with the approved TS initializer declaration two-row exception.
- Design says reparse was not implemented at its historical section 10 reference even though current write gates do implement it.
- Result schema includes `skipped` but current production compareParse fails closed rather than emitting skip. Explain legacy/type allowance versus live behavior; do not silently label missing verification passed.

Suggested maintainable docs: a short architecture index, current inspection contract, language capability matrix, storage/approval contract, and extension checklist. Each should use the same headings: purpose, inputs/outputs, stage ordering, invariants, failure states, source owners, verification commands and measured limitations. Design proposals should be separate and dated so they cannot be mistaken for current implementation.

## Parent verification update

The parent agent reported a separate targeted run: 59 pass, 1 skip, 0 fail across seven files; the real Rust parser case was skipped. This audit did not independently run or inspect that log and does not convert the skipped check into a pass. No repository implementation files were modified by this audit.
