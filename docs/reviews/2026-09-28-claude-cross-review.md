# Cross-review of D1 (pinned corpus) and D2 (signature typing) — 2026-09-28

Reviewer: Claude (independent subagent, adversarial cross-verification with tool access; read-only over the
working tree). Author of the reviewed work: ZCode. Both tasks were verified by running the commands, not by
reading the claims: every pin was checked against its clone, licenses were read from the pinned checkouts, the
census was re-run at two cap levels, and one deterministic full-report diff was taken.

## Verdict (reviewer)

- **D1 — sound.** Every claim reproduced; no integrity issues.
- **D2 — sound with findings.** Mechanics, determinism and claims all check out; one real data-quality bug
  (symlinked directories visited twice, inflating the pydantic numbers) was found and has been fixed in this
  pass.

## Findings and disposition

| # | Severity | Finding | Verified | Disposition |
|---|---|---|---|---|
| 1 | medium | `walkFiles` followed symlinked directories with no dedup: pydantic's `tests/pydantic_core → ../pydantic-core/tests` made 73 of the 400 sample slots visit files twice, inflating the pydantic table counts and crowding out real files | Replicated the walk: 400 paths but only 327 distinct real files | Accepted. `walkFiles` now dedups by `realpathSync` and guards each entry with try/catch; report regenerated — the fixed run holds 8,093 tables in 197 types (pydantic 396 tables from 400 distinct files) |
| 2 | low | The census read a missing `manifest.json` as an empty source list and would overwrite a good report with an empty one; `corpus-fetch.ts` throws for the same condition | Read both implementations | Accepted. The census now throws on a missing manifest and validates `schemaVersion` |
| 3 | low | The census header claimed Python "scans its whole tree" — false: Python is capped by `--max-files` like TypeScript (django has 2,932 `.py` files, scanned 400) | Counted files with `find` | Accepted. Comment corrected |
| 4 | low | Number drift: commit message and plan cite the first 100-cap run (1,432 tables / 91 types) while the shipped report is the 400-cap default (7,985 tables / 194 types) | Ran both caps; verified every cited number | Accepted. plan.md now records both runs; the shipped artifact is the default run |
| 5 | low | The sorted-alphabetical walk with a per-source cap biases the sample toward files early in sort order; design §5.2 wants stratified sampling | Code read; all caps hit 400 | Deferred to D3 with an explicit note in the plan (stratified sampling; `call:*` representatives per callee) |
| 6 | low | Python context is always empty and depth is the first row's indent/4 — 2-space code collapses depth and class vs function bodies are not distinguished | Code read | Documented limitation; revisits when Python gains structure awareness (already in backlog) |
| 7 | nit | The duplicate-id refusal (manifest vs local.json) had no test | Read the fetcher and tests | Accepted. Merge extracted into `mergeSources`; refusal test added |
| 8 | nit | `call:*` deliberately merges callees the engine keeps apart, so a `call:*` representative may not represent the majority callee | Axis inventory + signature tests | Kept; noted for D3 per-callee sampling |
| 9 | nit | `collect()` probes `kind.containers(node)` twice per node (pure, no side effects) — redundant work, no correctness issue | Read implementations | Kept as is |
| 10 | nit | D1 commit carried a whitespace-only drive-by realignment of two test lines | `git show` | None |
| 11 | checked, OK | All 8 pins: clone HEAD equals manifest commit, origin URL equals repository, detached, shallow | `git rev-parse` / `remote get-url` per clone | — |
| 12 | checked, OK | Licenses at the pinned commits match the manifest (vscode MIT, prisma Apache-2.0, trpc MIT, zod MIT, requests Apache-2.0, fastapi MIT, pydantic MIT, django BSD-3-Clause) | LICENSE files read in the clones | — |
| 13 | checked, OK | Nothing third-party committed: `git ls-files corpus/` = manifest + README; `corpus/local.json` gitignored and absent from the index | `git ls-files`, `git check-ignore` | — |
| 14 | checked, OK | Fetch idempotence and failure semantics: 8× `current`, `failures=0`, exit 0; per-source catch, exit 1 on any failure. Note: `current` trusts HEAD alone — a mutated worktree is not detected | Ran the fetcher | Noted; considered for a future `git status --porcelain` check |
| 15 | checked, OK | Census determinism: the 400-cap rerun reproduced the report byte-for-byte | Diff of the report | — |
| 16 | checked, OK | Census math: score = count × edits; counts sum to tables; deterministic sort; ≤ 3 examples; `schemaVersion: 1`; no timestamps | JSON validation | — |
| 17 | checked, OK | Top-type locators all real at the cited lines (vscode `build/agent-sdk/package.ts`, requests `cookies.py`, the REFUSE examples) | Opened the cited lines | — |
| 18 | checked, OK | Signature tuple matches design §6 L2; state classification consistent with the CLI; one known per-group vs combined-gate divergence exists equally in the CLI check-mode report | Engine code read | — |
| 19 | checked, OK | Server-leak fix: `loadSourceFile` closes in `finally`, census closes per source, CLI guarded by `import.meta.main`; AST-after-close works (typescript-align 25 pass) | Diff + tests | — |
| 20 | checked, OK | Standing gates green: 200 pass / 3 skip (rust parser absent) / 0 fail; tsc clean; `bash -n install.sh` clean | `bun run check` | — |

## Measured numbers

- corpus-fetch: 8× `current`, `files=8 failures=0`, exit 0.
- Census `--max-files 100`: 1,432 tables / 737 files / 91 types — every number in the commit message and plan
  reproduced exactly (7.2 s).
- Census `--max-files 400`: vscode 3,108 / prisma 645 / trpc 823 / zod 2,638 / requests 48 / fastapi 43 /
  pydantic 288 / django 392 tables = 7,985 tables, 194 types — byte-identical rerun.
- typescript-align 25 pass; `bun run check` 200 pass / 3 skip / 0 fail.

## Disagreement

None. The reviewer's only process note: the review brief incorrectly said a `--max-files 100` rerun should
reproduce the shipped report — the shipped report embeds `maxFiles: 400`; a 100-run correctly reproduces the
first-run numbers instead.
