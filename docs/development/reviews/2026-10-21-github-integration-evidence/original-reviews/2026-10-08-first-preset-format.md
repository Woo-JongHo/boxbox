# 첫 배포 프리셋 승인과 실제 format 여정 (2026-10-08)

## 승인 근거와 위임 기록

2026-10-07 사용자가 "오와열의 기준은 맡긴다"고 기준 수립을 위임했고, 본 세션은 그 위임 아래
REL6 후보 2건을 보수적 기준(무손실 분해 + 재파싱 통과 + 고정점 + 경계 반례 + 전후 예문)으로
심사해 `maintainer` 명의로 승인했다. 이 커밋은 아침 감사 대상이며, 사용자가 기각하면
프리셋 3종과 decision 문서를 되돌린다.

- `ts-sourcefile-call-declarations` — `v1|typescript|SourceFile|declaration-equals|equals>call-open-paren>call-close-paren>semicolon`, `**/*.ts`, 2행 이상
- `py-simple-assignments` — `v1|python|-|table|name>equal>value`, `**/*.py`, 같은 indent 3행 이상

배포 반례는 `bad`(금지 형태) 계약에 맞춰 "상상의 열로 늘어뜨린 과잉 정렬"로 재정의했다:
엔진은 한 행 정렬, 2행 Python 정렬을 절대 쓰지 않는다.
연구용 경계 기록(2행 SUGGEST 등)은 `docs/candidates/`에 그대로 남는다.

## 실제 format 여정 (isolated 설치본, /tmp/rel9-proj)

`bun run pack:cli` → `npm install dist/xxx-0.2.0.tgz`(동일 버전 재설치는 `up to date`로
건너뛰므로 `node_modules/xxx` 삭제 후 재설치 필요) → 명시 no-op formatter 설정.

- `check sample.ts`: groups=1, kind=declaration-equals, context=SourceFile, FIXABLE, edits=7
- `format --dry-run`: ok, `approvals=["ts-sourcefile-call-declarations"]`, written=false, fixedPoint=true
- `format`: ok, written=true, fixedPoint=true,
  safety = atomic + approvalChecked + parserChecked + executableStable
- 결과 3행이 최소폭 열로 정렬되고, 재검사는 `misaligned=0, edits=0, state=PASS` 고정점

이로써 "승인 0건이라 format이 항상 거절" 상태는 끝났다. 첫 공개판은 승인 2건을
기본 적용하며, 프로젝트 계층이 같은 키를 후보/거절로 두면 프리셋보다 우선해 거절한다
(`test/cli.test.ts` 거절 시나리오 유지).

## 게이트

`bun run check` 432 pass / 2 skip / 0 fail. skip은 Kotlin 2건(툴체인 부재).
Rust는 rustfmt 1.8의 `Diff in file:line:` 출력을 parse-check이 인식하도록 고쳐
skip에서 복귀했다.
