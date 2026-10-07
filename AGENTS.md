# AGENTS.md

Working rules and a structure map for any coding agent (Claude Code, Codex, ZCode, Pi, ...) editing this repository. `CLAUDE.md` imports this file, so keep it as the single source.

## Language policy — English everywhere (2026-10-07 decision)

The whole repository is written in English: Markdown docs (`docs/`, `SKILL.md`, `references/`), code comments and JSDoc,
test names and assertion messages, plan files, CLI and report output, manifests, and git artifacts (commit messages,
PR titles and bodies, branch names). This replaces the 2026-09-30 policy of Korean during development and translation
before release (M1.8 S8, done on 2026-10-07).

- Conversation with the user stays in Korean.
- **CJK test data** (strings for display-width and preservation checks, such as `"범위"` in `skills/xxx/fixtures/c/tables*.c`)
  is not translated. Mark such lines outside `skills/xxx/fixtures/` with a trailing `// cjk-test-data` comment.
- Recorded evidence (`harness/evidence/`, `docs/reviews/*-evidence/`) is machine output kept as recorded and is not rewritten.
- `test/language-policy.test.ts` fails on Hangul in tracked files outside these exceptions.

`test/plugin-contract.test.ts` pins the discovery text `TypeScript, Python, Java, Go, Rust, JavaScript, C, C++, Swift, and Kotlin`. Change it together with the manifests and the `SKILL.md` frontmatter.

## Naming placeholder

The product name is not decided yet. Use exactly two placeholder forms so the final rename is one search-and-replace:

- `xxx` — identifiers, paths, package/plugin/skill names, config dirs (`.xxx/`), caches (`~/.cache/xxx/`)
- `XXX` — display names and environment variables (`XXX_INSTALL_HOME`)

Never reintroduce the author's personal name or private project names (the old `woo-*` names) into shipped files. The `author` field in the manifests is attribution and stays.

## What this repository is

`xxx` is a multi-agent skill plugin. It ships one skill, `xxx`, which inspects, fixes and verifies source files one at a time against a "spreadsheet-style" (tabular) readability contract: rows with the same role are made structurally identical, then their syntax boundaries are aligned into minimum-width columns.

The core value is conservatism: a row whose structure cannot be decomposed losslessly is never rewritten, and every aligner is tested for content preservation, idempotence and a minimum row count.

**Current plan:** read `docs/plan.md` first. Work only on the task marked `▶ active`, verify it with the commands listed there, show the results to the user, and wait for confirmation before starting the next task.

**Product direction:** read `docs/design.md` before any structural work. It defines the target product (placeholder name `xxx`): LEARN / GUIDE / REVIEW modes, the non-negotiable invariants, the Base → Preset → User → Project layering, the `.xxx/` customization space, the learning-data funnel and the P0–P4 roadmap. The project is currently in the learn-and-harden phase.

Supported languages:

- **TypeScript** — AST + LSP tooling (TypeScript 7), table-kind registry in `grid-kinds.ts`.
- **Python, Java, Go, Rust, JavaScript, C, C++, Swift, Kotlin** — a shared line engine plus a small per-language profile (string/comment masking + row slot rules).

## Structure map

```
.claude-plugin/
  marketplace.json     Claude Code marketplace "xxx-plugins" → source ./plugin
.agents/plugins/
  marketplace.json     Codex marketplace "xxx-plugins" → local ./plugin
plugin/                ← release plugin (thin adapter shared by Claude Code and Codex). The engine is the npm CLI, run through exact-version npx
  .claude-plugin/plugin.json   Claude manifest (no agents field — default agents/ discovery)
  .codex-plugin/plugin.json    Codex manifest (with interface)
  skills/xxx/          CLI-only SKILL.md + copied references (copied by scripts/sync-plugin.ts)
  agents/readability-inspector.md   read-only inspector (CLI check and guide only)
  hooks/hooks.json     SessionStart·PostToolUse(Write|Edit|MultiEdit|apply_patch)·Stop → scripts/xxx hook
  scripts/xxx          `npx --yes xxx@<version>` shim
  README.md            install, what runs, where it writes
agents/
  readability-inspector.md   development (install.sh) Claude Code / ZCode read-only subagent (Write/Edit disallowed)
codex/
  readability-inspector.toml Codex read-only agent (sandbox_mode = "read-only")
hooks/
  hooks.json           development authoring hooks (bun hook.ts) — release hooks are plugin/hooks/hooks.json
corpus/
  manifest.json        pins public corpus sources by commit (private sources in gitignored corpus/local.json)
  verdicts.jsonl       human verdict records (currently 0 rows)
skills/xxx/     ← the product; agent-agnostic
  SKILL.md             Skill entry point (Agent Skills format). Commands use the <SKILL> placeholder
  agents/openai.yaml   OpenAI/Codex skill metadata
  references/
    charter.md                    one page of principles, values and safety invariants
    grammar.md                    4 grammar units, 9 patterns, roles, paragraphs, genres — defines every ID
    readability-contract.md       Confirmed rules, discarded rules, column-check order, authoring axis contract
    typescript-grid-template.md   Per-role TypeScript table templates
  base/                surface-form data (typescript.json, python.json): pattern → kind, symbols, decomposition conditions
  presets/recommended/ public preset DB (conventions, examples, decisions .jsonl) — all 0 rows for now
  scripts/
    cli.ts             public CLI entry: init, doctor, check, guide, format, db init/status, run, status, hook (--json, format --dry-run)
    internal-runner.ts internal runner of the Node-only engine artifact (excluded from the public CLI bundle)
    hook.ts            authoring hook adapter (called by hooks/hooks.json)
    report.ts          safety-check and alarm report (S1–S4, A0–A12)
    measure-layout.ts  Manual column measurement (STEP4; 04_measure-columns.ts not yet built)
    common/            Language-agnostic line engine
      code-text.ts       String/comment masking (CodeSyntax, maskSource)
      table-engine.ts    Table detection + minimum-width alignment (LineProfiler, alignSource)
      align-cli.ts       Shared CLI wrapper (runAlignCli) used by every non-TS 06_align-tables.ts
      display-width.ts   Terminal display width (tabs, CJK)
      parse-check.ts     re-parse diagnostic comparison — a missing or failing parser ends with an error before writing (fail-closed)
      safe-file.ts       refuses symlinks and non-regular files, atomic replacement after rechecking identity
      format-pipeline.ts formatter → approval gate → XXX, byte fixed point over two full runs, one replacement
      approval-gate.ts   human approval proof checks (decision, example, counterexample, document hash, versions)
      project-config.ts  Base → Preset → User → Project config merge (in-memory v1 migration)
      lifecycle-hook.ts  plugin hooks (session/post/stop), records in the plugin data folder
      examples.ts, signature.ts, conventions.ts, preservation.ts, result-json.ts, ...   other shared modules
    <lang>/            python, java, go, rust, javascript, c, cpp, swift, kotlin — each has:
      profile.ts         The language's LineProfiler (syntax + slot rules)
      01_group-regions.ts  Report candidate row groups
      06_align-tables.ts   Check / --write alignment (thin wrapper over align-cli)
    typescript/        AST/LSP pipeline, numbered by step:
      00_normalize-imports.ts, 00_expand-interface-members.ts
      01_group-regions.ts        Group consecutive same-SyntaxKind siblings
      02_audit-type-uncertainty.ts  List ?, null, undefined, !, as
      03_audit-optional-types.ts    exactOptionalPropertyTypes gate (--max-errors baseline)
      05_inspect-hover.mjs          LSP hover/JSDoc check (runs with node)
      06_align-tables.ts            Kind-aware alignment (--write, --explain <line>, safe multi-pass replacement)
      07_wrap-conditions.ts         Wrap && / || chains of 4+ conditions
      08_function-map.ts            Function-map header drift check (--scaffold)
      09_observe-shapes.ts          read-only observation of TS function structure → .xxx/cache/shape.jsonl
      align.ts, token-preservation.ts   shared alignment and token-preservation modules
      grid-kinds.ts      Registry of table kinds and their axes (KIND_AXES, AXIS_NOTES)
      grid-tokens.ts, load-source-file.ts   Shared helpers
  fixtures/            <lang>/tables.*, tables.aligned.*, tricky.* golden/trap inputs; TS contract fixtures
test/                  suites: lang-harness, 10 <lang>-align suites, cli, approval-gate, format-pipeline,
  config-layers·parser-fault·line-write-safety·shape-observation, public-preset·public-artifact·node-artifact,
  7 corpus-* suites, plugin-contract, plugin-hook, lifecycle-hook, language-policy, install-lifecycle, ...
scripts/               repository tools: stress-corpus.ts, corpus-{fetch,signatures,candidates,judge,promote,measures,triage}.ts,
  build-cli-artifact.ts, build-node-artifact.ts (packaging/ → dist/ tarball; dist/ is gitignored), sync-plugin.ts, eval.ts,
  public-preset.ts, examples-check.ts, usage-report.ts, strip-stray-padding.ts, test-completed.ts
packaging/             release package sources: cli/ (entry.ts, package.json, README), node/ (for the internal runner)
harness/               release tracking harness: run.ts (stage orchestrator), db.ts, report.ts,
  evidence/ (runs.jsonl, latest.json, git-tracked) — docs/plan.md is the single source of REL status
docs/                  plan.md (canonical execution TODO), status.md (resume screen), implementation.md (implementation facts), corpus-data.md (corpus DB state),
  release-contract.md (first release contract), handoff-2026-10-05.md (verification handoff), design.md (product direction), authoring-flow.md,
  agent-portability.md, pilot report, readiness, candidates/ paper/ research/ reviews/ (cross-review records)
install.sh             Links (default) or copies the skill/agent into ~/.claude, ~/.agents, ~/.codex, ./.pi
.github/workflows/verify.yml  CI: bun install --frozen-lockfile && bun run check
```

## How the pieces fit

- **Single source.** Rules and scripts live only in `skills/xxx/`. Hosts get it via symlink (`install.sh`) or the marketplace; never fork copies.
- **There are two release artifacts.** The engine CLI package (`scripts/build-cli-artifact.ts` → `packaging/cli` → `dist/xxx-<version>.tgz`) and the thin agent plugin (`plugin/`: `SKILL.md`, read-only inspector, manifests, hook adapter) share one set of engine and rule data. The public CLI bundle does not include the raw write runners or auxiliary writers (`docs/release-contract.md`).
- **Host adapters are thin.** Only discovery location and manifest differ per host (see `docs/agent-portability.md`).
- **Roles.** The read-only inspector investigates one product file; the main agent authors and verifies exactly one product file at a time and waits for user feedback before moving on.
- **Adding a language:** create `scripts/<lang>/profile.ts` exporting a `LineProfiler`, add `01_group-regions.ts` / `06_align-tables.ts` wrappers, add `fixtures/<lang>/{tables,tables.aligned,tricky}.*`, add `test/<lang>-align.test.ts` using `lang-harness.ts`, then update the language list in manifests, `SKILL.md` and `plugin-contract.test.ts`.
- **Adding a TypeScript table kind:** register it in `grid-kinds.ts` (kind + axes + note), add fixtures, and cover it in `typescript-align.test.ts`.

## Commands

```bash
bun install           # pins typescript@7 used by the TS scripts
bun run test          # all suites (bun test --timeout 60000 — headroom for toolchain child-process integration tests)
bun run check         # bun test --timeout 60000 && bunx tsc --noEmit && bash -n install.sh (same as CI)
bun run pack:cli      # public CLI tarball → dist/ (isolated install tests need typescript@7.0.2 in the npm cache)
bun run pack:node-artifact   # Node-only engine artifact tarball → dist/
bun run sync:plugin   # sync plugin/ references and versions from the single source
claude plugin validate --strict ./plugin   # official validator for the release plugin
bun run scripts/stress-corpus.ts   # optional; clones OSS repos into /tmp, writes stress/
```

## Conventions

- Runtime is Bun (TypeScript scripts run directly); `05_inspect-hover.mjs` runs on Node.
- Code in this repo is itself held to the skill's rules: aligned import/declaration tables, tabs for indentation. Run the relevant `06_align-tables.ts` on files you change.
- **When the property differs, split with a blank line** (`skills/xxx/references/grammar.md` section 1 paragraph rule). The property is the pattern (`DEFINE`, `WHEN`, `EXIT`, `DO` …) and, for a definition, the declaration kind (`type`/`interface` erased after compilation versus declarations that remain at run time). Examples: a `const` group and an `expect` group; a definition, a check (`if … throw`) and a result (`return`). Build alignment tables only within one property, and never hand-align columns across lines with different properties. Exception: a guard that checks a name defined just above stays attached to the definition. `export` and `const`/`let` are not mandatory criteria (grouping them is nice but not enforced). **Apply retroactively only to files you touch** (do not change untouched files).
- **Keep statements in their original execution order.** Do not reorder declarations to look nicer (for example, sorting by argument count can use a `const` before its declaration and break). Group only by inserting blank lines within already consecutive statements.
- **`test/` and `scripts/` import the engine with `@/`** (`tsconfig.json` `paths`: `@/*` = `skills/xxx/scripts/*`). Inside shipped engine code (`skills/xxx/scripts/**`), use relative paths: `install.sh --copy` copies only the skill folder and does not take `tsconfig.json`. To be revisited with engine bundling (M1.8 S6).
- Keep `version` identical in `package.json`, the `plugin/` manifests, shim and docs, both marketplaces and `packaging/cli/package.json`: change only `package.json` and run `bun run sync:plugin` (`test/plugin-contract.test.ts` catches drift). Validate the release plugin with `claude plugin validate --strict ./plugin` and `claude plugin validate --strict .`.
- Agent definitions must stay read-only: `agents/readability-inspector.md` and `plugin/agents/readability-inspector.md` declare frontmatter `disallowedTools: Write, Edit, …`, and `codex/readability-inspector.toml` declares `sandbox_mode = "read-only"`. Current tests only check that these files exist, so the read-only property itself is not test-enforced — keep it by hand when editing the definitions.
- `stress/` contains third-party code and must not be committed.
