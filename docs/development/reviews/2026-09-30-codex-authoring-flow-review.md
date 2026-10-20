# Codex 교차 검토 — 작성 흐름 (2026-09-30)

대상: `docs/authoring-flow.md` 초안 (NEW/MODIFY 축, 쓰기 전·후 훅), 헌장 핵심 3줄, 검사 리포트 요약
검토자: Codex CLI 0.158 (`codex exec --sandbox read-only`, 문서 본문만 입력)

| # | Codex 의견 | 결정 | 반영 |
|---|---|---|---|
| 1 | NEW/MODIFY는 첫 분기로 적절. 생성·벤더·포매터 소유·테스트는 상위 축이 아니라 적용 대상·소유권 정책 | 수용 | 1절: `scopes` 정책으로 |
| 1' | "없는 경로 = NEW"는 이름 변경·삭제 후 재생성을 오인. 기존 표에 행을 보탠 추가 구간은 MODIFY. 기준본에 그 문형·표가 있었는지로 판별해야 | 수용 (초안 오류) | 1절: 기준본 비교로 판별 |
| 2 | 편집 줄과 겹치는 표만 정렬은 좋은 기본값. 표 경계가 바뀌면 범위 재계산 필요 | 수용 | 3절 규칙 3 |
| 2' | 알람 총개수 래칫은 하나 사라지고 하나 생기면 통과. 종류·대상별로 짝지어 새 알람을 보고해야 | 수용 (초안 오류) | 3절 규칙 2 |
| 2'' | "정렬된 표 비율"로 레거시 판정은 임계값이 자의적이고 작은 편집을 막음. 표가 따르는 문형이 명확한지로 판단 | 수용 | 3절 규칙 1: 표 단위, 기준본에서 이미 정렬됐던 표만 재정렬 |
| 3 | 자동 쓰기 전에 실행 계약 확정: 포매터 순서 보장, 바뀐 내용 전달, 여러 파일 기준본·실패·부분 성공, 재시도 중복, 누적 지연. 순서 보장 못 하는 호스트에선 자동 정렬 금지 | 수용 | 4절 |
| 4 | 대기열만으로 승인권이 분리되지 않음. DB 승인 경로 접근 차단, 근거·기준본·제안 diff, 중복 묶음. 안전 검사 실패는 알람과 구분해 작업 실패로 | 수용 | 2절, 5절 |
| 5 | 첫 출시: 한 호스트에서 GUIDE + 읽기 전용 리포트, 기준본·편집 범위·새/기존 알람 구분까지. 자동 정렬·레거시 규칙·다중 호스트·DB 배선은 실측 후 | 수용 | 6절, 계획 S3.6 |

전부 수용했다. 초안의 실제 오류는 NEW 판별 기준(경로 기반)과 총개수 래칫이었다.

> Historical naming note (2026-10-12): this record predates the confirmed product name `boxbox` and npm package `boxbox`. Maintained links and examples use the current names; earlier placeholder-name findings are historical, not current naming blockers. Raw execution evidence remains unchanged.
