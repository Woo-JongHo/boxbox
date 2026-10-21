# AGENTS.md

Working rules and a structure map for any coding agent (Claude Code, Codex, ZCode, Pi, ...) editing this repository. `CLAUDE.md` imports this file, so keep it as the single source.

## Language policy — English everywhere (2026-10-07 decision)

The whole repository is written in English: Markdown docs (`docs/`, `SKILL.md`, `references/`), code comments and JSDoc,
test names and assertion messages, plan files, CLI and report output, manifests, and git artifacts (commit messages,
PR titles and bodies, branch names). This replaces the 2026-09-30 policy of Korean during development and translation
before release (M1.8 S8, done on 2026-10-07).

- Conversation with the user stays in Korean.
- **CJK test data** (strings for display-width and preservation checks in `test/fixtures/`)
  is not translated. Mark such lines outside `test/fixtures/` with a trailing `// cjk-test-data` comment.
- Recorded evidence (`development/harness/evidence/`, `docs/development/reviews/*-evidence/`) is machine output kept as recorded and is not rewritten.
- Keep new repository prose in English; preserve CJK fixture data and recorded evidence.

`test/plugin-contract.test.ts` pins the discovery text `TypeScript, Python, Java, Go, Rust, JavaScript, C, C++, Swift, and Kotlin`. Change it together with the manifests and the `SKILL.md` frontmatter.

## Product name

Naming is owned by `product.json`. Its `displayName` derives the lowercase core ID, uppercase environment prefix and `98_<displayName>` repository directory through `bun run sync:product`. Its `npmName` owns the public installer package separately, because registry availability can differ from the product ID. `development/tools/product-identity.generated.json` snapshots core identity migration; the installer builder reads `npmName` directly. Known local links are updated; historical records and third-party installations are not rewritten.

The confirmed product name is **BoxBox** (user decision on 2026-10-16). Core CLI, skill and plugin IDs use `boxbox`; display names use `BoxBox`; environment prefixes use `BOXBOX`. The public npm installer candidate is **`boxbox-plugin`**, selected after the user authorized an available alternative; npm returned E404 on 2026-10-16. This does not reserve the name or establish publication access.

- `boxbox` — core CLI, private engine artifacts, source paths, plugin/skill IDs, `.boxbox/` and caches
- `boxbox-plugin` — public npm installer candidate; intended entry `npx boxbox-plugin`
- `BoxBox` — display names
- `BOXBOX` — environment-variable prefixes (`BOXBOX_INSTALL_HOME`)

Never reintroduce the retired `xxx` / `XXX` placeholders or the author's private project names into shipped files.
The `author` field in the manifests is attribution and stays. Historical execution evidence retains the names it recorded.

## What this repository is

`boxbox` is a multi-agent skill plugin. It ships one skill, `boxbox`, which inspects, fixes and verifies source files one at a time against a "spreadsheet-style" (tabular) readability contract: rows with the same role are made structurally identical, then their syntax boundaries are aligned into minimum-width columns.

The core value is conservatism: a row whose structure cannot be decomposed losslessly is never rewritten, and every aligner is tested for content preservation, idempotence and a minimum row count.

**Current plan:** read `docs/development/plan.md` first. Work only on the task marked `▶ active`, verify it with the commands listed there, show the results to the user, and wait for confirmation before starting the next task.

**Product direction:** read `docs/development/design.md` before any structural work. It defines the target product `boxbox`: LEARN / GUIDE / REVIEW modes, the non-negotiable invariants, the Base → Preset → User → Project layering, the `.boxbox/` customization space, the learning-data funnel and the P0–P4 roadmap. The project is currently in the learn-and-harden phase.

Supported languages:

- **TypeScript** — AST + LSP tooling (TypeScript 7), table-kind registry in `grid-kinds.ts`.
- **Python, Java, Go, Rust, JavaScript, C, C++, Swift, Kotlin** — a shared line engine plus a small per-language profile (string/comment masking + row slot rules).

## Structure map

```text
product/                         canonical product sources
  engine/                        CLI, shared engine, language profiles and inspection runners
    common/                      preservation, parsers, safe writes, config, approvals, hooks
    typescript/                  TypeScript 7 AST/LSP pipeline and kind registry
    <lang>/                      shared line-engine profiles and thin runners
    rule-data.ts                 rule paths shared by source and bundled engines
  rules/
    base/                        language surface-form data
    references/                  charter, grammar, readability contract and TS templates
    presets/recommended/         public approved-rule DB (2 conventions, 4 examples, 2 decisions)
  plugin/                        hand-authored plugin templates; edit here
  installer/                     npm installer, permanent launcher and host installation
  packages/cli/                  public CLI package entry and metadata
  packages/node/                 private internal-runner package metadata

development/                     authoring, research and verification only
  tools/                         builds, sync, corpus tools, evaluation and layout checks
  corpus/                        pinned sources, verdicts and syntax-case inventory
  harness/                       release-stage orchestration and recorded evidence
  skills/boxbox/                 development SKILL.md and metadata; engine/rules are live links
  agents/, codex/, hooks/        development host definitions
  install.sh                     links or copies the development skill into isolated host locations

test/                            test suites; fixtures/ holds all golden and trap inputs
docs/user/                       installation and user guidance
docs/development/                plan, status, design, implementation, research and reviews
plugin/                          generated marketplace payload; never author here
dist/                            generated engine packages and npm installer; gitignored
.claude-plugin/marketplace.json   Claude marketplace -> ./plugin
.agents/plugins/marketplace.json  Codex marketplace -> ./plugin
.github/workflows/verify.yml     dependency setup and bun run check
```

## How the pieces fit

- **Single source.** Edit product code in `product/engine`, rules in `product/rules`, and plugin templates in `product/plugin`. `bun run sync:plugin` regenerates the complete `plugin/` payload. The marketplaces keep their `./plugin` discovery path. See [layout.md](docs/development/layout.md) for the dependency and generation contracts.
- **There are two release artifacts.** The engine CLI package (`development/tools/build-cli-artifact.ts` → `product/packages/cli` → `dist/boxbox-<version>.tgz`) and the thin agent plugin (`plugin/`: `SKILL.md`, read-only inspector, manifests, hook adapter) share one set of engine and rule data. The public CLI bundle does not include the raw write runners or auxiliary writers (`docs/development/release-contract.md`).
- **Host adapters are thin.** Only discovery location and manifest differ per host (see `docs/development/agent-portability.md`).
- **Roles.** The read-only inspector investigates one product file; the main agent authors and verifies exactly one product file at a time and waits for user feedback before moving on.
- **Adding a language:** create `product/engine/<lang>/profile.ts` exporting a `LineProfiler`, add `01_group-regions.ts` / `06_align-tables.ts` wrappers, add `test/fixtures/<lang>/{tables,tables.aligned,tricky}.*`, add `test/<lang>-align.test.ts` using `lang-harness.ts`, then update the language list in manifests, `SKILL.md` and `plugin-contract.test.ts`.
- **Adding a TypeScript table kind:** register it in `grid-kinds.ts` (kind + axes + note), add fixtures, and cover it in `typescript-align.test.ts`.

## Commands

```bash
bun install           # pins typescript@7 used by the TS scripts
bun run test          # all suites (bun test --timeout 60000 — headroom for toolchain child-process integration tests)
bun run check         # bun test --timeout 60000 && bunx tsc --noEmit && bash -n development/install.sh (same as CI)
bun run pack:cli      # public CLI tarball → dist/ (isolated install tests need typescript@7.0.2 in the npm cache)
bun run pack:node-artifact   # Node-only engine artifact tarball → dist/
bun run pack:installer       # npm Codex installer candidate → dist/installer/
bun run sync:plugin   # regenerate plugin/ from product templates and rule documents
claude plugin validate --strict ./plugin   # official validator for the release plugin
bun run development/tools/stress-corpus.ts   # optional; clones OSS repos into /tmp, writes stress/
```

## Conventions

- Runtime is Bun (TypeScript scripts run directly); `05_inspect-hover.mjs` runs on Node.
- Code in this repo is itself held to the skill's rules: aligned import/declaration tables, tabs for indentation. Run the relevant `06_align-tables.ts` on files you change.
- **When the property differs, split with a blank line** (`product/rules/references/grammar.md` section 1 paragraph rule). The property is the pattern (`DEFINE`, `WHEN`, `EXIT`, `DO` …) and, for a definition, the declaration kind (`type`/`interface` erased after compilation versus declarations that remain at run time). Examples: a `const` group and an `expect` group; a definition, a check (`if … throw`) and a result (`return`). Build alignment tables only within one property, and never hand-align columns across lines with different properties. Exception: a guard that checks a name defined just above stays attached to the definition. `export` and `const`/`let` are not mandatory criteria (grouping them is nice but not enforced). **Apply retroactively only to files you touch** (do not change untouched files).
- **Keep statements in their original execution order.** Do not reorder declarations to look nicer (for example, sorting by argument count can use a `const` before its declaration and break). Group only by inserting blank lines within already consecutive statements.
- **`test/` and `development/tools/` import the engine with `@/`** (`tsconfig.json` `paths`: `@/*` = `product/engine/*`). Inside shipped engine code (`product/engine/**`), use relative paths: `development/install.sh --copy` copies only the skill folder and does not take `tsconfig.json`. To be revisited with engine bundling (M1.8 S6).
- `package.json` owns the release version. Product manifest templates use `@BOXBOX_VERSION@`; `bun run sync:plugin` and package builders stamp generated output without modifying product templates. Change the version in `package.json`, regenerate and build (`test/plugin-contract.test.ts` catches output drift). Validate the release plugin with `claude plugin validate --strict ./plugin` and `claude plugin validate --strict .`.
- Agent definitions must stay read-only: `development/agents/readability-inspector.md` and `product/plugin/agents/readability-inspector.md` declare frontmatter `disallowedTools: Write, Edit, …`, and `development/codex/readability-inspector.toml` declares `sandbox_mode = "read-only"`. Current tests only check that these files exist, so the read-only property itself is not test-enforced — keep it by hand when editing the definitions.
- `stress/` contains third-party code and must not be committed.
