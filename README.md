# woo-readability

표형(엑셀식) 가독성 규칙으로 TypeScript 제품 파일을 한 파일씩 조사·수정·검증하는 `woo-code-readability` 스킬의 멀티 에이전트 플러그인이다. 99_www 저장소의 정본 스킬에서 프로젝트 전용 부분(description의 저장소 명칭, LAYERS.md 참조, Woo Receipt 거버넌스 절)을 분리해, 여러 코딩 에이전트가 같은 규칙 원본을 공유하도록 단일 소스로 배포한다.

caveman·ponytail과 같은 부류의 에이전트 스킬 플러그인이며, SKILL.md(Agent Skills 표준 포맷) 본문은 도구 무관이고 도구별 차이는 설치 위치와 매니페스트뿐이다.

## 구성

| 경로 | 내용 |
|---|---|
| `skills/woo-code-readability/` | 스킬 본문(`SKILL.md`), 규칙 references, AST·LSP 검사기 scripts, fixtures |
| `agents/readability-inspector.md` | Claude Code·ZCode 읽기 전용 서브에이전트(Write/Edit 금지) |
| `codex/readability-inspector.toml` | Codex 읽기 전용 에이전트 정의(`sandbox_mode = "read-only"`) |
| `.claude-plugin/` | 플러그인·마켓플레이스 매니페스트(Claude Code와 호환 도구가 인식) |
| `docs/agent-portability.md` | 에이전트별 스킬 발견 경로·설치 방식·검증 상태 |
| `docs/www-pilot-2026-09-26.md` | 99_www 파일럿 측정 — `;`·`=` 어긋남의 원인 분류 |
| `install.sh` | 에이전트별 디렉터리에 symlink/copy로 설치·제거 |

## 지원 언어

- **TypeScript** — AST·LSP 기반 검사기(`scripts/typescript/`, 표 종류 등록부 grid-kinds)
- **Python·Java·Go·Rust·JavaScript·C·C++** — 공통 라인 엔진(`scripts/common/table-engine.ts`) 위의 언어 프로파일러(`scripts/<언어>/01_group-regions.ts`, `06_align-tables.ts`). 문자열·주석 마스킹으로 구조를 오판하지 않고, 무손실 분해에 실패한 행은 거부한다.

```bash
bun skills/woo-code-readability/scripts/go/06_align-tables.ts --file main.go --write
bun skills/woo-code-readability/scripts/python/06_align-tables.ts --file models.py
```

## 설치

가장 간단한 방법은 설치 스크립트다. 기본은 심볼릭 링크여서 이 저장소의 규칙을 고치면 모든 에이전트에 즉시 반영된다.

```bash
./install.sh zcode codex   # ZCode와 Codex에 연결
./install.sh claude        # Claude Code 전역 skills·agents에 연결
./install.sh pi            # 현재 프로젝트 .pi/skills/에 복사 (pi·oh-my-pi)
./install.sh --copy zcode  # 링크 대신 복사
./install.sh --uninstall zcode codex
```

마켓플레이스 방식도 지원한다(저장소를 GitHub에 올린 뒤):

- Claude Code: `/plugin marketplace add <owner>/<repo>` → `/plugin install woo-readability@woo-plugins`
- ZCode: `.claude-plugin/` 호환 매니페스트를 인식하므로 같은 저장소를 마켓플레이스로 추가한다

## 요구 사항

- `bun` — AST 검사기(`scripts/typescript/*.ts`) 실행
- `node` + 대상 프로젝트의 `node_modules/.bin/tsc` — hover 검사(`05_inspect-hover.mjs`)만 사용
- 이 저장소에서 `bun install`(또는 `npm install`) — 검사기가 쓰는 `typescript@7`을 고정 설치. `install.sh`가 자동으로 실행한다.

## 규칙 단일 소스 원칙

과거에 같은 스킬이 `~/.codex/skills/`에 복사본으로 존재해 description·스크립트 경로·규칙이 정본과 갈라진 적이 있다. 이 플러그인은 그 갈라짐을 구조적으로 막는다:

- 규칙·스크립트의 원본은 이 저장소 하나뿐이고, 에이전트들은 symlink로 연결한다.
- 프로젝트 고유 거버넌스는 프로젝트 쪽 오버레이에 둔다. 예: 99_www는 이 스킬 자체를 바꿀 때 Woo Receipt(`CODE-READABILITY-MAINTAIN`)를 남기는 절을 자기 AGENTS.md·스킬 오버레이로 소유한다.
- 정본에 가까워진 규칙은 사용자 피드백으로 확정된 것만 이 저장소의 SKILL.md와 references에 반영한다.

스킬 본문의 명령 예는 `<SKILL>` 플레이스홀더(스킬 폴더 경로)를 쓰므로, 설치 위치가 어디든 동일하게 동작한다.
