# 첫 공개 배포의 구현 계약

2026-10-04 · 연속 개발용 기준. 배포 완료나 공개 채널 승인을 뜻하지 않는다.
사용자가 정한 범위는 TypeScript·Python 핵심 기능 + 엔진 CLI·에이전트 플러그인이다.

## 범위와 지원 증거

| 항목 | 구현 기준 | 실제 지원 판정 |
|---|---|---|
| 언어 | TypeScript·Python | 기존 fixture와 로컬 실행을 근거로 개발, 공개 artifact 검증은 별도 |
| 런타임 | Node 22 계열 이상을 후보로 pack 실험 | 현재 로컬 Node 22.22.3; Bun은 개발·빌드 도구로 유지 |
| OS | macOS·Linux를 최초 검증 대상으로 삼음 | 현재 macOS 로컬 증거만 있음. 기존 Linux CI 설정은 artifact 수용 증거가 아님 |
| 호스트 | Claude Code·Codex 얇은 어댑터 후보 | 기존 등록 파일·모의 테스트 있음. 배포 artifact의 실제 호스트 수용은 미확인 |
| 나머지 언어 | 기존 개발 엔진을 보존 | 첫 공개 CLI의 동일 지원 품질을 약속하지 않음 |
| Python | 실행 가능한 python3가 수정 시 필수 | 부재·실행 실패 시 수정 거절 |

Node 최저 minor, Linux 배포판·architecture, 호스트 버전은 artifact/호스트 실측 후 동결한다.
Windows는 이번 검증 목록에 넣지 않았으며 지원한다고 표시하지 않는다.

## 공개 명령 경계

- `check`: 읽기 전용 검사. 현재 Result schemaVersion 1의 그룹과 parse 상태를 유지한다.
  check의 `parse=not-run`은 재파싱 검증 완료를 뜻하지 않는다.
- `format`: 토큰 보존, 실행 가능한 파서, 사람 승인 규칙, formatter 순서가 모두 연결된 경우만 수정한다.
  어느 조건이든 미연결이면 명시적으로 거절한다. 구현 중 임시 우회 옵션을 공개하지 않는다.
- `init`: 버전이 있는 프로젝트 설정을 만들되 기존 사용자 파일은 덮어쓰지 않는다.
- `doctor`: 런타임·parser·설정·승인 데이터·배포 파일의 가용 상태를 보고한다. 미구현을 정상으로 표시하지 않는다.

CLI 인자·종료 코드·오류 JSON은 REL4에서 구현과 테스트로 고정한다. 제품 버전 0.2.0은 개발 메타데이터이며
출시 버전은 미정이다. Result/config schema 변경은 버전 변경과 migration 정책을 동반해야 한다.

## 쓰기 표면 목록

| 현재 진입점 | 현재 역할 | 공개 배포 처리 |
|---|---|---|
| `typescript/06_align-tables.ts --write` | AST 정렬·토큰·진단 검사, 다중 pass | 안전 교체와 승인/formatter gate를 거친 공개 명령으로만 연결 |
| `python/06_align-tables.ts --write` | 공통 라인 정렬·보존·진단 검사 | 같은 공개 gate로 연결 |
| `typescript/00_normalize-imports.ts --write` | import 분리·재배치 | 최초 공개 자동 수정 allowlist에서 제외 |
| `typescript/00_expand-interface-members.ts --write` | 압축 멤버 확장 | 최초 공개 자동 수정 allowlist에서 제외 |
| `typescript/07_wrap-conditions.ts --write` | 조건 chain 개행 | 최초 공개 자동 수정 allowlist에서 제외 |
| `typescript/08_function-map.ts --scaffold` | 함수 맵 주석 생성 | 최초 공개 자동 수정 allowlist에서 제외 |
| `typescript/09_observe-shapes.ts` | 로컬 Evidence 캐시 | 소스 수정 권한 없음. 공개 노출은 후속 결정 |
| 코퍼스·AI 평가·개발용 수정 스크립트 | 개발/연구 | 공개 엔진 artifact에서 제외 |

기존 저장소 스크립트를 삭제하는 목록이 아니다. 패키지 파일 allowlist·명령 dispatcher 테스트로
배포 경계를 강제하기 전에는 이 표만으로 우회가 막혔다고 주장하지 않는다.

## 사람 결정과 동결 시점

제품명·라이선스·registry namespace·공개 채널은 사용자 결정이 필요하다. REL11 전까지 결정하며,
현재 로컬 구현은 `xxx`/`XXX`, `private: true`를 유지한다. 로컬 빌드·pack·격리 설치 실험은 연속
진행 지시에 포함되지만 commit/tag/push/publish를 자동 실행하는 승인은 아니다.

관측 데이터나 AI 제안을 사람이 승인한 convention/decision으로 자동 승격하지 않는다.
승인 후보 자료는 만들 수 있지만 실제 승인 이력을 대신 작성하지 않는다.

이번 세션 별도 감사는 사용자 지시로 생략한다. 테스트·타입 검사·실제 실행은 유지한다.
