# Plan

XXX의 제품 방향은 [`design.md`](design.md), 현재 구현 사실은
[`implementation.md`](implementation.md), 짧은 재개 화면은 [`status.md`](status.md), 배포까지의 작업 순서와
완료 판정은 이 문서가 소유한다.

## 현재 목표와 계획 상태

**사용자 목표(2026-10-04): 이 서비스를 실제 배포할 정도까지 구현 완료한다.** 첫 공개 범위는
사용자가 고른 **TypeScript·Python 핵심 기능 + 엔진 CLI + 얇은 에이전트 플러그인**이다. 기존
10개 언어 엔진은 보존하지만 Java·Go·Rust·JavaScript·C·C++·Swift·Kotlin의 동등한 제품 품질은
첫 배포의 완료 조건이 아니다.

배포 산출물은 기존 설계대로 둘이다.

1. `xxx` 엔진 CLI 패키지: 사람, CI, 훅, 에디터, 에이전트가 같은 `check`·`format`·`init`·`doctor`
   계약을 호출한다. 목표 호출 예시는 `npx xxx …`이지만 Node/npm만으로 실제 동작하는지는 REL3에서
   산출물 설치 실험으로 확정한다.
2. 얇은 에이전트 플러그인: `SKILL.md`, 읽기 전용 inspector, 호스트 매니페스트와 훅 어댑터만
   포함하고 엔진 CLI를 호출한다. 엔진과 규칙 데이터는 한 벌만 배포한다.

배포판의 필수 사용자 여정은 깨끗한 환경에서 다음 순서가 재현되는 것이다.

```text
설치 → xxx init → xxx doctor → xxx check → xxx format → xxx check
     → 지원 호스트에서 같은 엔진 호출 → 업데이트 → 재검사 → 제거
```

`format`은 프로젝트 formatter를 먼저 실행하고 XXX를 마지막에 적용한다. 자동 수정은 설치된 parser,
사람이 승인한 규칙, 쓰기 전후 안전 검사를 모두 통과할 때만 허용한다. 단계 하나라도 불명확하면
보고만 하고 파일을 쓰지 않는다.

이 계획은 **저작 초안**이다. 첫 공개 범위 선택만 사용자가 2026-10-04에 확정했다. 작업 순서,
완료 기준, 기술 결정은 독립 검토·반박·추적성 확인과 사용자 수락 전까지 확정으로 간주하지 않는다.
지원 OS와 첫 지원 호스트의 조합은 REL1에서 확정한다. Claude Code·Codex를 초기 호스트 후보로
두되 아직 확정된 지원표는 아니다. 제품명·라이선스·공개 채널은 REL1에서 결정 책임과 시한을
기록하고 REL11 동결 전에 확정한다.

### 이번 세션의 검증 범위 — 사용자 결정 (2026-10-04)

사용자는 처음에 토큰 제약으로 별도 감사를 생략하라고 했지만, 이후 공개 데이터 경계 검증을
다른 모델 Sol에 요청했다. Sol은 읽기 전용으로 중첩 schema, 경로·symlink, 중복 JSON key,
`example.rules` 배열, Decision 승인 문서의 형제 절 노출을 지적했다. 수정 뒤 최종 재검토에서 이
범위의 추가 finding은 없었다. 기록은 [DB 경계 검토](reviews/2026-10-04-public-preset-db-boundary.md)에
있다. 이는 공개 preset 경계의 제한된 검토이며 전체 저장소의 최종 감사나 Claude Sonnet 5·Opus
검토를 대체하지 않는다. 배포 전 전체 검증 요구는 유지한다.

## 현재 근거와 해석 한계

- [`implementation.md`](implementation.md)의 코드 대조 결과, 언어별 개발용 Bun 스크립트와 별도 Node 공개 CLI가 있다.
  `init`·`doctor`·`check`·`guide`·`format`, 설정 계층·승인 gate·formatter 파이프라인을 구현했다.
- `install.sh`는 로컬 링크/복사와 제거를 시험하지만 복사된 skill의 독립 dependency, 훅 등록,
  패키지 업데이트, 공개 artifact 설치는 보장하지 않는다. `package.json`은 아직 `private: true`다.
- 안전 gate의 공통 적용 범위는 `06_align-tables.ts`다. REL2a에서 공통 엔진의 parser 부재·실행 실패 쓰기를 차단했다.
  `00_normalize-imports.ts`·`00_expand-interface-members.ts`·`07_wrap-conditions.ts`·`08_function-map.ts --write`는
  같은 gate를 공유하지 않는다. 2026-09-28의 M1 “every write”와 169 tests는 당시 기록이며,
  현재 전체 쓰기 표면의 보장을 뜻하지 않는다.
- 최신 전체 기계 검증 기록은 `403 pass / 5 skip / 0 fail`이며 2026-10-06 재확인됐다. 같은 날 재실행에서는
  실행마다 1~3건이 기본 5초 테스트 timeout에 걸렸는데(단독 실행은 통과), 실제 툴체인(javac·tsc·formatter
  자식 프로세스)을 띄우는 통합 테스트의 부하 민감성 때문이라 `test`·`check` 스크립트에 `--timeout 60000`을
  뒀다. artifact 격리 설치 2건은 `npm install --offline`이 npm 캐시의 `typescript@7.0.2`를 요구하는 별개
  전제다. skip과 실제 호스트 미실측을 배포 통과로 세지 않는다.
- 승인 proof를 공개 format과 GUIDE에 연결했으나 preset DB는 비어 있다. 두 구체적 후보의 사람
  승인 답변을 기다린다. 기존 raw writer는 승인 정책을 우회하므로 공개 artifact에서 제외한다.
- AI 모델 평가는 연구 도구이며 제품 실행 경로가 아니다. E1 전체 모델 평가, SQLite, 10개 언어 동등
  품질은 명시 보류하고 첫 배포 blocker로 자동 승격하지 않는다.

## 실행 규율

상태 표기: `⬜ todo` · `▶ active` · `✅ done` · `⏸ blocked/보류`.

1. `▶ active`는 항상 하나만 둔다. 현재 active는 PKG1 Claude Code·Codex 플러그인 배포 구조다(2026-10-07 사용자 지시, DATA2는 보류). 승인 대기와 독립적인 다음 구현은 REL9 호스트 어댑터다. 배포 범위의 미결정과 독립적인 안전 보완을 먼저 진행한다.
2. 각 REL은 선행 작업, 현재 구현, 남은 일, 수락 기준, 검증 증거가 모두 있어야 완료 후보가 된다.
3. 검증의 **기존** 표시는 지금 존재하는 명령으로 확인한다는 뜻이고, **신설** 표시는 해당 REL에서
   먼저 검증기를 구현해야 한다는 뜻이다. 명령 이름만 계획에 있다고 증거가 되지 않는다.
4. 2026-10-04 사용자가 “쭉 진행”을 지시했다. 검증된 구현 뒤 다음 단계로 연속 진행하며 매 단계의
   수락을 다시 묻지 않는다. 되돌릴 수 있는 구현·로컬 검증은 이 승인에 포함한다. 제품명·라이선스와
   사람의 규칙 승인, 공개 publish처럼 별도 결정이 필요한 행위는 승인된 것으로 간주하지 않는다.
5. 구현 완료, 계획 수락, 최종 감사, 공개 배포는 서로 다른 상태다. tag·push·registry publish와 실제
   외부 설치 확인 전에는 “배포 완료”라고 하지 않는다.

## 현재 구현 — OBS1 코드 형태 관측 DB

**✅ done — 구현·기계 검증 후 2026-10-04 사용자가 다음 작업 진행을 지시했다. 별도 감사는 이번 세션 생략.** TypeScript 이름 있는 함수 선언의 구조를
읽기 전용으로 관측하는 최소 수집기를 구현한다. [설계 검토](reviews/2026-10-03-codex-code-shape-db-review.md)를 따른다.
이는 S5c의 보조 실험이며 REL6 승인 DB 적재의 선행 조건이 아니다.

- **범위:** 명시적으로 선택한 TS 파일, 함수의 직접 자식 문장, 순서·범위·중첩 관계·구조 해시.
  SQLite, Python 함수 관측, 자동 규칙 승인, GUIDE/수정 연결은 이번 범위 밖이다.
- **산출물:** `skills/xxx/scripts/typescript/09_observe-shapes.ts`,
  `test/shape-observation.test.ts`, 구현·현황 문서 갱신.
- **저장:** `.xxx/cache/shape.jsonl`의 재생성 가능한 Evidence. 버전·지문·스캔 범위·완료 여부를
  기록하고 미분류와 적용 불가를 구분한다. 실패한 스캔으로 정상 스냅샷을 덮어쓰지 않는다.
- **수락 기준:** 같은 입력의 결정성, 버전/설정 변경의 지문 변화, 중첩·동명·같은 줄 함수의 구별,
  부분 실패 표시, 소스와 승인 DB 무변경, 제한된 캐시 보존을 실제 파서와 파일로 검증한다.
- **검증 명령:** `bun test test/shape-observation.test.ts`, 실제 CLI 임시 프로젝트 실행,
  변경 TS의 import 정규화·정렬 확인, `bun run check`, `git diff --check`.
- **증거:** 전용 9개 테스트와 실제 CLI 정상/부분 실패/잠금/크기 경계를 확인했다. 전체 검사
  **315 pass / 5 skip / 0 fail**, 타입·설치 스크립트 검사 통과.
  [검증 기록](reviews/2026-10-04-shape-observation.md)에 재현 명령과 한계를 남겼다.
- **검토 상태:** 구현·기계 검증 결과를 기록했다. Claude Sonnet 5 독립 검토와 Opus 최종 감사는
  사용자 지시로 이번 세션에는 생략한다. 감사 통과로 간주하지 않으며 세션 진행을 막지 않는다.

## 현재 구현 — REL2a 파서 실패 시 쓰기 차단

**✅ done — 구현·기계 검증 후 2026-10-04 사용자 연속 진행 지시.** REL2의 범위 중 공통 재파싱 검사 한 모듈을
먼저 보완한다. 지원 OS·호스트 결정과 무관하게 검증 불가한 쓰기를 거절하는 안전 조건이다.
REL1 전체 확정이나 REL2 전체 완료로 간주하지 않는다.

- **해결한 문제:** 파서 부재에 `skipped`가 반환되거나 실행 실패가 빈 진단으로 오인되어 쓰던 경로를
  오류로 종료하도록 바꿨다. 변경 전 실제 Python CLI에서 파서 누락·비정상 종료 모두 성공하며 쓰는 것을 재현했다.
- **범위:** `skills/xxx/scripts/common/parse-check.ts`와 파서 fault 회귀 테스트.
  파서 부재·실행 실패는 쓰기 전에 오류로 종료한다. 정상 도구의 진단 비교는 보존한다.
  테스트용 `parserAvailable`의 로컬 skip과 CI 필수 파서 계약은 별도로 유지한다.
- **수락 기준:** 누락·실행 오류·timeout·signal·진단 없는 비정상 종료에서 오류가 나고,
  실제 Python `06 --write` 호출이 비영 종료하며 원본 bytes를 유지한다. 필수 파서 환경변수로 우회할 수 없다.
- **검증:** 전용 fault 테스트, 기존 parse/preservation 테스트, 실제 Python 정상·실패 CLI,
  변경 TS 정렬·import 확인, `bun run check`와 `git diff --check`.
- **증거:** 전체 검사 **326 pass / 5 skip / 0 fail**, 전용 fault 11개 통과.
  실제 Python CLI 실패 세 경우는 종료 1·원본 byte 보존, 정상 경로는 수정 후 멱등을 확인했다.
  [검증 기록](reviews/2026-10-04-parser-fail-closed.md)에 재현과 한계를 남겼다.
- **미포함:** TS multi-pass 원자성, 보조 쓰기 gate, 승인 DB 연결, 공개 Result 오류 정규화는 남는다.
  별도 감사는 이번 세션 사용자 지시에 따라 수행하지 않는다.

## 현재 구현 — REL2b TS 다중 pass 원본 보존

**✅ done — TS·라인 엔진 안전 교체와 통합 검증 완료.** 모든 정렬 pass와 재파싱·수렴 검증을 임시 작업본에서
마친 후 최초 원본과의 충돌을 확인하고 한 번만 교체한다. 검증 실패·예외·수렴 실패가 원본에
중간 결과를 남기지 않도록 한다.

- **범위:** TS `06_align-tables.ts`의 write orchestration, 필요한 파일 교체 helper와 회귀 테스트.
- **수락 기준:** 정상 출력·멱등 보존, pass 중 실패·재파싱 실패·최대 pass 초과·교체 실패 시
  최초 원본 유지, 동시 외부 편집 덮어쓰기 거절, 임시 파일 정리와 파일 mode 보존.
- **검증:** 실제 TS CLI 왕복과 실패 주입 테스트, 기존 TS 정렬/보존/Result tests, 전체 check.
- **통합 증거:** REL2c 공통 라인 엔진 안전 교체와 REL3 Node artifact 실증까지 통합했다.
  전체 **341 pass / 5 skip / 0 fail**, tsc·설치 shell 검사 통과.
  [안전 교체·artifact 기록](reviews/2026-10-04-atomic-node-artifact.md)을 따른다.
  별도 감사는 이번 세션 생략한다.

## 현재 구현 — REL4 공개 CLI 기반

**✅ done — 명령 계약 구현; 실제 Node 증거는 REL8 정정 검증을 따른다.** `init`·`doctor`·`check`·help/version과 공개 bin을 구현한다.
당시 미연결된 승인·formatter 조건에서는 쓰기를 거절했다. REL8에서 전체 파이프라인을 연결했으며,
현재 dry-run도 실제 formatter·승인·고정점 검증을 수행하고 원본만 보존한다.

- **범위:** 순수 CLI 모듈, 최소 버전 config, command/오류 계약, 공개용 별도 private artifact.
  공개 artifact는 raw write internal runner와 보조 writer를 포함하지 않는다.
- **수락 기준:** 재-init 사용자 파일 보존, 손상 설정 거절, 상태를 숨기지 않는 doctor, TS/Python check,
  JSON·종료 코드, format 거절·dry-run 원본 보존, Bun 없는 격리 설치본 bin 실행.
- **검증:** CLI 전용 회귀, npm pack/offline install 실제 여정, 전체 check와 자체 정렬.
- **남은 경계:** config 전체 계층은 REL5, 승인 DB·GUIDE는 REL6/7, formatter 실제 실행은 REL8이다.

## 현재 구현 — REL5 설정 계층 / REL6 승인 후보 준비

**✅ done — 설정 계층 전용 18개 테스트와 설치본 회귀 통과.** Base → recommended Preset → User → Project 설정을
결정적으로 합친다. 안전 조건은 설정으로 해제하지 못한다.

- **설정 범위:** v2 부분 설정, 기존 v1 languages의 메모리 내 migration, 언어·명시 formatter command/args/timeout,
  지문과 출처, unknown·충돌·손상·경로 탈출 거절. 실제 formatter 실행은 REL8에서 연결한다.
- **검증:** 계층 우선순위, v1 무변경, 손상/미래 버전/안전 override 거절, 지문 결정성,
  CLI와 격리 artifact 회귀.
- **병행 REL8 준비:** 명시 formatter → 승인 gate → XXX → 두 번째 전체 실행의 고정점을
  작업본에서 검증하는 format pipeline core를 구현한다. formatter 실패·시간 초과·승인 불충분·
  비고정점에서는 원본을 보존한다. 공개 CLI 연결은 core 검증 후에 한다.
- **병행 REL7 준비:** 기존 정확 조회 키를 유지하는 승인 proof 검사와 GUIDE core를 구현한다.
  convention과 같은 id의 Decision, 사람 승인 정보, 예문·반례와 내용/문서 해시가 확인된 경우만
  적격으로 판정한다. 후보·충돌·거절·stale은 쓰기 근거와 GUIDE에서 제외한다. 실제 DB 승인은 생성하지 않는다.
- **병행 REL6 준비:** TS/Python 기본 패턴 각 하나의 synthetic 예문·반례·실행 증거를
  `docs/candidates/`에 candidate로 기록한다. 사람 승인 전 preset에 적재하거나 approved로 바꾸지 않는다.
- **남은 결정:** 후보의 채택은 완성된 전후 비교 자료를 사용자에게 제시해 선택받는다.
  제품명·라이선스·publish 승인은 별개다. 별도 감사는 이번 세션 생략한다.

## 현재 구현 — REL8 공개 CLI 통합

**✅ done — 공개 명령·설치 artifact 통합과 전체 기계 검증 완료.**

- 승인 core: 정확 조회 키, 층별 문서 root, 결정·예문·반례·해시·버전 검증. 관련 30개 테스트 통과.
- formatter core: shell 없이 명시 명령을 작업본에 실행하고 parser → 승인 → XXX를 적용한다.
  전체 과정을 두 번 실행해 byte 고정점을 확인한 뒤 한 번만 교체한다. dry-run도 같은 검증을 수행한다.
- 후보 규칙 두 개를 실제 TS 2행 예외·Python 들여쓰기 범위에 맞춰 문서화했다. 사용자 승인 답변 대기이며
  preset 데이터는 아직 비어 있다. 이 대기를 구현·합성 테스트의 blocker로 삼지 않는다.
- 검증: 실제 Node 22.22.3 설치본 GUIDE/format, 빈 npm 캐시 설치 성공. 전체 check
  **386 pass / 5 skip / 0 fail**, 타입·shell 검사 통과. 자체 정렬 124개 중 기존 `scripts/eval.ts`만 실패.
- [통합 검증 기록](reviews/2026-10-04-format-integration.md)에 Node 증거 정정과 남은 한계를 남겼다.

## 현재 구현 — REL6 최초 승인 데이터

**⏸ 승인 답변 대기 — 후보를 제시했으나 아직 실제 승인은 없다.** 답변 전에는 candidate를 approved로
바꾸지 않는다. TS/Python의 실제 조회 키 범위와 전후 예문은 `docs/candidates/initial-rules.md`다.
승인된 항목만 세 preset DB와 문서 hash에 반영하고 설치본 여정을 다시 검사한다.
다음 독립 구현은 REL9의 얇은 CLI 호출 어댑터이며, 실제 호스트 수용은 아직 미실측이다.

## 현재 구현 — DATA1 실코드 DB 적재

**✅ done — 2026-10-04 최초 실제 코퍼스 적재·기계 검증 완료.**
기능 기반 작업에서 데이터 수집·검증·후보 축적을 우선하는 것으로 방향을 바꾼다.

- manifest에 고정된 공개 TS/Python 8개 저장소를 가져오고 commit 일치를 확인한다.
- 검출 표의 원본 관측·정확 조회 키·출처·파일 hash를 JSONL에 저장하고 빈도별 후보를 만든다.
- 대표 전후 비교와 실패/미분류를 분리해 사람 검토 자료로 내보낸다. 성공한 자료만 세고,
  기존 preset에 자동 승인하지 않는다. 후보·관측·승인 데이터 수치를 각각 보고한다.
- 재실행 중복 방지, 출처 추적, 부분 실패 표시와 기존 안전 검사로 검증한다.
- 결과: 8개 저장소·7,759파일에서 **18,613개 관측 / 88개 정확 키 / 대표 225개**를 적재했다.
  213개 예문 통과, 11개 행 대응·1개 timeout 보류. 사람 승인은 0개다.
- 자체 함수 관측은 65파일·311함수·154구조로 확장했다.
- 전체 check **393 pass / 5 skip / 0 fail**, 이후 후보 전용 6개 테스트·타입 검사 통과.
  원본·preset 무변경, ID·hash·집계 검증을 마쳤다. [DB 현황](corpus-data.md)에 범위와 재현을 기록했다.
- 감사·외부 AI 평가 호출은 이번 세션에 수행하지 않는다.

## 현재 작업 — PKG1 Claude Code·Codex 플러그인 배포 구조

**▶ active — 2026-10-07 사용자 지시: 오늘 목표는 코덱스와 클로드에 플러그인으로 갈 수 있는 구조.**

- **근거:** 공식 `claude plugin validate --strict`가 현재 루트 플러그인을 거절한다(`agents`는 `.md` 파일 경로여야 함).
  디렉터리 제출 체크리스트는 플러그인 폴더 안 파일만 설치되며 파일 512개·파일당 256KiB 이하, 바이너리 금지,
  launcher는 정확한 버전 고정을 요구한다. TS 엔진은 typescript@7 네이티브 바이너리(26MB)에 의존하므로 플러그인에
  넣을 수 없다 → `release-contract.md`의 두 산출물 설계대로 **엔진 = npm CLI, 플러그인 = CLI를 부르는 얇은 어댑터**.
- **구조:** `plugin/` 한 폴더에 `.claude-plugin/plugin.json`(Claude)과 `.codex-plugin/plugin.json`(Codex 호환 overlay),
  공통 `skills/xxx/`(CLI 전용 SKILL.md·references 사본), `agents/`(Claude 읽기 전용 inspector), `hooks/hooks.json`,
  `scripts/xxx`(정확 버전 고정 `npx` shim), README. 저장소 루트는 `.claude-plugin/marketplace.json`과
  `.agents/plugins/marketplace.json`이 `./plugin`을 가리키는 marketplace만 맡는다.
- **훅:** 상태는 사용자 프로젝트가 아니라 `${CLAUDE_PLUGIN_DATA}`(Codex도 설정)에 쓴다. `--root`가 없으면 입력 `cwd`를 쓴다.
  Codex 편집 도구 `apply_patch`를 matcher에 넣는다. Codex Stop 입력에는 `stop_hook_active`가 없으므로 Stop은 세션당 한 번만 막는다.
- **단일 소스:** references 사본과 version은 `scripts/sync-plugin.ts`가 만들고 `--check`로 drift를 테스트한다.
- **남은 결정(이 작업을 막지 않음):** 제품명·라이선스, npm 공개(공개 전에는 shim의 `npx`가 실제로 받을 패키지가 없다).
- **수락 기준:** `claude plugin validate --strict ./plugin`과 marketplace 검증 통과, Codex marketplace 등록·목록 확인,
  sync drift·shim·훅 테스트와 `bun run check` 통과.
- **2026-10-07 구현·검증:** `claude plugin validate --strict` 플러그인·marketplace 통과. 격리 설정(CLAUDE_CONFIG_DIR)에서
  Claude Code 2.1.286 설치 → 스킬 1·agent 1·훅 3 인식(매니페스트 `agents` 배열이 있으면 agent 0개로 보여 기본 위치 탐색으로 바꿈).
  격리 CODEX_HOME에서 Codex 0.160.1 `marketplace add` → `plugin add` → installed, enabled. hooks.json → shim → 정확 버전
  npx(가짜) → CLI 훅 E2E 테스트 통과. 전체 428 pass / 5 skip / 1 fail(기존 npm 캐시 전제의 node-artifact), tsc 통과.
- **남은 일:** ① **npm 이름 `xxx`는 타인 패키지(0.0.1)다 — 제품명 변경 전에는 절대 배포하지 않는다**(같은 버전이 올라오면
  훅이 타인 코드를 실행). ② 엔진 npm 공개 후 실제 npx로 두 호스트 세션 안 훅·스킬 실측(REL9). ③ Codex용 inspector는
  플러그인 형식이 agent를 받지 않아 미포함(개발용 `codex/*.toml`만). ④ PostToolUse가 정렬 실패를 block하는 기본값의
  사용자 결정. ⑤ LICENSE·homepage·repository. ⑥ CI에 `claude plugin validate` 추가(CI에 Claude CLI 필요).

## 보류 작업 — DATA2 후보 판정·보류 사례 해소

**⏸ 2026-10-07 PKG1 우선으로 보류 — 실제 데이터 기준으로 빈도 높은 후보부터 배포 규칙으로 구체화한다.**

- 기존 두 초기 규칙의 키는 관측의 3.31%였다. 블록 선언·객체 속성·Python dict부터 전후·반례를 판정한다.
- `.xxx/cache/corpus/REVIEW.md`를 사람 검토 진입점으로 사용한다.
- 전후 행 대응 11개와 60초 timeout 1개를 재현·해소하고 회귀 사례로 남긴다.
- 승인된 후보만 REL6 preset에 적재한다. 데이터의 양이나 기계 검증으로 사람 승인을 대신하지 않는다.
- DB 경계: 내부 연구 Evidence, 플러그인에 포함할 read-only preset, 설치 사용자의 전역 DB, 프로젝트 DB를 분리한다. Evidence는 자동 승격·배포하지 않고, 개인 코드 예문은 사용자 저장소에 머문다. 배포 preset에는 사람이 승인한 일반 규칙과 새 synthetic 예문만 넣는다. 세부 위치와 현재 구현 한계는 [`corpus-data.md`](corpus-data.md)에 기록한다.
- 공개 CLI 빌드에는 preset 정책 gate를 연결했다. 승인 상태·익명 승인자·범용 scope·synthetic 예문·중첩 schema·문서 hash를 검사한다. JSONL은 검증 객체에서 정규화하고 Decision의 승인 절만 추출해 ref를 다시 쓴다. 실제 tarball은 6개 파일로 확인했으며 연구 Evidence는 포함되지 않았다. 의미 수준의 원문 대조와 marketplace 전체 repo source 분리는 남았다.
- 다운로드 후 사용자 전역 DB는 `xxx db init`으로 로컬 빈 JSONL을 만들고 `xxx db status`로 행 수·크기를 확인한다. 원문은 출력하지 않는다. preset JSONL은 별도 제작자 소유이고 현재 비어 있다. 사용자 DB 편집·가져오기·백업은 미구현이다.

## 현재 구현 — H1 배포 추적 하네스

**✅ done — 2026-10-06 사용자가 설계(위치·저장 형식·스테이지 범위)를 선택해 구현했다.** 배포 준비(REL0–REL12)를
계속 개발·추적하기 위한 실행 하네스와 증거 DB를 `harness/`에 둔다. 추적 도구이지 배포 산출물이 아니며,
REL 상태의 단일 소스는 이 문서의 REL 표다 — 하네스는 표를 파싱해 기계 증거만 조인하고 상태를 판정하지 않는다.

- **범위:** 스테이지 오케스트레이터(`harness/run.ts`: self-align·check·pack·artifact-journey·corpus-gate·eval(opt-in)),
  증거 저장소(`harness/db.ts`: `runs.jsonl` append-only, `latest.json`은 완전 실행만 원자 교체),
  리포트(`harness/report.ts`: 최신 실행·직전 대비 추세·REL 표 조인), 전제 probe(npm 캐시의
  `typescript@7.0.2`와 플랫폼 네이티브 패키지 — 2026-10-06 배포 준비 검토의 재현 조건).
- **수락 기준:** 실행마다 git·호스트·전제 지문이 기록되고, 스테이지 실패가 나머지 실행을 막지 않으며,
  부분 실행은 `latest.json`을 갱신하지 않고, 리포트 조인은 사람 판정(상태 칸)을 바꾸지 않는다.
- **검증:** `bun test test/harness.test.ts`, 실제 `bun run harness`(전체·`--skip self-align`),
  `bun harness/report.ts`, `bun run check` 회귀 없음.
- **증거:** 전용 9개 테스트 통과. 실측 3회 기록(`harness/evidence/runs.jsonl`) — 최초 빠른 실행
  (check 412 pass / 5 skip / 0 fail), 전체 1회차에서 self-align이 기존 문서화 편차를 검출
  (`scripts/eval.ts` 미정렬 37표 + import 미정규화 5건), 해소 뒤 전체 실행 **ok**(self-align 132파일
  `changed=0`·`misaligned=0`, check 412 pass / 5 skip / 0 fail, pack 2건, artifact-journey 2 pass,
  corpus gate 0 failure). 직전 실행 대비 추세에서 `cli.ts` 정규화에 따른 CLI tarball 변경
  (35,415B→35,405B, sha256 변경)을 정확히 잡았다. report의 REL 조인은 상태 칸을 바꾸지 않고
  증거만 붙임을 확인했다.

## 공개 배포 실행 TODO

| ID | 작업 | 선행 | 상태 |
|---|---|---|---|
| REL0 | 배포 목표·현황·실행 TODO 정본화 | — | ⏸ 독립 검토·수락 대기 |
| REL1 | 배포 계약과 지원 범위 확정 | REL0 수락 | ⬜ 다음 실행 후보 |
| REL2 | 공개 TS/Python 쓰기 표면의 fail-closed 안전 gate | REL1; 독립 안전 보완 REL2a 선행 진행 | 부분 구현 — REL2a/b/c 검증 완료; 공개 gate·TS timeout 등 후속 |
| REL3 | Node/npm 런타임과 배포 패키지 실증 | REL2 안전 기반 | ✅ 실제 Node 정정 검증·빈 npm 캐시 설치; macOS 한정 |
| REL4 | 통합 CLI와 프로젝트 생명주기 | REL3 | ✅ 기본 명령·격리 bin 검증; 실제 format도 연결 |
| REL5 | 규칙 config와 계층 계약 | REL4 | ✅ 계층·버전·지문·거절 계약 구현 |
| REL6 | 사람 승인 DB의 최초 데이터 | REL5 | ⏸ 구체적인 두 후보 제시, 사용자 승인 대기 |
| REL7 | 승인 DB 쓰기 gate와 GUIDE 최소 순환 | REL6 | core 검증 완료; 실제 승인 데이터 대기 |
| REL8 | formatter run-last 고정점 | REL4, REL7 | ✅ 공개 CLI·실제 Node artifact 기계 검증 |
| REL9 | 확정된 지원 호스트의 실제 수용 | REL4, REL7, REL8 | ⬜ todo |
| REL10 | 지원 OS의 clean artifact 설치·갱신·제거 | REL8, REL9 | ⬜ todo |
| REL11 | 공개 자산·CI·배포 allowlist 동결 | REL10 | ⬜ todo |
| REL12 | 릴리즈·외부 재설치 확인 | REL11, 사람 승인 | ⬜ todo |

### REL0 — 계획 정본화

- **현재 구현:** M1~M1.8 역사와 구현 문서는 있으나 배포 경로의 단일 TODO가 없었다.
- **남은 일:** 독립 계획 검토·범위 반박·추적성 확인, finding 반영, 사용자 수락. DOC1의 Sonnet 5 독립 검토와 Opus 최종 감사는 Claude 주간 한도로 미실행 blocker다.
- **수락 기준:** REL 순서가 구현 사실과 연결되고 범위·보류·미결정이 구분되며 사용자가 초안을 명시 수락한다.
- **검증:** **기존** 상대 링크와 `git diff --check`; **신설 없음**. 이 변경만으로 구현 완료를 주장하지 않는다.
### REL1 — 배포 계약과 지원 범위

- **연속 개발 기준:** [첫 배포 구현 계약](release-contract.md)에 언어·런타임/OS 후보·명령 경계와
  공개 제외 쓰기 목록을 기록했다. 지원 실측과 이름·라이선스 등의 사용자 결정을 완료한 것은 아니다.

- **현재 구현:** TS·Python + CLI·플러그인 범위가 확정됐고 현재 임시 이름은 `xxx`/`XXX`, 메타데이터 버전은 0.2.0이다. 출시 버전·호스트·OS·채널·라이선스는 미정이다.
- **남은 일:** 지원 문형·기본 preset·품질 판정 기준, 런타임 후보, 지원 OS와 호스트 버전·설치 방식을 정한다. 나머지 8개 언어는 배포물 포함 여부와 preview/report-only별 쓰기·parser·지원 약속을 구분한다. 제품명·라이선스·배포 채널은 결정 필요와 REL11 전 시한을 기록하되 REL2~REL10 엔지니어링을 막지 않는다.
- **수락 기준:** 지원/제외 조합, public CLI/Result schema, SemVer·migration 기준과 미결정의 책임자·결정 시한이 한 계약으로 고정되고 사용자 승인을 받는다. 런타임 후보의 실현 가능성은 REL3 증거로 확정한다.
- **검증:** **기존** `bun test test/plugin-contract.test.ts`; **신설** 배포 계약 schema/manifest 일치 검사.
### REL2 — fail-closed 안전 gate

- **현재 구현:** `06`의 token/comment 보존과 parser 비교에 더해 REL2a에서 공통 라인 엔진의 parser 부재·실행 실패 쓰기를 차단했다. 보조 쓰기와 TS multi-pass 전체 복원은 같은 gate 밖이다.
- **남은 일:** 공개 write inventory, TS 경로의 실패·timeout 처리, 임시 파일 검증·원자 교체·복원, 보조 쓰기의 동등 gate 또는 공개 제외를 구현한다.
- **수락 기준:** 지원 언어의 모든 실패에서 byte-identical 원본과 비영 종료가 남고 미게이트 write가 allowlist에 없다.
- **검증:** **기존** `bun test test/preservation.test.ts test/parse-check.test.ts test/mutation.test.ts`; **신설** parser fault, 원자 교체·복원, 보조 write inventory 테스트.
### REL3 — 런타임과 배포 패키지

- **병행 준비:** 연속 진행 승인으로 빌드·pack 실험을 준비한다. REL2 안전 변경을 통합한 최종
  artifact 검증 전에는 완료로 기록하지 않는다. 공개 bin과 승인/formatter gate는 REL4 이후다.

- **현재 구현:** Bun이 `.ts`와 저장소 `node_modules`를 사용하며 copy/marketplace artifact의 독립 실행 증거가 없다.
- **남은 일:** Node engine bundle, runtime dependency/data allowlist와 검증용 내부 runner를 만든다. Bun 제거는 약속하지 않고 `npm pack`으로 실증한다. 공개 `bin`과 명령 dispatcher는 REL4가 소유한다.
- **수락 기준:** 저장소와 Bun이 없는 격리 환경에서 tarball의 엔진을 내부 runner로 호출해 TS/Python check/write/recheck가 동작하고 원본 개발 저장소의 파일·`@/` alias에 의존하지 않는다. 불가능하면 미완료로 남기고 REL1의 런타임 계약을 재검토한다.
- **검증:** **기존** `bun run check`; **신설** build, pack allowlist, Node-only 내부 runner의 fixture 왕복. 공개 `npx` 명령 검증은 REL4 이후다.
### REL4 — 통합 CLI와 프로젝트 생명주기

- **현재 구현:** 언어별 `06`, report와 부분 설치기만 있고 통합 실행 파일은 없다.
- **남은 일:** package `bin`과 명령 dispatcher, `init/doctor/check/format`, config 탐색, exit code, text/JSON, dry-run, 재실행과 사용자 파일 보존을 구현한다.
- **수락 기준:** CLI 진입·help/version·초기화·진단·읽기 전용 검사·dry-run과 종료 코드가 동작하고 재-init이 사용자 파일을 덮지 않는다. 미연결된 설정·승인·formatter 조건에서는 `format`이 명시적으로 쓰기를 거부한다. 전체 성공 여정은 REL7·REL8 연결 후 REL10에서 검증한다.
- **검증:** **기존** `bun test test/result-json.test.ts test/install-lifecycle.test.ts`; **신설** CLI contract, init idempotence, doctor/exit-code/JSON과 여정 E2E.
### REL5 — 규칙 config와 계층

- **현재 구현:** exact lookup과 preset/project JSONL은 report-only이며 `.xxx/config.json` 제품 계약은 없다.
- **남은 일:** Safety > Project > User > Preset > Base, rule scope/genre, formatter, schema version/migration을 정의하고 Safety 비활성화를 거절한다.
- **수락 기준:** 입력·config 해석이 결정론적이고 충돌·구버전·손상 파일은 write 전에 실패한다.
- **검증:** **기존** `bun test test/conventions.test.ts test/examples.test.ts`; **신설** config schema, 계층·충돌·migration·Safety override 거부.
### REL6 — 사람 승인 DB 최초 데이터

- **현재 구현:** schema와 corpus verdict 도구는 있으나 preset은 0건이고 verdict가 승인 DB로 이어지지 않는다.
- **남은 일:** TS/Python 핵심 유형의 후보·반례·출처를 만들고 사람이 승인/거절한다. AI 실험 데이터는 제품 DB와 분리한다.
- **수락 기준:** approved마다 decision·예문·반례·버전·근거 hash가 있고 테스트로 실행되며 미판정은 unknown이다.
- **검증:** **기존** `bun scripts/examples-check.ts`, `bun test test/corpus-judge.test.ts test/corpus-promote.test.ts`; **신설** DB provenance, 승인 receipt, 예문 실행 테스트.
### REL7 — 쓰기 gate와 GUIDE 최소 순환

- **현재 구현:** lookup은 report-only이고 GUIDE에 승인 규칙을 공급하지 않는다.
- **남은 일:** approved만 FIX, rejected/unknown/conflict는 write 금지로 연결하고 승인 규칙·예문에서 GUIDE를 만든다. 배포 SKILL·훅의 쓰기 호출도 이 gate로 연결한다.
- **수락 기준:** config → 사람 승인 DB → write gate → GUIDE → REVIEW가 fixture에서 닫히고 미승인은 수정되지 않는다. 공개 TS/Python 쓰기 진입점은 모두 같은 승인 gate를 거치며 raw `06 --write`는 배포에서 제외하거나 같은 gate를 경유한다.
- **검증:** **기존** `bun test test/report.test.ts test/conventions.test.ts`; **신설** 상태별 write matrix, guide golden/version, config-to-guide-to-review E2E.
### REL8 — formatter run-last

- **현재 구현:** formatter wrapper와 고정점 증거가 없다.
- **남은 일:** 명시 formatter → XXX 순서, 실패·timeout·version fingerprint·변경량 분리·identity를 구현한다.
- **수락 기준:** `C(file)=xxx(formatter(file))`, `C(C(file))=C(file)`가 TS/Python에서 성립하고 formatter 실패 시 쓰지 않는다.
- **검증:** **기존** `bun test test/typescript-align.test.ts test/python-align.test.ts`; **신설** 선택한 TS/Python formatter 조합의 고정점, child-process failure와 version 변경 테스트.
### REL9 — 실제 호스트 수용

- **현재 구현:** Claude/Codex 스킬·inspector 어댑터와 Claude hook 모의 검증은 있다. 실제 훅 수용 증거와 Codex용 동등한 작성 훅은 없다.
- **남은 일:** 호스트 검증 전에 README·SKILL·package/plugin/marketplace 매니페스트의 지원 등급·호출 경로와 discovery text 고정 테스트를 맞춘다. 고정 host 버전에서 discovery, GUIDE, read-only REVIEW, CLI 호출과 오류 표시를 실측한다.
- **수락 기준:** REL1에서 확정한 호스트가 동일 CLI 결과를 받고 read-only inspector 경계를 지키며 버전·artifact hash·log가 남는다. 스킬 호출과 작성 훅 지원을 별도 표시한다.
- **검증:** **기존** `bun test test/hook.test.ts test/plugin-contract.test.ts`; **신설** 확정된 실제 호스트의 수용 시나리오. 모의 실행만으로 통과하지 않는다.
### REL10 — clean artifact 설치·갱신·제거

- **현재 구현:** 임시 HOME의 link/copy/uninstall만 시험했고 공개 artifact와 OS matrix 생명주기는 미실측이다.
- **남은 일:** 지원 OS에서 설치 → init → 검사 → 수정 → 재검사 → 호스트 호출 → update → 제거와 사용자 파일 보존을 수행한다.
- **수락 기준:** 지원 조합이 배포 후보의 기록된 hash와 일치하는 artifact로 통과하고 제거는 managed 파일만 지운다. 두 후보 버전 사이 업데이트·되돌리기 리허설에서 사용자 설정·승인 데이터를 보존한다.
- **검증:** **기존** `bun test test/install-lifecycle.test.ts`; **신설** OS/Node/host E2E, update migration, residue와 offline/error 테스트.
### REL11 — 공개 준비 동결

- **현재 구현:** placeholder, 미정 license, `private: true`, 한국어 문서, repo 전체 marketplace source와 Bun 중심 CI가 남아 있다.
- **남은 일:** 이름·LICENSE·version·channel, artifact allowlist, 영어 번역(CJK fixture 제외), 지원 matrix와 release CI를 동결한다.
- **수락 기준:** identity/version/license 일치, secret/scratch/corpus 제외, 설치·업데이트·제거 문서와 clean CI artifact가 완비된다.
- **검증:** **기존** `bun run check`(plugin contract 포함); **신설** publish dry-run/allowlist, 언어·license·secret scan, artifact hash·lockfile, matrix CI.
### REL12 — 릴리즈와 후속 설치 확인

- **현재 구현:** 공개 release/tag/publish와 외부 설치 증거가 없다.
- **남은 일:** 독립 리뷰·QA·반박·최종 감사와 사용자 승인을 받은 뒤 release commit/tag/publish를 하고 게시 artifact로 여정을 재실행한다.
- **수락 기준:** registry/marketplace digest와 승인본이 같고 설치→호스트→update/제거가 확인된다. 첫 릴리즈의 문제 발생 시 배포 중지·안내 절차, 후속 버전의 이전 버전 복구 절차를 문서화한다.
- **검증:** **기존** `bun run check`; **신설** artifact 출처·hash 기록, published-artifact E2E, tag digest와 post-release smoke.

## 역사 계획과 작업 규율

아래 M1~M1.8은 구현 역사와 아직 남은 백로그를 보존한다. 새 배포 작업의 실행 순서와 상태는 위 REL
목록이 우선한다. 기존 `S3.5`·`S3.6`·`S5c`의 부분 구현은 REL6·REL7·REL9로 이관하며 완료로 바꾸지 않는다.

기존 계획의 연결은 S4 → REL5, S5c → REL6, S5d → REL7, M2 → REL8, S3.6 → REL9,
S6 → REL3·REL4·REL10, S7·S8 → REL11이다. S3.5의 추가 알람은 REL1에서 공개 범위를 정한 뒤
REL4·REL7에 반영한다. S5e의 모양 DB 이전과 E1의 전체 모델 평가는 첫 배포 필수 연결과 분리해 보류한다.

**상시 확인:** `skills/xxx/scripts/`, `scripts/`, `test/`, `harness/`의 모든 `.ts` 파일은
`06_align-tables.ts --file`의 `misaligned=0`, `00_normalize-imports.ts`의 `changed=0`과
`bun run check`를 확인한다. 완료 전 변경 파일에서 TODO 자리표시,
`test.skip`·`test.only`, 껍데기 테스트와 미구현 분기를 직접 검색한다.

**이전 상태 기록:** M1.5는 사람 verdict 대기, M1.6 nested tables는 2026-09-28 완료로 기록돼 있다.
M1 safety의 169 pass/3 skip은 2026-09-28 당시 기록이며 현재 배포 gate의 증거가 아니다.

Status legend: `⬜ todo` · `▶ active` · `✅ done` · `⏸ blocked/보류`

## M1 — Safety proof

| # | Task | Status |
|---|---|---|
| T0 | Baseline commit | ✅ done 2026-09-28 |
| T1 | Green self-check | ✅ done 2026-09-28 |
| T2 | Token-stream preservation | ✅ done 2026-09-28 |
| T2.5 | Import table cells | ✅ done 2026-09-28 |
| T3 | Output re-parse | ✅ done 2026-09-28 |
| T3.5 | Mutation tests | ✅ done 2026-09-28 |
| T3.6 | TEST_COMPLETED folder | ✅ done 2026-09-28 |
| T4 | Row floors per kind | ✅ done 2026-09-28 |
| T5 | Go alignment off by default | ✅ done 2026-09-28 |
| T6 | Shared `Result` JSON | ✅ done 2026-09-28 |
| T7 | Close M1 | ✅ done 2026-09-28 |

### T0 — Baseline commit

Snapshot the current working tree so every later task has a clean diff.

- **Scope:** two commits. (1) **Code:** the pre-existing work-in-progress registry changes (`grid-kinds.ts` call-statements kind and object-row property axes, with their tests), the `woo` → `xxx` rename and the English migration. These cannot be split cleanly: the same files were changed by the WIP, then moved and translated. (2) **Docs and process:** `AGENTS.md`, `CLAUDE.md`, `design.md`, `plan.md`, `reviews/`, readiness doc, CI workflow. Add `.video_agent/` to `.gitignore`.
- **Needs:** user approval of the commit split and messages.
- **Accept:** `git status` clean except ignored files; `bun run check` green at each commit.
- **Verify:** `git log --oneline -5`, `git status --short`, `bun run check`.

### T1 — Green self-check

The repository must pass its own checker (the WIP `grid-kinds.ts` changes now flag files that were aligned under the old registry).

- **Scope:** run `06_align-tables.ts --write` on the flagged scripts and tests after reading each group; fix anything that looks like a wrong detection as a registry bug instead of accepting the rewrite.
- **Accept:** every `.ts` file under `skills/xxx/scripts/`, `scripts/` and `test/` reports `misaligned=0`; tests green.
- **Verify:**
  ```bash
  for f in skills/xxx/scripts/**/*.ts scripts/*.ts test/*.ts; do bun skills/xxx/scripts/typescript/06_align-tables.ts --file "$f" >/dev/null || echo "FAIL $f"; done
  bun run check
  ```

### T2 — Token-stream preservation

Today the harness compares output and input with *all* whitespace stripped, which cannot see a change inside a string literal or comment.

- **Scope:** a shared check built on the existing mask: code outside strings/comments must match token by token, and every string and comment must be byte-identical. The line engine and the TypeScript aligner call it before returning an edit; on failure the row/table is refused. The harness asserts it instead of `stripWhitespace`.
- **Accept:** a new test proves that an edit which changes spacing *inside* a string is refused; all language suites use the new assertion.
- **Verify:** `bun test`; the new negative test fails if the check is removed.

### T2.5 — Import table cells

User-confirmed rule change (2026-09-28): imports apply contract rules 8 and 35 — the `{ }` binding list is a fixed-width cell and the terminating `;` is a column — across the whole import section.

```ts
import      {
              isArrayLiteralExpression       ,
              isPropertySignatureDeclaration ,
                                               } from "typescript/unstable/ast"         ;
import type { Node, SourceFile                 } from "typescript/unstable/ast"         ;
import      { skipTrivia                       } from "typescript/unstable/ast/scanner" ;
```

- **Head cell:** always reserves the `import type` width (or a wider `import Default,`), so `{` is one column in every import.
- **Section-wide columns:** `{ }`, `from`, module and `;` are shared by all groups separated only by blank lines; code between imports starts a new section.
- **Vertical form:** one name per line on the names column, aligned commas, trailing comma, closing `}` on the table's `}` column — triggered by (A) one-line form over 120 columns, (B) names 20+ columns wider than the second-widest, (C) the aligned table still over 120 columns (widest names first).
- **Stay as written:** imports without braces and imports with attributes (they do not break the table); a lone brace import stays compact; no `;` column in files without semicolons.
- **Accept:** the rules above hold; the whole repository is realigned with every import line within 120 columns; SKILL.md STEP0 and contract rule 2 describe the new form.
- **Verify:** `bun test test/normalize-imports.test.ts` (7 cases, including re-detection of already aligned rows), standing self-check across the repository.

### T3 — Output re-parse

- **Scope:** after alignment, parse input and output with the language's official parser and require the same diagnostics. TypeScript uses the bundled `typescript@7`. Other languages use their toolchain when present — Python `ast.parse`, `gofmt -e`, `javac`, `clang -fsyntax-only`, `node --check`, `rustc` (not installed locally; CI installs it) — and the harness marks the check as skipped, never passed, when a toolchain is missing.
- **Accept:** every golden fixture's output parses with unchanged diagnostics; CI runs all eight parsers.
- **Verify:** `bun test` locally (skips listed explicitly); CI log shows no skips.

### T3.5 — Mutation tests

Generate thousands of variants from the existing fixtures and prove the invariants hold on each. Local compute only.

- **Scope:** a seeded, deterministic mutator per language: random spacing and tabs between tokens, separators (`:` `=` `;` `,` `//` `#`) injected inside strings, comments inserted between rows, CJK and emoji in strings and comments. For every variant: token-stream preservation (T2), idempotence, and re-parse (T3) where the toolchain exists. Failures are minimized and saved as regression fixtures.
- **Accept:** at least 1,000 variants per language run in `bun test` under a time budget (seed fixed; a larger run is available via an environment variable); zero invariant failures, or every failure fixed and pinned as a fixture.
- **Verify:** `bun test`; `XXX_MUTATIONS=20000 bun test test/mutation.test.ts`.

### T3.6 — TEST_COMPLETED folder

A place to check aligned results by eye in an editor (design §6, L4 review, first version). An HTML page was tried first and replaced by plain files at the user's request.

- **Scope:** `bun scripts/test-completed.ts [--samples 3]` rebuilds `TEST_COMPLETED/` (git-ignored): per language, every fixture and seeded mutation samples as aligned files, each original under `before/`, and `SUMMARY.txt` with the safety results per file (tables, refused, whitespace-only, idempotent, parse).
- **Accept:** all eight languages are present; failing files are marked `FAIL` in `SUMMARY.txt`.
- **Verify:** run the command; the user reviews the folder.

### T4 — Row floors per kind

- **Scope:** fixes apply from 3 rows, with two user-confirmed exceptions from 2 rows: TypeScript `=` declaration tables (`declaration-equals`) and imports. The line engine raises any `minRows` below 3 to 3, so `--min-rows 2 --write` no longer promotes pairs. Line-engine `=` declarations per language are decided in F1.
- **Accept:** a 2-row TypeScript `=` declaration table is aligned; a 2-row group of any other kind, and any 2-row line-engine group even with `--min-rows 2`, is left unchanged; docs no longer advertise `--min-rows 2` as a fix path.
- **Verify:** `bun test`; `grep -rn "min-rows 2" skills docs` shows only the reporting option of `01_group-regions.ts` and history notes.

### T5 — Go alignment off by default

- **Scope:** the Go aligner reports but does not write unless explicitly enabled (flag now; config key once `.xxx/config.json` exists). Record the gofmt conflict in the Go suite as a known limitation.
- **Accept:** `06_align-tables.ts --file x.go --write` leaves the file unchanged without the opt-in flag; with the flag, behavior is as today.
- **Verify:** `bun test`; manual run on `fixtures/go/tables.go` with and without the flag.

### T6 — Shared `Result` JSON

- **Scope:** one versioned JSON schema (`schemaVersion`, file, tables, per-group state, edits, refusals) emitted with `--json` by both the TypeScript aligner and every line-engine aligner.
- **Accept:** a schema test validates the output of one TypeScript file and one file per line-engine language.
- **Verify:** `bun test`; `bun skills/xxx/scripts/python/06_align-tables.ts --file skills/xxx/fixtures/python/tables.py --json`.

### T7 — Close M1

- **Scope:** update `design.md` §10 rows, README status, and this file; write the next milestone's tasks in detail.
- **Accept:** the M1 checklist under *Goal* is all true.

## M1.6 — Nested tables, TypeScript first (after M1, before M1.5)

Why: the engine sees one layer only. In `const STATES = new Set(["PASS", …]) ;` it aligns `=` and `;` but not the call or the list inside. Judging real data (M1.5) before this would spend verdicts on a known gap (user decision 2026-09-28).

```ts
const STATES = new Set(["PASS", "FIXABLE", "SUGGEST", "REFUSE" ]) ;
const PARSES = new Set(["ok"  , "changed", "skipped", "not-run"]) ;
```

| # | Task | Status |
|---|---|---|
| N1 | Call layer: callee, `(`, top-level `,`, `)` inside declaration values and call-statement subjects | ✅ done 2026-09-28 |
| N2 | List layer: `[ ]` / `{ }` of literals — element widths, `,` and closing column | ✅ done 2026-09-28 |
| N3 | Outliers in declaration tables: when one row is far longer, the vertical form (as for imports) | ✅ done 2026-09-28 |
| N4 | Hand-made samples: guard-row tables and subscript cells from `00_normalize-imports.ts` | ✅ done 2026-09-28 |
| N5 | Python: the same layers on the line engine's bundle rows | ✅ done 2026-09-28 |

| Layer | Aligned | Condition |
|---|---|---|
| 1 — row | `=`, `;` (existing) | declaration / call-statement table |
| 2 — call | callee name (left), `(`, top-level argument `,`, `)` | the cells share callee, arity and tail (no `.stdout ?? ""` on only some rows), in the table's row count; no argument is 20+ columns wider than the second widest in its column (import rule B) |
| 3 — list | the bracket column, each item `,` right after the widest item, the next item one space later, and the closing `]` / `}` right after the widest last item | slots: the declaration value, each argument of the layered call, and the matcher arguments of call statements; every row has the slot with the same shape (array arity, or the same object property names), every item is a string/number/boolean literal, no item is 20+ columns wider than the second widest in its column (import rule B); a trailing comma or a multi-line form refuses the slot; dropping the call layer drops the list slots inside its arguments (matcher slots survive) |

N2 implementation notes (done 2026-09-28): `callLayer` in `grid-kinds.ts` was generalized into `itemLayer`, a cell layer over items (call arguments, array elements, object properties). List slots are derived per row by `rowListCells` and tagged `layer: "call" | "list:<slot>"` with slot names `list:value`, `list:arg<i>`, `list:matcher-arg<i>`; boundaries carry slot-qualified axes (`list-arg2-comma1`, …) registered in `KIND_AXES` and `AXIS_NOTES`. `withLayers` gates the call layer as in N1 and each list slot across the run: same shape (arity or property names), all items literal, no 20+-column outlier in any item column.

N3 implementation notes (done 2026-09-28): in a declaration table whose rows share callee and arity, the row holding the outlier argument (import rule B) takes the vertical form instead of dropping the layer for everyone — arguments one per line under the `(`, non-last argument commas right after the widest argument, `);` on the statement's indentation, `=` at the table's `=` column; the remaining rows keep the call layer when no outlier is left among them. The render only inserts line breaks and padding, so `06_align-tables.ts` gates such a group with the new `preservesTokensWithBreaks` (tokens and comments byte-identical, breaks only inserted; the strict gate still covers every other edit) plus the re-parse gate. Calls with one argument, different callees, and call statements never go vertical. A vertical row leaves the table on the next run, so the write is stable.

N4 implementation notes (done 2026-09-28): two constructs from the hand-aligned `lexicalMask` in `00_normalize-imports.ts`. (1) Subscript cells — a declaration value that is a subscript read (a leading `!` is fine) gains a `subscript-close` insert axis: `]` right after the widest index, kept only when every row has the subscript on the same object with no outlier index. (2) Guard rows — a new `guard-statements` kind for consecutive one-line `if (…) { …; continue; }` statements (block ends in `continue`, no `else`): the condition's closing `)`, the first statement's `;` and the `continue` column are insert axes; the statements in between stay as written. The hand-aligned sample is the engine's fixed point. The third hand-made sample (a multi-line object literal whose continuation lines align on the first property) is not covered yet — see backlog.

N5 implementation notes (done 2026-09-28): the Python profile gains the assigned call row, `name = call(...)`, as table form 6 — the line engine's call layer. The callee travels in the axis name (`call:frozenset`), so rows calling a different callee never share a table; arity is part of the axis sequence. Two argument shapes decompose: two or more scalar arguments become cell/arg columns, and exactly one flat bundle argument (`frozenset({"a", "b"})`) folds its cells inside the call as the list layer — the Python counterpart of the milestone's `new Set([...])` example. Nesting, keyword arguments, and bare `name = {...}` values stay refused. The cell cutter is shared with bundle rows (`cellsIn`); tables need the line engine's 3-row floor.

Hand-made reference samples (user, `00_normalize-imports.ts`): guard rows `if (…) { state = … ; … continue; }` with aligned condition cell, `{ … ;` and `continue`; subscript cells `chars[index    ]!` / `chars[index + 1] ;`; a multi-line object literal whose continuation lines align on the first property.

## M1.5 — Data for TypeScript and Python (after M1.6, before M2)

Why: today's tests prove safety, not quality. Goldens were produced by the engine itself and no real code has been judged by a person. The principles are the same for every language; what makes a language solid is **judged real data**. TypeScript and Python get it first (user decision 2026-09-28); Java, Go, Rust, JavaScript, C, C++, Kotlin and Swift stay light (current fixtures plus the safety net).

| # | Task | Status |
|---|---|---|
| D1 | Pinned corpus for TypeScript and Python | ✅ done 2026-09-28 |
| D2 | Signatures: group every aligned table into types | ✅ done 2026-09-28 |
| D3 | Judging in TEST_COMPLETED and verdict records | ✅ done 2026-09-28 |
| D4 | Learning: verdicts become cases, rules and registry changes | ✅ done 2026-09-29 |
| D5 | Measures: judged share, wrong-grouping rate, unseen types | ✅ done 2026-09-29 |
| D6 | Edge inputs: CRLF, BOM, large files, Rust parser | ✅ done 2026-09-29 |
| D7 | Swift and Kotlin (light) | ✅ done 2026-09-29 |

- **D1:** `corpus/manifest.json` (committed) pins permissively licensed repositories by commit SHA — TypeScript candidates: vscode, prisma, trpc, zod; Python candidates: requests, fastapi, pydantic, django — plus the user's private repositories as local-only sources (never committed). Sources are fetched into `~/.cache/xxx/corpus/`. Done 2026-09-28: `scripts/corpus-fetch.ts` materializes each source as a shallow worktree at the pinned commit (idempotent re-runs); private repositories go into gitignored `corpus/local.json` (same schema, merged, duplicate ids refused); `test/corpus.test.ts` validates the manifest and the gitignore entry without network. All eight sources verified fetched at their pinned commits; per-source `paths` fields scope future scanning.
- **D2:** every detected table gets a signature (language, container context, kind, ordered axis IDs, nesting, result state — design §6 L2); thousands of tables collapse into hundreds of types, ranked by frequency × risk. Done 2026-09-28: `scripts/corpus-signatures.ts` scans the fetched corpus (TypeScript through one TypeScript 7 server per source in batches of 25 files, capped by `--max-files` per source, `.tsx`/`.d.ts`/hidden directories skipped, symlinked directories counted once; Python through the in-process line engine) and writes the ranked type report to `~/.cache/xxx/corpus/signatures.json` with up to three source locators per type for D3. First run (`--max-files 100`): 1,432 tables from 737 files collapse into 91 types, top type function-body `=` declaration tables (258 tables, 1,099 edits). The shipped default run (`--max-files 400`, after the symlink fix): 8,093 tables in 197 types, top type 1,077 tables / 3,962 edits — reruns are byte-identical. Both engines now carry `context` and `depth` per table (TypeScript: AST container kind and container depth; line engine: shared indent as depth), and `loadSourceFile` closes its TypeScript 7 server — the unclosed servers were accumulating gigabytes across runs. Cross-verified 2026-09-28 (see `docs/reviews/`): all pins, licenses, determinism and locators reproduced; the symlink double-visit and silent-missing-manifest findings are fixed in the same pass.
- **D3:** representatives per type are exported to `TEST_COMPLETED/corpus/<language>/<type>/` (aligned file, original, context); the user judges each type: `correct`, `different-role`, `missing-kind`, `taste`, `unsure`. Verdicts are stored as records (`corpus/verdicts.jsonl`, committed; no third-party code in it). `SUMMARY.txt` shows `approved` / `unjudged` per result. From the D2 cross-review: the sorted-alphabetical walk biases the census sample toward files early in sort order — D3 sampling should be stratified (design §5.2), and `call:*` representatives should be sampled per callee since the type deliberately merges callees the engine keeps apart. Done 2026-09-29: `scripts/corpus-judge.ts` exports all 197 types (2 representatives each) into `TEST_COMPLETED/corpus/<language>/<rank>-<slug>/` and renders `SUMMARY.txt`; judge by rank with `--verdict <rank> <verdict> [--note …]`, appending to `corpus/verdicts.jsonl`. **Left for the user: the actual verdicts** — open `TEST_COMPLETED/corpus/SUMMARY.txt`, review each type's `rep1-original.txt` against `rep1-aligned.txt`, then record `bun scripts/corpus-judge.ts --verdict <rank> <verdict>`.
- **D4:** each verdict becomes a minimized, synthetic-identifier case under `fixtures/<language>/<region>/<construct>/` (the construct matrix grows from data, not by hand); `different-role` becomes a grouping rule, `missing-kind` a new kind, `correct` a pinned golden (design §7). The promotion gate keeps judged results from changing silently. Done 2026-09-29 (mechanism; real promotion waits on D3 verdicts): `scripts/corpus-promote.ts --rank <n>` scaffolds a synthetic fixture under `skills/xxx/fixtures/<language>/corpus/` for a `correct` verdict, writes the engine-aligned golden and a `verdict.json` binding; `--check` is the promotion gate (every promoted fixture must still align to its committed golden) and `--report` lists pending `different-role`/`missing-kind` registry work. The fixture author refines the scaffold by hand — no third-party text is ever copied.
- **D5:** per language: share of tables in judged types, wrong-grouping rate from verdicts, share of types never seen before in a new repository. Done 2026-09-29: `scripts/corpus-measures.ts` prints per-language judged share, table share, and the wrong-grouping rate (`different-role` + `missing-kind` over judged tables; `taste`/`unsure` are judgments, not misses); `--baseline <signatures.json>` reports the unseen-type share. Currently all shares are 0% — no verdicts exist yet.
- **D6:** CRLF and BOM files, a multi-thousand-line file with a time budget, `rustfmt` locally. Done 2026-09-29: `test/edge-inputs.test.ts`. Found and fixed a real gap — CRLF line endings made the line engine silently refuse every row (the trailing `\r` failed the row regexes and the trailing-whitespace guard); the engine now strips `\r` for profiling and restores it on output, so CRLF files align with their endings preserved. BOM lines stay untouched, and a 3,000-line single-table file aligns well inside the budget. rustfmt was already covered by the T3 skip-locally mechanism.
- **D7:** Swift and Kotlin as light languages — nested block comments, multi-line and raw strings, interpolation in the mask; re-parse with `swiftc -parse` / `kotlinc` (Kotlin in CI only); mutation tests; discovery text. Done 2026-09-29: `maskSource` gained nested block comments (`BlockCommentSpec.nested`); `scripts/swift/` and `scripts/kotlin/` profiles accept four row forms (let/val·var typed and plain bindings, assignments, quoted dictionary rows), refusing calls, containers, closures and declarations; fixtures (tables/tricky/golden) for both; `swiftc`/`kotlinc` parse gates registered (kotlinc installed by the CI workflow, so its parse gate runs there but skips locally); mutation tests registered; discovery text updated in the manifests, SKILL.md and AGENTS.md.

## M1.7 — Pattern DB slice (parallel to M1.5 verdicts, before M2)

Why: the product is a pattern checker — "does this code match the approved patterns in my database?" (user direction 2026-09-30). Design §3–4 already calls this the Registry (Convention / Evidence / Decision records), but only the collecting side exists (census, signatures, verdicts, promotion). Nothing at runtime can look a group up: the signature lives in `scripts/corpus-signatures.ts` (not shipped), includes the result state, and the aligners never emit it.

Decisions (2026-09-30):

- **Retrieval is an exact signature-key lookup, never vector similarity.** Deterministic (invariant 7); an unknown key means `SUGGEST` / `UNCERTAIN`, never a best-effort fix (invariant 2). Similarity retrieval ("RAG") belongs only to GUIDE, where agents consume approved patterns and golden examples at authoring time.
- **The database is git-tracked JSON/JSONL files.** No server and no native dependency, so the plugin installs anywhere; approvals stay reviewable as diffs. SQLite may come later as a cache index only.
- **Two databases, layered:** the preset DB ships read-only with the plugin; the project DB is `.xxx/conventions.json`, owned by the user. Project > Preset.
- **The DB gates, it does not draw.** The engine still computes every column; the DB only decides whether a group may be fixed. The M1 safety proof is unchanged.
- **The signature key is a public contract**: versioned, with a migration rule when its format changes.

| # | Task | Status |
|---|---|---|
| P1 | Shared signature module: identity key without result state | ✅ done 2026-09-30 |
| P2 | `signature` per group in the `Result` JSON (both engines) | ⏸ blocked (M1.8 S5까지) |
| P3 | Convention record schema and loader (preset + project) | ⏸ blocked (M1.8 S5까지) |
| P4 | Lookup step, report-only: `convention: approved \| rejected \| unknown` | ⏸ blocked (M1.8 S5까지) |
| P5 | Promotion writes `correct` verdicts into the preset conventions | ⏸ blocked (M1.8 S5까지) |

- **P1:** move `signatureOf` / `normalizeAxis` from `scripts/corpus-signatures.ts` into `skills/xxx/scripts/common/signature.ts`; the identity key is `(language, context, kind, axes, depth)` with a key version, and the state is a separate field. `corpus-signatures.ts` imports it. **Verify:** regenerate `signatures.json` and compare type counts (only splits caused by removing the state may differ); `bun run check`.
  P1 implementation notes (2026-09-30): `skills/xxx/scripts/common/signature.ts` holds `SIGNATURE_VERSION`, `normalizeAxis`, `signatureOf` (no state argument) and `indentDepth`. The census report moves to `schemaVersion: 2` with `signatureVersion`; each type counts its results in `states` instead of being keyed by one, and its representatives prefer FIXABLE tables. `readCensusReport` refuses an older report, so judge, measures and promote never match stale keys. Rerun on the pinned corpus: 8,093 tables collapse into 182 types (was 197); the 197 old keys minus their state give exactly the 182 new keys with identical per-state counts (14 keys held more than one state). `TEST_COMPLETED/corpus/` was re-exported with the new slugs (`<rank>-<kind>-d<depth>-<hash>`).
- **P2:** every group in `--json` carries `signature`; bump `schemaVersion`. **Verify:** the schema test covers one TypeScript file and one file per line-engine language.
- **P3:** a `Convention` schema (design §4.1) and a loader for `skills/xxx/presets/recommended/conventions.json` and `<repo>/.xxx/conventions.json`. **Verify:** loader unit tests — missing files, conflicts (project wins), schema errors fail loudly.
- **P4:** check mode annotates each group with its convention status; write behavior is unchanged. **Verify:** every golden fixture unchanged; `--json` shows the field.
- **P5:** `corpus-promote.ts` records a `correct` verdict as an approved preset convention (the Decision stays in `corpus/verdicts.jsonl`). **Verify:** one verdict end to end — verdict → convention → check reports `approved`.
- **Later:** switch the lookup into a gate (`unknown` → `SUGGEST`), give line-engine groups a real `context` and `kind` (today `""` / `"table"`, so different roles can share a key), and the GUIDE renderer — absorbed into M3, M5 and M7.

## M1.8 — 언어 모델과 배포 (2026-09-30~)

왜: 목적이 공개 배포로 정해졌다. 원칙은 "가독성 좋은 코드", 가치관은 "코드는 언어다". 쓰게 유도하는 것(GUIDE)과 검사하는 것(REVIEW)이 같은 문법과 약속을 봐야 하고, 그 약속과 예문을 담는 곳이 DB다. 이 틀을 위에서 아래로 한 층씩 확정한다.

### 결정 사항

- **레포는 하나.** 스킬 폴더는 Agent Skills 공개 표준이라 Claude Code, Codex, Gemini CLI, Copilot, Cursor 등이 같은 폴더를 읽는다. 호스트별 차이는 매니페스트뿐이다.
- **산출물은 둘.** 엔진 CLI 패키지(`npx xxx …`; CI·훅·에디터·에이전트가 모두 호출)와 얇은 에이전트 어댑터(`SKILL.md` + 매니페스트).
- **배포 차단 요소:** R1 마켓플레이스 설치 시 `node_modules`가 없어 TS 엔진이 안 돈다, R2 bun 필수, R3 에이전트 밖(CI·훅) 사용처, R4 Preset DB는 엔진과 같이 버전이 붙어야 함, R5 이름·라이선스. 또 `marketplace.json`의 `source: "./"`는 레포 전체를 내려보내므로 배포본은 `plugin/`으로 분리한다.
- **규범 5층** (아래 층은 위 층의 ID만 쓴다. 아래로 갈수록 자주 바뀌고 권한이 약하다):

| 층 | 위치 | 책임 |
|---|---|---|
| 0 헌장 | `skills/xxx/references/charter.md` | 원칙, 가치관, 안전 불변식 |
| 1 문법 | `skills/xxx/references/grammar.md` | 단위(단어·문장·문단·글), 문형, 역할, 문단 목적, 장르 — 모든 ID 정의 |
| 2 표현형 | `base/<language>/` (데이터) | 문형 → kind, 기호, 어순, 분해 조건 |
| 3 약속 | `presets/recommended/rules/`, 사용자 `.xxx/rules/` | 허용 모양 중 무엇을 쓰는가, 등급(FIX/SUGGEST/GUIDE) |
| 4 예문집 | Preset DB, 사용자 `.xxx/` DB (JSON/JSONL) | 승인 예문, 판정 이력 |

- **핵심 원칙이 모든 모델에 닿는 경로:** ① 엔진 코드와 테스트(모델과 무관하게 강제) ② `charter.md` 원문 ③ `SKILL.md` 맨 위 3–5줄(스킬 발동 시) ④ 사용자 레포 `AGENTS.md`의 표시 구간(`xxx init`이 기록, 대부분의 에이전트가 항상 읽음). ③·④는 ②에서 생성하고 테스트로 고정한다. `CLAUDE.md`(`@AGENTS.md`)는 유지한다 — Claude Code는 `CLAUDE.md`가 없을 때만 `AGENTS.md`를 읽고, 구버전·Bedrock·Vertex에는 그 대체 읽기가 없다.
- **언어:** 개발 중 한국어, 배포 전 영어 번역(AGENTS.md 언어 정책).
- **1차 범위는 TypeScript와 Python** (2026-09-30). Java는 허용 라이선스 코퍼스를 고정한 뒤(S2.5) 합류한다. 다른 언어의 엔진은 지금처럼 유지하되 문법·약속 작업에서는 다루지 않는다.

| # | 작업 | 확인 기준 | 상태 |
|---|---|---|---|
| DOC1 | 실제 구현 문서화(2026-10-04 사용자 요청): `docs/implementation.md`에 코드 기준 진입점·실행 흐름·데이터·안전 검사·한계를 기록하고 README에서 연결한다. 검증 기록은 `docs/reviews/2026-10-04-implementation-docs-review.md`. 기존 제품 동작은 변경하지 않는다 | 소스·테스트 근거 대조, 문서의 명령·상대 링크 확인, `bun run check` 결과와 미검증 범위 기록, 독립 검토 | ⏸ REL0로 이관 대기 — 문서 작성·소스 대조·기계 검증 수행. Claude 주간 한도로 Sonnet 5 독립 검토·Opus 최종 감사 미실행(blocker) |
| S0 | 이 지도 기록, M1.7 보류, AGENTS.md 언어 정책 교체, 메모리 갱신 | 사용자 승인, `bun run check` | ✅ done 2026-09-30 |
| S1 | `charter.md` (한 페이지): 원칙, 가치관, 정체성, 불변식 | 문구 확정 | ✅ done 2026-09-30 |
| S2 | `grammar.md`: 4단위, 문형 9개(`EXIT` 추가, Codex 검토 반영), 역할, 문단 목적, 장르 + 코퍼스 근거. 1차 범위 TypeScript, Python (Java는 S2.5로 보류) | 코퍼스 표 100% 대응 재확인 (TS 7,214 · Py 879 · Java 162) | ✅ done 2026-09-30 |
| S2.5 | Java 허용 라이선스 코퍼스 고정(Apache-2.0 후보: guava, commons-lang, spring-framework) + census의 Java 지원. Codex 검토 3 | Java 표를 고정 코퍼스에서 다시 집계, 문형 100% 대응 | ⏸ 보류 — Java는 1차 범위에서 제외 (2026-09-30) |
| S3 | 표현형 데이터 스키마 (kind → 문형) | 기존 kind 전부 매핑, 테스트. Python 모호 행(`a = v`)을 확실한 행과 한 표로 묶지 않음(문법 판정 규칙 3) | ✅ done 2026-09-30 |
| S3.5 | 검사 리포트 + AI 확인 루프: 안전 검사 S1–S4 통과/미통과 + 알람 A1–A9(한계선·권장선 초과, 모호, REFUSE, 2행 쌍, 이상값 셀, 큰 변경량, 대응 안 된 kind, 정렬로 덮은 의심)을 텍스트와 `--json`으로. AI는 알람만 읽고 판정·수정을 제안해 `.xxx/cache/review-queue`에 쌓고, 적재는 사람 확인 후. 먼저 코퍼스 182개 유형에 적용(M1.5 판정 병목) | 리포트 결정성 테스트, 코퍼스 유형에 AI 제안이 붙음 | ⏸ REL6·REL7로 이관 대기 — ① 리포트 완료 2026-09-30 (`scripts/report.ts`, `common/report.ts`), ② 기준본 비교 완료 2026-09-30 (`--baseline <파일|none>`; 기준본 대비 새 알람·기존 알람 구분, 종류·대상별 짝짓기, `docs/authoring-flow.md` 3절), A0 "정렬 대기"·A12 "표 밖 정렬 공백" 추가, ③ AI 사전 판정 1차 완료 2026-09-30 (상위 20개, Codex; 아래 노트), ④ 알람 A10 "문단 안 속성 섞임"(표가 아닌 문장도 문형·선언 종류로 분류 필요, 정의 직후 guard 예외), A11 "원천 → 파생"(아래 행이 맨 위 행의 이름을 실제로 참조할 때만 빈 줄 제안, 남는 표 2행 이상; 참조가 없으면 중립적인 "모양 전환" 정보). 둘 다 제안만, 자동 빈 줄 삽입 없음 |
| S3.6 | 작성 시 훅 (`docs/authoring-flow.md`, Codex 검토 반영). **첫 범위:** Claude Code 한 곳, 쓰기 전 GUIDE 주입 + 쓴 뒤 **읽기 전용** 리포트, 기준본 기록과 새/기존 알람 구분. **미룸:** 자동 공백 정렬(호스트 실행 계약 실측 후, 순서 보장 못 하면 금지), Codex·Cursor 어댑터, DB 승인 배선 | 실제 호스트에서 쓰기 → 훅 발동 → 새 알람만 전달, 지연 측정 기록 | ⏸ REL9로 이관 대기 — 구현·흉내 검증 완료 2026-09-30 (`hooks/hooks.json`, `scripts/hook.ts`, `common/hook.ts`: 세션 시작 핵심 3줄, 새 파일 안내 세션당 1회, 쓴 뒤 읽기 전용 리포트로 새 알람만, 에이전트가 고칠 수 있는 알람만 A0·A1·A3·A4·A7·A9, 지연 기록). 남음: 실제 Claude Code에 설치해 확인 |
| S4 | 약속 규칙 파일 스키마 + WHEN W1–W4 + 사용자 덮어쓰기(`.xxx/config.json`: 규칙 끄기·범위·장르; 불변식을 끄려 하면 스키마 오류); 약속 후보 "위치별 인자 열"(같은 호출 이름이면 인자 수가 달라도 인자 i를 같은 열에: 순수 위치 인자만, 공통 앞 인자 2개 이상, 패딩 상한, 판정으로 확정); 줄 폭 기준: 기준 환경 실측 → 한계선(hard)·권장선(soft), 120 고정값 교체(`docs/research/column-width.md`) | 스키마 테스트, 실측 기록 | ⬜ todo |
| S5a | **패턴 레코드 + 조회(보고만)** (= M1.7 P3–P4, Codex 조회 검토 반영): 조회 키 `v1\|language\|context\|kind\|axes`(깊이 제외, 빈 context는 `-`, 진단용 시그니처와 분리), 레코드 id·key·pattern·status·scope·examples·evidence·versions·approvedBy(shape는 S5e), preset + 프로젝트 층, 같은 층·키·범위 상충은 충돌, 리포트가 표마다 approved/rejected/unknown/conflict를 붙임. 동작 불변. 결과 JSON에 키를 넣는 일은 S5d | 조회 결정성·층·충돌 테스트, 동작 불변 | ✅ done 2026-09-30 |
| S5b | 예문·결정 레코드 (Codex DB 검토 반영: 규칙별 필수 알람 has/lacks, 판정별 테스트 의미, 버전·상태·해시·대체, 결정은 문서 해시를 가리키는 색인, taste는 근거에서 제외). 패턴 레코드의 근거이자 테스트 | 모든 승인 예문이 테스트로 돔 | ✅ done 2026-09-30 (`common/examples.ts`, `scripts/examples-check.ts`, preset `examples.jsonl`·`decisions.jsonl` 비어 있음) |
| S5c | 처음 채우기: 코퍼스 상위 유형과 오늘 결정에서 패턴·예문 후보를 만들고 사용자 승인으로 적재 | 승인 기록, 테스트 통과 | ⏸ REL6으로 이관 대기 — 후보 생성·사람 승인·적재 미완료 |
| S5d | 조회를 게이트로: 승인된 패턴만 FIX, 거절은 그대로, 모르는 것은 SUGGEST + 후보 대기열 | 코퍼스 상태 변화 보고서 확인 | ⬜ todo |
| S5e | M3와 연결: 모양(shape)을 코드(`grid-kinds.ts` `KIND_AXES`, profile)에서 패턴 DB로 옮김 | 기존 golden 동일 | ⬜ todo |
| E1 | **모델 평가 하네스** (`docs/research/model-eval.md`): 가격 정본(Codex·Claude), 이 시스템이 돌 때만 정확히 측정(`purpose` system/dev-review, 입력·캐시·출력 분리), 동일 조건 7규칙, 정확도는 κ·macro-F1·Wilson·McNemar·반복 σ, 실험 프로토콜 `docs/research/eval-protocol.md`(사전 등록, 0 판정 지침 → 1 파일럿 → 2 본시험, 동일 조건은 실행기가 매니페스트로 강제), 축은 과제×모델×강도×프롬프트(경량 우선: gpt-6-luna, claude-haiku-4-5), 헛돌면 한 단계 올리기(완료 항목당 비용 보고) | 파일럿 결과표, 통과 기준 확정 | ⬜ todo |
| S6 | 엔진 CLI 패키지화, 배포본 `plugin/` 분리 (R1–R3) | 깨끗한 환경에서 마켓플레이스 설치 후 실행 | ⬜ todo |
| S7 | 문서 재배선: AGENTS.md, SKILL.md(절차만), design.md, `readability-contract.md` 해체 | `bun run check`, 링크 확인 | ⬜ todo |
| S8 | 배포 전 영어 번역(검사 리포트 본문 포함) + 한국어 잔존 검사(CJK 테스트 데이터 제외) | CI 검사 통과 | ⬜ todo |

S3.5 ③ 노트 (2026-09-30): `scripts/corpus-triage.ts`가 상위 20개 유형의 대표 사례(공개 소스만)를 Codex에 보내고, 판정 후보를 `~/.cache/xxx/corpus/review-queue.jsonl`에 쓴다. SUMMARY.txt에 `ai=` 칸으로 보인다. **제안일 뿐, 판정 기록은 사람이 `--verdict`로만 쓴다.** 결과: correct 13, taste 7, different-role·missing-kind 0 — 상위 20개에서 묶음 오류는 없었다. taste 7개 중 3개는 긴 예외 요소에 맞춘 패딩(covers-reducible)이고, 3개는 `expect` 단언 표(call-statements). **발견:** Codex가 거의 모든 유형에 `;` 앞 공백을 "불필요"로 짚었다(pushed-apart). `;` 열은 작성자가 승인한 약속인데 AI는 그걸 모르고 일반 취향으로 판단했다 → AI에게 활성 약속(3층)을 함께 줘야 약속 기준으로 판정한다. 같은 작업에서 `corpus-judge.ts`가 import 시 CLI를 돌던 백로그 항목을 고쳤다(`bun run check` 약 165초 → 29초).

근거 자료(연구 인용, 코퍼스 측정: 문형 분포, 함수 본문 51.5%, 우리 코드의 if/for/문단 측정)는 S2에서 `docs/research/`로 옮긴다.

## Next milestones (detailed when they become active)

| Milestone | Design phase | Outcome |
|---|---|---|
| M2 Run-last | P0.5 | `xxx format` / `xxx check` wrapping one configured formatter; fixed-point tests |
| M3 Declarative registry | P1 | rule identity = language + context + kind + signature; five review states |
| M4 Corpus | P1.5 | pinned open-source manifest; L1 runner; L2 signatures; judged cases |
| M5 Rules and layers | P2 | `rules/<language>/<region>/` files; preset `recommended`; `.xxx/config.json` |
| M6 Learn | P3 | candidates from a repository; approve / reject |
| M7 Guide and feedback | P4 | agent rule generation; case recording; promotion gate |

## Backlog

Findings outside the active task. Pull into a milestone when relevant.

- Different callees in one table (`run.map(…)` next to `new RegExp(…)`): align `(` after the widest callee and `)` as the cell close, arguments compact (user idea, 2026-09-28). Deferred to M1.5 judging: comparing different calls is rarely useful and `name    (` splits a call. Decide on real data.
- The `;` axis can pad short rows far past column 120 when one row is long (seen in `stress-corpus.ts` during T1, fixed there by extracting a duplicated expression). The checker should warn when alignment pushes a table past 120 columns, pointing to the contract's "simplify the exceptional element first" step.
- `scripts/stress-corpus.ts` still has ten lines over 130 columns that are not tables.
- Import tables are aligned from 2 rows (the pre-existing import rule), unlike other tables (3). Decide whether imports follow the 3-row floor in T4.
- Declaration tables (01.2 and 04.2): let a multi-line declaration's first line join the `=` column; keep declarations and plain assignments apart (agreed 2026-09-28). Inner layers and outliers: M1.6.
- T3: Rust re-parse is unverified locally (`rustfmt` not installed); CI installs it and runs with `XXX_REQUIRE_PARSERS=1`, but the workflow change is unverified until the branch is pushed.
- T3: the TypeScript re-parse gate starts two TypeScript 7 servers per written file (~0.3 s); fine for `--write`, revisit for bulk runs. Updated 2026-09-28: `loadSourceFile` now closes its server (the unclosed ones accumulated gigabytes across runs — seen as ~30 GB in Activity Monitor during repeated checks); the corpus census instead opens one server per source in batches of 25 files.
- T3.5 findings (fixed): (1) the preservation check treated trailing whitespace after a line comment as content, so 10–57 tables per 1,000 variants were refused although the edit was safe; (2) the TypeScript aligner was not idempotent in one pass when lines contain mid-line tabs — `--write` now repeats until stable (max 5 passes).
- T3.5 cost: `bun run check` takes ~19 s with the default mutation counts (1,000 per line-engine language, 5 TypeScript variants). Large runs: `XXX_MUTATIONS=20000` (~2 min, passed 140,000 variants), `XXX_TS_MUTATIONS=100` (~2 min, passed).
- T3.5 deviation: TypeScript runs 5 variants by default instead of 1,000, because each variant starts TypeScript 7 servers through the CLI. A pure in-process TypeScript alignment API would lift this (M3).
- Python on its official `tokenize` / `ast` (engine-level strengthening, moved out of M1.5 on 2026-09-28): revisit when verdicts show the regex profiler missing Python structure.
- `.tsx` is not covered by the TypeScript token check (JSX text whitespace is significant); decide before supporting TSX.
- The stress corpus uses OpenJDK (GPL with classpath exception): keep it for checks only, never copy snippets into fixtures (see design §5.2).
- Choose the final product name, then replace `xxx` / `XXX` in one pass.
- Choose a license before publishing.
- The rules for YAML/JSON (design §4.3, 3.4) need a horizontal-only safety rule before any implementation.
- N4 leftover: a multi-line object literal whose continuation lines align on the first property (hand-made sample, `00_normalize-imports.ts`) — not covered by the guard-row and subscript work; decide with M1.5 judging.
- ~~`scripts/corpus-judge.ts` runs its CLI at module load~~ — 2026-09-30 고침 (`import.meta.main` 가드).
- 표 밖 정렬 공백 정리(2026-09-30): `scripts/strip-stray-padding.ts`로 문장 체제 줄의 가짜 `;` 열을 지웠다(39개 파일, 줄 끝 공백만, 파일마다 토큰 보존 확인). 손으로 여러 열을 맞춘 줄과 이웃과 `;` 열을 이루는 줄은 엔진이 아직 모르는 표일 수 있어 그대로 뒀다 — 표 밖에서 여전히 손으로 맞춘 줄이 약 200줄(주석으로 끊긴 interface, 2줄 블록, 엔진이 거부하는 설정 객체 등). 엔진이 배울 표 후보로 따로 본다.
- S5a 노트(2026-09-30): `common/conventions.ts`(레코드 검증·JSONL·층·glob·충돌), `lookupKeyOf`(`common/signature.ts`), 리포트 `conventions` 칸과 "패턴 DB" 요약 줄. preset DB(`skills/xxx/presets/recommended/conventions.jsonl`)는 아직 비어 있어 모든 표가 미지정이다(S5c에서 승인으로 채움). 깊이 제외 근거: AI 사전 판정에서 깊이만 다른 유형을 합친 키 4개 중 3개는 판단이 같았고, 갈린 1개(선언 `=` 표)의 원인은 깊이가 아니라 2행 표와 긴 예외 요소였다(표마다 A3·A1이 잡음).
- AI 사용량 기록(2026-09-30): 훅 주입분은 `.xxx/cache/usage.jsonl`(추정 토큰: ASCII 4글자당 1, 그 밖 1글자당 1), 외부 AI는 `~/.cache/xxx/corpus/ai-usage.jsonl`(Codex가 보고한 값), 집계는 `bun scripts/usage-report.ts`(모델·출처·이벤트별, AI 사전 판정과 사람 판정의 일치율), `--doc`이면 배포 비용 문서 `docs/research/ai-cost.md`를 다시 만든다. 기록에는 모델과 추론 강도가 남는다(Codex: gpt-6-sol, medium). 흉내 측정: 세션 시작 약 121, 새 파일 안내 약 123(언어별 세션당 1회), 쓴 뒤 알람 약 56–126(새 알람이 있을 때만), 알람 없는 편집 0. 오늘 Codex 교차 검토 5건 합계 77,590토큰(한 건 3,919–27,877). 코퍼스 사전 판정 1차(20개)는 기록 이전이라 수치 없음. Claude 세션 자체의 사용량은 Claude Code의 `/cost`로 확인한다.
- 파일 절 순서 규칙과 AST 이동 도구(2026-10-03, 실사용 TS 저장소에서 검증): §1 공개 타입 → §2 상수 → §3 공개 함수 → §4 내부 처리를 `readability-contract.md`에 규칙으로 옮기고, TypeScript 7 AST로 최상위 문장만 통째로 옮기는 도구(`functions`: 호이스팅되는 내부 function을 끝으로, `types`: 공개 type·interface를 첫 실행 선언 앞으로, `typeof` 파생 타입·선언 병합·파일 헤더·지시문 제외, 쓴 뒤 재파싱 불일치 시 전체 복원)를 `scripts/typescript/`로 들인다. 비공백 토큰 순서가 바뀌므로 design §2 불변식과 별도의 opt-in 명령이어야 한다. 원본 구현·테스트(반례 15개)와 Codex 검토 2회는 해당 저장소에 있다.
- 함수 문단 규칙 후보(2026-10-03): F1 가드 → F2 준비 → F3 처리 → F4 결과. 조사 결과 가드·준비는 번갈아도 정상, 처리 시작 뒤의 새 선언이 주된 이탈(366개 중 75개). 자동 수정이 아니라 관측·SUGGEST 대상이며, 규칙화는 아래 모양 관측 실험의 승인 경로를 따른다.
- 프로젝트 코드 모양 관측(2026-10-04 OBS1 구현·기계 검증, 사용자 지시로 이번 세션 감사 생략; S5c 보조 실험, `docs/reviews/2026-10-03-codex-code-shape-db-review.md`): TS 이름 있는 함수만, `.xxx/cache/shape.jsonl`에 버전·입력 지문·스캔 범위·완료 상태와 단위 관측(스캔 내 id, parent, 범위, 구간 목록)을 저장. 출력은 모양별 개수·분류 가능 비율·대표 위치·반례까지, 사람이 고른 사례만 S5b 경로로. SQLite·전 언어·이름 변경 추적·미승인 모양 GUIDE 주입·분포 기반 자동 수정은 보류.
