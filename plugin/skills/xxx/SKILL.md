---
name: xxx
description: Use when inspecting, fixing and verifying TypeScript and Python files one at a time against tabular readability rules, where same-role rows share one structure and their syntax boundaries are aligned into minimum-width columns.
---

# XXX 코드 가독성

읽는 사람이 실행 흐름을 위에서 아래로 따라가고, 같은 역할의 행을 세로로 비교할 수 있게 한다.
코드를 스프레드시트처럼 행·열·셀로 다루되, 먼저 같은 역할의 행을 **같은 최소 구성**으로 맞춘 뒤 남은 문법 경계를
최소 폭 열로 고정한다. 일반 formatter의 취향을 강요하지 않고, 사람이 승인한 규칙만 자동 적용한다.

## 엔진 실행

모든 검사·수정은 엔진 CLI 한 개로 한다. 대상 저장소의 루트에서 실행한다.

```bash
npx --yes xxx@0.2.0 doctor                      # 런타임·parser·설정·승인 데이터 상태
npx --yes xxx@0.2.0 check  --file <파일> --json  # 읽기 전용 검사
npx --yes xxx@0.2.0 guide  --file <파일> --json  # 이 파일에 적용되는 승인 규칙·예문
npx --yes xxx@0.2.0 format --file <파일> --dry-run --json
npx --yes xxx@0.2.0 format --file <파일> --json
```

- 첫 공개 단계는 TypeScript·Python 파일 **한 개씩**만 받는다. Python 수정에는 실행 가능한 `python3`가 필요하다.
- `format`은 명시 formatter, 사람 승인 proof, 재파싱, 두 번 실행 고정점이 모두 통과할 때만 쓴다.
  하나라도 빠지면 거절하며, 거절은 실패가 아니라 안전 동작이다. 거절 사유를 사용자에게 그대로 전한다.
- 다른 정렬 스크립트나 우회 옵션을 찾아 실행하지 않는다.

## 작업 순서

1. 사용자가 지정한 파일 하나만 다룬다. 다음 파일로 넘어가기 전에 사용자 피드백을 기다린다.
2. `check --json`의 그룹(`groups`)과 상태(`PASS`·`FIXABLE`·`REFUSE`)를 읽는다. `REFUSE`는 구조를 손실 없이
   분해할 수 없다는 뜻이므로 그 행은 고치지 않는다.
3. `guide --json`으로 승인 규칙을 확인한다. 승인 규칙이 있으면 `format --dry-run` → `format` 순서로 적용한다.
4. 승인 규칙이 없으면 손으로 정렬하지 말고, 후보 그룹과 근거를 사용자에게 보고한다.
5. 수정 뒤 `check --json`을 다시 실행해 `misaligned=0`을 확인하고, 실행하지 않은 검증을 통과했다고 말하지 않는다.

## 규칙 문서

판단이 필요하면 이 폴더의 문서를 읽는다.

- `references/charter.md` — 원칙과 안전 불변식
- `references/grammar.md` — 문법 단위·문형·역할·문단(속성이 다르면 빈 줄로 나눈다)
- `references/readability-contract.md` — 확정 규칙, 폐기 규칙, 열 검사 순서
- `references/typescript-grid-template.md` — TypeScript 역할별 표 템플릿

## 작성 훅

플러그인 훅은 세션 중 바뀐 TypeScript·Python 파일을 읽기 전용으로 검사하고 결과를 알린다. 자동 수정은 하지 않는다.
기록은 호스트의 플러그인 데이터 폴더에 남고 대상 프로젝트에는 파일을 만들지 않는다.
