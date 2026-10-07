# xxx

> Working name. `xxx` / `XXX` is a placeholder that will be replaced by the final brand name in one pass.

A multi-agent skill plugin that inspects, fixes and verifies source files one at a time against tabular ("spreadsheet-style") readability rules. Same-role rows are first given the same minimal structure; the remaining syntax boundaries are then aligned into minimum-width columns. When the structure is uncertain, it refuses rather than guesses.

It belongs to the same family of agent skill plugins as caveman and ponytail. The SKILL.md body (Agent Skills format) is tool-agnostic; the only per-tool differences are install location and manifest.

배포 준비 현황은 [`docs/status.md`](docs/status.md), 배포까지의 TODO와 완료 기준은 [`docs/plan.md`](docs/plan.md)에 기록한다. 실제 코드의 구조·명령·안전 검사 범위는 [`docs/implementation.md`](docs/implementation.md), 목표 제품은 [`docs/design.md`](docs/design.md)를 따른다.

**현재 상태 (2026-10-06):** 10개 언어 정렬기와 토큰 보존 검사, TypeScript·Python 검사 리포트, 읽기 전용 작성 훅, 패턴·예문 DB 조회·검증 구조, 공개 CLI(`xxx init`·`doctor`·`check`·`guide`·`format`·`db`)와 로컬 tarball 패키징(`bun run pack:cli`)이 있다. 승인 데이터 적재, DB를 통한 자동 수정 제한, 실제 호스트 훅 검증과 공개 publish·이름·라이선스 결정은 남아 있다.

안전 검사 범위는 명령마다 다르다. `06_align-tables.ts`는 편집 후보의 토큰 보존을 검사하고, 쓰기 전 재파싱 진단을 비교한다. 파서 도구가 없거나 비정상 종료하면 파일을 쓰지 않고 오류로 종료한다(fail-closed, 2026-10-04 REL2a). `XXX_REQUIRE_PARSERS=1`은 테스트가 파서 설치 여부를 감지하는 probe용이다. import 분리 등 보조 쓰기 명령에는 같은 gate가 아직 없으며, 공개 artifact에는 이 raw writer들이 포함되지 않는다. 자세한 조건은 구현 문서를 따른다.

## Contents

| Path | Contents |
|---|---|
| `skills/xxx/` | Skill body (`SKILL.md`), rule references, AST/LSP checker scripts, fixtures |
| `agents/readability-inspector.md` | Read-only subagent for Claude Code and ZCode (Write/Edit disallowed) |
| `codex/readability-inspector.toml` | Read-only agent definition for Codex (`sandbox_mode = "read-only"`) |
| `.claude-plugin/` | Plugin and marketplace manifests (recognized by Claude Code and compatible tools) |
| `docs/status.md` | 첫 공개 배포 목표, 현재 구현·검증 상태, 배포 차단 항목과 재개점 |
| `docs/plan.md` | 배포까지의 실행 TODO, 선행 작업, 완료 기준과 검증 방법 |
| `docs/implementation.md` | 실제 코드의 진입점, 실행 흐름, 데이터 저장 위치, 검증 범위와 한계 |
| `docs/design.md` | Product design: modes, invariants, data model, customization, roadmap |
| `docs/agent-portability.md` | Skill discovery paths, install methods and verification status per agent |
| `docs/pilot-2026-09-26.md` | Pilot measurement — root causes of `;`/`=` misalignment |
| `install.sh` | Install and uninstall into each agent's directories via symlink or copy |

## 구현된 언어와 첫 배포 범위

아래는 현재 저장소에 엔진이 있는 언어다. 첫 공개 배포의 핵심 지원 범위는 **TypeScript·Python**으로 확정했다. 나머지 8개 언어의 배포물 포함 여부와 지원 등급은 배포 계약에서 정한다.

- **TypeScript** — AST/LSP-based checkers (`scripts/typescript/`, with the grid-kinds table registry).
- **Python, Java, Go, Rust, JavaScript, C, C++, Swift, Kotlin** — 공통 줄 엔진(`scripts/common/table-engine.ts`)과 언어별 profile을 쓴다. 문자열·주석을 마스킹하고, profile이 분해할 수 있는 행만 정렬한다. 언어별 지원 구문과 안전 검사 범위는 구현 문서에서 구분한다.

현재 개발용 스크립트의 직접 호출 예시다. 같은 엔진을 묶은 공개 CLI는 `skills/xxx/scripts/cli.ts`에 구현돼 있고 배포용 tarball은 `bun run pack:cli`로 만든다.

```bash
bun skills/xxx/scripts/rust/06_align-tables.ts --file lib.rs --write
bun skills/xxx/scripts/go/06_align-tables.ts --file main.go             # Go: report only by default
bun skills/xxx/scripts/go/06_align-tables.ts --file main.go --write --enable-go
bun skills/xxx/scripts/python/06_align-tables.ts --file models.py
```

## Install

> [!IMPORTANT]
> **XXX 정렬은 일반 포매터 다음에 실행한다.** Prettier·black·rustfmt 등이 나중에 실행되면 세로 정렬이 사라질 수 있다. `xxx format`이 명시된 formatter → 재파싱 검사 → 승인 gate → XXX 순서로 작업본에 적용하고, 전체를 두 번 실행해 byte 고정점을 확인한 뒤 한 번만 교체한다. formatter 미설정·승인 데이터 부재처럼 조건이 불충분하면 파일을 쓰지 않고 거절한다. 언어별 `06_align-tables.ts` 직접 호출도 여전히 가능하다. Go는 기본적으로 보고만 한다. 목표 설계는 [design §3.5](docs/design.md#35-formatter-coexistence--xxx-runs-last)를 참고한다.

The install script is the simplest route. It symlinks by default, so edits to the rules in this repository reach every agent immediately.

```bash
./install.sh zcode codex   # link into ZCode and Codex
./install.sh claude        # link into Claude Code's global skills and agents
./install.sh pi            # 현재 프로젝트 .pi/skills/에 링크; 복사는 --copy pi
./install.sh --copy zcode  # copy instead of link
./install.sh --uninstall zcode codex
```

마켓플레이스용 매니페스트도 있다. 아래는 예정된 설치 경로이며, 깨끗한 환경의 설치·실제 호스트 수용 검증은 아직 남아 있다.

- Claude Code: `/plugin marketplace add <owner>/<repo>` → `/plugin install xxx@xxx-plugins`
- ZCode: recognizes the `.claude-plugin/` compatible manifests, so add the same repository as a marketplace.

`install.sh`는 스킬·에이전트 파일만 배치한다. 저장소의 `hooks/hooks.json`을 호스트 설정에 등록하지 않으므로, 스킬 설치만으로 작성 훅까지 활성화됐다고 볼 수 없다.

## Requirements

- `bun` — runs the AST checkers (`scripts/typescript/*.ts`).
- `node` + the target project's `node_modules/.bin/tsc` — used only by the hover check (`05_inspect-hover.mjs`).
- 줄 엔진의 재파싱 비교 도구: `python3`, `gofmt`, `node`, `clang`/`clang++`, `javac`, `rustfmt`, `swiftc`, `kotlinc`. 파서가 없을 때의 쓰기 동작은 위 안전 검사 설명을 따른다.
- `bun install` (or `npm install`) in this repository — pins the `typescript@7` the checkers use. `install.sh` runs it automatically.

## Single source of rules

A copy of the skill once drifted from the canonical version in its description, script paths and rules. This plugin prevents that structurally:

- Rules and scripts exist only in this repository; agents link to it.
- Project-specific governance lives in a project-side overlay, not here.
- Only rules confirmed by user feedback are promoted into this repository's SKILL.md and references.

Command examples in the skill body use the `<SKILL>` placeholder (the skill folder path), so they work wherever the skill is installed.

## Development

```bash
bun install
bun run check   # bun test && bunx tsc --noEmit && bash -n install.sh (same as CI)
```

Contributor and agent rules — including the language policy — are in [`AGENTS.md`](AGENTS.md).
