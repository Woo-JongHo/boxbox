# BoxBox Charter

Status: confirmed (M1.8 S1) · Date: 2026-09-30

This document is **layer 0** of the five normative layers. Grammar (layer 1), surface forms (layer 2), conventions (layer 3) and the example book (layer 4) all sit below it, and when they conflict with this document, this document wins. Only maintainers may change it.

## Core (generating source)

The three lines below are copied verbatim to the top of `SKILL.md` and into the marked section of a user repository's `AGENTS.md`. When the wording changes, the copies must change with it (pinned by a test in M1.8 S7).

<!-- boxbox:core:begin -->
1. Write same-role code in the same pattern. Code is language.
2. Simplify first, align second. Never cover a reducible difference with whitespace.
3. Fix automatically only whitespace, and only when certain. Suggest everything else.
<!-- boxbox:core:end -->

## 1. Principle — readability

Let the reader follow the flow from top to bottom and compare same-role code vertically. Every rule in this product exists for this one sentence.

## 2. Values — code is language

- Code is made of **words** (names), **sentences** (one line's declaration, call or condition), **paragraphs** (groups of sentences with one purpose) and **texts** (files).
- Write same-role sentences in **the same pattern**. Uniformity does not mean fitting every line to the longest one; it means giving the same role **the same minimal composition**.
- Symbols such as `=`, `:`, `from` and `(` are **particles** that mark roles inside a sentence. Alignment lines up the particles of the same pattern vertically so the reader can scan roles column by column.
- The same grammar serves both **guiding what gets written** (GUIDE) and **checking it** (REVIEW). The two must never look at different standards.
- We also know the limits of this metaphor. Understanding code relies mainly on reasoning, not on language ability. So patterns are defined by **role**, not by English word order, and the goal is to reduce the reader's reasoning load.

## 3. Identity — a deterministic program

- boxbox is a **deterministic program**, and the agent plugin is a channel that calls it. Rules are set by the program and by human approval, not by an agent's judgment.
- So it has what a program needs: a version, a config schema, exit codes, and a CLI that runs without an agent (CI, hooks, editors).
- Users can change **conventions** (layer 3) and **examples** (layer 4) to their taste. **Invariants** (section 5) can be changed by no one. Users write only one file themselves, the config; everything else is written by tools and approved by people.

## 4. Order — simplify first, align second, verify always

*Simplify first. Align second. Verify always. — Follow the structure. Don't force it.*

- Alignment is not the goal. A structure lengthened by an exceptional element is first removed, wrapped inward or normalized.
- Only real, irreducible information is accepted as cell data and aligned at minimum width.
- Covering a reducible difference with whitespace alignment, or letting whitespace pull semantic units apart, is a failure.

## 5. Invariants — unchangeable and not configurable

An attempt to turn off any item in this list through configuration is not silently ignored; it is a schema error. An item with an empty "enforced at" exists only as a documented promise, and moving it into code is roadmap work.

| # | Invariant | Enforced at |
|---|---|---|
| 1 | **Only whitespace changes.** Automatic fixes touch only spaces, tabs and line breaks. Non-whitespace tokens, strings and comments must be byte-identical | `common/preservation.ts`, `typescript/token-preservation.ts`, `test/mutation.test.ts` |
| 2 | **Output is re-parsed.** A fix is written only when the language's official parser rereads it with the same diagnostics | `common/parse-check.ts`, `typescript/06_align-tables.ts` |
| 3 | **When uncertain, do not touch.** `REFUSE` when it cannot be split losslessly, `UNCERTAIN` when classification is ambiguous. A missed fix is better than a wrong fix | `REFUSE`: across the engine · `UNCERTAIN`: not implemented |
| 4 | **Automatic fixes only for 3+ rows.** Two-row pairs are only suggested. The only exceptions are user-approved `=` declaration tables and imports | `common/table-engine.ts`, `typescript/grid-kinds.ts` `minRows` |
| 5 | **Idempotent.** Running twice gives the same result | per-language alignment tests (`test/lang-harness.ts`) |
| 6 | **Only relative placement is stored.** Width is always the minimum that table needs, and tables never share widths | `common/table-engine.ts` |
| 7 | **Deterministic.** The same input and config give the same result. There is no LLM and no similarity search on the check/fix path. An LLM is used only to read guidance or to pre-sort the review queue | design rule (no reproduction test) |
| 8 | **Only humans approve.** Evidence never becomes a rule by itself. Agents only investigate and propose | read-only agents: `test/plugin-contract.test.ts` · approval flow: not implemented |
| 9 | **Layer priority:** safety > project > user > preset > base. Nothing overrides safety | not implemented (M1.8 S3–S5) |
| 10 | **Single source, thin adapters.** The engine, grammar and conventions live in one place; hosts differ only in install location and manifest. The result JSON and pattern keys are versioned public contracts | `common/result-json.ts`, `common/signature.ts` |
| 11 | **Runs last, after the formatter.** The canonical form of a file is `boxbox(formatter(file))`, and rerunning must not change it | not implemented (M2) · Go is off by default: `go/06_align-tables.ts` |

## 6. What this document does not do

- It does not define concrete patterns, roles or rules → grammar (`grammar.md`), conventions (`presets/`, `.boxbox/rules/`).
- It does not list the order in which tools are called → `SKILL.md`.
- It does not describe the product structure or roadmap → `docs/development/design.md`.

## 7. How to change it

1. First write the reason and evidence for the change in `docs/development/plan.md`.
2. A maintainer approves it.
3. When an invariant changes, change the code and tests that enforce it in the same change.
4. When the three core lines change, change the copies (`SKILL.md`, the marked section of the user's `AGENTS.md`) in the same change.
