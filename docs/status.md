# 배포 준비 현황

갱신: 2026-10-06 (문서–코드 대조·검증 상태 갱신) · 기준: `8338798`와 현재 작업 트리

## 목표와 현재 판정

첫 공개 범위는 **TypeScript·Python 핵심 기능 + CLI·얇은 에이전트 플러그인**이다.
안전 쓰기, Node 패키지, 공개 CLI 기반, 설정 계층, 승인 proof와 formatter 코어를 구현했다.
공개 CLI와 설치 artifact의 GUIDE·format을 연결했다. **공개 배포 완료 상태는 아니다.**

- [실행 TODO](plan.md): 상태와 다음 작업의 정본
- [실제 구현](implementation.md): 구조·실행 경로·한계
- [실제 코퍼스 DB](corpus-data.md): 출처·관측·후보·예문·검증 수치
- [첫 배포 계약](release-contract.md): 지원 후보와 공개 제외 표면
- [다른 AI 검증 Handoff](handoff-2026-10-05.md): 코드 지도, 12개 보류 ID, 재현 명령과 독립 검토 질문
- [배포 추적 하네스](../harness/README.md): 실행 이력 DB(`runs.jsonl`·`latest.json`)와 REL 대비 리포트

## 구현과 남은 일

| 영역 | 구현·검증한 것 | 남은 일 |
|---|---|---|
| 안전 쓰기 | parser 부재·실패 차단, TS 다중 pass와 라인 엔진 작업본 검증·한 번 교체, 외부 편집 충돌 거절 | TS native API timeout, 다른 OS 실측 |
| Node 배포 후보 | 실제 Node 확인 후 격리 bin 실행, offline·빈 npm cache 설치 | Linux·지원 호스트 확인 |
| CLI | init·doctor·check·guide·format, `db init/status` 로컬 사용자 DB 관리, 설치본 합성 승인 여정 | DB 편집·가져오기·백업, 실제 사용자 승인 데이터와 호스트 여정 |
| 설정 | Base → Preset → User → Project, schema 1 메모리 migration, schema 2 부분 설정, 지문 | 실제 사용자 프로젝트 여정 |
| 승인·GUIDE | 정확 키·scope·계층, Decision·예문·반례·버전·문서 해시 검증 | 두 구체적 후보의 사람 승인 답변 대기 |
| formatter | 명시 명령 → parser → 승인 → XXX, 전체 두 번 실행의 고정점, 설치본·dry-run 검증 | 실제 프로젝트 formatter 사례 |
| Evidence DB | 8개 공개 저장소 7,759파일 → 표 관측 18,613건 / 규칙 키 88개, 자체 함수 311개 | 빈도 높은 후보 검토·승격; SQLite는 아직 미도입 |
| 호스트 | 기존 스킬·읽기 전용 inspector·관찰 훅 | 얇은 배포 어댑터와 호스트의 출력 수용 실측 |
| 제품 마감 | 임시 xxx/XXX, 0.2.0, private 유지 | 이름·라이선스·채널·영어 문서·업데이트/제거·배포 |

## 검증 상태

최신 `bun run check`: **403 pass / 5 skip / 0 fail**, 45개 파일·408개 테스트(2026-10-06 재확인).
`tsc --noEmit`과 `bash -n install.sh`도 통과했다. skip은 Rust 3건·Kotlin 2건이며 통과로 세지 않는다.
공개 preset 경계의 Sol 읽기 전용 검토에서 나온 항목을 수정했고, 마지막 재검토에서는 해당 범위에 추가
지적이 없었다. 이는 전체 저장소의 최종 독립 감사는 아니다.
[이번 DB 경계 기록](reviews/2026-10-04-public-preset-db-boundary.md)을 따른다.

2026-10-06 재검증 과정에서 재실행마다 1~3건이 기본 5초 테스트 timeout에 걸렸고(java 재파싱 5.7초, 공개
CLI format 거절 루프 등 — 단독 실행은 1~2초), 원인은 실제 툴체인(javac·tsc·formatter 자식 프로세스)을
띄우는 통합 테스트가 전체 스위트 부하에서 5초를 넘기는 것임을 확인했다. `package.json`의 `test`·`check`
스크립트에 `--timeout 60000`을 뒀다. 공개 CLI·Node artifact 격리 설치 2건은 별개 전제로
`npm install --offline`이 npm 캐시의 `typescript@7.0.2`를 요구하며 캐시가 비면 ENOTCACHED로 실패한다 —
이 수치를 증거로 인용할 때는 네트워크·캐시 전제를 함께 적는다.

최신 `bun run pack:cli`: `xxx@0.2.0` tarball **35,415 B 압축 / 144,583 B 해제, 6개 파일**.
CLI bundle·README·manifest·빈 preset JSONL 세 개만 들고, 실제 Node 격리 설치 여정은 공개 artifact
테스트가 실행했다. 공개 preset은 아직 0행이다.

## 다음 재개점

DATA1 최초 적재 뒤 현재 우선순위는 DATA2 후보 판정·보류 사례 해소다. 사람 승인 전에는 preset candidate를
approved로 바꾸지 않는다. 연구 Evidence는 `~/.cache/xxx/corpus/`에 분리돼 있으며 현재 관측 JSONL은
**18,613행 / 11,207,375 B**, 집계 signature는 **175,183 B**다. 공개 저장소 checkout까지 포함한 전체
연구 cache는 **715,920 KiB(약 699 MiB)**다. 이 데이터는 npm artifact에 포함되지 않는다.

플러그인 사용자 DB는 `xxx db init`으로 `$XDG_CONFIG_HOME/xxx` 또는 `~/.config/xxx`에 별도 빈 JSONL
세 파일을 만들고, `db status`는 행 수·바이트만 출력한다. 공개 preset JSONL 세 파일은 제작자 소유의
별도 배포 경계이며 현재 0행이다. 후보 88개와 대표 예문 225개(213개 통과·12개 보류)는 검토 자료다.

배포 blockers: 승인 데이터 부재, 실제 호스트·다른 OS 여정, 영어 번역, 제품명·라이선스·채널 결정,
최종 보안 검토다. `.claude-plugin/marketplace.json`의 `source: "./"`는 저장소 전체를 참조하므로
npm allowlist와 별개로 플러그인 패키지 분리가 필요하다. npm tarball은 연구 DB를 제외하지만 실행용
143,179 B JavaScript bundle은 포함하므로 CLI 구현을 비공개로 유지하는 설계는 아니다. npm publish·tag·commit은 하지 않았다.

저장소에는 전용 ESLint 명령이 없다. `bun run check`는 테스트·TypeScript 타입 검사·install shell 문법을
검사한다. 커스텀 정렬기로 `skills/xxx/scripts/`, `scripts/`, `test/`의 TypeScript 128개 파일을 읽기 전용
검사했을 때 인식한 1,027개 표 중 990개는 정렬됐고 37개는 기존 연구 파일 `scripts/eval.ts` 한 곳에서
검출됐다(207 edits). 이는 표 정렬 검사일 뿐 ESLint나 import 정규화까지 포함한 lint 적용률은 아니다.
2026-10-06에는 `scripts/eval.ts`(37표·import)와 import 미정규화 4곳(`public-preset.ts`·`cli.ts`·
`project-config.ts`·`public-preset.test.ts`)을 레포 자체 정렬기·정규화기로 정리했다(토큰 보존·재파싱 gate
통과, 영향 스위트 32개 재확인). 이로써 상시 확인 기준(`misaligned=0`·`changed=0`)을
`harness/` 포함 132개 파일에서 달성했고, 배포 추적 하네스의 self-align 스테이지가 이를 매 실행 검증한다.

Git은 `m1-safety-proof`, 추적 기준 27커밋 앞섰다. 미커밋 연구 파일을 보존했으며
commit·push·publish는 하지 않았다.
