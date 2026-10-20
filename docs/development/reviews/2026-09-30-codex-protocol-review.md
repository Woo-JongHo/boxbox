# Codex 교차 검토 — 동일 조건 강화와 실험 프로토콜 (2026-09-30)

검토자: Codex CLI 0.158, gpt-6-sol, medium, 4,486토큰 (purpose: dev-review, `~/.codex/AGENTS.md` 로드 상태)

| # | Codex 의견 | 반영 (`docs/research/eval-protocol.md`) |
|---|---|---|
| 1 | 자연어 규칙으로는 동일 조건이 안 됨. 매니페스트로도 공급자 무작위성·숨은 시스템 지시·모델 변경은 못 고정. CLI의 도구·메모리·자동 업데이트·기본 프롬프트 개입. 실행 전 격리 검사, 도구·세션 끄기, 관찰 못 하는 부분 명시, seed 지원 확인 | 3절 매니페스트 강제, "고정할 수 없는 것" 명시 |
| 2 | 수단은 결론 대상에 맞춰: 모델 자체 → raw API, CLI 실험의 결론은 CLI·버전·설정 조합에 한정. 섞어 해석 금지 | 1절·3절, 11절 결정 필요 |
| 3 | 정답 0개·판정자 1명으로는 우월성 결론 불가. 판정 기준·unsure 처리·이견 절차 먼저. model×effort는 완전 요인 설계 아님. H2(프롬프트)·H3(정책)은 별도 실험 | 2절 단계, 9절 |
| 4 | 불균형 5범주에서 κ 단독 주지표 부적절. 배포 분포 정확도 + 판정별 재현율(위험 범주 최소 성능)을 주 기준, 균형 정확도·macro-F1 보조, κ·AC1은 민감도. 가중 κ는 순서 없는 범주에 부적합. 과표집은 배포 분포로 해석 불가 | 5절 |
| 5 | δ=0.10은 근거 없음, κ와 정확도의 0.10은 다름. 절대 오류 증가·범주별 손실로 정하고 항목 단위 쌍체 CI로 검정. McNemar는 정오 차이 전용. 반복은 표본 수가 아님(항목별 묶음). 수백 항목 필요할 수 있음 | 6·7·8절 |
| 6 | 단독 판정자는 탐색 파일럿엔 가능, 확증 근거로 약함. 블라인드 재판정으로 판정자 내 일관성, 판정자 간은 두 번째 판정자 필요 | 9절 |
| 7 | 파일럿 축소: 판정 지침 → 소규모 층화 표본, luna-low·haiku·sol-medium, 프롬프트·반복 하나. 결론은 "설계가 실행 가능한가" | 파일럿 설계 |

> Historical naming note (2026-10-12): this record predates the confirmed product name `boxbox` and npm package `boxbox`. Maintained links and examples use the current names; earlier placeholder-name findings are historical, not current naming blockers. Raw execution evidence remains unchanged.
