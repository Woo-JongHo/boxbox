# Plan

The working plan for XXX. Product direction lives in [`design.md`](design.md); this file tracks **what we do next, in order, and how each step is verified**.

## Goal

**North star:** a readability plugin any coding agent can plug in, that aligns same-role code into readable tables and never changes behavior — learning from judged cases until it can safely change and generate code.

**현재 마일스톤 — M1.8 언어 모델과 배포 (2026-09-30).** 최상단 원칙·문법부터 배포 구조까지 위에서 아래로 설계한다. M1.7 P2–P5는 S5까지 보류(공개 키에 `pattern`이 들어갈지 여기서 정해짐). M1.5 판정은 병행 가능.

**Previous milestone — M1.5, awaiting human verdicts.** All engineering tasks are done 2026-09-29 (D1 pinned corpus, D2 signature types, D3 judging material exported, D4 promotion mechanism, D5 measures, D6 edge inputs, D7 Swift and Kotlin). The milestone closes when the user records verdicts: `bun scripts/corpus-judge.ts --verdict <rank> <verdict>` over the types in `TEST_COMPLETED/corpus/SUMMARY.txt`. M1.6 Nested tables closed 2026-09-28 (call layer, list layer, vertical outliers, guard rows and subscript cells, Python assigned calls).

**M1 Safety proof — done 2026-09-28.** Every automatic edit is *proven* safe in code, not just promised in prose. Criteria and result:

- ✅ Every write path re-tokenizes and re-parses its output and refuses edits that change anything but inter-token whitespace (T2, T3; Rust re-parse verified in CI only).
- ✅ Automatic fixes never apply to fewer than 3 rows — except the user-confirmed 2-row `=` declaration tables and imports (T4).
- ✅ Go alignment is off by default (T5).
- ✅ Both engines emit one versioned `Result` JSON (T6).
- ✅ `bun run check` is green (169 pass, 3 skipped for the missing local Rust parser) and all 61 repository TypeScript files pass their own checks.
- ✅ `design.md` §10 shows token preservation, re-parse, mutation tests and row floors as **Exists**; Go stability stays **Partial** (report-only, no gofmt-stable subset yet).

## How we work

**Standing check for every task:** every `.ts` file under `skills/xxx/scripts/`, `scripts/` and `test/` passes both `06_align-tables.ts --file` (misaligned=0) and `00_normalize-imports.ts` (changed=0), plus `bun run check`.

1. **One task at a time.** Only the task marked `▶ active` is worked on.
2. **Each task has acceptance criteria and verification commands.** A task is not done until every command passes and its output is shown to the user.
3. **The user confirms before the next task starts.** Then the task is marked `✅ done` with the date, and committed if the user approves the commit.
4. **Scope changes go into this file first** (add, split or drop a task), not silently into the code.
5. **Findings that don't belong to the active task** are appended to *Backlog*, not fixed on the side.

Status legend: `⬜ todo` · `▶ active` · `✅ done` · `⏸ blocked`

## M1 — Safety proof

| # | Task | Status |
|---|---|---|
| T0 | Baseline commit | ✅ done 2026-09-28 |
| T1 | Green self-check | ✅ done 2026-09-28 |
| T2 | Token-stream preservation | ✅ done 2026-09-28 |
| T2.5 | Import table cells | ✅ done 2026-09-28 |
| T3 | Output re-parse | ✅ done 2026-09-28 |
| T3.5 | Mutation tests | ✅ done 2026-09-28 |
| T3.6 | TEST_COMPLETED folder | ✅ done 2026-09-28 |
| T4 | Row floors per kind | ✅ done 2026-09-28 |
| T5 | Go alignment off by default | ✅ done 2026-09-28 |
| T6 | Shared `Result` JSON | ✅ done 2026-09-28 |
| T7 | Close M1 | ✅ done 2026-09-28 |

### T0 — Baseline commit

Snapshot the current working tree so every later task has a clean diff.

- **Scope:** two commits. (1) **Code:** the pre-existing work-in-progress registry changes (`grid-kinds.ts` call-statements kind and object-row property axes, with their tests), the `woo` → `xxx` rename and the English migration. These cannot be split cleanly: the same files were changed by the WIP, then moved and translated. (2) **Docs and process:** `AGENTS.md`, `CLAUDE.md`, `design.md`, `plan.md`, `reviews/`, readiness doc, CI workflow. Add `.video_agent/` to `.gitignore`.
- **Needs:** user approval of the commit split and messages.
- **Accept:** `git status` clean except ignored files; `bun run check` green at each commit.
- **Verify:** `git log --oneline -5`, `git status --short`, `bun run check`.

### T1 — Green self-check

The repository must pass its own checker (the WIP `grid-kinds.ts` changes now flag files that were aligned under the old registry).

- **Scope:** run `06_align-tables.ts --write` on the flagged scripts and tests after reading each group; fix anything that looks like a wrong detection as a registry bug instead of accepting the rewrite.
- **Accept:** every `.ts` file under `skills/xxx/scripts/`, `scripts/` and `test/` reports `misaligned=0`; tests green.
- **Verify:**
  ```bash
  for f in skills/xxx/scripts/**/*.ts scripts/*.ts test/*.ts; do bun skills/xxx/scripts/typescript/06_align-tables.ts --file "$f" >/dev/null || echo "FAIL $f"; done
  bun run check
  ```

### T2 — Token-stream preservation

Today the harness compares output and input with *all* whitespace stripped, which cannot see a change inside a string literal or comment.

- **Scope:** a shared check built on the existing mask: code outside strings/comments must match token by token, and every string and comment must be byte-identical. The line engine and the TypeScript aligner call it before returning an edit; on failure the row/table is refused. The harness asserts it instead of `stripWhitespace`.
- **Accept:** a new test proves that an edit which changes spacing *inside* a string is refused; all language suites use the new assertion.
- **Verify:** `bun test`; the new negative test fails if the check is removed.

### T2.5 — Import table cells

User-confirmed rule change (2026-09-28): imports apply contract rules 8 and 35 — the `{ }` binding list is a fixed-width cell and the terminating `;` is a column — across the whole import section.

```ts
import      {
              isArrayLiteralExpression       ,
              isPropertySignatureDeclaration ,
                                               } from "typescript/unstable/ast"         ;
import type { Node, SourceFile                 } from "typescript/unstable/ast"         ;
import      { skipTrivia                       } from "typescript/unstable/ast/scanner" ;
```

- **Head cell:** always reserves the `import type` width (or a wider `import Default,`), so `{` is one column in every import.
- **Section-wide columns:** `{ }`, `from`, module and `;` are shared by all groups separated only by blank lines; code between imports starts a new section.
- **Vertical form:** one name per line on the names column, aligned commas, trailing comma, closing `}` on the table's `}` column — triggered by (A) one-line form over 120 columns, (B) names 20+ columns wider than the second-widest, (C) the aligned table still over 120 columns (widest names first).
- **Stay as written:** imports without braces and imports with attributes (they do not break the table); a lone brace import stays compact; no `;` column in files without semicolons.
- **Accept:** the rules above hold; the whole repository is realigned with every import line within 120 columns; SKILL.md STEP0 and contract rule 2 describe the new form.
- **Verify:** `bun test test/normalize-imports.test.ts` (7 cases, including re-detection of already aligned rows), standing self-check across the repository.

### T3 — Output re-parse

- **Scope:** after alignment, parse input and output with the language's official parser and require the same diagnostics. TypeScript uses the bundled `typescript@7`. Other languages use their toolchain when present — Python `ast.parse`, `gofmt -e`, `javac`, `clang -fsyntax-only`, `node --check`, `rustc` (not installed locally; CI installs it) — and the harness marks the check as skipped, never passed, when a toolchain is missing.
- **Accept:** every golden fixture's output parses with unchanged diagnostics; CI runs all eight parsers.
- **Verify:** `bun test` locally (skips listed explicitly); CI log shows no skips.

### T3.5 — Mutation tests

Generate thousands of variants from the existing fixtures and prove the invariants hold on each. Local compute only.

- **Scope:** a seeded, deterministic mutator per language: random spacing and tabs between tokens, separators (`:` `=` `;` `,` `//` `#`) injected inside strings, comments inserted between rows, CJK and emoji in strings and comments. For every variant: token-stream preservation (T2), idempotence, and re-parse (T3) where the toolchain exists. Failures are minimized and saved as regression fixtures.
- **Accept:** at least 1,000 variants per language run in `bun test` under a time budget (seed fixed; a larger run is available via an environment variable); zero invariant failures, or every failure fixed and pinned as a fixture.
- **Verify:** `bun test`; `XXX_MUTATIONS=20000 bun test test/mutation.test.ts`.

### T3.6 — TEST_COMPLETED folder

A place to check aligned results by eye in an editor (design §6, L4 review, first version). An HTML page was tried first and replaced by plain files at the user's request.

- **Scope:** `bun scripts/test-completed.ts [--samples 3]` rebuilds `TEST_COMPLETED/` (git-ignored): per language, every fixture and seeded mutation samples as aligned files, each original under `before/`, and `SUMMARY.txt` with the safety results per file (tables, refused, whitespace-only, idempotent, parse).
- **Accept:** all eight languages are present; failing files are marked `FAIL` in `SUMMARY.txt`.
- **Verify:** run the command; the user reviews the folder.

### T4 — Row floors per kind

- **Scope:** fixes apply from 3 rows, with two user-confirmed exceptions from 2 rows: TypeScript `=` declaration tables (`declaration-equals`) and imports. The line engine raises any `minRows` below 3 to 3, so `--min-rows 2 --write` no longer promotes pairs. Line-engine `=` declarations per language are decided in F1.
- **Accept:** a 2-row TypeScript `=` declaration table is aligned; a 2-row group of any other kind, and any 2-row line-engine group even with `--min-rows 2`, is left unchanged; docs no longer advertise `--min-rows 2` as a fix path.
- **Verify:** `bun test`; `grep -rn "min-rows 2" skills docs` shows only the reporting option of `01_group-regions.ts` and history notes.

### T5 — Go alignment off by default

- **Scope:** the Go aligner reports but does not write unless explicitly enabled (flag now; config key once `.xxx/config.json` exists). Record the gofmt conflict in the Go suite as a known limitation.
- **Accept:** `06_align-tables.ts --file x.go --write` leaves the file unchanged without the opt-in flag; with the flag, behavior is as today.
- **Verify:** `bun test`; manual run on `fixtures/go/tables.go` with and without the flag.

### T6 — Shared `Result` JSON

- **Scope:** one versioned JSON schema (`schemaVersion`, file, tables, per-group state, edits, refusals) emitted with `--json` by both the TypeScript aligner and every line-engine aligner.
- **Accept:** a schema test validates the output of one TypeScript file and one file per line-engine language.
- **Verify:** `bun test`; `bun skills/xxx/scripts/python/06_align-tables.ts --file skills/xxx/fixtures/python/tables.py --json`.

### T7 — Close M1

- **Scope:** update `design.md` §10 rows, README status, and this file; write the next milestone's tasks in detail.
- **Accept:** the M1 checklist under *Goal* is all true.

## M1.6 — Nested tables, TypeScript first (after M1, before M1.5)

Why: the engine sees one layer only. In `const STATES = new Set(["PASS", …]) ;` it aligns `=` and `;` but not the call or the list inside. Judging real data (M1.5) before this would spend verdicts on a known gap (user decision 2026-09-28).

```ts
const STATES = new Set(["PASS", "FIXABLE", "SUGGEST", "REFUSE" ]) ;
const PARSES = new Set(["ok"  , "changed", "skipped", "not-run"]) ;
```

| # | Task | Status |
|---|---|---|
| N1 | Call layer: callee, `(`, top-level `,`, `)` inside declaration values and call-statement subjects | ✅ done 2026-09-28 |
| N2 | List layer: `[ ]` / `{ }` of literals — element widths, `,` and closing column | ✅ done 2026-09-28 |
| N3 | Outliers in declaration tables: when one row is far longer, the vertical form (as for imports) | ✅ done 2026-09-28 |
| N4 | Hand-made samples: guard-row tables and subscript cells from `00_normalize-imports.ts` | ✅ done 2026-09-28 |
| N5 | Python: the same layers on the line engine's bundle rows | ✅ done 2026-09-28 |

| Layer | Aligned | Condition |
|---|---|---|
| 1 — row | `=`, `;` (existing) | declaration / call-statement table |
| 2 — call | callee name (left), `(`, top-level argument `,`, `)` | the cells share callee, arity and tail (no `.stdout ?? ""` on only some rows), in the table's row count; no argument is 20+ columns wider than the second widest in its column (import rule B) |
| 3 — list | the bracket column, each item `,` right after the widest item, the next item one space later, and the closing `]` / `}` right after the widest last item | slots: the declaration value, each argument of the layered call, and the matcher arguments of call statements; every row has the slot with the same shape (array arity, or the same object property names), every item is a string/number/boolean literal, no item is 20+ columns wider than the second widest in its column (import rule B); a trailing comma or a multi-line form refuses the slot; dropping the call layer drops the list slots inside its arguments (matcher slots survive) |

N2 implementation notes (done 2026-09-28): `callLayer` in `grid-kinds.ts` was generalized into `itemLayer`, a cell layer over items (call arguments, array elements, object properties). List slots are derived per row by `rowListCells` and tagged `layer: "call" | "list:<slot>"` with slot names `list:value`, `list:arg<i>`, `list:matcher-arg<i>`; boundaries carry slot-qualified axes (`list-arg2-comma1`, …) registered in `KIND_AXES` and `AXIS_NOTES`. `withLayers` gates the call layer as in N1 and each list slot across the run: same shape (arity or property names), all items literal, no 20+-column outlier in any item column.

N3 implementation notes (done 2026-09-28): in a declaration table whose rows share callee and arity, the row holding the outlier argument (import rule B) takes the vertical form instead of dropping the layer for everyone — arguments one per line under the `(`, non-last argument commas right after the widest argument, `);` on the statement's indentation, `=` at the table's `=` column; the remaining rows keep the call layer when no outlier is left among them. The render only inserts line breaks and padding, so `06_align-tables.ts` gates such a group with the new `preservesTokensWithBreaks` (tokens and comments byte-identical, breaks only inserted; the strict gate still covers every other edit) plus the re-parse gate. Calls with one argument, different callees, and call statements never go vertical. A vertical row leaves the table on the next run, so the write is stable.

N4 implementation notes (done 2026-09-28): two constructs from the hand-aligned `lexicalMask` in `00_normalize-imports.ts`. (1) Subscript cells — a declaration value that is a subscript read (a leading `!` is fine) gains a `subscript-close` insert axis: `]` right after the widest index, kept only when every row has the subscript on the same object with no outlier index. (2) Guard rows — a new `guard-statements` kind for consecutive one-line `if (…) { …; continue; }` statements (block ends in `continue`, no `else`): the condition's closing `)`, the first statement's `;` and the `continue` column are insert axes; the statements in between stay as written. The hand-aligned sample is the engine's fixed point. The third hand-made sample (a multi-line object literal whose continuation lines align on the first property) is not covered yet — see backlog.

N5 implementation notes (done 2026-09-28): the Python profile gains the assigned call row, `name = call(...)`, as table form 6 — the line engine's call layer. The callee travels in the axis name (`call:frozenset`), so rows calling a different callee never share a table; arity is part of the axis sequence. Two argument shapes decompose: two or more scalar arguments become cell/arg columns, and exactly one flat bundle argument (`frozenset({"a", "b"})`) folds its cells inside the call as the list layer — the Python counterpart of the milestone's `new Set([...])` example. Nesting, keyword arguments, and bare `name = {...}` values stay refused. The cell cutter is shared with bundle rows (`cellsIn`); tables need the line engine's 3-row floor.

Hand-made reference samples (user, `00_normalize-imports.ts`): guard rows `if (…) { state = … ; … continue; }` with aligned condition cell, `{ … ;` and `continue`; subscript cells `chars[index    ]!` / `chars[index + 1] ;`; a multi-line object literal whose continuation lines align on the first property.

## M1.5 — Data for TypeScript and Python (after M1.6, before M2)

Why: today's tests prove safety, not quality. Goldens were produced by the engine itself and no real code has been judged by a person. The principles are the same for every language; what makes a language solid is **judged real data**. TypeScript and Python get it first (user decision 2026-09-28); Java, Go, Rust, JavaScript, C, C++, Kotlin and Swift stay light (current fixtures plus the safety net).

| # | Task | Status |
|---|---|---|
| D1 | Pinned corpus for TypeScript and Python | ✅ done 2026-09-28 |
| D2 | Signatures: group every aligned table into types | ✅ done 2026-09-28 |
| D3 | Judging in TEST_COMPLETED and verdict records | ✅ done 2026-09-28 |
| D4 | Learning: verdicts become cases, rules and registry changes | ✅ done 2026-09-29 |
| D5 | Measures: judged share, wrong-grouping rate, unseen types | ✅ done 2026-09-29 |
| D6 | Edge inputs: CRLF, BOM, large files, Rust parser | ✅ done 2026-09-29 |
| D7 | Swift and Kotlin (light) | ✅ done 2026-09-29 |

- **D1:** `corpus/manifest.json` (committed) pins permissively licensed repositories by commit SHA — TypeScript candidates: vscode, prisma, trpc, zod; Python candidates: requests, fastapi, pydantic, django — plus the user's private repositories as local-only sources (never committed). Sources are fetched into `~/.cache/xxx/corpus/`. Done 2026-09-28: `scripts/corpus-fetch.ts` materializes each source as a shallow worktree at the pinned commit (idempotent re-runs); private repositories go into gitignored `corpus/local.json` (same schema, merged, duplicate ids refused); `test/corpus.test.ts` validates the manifest and the gitignore entry without network. All eight sources verified fetched at their pinned commits; per-source `paths` fields scope future scanning.
- **D2:** every detected table gets a signature (language, container context, kind, ordered axis IDs, nesting, result state — design §6 L2); thousands of tables collapse into hundreds of types, ranked by frequency × risk. Done 2026-09-28: `scripts/corpus-signatures.ts` scans the fetched corpus (TypeScript through one TypeScript 7 server per source in batches of 25 files, capped by `--max-files` per source, `.tsx`/`.d.ts`/hidden directories skipped, symlinked directories counted once; Python through the in-process line engine) and writes the ranked type report to `~/.cache/xxx/corpus/signatures.json` with up to three source locators per type for D3. First run (`--max-files 100`): 1,432 tables from 737 files collapse into 91 types, top type function-body `=` declaration tables (258 tables, 1,099 edits). The shipped default run (`--max-files 400`, after the symlink fix): 8,093 tables in 197 types, top type 1,077 tables / 3,962 edits — reruns are byte-identical. Both engines now carry `context` and `depth` per table (TypeScript: AST container kind and container depth; line engine: shared indent as depth), and `loadSourceFile` closes its TypeScript 7 server — the unclosed servers were accumulating gigabytes across runs. Cross-verified 2026-09-28 (see `docs/reviews/`): all pins, licenses, determinism and locators reproduced; the symlink double-visit and silent-missing-manifest findings are fixed in the same pass.
- **D3:** representatives per type are exported to `TEST_COMPLETED/corpus/<language>/<type>/` (aligned file, original, context); the user judges each type: `correct`, `different-role`, `missing-kind`, `taste`, `unsure`. Verdicts are stored as records (`corpus/verdicts.jsonl`, committed; no third-party code in it). `SUMMARY.txt` shows `approved` / `unjudged` per result. From the D2 cross-review: the sorted-alphabetical walk biases the census sample toward files early in sort order — D3 sampling should be stratified (design §5.2), and `call:*` representatives should be sampled per callee since the type deliberately merges callees the engine keeps apart. Done 2026-09-29: `scripts/corpus-judge.ts` exports all 197 types (2 representatives each) into `TEST_COMPLETED/corpus/<language>/<rank>-<slug>/` and renders `SUMMARY.txt`; judge by rank with `--verdict <rank> <verdict> [--note …]`, appending to `corpus/verdicts.jsonl`. **Left for the user: the actual verdicts** — open `TEST_COMPLETED/corpus/SUMMARY.txt`, review each type's `rep1-original.txt` against `rep1-aligned.txt`, then record `bun scripts/corpus-judge.ts --verdict <rank> <verdict>`.
- **D4:** each verdict becomes a minimized, synthetic-identifier case under `fixtures/<language>/<region>/<construct>/` (the construct matrix grows from data, not by hand); `different-role` becomes a grouping rule, `missing-kind` a new kind, `correct` a pinned golden (design §7). The promotion gate keeps judged results from changing silently. Done 2026-09-29 (mechanism; real promotion waits on D3 verdicts): `scripts/corpus-promote.ts --rank <n>` scaffolds a synthetic fixture under `skills/xxx/fixtures/<language>/corpus/` for a `correct` verdict, writes the engine-aligned golden and a `verdict.json` binding; `--check` is the promotion gate (every promoted fixture must still align to its committed golden) and `--report` lists pending `different-role`/`missing-kind` registry work. The fixture author refines the scaffold by hand — no third-party text is ever copied.
- **D5:** per language: share of tables in judged types, wrong-grouping rate from verdicts, share of types never seen before in a new repository. Done 2026-09-29: `scripts/corpus-measures.ts` prints per-language judged share, table share, and the wrong-grouping rate (`different-role` + `missing-kind` over judged tables; `taste`/`unsure` are judgments, not misses); `--baseline <signatures.json>` reports the unseen-type share. Currently all shares are 0% — no verdicts exist yet.
- **D6:** CRLF and BOM files, a multi-thousand-line file with a time budget, `rustfmt` locally. Done 2026-09-29: `test/edge-inputs.test.ts`. Found and fixed a real gap — CRLF line endings made the line engine silently refuse every row (the trailing `\r` failed the row regexes and the trailing-whitespace guard); the engine now strips `\r` for profiling and restores it on output, so CRLF files align with their endings preserved. BOM lines stay untouched, and a 3,000-line single-table file aligns well inside the budget. rustfmt was already covered by the T3 skip-locally mechanism.
- **D7:** Swift and Kotlin as light languages — nested block comments, multi-line and raw strings, interpolation in the mask; re-parse with `swiftc -parse` / `kotlinc` (Kotlin in CI only); mutation tests; discovery text. Done 2026-09-29: `maskSource` gained nested block comments (`BlockCommentSpec.nested`); `scripts/swift/` and `scripts/kotlin/` profiles accept four row forms (let/val·var typed and plain bindings, assignments, quoted dictionary rows), refusing calls, containers, closures and declarations; fixtures (tables/tricky/golden) for both; `swiftc`/`kotlinc` parse gates registered (kotlinc installed by the CI workflow, so its parse gate runs there but skips locally); mutation tests registered; discovery text updated in the manifests, SKILL.md and AGENTS.md.

## M1.7 — Pattern DB slice (parallel to M1.5 verdicts, before M2)

Why: the product is a pattern checker — "does this code match the approved patterns in my database?" (user direction 2026-09-30). Design §3–4 already calls this the Registry (Convention / Evidence / Decision records), but only the collecting side exists (census, signatures, verdicts, promotion). Nothing at runtime can look a group up: the signature lives in `scripts/corpus-signatures.ts` (not shipped), includes the result state, and the aligners never emit it.

Decisions (2026-09-30):

- **Retrieval is an exact signature-key lookup, never vector similarity.** Deterministic (invariant 7); an unknown key means `SUGGEST` / `UNCERTAIN`, never a best-effort fix (invariant 2). Similarity retrieval ("RAG") belongs only to GUIDE, where agents consume approved patterns and golden examples at authoring time.
- **The database is git-tracked JSON/JSONL files.** No server and no native dependency, so the plugin installs anywhere; approvals stay reviewable as diffs. SQLite may come later as a cache index only.
- **Two databases, layered:** the preset DB ships read-only with the plugin; the project DB is `.xxx/conventions.json`, owned by the user. Project > Preset.
- **The DB gates, it does not draw.** The engine still computes every column; the DB only decides whether a group may be fixed. The M1 safety proof is unchanged.
- **The signature key is a public contract**: versioned, with a migration rule when its format changes.

| # | Task | Status |
|---|---|---|
| P1 | Shared signature module: identity key without result state | ✅ done 2026-09-30 |
| P2 | `signature` per group in the `Result` JSON (both engines) | ⏸ blocked (M1.8 S5까지) |
| P3 | Convention record schema and loader (preset + project) | ⏸ blocked (M1.8 S5까지) |
| P4 | Lookup step, report-only: `convention: approved \| rejected \| unknown` | ⏸ blocked (M1.8 S5까지) |
| P5 | Promotion writes `correct` verdicts into the preset conventions | ⏸ blocked (M1.8 S5까지) |

- **P1:** move `signatureOf` / `normalizeAxis` from `scripts/corpus-signatures.ts` into `skills/xxx/scripts/common/signature.ts`; the identity key is `(language, context, kind, axes, depth)` with a key version, and the state is a separate field. `corpus-signatures.ts` imports it. **Verify:** regenerate `signatures.json` and compare type counts (only splits caused by removing the state may differ); `bun run check`.
  P1 implementation notes (2026-09-30): `skills/xxx/scripts/common/signature.ts` holds `SIGNATURE_VERSION`, `normalizeAxis`, `signatureOf` (no state argument) and `indentDepth`. The census report moves to `schemaVersion: 2` with `signatureVersion`; each type counts its results in `states` instead of being keyed by one, and its representatives prefer FIXABLE tables. `readCensusReport` refuses an older report, so judge, measures and promote never match stale keys. Rerun on the pinned corpus: 8,093 tables collapse into 182 types (was 197); the 197 old keys minus their state give exactly the 182 new keys with identical per-state counts (14 keys held more than one state). `TEST_COMPLETED/corpus/` was re-exported with the new slugs (`<rank>-<kind>-d<depth>-<hash>`).
- **P2:** every group in `--json` carries `signature`; bump `schemaVersion`. **Verify:** the schema test covers one TypeScript file and one file per line-engine language.
- **P3:** a `Convention` schema (design §4.1) and a loader for `skills/xxx/presets/recommended/conventions.json` and `<repo>/.xxx/conventions.json`. **Verify:** loader unit tests — missing files, conflicts (project wins), schema errors fail loudly.
- **P4:** check mode annotates each group with its convention status; write behavior is unchanged. **Verify:** every golden fixture unchanged; `--json` shows the field.
- **P5:** `corpus-promote.ts` records a `correct` verdict as an approved preset convention (the Decision stays in `corpus/verdicts.jsonl`). **Verify:** one verdict end to end — verdict → convention → check reports `approved`.
- **Later:** switch the lookup into a gate (`unknown` → `SUGGEST`), give line-engine groups a real `context` and `kind` (today `""` / `"table"`, so different roles can share a key), and the GUIDE renderer — absorbed into M3, M5 and M7.

## M1.8 — 언어 모델과 배포 (2026-09-30~)

왜: 목적이 공개 배포로 정해졌다. 원칙은 "가독성 좋은 코드", 가치관은 "코드는 언어다". 쓰게 유도하는 것(GUIDE)과 검사하는 것(REVIEW)이 같은 문법과 약속을 봐야 하고, 그 약속과 예문을 담는 곳이 DB다. 이 틀을 위에서 아래로 한 층씩 확정한다.

### 결정 사항

- **레포는 하나.** 스킬 폴더는 Agent Skills 공개 표준이라 Claude Code, Codex, Gemini CLI, Copilot, Cursor 등이 같은 폴더를 읽는다. 호스트별 차이는 매니페스트뿐이다.
- **산출물은 둘.** 엔진 CLI 패키지(`npx xxx …`; CI·훅·에디터·에이전트가 모두 호출)와 얇은 에이전트 어댑터(`SKILL.md` + 매니페스트).
- **배포 차단 요소:** R1 마켓플레이스 설치 시 `node_modules`가 없어 TS 엔진이 안 돈다, R2 bun 필수, R3 에이전트 밖(CI·훅) 사용처, R4 Preset DB는 엔진과 같이 버전이 붙어야 함, R5 이름·라이선스. 또 `marketplace.json`의 `source: "./"`는 레포 전체를 내려보내므로 배포본은 `plugin/`으로 분리한다.
- **규범 5층** (아래 층은 위 층의 ID만 쓴다. 아래로 갈수록 자주 바뀌고 권한이 약하다):

| 층 | 위치 | 책임 |
|---|---|---|
| 0 헌장 | `skills/xxx/references/charter.md` | 원칙, 가치관, 안전 불변식 |
| 1 문법 | `skills/xxx/references/grammar.md` | 단위(단어·문장·문단·글), 문형, 역할, 문단 목적, 장르 — 모든 ID 정의 |
| 2 표현형 | `base/<language>/` (데이터) | 문형 → kind, 기호, 어순, 분해 조건 |
| 3 약속 | `presets/recommended/rules/`, 사용자 `.xxx/rules/` | 허용 모양 중 무엇을 쓰는가, 등급(FIX/SUGGEST/GUIDE) |
| 4 예문집 | Preset DB, 사용자 `.xxx/` DB (JSON/JSONL) | 승인 예문, 판정 이력 |

- **핵심 원칙이 모든 모델에 닿는 경로:** ① 엔진 코드와 테스트(모델과 무관하게 강제) ② `charter.md` 원문 ③ `SKILL.md` 맨 위 3–5줄(스킬 발동 시) ④ 사용자 레포 `AGENTS.md`의 표시 구간(`xxx init`이 기록, 대부분의 에이전트가 항상 읽음). ③·④는 ②에서 생성하고 테스트로 고정한다. `CLAUDE.md`(`@AGENTS.md`)는 유지한다 — Claude Code는 `CLAUDE.md`가 없을 때만 `AGENTS.md`를 읽고, 구버전·Bedrock·Vertex에는 그 대체 읽기가 없다.
- **언어:** 개발 중 한국어, 배포 전 영어 번역(AGENTS.md 언어 정책).

| # | 작업 | 확인 기준 | 상태 |
|---|---|---|---|
| S0 | 이 지도 기록, M1.7 보류, AGENTS.md 언어 정책 교체, 메모리 갱신 | 사용자 승인, `bun run check` | ✅ done 2026-09-30 |
| S1 | `charter.md` (한 페이지): 원칙, 가치관, 불변식 | 문구 확정 | ▶ active |
| S2 | `grammar.md`: 4단위, 문형 8개, 역할, 문단 목적, 장르 + 코퍼스 근거 | 코퍼스 8,093표 100% 대응 재확인 | ⬜ todo |
| S3 | 표현형 데이터 스키마 (kind → 문형) | 기존 kind 전부 매핑, 테스트 | ⬜ todo |
| S4 | 약속 규칙 파일 스키마 + WHEN W1–W4 | 스키마 테스트 | ⬜ todo |
| S5 | 예문 DB 스키마 → M1.7 P2–P5 재개 (키에 `pattern`) | P2 검증 | ⬜ todo |
| S6 | 엔진 CLI 패키지화, 배포본 `plugin/` 분리 (R1–R3) | 깨끗한 환경에서 마켓플레이스 설치 후 실행 | ⬜ todo |
| S7 | 문서 재배선: AGENTS.md, SKILL.md(절차만), design.md, `readability-contract.md` 해체 | `bun run check`, 링크 확인 | ⬜ todo |
| S8 | 배포 전 영어 번역 + 한국어 잔존 검사(CJK 테스트 데이터 제외) | CI 검사 통과 | ⬜ todo |

근거 자료(연구 인용, 코퍼스 측정: 문형 분포, 함수 본문 51.5%, 우리 코드의 if/for/문단 측정)는 S2에서 `docs/research/`로 옮긴다.

## Next milestones (detailed when they become active)

| Milestone | Design phase | Outcome |
|---|---|---|
| M2 Run-last | P0.5 | `xxx format` / `xxx check` wrapping one configured formatter; fixed-point tests |
| M3 Declarative registry | P1 | rule identity = language + context + kind + signature; five review states |
| M4 Corpus | P1.5 | pinned open-source manifest; L1 runner; L2 signatures; judged cases |
| M5 Rules and layers | P2 | `rules/<language>/<region>/` files; preset `recommended`; `.xxx/config.json` |
| M6 Learn | P3 | candidates from a repository; approve / reject |
| M7 Guide and feedback | P4 | agent rule generation; case recording; promotion gate |

## Backlog

Findings outside the active task. Pull into a milestone when relevant.

- Different callees in one table (`run.map(…)` next to `new RegExp(…)`): align `(` after the widest callee and `)` as the cell close, arguments compact (user idea, 2026-09-28). Deferred to M1.5 judging: comparing different calls is rarely useful and `name    (` splits a call. Decide on real data.
- The `;` axis can pad short rows far past column 120 when one row is long (seen in `stress-corpus.ts` during T1, fixed there by extracting a duplicated expression). The checker should warn when alignment pushes a table past 120 columns, pointing to the contract's "simplify the exceptional element first" step.
- `scripts/stress-corpus.ts` still has ten lines over 130 columns that are not tables.
- Import tables are aligned from 2 rows (the pre-existing import rule), unlike other tables (3). Decide whether imports follow the 3-row floor in T4.
- Declaration tables (01.2 and 04.2): let a multi-line declaration's first line join the `=` column; keep declarations and plain assignments apart (agreed 2026-09-28). Inner layers and outliers: M1.6.
- T3: Rust re-parse is unverified locally (`rustfmt` not installed); CI installs it and runs with `XXX_REQUIRE_PARSERS=1`, but the workflow change is unverified until the branch is pushed.
- T3: the TypeScript re-parse gate starts two TypeScript 7 servers per written file (~0.3 s); fine for `--write`, revisit for bulk runs. Updated 2026-09-28: `loadSourceFile` now closes its server (the unclosed ones accumulated gigabytes across runs — seen as ~30 GB in Activity Monitor during repeated checks); the corpus census instead opens one server per source in batches of 25 files.
- T3.5 findings (fixed): (1) the preservation check treated trailing whitespace after a line comment as content, so 10–57 tables per 1,000 variants were refused although the edit was safe; (2) the TypeScript aligner was not idempotent in one pass when lines contain mid-line tabs — `--write` now repeats until stable (max 5 passes).
- T3.5 cost: `bun run check` takes ~19 s with the default mutation counts (1,000 per line-engine language, 5 TypeScript variants). Large runs: `XXX_MUTATIONS=20000` (~2 min, passed 140,000 variants), `XXX_TS_MUTATIONS=100` (~2 min, passed).
- T3.5 deviation: TypeScript runs 5 variants by default instead of 1,000, because each variant starts TypeScript 7 servers through the CLI. A pure in-process TypeScript alignment API would lift this (M3).
- Python on its official `tokenize` / `ast` (engine-level strengthening, moved out of M1.5 on 2026-09-28): revisit when verdicts show the regex profiler missing Python structure.
- `.tsx` is not covered by the TypeScript token check (JSX text whitespace is significant); decide before supporting TSX.
- The stress corpus uses OpenJDK (GPL with classpath exception): keep it for checks only, never copy snippets into fixtures (see design §5.2).
- Choose the final product name, then replace `xxx` / `XXX` in one pass.
- Choose a license before publishing.
- The rules for YAML/JSON (design §4.3, 3.4) need a horizontal-only safety rule before any implementation.
- N4 leftover: a multi-line object literal whose continuation lines align on the first property (hand-made sample, `00_normalize-imports.ts`) — not covered by the guard-row and subscript work; decide with M1.5 judging.
- `scripts/corpus-judge.ts` runs its CLI at module load (no `import.meta.main` guard), so `bun test` re-exports `TEST_COMPLETED/corpus/` on every run and fails when the census report is stale (seen in M1.7 P1).
