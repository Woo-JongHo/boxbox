# AI 사용량과 정확도 — 배포하면 얼마나 쓸까

자동 생성: `bun scripts/usage-report.ts --doc` · 기록 9건

## 측정 방식

- **훅 주입분:** 에이전트(호스트 모델)의 입력으로 들어가는 글. 토크나이저 없이 추정한다(ASCII 4글자당 1, 그 밖 1글자당 1). 모델은 호스트가 알려주지 않으면 `host`.
- **외부 AI(Codex):** 도구가 보고한 토큰과 모델·추론 강도. 캐시된 입력은 빼고 세는 것으로 보인다(짧은 요청이 유난히 적게 나옴).
- **Claude 세션 자체**(설계·구현 대화)는 여기 없다. Claude Code의 `/cost`로 확인한다.

## 사용량

| 모델 | 출처 | 이벤트 | 횟수 | 글자 | 토큰 | 회당 토큰 |
|---|---|---|---|---|---|---|
| gpt-6-sol | codex-cli 0.158.0-alpha.2.1 | attribute-order-review | 1 | 3858 | 17182 | 17182 |
| gpt-6-sol | codex-cli 0.158.0-alpha.2.1 | authoring-flow-review | 1 | 4214 | 24680 | 24680 |
| gpt-6-sol | codex-cli 0.158.0-alpha.2.1 | grammar-review | 1 | 9400 | 27877 | 27877 |
| gpt-6-sol | codex-cli 0.158.0-alpha.2.1 | learning-db-review | 1 | 3295 | 3919 | 3919 |
| gpt-6-sol | codex-cli 0.158.0-alpha.2.1 | lookup-review | 1 | 3071 | 3932 | 3932 |
| unknown | hook | PostToolUse | 2 | 325 | 182 (추정) | 91 |
| unknown | hook | PreToolUse | 1 | 194 | 123 (추정) | 123 |
| unknown | hook | SessionStart | 1 | 168 | 121 (추정) | 121 |

## 정확도 (AI 사전 판정 vs 사람 판정)

사람 판정 0건, AI 제안 20건: 둘 다 있는 유형이 없어 아직 계산할 수 없다.

## 배포 시 추정 방법

- 사용자 한 명의 하루 토큰 ≈ 세션 수 × 세션 시작 회당 + 새 파일 수 × 새 파일 안내 회당 + 편집 수 × (새 알람이 생긴 편집 비율) × 쓴 뒤 알람 회당.
- 새 알람 비율은 실제 사용 기록이 쌓여야 정해진다(흉내 측정만 있음).
- 외부 AI(사전 판정·교차 검토)는 개발 과정의 비용이며, 사용자 쪽 기본 흐름에는 들어가지 않는다.
