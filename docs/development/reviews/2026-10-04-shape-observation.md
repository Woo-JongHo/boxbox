# OBS1 — TypeScript 함수 구조 관측 구현·검증

일자: 2026-10-04. 상태: **구현·기계 검증 완료, 사용자 수락 대기; 이번 세션 별도 감사 생략**.
사용자가 코드 모양 관측 DB의 최소 수집기 착수를 승인했다. 공개 배포 완료 판정은 아니다.

## 변경과 계약

- [수집기](../../../product/engine/typescript/09_observe-shapes.ts): 명시한 TS 파일의 이름 있는
  함수 선언과 직접 문장만 관측한다. AST와 진단은 동일한 TypeScript API 스냅샷에서 읽는다.
- [회귀 테스트](../../../test/shape-observation.test.ts): 결정성, 설정 지문, 실제 파서 버전,
  중첩·동명·같은 줄 선언, 분류 불가/적용 불가, 부분 실패와 캐시 보존 등을 확인한다.
- 캐시 위치는 `.boxbox/cache/shape.jsonl`, 비교본은 `shape.previous.jsonl`이다.
  `.gitignore`에 캐시를 제외했고 임의 프로젝트에서는 캐시 안 `.gitignore`를 최초 생성한다.
- 화살표·본문 없는 선언 수는 관측 범위의 한계를 드러내는 보조 숫자다. 모든 함수 종류의 완전한
  미지원 통계는 아니며, `complete`는 명시 파일 집합의 스캔 완료를 뜻한다.
- 설정·규칙·preset·formatter 지문은 CLI에서 자동 탐지하지 않고 `unknown`으로 기록한다.
  API에서 주어진 지문은 snapshot fingerprint에 포함한다. 별도의 캐시 재사용 경로는 없다.

## 실행 증거

| 검사 | 결과 |
|---|---|
| `bun test test/shape-observation.test.ts` | 9 pass, 0 fail, 28 assertions |
| `bun run check` | 종료 0, 315 pass / 5 skip / 0 fail, 320 tests / 33 files; tsc와 설치 shell 문법 검사 통과 |
| 변경 두 TS의 `00_normalize-imports.ts` | files=2, changed=0, errors=0 |
| 변경 두 TS의 `06_align-tables.ts --file` | 각각 종료 0, misaligned=0 |
| `git diff --check` | 통과 |
| 변경 코드·테스트의 TODO/skip/only/미구현 자리표시 검색 | 발견 없음 |

Rust parser 3건과 Kotlin parser 2건 skip은 기존 로컬 환경 제약이며 통과로 세지 않았다.
저장소 전체 105개 TS의 정렬·import 검사는 구현 도중 실행했다. 기존 미추적 연구 도구
`scripts/eval.ts`가 두 검사에서 실패했고, 당시 작성 중인 새 두 파일도 실패했다.
새 두 파일은 최종 재검사에서 통과했다. `eval.ts`는 기존 변경을 보존했으며 전체 자체 정렬이
모두 통과했다고 주장하지 않는다.

실제 subprocess CLI로 별도 임시 프로젝트를 실행해 확인했다.

1. 두 파일의 동명·중첩 선언 4개에 서로 다른 ID가 있고 부모 관계가 유지된다.
2. `--file` 순서를 뒤집어도 JSONL이 byte 단위로 같다.
3. 정상 스캔 전후 소스와 `.boxbox/{conventions,examples,decisions}.jsonl`이 같다.
4. malformed 입력은 종료 1과 부분 실패를 보고하고 직전 정상 캐시는 보존한다.
5. 정상 TS + JavaScript + 누락 파일은 성공 1, 실패 2로 보고한다.
6. 이미 점유한 writer lock과 16MiB를 넘긴 원문은 거절하며 정상 캐시를 보존한다.
7. 임의 프로젝트 캐시 안 `.gitignore`에 `*`가 생성된다.

실제 저장소에서도 다음 명령을 실행했다.

```bash
bun skills/boxbox/scripts/typescript/09_observe-shapes.ts \
  --file skills/boxbox/scripts/typescript/09_observe-shapes.ts \
  --file skills/boxbox/scripts/typescript/01_group-regions.ts
```

결과: 명시한 2개 파일 성공, 이름 있는 함수 19개, 직접 문장 86개 중 56개 분류 가능,
화살표·본문 없는 선언 26개. 이는 해당 두 파일의 관측치이며 전체 프로젝트 품질 점수가 아니다.

## 증거 원본과 검토 한계

- 저작 전문: `/tmp/boxbox-shape-collector-notes.md`
- 별도 읽기 전용 경계 조사: `/tmp/boxbox-shape-validation-cases.md`
- 전체 검사: `/tmp/boxbox-shape-checks/check-final.log`
- CLI 스모크: `/tmp/boxbox-shape-checks/smoke.py`, `smoke-result.json`, `edge-smoke.json`
- 저장소 관측: `/tmp/boxbox-shape-checks/repo-scan.json`
- 전체 자체 정렬 검사: `/tmp/boxbox-shape-checks/baseline-selfcheck.json`

Codex 저작과 별도 읽기 패스에서 발견한 AST 스냅샷 혼용·파일 간 ID·표현식 오분류·캐시 writer 경합을
보완했다. 이것은 지정된 반대 provider 리뷰나 최종 감사의 대체가 아니다.
Claude Sonnet 5 독립 검토와 Opus 최종 감사는 앞선 주간 사용량 한도로 미실행이었다.
이후 사용자가 토큰 부족으로 이번 세션 별도 감사를 생략하도록 지시했다(2026-10-04).
감사·대체 감사 호출을 하지 않으며 이번 세션 진행 blocker로 삼지 않는다. 감사 통과로 기록하지 않는다.

캐시는 두 파일을 묶은 트랜잭션·프로세스 강제 종료 후 자동 복구를 제공하지 않는다.
규칙 승인·GUIDE 공급·자동 수정 gate·통합 공개 CLI 연결·Python 함수 관측은 별도 작업이다.

> Historical naming note (2026-10-12): this record predates the confirmed product name `boxbox` and npm package `boxbox`. Maintained links and examples use the current names; earlier placeholder-name findings are historical, not current naming blockers. Raw execution evidence remains unchanged.
