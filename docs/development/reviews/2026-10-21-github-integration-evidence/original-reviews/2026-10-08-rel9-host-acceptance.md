# REL9 — 실제 호스트 수용 실측 (2026-10-08)

범위: 배포 `plugin/` 폴더를 Claude Code와 Codex에 실제 설치하고 훅·스킬·엔진 경로를 실측한다.
이 문서는 구현·실행 증거이며 독립 최종 감사 승인이 아니다.

## 브리지 전제 (명시)

엔진 npm 패키지 `xxx@0.2.0`은 아직 미발행이다. 실측에서는 `bun run pack:cli`로 만든
`dist/xxx-0.2.0.tgz`(40,724 B, `dist/cli.js` 158,878 B)를 테스트 프로젝트에 설치해
`npx --yes xxx@0.2.0`이 레지스트리 없이 로컬 node_modules에서 해결되게 했다.
publish 전에는 이 전제가 필요하고, publish 후에는 동일 shim이 레지스트리에서 해결한다.
`packaging/cli/package.json`의 `private: true`는 npm publish 전에 제거해야 한다(REL11).

## Claude Code 2.1.290

- `claude plugin marketplace add /tmp/rel9-market`(로컬 마켓: `.claude-plugin/marketplace.json` → `source: "./plugin"`) 성공.
- `claude plugin install xxx@rel9-market` → 0.2.0, scope user, **enabled** 확인.
- `claude plugin validate /tmp/rel9-market/plugin` → **Validation passed**.
- 라이브 세션은 OAuth 만료로 미실측 — 사용자가 `claude`에서 재로그인한 뒤 보완한다. 남은 유일한 REL9 항목.
- 라이브 세션 대신 훅 어댑터를 호스트 계약 그대로 기동해 검증했다:
  `CLAUDE_PLUGIN_ROOT=/tmp/rel9-market/plugin`, stdin JSON, `CLAUDE_PLUGIN_DATA=<plugin data>` 환경.
  - `hook session` → `{"hookSpecificOutput":{"hookEventName":"SessionStart", ...}}` stdout, exit 0.
  - `hook post`(Edit 입력) → PostToolUse `additionalContext` + NO_CHANGES + receipt 경로, exit 0.
  - `hook stop`(`stop_hook_active:false`) → `systemMessage` + receipt, exit 0.
  - 기록은 전부 plugin data 폴더에 생성(3건). **타깃 프로젝트는 무오염**(`/tmp/rel9-proj`에 `.xxx/` 없음).
- 참고: 플러그인 shim이 실행하는 것은 공개 CLI 번들의 `hook` 서브커맨드다(개발용
  `skills/xxx/scripts/hook.ts` 아님). `stop` 분기는 번들에 있고 `test/lifecycle-hook.test.ts`가 고정한다.

## Codex CLI

- `codex plugin marketplace add /tmp/rel9-market` — 로컬 경로 수용 확인.
- `codex plugin add xxx@rel9-market` → `~/.codex/plugins/cache/rel9-market/xxx/0.2.0` 설치 성공.
- **실세션 수용**: `codex exec -s workspace-write`에서 에이전트가 설치된 xxx 스킬을 발견하고
  `xxx@0.2.0 check --file routes.ts --json`을 실행했다. Result JSON 수신(그룹 0, parse not-run),
  에이전트가 파일을 수정하지 않았음을 확인. 스킬 발견 → shim → npx → CLI → 엔진 경로가 실제 호스트에서 동작했다.
- 관측 부수점: 세션 종료 시 `codex_core::session failed to record rollout items` 로그가
  Codex CLI 자체에서 출력됐다(플러그인 경로와 무관, Codex 내부 기록 문제).

## 결과

- REL9의 Codex 쪽 수용은 **실측 완료**. Claude Code는 설치·검증·훅 어댑터까지 완료,
  라이브 세션 1건만 사용자 로그인 후 보완.
- Windows는 release-contract대로 이번 검증 목록 밖이다.

## 재현

```bash
bun run pack:cli
rm -rf /tmp/rel9-market && mkdir -p /tmp/rel9-market/.claude-plugin && cp -R plugin /tmp/rel9-market/plugin
# /tmp/rel9-market/.claude-plugin/marketplace.json 작성(name: rel9-market, source: ./plugin)
claude plugin marketplace add /tmp/rel9-market && claude plugin install xxx@rel9-market
claude plugin validate /tmp/rel9-market/plugin
codex plugin marketplace add /tmp/rel9-market && codex plugin add xxx@rel9-market
mkdir -p /tmp/rel9-proj && cd /tmp/rel9-proj && npm init -y && npm install <repo>/dist/xxx-0.2.0.tgz
codex exec --cd /tmp/rel9-proj -s workspace-write --skip-git-repo-check "..."
```
