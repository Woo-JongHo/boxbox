# 모델 평가 설계 — 어떤 모델이 이 작업에 적합한가

상태: 설계 (M1.8 E1) · 날짜: 2026-09-30 · 검토: `docs/reviews/2026-09-30-codex-eval-review.md` 반영 대기

## 1. 목적

개발하면서 **"이 작업을 돌리는 데 어떤 모델(과 설정)이 적합한가"**를 근거와 함께 알린다. 대상은 Codex(OpenAI)와 Claude 모델이다. 기준은 두 가지다.

1. **동일한 조건**에서 돌려 **토큰 비용과 정확도**를 잰다.
2. 정확도는 단순 일치율이 아니라 **통계적으로 해석할 수 있는 지표**(4절)로 본다.

결론은 "기준을 넘는 설정 중 가장 싼 것"이다. 기준(허용 오류)을 먼저 정하고, 그다음에 비용을 비교한다.

## 2. 토큰 가격 정본 (USD / 100만 토큰, 표준 요금)

| 공급자 | 모델 | 입력 | 캐시 읽기 | 캐시 쓰기 | 출력 | 강도(effort) |
|---|---|---|---|---|---|---|
| OpenAI | gpt-6-astra | 10.00 | 1.00 | — | 50.00 | low · medium · high |
| OpenAI | gpt-6-sol | 2.00 | 0.20 | — | 10.00 | low · medium · high |
| OpenAI | **gpt-6-luna** | **0.10** | **0.01** | — | **0.50** | low · medium · high |
| OpenAI | gpt-5.6-terra | 2.00 | 0.20 | — | 12.00 | low · medium · high |
| OpenAI | gpt-5.6-luna | 0.20 | 0.02 | — | 1.20 | low · medium · high |
| Anthropic | claude-fable-5-1 | 10.00 | 0.25 | 입력 × 1.25 | 50.00 | low–max |
| Anthropic | claude-opus-5-5 | 4.00 | 0.20 | 입력 × 1.25 | 20.00 | low–max (기본 medium) |
| Anthropic | claude-sonnet-5 | 2.00 | 입력 × 0.1 | 입력 × 1.25 | 10.00 | low–max |
| Anthropic | **claude-haiku-4-5** | **1.00** | 입력 × 0.1 | 입력 × 1.25 | **5.00** | **없음** (사고량은 `budget_tokens`) |

- OpenAI 가격은 짧은 문맥 기준이다(긴 문맥은 대략 2배). 추론 토큰은 출력으로 과금되는 것으로 보나 공식 페이지에 명시되지 않아 확인이 필요하다. `gpt-reserve`는 가격 공개가 없다.
- Anthropic 캐시 쓰기 1.25배는 5분 TTL 기준이다.
- **출처:** OpenAI [API Pricing](https://developers.openai.com/api/docs/pricing) (2026-09-30 확인), Anthropic Claude API 모델 표(2026-06-24 캐시, `claude-api` 스킬). 가격이 바뀌면 이 표를 먼저 고친다.
- Codex CLI는 ChatGPT 요금제로 돌 수 있고 Claude Code는 Claude 요금제로 돈다. 이 표는 **API로 같은 일을 할 때의 비용**을 환산하는 정본이다.

## 3. 무엇을 재나 — 이 시스템이 돌 때만

- **측정 대상은 이 시스템이 실제로 AI를 부르는 경우뿐이다:** 코퍼스 사전 판정, 훅이 주입하는 글, 평가 실행. 설계를 위한 교차 검토(Codex 리뷰)는 개발 비용으로 **따로 표시**하고 배포 비용 추정에 넣지 않는다. 사용량 기록의 `purpose` 칸을 `system` / `dev-review`로 나눈다.
- **정확한 값만 쓴다:** 공급자가 돌려주는 입력·캐시 읽기·캐시 쓰기·출력 토큰을 따로 기록한다. Claude는 `claude -p --output-format json`의 사용량, Codex는 `codex exec`의 토큰 보고(구성 확인 필요). 추정치는 훅 주입분처럼 불가피한 곳에만 쓰고 `estimated`로 표시한다.
- **비용은 2절 표로 환산한다.** 첫 실행(차가운 캐시)과 반복 실행(데워진 캐시)을 따로 보고한다.

## 4. 정확도 — 연구에서 쓰는 지표로

과제 A(사전 판정)는 사람 판정과의 **범주 일치** 문제다. 단순 일치율은 쏠린 분포에서 부풀려진다(상위 20개가 correct 13 · taste 7이면, 전부 correct라고 답해도 65%). 그래서 다음을 함께 본다.

| 지표 | 무엇을 보나 | 근거 |
|---|---|---|
| **Cohen의 κ(카파)** | 우연히 맞을 확률을 뺀 일치도. 해석 구간: 0.61–0.80 상당, 0.81 이상 거의 완전 | Cohen (1960); 해석 구간 Landis & Koch (1977) |
| **판정별 정밀도·재현율, macro-F1** | 드문 판정(`different-role`, `missing-kind`)을 놓치는지 | 분류 평가 표준 |
| **Wilson 점수 신뢰구간** | 표본이 작을 때 일치율의 불확실성 | Wilson (1927) |
| **McNemar 검정** | 같은 항목에서 두 설정의 정오가 유의하게 다른가 | McNemar (1947); 분류기 비교에 권장: Dietterich (1998) |
| **반복 안정성(σ)** | 같은 항목을 여러 번 돌렸을 때 답이 흔들리는 정도: 항목별 점수의 표준편차, 반복 간 Fleiss κ | 자기 일관성: Wang et al. (2022) |

과제 B·C(가이드대로 쓰기, 알람 보고 고치기)는 **기능 테스트 통과가 먼저**이고, 통과한 것 안에서 새 알람 수·해결률을 본다(Codex 평가 검토). 비율에는 Wilson 구간을, 설정 비교에는 McNemar를 쓴다.

**통과 기준(제안, 사용자 확정 필요):** 과제 A는 κ ≥ 0.61이고 드문 판정의 재현율 ≥ 0.5, 과제 B·C는 기능 테스트 100%.

## 5. 동일 조건

지금 구조는 **Claude 세션이 조정하고, Codex와 Claude를 자식 프로세스로 부르는** 교차 실행이다. 조정하는 세션의 맥락이 평가 대상에 새지 않게 다음을 지킨다.

1. **실행마다 새 폴더:** 과제 파일만 든 임시 폴더에서 돌리고 버린다.
2. **전역 지시 끄기:** `~/.codex/AGENTS.md`(4.2KB), `~/.claude/CLAUDE.md`, 프로젝트 메모리가 끼지 않게 한다. 끌 수 없으면 결과에 적는다. 지금까지의 Codex 교차 검토는 `~/.codex/AGENTS.md`의 영향을 받았을 수 있다.
3. **같은 입력·도구·권한:** 프롬프트 바이트, 샌드박스, 최대 출력 토큰을 같게 하고 설정값을 기록한다.
4. **순서 섞기와 돌아가며 반복:** 항목마다 설정 순서를 시드로 섞고 여러 바퀴 돈다. 시드를 기록한다.
5. **캐시 분리:** 입력·캐시 읽기·캐시 쓰기·출력을 나눠 기록하고, 차가운/데워진 캐시 비용을 따로 낸다.
6. **블라인드 채점:** 사람이 보는 부분은 모델 이름과 AI 제안을 가린다.
7. **조정 세션은 채점하지 않는다:** 정답(사람 판정·기능 테스트·검사 리포트)과 대조는 결정적 코드가 한다. 조정하는 Claude 세션이 결과를 판단하지 않는다.

## 6. 축

| 축 | 1차 값 |
|---|---|
| 과제 | A 사전 판정 (B·C는 기능 테스트가 있는 과제를 만든 뒤) |
| 공급자 · 모델 | gpt-6-luna, claude-haiku-4-5 (경량 우선). 올리기 단계로 gpt-6-sol, claude-sonnet-5 |
| **강도** | gpt-6-luna: low, medium · claude-haiku-4-5: 없음(사고 끔) · claude-sonnet-5: low · gpt-6-sol: low |
| 프롬프트 | 약속·예문 없음 / 있음 |
| 반복 | 1회로 시작, 결과가 갈리면 3회 |

강도는 모델마다 가능한 값이 다르다(2절). 같은 이름이라도 공급자 사이에서 같은 뜻이 아니므로, 강도는 **모델 안에서만** 비교한다.

## 7. 자동으로 한 단계 올리기

경량 설정이 **틀렸거나 헛돌 때만** 한 단계 위 설정으로 다시 부른다.

| 신호 | 판정 방법 |
|---|---|
| 형식 오류 | 응답 JSON이 스키마를 통과하지 못함 |
| 모름 | 판정이 `unsure` |
| 흔들림 | 같은 항목 2회 응답이 다름(자기 일관성 불일치) |
| 헛돎 | 시간 초과, 토큰 상한 도달, 같은 출력 반복 |
| 약한 판정 | 평가에서 이 설정의 재현율이 낮다고 확인된 판정(예: 드문 판정)을 냈을 때 |

사다리(공급자 안에서): `gpt-6-luna low → gpt-6-luna medium → gpt-6-sol low`, `claude-haiku-4-5 → claude-sonnet-5 low`. 최상위(astra, opus, fable)는 쓰지 않는다. **올라간 비율과 완료된 항목당 비용**을 함께 보고한다(요청당 비용이 아니라). 올리기로 나온 판정도 제안일 뿐이며, 승인은 사람만 한다.

## 8. 순서

1. 사용량 기록에 `purpose`, 입력·캐시·출력 칸 추가, 2절 표로 비용 환산.
2. 평가 실행기 `scripts/eval.ts`: 5절 규칙을 코드로 강제하고 실행마다 폴더·시드·순서·설정을 기록.
3. 과제 A 파일럿: 상위 20개 유형 × (luna low, luna medium, haiku) × 1회. Sol 제안과의 일치도와 비용. (정확도가 아니라 가늠용)
4. 블라인드 판정으로 기준 세트를 만든 뒤 κ·F1·Wilson·McNemar로 비교.
5. 올리기 규칙을 켜고 올라간 비율과 완료 항목당 비용을 잰다.

## 참고 문헌

- Cohen, J. (1960). A coefficient of agreement for nominal scales. *Educational and Psychological Measurement*, 20(1), 37–46.
- Landis, J. R., & Koch, G. G. (1977). The measurement of observer agreement for categorical data. *Biometrics*, 33(1), 159–174.
- Wilson, E. B. (1927). Probable inference, the law of succession, and statistical inference. *JASA*, 22(158), 209–212.
- McNemar, Q. (1947). Note on the sampling error of the difference between correlated proportions or percentages. *Psychometrika*, 12(2), 153–157.
- Dietterich, T. G. (1998). Approximate statistical tests for comparing supervised classification learning algorithms. *Neural Computation*, 10(7), 1895–1923.
- Wang, X., et al. (2022). Self-consistency improves chain of thought reasoning in language models. arXiv:2203.11171.
