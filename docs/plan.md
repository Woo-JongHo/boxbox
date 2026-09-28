# Plan

The working plan for XXX. Product direction lives in [`design.md`](design.md); this file tracks **what we do next, in order, and how each step is verified**.

## Goal

**North star:** a readability plugin any coding agent can plug in, that aligns same-role code into readable tables and never changes behavior — learning from judged cases until it can safely change and generate code.

**Current milestone — M1 Safety proof (design §11 P0):** every automatic edit is *proven* safe in code, not just promised in prose.

M1 is done when:

- Every write path re-tokenizes and re-parses its output and refuses edits that change anything but inter-token whitespace.
- Automatic fixes never apply to fewer than 3 rows.
- Go alignment is off by default.
- Both engines emit one versioned `Result` JSON.
- `bun run check` is green and the repository passes its own checker.
- `design.md` §10 shows these rows as **Exists**.

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
| T6 | Shared `Result` JSON | ▶ active |
| T7 | Close M1 | ⬜ todo |

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

## M1.5 — Test foundation (after M1, before M2)

Why: today's tests prove safety, not quality. Goldens were produced by the engine itself, seven languages have two hand-written files of about 100 lines each, and no real code has been judged by a person (review 2026-09-28).

| # | Task | Status |
|---|---|---|
| F1 | Language × region × construct fixture matrix | ⬜ todo |
| F2 | Verdict status in TEST_COMPLETED | ⬜ todo |
| F3 | Pinned real-code slice for review | ⬜ todo |
| F4 | Edge inputs: CRLF, BOM, large files, Rust parser | ⬜ todo |
| F5 | Swift (light) | ⬜ todo |
| F6 | Kotlin (light) | ⬜ todo |
| F7 | Python on the official tokenizer and AST | ⬜ todo |

**Language tiers (user decision 2026-09-28):** TypeScript and Python are the strongest, most hardened languages. Java, Go, Rust, JavaScript, C, C++, Kotlin and Swift stay light: current fixtures plus the safety net (token check, re-parse, mutation tests); deep work waits.

| Tier | Languages | F1 matrix | F3 real code | New layout features |
|---|---|---|---|---|
| Strong | TypeScript, Python | all regions 01–04 | yes, judged | first |
| Light | Java, Go, Rust, JavaScript, C, C++, Kotlin, Swift | list of supported forms only | later | later |

- **F1:** `fixtures/<language>/<region>/<construct>/` with `input`, `expected` and `case.json` (approver, date, rule id, or "refused by design"), following the rule taxonomy (design §4.3). A generated coverage table per language: constructs that exist in the language, covered, deliberately unsupported.
- **F2:** `SUMMARY.txt` marks each result `approved` or `unjudged`; only user-approved expectations count as goldens. Existing goldens start as `unjudged`.
- **F3:** 3–5 permissively licensed repositories per language pinned by commit SHA (subset of design §5.2), aligned results sampled into `TEST_COMPLETED/corpus/<language>/` for review; nothing from them is committed except the manifest.
- **F5 Swift / F6 Kotlin** (added 2026-09-28 at the user's request), built directly on the F1 structure: a `CodeSyntax` that handles nested block comments (`/* /* */ */`), multi-line strings (`"""`), Swift raw strings (`#"…"#`) and interpolation with nested strings (`\(…)`, `${…}`) — a masking extension that the mutation tests must cover; a profile per region; fixtures and construct matrix; re-parse with `swiftc -parse` and `kotlinc` (not installed locally yet; CI installs both); mutation tests; discovery text in manifests, SKILL.md and the contract test.
- **F7 Python strong:** replace mask estimates with Python's own `tokenize` for the whitespace-only check (exact tokens, including f-strings and nested quotes), and group rows by `ast` structure like TypeScript's `01_group-regions`, so Python matches TypeScript's level of proof.
- **F4:** CRLF and BOM files, a multi-thousand-line file per language with a time budget, and `rustfmt` installed locally so Rust re-parse stops being skipped.

## Next milestones (detailed when they become active)

| Milestone | Design phase | Outcome |
|---|---|---|
| M2 Run-last | P0.5 | `xxx format` / `xxx check` wrapping one configured formatter; fixed-point tests |
| M3 Declarative registry | P1 | rule identity = language + context + kind + signature; five review states; value-cell sub-tables (below), including call-statement subject cells |
| M4 Corpus | P1.5 | pinned open-source manifest; L1 runner; L2 signatures; judged cases |
| M5 Rules and layers | P2 | `rules/<language>/<region>/` files; preset `recommended`; `.xxx/config.json` |
| M6 Learn | P3 | candidates from a repository; approve / reject |
| M7 Guide and feedback | P4 | agent rule generation; case recording; promotion gate |

### Queued for M3 — value-cell sub-tables (agreed 2026-09-28)

A declaration or assignment table whose value cells repeat a structure gets an inner table (contract rule 7). Two levels, each with its own condition:

| Level | Aligned | Condition |
|---|---|---|
| 1 — call | callee name (left), `(`, top-level argument `,`, `)` | the value cells — or the subject cells of call statements such as `expect(preservesTokens(a, b)).toBe(false)` — share callee, arity and tail (e.g. no `.stdout ?? ""` on only some rows), in 3+ rows |
| 2 — nested `[ ]` / `{ }` | inner `,`, closing `]` / `}` | only when the nested container is a data row whose positions play the same role; argv-like arrays whose positions differ in meaning stay compact (discarded rule 2) |

```ts
const alpha = spawnSync("bun" , ["run" , "a.ts"   ], options) ;
const beta  = spawnSync("node", ["exec", "b.js"   ], options) ;
const gamma = spawnSync("deno", ["run" , "long.ts"], options) ;
```

## Backlog

Findings outside the active task. Pull into a milestone when relevant.

- The `;` axis can pad short rows far past column 120 when one row is long (seen in `stress-corpus.ts` during T1, fixed there by extracting a duplicated expression). The checker should warn when alignment pushes a table past 120 columns, pointing to the contract's "simplify the exceptional element first" step.
- `scripts/stress-corpus.ts` still has ten lines over 130 columns that are not tables.
- Import tables are aligned from 2 rows (the pre-existing import rule), unlike other tables (3). Decide whether imports follow the 3-row floor in T4.
- Hand-made reference samples for M3 (2026-09-28, `00_normalize-imports.ts`): guard-row table (`if (…) { state = … ; … continue; }` with aligned condition cell, `{ … ;` and `continue`), subscript cells (`chars[index    ]!` / `chars[index + 1] ;`), and a multi-line object literal whose continuation lines align on the first property.
- Declaration tables (01.2 and 04.2): align `=` from 2 rows, let a multi-line declaration's first line join the `=` column, keep declarations and plain assignments apart (agreed 2026-09-28); inner `( )` `[ ]` `{ }` `;` cells follow the M3 sub-table rule, with the vertical form for outliers as in imports.
- T3: Rust re-parse is unverified locally (`rustfmt` not installed); CI installs it and runs with `XXX_REQUIRE_PARSERS=1`, but the workflow change is unverified until the branch is pushed.
- T3: the TypeScript re-parse gate starts two TypeScript 7 servers per written file (~0.3 s); fine for `--write`, revisit for bulk runs.
- T3.5 findings (fixed): (1) the preservation check treated trailing whitespace after a line comment as content, so 10–57 tables per 1,000 variants were refused although the edit was safe; (2) the TypeScript aligner was not idempotent in one pass when lines contain mid-line tabs — `--write` now repeats until stable (max 5 passes).
- T3.5 cost: `bun run check` takes ~19 s with the default mutation counts (1,000 per line-engine language, 5 TypeScript variants). Large runs: `XXX_MUTATIONS=20000` (~2 min, passed 140,000 variants), `XXX_TS_MUTATIONS=100` (~2 min, passed).
- T3.5 deviation: TypeScript runs 5 variants by default instead of 1,000, because each variant starts TypeScript 7 servers through the CLI. A pure in-process TypeScript alignment API would lift this (M3).
- `.tsx` is not covered by the TypeScript token check (JSX text whitespace is significant); decide before supporting TSX.
- The stress corpus uses OpenJDK (GPL with classpath exception): keep it for checks only, never copy snippets into fixtures (see design §5.2).
- Choose the final product name, then replace `xxx` / `XXX` in one pass.
- Choose a license before publishing.
- The rules for YAML/JSON (design §4.3, 3.4) need a horizontal-only safety rule before any implementation.
