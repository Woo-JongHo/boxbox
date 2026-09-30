# AGENTS.md

Working rules and a structure map for any coding agent (Claude Code, Codex, ZCode, Pi, ...) editing this repository. `CLAUDE.md` imports this file, so keep it as the single source.

## 언어 정책 — 개발 중 한국어, 배포 전 영어 번역 (2026-09-30 결정)

개발 단계에서는 **새로 쓰는 문서·주석·계획을 한국어로** 쓴다. 공개 배포 직전에 레포 전체를 영어로 번역한다(`docs/plan.md` M1.8 S8).

- **한국어로 쓰는 것:** Markdown 문서(`docs/`, `SKILL.md`, `references/`), 코드 주석과 JSDoc, 테스트 이름과 assertion 메시지, 계획 파일.
- **영어로 유지하는 것 (번역 대상이 아님):** 코드 식별자, 파일·경로 이름, 규칙·문형 ID(`DEFINE` 등), CLI 오류 메시지, 매니페스트 `description`.
- **예외 — 검사 리포트 본문:** `scripts/report.ts`의 사람이 읽는 출력(안전 검사·알람 라벨과 설명)은 개발 중 한국어로 두고 S8에서 영어로 바꾼다(2026-09-30 결정). JSON 필드 이름과 ID(`S1`, `A1` …)는 영어다.
- **git에 남는 것은 영어:** 커밋 메시지, PR 제목·본문, 브랜치 이름. 배포 전에 번역할 수 없는 기록이기 때문이다.
- 이미 영어로 된 기존 문서는 억지로 번역하지 않는다. 손대는 부분부터 한국어로 쓴다.
- 사용자와의 대화는 한국어.

**CJK 테스트 데이터**(표시 폭 검사용 문자열, 예: `skills/xxx/fixtures/c/tables*.c`의 `"범위"`)는 번역 대상이 아니다. S8의 한국어 잔존 검사에서도 제외한다.

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
  plugin.json          Plugin manifest (name, version, skills/agents paths)
  marketplace.json     Marketplace "xxx-plugins" listing this plugin
agents/
  readability-inspector.md   Claude Code / ZCode read-only subagent (Write/Edit disallowed)
codex/
  readability-inspector.toml Codex read-only agent (sandbox_mode = "read-only")
skills/xxx/     ← the product; agent-agnostic
  SKILL.md             Skill entry point (Agent Skills format). Commands use the <SKILL> placeholder
  agents/openai.yaml   OpenAI/Codex skill metadata
  references/
    readability-contract.md       Confirmed rules, discarded rules, column-check order, authoring axis contract
    typescript-grid-template.md   Per-role TypeScript table templates
  scripts/
    common/            Language-agnostic line engine
      code-text.ts       String/comment masking (CodeSyntax, maskSource)
      table-engine.ts    Table detection + minimum-width alignment (LineProfiler, alignSource)
      align-cli.ts       Shared CLI wrapper (runAlignCli) used by every non-TS 06_align-tables.ts
      display-width.ts   Terminal display width (tabs, CJK)
    <lang>/            python, java, go, rust, javascript, c, cpp — each has:
      profile.ts         The language's LineProfiler (syntax + slot rules)
      01_group-regions.ts  Report candidate row groups
      06_align-tables.ts   Check / --write alignment (thin wrapper over align-cli)
    typescript/        AST/LSP pipeline, numbered by step:
      00_normalize-imports.ts, 00_expand-interface-members.ts
      01_group-regions.ts        Group consecutive same-SyntaxKind siblings
      02_audit-type-uncertainty.ts  List ?, null, undefined, !, as
      03_audit-optional-types.ts    exactOptionalPropertyTypes gate (--max-errors baseline)
      05_inspect-hover.mjs          LSP hover/JSDoc check (runs with node)
      06_align-tables.ts            Kind-aware alignment (--write, --explain <line>)
      07_wrap-conditions.ts         Wrap && / || chains of 4+ conditions
      08_function-map.ts            Function-map header drift check (--scaffold)
      grid-kinds.ts      Registry of table kinds and their axes (KIND_AXES, AXIS_NOTES)
      grid-tokens.ts, load-source-file.ts   Shared helpers
    measure-layout.ts  Manual column measurement (STEP4; 04_measure-columns.ts not yet built)
  fixtures/            <lang>/tables.*, tables.aligned.*, tricky.* golden/trap inputs; TS contract fixtures
test/
  lang-harness.ts      Shared suite: preservation, idempotence, golden, traps, 2-row non-alignment
  <lang>-align.test.ts One per language (+ typescript-align, engine)
  plugin-contract.test.ts   Version/identity consistency across package/plugin/marketplace, agent read-only boundary
  install-lifecycle.test.ts install.sh link/copy/uninstall/re-run, user-file preservation
scripts/stress-corpus.ts   Runs aligners on the longest files of large OSS repos → stress/ (gitignored)
docs/                  design.md (product direction), portability matrix, pilot report, readiness, reviews/ (cross-review records)
install.sh             Links (default) or copies the skill/agent into ~/.claude, ~/.agents, ~/.codex, ./.pi
.github/workflows/verify.yml  CI: bun install --frozen-lockfile && bun run check
```

## How the pieces fit

- **Single source.** Rules and scripts live only in `skills/xxx/`. Hosts get it via symlink (`install.sh`) or the marketplace; never fork copies.
- **Host adapters are thin.** Only discovery location and manifest differ per host (see `docs/agent-portability.md`).
- **Roles.** The read-only inspector investigates one product file; the main agent authors and verifies exactly one product file at a time and waits for user feedback before moving on.
- **Adding a language:** create `scripts/<lang>/profile.ts` exporting a `LineProfiler`, add `01_group-regions.ts` / `06_align-tables.ts` wrappers, add `fixtures/<lang>/{tables,tables.aligned,tricky}.*`, add `test/<lang>-align.test.ts` using `lang-harness.ts`, then update the language list in manifests, `SKILL.md` and `plugin-contract.test.ts`.
- **Adding a TypeScript table kind:** register it in `grid-kinds.ts` (kind + axes + note), add fixtures, and cover it in `typescript-align.test.ts`.

## Commands

```bash
bun install           # pins typescript@7 used by the TS scripts
bun test              # all suites
bun run check         # bun test && tsc --noEmit && bash -n install.sh (same as CI)
bun run scripts/stress-corpus.ts   # optional; clones OSS repos into /tmp, writes stress/
```

## Conventions

- Runtime is Bun (TypeScript scripts run directly); `05_inspect-hover.mjs` runs on Node.
- Code in this repo is itself held to the skill's rules: aligned import/declaration tables, tabs for indentation. Run the relevant `06_align-tables.ts` on files you change.
- **속성이 다르면 빈 줄로 나눈다** (`skills/xxx/references/grammar.md` 1절 문단 규칙). 속성은 문형(`DEFINE`, `WHEN`, `EXIT`, `DO` …)과, 정의라면 선언 종류(컴파일 후 지워지는 `type`·`interface` 대 실행 때 남는 선언)다. 예: `const` 묶음과 `expect` 묶음, 정의와 확인(`if … throw`)과 결과(`return`). 정렬 표는 같은 속성 안에서만 만들고, 속성이 다른 줄에 손으로 열을 맞추지 않는다. 예외: 바로 위에서 정의한 이름을 검사하는 guard는 정의에 붙여 둔다. `export` 여부와 `const`/`let`은 필수 기준이 아니다(묶으면 좋지만 강제하지 않음). **소급 적용은 손대는 파일부터** 한다(건드리지 않은 파일은 바꾸지 않는다).
- **문장 순서는 원래 실행 순서를 지킨다.** 보기 좋게 하려고 선언 순서를 바꾸지 않는다(예: 인자 수로 정렬하면 `const`가 선언 전에 쓰여 깨진다). 묶기는 이미 연속된 문장 안에서 빈 줄로만 한다.
- **`test/`와 `scripts/`는 엔진을 `@/`로 import한다** (`tsconfig.json` `paths`: `@/*` = `skills/xxx/scripts/*`). 배포되는 엔진 코드(`skills/xxx/scripts/**`) 안에서는 상대 경로를 쓴다: `install.sh --copy`는 스킬 폴더만 복사하고 `tsconfig.json`을 가져가지 않는다. 엔진 번들링(M1.8 S6)에서 다시 정한다.
- Keep `version` identical in `package.json`, `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` (enforced by tests).
- Agent definitions must stay read-only (enforced by tests).
- `stress/` contains third-party code and must not be committed.
