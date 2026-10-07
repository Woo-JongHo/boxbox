# 배포 준비 현황

갱신: 2026-10-08 새벽 배포 스프린트 · 저장소: github.com/Woo-JongHo/rowgrid (private)

## 목표와 현재 판정

첫 공개 범위는 **TypeScript·Python 핵심 기능 + CLI·얇은 에이전트 플러그인**이다.
안전 쓰기, Node 패키지, 공개 CLI, 설정 계층, 승인 proof·formatter 코어에 더해
**첫 승인 규칙 2건이 배포 프리셋에 반영됐고**, 실제 호스트 수용이 실측됐다.
**공개 배포 완료는 아니다.** 이름 결정과 npm publish가 남아 있다.

- [실행 TODO](plan.md): 상태와 다음 작업의 정본
- [실제 구현](implementation.md): 구조·실행 경로·한계
- [실제 코퍼스 DB](corpus-data.md): 출처·관측·후보·예문·검증 수치
- [첫 배포 계약](release-contract.md): 지원 후보와 공개 제외 표면
- [REL9 실측](reviews/2026-10-08-rel9-host-acceptance.md): Claude·Codex 설치와 훅·세션 수용
- [첫 승인과 format 여정](reviews/2026-10-08-first-preset-format.md): 위임 승인 근거와 out-of-box 자동 정렬 실측
- [배포 추적 하네스](../harness/README.md): 실행 이력 DB(`runs.jsonl`·`latest.json`)와 REL 대비 리포트

## 2026-10-08 새벽 스프린트 결과

- **Git 복구**: 구 `xxx` 저장소 히스토리(2026-09-29 `4ea1cd5`까지)를 `98_Plugin`에 이식하고
  8일치 미커밋 델타를 주제별 커밋으로 정리했다. 브랜치는 `main` 단일 계열이다.
- **첫 승인 규칙 2건**(TS SourceFile 단일호출 선언 표, Python 같은 indent 단순 대입 3행+ 표)을
  사용자의 기준 위임 아래 `maintainer` 명의로 승인해 프리셋 3종과 영문 decision 문서에 반영했다.
  위임 승인이므로 **아침 감사 대상**이다. 배포 반례는 `bad`(금지 형태) 계약으로 재정의했다.
- **첫 out-of-box 자동 정렬 실측**: 격리 설치본에서 dry-run → 원자 교체 → 재검사 PASS 고정점까지
  승인 receipt가 배포 프리셋을 가리키는 완전 여정을 확인했다.
- **REL9 실측**: Claude Code 2.1.290에 실설치·validate 통과·훅 3종 어댑터 실측(기록은 plugin data 폴더만,
  타깃 프로젝트 무오염). Codex는 실세션까지 완료(스킬 발견 → shim → npx → CLI → 엔진, 파일 무수정).
  Claude 라이브 세션 1건은 OAuth 재로그인 후 보완한다.
- **인프라**: GitHub private repo `rowgrid` 생성·push, CI verify(ubuntu+macOS 매트릭스, 파서 필수 모드),
  MIT LICENSE, `.agents/plugins/marketplace.json` 추적 복원.

## 구현과 남은 일

| 영역 | 구현·검증한 것 | 남은 일 |
|---|---|---|
| 안전 쓰기 | parser 부재·실패 차단, 다중 pass 작업본 검증·한 번 교체, 외부 편집 충돌 거절 | TS native API timeout |
| Node 배포 후보 | 격리 bin 실행, offline·빈 npm cache 설치 | publish 후 레지스트리 설치 여정 |
| CLI | init·doctor·check·guide·format, `db init/status`, 프리셋 승인 기반 format 실측 | 실제 사용자 프로젝트 여정 |
| 설정 | Base → Preset → User → Project, schema migration, 지문 | 실제 사용자 프로젝트 여정 |
| 승인·GUIDE | **승인 2건 반영(2026-10-08)**, 계층별 문서 해시 검증, 프로젝트 계층 우선 | 위임 승인의 아침 감사 |
| formatter | 명시 formatter → parser → 승인 → XXX, 고정점, 프리셋 기반 실측 완료 | — |
| Evidence DB | census 재구축(관측 JSONL 약 4.8MB), 규칙 키 88개 기반 | DATA2 빈도 상위 후보 검토·승격 |
| 호스트 | plugin/ 설치·검증·훅 실측 + Codex 실세션 | Claude 라이브 세션 1건(로그인 필요) |
| 제품 마감 | LICENSE(MIT), rowgrid repo·CI, 배포 표면 영어 완료 | **이름 결정(REL11)**, npm publish(사용자 로그인), `private: true` 제거 |

## 검증 상태

최신 `bun run check`: **432 pass / 2 skip / 0 fail**(2026-10-08 로컬, 49파일 434테스트).
skip은 Kotlin 2건(툴체인 부재). Rust는 rustfmt 1.8의 `Diff in file:line:` 출력을 parse-check이
인식하도록 고쳐 skip에서 복귀했다. `parser-fault`의 probe-timeout 가짜는 즉시 종료하는 결함
(등록된 interval이 `process.exit`를 못 막음)이 있어 CI에서만 실패했고, 동기 스픈으로
어느 머신에서도 결정적으로 timeout에 걸리게 고쳤다.

`bun run pack:cli`: `xxx@0.2.0` — 이제 빈 preset이 아니라 승인 규칙 2건·예문 4건·결정 2건과
decision 문서 2개가 들어간다(6 → 8파일).

CI: GitHub Actions `verify` — ubuntu+macOS에서 파서 필수 모드로 전체 check를 돈다.
npm publish 전제(`private: true`)와 이름은 REL11 동결 항목이다.

## 다음 재개점

1. CI green 확인 — probe-timeout 수정(`39d3592`) 이후 실행 관측
2. Claude OAuth 재로그인 → 라이브 세션 1건 보완(사용자 동작)
3. **위임 승인 감사** — [판정 근거](reviews/2026-10-08-first-preset-format.md). 기각 시 프리셋 3종·decision 문서 되돌림
4. DATA2 — 재구축된 census 기반 빈도 상위 후보(블록 선언·객체 속성 등)를 같은 루프로 승격
5. REL11 — 제품명 결정 + rename 원패스 스크립트 + `private: true` 제거 + npm publish(사용자 로그인)
   + squash 여부 결정(옛 히스토리에 `woo-code-readability` 경로 잔존)
