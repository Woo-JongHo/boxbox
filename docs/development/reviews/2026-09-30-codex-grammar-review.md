# Codex 교차 검토 — 문법 초안 (2026-09-30)

대상: `skills/boxbox/references/charter.md`, `skills/boxbox/references/grammar.md` 초안 (M1.8 S2)
검토자: Codex CLI 0.158 (`codex exec --sandbox read-only`, 문서 본문만 입력, 파일 접근 없음)
원래 Gemini에게 요청했으나 Gemini CLI 0.59가 개인 계정 등급을 거부해(`IneligibleTierError`) Codex로 대체했다.

## 질문과 답, 반영

| # | Codex 의견 | 결정 | 반영 |
|---|---|---|---|
| 1 | `RETURN`을 `WHEN`의 결과로만 두는 데 반대. 조건 없는 `return value`는 `WHEN`이 아니며, `throw`는 결과값이 아니라 흐름 종료. 8개를 지키려고 오분류하면 안 된다 | 수용 | 문형 `EXIT`(return, throw, break, continue) 추가 → 9개. guard = `WHEN` 안의 `EXIT` |
| 2 | 반복 형태는 문형 ID로 올리지 않는 데 동의. 동사만으로 확정하지 말고 확인 못 하면 `UNCERTAIN` | 수용 | 4절: 반복 형태는 약속 어휘, "동사는 힌트일 뿐" |
| 3 | Java 허용 라이선스 코퍼스를 지금 고정해야 한다. 미루면 "미대응 0개"를 일반화할 근거가 없다 | 수용 | 계획 M1.8 S2.5 추가. 그 전까지 Java 분포는 근거로 쓰지 않음 |
| 4a | "미대응 0개"는 3행 이상 표에 대한 결과일 뿐, 모든 문장이 문형으로 설명된다는 증거가 아니다 | 수용 | 0절 적용 범위 신설, 6절에 한정 명시 |
| 4b | `NAME`/`TARGET`/`KEY`, `VALUE`/`RESULT`, `ITEM`/`ARGS`의 경계가 흐리다. `case` 패턴은 일반 조건과 다르다 | 수용 | "역할은 문형 안에서만 정의된다", 역할별 사용 문형 표. `case`는 `CONDITION`에 묶고 열린 질문으로 |
| 4c | Python "들여쓰기 0 = 모듈 수준"은 틀렸다(모듈 `if` 안, 클래스 본문, `global`/`nonlocal`, 속성 대입). "같은 `=`라서 모호해도 무해"는 성급하다 | 수용 | 판정 규칙 2·3 교체: Python `a = v`는 모두 모호, 속성·원소 대입은 확실한 `CHANGE`, 모호한 행은 확실한 행과 한 표로 묶지 않음 |
| 4d | "빈 줄 문단 = 표"는 과하다. 한 문단에 다른 역할이 있을 수 있다 | 수용 | 1절: 문단(빈 줄 묶음)과 표(문단 안 같은 문형 3행 이상) 구분 |
| 4e | 동사 사전으로는 `load`, `create`의 부수효과를 판정할 수 없다 | 수용 | 4절: 문단 목적은 SUGGEST 이하, 확인 불가 시 `UNCERTAIN` |
| 4f | "코드는 언어다"가 파서보다 앞서 분류를 결정하면 잘못된 확신을 준다 | 수용 | 0절: 분류는 파서가 먼저, 비유는 이름 붙이기 |

전부 수용했다. 특히 4c(Python 규칙 오류)와 4d(문단과 표 혼동)는 초안의 실제 오류였다.

> Historical naming note (2026-10-12): this record predates the confirmed product name `boxbox` and npm package `boxbox`. Maintained links and examples use the current names; earlier placeholder-name findings are historical, not current naming blockers. Raw execution evidence remains unchanged.
