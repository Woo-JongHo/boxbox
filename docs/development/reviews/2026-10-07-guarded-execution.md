# 2026-10-07 명시 실행기와 호출 증거

## 요청과 실제 경계

24 프로젝트에서 프로젝트 전용 실행기의 검사 성공을 현재 대화의 native hook 자동 발동으로
오해할 여지가 있었다. 사용자 요청에 따라 공개 배포 CLI에도 같은 기능을 옮겼다.
이번 변경은 기존 active DATA2 작업을 바꾸거나 완료하지 않는다. 기존 미커밋 파일은 보존했다.

- 저자: Codex. 이 문서는 구현·실행 증거이며 독립 최종 감사 승인이 아니다.
- 공개 인터페이스: `boxbox run --root <absolute-project> [--json] -- <argv...>` 및 `boxbox status --root <absolute-project> [--json]`.
- 코드: `skills/boxbox/scripts/common/guarded-run.ts`, `skills/boxbox/scripts/cli.ts`.
- 배포/호출 지시: `packaging/cli/README.md`, `skills/boxbox/SKILL.md` 추가 절.
- 별도 호스트 native hook 자동 발동은 검증하지 않았다. 결과도 항상 `nativeHookVerified=false`다.

## 보장

공개 CLI의 doctor runtimeUsable과 기존 inspectFile을 재사용한다. 명령 전후 코드 SHA를 비교하고
바뀐 TypeScript/Python만 검사한다. 지원되지 않는 코드 변경은 UNSUPPORTED다.
`.boxbox/runs/<UUID>.json`에 실행 전 RUNNING과 종료 상태를 원자적으로 기록한다.
명령 argv·환경 값·child stdout/stderr는 저장하지 않는다. 엔진 버전과 Node/Bun 런타임 버전은 저장한다.
일반 호출의 stdio는 inherit, JSON 호출의 자식 출력은 stderr 전달이다. 기본 출력은 결과와 receipt 경로만 요약한다.
NO_CHANGES·미호출·검사 오류는 PASS가 아니며, 실행 밖 코드 변경은 status가 STALE로 보여준다.

## 검증

1. `bun test test/guarded-run.test.ts test/cli.test.ts test/public-artifact.test.ts`
   - 최초 21 tests / 229 assertions PASS.
   - artifact 시험은 tarball 생성 → npm offline 격리 설치 → Bun 없는 PATH의 Node CLI 사용.
   - 설치된 CLI run PASS, status PASS, 실행 밖 수정 후 STALE 검증.
   - 기존 공개 format의 승인·고정점 안전 계약도 같은 테스트에서 유지 확인.
2. 추가한 검사 FAIL/예외·child 결과 보존 시험은 별도 최종 target 실행에 포함했다.
3. `bunx tsc --noEmit` PASS.
4. 변경한 TS 4파일의 import normalization 및 표 정렬 검사 수행. 결과 로그는 이 문서 인접 evidence 디렉터리에 보존한다.
5. 원본 프로젝트에서 실제 실행기를 감싸 자기 변경을 검사했다.
   - `4bc2a81c-3cfd-425a-94e0-5f5df9aca117`: 새 테스트 코드 정렬 FAIL.
   - `c9ea817e-2fea-450f-99a0-16691277a40b`: 명시 정렬 수정 후 PASS; checked=1, changed=1.
   - 위 PASS의 automaticFixPerformed=false는 guard 자체가 자동 수정하지 않았다는 뜻이다. child 명령이 명시적으로 정렬했다.

초기 artifact 시험은 npm offline cache의 typescript@7.0.2 부재로 실패했다. 캐시를 정상 채운 뒤 재실행해 통과했다.
또 런타임 메타데이터 키 `bun:`이 기존 bundle 금지 문자열 검사에 걸려 `bunVersion`으로 수정했다.
status의 after snapshot 완료 플래그 누락도 실제 격리 시험이 탐지해 수정했다.

## 남는 범위

배포물은 개발 후보이며 npm publish하지 않았다. 호스트 plugin 설치·trust·실제 세션 수용과
skill의 구조 단순화 수행은 이 CLI 시험만으로 검증되지 않는다. 실행기 밖 편집은 막지 못한다.
디렉터리 symlink는 따라가지 않으며 receipt ignoredSymlinks에 제외 링크를 기록한다.
파일 symlink 대상 해시는 비교하지만 변경된 링크는 승인하지 않는다. 제외 디렉터리·언어·확장자 계약은 패키지 README를 따른다.
증거 기록은 로컬 관측이지 같은 권한의 악의적 child에 대한 조작 방지 원장이 아니다.
강제 종료된 RUNNING 기록은 완료로 처리하지 않는다. 자동 복구·실행 재개는 구현하지 않았다.

> Historical naming note (2026-10-12): this record predates the confirmed product name `boxbox` and npm package `boxbox`. Maintained links and examples use the current names; earlier placeholder-name findings are historical, not current naming blockers. Raw execution evidence remains unchanged.
