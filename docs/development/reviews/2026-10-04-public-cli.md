# REL4 — 공개 CLI 기반과 패키징 검증

2026-10-04. 사용자 연속 진행 승인으로 구현했다. 별도 감사는 생략했다.
이 기록은 REL4 시점이며 이후 설정 계층 확장은 REL5에서 기록한다.

## 사용자 명령

- `boxbox --help`, `boxbox --version`
- `boxbox init [--json]`: 당시 schema 1 설정 생성, 기존 설정과 사용자 파일 보존.
- `boxbox doctor [--json]`: Node/Python/config/승인 데이터와 미연결 조건 보고. 준비되지 않은 항목이 있어 종료 1.
- `boxbox check --file <path> [--language typescript|python] [--json]`: 프로젝트 안 단일 파일 읽기 전용 검사.
- `boxbox format --file <path>`: 승인·formatter gate 미연결로 명시적으로 거절.
- `boxbox format --file <path> --dry-run`: formatter를 실행하지 않은 읽기 전용 엔진 검사임을 표시.

설정이 있으면 strict schema와 활성 언어를 확인한다. 경로는 lexical·realpath 포함 관계를 확인하고
symlink 및 부모 symlink를 통한 프로젝트 밖 탈출을 거절한다. JSON 오류는 stdout의 단일 envelope다.
`check`는 기존 Result schema 1을 유지하며 명령 오류·init·doctor는 command별 envelope를 쓴다.

## 패키지

- `bun run build:cli`: 별도 `dist/cli` 산출물.
- `bun run pack:cli`: 공개용 CLI 형태의 로컬 tarball 생성. `private: true`이며 공개 registry에 게시하지 않았다.
- 파일은 `README.md`, `dist/cli.js`, `package.json` 세 개뿐이다.
- `bin.boxbox`만 노출하고 REL3 internal runner, raw 06, 보조 writer와 Bun 참조를 포함하지 않는다.
- Node >=22.22.3, TypeScript 7.0.2 dependency. 로컬 macOS arm64에서 검증했다.

실제 tarball을 저장소 밖에 offline npm 설치한 뒤 `.bin/boxbox`를 Bun 없는 PATH에서 실행했다.
help/version/init/doctor/check/dry-run/format 거절 흐름과 모든 원본 불변을 59 assertions로 확인했다.
REL3 내부 실행 증명 artifact와 분리되어 내부 쓰기 실험이 공개 명령의 우회로가 되지 않는다.

## 검증 결과

- CLI 전용: 10 pass.
- CLI + 공개 artifact + 기존 REL3 artifact: 12 pass, 0 fail, 169 assertions.
- `bun run check`: **352 pass / 5 skip / 0 fail**, 357 tests / 39 files, 약 54초, 종료 0.
  타입 검사와 설치 shell 문법 검사 포함.
- 기존 Rust/Kotlin parser 환경 skip은 그대로 남는다. Linux·Windows·실제 에이전트 호스트 수용은 미확인이다.

원본 기록:

- `/tmp/boxbox-public-cli-notes.md`
- `/tmp/boxbox-public-artifact-notes.md`
- `/tmp/boxbox-release-continuation/check-cli.log`

REL4의 완료는 공개 명령 기반과 쓰기 거절 동작에 한정된다. 승인 데이터·GUIDE·formatter·전체
수정 여정과 제품명·라이선스·공개 채널 결정 없이 배포 준비 완료로 세지 않는다.

## 실행 런타임 증거 정정 — 2026-10-04

초기 artifact 테스트는 `bun test`의 `process.execPath`를 node 이름으로 연결했다.
실제로 Bun이 실행됐으므로 위 최초 결과는 Node 단독 실행의 증거로 사용할 수 없다.
후속 테스트는 `node -p process.execPath`로 실제 Node를 찾고 `process.versions.bun`이 없음을
확인하도록 수정한다. 확정된 재실행 결과는 후속 format 통합 기록을 따른다.

> Historical naming note (2026-10-12): this record predates the confirmed product name `boxbox` and npm package `boxbox`. Maintained links and examples use the current names; earlier placeholder-name findings are historical, not current naming blockers. Raw execution evidence remains unchanged.
