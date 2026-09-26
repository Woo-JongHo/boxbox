# 에이전트 포팅 지도

`woo-code-readability` 스킬과 `readability-inspector` 검사자가 에이전트마다 어디에 놓이고 어떻게 설치되는지의 기준 문서다. 내용물(SKILL.md 본문, 규칙, 스크립트)은 에이전트 무관이고, 아래 표의 "어디에 두느냐"만 다르다. 스킬 본문은 TypeScript(AST·LSP)와 Python·Java·Go·Rust·JavaScript·C·C++(공통 라인 엔진)의 표형 정렬 검사기를 포함한다.

## 설치 행렬

| 에이전트 | 스킬 발견 위치 | 검사자 에이전트 | 설치 방법 | 검증 상태 |
|---|---|---|---|---|
| ZCode | `~/.agents/skills/`, 워크스페이스 `.agents/skills/`, 플러그인 루트 | 플러그인 `agents/`(서브에이전트) | `./install.sh zcode` 또는 마켓플레이스 추가 | 머신 실측 — `~/.agents/skills/`에서 발견을 확인 |
| Claude Code | `~/.claude/skills/`, 플러그인 `skills/` | 플러그인 `agents/`(서브에이전트) | `/plugin marketplace add <owner>/<repo>` → `/plugin install woo-readability@woo-plugins`, 또는 `./install.sh claude` | 경로 문서 기반 — 이 머신에 `~/.claude/skills/` 없음 |
| Codex | `~/.codex/skills/`(전역), 워크스페이스 | `~/.codex/agents/*.toml` | `./install.sh codex`, 최신 Codex는 `codex plugin marketplace add`도 지원(ponytail README 검증) | 머신 실측 — `~/.codex/skills/`에 33개 스킬이 동일 SKILL.md 포맷으로 존재 |
| Pi·Oh My Pi | 프로젝트 `.pi/skills/`(자동 발견), OMP 생태계 패키지(pi.dev) | 없음 — 주 에이전트가 SKILL.md의 검사 절차를 직접 수행 | `./install.sh pi`(프로젝트 단위 복사), 또는 `pi install git:github.com/<owner>/<repo>` | README 검증 — ponytail이 `pi install git:...` 경로 제공 |
| 규칙 파일 방식(Cursor 등) | `AGENTS.md`·`.cursor/rules` 복사 | 없음 | SKILL.md 본문을 해당 규칙 파일로 발췌 | caveman·ponytail 선례 기반 |

머신 실측은 2026-09-26 기준이고, 경로 문서 기반 항목은 설치 후 각 에이전트에서 스킬 호출로 확인한다.

## `<SKILL>` 플레이스홀더 규약

SKILL.md와 검사자 정의의 명령 예는 `<SKILL>/scripts/...` 형태로 쓴다. `<SKILL>`은 해당 SKILL.md가 설치된 폴더 경로로 바꿔 실행한다. 스크립트는 검사 대상 저장소의 루트에서 실행한다(대상 파일 경로는 저장소 루트 상대경로).

## 의존성

- AST 검사기(`00`~`08`, `grid-kinds.ts`, `grid-tokens.ts`, `load-source-file.ts`): `bun` 런타임 + 이 저장소 `node_modules`의 `typescript@7`(`typescript/unstable/*` 서브패스 사용).
- hover 검사기(`05_inspect-hover.mjs`): `node` + **대상 프로젝트**의 `node_modules/.bin/tsc --lsp` — 검사 대상 프로젝트가 TypeScript를 설치하고 있어야 한다.
- `measure-layout.ts`: bun + node:fs 만 사용(외부 의존 없음).

## 멀티 에이전트 플러그인 선례

- **caveman** — "a skill/plugin for Claude Code, Codex, Gemini, Cursor, Windsurf, Cline, Copilot, and 30+ other agents". Claude Code는 `claude plugin marketplace add`, 그 외는 `npx skills add <repo> -a <agent>`, 규칙 파일 방식 에이전트는 본문 복사.
- **ponytail** — Claude Code `/plugin marketplace add`, Codex `codex plugin marketplace add` + `codex plugin add`, Pi `pi install git:...`, OpenCode·Gemini·Copilot CLI 등 도구별 설치 절과 `docs/agent-portability.md` 제공.

이 저장소는 같은 구조를 따른다: 도구 무관 스킬 원본 하나 + 도구별 어댑터(에이전트 정의, 설치 스크립트) + 이 포팅 지도.

## 프로젝트 오버레이

프로젝트 고유 거버넌스는 이 저장소에 넣지 않고 프로젝트 쪽에서 소유한다.

- **99_www**: 이 스킬 자체를 바꿀 때 Woo Receipt(`CODE-READABILITY-MAINTAIN`, `.www/evidence/<날짜>-woo-code-readability-maintain/receipt.json`)를 남기는 절이 원래 정본에 있었다. 플러그인 단일 소스로 갈아탈 때는 이 절을 99_www의 AGENTS.md나 워크스페이스 오버레이로 옮겨 유지한다.
- **아키텍처 경계**: 99_www의 `LAYERS.md`처럼 저장소별 경계 문서는 SKILL.md 진입 절의 "대상 저장소의 아키텍처 경계 문서" 규칙으로 일반화돼 있다.
