# Inspection process

## Purpose and scope

This document describes the current inspection and write paths, then proposes a consistent maintenance contract.
The shared contract is stage responsibility and result meaning; parsing and row decomposition remain language-specific.
Source baseline: `07f568c`, inspected 2026-10-21. The [audit](reviews/2026-10-21-maintainer-docs.md) records that
historical execution evidence. Current-state additions below describe the later READINESS1 source and are outside
that earlier audit's coverage.

## Interface

| Existing entry | Supported scope | What it proves | What it does not prove |
| --- | --- | --- | --- |
| `boxbox check --file <file> --json` | Public TypeScript/Python/JSON/YAML | Separate syntax result, alignment results and effective approval facts | Formatter fixed point or authorization to write |
| `boxbox guide --file <file> --json` | Public TypeScript/Python/JSON/YAML | Guidance from applicable approved records after syntax acceptance | That the input passed the write pipeline |
| `boxbox guide --file <file> --authoring --json` | Public TypeScript/Python/JSON/YAML, including missing/empty targets | Scoped approval proof, contract and examples | Write authorization or verification of target contents |
| `boxbox align --file <file> [--dry-run] --json` | Four-language engine; writes only approved exact keys | Approved horizontal whitespace changes, parser and fixed point; preview includes actual line edits | Approval for currently unapproved JSON/YAML rules, structural improvement, behavioral equivalence or performance |
| `boxbox format --file <file> --dry-run --json` | Four-language engine; candidates require exact approval | Full working-copy pipeline and fixed point for that invocation | A target write; it preserves original bytes |
| `boxbox format --file <file> --json` | Four-language engine; candidates require exact approval | Verified pipeline and whether a replacement occurred | Future file/config stability or approval beyond the effective registry |
| `product/engine/<language>/06_align-tables.ts` | Ten development engines | Raw check or engine write safety | Public approval policy; raw writers are excluded from the public CLI artifact |

The dated DOC1 audit reproduced an invalid no-table Python file that passed the old Check path; invalid TypeScript
was not probed. READINESS1 closed that gap by running read-only syntax validation before inspection and returning a
top-level `syntax.status` of `valid`, `invalid` or `error`. `FileResult.parse.status` still remains `not-run` in Check
because it records the separate write-gate comparison. `format --dry-run` is not a general-purpose syntax linter: it
also requires at least one `PASS`/`FIXABLE` group and verified approval for every candidate group.

## Process

### Current read path

Public `check` parses arguments, selects TypeScript, Python, JSON or YAML, validates syntax, resolves configuration,
runs the applicable adapter, then attaches `approvalFacts` from the effective layered registry. It does not run the
external formatter or the write pipeline. Invalid syntax and validator execution errors stop inspection explicitly.
`guide` uses the detected groups and approval records to render guidance. See [cli.ts](../../product/engine/cli.ts).

`guide --authoring` instead enumerates current language/scope keys and evaluates them through the same approval
gate, including higher-layer rejections and conflicts. It resolves the verified decision section and examples,
then rechecks configuration/approval provenance. It does not read or create the target. Its response explicitly
reports `verification: "not-run"` and `writeAuthorized: false`. See
[authoring-guide.ts](../../product/engine/common/authoring-guide.ts).

TypeScript uses AST container/kind information and TypeScript scanner preservation. Code-language profiles use
masking, lossless slot decomposition, adjacent rows with compatible signatures and the shared line engine. JSON and
YAML use a structured-document adapter. These adapters feed the same result lifecycle but retain separate parsing,
candidate extraction and preservation logic. They emit [ResultEnvelope](../../product/engine/common/result-json.ts).

### Current public write path

[runFormatPipeline](../../product/engine/common/format-pipeline.ts) performs the following sequence:

1. Resolve the real root and target; validate formatter settings; snapshot configuration/approval provenance.
2. Enter [updateFileAtomically](../../product/engine/common/safe-file.ts), which creates a working copy and checks target identity.
3. Run the configured formatter on the copy if present; reject timeout, failure or executable drift.
4. Assert syntactic acceptance of the formatter/standalone output.
5. Inspect candidate groups and verify approval proof for every `PASS`/`FIXABLE` group; refuse if any group is
   `REFUSE`, none is a candidate, or any candidate lacks verified approval. `SUGGEST` groups are not approval-evaluated
   and do not themselves block formatting.
6. Run the language writer on the copy, including its preservation and parser-comparison gates.
7. Repeat the entire formatter/parse/approval/alignment cycle; require byte equality with the first output.
8. Recheck provenance. For dry-run, restore initial bytes in the copy. Otherwise replace the original once after identity/conflict checks.
9. Return formatter changes, BoxBox changes, approvals, fixed-point status and whether a write occurred.

The atomic replacement helper does not make all databases transactional. See [storage.md](storage.md).

`align` uses this pipeline with `alignmentOnly: true` and no formatter. The pipeline rejects a supplied formatter
before execution. After the first cycle, [alignment-only.ts](../../product/engine/common/alignment-only.ts) compares
the original and proposed bytes: UTF-8 round-trip, physical line separators, BOM, indentation, trailing whitespace,
non-whitespace content and language-specific token/protected-text preservation. A broader proposal is refused.
Dry-run records changed lines as `{line, before, after}` before restoring the working copy. The second cycle and
atomic replacement checks remain required. Write/Refactor occur in the host agent and use separate syntax/type,
behavior and relevant performance verification; see [the workflow contract](../user/modes.md).

### Language matrix

| Language | Detector | Parser tool used by the engine write gate | Public format |
| --- | --- | --- | --- |
| TypeScript | AST and kind registry | TypeScript syntactic diagnostics | Yes, approved scope |
| Python | Shared line engine + profile | `python3` / `ast.parse` | Yes, approved scope |
| JSON | Strict structured adapter | `JSON.parse` | Engine support; no default approved write rule |
| YAML | Guarded structured adapter, YAML 1.2 core | `yaml@2.9.1` strict parse | Engine support; no default approved write rule |
| JavaScript | Shared line engine + profile | `node --check` | No |
| Java | Shared line engine + profile | `javac -proc:none -Xlint:none` | No |
| Go | Shared line engine + profile | `gofmt -e -l` | No; raw writes require `--enable-go` in the [Go wrapper](../../product/engine/go/06_align-tables.ts) |
| Rust | Shared line engine + profile | `rustfmt --edition 2021 --emit stdout` | No |
| C | Shared line engine + profile | `clang -fsyntax-only` | No |
| C++ | Shared line engine + profile | `clang++ -std=c++20 -fsyntax-only` | No |
| Swift | Shared line engine + profile | `swiftc -parse` | No |
| Kotlin | Shared line engine + profile | `kotlinc` | No |

Exact commands and diagnostic normalization are owned by [parse-check.ts](../../product/engine/common/parse-check.ts).
External-tool comparison runs isolated temporary files, not a full project build with its dependencies. Raw write gates
compare diagnostics before/after; matching pre-existing errors do not mean the input is valid. `compareParse` probes
availability even for identical bytes, then returns early for identical input/output. Public format has the additional
syntactic-acceptance stage above. TypeScript diagnostics are syntactic, not a full semantic type check.

## Data and invariants

The existing shared result has `schemaVersion: 1`, `tool`, `results`, file/language/mode, group states, summary and
parse status. Group states are `PASS`, `FIXABLE`, `SUGGEST`, `REFUSE`; `UNCERTAIN` appears in design intent but is not
an emitted state in this contract. Command-specific public envelopes add their own fields.

`FIXABLE` describes an alignment candidate, not human authorization. The approved TypeScript declaration rule has
a two-row exception; the shared line engine has a three-row floor. Uniform process must preserve these policies.
The grammar prose's three-row default must be read with the explicit approved exception, not generalized silently.

There are three different meanings of grammar validation:

- **Source syntax:** language parser checks, with the limitations above.
- **BoxBox grammar:** role/pattern IDs and surface mappings. [grammar-ids.ts](../../product/engine/common/grammar-ids.ts)
  is checked against [grammar.md](../../product/rules/references/grammar.md) by `test/surface.test.ts`; current base
  mappings cover TypeScript and Python. Role ambiguity is not a full semantic analysis.
- **Stored data shape:** schema and approval validation, documented in [storage.md](storage.md).

## Common lifecycle and adapter boundaries

The implemented common lifecycle is **resolve → validate syntax → inspect through an adapter → evaluate effective
approval policy → verify a write candidate → commit or report**. Check stops before candidate verification and commit.
The format pipeline performs two complete working-copy cycles and commits once after fixed-point and provenance checks.

1. Cover all ten code-language adapters in the common result contract suite. It currently enumerates only seven line-engine
   languages plus TypeScript; Swift/Kotlin have their own aligner tests but are absent from that common list.
2. Keep parser outcomes explicit: passed, syntax rejected, unavailable, execution failure, not run.
   Avoid interpreting the current generic availability error as proof that an executable is missing; its probe also
   has a five-second timeout. A versioned result change needs caller/hook/HUD compatibility tests.
3. Keep language-specific syntax and row policies behind existing adapters. Expand write approval one rule at a
   time only after approval, parser, preservation, fixed-point and installed-artifact coverage is present.

YAML candidates are limited to runs of at least three adjacent, same-parent and same-indent single-line scalar
mappings. Directives, document markers, complex keys, flow collections, sequence entries, anchors, aliases, tags,
block scalars and multiline or non-scalar values are unsupported rather than normalized.

## Verification and limits

Existing focused commands (run from the repository root):

```bash
bun test --timeout 60000 test/parse-check.test.ts test/parser-fault.test.ts test/line-write-safety.test.ts test/typescript-write-safety.test.ts test/format-pipeline.test.ts test/result-json.test.ts test/hud.test.ts
bun test --timeout 60000 test/surface.test.ts test/recommended-preset.test.ts
```

Tool-dependent skips must be reported as such. The above commands test current behavior; they do not prove
exhaustive grammar coverage. Full CI installs the required toolchains and uses
`BOXBOX_REQUIRE_PARSERS=1` to prevent silent parser omissions.
