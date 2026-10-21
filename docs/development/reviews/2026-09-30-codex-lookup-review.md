# Codex 교차 검토 — 패턴 DB 조회 (S5a) (2026-09-30)

대상: 검사기가 표마다 패턴 DB를 조회하는 구조, 패턴 레코드 형식, 조회 키 크기
검토자: Codex CLI 0.158 (`codex exec --sandbox read-only`, 설계 본문만 입력)
측정: 전체 시그니처 182종(상위 20개가 표의 82%), 깊이 제외 72종(96%), 깊이·context 제외 61종(96%)

| 쟁점 | Codex 의견 | 결정 |
|---|---|---|
| 키 크기 | 깊이만 뺀다. context는 남긴다(빼면 역할이 다른 TS 표가 합쳐짐). Python의 빈 context는 명시적 값. 깊이가 다른 표를 합쳤을 때 결과가 달라지는지 먼저 측정 | 수용: `v1\|language\|context\|kind\|axes`, 빈 context는 `-` |
| 키와 시그니처 | 진단용 시그니처와 조회 키를 분리. 키에 규칙 버전, 옛 버전 키는 묵시적으로 조회하지 않음, 키 변경은 명시적 마이그레이션 | 수용 |
| 범위·층 | 경로 정규화, glob 규칙, 범위 우선순위 고정. Safety는 DB로 우회 불가. 같은 층·키·범위에 상충 기록이면 오류로 보고 수정을 막음 | 수용 |
| 거절 | 자동 수정하지 않는다는 뜻. 이미 정렬된 코드를 흐트러뜨리지 않음 | 수용 |
| 보고만 1단계 | 적절. 게이트 전 측정: 승인·거절·미지정 비율(표 수), 막힐 수정 비율, 키 통합으로 섞이는 수정, 프로젝트가 preset을 뒤집는 사례. 미지정 자동 승인 호환 경로는 불변식 위반 | 수용 |
| shape | 1단계에서 안 쓰면 S5e로 미룸(지금 저장하면 하드코딩 축을 계약으로 굳힘) | 수용 — 레코드에서 뺌 |
| 후보 대기열 | (키 버전, 키, 범위)로 중복 묶기, 출현 횟수·파일 수·대표 위치·충돌 여부, 상한, 승인 DB와 분리, 빈도만으로 승인 금지 | 수용 (S5d) |
| 기타 | 레코드 id 안정성, 중복 JSONL 처리, 결정적 정렬, 경로 대소문자·심볼릭 링크 규칙. (버전, 키)로 색인 후 범위만 판정 | 수용 |

> Historical naming note (2026-10-12): this record predates the confirmed product name `boxbox` and npm package `boxbox`. Maintained links and examples use the current names; earlier placeholder-name findings are historical, not current naming blockers. Raw execution evidence remains unchanged.
