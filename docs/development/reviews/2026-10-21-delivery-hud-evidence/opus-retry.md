# 판정: **NEEDS_FIX**

Linux와 GitHub Actions 실행 이전에 고쳐야 할 결함은 1건이고, 나머지 2건은 낮은 수준입니다. 워크플로 권한, 다이제스트 바인딩, 커밋 바인딩, 스모크 무결성 검사에서는 결함을 찾지 못했습니다.

---

## 결함

### F1 — 문서대로 `--plugin-data`를 넘기면 HUD가 영수증을 못 찾고 `not-observed`로 표시 (중간, 상태 진실성)

- **위치**
  - `product/engine/common/lifecycle-hook.ts:41`
  - `development/tools/hud.mjs:29-30`
  - `docs/development/hud.md:22-24`
  - `development/skills/boxbox-status/SKILL.md:10`
- **원인**
  - 세션 훅이 알려주는 경로는 데이터 루트가 아니라 세션 영수증 디렉터리입니다: `Results are recorded in ${directory}`, 즉 `<data>/hooks/<projectKey>/<sessionId>`.
  - 그런데 `hud.md`는 "`--plugin-data`는 BoxBox 세션 훅이 보고한 디렉터리를 받는다"고 안내합니다.
  - 그 경로를 그대로 넘기면 `hookStatus`는 `<data>/hooks/<pk>/<sid>/hooks/<pk>`를 찾습니다. 이 경로는 존재하지 않습니다(`existsSync` false).
- **시나리오**
  1. Codex 세션에서 훅이 PostToolUse FAIL 영수증을 기록합니다.
  2. 사용자나 에이전트가 문서대로 세션 컨텍스트의 경로를 `--plugin-data`에 넘깁니다.
  3. 패널에 `Hooks: not-observed`가 표시됩니다.
- **영향**
  - 실제 FAIL 기록이 있는데도 "관측 없음"이라고 표시됩니다. 거짓 양성은 아니지만 사실과 다른 상태입니다.
  - 테스트 4는 데이터 루트를 직접 넘기기 때문에 이 경로를 잡지 못합니다.
- **수정 (최소안)**
  - `hookStatus`에서 `data`가 `…/hooks/<projectKey>/<session>` 형태이고 `<projectKey>`가 현재 root의 키와 같으면, 세 단계 위를 데이터 루트로 정규화합니다.
  - 형태는 맞지만 키가 다르면 `not-observed` 대신 `location-mismatch`를 반환합니다.
  - 테스트 4에서 실제 session 훅 stdout의 `additionalContext` 경로를 파싱해 그대로 넘기는 검증을 추가합니다.
  - 정규화를 하지 않을 경우, 최소한 문서와 SKILL을 "세션 경로에서 `/hooks/<key>/<session>`을 제거한 루트"로 고쳐야 합니다.

### F2 — 환경변수 우선순위가 writer와 reader에서 반대 (낮음)

- **위치**
  - writer: `lifecycle-hook.ts:19` — `CLAUDE_PLUGIN_DATA || PLUGIN_DATA`
  - reader: `hud.mjs:58` — `PLUGIN_DATA || CLAUDE_PLUGIN_DATA`
- **시나리오:** 두 변수가 서로 다른 값으로 동시에 설정되면(호스트 호환용 export, 셸에 남은 변수 등) HUD가 다른 디렉터리를 읽어 `not-observed`를 표시합니다.
- **테스트 공백:** `test/hud.test.ts:87`이 두 변수를 같은 값으로 설정하기 때문에 이 불일치가 가려집니다.
- **수정:** reader 순서를 writer와 같게 맞추고, 서로 다른 값을 넣는 테스트를 하나 추가합니다.

### F3 — 동시성 설명이 GitHub 동작과 다름 (낮음, 문서)

- **위치:** `docs/development/cicd.md:37-38`
- **내용:** 문서는 "same ref candidate runs are serialized without cancellation"이라고 씁니다. 그러나 GitHub concurrency에서는 `cancel-in-progress: false`여도 그룹당 대기 run을 하나만 유지합니다. 세 번째 dispatch가 들어오면 대기 중이던 두 번째 run이 취소됩니다.
- **수정:** "실행 중인 run은 취소되지 않고, 대기 run은 가장 최근 것 하나만 유지된다"로 고칩니다.

---

## 확인 결과 결함 없음

- **커밋과 아티팩트 바인딩**
  - verify(reusable), package, smoke 세 단계가 모두 같은 `github.sha`를 checkout합니다.
  - package 단계는 빌드 → clean 검사 → 스테이징을 한 job 안에서 수행합니다.
  - smoke는 job output의 SHA를 기준으로 메타데이터, 바이트 수, `SHA256SUMS`, 실제 해시를 추출 전에 검증합니다.
  - 파일명 정규식과 `basename` 검사로 경로 탈출을 차단합니다.
- **권한과 보안**
  - 권한은 `contents: read`로 제한되어 있고, called workflow는 권한을 더 낮추기만 합니다.
  - `persist-credentials: false`, 액션 SHA 고정이 적용되어 있고 `pull_request_target`이나 시크릿은 없습니다.
- **concurrency 그룹 충돌 없음**
  - 그룹은 `release-candidate-<ref>`와 `verify-release-candidate-<ref>`(reusable 안에서 `github.workflow`는 caller 이름)로 서로 다릅니다.
  - PR, push 그룹과도 겹치지 않아 deadlock이나 상호 취소가 일어나지 않습니다.
- **스모크 리포트**
  - `smoke-${RUNNER_OS}.json` 파일명과 업로드 경로 `runner.os`가 일치합니다.
  - 다이제스트 검증에 실패하면 리포트를 쓰지 않으며, 업로드 쪽은 `warn`으로 처리되므로 의도와 맞습니다.
- **HUD 정직성**
  - HUD는 체크아웃된 엔진을 실행하지 않습니다.
  - 탐색에 실패하면 `unknown`과 `error`로 표시합니다.
  - `hostAcceptance`는 항상 `unverified`, `releaseReady`는 항상 false입니다.
  - 렌더링 단계에서 제어문자를 제거합니다.
  - 디렉터리 IO 실패와 잘못된 영수증은 모두 `incomplete`로 처리합니다.
- **writer와 reader 형식 호환**
  - event와 state 값의 범위가 일치합니다.
  - `baseline.json`과 `stop-blocked`는 읽지 않고 건너뜁니다.

---

## 한계 (미실행 또는 확인 불가)

1. **Linux와 GitHub Actions 경로는 실행된 적이 없습니다.** 다음은 첫 실제 run에서만 확인됩니다.
   - Windows 러너에서 `spawnSync("tar")`가 System32 bsdtar로 해석되는지. Git의 GNU tar가 잡히면 `C:\…` 경로를 원격 호스트로 해석해 실패합니다.
   - setup-python이 Windows에서 `python3.exe` 별칭을 제공하는지.
   - `pack:installer`가 ubuntu 패키지 job에서 추가 툴체인 없이 통과하는지.
   - 실제 required-check 이름.
2. **`bun run sync:plugin -- --check`의 인자 전달을 확인하지 못했습니다.** `sync-plugin.ts` 원문이 범위 밖입니다. `--`가 그대로 전달되고 스크립트가 엄격하게 파싱해 write 모드로 빠지면, drift 검사가 조용히 통과할 수 있습니다. 로컬에서 한 번 실행해 확인하길 권합니다.
3. **HUD project key 불일치 가능성.** key는 `resolve(process.cwd())`의 해시인데, 훅 입력의 `cwd`가 다른 표기라면 `not-observed`가 됩니다. 예: macOS의 `/var`와 `/private/var`, Windows 드라이브 문자 대소문자, Codex를 하위 디렉터리에서 시작한 경우. 현재 사용자 경로에서는 해당하지 않습니다.
4. **훅 오류는 영수증을 남기지 않습니다** (`lifecycle-hook.ts:69-73`). baseline 누락이나 실행 중 소스 변경 같은 오류 뒤에도 HUD는 이전 PASS를 "latest"로 표시할 수 있습니다. writer는 범위 밖이라 결함이 아니라 한계로 기록합니다.
5. **버전 교차 확인이 없습니다.** HUD는 plugin 버전과 `runtime.json`이 가리키는 엔진의 버전을 비교하지 않습니다.
6. **수행하지 않은 검증.** 훅 trust, 네이티브 host 이벤트 수락, 퍼블리시, GitHub main 통합은 사용자 결정 대기 상태로 미검증이며, 이번 감사에서도 확인하지 않았습니다.