# XXX

TypeScript·Python 파일을 한 번에 하나씩 "스프레드시트형" 가독성 계약으로 검사하는 에이전트 플러그인이다.
같은 역할의 행을 같은 구조로 맞추고 문법 경계를 최소 폭 열로 정렬한다. 사람이 승인한 규칙만 자동 적용하며,
손실 없이 분해할 수 없는 행은 고치지 않는다.

## 설치

Claude Code:

```bash
claude plugin marketplace add <owner>/<repo>
claude plugin install xxx@xxx-plugins
```

Codex:

```bash
codex plugin marketplace add <owner>/<repo>
codex plugin add xxx@xxx-plugins
```

요구 사항: Node.js 22.22.3 이상과 npm. Python 파일을 수정하려면 실행 가능한 `python3`.

## 이 플러그인이 실행하고 쓰는 것

- **엔진:** 스킬·훅·inspector는 `npx --yes xxx@0.2.0`으로 npm 엔진 패키지를 정확한 버전으로 실행한다.
  처음 실행할 때 npm 레지스트리에서 이 패키지와 의존성 `typescript@7.0.2`를 내려받는다. 그 밖의 네트워크 통신은 없다.
- **훅:** 세션 시작·편집 뒤·응답 종료 때 세션 중 바뀐 TypeScript·Python 파일을 읽기 전용으로 검사한다.
  자동 수정은 하지 않는다. 기록은 호스트의 플러그인 데이터 폴더(`CLAUDE_PLUGIN_DATA`)에만 쓰고,
  플러그인을 제거하면 함께 지워진다. 대상 프로젝트에는 파일을 만들지 않는다.
- **수정:** 사용자가 `format`을 실행하고 명시 formatter·사람 승인 규칙·재파싱·고정점 검사가 모두 통과할 때만
  대상 파일 하나를 원자적으로 교체한다.
- **inspector:** Claude Code의 읽기 전용 하위 에이전트이며 파일을 쓰지 않는다.

## 제거

```bash
claude plugin uninstall xxx@xxx-plugins
codex plugin remove xxx@xxx-plugins
```
