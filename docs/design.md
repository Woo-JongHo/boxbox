# XXX — Design

Status: Draft
Date: 2026-09-28
Working name: **XXX** (temporary; the final name will be applied in one rename pass)

## 1. Summary

XXX is a code readability plugin that aligns code into a readable, table-like layout.

- It is **agent-agnostic**: any coding agent (Claude Code, Codex, ZCode, Pi, or a plain rules file) can plug it in. The engine and data live in one place; hosts get thin adapters.
- **Current phase: learn and harden.** We collect evidence from real code, find where the engine is wrong, and turn every verdict into a permanent test or registry entry.
- **End state:** learned, approved cases drive two paths:
  - **Change** — a deterministic engine rewrites whitespace only.
  - **Generate** — agents receive a guide built from approved conventions and write code in the right shape from the start.
- **Customization:** after installation, users have a dedicated project space (`.xxx/`) for their own requirements. The author's convention ships as a read-only preset.

Philosophy: **Simplify first. Align second. Verify always.** — *Follow the structure. Don't force it.*

### What XXX is not

- Not a formatter that normalizes all whitespace (Prettier, rustfmt, black).
- Not an AI refactoring tool. No LLM sits on the review/fix path.
- Not a column-alignment switch like clang-format's `AlignConsecutive*` or gofmt's struct alignment. Those group rows by syntax only. XXX groups rows by **role**, checks for simplification before aligning, and refuses when it is not sure.

## 2. Invariants (never change, never configurable)

1. **Whitespace-only edits (XXX stage).** XXX's own automatic changes touch spaces, tabs and line breaks only. The non-whitespace token stream, parseability and idempotence are preserved and **proven per edit**: the output is re-tokenized and re-parsed with the language's official parser before it is written (see §10: not implemented yet). Changes made by the project's formatter in `xxx format` are the formatter's, not XXX's. Simplification and type cleanup are `SUGGEST` only.
2. **When unsure, do not touch.** Uncertain decomposition yields `UNCERTAIN` or `REFUSE`. A missed fix is always better than a wrong fix.
3. **Fixed pipeline order.** Parse → Mask → Classify → Group → Lookup → Compare → Safety → Result. Simplification review comes before alignment; never align then refactor.
4. **Relative layout only.** Conventions store slots, anchors and spacing relations — never absolute columns. Width is the minimum the current group needs. Groups never share widths.
5. **Layer precedence.** Safety > Project > User > Preset > Base. Nothing overrides Safety.
6. **Only humans approve.** Evidence never auto-promotes into a convention. Agents inspect and propose only.
7. **Deterministic decisions.** Same input and config → same result. LLMs are used only to consume guides and to pre-triage review queues.
8. **Single source, thin adapters.** Engine, registry and cases live in this repository. Hosts differ only by install location and manifest. The result JSON schema is versioned as a public contract.
9. **XXX runs last.** XXX is the final pass after the project's code formatter. The canonical form of a file is `C(file) = xxx(formatter(file))`, and it must be a fixed point: `C(C(file)) == C(file)`. The ordering is guaranteed only through the `xxx format` / `xxx check` wrapper, which runs the formatter itself (see 3.5).

## 3. Architecture

### 3.1 Modes

| Mode | Question it answers | Output |
|---|---|---|
| **LEARN** | How does this repository write same-role code? | Evidence + convention candidates |
| **GUIDE** | How should an agent write new code here? | Rule text rendered from approved conventions only |
| **REVIEW** | Does this code satisfy the current conventions? | Per-group result state, optional whitespace fix |

```text
Existing code → LEARN → Evidence → Candidates → Human approval → Registry
                                                                  ↙      ↘
                                                              GUIDE     REVIEW
                                                                ↓          ↓
                                                    Agent writes code → Result → new Evidence
```

Review results feed Evidence, never the Registry directly.

### 3.2 Layers

```text
Safety    built-in, not overridable
Project   <repo>/.xxx/                 user-owned, committed
User      ~/.config/xxx/               optional personal defaults
Preset    <plugin>/presets/<name>/        shipped with the plugin, read-only (e.g. "recommended")
Base      <plugin>/base/                  language grammar knowledge, no taste
```

- **Base** knows what structures exist per language (kinds, slots, masking rules).
- **Preset `recommended`** is the author's opinionated convention. Today it is mixed into `references/readability-contract.md` and must be split out.
- **Project** holds user overrides and project conventions learned by LEARN and approved by the user.

### 3.3 Review states

| State | Condition |
|---|---|
| `PASS` | Group satisfies the approved convention |
| `FIXABLE` | Misaligned, lossless decomposition succeeded, output re-parses, ≥ 3 rows, kind approved. Automatic fixes never apply to fewer than 3 rows, regardless of `--min-rows` |
| `SUGGEST` | Kind is only a candidate, the group is a 2-row pair (a pair becomes a table only through an explicit human approval, recorded as a Decision), or the check is advisory (condition wrapping, simplification, type uncertainty) |
| `UNCERTAIN` | Rows decompose, but classification is ambiguous between kinds |
| `REFUSE` | Lossless decomposition failed |

`UNCERTAIN` and `REFUSE` are normal outcomes, not failures. Every command supports `--json`.

### 3.4 Engines

- **TypeScript:** AST (TypeScript compiler API) + LSP.
- **JavaScript, Python, Java, Go, Rust, C, C++:** a shared line engine with string/comment masking plus a per-language profile.
- Both engines must produce the same `Result` model.

### 3.5 Formatter coexistence — XXX runs last

**Decision:** XXX overrides the formatter. It is not a formatter plugin and does not negotiate with one; it runs **after** the formatter and its output is final.

Most projects run a code formatter (Prettier for JS/TS/JSON/YAML, black for Python, rustfmt for Rust, gofmt for Go, clang-format for C/C++). Prettier, black and rustfmt remove vertical alignment; gofmt applies its own. If a formatter runs after XXX, alignment is lost; if XXX runs after a formatter check, that check fails. So the order is fixed:

```text
source → formatter (normalizes everything else) → XXX (final pass) → canonical form
```

Rules that follow from this:

- **Canonical form.** A file is correct when `file == xxx(formatter(file))`. `xxx check` computes exactly that; `xxx format` writes it.
- **Fixed point is tested, not assumed.** AST-reprinting formatters (Prettier, black, rustfmt) ignore existing horizontal spacing, so `formatter(xxx(y)) == formatter(y)` is expected — but alignment can lengthen lines and change a formatter's wrapping decision. Every supported formatter gets a fixed-point test on the corpus: `C(C(x)) == C(x)`, and `xxx check` fails loudly if it does not hold for a file.
- **Per-file pipeline.** Monorepos run different formatters per package. The resolved pipeline is recorded per file: package root, formatter command and arguments, and a formatter version fingerprint. A fingerprint change invalidates cached results. The MVP starts with **one explicitly configured formatter**; auto-detection only suggests it.
- **XXX replaces direct formatter calls.** Format-on-save, git hooks and CI call `xxx format` / `xxx check`, which invoke the project's formatter internally, then apply XXX. Calling the formatter alone afterwards (for example `prettier --check` in CI) will report every aligned file — that step must be replaced by `xxx check`.
- **Formatter detection.** `xxx init` and `xxx doctor` detect formatter configs (`.prettierrc*`, `prettier` in `package.json`, `pyproject.toml [tool.black]`, `rustfmt.toml`, `.clang-format`, Go modules) and print the exact hook/CI changes needed. XXX never edits those configs silently.
- **Safety is measured against formatter output.** The whitespace-only invariant compares XXX output with the formatter's output, not with the original file. `xxx format` reports formatter changes and XXX changes separately.
- **No formatter is also supported.** Without a detected formatter, the formatter step is the identity.
- **Go is the exception.** gofmt alignment is enforced by the whole Go toolchain and ecosystem (`gofmt -l` in CI is near universal). **The current Go aligner is not gofmt-stable**: `gofmt -d` on `fixtures/go/tables.aligned.go` rewrites indentation (spaces → tabs) and removes import-alias alignment (verified 2026-09-28). Therefore Go alignment is **off by default**. It returns only as a subset proven stable under gofmt by a fixed-point test; full override stays an explicit opt-in.
- **This must be stated up front** in the README install section and printed by `xxx init`: *"XXX runs after your formatter and overrides its layout. Replace direct formatter calls in editor, hooks and CI with `xxx format` / `xxx check`."*

## 4. Data model

Three separate records. Mixing them would let a re-run of LEARN overwrite approvals.

| Record | Meaning | Written by | Stored |
|---|---|---|---|
| `Convention` | What is enforced | Human approval | `.xxx/conventions.json` (committed) |
| `Evidence` | Where it was observed | LEARN / REVIEW, regenerated | `.xxx/cache/` (ignored) |
| `Decision` | Who approved or rejected what, and why | Human, append-only | `.xxx/decisions.jsonl` (committed) |

### 4.1 Convention

Identity is `(language, container context, kind, signature, scope)`. The same syntax kind can play different roles depending on where it sits (interface vs type literal vs class; array element vs top-level object), so the container context and the row signature (ordered axis IDs) are part of the key. `region` (§4.3) and `role` are tags, not part of the key; roles are hard to infer and are optional human labels.

```jsonc
{
  "id": "ts.declaration.src-application",
  "language": "typescript",
  "kind": "declaration",
  "scope": "src/application/**",
  "role": "service registrations",          // optional label
  "status": "approved",                     // observed | candidate | approved | rejected | deprecated
  "slots": [                                // ordered; replaces separate cells/anchors/alignment
    { "cell": "keyword" },
    { "cell": "identifier", "align": "left" },
    { "anchor": ":", "spacing": "gap" },     // gap: at least one space, padded to group max
    { "cell": "type", "align": "left" },
    { "anchor": "=", "spacing": "gap" },
    { "cell": "expression" },
    { "anchor": ";", "spacing": "insert" }   // insert: keep attached, never widen
  ],
  "grouping": { "contiguous": true, "minRows": 3 },
  "exceptions": ["multiline-expression", "generic-complexity"],
  "padding": "spaces"                        // spaces only today; "tabs" is planned, not implemented
}
```

Width is always `minimum-required`; it is an invariant, not a field.

### 4.2 Evidence

No opaque numeric confidence. Evidence is explainable counts:

```jsonc
{
  "conventionKey": ["typescript", "declaration", "src/application/**"],
  "groups": 160,
  "aligned": 142,
  "recent": { "windowDays": 90, "groups": 40, "aligned": 38 },
  "samples": [
    { "repo": "org/app", "commit": "a1b2c3d", "path": "src/application/run.ts", "lines": "12-18", "hash": "sha256:…" }
  ],
  "observedAt": "2026-09-28T00:00:00Z",
  "tools": { "engine": "0.2.0", "parser": "typescript@7.0.2", "formatter": "none" },
  "conflicts": [ { "variant": "unaligned", "groups": 18, "recent": 2 } ]
}
```

Every sample carries provenance (repository, commit, path, content hash), and every Evidence record carries the tool versions that produced it, so results can be reproduced and invalidated when a tool changes. `conflicts` keeps competing conventions side by side instead of collapsing them into one number.

Recency exposes the "frequent but legacy" problem: when old and recent code disagree, the candidate is flagged as a conflict.

### 4.3 Rule taxonomy

Regions are an **orthogonal tag** that organizes rule files, the GUIDE output and configuration keys. The engine decides by rule identity (§4.1: language + container context + kind + signature), never by region. Regions nest in real code — a registration object is data whose values are units, and a function body contains declaration-like tables — so one kind may carry different region tags in different contexts. Three kinds of content are deliberately kept apart even inside one region: **layout rules** (engine-enforced), **judgment rules** (guidance), and the **safety invariants** of §2 (not rules at all — never configurable).

| Region | Sub-area | Examples | Automation |
|---|---|---|---|
| **00 Common** | 0.1 Table formation | 3+ contiguous same-role rows, blank lines and comments break tables, minimum width, no cross-table widths | FIX |
| | 0.2 Trailing notes | `//` column alignment, no padding of note text | FIX |
| | 0.3 Naming | role-revealing names, no cryptic abbreviations | GUIDE |
| | 0.4 File reading order | public feature → individual processing → conversion | GUIDE |
| **01 Declarations** | 1.1 Module imports | `import`, `import type`, `#include`, `use`, Go `import ( )` | FIX |
| | 1.2 Top-level constants | `const`, `#define`, `static final`, Go `const ( )` | FIX |
| | 1.3 Type aliases | `type X =`, `typedef`, `using` | FIX |
| **02 Shapes** | 2.1 Record fields | interface members, class fields, struct fields, dataclasses | FIX |
| | 2.2 Enumerations | enum members, Rust enum variants | FIX |
| | 2.3 Contracts | method signatures, Port interfaces, traits (JSDoc, optional, lifecycle mix — most conservative) | CHECK |
| **03 Data** | 3.1 Key-value rows | object literals, dicts, maps | FIX |
| | 3.2 Positional rows | array/tuple rows, initializer lists | FIX |
| | 3.3 Registration tables | key → function/constructor dispatch (rows follow data rules, values follow unit rules) | CHECK |
| | 3.4 Config files | JSON, YAML (horizontal alignment only; indentation and block scalars are never touched), TOML | FIX |
| **04 Units** | 4.1 Function skeleton | signatures, parameters, return, function map | SUGGEST |
| | 4.2 Local computation | consecutive declarations and assignments inside bodies | CHECK |
| | 4.3 Branching | guards, early return, condition chains, switch/case, match | SUGGEST |
| | 4.4 Call flow | consecutive calls, chains, await sequences, test assertions | CHECK |
| | 4.5 Absence and type uncertainty | `?`, `null`, `undefined`, `!`, `as` | SUGGEST |
| | 4.6 Structural simplification | exceptional elements, binding constant parameters | GUIDE |

Automation levels: **FIX** (whitespace fixed automatically), **CHECK** (checked, a person confirms the fix), **SUGGEST** (found via AST, proposal only), **GUIDE** (authoring-time guidance only). A sub-area moves up a level only through the promotion gate in section 7. Units are "solid" by never fixing wrongly and by guiding authoring well — not by fixing much.

### 4.4 Rule files

One rule per file: machine-readable frontmatter, human/agent-readable body. Layout rules are enforced from their frontmatter (the engine reads it; prose never drifts from the checker). Judgment rules are guidance and surface in REVIEW as `SUGGEST` at most.

```markdown
---
id: ts.declaration-equals
region: "01.2"
type: layout            # layout | judgment
enforced_by: align      # none for judgment rules
language: typescript
kind: declaration-equals
axes: { gap: [colon, equals, semicolon], insert: [comment] }   # registry axis IDs, never raw tokens
min_rows: 3
status: approved
---

Contiguous declarations with the same role form one table ...
```

Layout: `rules/<language>/<region>/<id>.md` in Base and presets; project rules in `.xxx/rules/`. `references/readability-contract.md` becomes an index generated from these files.

## 5. Learning data

### 5.1 What open source teaches — and what it does not

Open-source code teaches **correctness**, not **taste**.

| Use | What we get | Where it goes |
|---|---|---|
| Robustness | Traps where the engine breaks (strings, comments, macros, generics) | Safety, engine |
| Kind catalog | Structures that actually repeat per language | Base kind registry |
| Prior distribution | Which kinds are commonly aligned in the wild | Base defaults (on/off) |

Taste comes only from the user's own repository (Project conventions) or from a preset.

### 5.2 Corpus

- **Selection:** 15–20 repositories per language across domains. Files are stratified by kind coverage, not by length (the current "longest 5 files" sampling is biased toward generated code and giant tables).
- **Contrast:** include code with an alignment culture (Go via gofmt, Linux kernel `#define` and designated-initializer tables, hand-aligned by tabs) and code without one (rustfmt, black).
- **Reproducibility:** `corpus/manifest.json` pins repository, commit SHA, license and paths. Source is fetched into `~/.cache/xxx/` on demand and never committed.
- **Licensing:** MIT / Apache-2.0 / BSD only. Fixtures derived from the corpus are minimized and use synthetic identifiers; original source is never stored in this repository.

## 6. Review funnel

Humans cannot read the whole corpus. Machines filter; humans judge representatives.

```text
Hundreds of thousands of groups
  │ L1  Machine invariants (100%, no human)
  │ L2  Signature dedup → a few hundred distinct signatures
  │ L3  Agent pre-triage (proposes labels only)
  ▼ L4  Human verdict (1–3 representatives per signature)
```

- **L1 invariants:** non-whitespace tokens identical (compared as a token stream from the language tokenizer, not by stripping whitespace), idempotent, still parses with the language's official parser (`tsc`, `go/parser`, Python `ast.parse`, ...). Any failure is an engine bug and becomes a regression test directly. The parser and tokenizer checks are not implemented yet (§10) and are the first P0 item.
- **L2 signature:** `(language, container context / AST path, kind, ordered axis IDs, nesting depth, result state)`. Same-kind rows can play different roles, so container and nesting are part of the signature. Priority = frequency × risk (large `FIXABLE` diffs first). High-risk signatures (large diffs, deep nesting, units region) are never reduced to 1–3 representatives; they are sampled proportionally.
- **L3 agent triage:** labels "same role / different role / unsure" as proposals. Track agent–human agreement; only consider skipping review for low-risk signatures with proven agreement.
- **L4 human verdict:** the maintainer first, contributors via pull requests after release. The question is **"is this transformation safe and are these rows the same role?"** — never "is it pretty". Taste questions produce inconsistent labels.
- **Review UI:** local CLI + local HTML page (before/after diff, verdict buttons: `correct`, `different-role`, `missing-kind`, `taste`, `unsure`). A shared web review page is deferred until after public release.

## 7. From verdict to structure

| Verdict | Change | Test left behind |
|---|---|---|
| L1 invariant violation | Engine (`code-text`, `table-engine`) | Minimized regression fixture |
| `different-role` | Grouping boundary (profile / kind registry) | Trap fixture: must not align |
| `missing-kind` | New kind with slot definition | Golden fixture |
| `correct` | None | Representative pinned as golden |
| `taste` | Not Base; at most a default on/off signal | None |
| `unsure` | Must classify as `UNCERTAIN` | State assertion |

Pipeline: verdict → case (minimized, synthetic identifiers) → fixture → registry or engine change → gate → merge.

**Promotion gate** (CI, for any change to Base):

1. All existing cases pass.
2. Zero L1 invariant violations across the corpus.
3. A corpus diff report is attached: counts of groups whose state changed, by direction (`FIXABLE→REFUSE`, `PASS→FIXABLE`, ...).
4. Any change to the result of an already-judged signature fails the gate.

Prefer data over code: kinds and slots are declarative registry data; parsing and masking are code; verdicts are cases. Today rules are embedded in `grid-kinds.ts` and each `profile.ts`; moving them into a declarative registry is part of P0/P1.

## 8. Customization

The author's convention is a preset, not the law. Users customize without touching the plugin directory (marketplace caches are read-only and updates would erase edits).

### 8.1 Project space

```text
.xxx/
  config.json         committed — extends + overrides
  conventions.json    committed — approved project conventions
  decisions.jsonl     committed — approval history
  cases/              committed — user-judged cases
  cache/              ignored   — evidence, candidates, review queue
```

```jsonc
// .xxx/config.json
{
  "extends": "recommended@1",                                  // preset pinned by major version
  "rules": {
    "typescript/case-clause": "off",
    "typescript/declaration": { "anchors": [":", "="] },
    "*": { "padding": "tabs" }
  },
  "scopes": {
    "test/**": { "rules": { "*": "off" } }
  }
}
```

### 8.2 Behavior

- **Zero-config works.** Without `.xxx/`, the default preset applies.
- **`xxx init`** creates `.xxx/`, writes `extends`, and adds `.xxx/cache/` to `.gitignore`.
- **Overridable:** kind on/off, anchor selection, scope, minimum rows, maximum width, tab/space padding.
- **Not overridable:** every invariant in section 2. Attempts are schema errors, not silent no-ops.
- **Preset pinning:** a plugin update never silently changes results. Moving to `recommended@2` goes through `xxx review --preset recommended@2 --diff`.
- **`xxx config --explain <file>:<line>`** shows the effective rule for a line and which layer it came from.
- **`xxx eject`** (optional) copies the preset into `.xxx/` for full ownership, giving up preset updates.
- Caches (corpus clones, parse caches) live in `~/.cache/xxx/`, never in temp directories and never in the plugin folder.

## 9. Agent integration

- A single CLI entry point: `xxx <init|learn|review|guide|approve|reject|config>`. Skills and agents are thin wrappers that call it.
- **GUIDE** renders only approved rules relevant to the files being edited and writes them between markers in `AGENTS.md`, a `SKILL.md` reference, or another rules file.
- The read-only inspector agent (`agents/readability-inspector.md`, `codex/readability-inspector.toml`) stays read-only; only the main agent edits, and only humans approve.

## 10. Mapping to the current code

| Design element | Current code | Status |
|---|---|---|
| Base kinds and slots | `scripts/<lang>/profile.ts`, `scripts/typescript/grid-kinds.ts` | Exists, as code |
| Gap / insert spacing | Contract "authoring axis contract" section | Exists, in prose |
| Group detection | `01_group-regions.ts`, `common/table-engine.ts` | Exists |
| REVIEW | `06_align-tables.ts` check mode, `--explain` | Partial (3 states) |
| REFUSE | Lossless decomposition failure | Exists |
| Type uncertainty | `02_audit-type-uncertainty.ts`, `03_audit-optional-types.ts` | Exists (TS) |
| Token-stream preservation | `common/preservation.ts` (line engine, mask-based: indentation, string/comment bytes, token joins) and `typescript/token-preservation.ts` (TypeScript scanner); unsafe tables are refused and reported as `refused=` | Exists (M1 T2) |
| Mutation tests | `test/mutator.ts`, `test/mutation.test.ts`: seeded variants (re-spacing with tabs, separators/CJK/emoji inside strings and comments, inserted comments) per line-engine language; TypeScript through the CLI. Checks whitespace-only output, no refusal, idempotence and sampled re-parse; failures are minimized | Exists (M1 T3.5) |
| Output re-parse | `common/parse-check.ts` (python3 `ast`, `gofmt -e`, `node --check`, `clang`/`clang++ -fsyntax-only`, `javac`, `rustfmt`) gates every line-engine `--write`; `06_align-tables.ts` compares TypeScript 7 syntactic diagnostics before and after writing and restores on mismatch. Missing parsers report `skipped`; CI sets `XXX_REQUIRE_PARSERS=1` | Exists (M1 T3) |
| Minimum 3 rows for fixes | `table-engine.ts` floors `minRows` at 2; CLI default is 3 | Partial |
| Go gofmt stability | Go alignment is report-only by default; `--enable-go` opts in (M1 T5). A gofmt-stable subset is still to be built | Partial |
| Preset `recommended` | `references/readability-contract.md` | Mixed with Base |
| GUIDE | Handwritten contract sections | Manual |
| LEARN | `scripts/stress-corpus.ts` (measurement only) | Missing |
| Evidence / Decision / cases | — | Missing |
| Customization space | — | Missing |

## 11. Roadmap

| Phase | Scope | Deliverables |
|---|---|---|
| **P0 Safety proof** | Output re-parse with each language's official parser; token-stream preservation check; automatic fixes floored at 3 rows; Go alignment off by default; `Result` JSON shared by both engines; `check` / `--write` stay the only entry points | parse + token checks in the engine and harness, `Result` schema |
| **P0.5 Run-last** | `xxx format` / `xxx check` wrapping **one explicitly configured formatter**; fixed-point tests per formatter; formatter detection only suggests; README statement | canonical form `C = xxx(formatter(file))` with `C(C(x)) == C(x)` |
| **P1 Declarative registry** | Rule identity = language + container context + kind + signature; unify axis IDs; five review states; `--json` | `xxx review` |
| **P1.5 Corpus** | Manifest, stratified sampling, L1 runner (parse + tokens), L2 signatures with context | `corpus/manifest.json`, corpus report |
| **P2 Rules and layers** | Split rules into `rules/<language>/<region>/` files; split Base vs preset `recommended`; `.xxx/config.json` schema and layer resolver | rule files, resolver, preset folder |
| **P3 Learn** | Aggregation by rule identity × scope with git recency and provenance, candidates, approve/reject | `xxx learn`, `xxx approve` |
| **P4 Guide and feedback** | Render approved rules into agent rule files; case recording, replay tests, local review UI, promotion gate in CI | `xxx guide`, `xxx record-case`, review page |
| Later | Simplification and type-uncertainty suggestions (`SUGGEST` only); tabs padding; monorepo multi-formatter; shared web review; `xxx doctor` | — |

Order principle (from the 2026-09-28 cross-review): **prove the safety promises in code before widening features.** English migration was completed on 2026-09-28.

MVP language for LEARN: TypeScript first (richest kind registry); line-engine languages follow.

## 12. Open questions

- Exact editor integration per host (format-on-save wiring for VS Code, JetBrains, Neovim) for the run-last model.
- Whether Go ships gofmt-compatible only, or also a full-override opt-in in the first release.

- Final product name (replaces the `xxx` / `XXX` placeholder in one pass).
- License for the public repository.
- When to open the shared web review page for external contributors.
