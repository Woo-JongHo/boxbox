# 실제 구현 문서 검증 기록

날짜: 2026-10-04 · 기준 커밋: `8338798`와 당시 작업 트리

## 범위와 판정

사용자 요청은 실제 코드의 구조·실행 흐름·구현된 기능·한계를 문서화하는 것이다.
대상은 [`implementation.md`](../implementation.md), [`README.md`](../../README.md),
[`plan.md`](../plan.md)의 DOC1 항목이다. 실행 코드와 기존 테스트는 수정하지 않았다.

Codex 조사 두 패스와 문서 저작 패스를 분리했고, 통합 과정에서 다시 소스를 대조했다.
그 과정에서 훅 timing 경로, Java 지원 문형, TypeScript 편집 개수·종료 코드,
function-map의 표준 출력과 파일 쓰기 차이를 수정했다.

**기계 검증과 소스 대조는 수행했다. 반대 provider의 독립 검토와 최종 감사는 미실행이다.**
이 기록은 최종 감사 통과나 제품 배포 승인을 뜻하지 않는다.

## 실행한 검증

| 명령 | 결과 |
|---|---|
| `bun run check` | 종료 0. 306 pass, 5 skip, 0 fail, 311 tests / 32 files. 테스트 약 40초. 이어 타입 검사와 `bash -n install.sh` 통과 |
| `bun skills/xxx/scripts/typescript/06_align-tables.ts --file skills/xxx/fixtures/table-kinds.ts --json` | 종료 1. groups 10, misaligned 10, edits 52, parse `not-run`. 미정렬 fixture의 예상 결과 |
| `bun skills/xxx/scripts/python/06_align-tables.ts --file skills/xxx/fixtures/python/tables.aligned.py --json` | 종료 0. groups 11, misaligned 0, suggested 2, parse `not-run` |
| `bun skills/xxx/scripts/report.ts --file skills/xxx/fixtures/python/tables.aligned.py --baseline none --json` | 종료 0. `ok=true`, S2/S3 `not-run`, convention records 0, unknown 9 |
| `bun skills/xxx/scripts/go/06_align-tables.ts --file skills/xxx/fixtures/go/tables.go --json` | 종료 0. misaligned 11, parse `not-run`. 기본 report-only 동작 |
| 변경 문서 4개의 상대 링크·미완성 표식 확인 | 상대 링크 77개, 누락 0개, 미완성 표식 0개 |
| `git diff --check` | 통과 |

skip 5건은 로컬 Rust parser 관련 3건과 Kotlin parser 관련 2건이다. 이 검사를 통과로 세지 않았다.
`scripts/eval.ts`는 당시 미추적 연구 도구이며 전용 테스트가 없고 현재 TypeScript 검사 대상도 아니다.
평가 모델 호출, 코퍼스 재수집, 실제 호스트 플러그인 설치는 이번 문서 검증에서 실행하지 않았다.

## 외부 검토 시도와 blocker

읽기 전용 도구 `Read`, `Grep`, `Glob`만 허용하고 MCP·사용자 커스터마이징을 끈 Claude CLI로
두 검토를 별도 요청했다. 쓰기·명령 실행 도구는 부여하지 않았다.

| 단계 | 요청 모델 | 실행 결과 |
|---|---|---|
| 독립 검토 | `claude-sonnet-5` | 종료 1, `is_error=true`, 모델 사용 기록 없음 |
| 최종 감사 | `opus` | 종료 1, `is_error=true`, 모델 사용 기록 없음 |

두 호출의 오류 응답은 동일했다.

> You've hit your weekly limit · resets 4am (Asia/Seoul)

모델 실행 전에 한도 오류가 반환됐으므로 리뷰 내용이나 판정은 생성되지 않았다.
특히 `opus` 감사를 낮은 모델로 자동 대체하지 않았다. **반대 provider 독립 검토와 Opus 최종
감사 미실행을 blocker로 남긴다.** 한도 해제 뒤 최종 문서를 대상으로 다시 수행해야 한다.
