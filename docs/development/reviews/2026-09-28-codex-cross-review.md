# Cross-review of the design — 2026-09-28

Reviewer: OpenAI Codex CLI (`codex exec`, read-only sandbox), asked to cross-check `docs/design.md` against the code. Author of the design: Claude. Two claims were re-verified by hand before acting (Go/gofmt, `minRows` floor).

## Verdict (reviewer)

The core direction — conservative alignment, simplify first, human-only approval, relative widths — is sound. The formatter composition and the Go exception did not hold as written, and "whitespace-only" and parser preservation were not proven by code or tests.

## Findings and disposition

| # | Severity | Finding | Verified | Disposition |
|---|---|---|---|---|
| 1 | critical | `boxbox format` as a whole is not whitespace-only, because the formatter changes more than whitespace | — | Accepted. Invariant 1 now scopes whitespace-only to the BoxBox stage; formatter and BoxBox changes are reported separately (§2, §3.5) |
| 2 | high | `boxbox(formatter(x))` is defined but its fixed point is not guaranteed | — | Accepted. Fixed-point test per formatter; `check` fails if `C(C(x)) != C(x)` (§3.5) |
| 3 | high | Monorepos, per-path formatters and formatter version drift are not modelled | — | Accepted, scheduled later. Per-file pipeline with version fingerprint; MVP uses one explicit formatter (§3.5, §11) |
| 4 | high | Go "gofmt-compatible by default" is false: `gofmt -d` rewrites the Go golden fixture | Yes — indentation and import-alias alignment are rewritten | Accepted. Go alignment off by default until proven gofmt-stable (§3.5) |
| 5 | high | The engine checks exact slot reassembly but never re-parses output or compares token streams | — | Accepted. First P0 item (§2, §6, §10, §11) |
| 6 | medium | The engine floors `minRows` at 2; pairs have no explicit approval path | Yes — `table-engine.ts` uses `Math.max(2, …)`; CLI default is 3 | Accepted. Fixes floored at 3 rows; pairs only via a recorded human Decision (§3.3) |
| 7 | high | "One kind = one region" cannot express nesting and context | — | Accepted. Rule identity = language + container context + kind + signature; region is a tag (§4.1, §4.3) |
| 8 | medium | The taxonomy mixes engine rules, semantic guidance and invariants | — | Accepted. Layout rules, judgment rules and safety invariants are kept apart (§4.3) |
| 9 | high | `padding: tabs` is not implemented; frontmatter used raw tokens while the registry uses axis IDs | — | Accepted. Tabs marked as planned; frontmatter uses registry axis IDs (§4.1, §4.4) |
| 10 | medium | Evidence lacks provenance, tool versions and conflict sets | — | Accepted (§4.2) |
| 11 | high | L2 signatures cannot distinguish roles; representatives may hide high-risk cases | — | Accepted. Context and nesting in signatures; high-risk signatures sampled proportionally (§6) |
| 12 | high | P0 is too broad while safety proofs are missing | — | Accepted. Roadmap reordered: safety proof → run-last → declarative registry → corpus → rules and layers → learn → guide and feedback (§11) |

## Disagreement

The reviewer objected to a global "BoxBox always runs after every formatter" policy and proposed providing the ordering only inside a single wrapper. The design already routes formatting through the `boxbox format` / `boxbox check` wrapper; invariant 9 now states that the ordering is guaranteed only through that wrapper. The decision itself — BoxBox overrides the formatter — stands.

## Kept as is (reviewer agreed)

Simplify first, align second; `UNCERTAIN`/`REFUSE` as normal outcomes; no cross-group widths; the Convention / Evidence / Decision split; the open-source corpus used for correctness and kind discovery, never for taste.

> Historical naming note (2026-10-12): this record predates the confirmed product name `boxbox` and npm package `boxbox`. Maintained links and examples use the current names; earlier placeholder-name findings are historical, not current naming blockers. Raw execution evidence remains unchanged.
