# Plan

The working plan for XXX. Product direction lives in [`design.md`](design.md); this file tracks **what we do next, in order, and how each step is verified**.

## Goal

**North star:** a readability plugin any coding agent can plug in, that aligns same-role code into readable tables and never changes behavior — learning from judged cases until it can safely change and generate code.

**Current milestone — M1.5 data for TypeScript and Python.** M1.6 Nested tables is done 2026-09-28 (call layer, list layer, vertical outliers, guard rows and subscript cells, Python assigned calls).

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
| D2 | Signatures: group every aligned table into types | ⬜ todo |
| D3 | Judging in TEST_COMPLETED and verdict records | ⬜ todo |
| D4 | Learning: verdicts become cases, rules and registry changes | ⬜ todo |
| D5 | Measures: judged share, wrong-grouping rate, unseen types | ⬜ todo |
| D6 | Edge inputs: CRLF, BOM, large files, Rust parser | ⬜ todo |
| D7 | Swift and Kotlin (light) | ⬜ todo |

- **D1:** `corpus/manifest.json` (committed) pins permissively licensed repositories by commit SHA — TypeScript candidates: vscode, prisma, trpc, zod; Python candidates: requests, fastapi, pydantic, django — plus the user's private repositories as local-only sources (never committed). Sources are fetched into `~/.cache/xxx/corpus/`. Done 2026-09-28: `scripts/corpus-fetch.ts` materializes each source as a shallow worktree at the pinned commit (idempotent re-runs); private repositories go into gitignored `corpus/local.json` (same schema, merged, duplicate ids refused); `test/corpus.test.ts` validates the manifest and the gitignore entry without network. All eight sources verified fetched at their pinned commits; per-source `paths` fields scope future scanning.
- **D2:** every detected table gets a signature (language, container context, kind, ordered axis IDs, nesting, result state — design §6 L2); thousands of tables collapse into hundreds of types, ranked by frequency × risk.
- **D3:** representatives per type are exported to `TEST_COMPLETED/corpus/<language>/<type>/` (aligned file, original, context); the user judges each type: `correct`, `different-role`, `missing-kind`, `taste`, `unsure`. Verdicts are stored as records (`corpus/verdicts.jsonl`, committed; no third-party code in it). `SUMMARY.txt` shows `approved` / `unjudged` per result.
- **D4:** each verdict becomes a minimized, synthetic-identifier case under `fixtures/<language>/<region>/<construct>/` (the construct matrix grows from data, not by hand); `different-role` becomes a grouping rule, `missing-kind` a new kind, `correct` a pinned golden (design §7). The promotion gate keeps judged results from changing silently.
- **D5:** per language: share of tables in judged types, wrong-grouping rate from verdicts, share of types never seen before in a new repository.
- **D6:** CRLF and BOM files, a multi-thousand-line file with a time budget, `rustfmt` locally.
- **D7:** Swift and Kotlin as light languages — nested block comments, multi-line and raw strings, interpolation in the mask; re-parse with `swiftc -parse` / `kotlinc` (Kotlin in CI only); mutation tests; discovery text.

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
- T3: the TypeScript re-parse gate starts two TypeScript 7 servers per written file (~0.3 s); fine for `--write`, revisit for bulk runs.
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
