# BoxBox JSON/YAML and syntax-validation readiness inventory

Date: 2026-10-21
Mode: read-only discovery; no repository files changed
Workspace: `/Users/jonghoPro/woo/00_project/98_BoxBox`

## Ground truth

- `docs/development/plan.md` makes strict JSON and YAML first-release targets under FORMAT1, while AUTHOR1 remains active. The authorization covers the formats, not parser choices, layout conventions, examples, licenses, or new preset approvals.
- The only public approved conventions remain the two existing TypeScript/Python records. `test/recommended-preset.test.ts` explicitly pins that count and their proof chain. JSON/YAML adapters can be implemented and report candidates, but public automatic writes cannot become enabled until a human approves exact examples/rules/decisions.
- The current public CLI and config accept only TypeScript/Python. There are no JSON/YAML profiles, fixtures, rules, or dispatch entries.
- The worktree was already heavily modified. This inventory made no edits to it.

## Exact integration seams

### Public admission and dispatch

1. `product/engine/common/project-config.ts`
   - `PUBLIC_LANGUAGES`, `PublicLanguage`, `languagesOf`, `formattersOf`, base/effective config are closed over `typescript|python`.
   - Add `json` and `yaml` once adapters exist. Formatter configuration should use language IDs, while both `.yaml` and `.yml` map to `yaml`.
   - Tests: `test/project-config.test.ts`, plus CLI config-disabled and formatter cases in `test/cli.test.ts`.
2. `product/engine/cli.ts`
   - Help text, `inferredLanguage`, `parseFileCommand`, explicit-language validation, `inspectFile`, doctor parser reporting, guide/align/format dispatch, and configured-language checks contain TS/Python assumptions.
   - Extensions should be strict `.json`, `.yaml`, `.yml`; JSONC/JSON5, Markdown frontmatter and fenced blocks remain out of scope.
   - Tests: `test/cli.test.ts`, `test/authoring-modes.test.ts`, `test/alignment-only.test.ts`, `test/report.test.ts` where result language lists are asserted.
3. `product/engine/common/format-pipeline.ts`
   - `checkFile`, `assertParses`, and `writeFileWithEngine` are binary TS/Python branches. Replace this with a small adapter registry keyed by `PublicLanguage` rather than adding more nested branches.
   - The existing cycle already supplies the important contracts: formatter first, syntax gate, inspection, exact approval lookup, engine write, second full cycle, fixed point, provenance recheck, atomic replacement, and dry-run restoration.
   - Preserve `alignmentOnly` behavior: no external formatter, same candidate verification, line/indentation preservation.
4. `product/engine/common/authoring-guide.ts`, `approval-gate.ts`, `signature.ts`, `report.ts`, `result-json.ts`, `surface.ts`, and `grammar-ids.ts`
   - Most are language-string generic, but tests/data may enumerate languages or known kinds. Exact lookup keys already include language/context/kind/axes and will correctly prevent JSON/YAML from inheriting TS/Python approval.
5. Host and artifact surfaces
   - `product/plugin/skills/boxbox/SKILL.md` and generated `plugin/skills/boxbox/SKILL.md`, root localized READMEs, `product/packages/cli/README.md`, installer README/help and manifests contain support claims and command examples.
   - `development/tools/build-cli-artifact.ts`, `build-node-artifact.ts`, `build-installer-artifact.ts`, `sync-plugin.ts`, `test/public-artifact.test.ts`, `test/installer-artifact.test.ts`, `test/plugin-contract.test.ts`, and `test/layout.test.ts` must prove adapters/parser dependencies are actually in both artifacts and isolated installs.

### Format-aware adapters

A bounded design is one adapter contract per public language:

```ts
interface PublicLanguageAdapter {
  inspect(file/root): Promise<FileResult>;
  validate(source/path/root): Promise<SyntaxValidation>;
  write(file/root): Promise<void>;
  syntax: preservation metadata or an adapter-owned preservation check;
}
```

Keep TS backed by the TypeScript AST and Python backed by the existing line engine. JSON/YAML should be format-aware adapters, not generic object serialization and not naive additions to `CodeSyntax`.

#### JSON

- Parse strict RFC 8259 JSON and retain concrete source offsets. Native `JSON.parse` is useful for validity but does not expose ranges; an adapter therefore needs a bounded lexical/CST scan or a dependency that retains ranges.
- Initial candidate: adjacent sibling object properties whose key and value are each on one physical line. Only edit horizontal whitespace between the closing key string and `:`, and if approved, between `:` and the value. Never reorder keys or normalize strings/numbers/escapes.
- Skip arrays, multiline values, duplicate-key policy decisions, and any row whose token/range ownership is ambiguous. Duplicate keys are syntactically valid JSON, so the adapter must preserve them and must not round-trip through `JSON.parse` output.
- Context must distinguish object-property rows from other structures; a path/depth/container descriptor should feed the existing exact approval key.

#### YAML

- Select and pin an explicit YAML 1.2 dialect/parser before implementation. A CST/range-preserving parser is required; no YAML parser dependency currently exists in `package.json`.
- Initial candidate: adjacent sibling block-mapping entries with simple scalar keys and single-line scalar values at identical indentation. Horizontal spacing around the mapping colon/value is the only plausible first edit boundary.
- Explicitly refuse or skip complex keys, flow collections until separately proven, anchors, aliases, tags, directives, merge keys, multiline quoted scalars, document markers, and any parser node without reliable token ranges.
- Block scalar headers and all scalar body lines (`|`, `>`, chomping/indent indicators) must be protected as a unit. Comments must remain byte-identical and in place. Indentation and physical line count are immutable.
- `.yaml` and `.yml` are the same language ID. Application schemas (GitHub Actions, OpenAPI, host configs) remain outside syntax validation.

Do not force these through the current `maskSource` alone. It assumes programming-language quote/comment forms, treats unclosed single-line strings as continuing, and cannot identify YAML block-scalar ownership, plain-scalar `#`/`:` rules, anchors or document structure. `changedLines`/`assertAlignmentOnly` can remain a final generic guard only if the adapter supplies correct syntax protection; otherwise JSON/YAML need adapter-owned byte/range preservation checks.

## Read-only syntax-check gap

The gap is confirmed by code and `docs/development/reviews/2026-10-21-maintainer-docs.md`: invalid Python with no detected tables can make public `check` exit zero and report `parse:not-run`.

- `product/engine/common/align-cli.ts` runs `compareParse` only in write mode.
- `product/engine/typescript/align.ts` likewise reports `not-run` for check mode.
- `product/engine/common/result-json.ts` documents `not-run` as the check-mode behavior.
- `product/engine/common/parse-check.ts::compareParse` returns `ok` immediately when `before === after`, before running diagnostics. It cannot serve as a single-input syntax validator.
- `format-pipeline.ts::assertParses` validates formatter output before writing, so write safety exists, but this does not repair public read-only check semantics.

Bounded fix:

1. Add a separate single-input `validateSyntax(language, source/path/root)` contract. It must always invoke the parser and return normalized diagnostics; do not implement it as `compareParse(source, source)`.
2. Have every public adapter implement validation. TS uses `syntacticDiagnostics`; Python uses `ast.parse`; JSON uses the selected strict parser; YAML uses the selected YAML 1.2 parser. Parser unavailable/execution failure remains fail-closed for release-supported operations.
3. Run validation before classification in public `check` and propagate it in `FileResult.parse`. Invalid source must produce a nonzero CLI result even when there are zero groups.
4. Decide the public result-schema evolution deliberately. The current status union has no clear single-input-invalid value (`ok|changed|skipped|not-run`). Reusing `changed` would misstate that diagnostics changed. Prefer an explicit `invalid` (with bounded diagnostics/error data), update `RESULT_SCHEMA_VERSION` if required by the compatibility policy, and update every result consumer.
5. Consumers to audit: `product/engine/common/report.ts`, `guarded-run.ts`, lifecycle/hook result handling, HUD readers under `product/hud/`, CLI JSON/error output, corpus/development harness readers, and artifact/plugin tests.
6. Retain comparative parsing for writes: validate the original/output and require equivalent diagnostics according to the existing invariant. If release policy requires valid inputs, require both diagnostic sets empty rather than accepting equally invalid files; the current docs state write `ok` means equal diagnostics, not that the original is valid, so this is a policy choice that must be recorded.

Primary tests:

- `test/parse-check.test.ts`: valid/invalid single-input validation, unavailable parser, timeout/abnormal exit, JSON/YAML dialect cases.
- `test/cli.test.ts`: invalid TS/Python/JSON/YAML with zero groups exits nonzero; valid clean files show parser `ok`; JSON language mismatch and `.yml` inference.
- `test/result-json.test.ts`, `test/report.test.ts`, `test/guarded-run.test.ts`, HUD tests: new parse state/schema consumption.
- Existing `docs/development/reviews/2026-10-21-maintainer-docs-evidence/process-syntax-probe.ts` is useful reproduction evidence but should not substitute for product tests.

## Fixture and verification matrix

Create dedicated fixture trees, following existing language layout:

- `test/fixtures/json/{tables.json,tables.aligned.json,tricky.json,invalid.json}`
- `test/fixtures/yaml/{tables.yaml,tables.aligned.yaml,tricky.yaml,invalid.yaml}` plus a `.yml` admission case
- Focused test suites `test/json-align.test.ts` and `test/yaml-align.test.ts`; reuse `test/lang-harness.ts` only if its assumptions are truly satisfied. It currently assumes a `LineProfiler`, so a CST adapter likely needs a parallel adapter harness.

Each format suite should cover:

- exact golden output, minimum-row behavior, same-parent/same-indent grouping and blank/comment boundary handling;
- preservation of key order, scalar spelling, escapes, duplicate JSON keys, YAML comments, directives and block scalar bytes;
- refusal/no-op for unsupported constructs and explicit result reasons where the result contract can represent them;
- idempotence and byte fixed point; invalid input refusal; parser unavailable/failure; no-write preview hash equality;
- configured Prettier coexistence if it is the selected real formatter case, including `C(C(x)) == C(x)`;
- approval denial with no JSON/YAML preset rule, then exact-key write tests only with a test-local approval registry;
- installed CLI archive execution and both host launchers on supported OS targets.

## Approval and data dependency

Implementation can safely proceed through detection, syntax checking, candidate reports, test-local approvals and packaging. It must stop before shipping writable recommended JSON/YAML conventions. Human review must approve exact before/after positive examples, counterexamples, rule identity (language/context/kind/axes/scope), document reference/hash, attribution/license and decision receipt. Existing TS/Python rules must remain exactly scoped and cannot authorize the new formats.

## Risks and dependencies

- Parser choice is the principal unresolved dependency. JSON can be validated natively but still needs lossless ranges; YAML requires a pinned CST-capable dependency and dialect policy. Dependency license, Node/Bun compatibility, bundled/offline install behavior and Windows path behavior need artifact tests.
- YAML syntax is context-sensitive enough that a shared regex line profile creates silent-corruption risk. Block scalars and plain scalars are the highest-risk areas.
- Adding languages only to CLI/config would create false support: doctor, artifacts, host adapters, result consumers and docs must change in the same delivery slice.
- A result schema change can break HUD/hooks/harness consumers. Inventory consumers before bumping and keep one canonical validator/type.
- Formatter fixed points are not automatic. Prettier may remove alignment and wrapping can oscillate after BoxBox padding; corpus tests must measure the two-cycle contract.
- Syntax validity is not application-schema validity. Support claims must say strict JSON/YAML syntax and the bounded table kinds only.

## Suggested implementation order and commands

1. Implement single-input syntax validation and result-consumer compatibility first; this removes the known false-green `check` behavior for existing TS/Python.
2. Select/pin parser dependencies and add JSON/YAML syntax fixtures.
3. Add lossless adapters and focused candidate/refusal tests with no public approvals.
4. Wire adapter registry through config, CLI, format pipeline, doctor, hooks/HUD and guide.
5. Exercise test-local approvals through dry-run/write/fixed-point paths.
6. Obtain explicit human approval for any recommended JSON/YAML rule/examples, then add preset data and exact proof tests.
7. Build and inspect isolated CLI/installer artifacts; verify hosts and OS matrix; only then update support claims and all three root READMEs together.

Focused commands (after implementation exists):

```bash
bun test test/parse-check.test.ts test/result-json.test.ts test/report.test.ts
bun test test/json-align.test.ts test/yaml-align.test.ts test/format-pipeline.test.ts test/cli.test.ts
bun test test/project-config.test.ts test/guarded-run.test.ts test/public-artifact.test.ts test/installer-artifact.test.ts test/plugin-contract.test.ts
bunx tsc --noEmit
bun run sync:plugin
bun run check
bun run pack:cli
bun run pack:installer
claude plugin validate --strict ./plugin
```

For release evidence, run the installed archive journey on each supported OS: `init -> doctor -> check -> format/align preview -> format/align -> check`, then invoke the same engine through each supported host. Record parser/version fingerprints, artifact contents, exit codes, hashes proving preview/no-write, and fixed-point output.
