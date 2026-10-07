# 설정·승인·formatter 공개 CLI 통합

2026-10-04 · 사용자 연속 진행 지시 · 별도 감사 미실행

## 구현 범위

- 설정: schema 2 부분 계층과 schema 1 메모리 migration, Base → Preset → User → Project,
  formatter command/args/timeout, 설정 출처와 지문. 안전 조건은 설정으로 끌 수 없다.
- 승인: exact lookup key와 scope·계층 우선순위, Convention → Decision → 예문·반례의
  버전·승인 정보·해시 검증. registry 경로 탈출과 symlink를 거절하고 문서 root는 층별로 해석한다.
- GUIDE: 파일에서 검출한 키에 대응하는 검증된 after-better만 반환한다.
- format: 원본과 같은 디렉터리의 작업본에 formatter → parser → 승인 → XXX를 실행하고,
  전체 과정을 다시 적용해 byte 고정점을 확인한 후 원본을 한 번 교체한다.
- dry-run: 같은 formatter·승인·parser·고정점 검사를 실행하되 원본을 바꾸지 않는다.
- 실패: 승인 없음·거절·충돌·stale 문서, parser 오류, formatter 실패·timeout, 비고정점,
  외부 편집과 설정/승인 지문 변경에서 쓰기를 거절한다. timeout은 1..60000ms다.
- 프로세스: shell 없이 실행하며 POSIX process group에 timeout 종료를 전달한다.
  stdout/stderr는 각각 64 KiB까지만 보고한다. 출력 잘림 자체를 실패로 세지는 않는다.
- doctor: runtimeUsable과 formatConfigured를 분리한다. 성공은 환경 진단이며 파일별 승인이나
  공개 배포 준비의 성공이 아니다. releaseReady는 아직 false다.

## 실제 사람 승인 상태

[두 규칙 후보](../candidates/initial-rules.md)를 사용자에게 제시했다. 답변 대기 중이며
preset의 convention/example/decision은 모두 비어 있다. 합성 승인 테스트는 제품 규칙 승인이 아니다.
TS 키는 const/let/var를 구분하지 않고 2행 이상을 포함한다. Python 키는 들여쓰기 깊이를
구분하지 않으며 같은 indent의 단순 대입 3행 이상에 적용된다.

## 실행 증거와 정정

초기 artifact 검증은 Bun의 process.execPath를 node 이름으로 사용했다. 따라서 최초의
Node 단독 실행 주장은 철회하고 실제 Node를 선택하는 테스트로 고쳤다. 후속 결과를 아래 기록한다.

- 정정된 두 artifact 테스트: 실제 Node 22.22.3, Bun 식별자 없음, 2 pass / 141 assertions.
  설치된 bin에서 GUIDE·승인된 format·고정점과 미승인 거절을 확인했다.
- 빈 npm 캐시를 사용하는 별도 `/tmp` 프로젝트에서 registry 의존성 설치 후 help/init/doctor 성공.
  로그: `/tmp/xxx-release-continuation/clean-install.json`.
- 통합 전체 검사: **386 pass / 5 skip / 0 fail**, 42개 파일·391개 테스트, 1549 assertions,
  71.70초. tsc·shell 검사 포함 종료 0. 로그 `/tmp/xxx-release-continuation/check-format-final.log`.
- CI YAML 파싱과 `git diff --check` 통과.
- 전체 자체 정렬: 124개 TS 파일 중 기존 `scripts/eval.ts`만 import·정렬 실패. 이번 변경 파일은
  모두 통과했으며 연구 파일은 수정하지 않았다. `/tmp/xxx-release-continuation/selfcheck.json`에 기록했다.
- 실제 호스트 수용과 Linux CI 실행은 이번 로컬 증거에 포함하지 않는다.

## 다음 배포 작업과 한계

TS native API timeout, 실제 프로젝트 formatter 사례, 얇은 호스트 어댑터·출력 수용,
지원 OS의 깨끗한 설치·업데이트·제거, 제품명·라이선스·영어 배포 문서가 남는다.
파일 교체는 협력 잠금과 최종 identity/bytes 비교에 기초하며 커널 compare-and-swap이나
여러 파일 트랜잭션·ACL/xattr·전원 장애 내구성을 보장하지 않는다.
외부 formatter는 프로젝트에서 신뢰한 실행 파일이며 샌드박스가 아니다.

CI에는 [setup-node 공식 문서](https://github.com/actions/setup-node)의 node-version 입력으로
22.22.3을 지정하고 offline artifact 테스트 전 npm 캐시를 별도 임시 디렉터리에서 준비한다.
이는 workflow 구성 변경이며 실제 GitHub 실행 성공 기록은 아니다.

commit·push·registry publish는 수행하지 않았다.
