# 배포 추적 하네스

배포 준비(`docs/plan.md` REL0–REL12)를 계속 개발·추적하기 위한 실행 하네스와 증거 DB다.
실행마다 git 지문·호스트·전제와 스테이지 결과를 `evidence/runs.jsonl` 한 행으로 남기고,
완전 실행만 `evidence/latest.json`으로 원자 교체한다. 둘 다 git-tracked라 diff로 이력·증거를
검토할 수 있다(M1.7 "DB는 git-tracked JSON/JSONL" 결정).

REL 상태의 단일 소스는 `docs/plan.md`의 REL 표다. 이 하네스는 상태를 판정하지 않고,
표를 파싱해 최신 기계 증거만 조인해 보여준다(기계 증거와 사람 판정의 분리).

## 실행

```bash
bun run harness --dry-run           # 실행 계획과 전제만 확인(실행·기록 없음)
bun run harness --skip self-align   # 빠른 실행(수 분)
bun run harness                     # 전체(자체 정렬 포함, 수 분~십수 분)
bun run harness --with-eval         # eval 스테이지까지(유료 모델 호출 — 기본은 skip 기록)
bun harness/report.ts               # 리포트(사람 읽기)
bun harness/report.ts --json        # 리포트(기계 판독)
```

플래그: `--stages a,b`(부분 선택) · `--skip a,b` · `--with-eval` · `--note "…"` · `--dry-run` · `--json`.

## 스테이지

| id | 실행 | 기록 |
|---|---|---|
| `self-align` | `00_normalize-imports` + `06_align-tables --file` 전 레포 .ts(`skills/xxx/scripts`·`scripts`·`test`·`harness`) | files·changed·misaligned 총합. 느린 스테이지다 |
| `check` | `bun run check` | pass·skip·fail·테스트 수 |
| `pack` | `build:cli`·`build:node-artifact` + `npm pack --json` | tarball별 bytes·sha256·파일 수·버전 |
| `artifact-journey` | `public-artifact`·`node-artifact` 격리 설치 테스트 | 통과 수·실패 수 |
| `corpus-gate` | `scripts/corpus-promote.ts --check` | checked·failures |
| `eval` | `scripts/eval.ts run` + `grade` | **opt-in** — 유료 모델 호출이라 기본은 skip으로 기록 |

판정 원칙은 `scripts/eval.ts`와 같다: 상태 코드가 아니라 산출물로 판단한다 — 각 스테이지는
출력에서 지표를 파싱해 기록한다. 스테이지 하나가 실패해도 나머지를 끝까지 실행해 전부 기록하고,
종료 코드는 완전 실행 && 전부 ok일 때만 0이다.

## 전제(npm 캐시 워밍)

`artifact-journey`는 `npm install --offline` 특성상 npm 캐시에 다음이 있어야 한다. 없으면
ENOTCACHED로 실패한다(2026-10-06 배포 준비 검토의 재현 조건과 동일):

```bash
npm cache add typescript@7.0.2
npm cache add @typescript/typescript-<platform>-<arch>   # 예: @typescript/typescript-darwin-arm64
```

하네스는 실행 전 캐시 색인을 조사해 `preconditions.npmCache`에 기록하고, 비어 있으면
`limitations`에 워밍 명령을 남긴다. CI(`verify.yml`)는 이 워밍을 워크플로에서 이미 수행한다.

## 스키마와 저장 규율

- `runs.jsonl` 1행 = 1실행(`schemaVersion` 1). 부분 실행도 기록되며 `completion.complete=false`다.
- `latest.json`은 완전 실행만 갱신한다(임시 파일 + rename). 부분 실행은 `runs.jsonl`에만 남는다.
- 각 행은 `git`(branch·sha·dirty·ahead), `host`(platform·bun·node), `preconditions`(npm 캐시),
  `stages`(id·ok·skipped·exitCode·durationMs·metrics), `artifacts`(bytes·sha256·files·version),
  `completion`, `ok`, `limitations`를 갖는다.
- 이 하네스는 배포물이 아니다 — `packaging/`·`dist/`·공개 artifact와 무관하다.
