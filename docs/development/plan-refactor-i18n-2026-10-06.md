# 리팩토링·영문화 준비 계획 — 2026-10-06

실행 계획이 아니라 준비 문서다. `docs/handoff-2026-10-05.md`의 경계(미커밋 혼재 상태에서
일괄 정리 금지)를 존중하며, 실행은 커밋 경계 정리 뒤 순서대로 한다.

## 1. 실측된 범위 (2026-10-06)

| 항목 | 수치 |
|---|---|
| TS 코드 총량 (skills/boxbox/scripts + scripts) | 11,591행 |
| 한국어가 포함된 TS 파일 | 27개 (skills 17 + scripts 10) |
| 전체 TS 한글 행 | 330행 |
| **배포 표면의 한글 행** | **common/ 169행 + typescript/ 3행 (cli.ts 0행)** |
| 테스트 한글 행 (test/) | 229행 — describe/test명 중심 |
| 한국어 문서 | docs/ 하위 md 35개 |
| 이름 placeholder | `boxbox`/`BoxBox` — package.json, `skills/boxbox/` 경로, 문서 전반 |

해석: 코드 내 한국어는 소량(330행)이고 **사용자에게 보이는 것은 배포 표면 172행으로 좁다**.
부피는 문서(35개 md)와 테스트명에 있다. "영문화"는 대규모 작업이 아니라 3단계로 나뉘는
작은 작업들의 순서 문제다.

## 2. 영문화 — "바꿔야 하나"에 대한 답

**배포 표면은 바꾼다(필수). 내부 기록은 바꾸지 않는다(원칙).**

- **Phase A (첫 공개 전 필수):** 사용자가 보는 문자열 — `common/` 169행(check/doctor/format
  리포트·오류 메시지)과 `typescript/` 3행. Reddit·공개 대상이 영어권이고, 오류 메시지가
  한국어면 신뢰가 떨어진다. 172행이면 문자열 테이블 같은 i18n 프레임워크 없이 직접 교체가
  맞다(과설계 방지).
- **Phase B (첫 공개 전 권장):** README 영문 정리(이미 영문 기반이라 한국어 단락만 정리),
  design.md·implementation.md·release-contract.md 영문화. 외부 기여자·Reddit 독자가 읽는 표면.
- **Phase C (선택):** 테스트명 한국어 229행, 코드 주석. 테스트명은 CI 로그 언어일 뿐
  사용자 표면이 아니므로 급하지 않다.
- **유지:** `docs/reviews/`, `docs/handoff-*.md` 등 내부 판정 기록은 한국어 그대로 둔다.
  원장 언어를 뒤섞으면 기록 추적성이 나빠진다. AGENTS.md도 내부 규칙이므로 유지.

교체 시 주의: 한글 문자열은 테스트 단언에도 쓰인다(예: 리포트 문구 검증). 문자열 교체는
**해당 단언을 같이 갱신하는 커밋**으로 한다 — 테스트가 깨지는 범위가 곧 영향 범위라는
점을 회귀 검출기로 활용한다.

## 3. 리팩토링 후보 (관찰 기반, 우선순위)

1. **리포트 모듈 중복**: `scripts/report.ts`와 `skills/boxbox/scripts/common/report.ts`가
   공존한다. 어느 쪽이 정본인지 확인하고 개발용/배포용 경계를 코드로 명확히 한다
   (구현 문서의 기술과 실제 import 그래프 대조).
2. **CLI 이중 진입점**: `skills/boxbox/scripts/cli.ts`(공개)와 개발용 언어별 스크립트
   (`06_align-tables.ts` 등)의 관계가 문서로는 정리돼 있으나 코드상 dispatcher가
   얇은지, allowlist가 빌드 스크립트에만 존재하는지 확인 — 빌드 스크립트의 파일
   allowlist를 테스트로 고정(우회 방지, release-contract §쓰기 표면의 요구).
3. **이 저장소의 고유 정렬 스타일은 리팩토링 대상이 아니다.** 문자열 뒤 공백 정렬
   (`const action = args[0]       ;`)은 이 플러그인이 주장하는 형태를 스스로 적용한
   살아있는 데모다. 일반 포매터 스타일로 "정리"하면 오히려 제품 주장을 깨는 행위다.
   README에 "this repository dogfoods itself" 한 줄을 넣는 쪽이 맞다.
4. **이름 교체 1-pass는 리팩토링과 분리한다.** `boxbox`→최종 이름 교체는 디렉터 rename을
   포함해 설치 경로·훅·문서 전반에 파급되므로 REL11 동결 시점에 단일 커밋으로 실행하는
   기존 계획을 유지한다. 미리 섞으면 diff 리뷰가 불가능해진다.
5. **죽은 코드·보조 writer**: 승인 정책을 우회하는 raw writer가 공개 artifact에서
   제외돼 있다는 기록이 있다. 소스에서 제거할지 보존할지는 REL10 allowlist 확정 때
   함께 결정 — 지금 삭제하지 않는다(테스트 참조 가능성).

## 4. 실행 순서 (승인 시)

1. **커밋 경계 정리**: 미커밋 60건을 주제별 커밋으로 분리. 리팩토링·영문화의 전제.
2. **Phase A 영문화** (172행 + 관련 테스트 단언): 1커밋, `bun run check` 녹색 유지.
3. **리팩토링 1·2** (리포트 정본 확인, allowlist 테스트 고정): 1-2커밋.
4. **Phase B 영문화**: 문서 3종(README 정리, design, implementation).
5. 이후 Reddit 시나리오 문서의 자료 체크리스트로 연결.

각 단계는 한 축만 바꾸고 `bun run check`로 판정한다. 2와 3을 같은 커밋에 섞지 않는다.

> Historical naming note (2026-10-12): this record predates the confirmed product name `boxbox` and npm package `boxbox`. Maintained links and examples use the current names; earlier placeholder-name findings are historical, not current naming blockers. Raw execution evidence remains unchanged.
