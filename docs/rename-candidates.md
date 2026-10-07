# 제품명 후보 (REL11 결정 대기)

결정 전까지는 `xxx`/`XXX` placeholder를 유지한다. 결정 즉시 아래를 실행한다:

```bash
bun run scripts/rename-product.ts --dry-run --to <name>   # 영향 파일 확인
bun run scripts/rename-product.ts --apply --to <name> --display <Name>
bun run check          # 전체 게이트
gh repo rename <name>  # GitHub repo도 같은 이름으로
npm view <name>        # npm 가용성 확인 (publish는 사용자 로그인)
```

## 후보

| 이름 | 근거 | 메모 |
|---|---|---|
| `rowgrid` | 같은 역할의 행을 하나의 격자로 맞춘다는 컨셉을 그대로 말한다. 짧고 발음이 쉽다 | GitHub private repo를 이미 이 이름으로 만들어 쓰는 중 |
| `tabulr` | tabular의 축약. 표 정합성 연상 | npm에서 유사 이름 충돌 가능성 확인 필요 |
| `alignkit` | 정렬 도구 키트임을 즉시 전달 | "kit"은 스코프가 넓어 보이는 단점 |
| `rowline` | 행(문장) 단위 엔진을 강조 | 엔진 중심 느낌, 표 연상은 약함 |
| `tabfold` | 열을 접어 최소폭을 만든다는 동작 은유 | 신조어라 설명이 필요 |

## 결정 시 함께 끝낼 것

1. `AGENTS.md`의 Naming placeholder 절을 실명으로 교체하고 placeholder 규칙 삭제.
2. 옛 히스토리에 `woo-code-readability` 경로 잔존 — public 전환 전 squash 여부 결정.
3. `packaging/cli/package.json`의 `private: true` 제거 후 `npm publish --dry-run`.
4. `.claude-plugin/marketplace.json`의 marketplace 이름(`xxx-plugins`)도 이름에 맞춘다.
