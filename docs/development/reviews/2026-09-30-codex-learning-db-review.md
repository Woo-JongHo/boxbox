# Codex 교차 검토 — 학습 데이터 DB 형식 (2026-09-30)

대상: 예문 레코드와 결정 레코드 설계 ("코드를 저장하고 자연어는 조회 키가 아니다")
검토자: Codex CLI 0.158 (`codex exec --sandbox read-only`, 설계 본문만 입력)

| # | Codex 의견 | 결정 | 반영 (계획 S5b) |
|---|---|---|---|
| 1 | 원칙에 동의. 다만 승인 이유를 없애면 예외의 적용 범위를 판단할 수 없다. 근거는 규칙 문서에 두고 결정 레코드는 문서 버전·해시를 가리킨다. `note`는 출처 설명용 | 수용 | 결정 레코드 `docHash`, `note`는 조회·판정에 안 씀 |
| 2 | 알람 전체 정확 일치는 취약(한도 실측·새 알람 추가 시 무관한 예문이 깨짐). 규칙별 필수 발생·필수 부재로. 판정별 테스트 의미를 먼저 정의. 무알람·고정점만으로 좋아졌다는 증명은 아님 | 수용 | `asserts: { before: { has }, after: { lacks, fixedPoint } }`, 판정별 의미 표 |
| 3 | 필요한 칸: schemaVersion, 문법·표현형·알람·시그니처 버전, 승인 상태, 출처·사용 허가, 내용 해시, 대체·폐기. 중복은 후보 표시만. Python은 파싱·동작 보존 별도 확인. GUIDE는 정확 필터 뒤 고정 정렬과 개수·문자 상한. 첫 버전은 단일 파일 | 수용 | 칸 추가, GUIDE 최대 3개 |
| 4 | 예문·결정 분리는 적절. 앵커만 가리키면 드리프트를 못 막음 → 문서 해시, 바뀌면 재승인 표시. 숫자 layer보다 안정적인 ID | 수용 | `layer: "grammar"`, 해시 변경 시 재승인 |
| 5 | `taste`는 알람·자동 수정·REVIEW 근거에서 제외. 출처 분포를 보이고 반례 수집. 비공개 코드는 비밀정보 검사와 최소 재현 코드. 대기열에 중복 제거·상한·만료 | 수용 | 반영 |
| 6 | 첫 출시: 단일 파일 예문 JSONL, 불변 버전을 가리키는 결정 색인, 사람 승인 게이트, 정확 키 REVIEW, 규칙별 필수 알람 검증과 고정점, GUIDE는 `after-better`만 | 수용 | S5b 범위 |

후속 (사용자 지적): 이 검토의 설계에는 검사기가 조회할 **패턴 레코드(Convention)** 가 빠져 있었다. 원래 설계(design §4)의 세 레코드 — Convention/Evidence/Decision — 중 중심이 Convention이다. 계획을 S5a(패턴 레코드 + 조회) → S5b(예문·결정) → S5c(채우기) → S5d(게이트) → S5e(모양을 DB로)로 재배치했다.

> Historical naming note (2026-10-12): this record predates the confirmed product name `boxbox` and npm package `boxbox`. Maintained links and examples use the current names; earlier placeholder-name findings are historical, not current naming blockers. Raw execution evidence remains unchanged.
