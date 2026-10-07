# DATA2 보류 12건 포렌식·공개 경계 독립 검증 리포트 — 2026-10-05

- 검증자: ZCode (모델 `builtin:zai-coding-plan/GLM-5.3-Flash`), 읽기 전용 검토 패스. 제품 코드·승인 DB·corpus cache는 수정하지 않았다. 이 리포트 작성 외의 repo 쓰기는 없다.
- 대상 commit: `8338798187295b1c2cd9b737750cb84d22297f32`, 브랜치 `m1-safety-proof` (upstream보다 27커밋 앞섬), 미커밋 57개 항목의 dirty tree 위에서 실행. 검증 전후로 tracked 파일 diff에 변화 없음을 확인했다(부록 A).
- 이 리포트는 릴리스 승인이 아니다. 사람 승인은 여전히 0건이며 preset은 비어 있어야 한다. 외부 provider 최종 감사는 이번에도 미실행이므로 미실행 blocker로 남는다.
- 재현 스크립트는 repo 밖 `/tmp/xxx-forensic/`에 두었다(포렌식 2종 + timeout 측정 1종). 제3자 원문은 어디에도 복사하지 않았고 임시 복사본만 정렬했다.

## (a) 확실한 finding과 재현

### F1 — line mapping 보류 11건은 전부 "관측 범위 내부 자체의 재구조화"다. offset 보정은 원천 불가 (DATA2 핵심)

11건 전부를 실제 checkout hash 검증 후 임시 복사본에서 재정렬해 재현했다. 결과는 전부 동일 패턴이다:

- 원본 SHA-256 일치, parser `ok`, 둘째 실행 고정점 `ok`, 원본 checkout 무변경 — 정렬기 자체는 정상이고 `scripts/corpus-candidates.ts:190`의 전체 줄 수 비교만 실패한다.
- 줄 증가는 +3~+6. LCS 줄 diff를 **before 좌표 기준**으로 분류하면 모든 사례에서 변화가 관측 범위 안에도 존재한다(within 1~6개 위치).
- 결정적 근거: 관측 범위의 원본 줄 내용을 정렬 결과에서 정확 연속 매칭하면 **11건 전부 매칭 위치가 없다**. 즉 관측된 표의 행 자체가 재감싸기(긴 줄이 여러 행으로 분해)돼 원본 범위가 결과 어디에도 그대로 존재하지 않는다. 범위 밖 변화만으로 실패한 사례는 0건이다.
- 따라서 단순 offset 보정은 논리적으로 불가능하고, 현행 fail-closed 판정이 정확하다. 11건은 결정적(deterministic)이라 재실행해도 같은 이유로 실패한다.
- 가설 기각 기록: "보류는 모두 여러 줄 관측이고 통과는 한 줄일 것"이라는 가설은 사실이 아니다. 통과 213건도 전부 여러 줄 범위(2~37줄)였다. 줄 수로는 사전 필터링할 수 없고, 범위 안 표가 재구성됐는지는 정렬 후에만 안다.

재현 요지: 각 예문의 `source.id` checkout에서 해당 파일을 임시 폴더로 복사해 `bun skills/xxx/scripts/typescript/06_align-tables.ts --file source.ts --write --json`을 두 번 돌리고, 원본과 결과에 대해 before 좌표 기준 줄 diff + 범위 내용 연속 매칭을 계산한다. 12건의 file/line 목록은 `docs/handoff-2026-10-05.md` 4절 표와 100% 일치했다.

### F2 — timeout 보류 1건은 입력 복잡도가 아니라 일시적 환경 요인이다. 재실행으로 해소 가능

`example-14c84c01ad91e6af5d38`(vscode `multilineModel.ts:130-143`, 관측 당시 ETIMEDOUT 60초)를 넉넉한 타임아웃으로 재측정했다:

- 파일은 7,372 B / 189줄의 작은 파일이다. pass1 1,659ms(pass2 437ms, pass3 406ms), parser `ok`, 줄 수 변화 0, 고정점 ok, 원본 무변경.
- 관측 60초는 실측 1.7초의 35배 이상이므로 `CandidateOptions.timeoutMs` 상한(60,000ms) 상향은 불필요하고, 상향으로 숨기는 것도 근거 없는 해소다(핸드오프 판단과 일치).
- 종료 뒤 정리도 확인했다: `makeExample`의 `finally`가 임시 폴더를 제거하고(`corpus-candidates.ts:197`) 원본은 hash 대조로 무변경이다.
- 해소 방법: 이 예문만 재실행하면 통과한다. 단 재생성은 `.xxx/cache/corpus/`를 원자 교체하므로 기존 225개 cache 보존이 필요하면 `--output <임시>`로 별도 실행해야 한다.

### F3 — 2행 표 정렬 예문 2건은 버그가 아니라 문서화된 예외다 (Q3의 2행 예외 확인)

상위 키 예문 중 `example-b9beb4bc…`(prisma)과 `example-32b860ab…`(trpc)은 2행 `const` 선언 표가 정렬돼 있다. 확인 결과:

- `skills/xxx/scripts/typescript/grid-kinds.ts:623` — `declaration` kind에서 모든 행이 `equals` 경계를 가지면 `minRows: 2`를 반환하는 명시적 예외다. 두 예문 모두 `declaration-equals` 키로 정확히 이 조건이다.
- 예외는 문서화돼 있다: `skills/xxx/references/charter.md:52`(자동 수정 3행 이상, 예외는 승인된 `=` 선언 표·import), `docs/design.md:346`(2행 예외 명시).
- 파이프라인이 돌린 것은 승인 gate 없는 내부 엔진 스크립트고, 사람 승인 경로는 공개 CLI 계층에 있다(설계상 분리). 제품 동작 위반으로 보지 않는다.
- 경미한 문서 갭: `table-engine.ts:9-10` 헤더 주석은 "3행 미만 자동 수정 없음"으로만 읽혀 TS AST 경로의 2행 예외와 표현이 어긋난다. 주석에 예외 존재를 언급하면 혼동이 줄든다(P3).

### F4 — 라인 엔진에는 최대 폭 상한이 없다 (설계 미결 사항 확인)

`table-engine.ts`의 폭은 "최장 셀"로만 정해지고 상한이 없다. 실제로 pydantic 대표 예문(`example-951e99e0…`, 5행)이 최장 행 172자에 맞춰 전 행이 172자까지 패딩됐다. `docs/design.md:320`의 "maximum width" 오버라이드는 아직 엔진에 없다. 스펙 위반은 아니고 M1 이후 설정 항목이지만, 사람 승인 시 "과도한 padding" 판정 기준에 이 사례를 넣을 것을 권한다(P3).

### F5 — public-preset 게이트는 공격자 관점에서 견고하다. 저비용 갭 1건 (Q4)

`scripts/public-preset.ts` 전수 검토 결과:

- 확인된 방어: preset 루트 symlink 거절(149-150), JSONL에 대해 lstat+realpath 이중 검사(56-64), 문서 경로는 각 구성요소마다 symlink 검사 + `docs/public` 실경로 포함 확인(66-84), conventions/examples/decisions/versions/asserts 폐쇄형 스키마, `safeId`·`safeLookupKey`(TS/Python만, 현재 버전만), scope allowlist(15), synthetic 전용·승인 SPDX·1,600자 한도(196-200), 긍정+반례 예문 강제(180-181), 예문↔규칙 쌍방 링크 강제(186, 210), contentHash 실검증(`common/examples.ts:87`), decision 절 hash 대조(131), 코드펜스·로컬경로·commit permalink 거절(138-139), 중복 키는 JSON 파서 last-wins 정규화(테스트로 고정).
- 갭(P3): 139행의 정규식은 `/Users/`·`/home/`·`C:\Users\`와 github **commit** permalink만 잡는다. github blob(비-commit) 링크, gitlab 등 다른 호스트, `~/` 상대 표기는 통과한다. decision은 사람이 쓰는 문서라 위험도는 낮지만, 정규식을 `github\.com\/[^\s)]+\/(?:commit|blob)\/` 수준으로 넓히면 저비용으로 닫힌다.

### F6 — npm tarball은 allowlist가 실제로 유지되고 있다. publish 차단 요소 1건 확인 (Q5 전반)

`bun run pack:cli` 재실행해 tarball을 독립 스캔했다:

- 6개 파일 정확히 확인: `package/README.md`, `package/package.json`, `package/dist/cli.js`, 빈 preset 3개. tarball 크기 35,415 B, bundle 143,179 B — 핸드오프 기록과 동일.
- 내용 스캔: `jonghoPro`, `/Users/`, `.xxx/cache`, `observations.jsonl` 전부 0매치. `examples.jsonl` 2매치는 제품 자체 프리셋 파일명 참조(`presets/recommended/examples.jsonl`)로 정상이다. 빌드 스크립트 자체의 금지 문자열 가드(`build-cli-artifact.ts:43-46`: shebang, `Bun.`, `@/`, 절대 루트 경로, 내부 러너명)도 동작 근거가 확인된다.
- publish 차단 요소: tarball 안 `package.json`에 `"private": true`가 남아 있다. 출처는 템플릿 `packaging/cli/package.json:4`다. npm은 private 패키지 publish를 거절하므로 REL11에서 루트 `package.json`뿐 아니라 **이 템플릿도** 함께 해제해야 한다(핸드오프에는 루트만 언급돼 있다).

### F7 — 공개 경계는 두 개로 분리돼 있고 marketplace 쪽은 여전히 전체 저장소다 (Q5 후반)

- npm tarball: allowlist(`files`) 6파일로 위 F6대로 안전.
- `.claude-plugin/marketplace.json`: `source: "./"`로 저장소 전체를 참조한다. npm allowlist는 이 경계를 보호하지 않는다. git 기반 호스트가 clone하면 tracked 문서 전체(docs/paper, docs/research, reviews 등)가 함께 노출된다. REL11의 marketplace 소스 분리 과제가 실제 blocker임을 재확인했다.

## (b) 검증된 정상 범위

- `.xxx/cache/corpus/summary.json`: 핸드오프 수치와 전 항목 일치(관측 18,613, 키 88, 예문 225, 통과 213·보류 12 = line mapping 11 + ETIMEDOUT 1, 승인 0, FIXABLE 18,465 / PASS 140 / REFUSE 8).
- `bun test test/corpus-candidates.test.ts test/corpus-evidence.test.ts` 8 pass / 0 fail.
- `bun test test/public-preset.test.ts test/public-artifact.test.ts` 10 pass / 0 fail.
- 전체 `bun run check`: 403 pass / 5 skip / 0 fail, 45파일·408테스트 + `tsc --noEmit` 통과 + `bash -n install.sh` 통과 + `git diff --check` 통과. 핸드오프 기록과 동일. Rust 3·Kotlin 2 skip은 여전히 성공으로 세지 않았다.
- 상위 4개 키(합계 617건 관측)의 12개 통과 대표 예문 구조 검사: 전부 실제 변화 있음, 같은 역할 행, 무관 행 결합 없음, Python 들여쓰기·문자열 인용 보존, 패딩 +1~+18(172자 사례는 F4). `scripts/eval.ts` 미정렬 37그룹 재확인(207 edits) — 자체 정렬 조사와 일치.
- makeExample의 안전 장치(HEAD/hash 선검증, 임시 복사 후 2회 실행, parser 비ok·내용 변경 시 거절, 실패 시 `after` 없이 기록, 원자 교체와 롤백)가 코드상 실재하고 이번 재현에서 전부 관찰됐다.

## (c) 미실행·환경 제약

- 전체 후보 재생성은 실행하지 않았다(기존 225개 cache 보존 원칙). F1/F2 결론은 개별 예문 재현에 근거하며, 전체 재생성 시 timeout 통계가 다시 달라질 수 있다.
- 실제 사람 승인 여정, host packaging/discovery 실측(REL9), OS 매트릭스 clean-install 여정(REL10), 외부 provider 최종 감사는 이번 패스 범위 밖이다.
- 예문 텍스트와 제3자 원문의 의미적 유사성은 기계 검증으로 판정 불가(핸드오프 인지 사항 유지). 승인 전 첫 행 사람 대조가 여전히 요구된다.
- macOS(arm64) 단일 환경 실측이다.

## (d) 추천 수정 순서

1. **DATA2 정리**: 11건은 "범위 내 재구조화 = 실패 유지"로 확정하고, 보류 사유를 정밀화한다(예: "관측 범위의 표가 N행→M행으로 재구성됨"). 회귀 테스트로 "범위가 변형되면 offset 보정을 시도하지 않는다"를 고정한다. 이후 대표 선택에서 행 매핑이 보존되는 관측을 선호하거나, 엔진의 표 행 identity로 예문을 재구성하는 방안을 DATA2 후속으로 설계한다. timeout 1건은 재실행으로 해소한다(상한 변경 금지 유지).
2. **F6 템플릿 private**: REL11 작업표에 `packaging/cli/package.json`의 `private` 해제를 명시 항목으로 추가한다.
3. **F5 정규식 확장**: decision 섹션의 permalink/경로 거절을 blob 링크·타 호스트까지 넓힌다(저비용).
4. **F3/F4 문서·기준**: `table-engine.ts` 헤더 주석에 TS 2행 예외 존재를 언급하고, 승인 기준에 "최장 셀 폭이 극단적인 표" 판정 문항을 추가한다.
5. **REL9 이후 순서는 핸드오프 7절 그대로** — marketplace 소스 분리(F7)가 REL11의 핵심 blocker임을 이번 검증이 재확인했다.

## (e) 사용한 commit과 작업 트리 상태

- commit `8338798187295b1c2cd9b737750cb84d22297f32`, dirty tree(수정 13 + 신규 다수). 검증으로 인한 tracked 변경 0, gitignored `dist/`만 재생성됐다. 부록 A의 명령으로 재확인 가능하다.
- corpus checkout(`~/.cache/xxx/corpus/`)은 전 과정에서 읽기만 했고 hash 대조로 무변경을 증명했다(11건 + timeout 건 전부 `originalUnchanged=true`).

### 부록 A — 검증 후 무변경 확인

```bash
git status --short            # 검증 전후 동일(신규 리포트 파일 제외)
git diff --stat               # 검증 전과 동일한 13파일
```
