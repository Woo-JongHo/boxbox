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
| T2 | Token-stream preservation | ▶ active |
| T3 | Output re-parse | ⬜ todo |
| T3.5 | Mutation tests | ⬜ todo |
| T4 | 3-row floor for fixes | ⬜ todo |
| T5 | Go alignment off by default | ⬜ todo |
| T6 | Shared `Result` JSON | ⬜ todo |
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

### T3 — Output re-parse

- **Scope:** after alignment, parse input and output with the language's official parser and require the same diagnostics. TypeScript uses the bundled `typescript@7`. Other languages use their toolchain when present — Python `ast.parse`, `gofmt -e`, `javac`, `clang -fsyntax-only`, `node --check`, `rustc` (not installed locally; CI installs it) — and the harness marks the check as skipped, never passed, when a toolchain is missing.
- **Accept:** every golden fixture's output parses with unchanged diagnostics; CI runs all eight parsers.
- **Verify:** `bun test` locally (skips listed explicitly); CI log shows no skips.

### T3.5 — Mutation tests

Generate thousands of variants from the existing fixtures and prove the invariants hold on each. Local compute only.

- **Scope:** a seeded, deterministic mutator per language: random spacing and tabs between tokens, separators (`:` `=` `;` `,` `//` `#`) injected inside strings, comments inserted between rows, CJK and emoji in strings and comments. For every variant: token-stream preservation (T2), idempotence, and re-parse (T3) where the toolchain exists. Failures are minimized and saved as regression fixtures.
- **Accept:** at least 1,000 variants per language run in `bun test` under a time budget (seed fixed; a larger run is available via an environment variable); zero invariant failures, or every failure fixed and pinned as a fixture.
- **Verify:** `bun test`; `XXX_MUTATIONS=20000 bun test test/mutation.test.ts`.

### T4 — 3-row floor for fixes

- **Scope:** the line engine floors `minRows` at 2 (`Math.max(2, …)` in `table-engine.ts`); change the floor for **fixes** to 3. Two-row groups are only reported as pairs. The `--min-rows 2` promotion path in SKILL.md and the pilot doc is replaced by "record a human Decision" (implemented later in M4; until then pairs are report-only).
- **Accept:** `--min-rows 2 --write` does not change a 2-row group in any language; docs no longer advertise `--min-rows 2` as a fix path.
- **Verify:** `bun test`; `grep -rn "min-rows 2" skills docs` shows only the new wording.

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

## Next milestones (detailed when they become active)

| Milestone | Design phase | Outcome |
|---|---|---|
| M2 Run-last | P0.5 | `xxx format` / `xxx check` wrapping one configured formatter; fixed-point tests |
| M3 Declarative registry | P1 | rule identity = language + context + kind + signature; five review states; value-cell sub-tables (below) |
| M4 Corpus | P1.5 | pinned open-source manifest; L1 runner; L2 signatures; judged cases |
| M5 Rules and layers | P2 | `rules/<language>/<region>/` files; preset `recommended`; `.xxx/config.json` |
| M6 Learn | P3 | candidates from a repository; approve / reject |
| M7 Guide and feedback | P4 | agent rule generation; case recording; promotion gate |

### Queued for M3 — value-cell sub-tables (agreed 2026-09-28)

A declaration or assignment table whose value cells repeat a structure gets an inner table (contract rule 7). Two levels, each with its own condition:

| Level | Aligned | Condition |
|---|---|---|
| 1 — call | callee name (left), `(`, top-level argument `,`, `)` | the value cells share callee kind, arity and tail (e.g. no `.stdout ?? ""` on only some rows), in 3+ rows |
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
- The stress corpus uses OpenJDK (GPL with classpath exception): keep it for checks only, never copy snippets into fixtures (see design §5.2).
- Choose the final product name, then replace `xxx` / `XXX` in one pass.
- Choose a license before publishing.
- The rules for YAML/JSON (design §4.3, 3.4) need a horizontal-only safety rule before any implementation.
