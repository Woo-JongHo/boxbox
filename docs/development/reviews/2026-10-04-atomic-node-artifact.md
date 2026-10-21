# REL2b·REL2c·REL3 — 안전 교체와 Node artifact 실증

2026-10-04. 사용자 연속 진행 지시에 따른 구현·기계 검증 기록이다. 별도 감사는 수행하지 않았다.

## 구현

- [`safe-file.ts`](../../../product/engine/common/safe-file.ts): 같은 디렉터리 작업본, 협력 writer 잠금,
  단일 링크 정규 파일 검사, 최초 identity/bytes의 commit 직전 재확인, mode 보존, rename과 정리.
  async/sync API가 준비·교체·정리 로직을 공유한다.
- [`typescript/align.ts`](../../../product/engine/typescript/align.ts): 모든 정렬 pass·AST·진단·수렴
  검증을 작업본에서 끝낸 뒤 한 번만 교체한다. `06_align-tables.ts`는 기존 실행 shim과 재수출을 유지한다.
- [`align-cli.ts`](../../../product/engine/common/align-cli.ts): 라인 엔진도 같은 안전 교체를 사용한다.
  `--groups --write`는 읽기 전용으로 처리한다.
- [`build-node-artifact.ts`](../../../development/tools/build-node-artifact.ts): 개발 시 Bun으로 빌드하고 실행은 Node ESM이다.
  TypeScript native API dependency는 external로 남긴다.

잠금은 helper 사용자 사이의 협력 방식이며 완전한 커널 CAS가 아니다. 여러 파일 전체 트랜잭션,
전원 장애 복구, ACL·확장 속성 보존과 조상 디렉터리 symlink 제약까지 구현한 것은 아니다.

## 안전 교체 검증

- TS 전용 10개: mode/정리, sync helper, 외부 편집 보존, rename 실패, symlink/hardlink,
  후속 pass 실패·parser 예외·진단 불일치·비수렴에서 최초 원본 보존, 실제 CLI 멱등.
- 라인 엔진 전용 4개: 실제 Python check/write·mode·정리·symlink/hardlink·parser 중 외부 편집.
- 별도 임시 프로젝트 실제 CLI로 TS/Python write→write 멱등, mode 0640, 미정렬 symlink 쓰기 거절,
  임시 stage/lock 정리를 재확인했다.

## Node artifact 실측

`bun run build:node-artifact`, `bun run pack:node-artifact`로 생성하는 산출물은 **비공개 실행 증명용**이다.
`packaging/node/package.json`은 private=true, Node >=22.22.3, typescript=7.0.2이며 공개 bin은 없다.
raw write를 받는 internal runner를 후속 공개 패키지에 그대로 노출하지 않는다.

실제 tarball 파일 목록: `README.md`, `package.json`, `dist/internal-runner.js`.
저장소 밖 임시 프로젝트에서 `npm install --offline --ignore-scripts --no-audit --no-fund`에 성공했다.
이는 npm cache를 이용한 실제 설치이며 인터넷이 없는 새 머신 설치를 증명한 것은 아니다.

- 설치된 TypeScript 7.0.2 및 darwin-arm64 native optional dependency 확인.
- runtime PATH에서 Bun 조회 실패 확인. 실행에 사용한 것은 Node/Python과 OS 기본 경로다.
- TS/Python 각각 check=1 → write=0 → check=0 → 두 번째 write에서 byte-identical.
- Python parser 부재 시 비영 종료와 원본 유지.
- bundle에 Bun API, `@/`, 저장소 절대 경로 및 00/07/08/09 보조 writer 없음.

실측 환경은 macOS arm64, Node 22.22.3이다. Linux·Windows·호스트 수용으로 확대 해석하지 않는다.

## 통합 결과

`bun run check`: 종료 0, **341 pass / 5 skip / 0 fail**, 346 tests / 37 files, 약 44초.
타입 검사·설치 shell 문법 검사도 통과했다. 기존 Rust 3건·Kotlin 2건의 parser 환경 skip은 남는다.

원본:

- `/tmp/boxbox-ts-atomic-notes.md`
- `/tmp/boxbox-line-atomic-notes.md`
- `/tmp/boxbox-node-artifact-notes.md`
- `/tmp/boxbox-release-continuation/atomic-cli.json`
- `/tmp/boxbox-release-continuation/check-rel3.log`

다음 단계는 공개 CLI다. 승인 DB와 formatter 조건을 갖추기 전 `format`은 쓰기를 거절해야 한다.

## 실행 런타임 증거 정정 — 2026-10-04

초기 artifact 테스트는 `bun test`의 `process.execPath`를 node 이름으로 연결했다.
실제로 Bun이 실행됐으므로 위 최초 결과는 Node 단독 실행의 증거로 사용할 수 없다.
후속 테스트는 `node -p process.execPath`로 실제 Node를 찾고 `process.versions.bun`이 없음을
확인하도록 수정한다. 확정된 재실행 결과는 후속 format 통합 기록을 따른다.

> Historical naming note (2026-10-12): this record predates the confirmed product name `boxbox` and npm package `boxbox`. Maintained links and examples use the current names; earlier placeholder-name findings are historical, not current naming blockers. Raw execution evidence remains unchanged.
