# XXX CLI 개발 후보

이 비공개 패키지는 TypeScript와 Python 프로젝트를 검사하고 초기 설정과 환경 진단을 실행하는
Node 전용 CLI 개발 후보이다. `format`은 프로젝트가 formatter를 명시하고, 대상 파일에 정확히
일치하는 사람 승인 증명과 안전 검사, formatter 고정점이 모두 확인될 때만 파일을 바꾼다.

사용자는 플러그인 preset과 별도로 개인 DB를 둘 수 있다. 다운로드한 CLI에서 다음 명령을 실행한다.

```bash
xxx db init
xxx db status
```

DB는 `$XDG_CONFIG_HOME/xxx/` 또는 `~/.config/xxx/`에 저장한다. `init`은 없는 JSONL 파일만 만들고
기존 데이터는 보존한다. `status`는 파일별 행 수·크기와 경로만 보여주며 DB 본문은 출력하지 않는다.
사용자 DB는 로컬에 머물고 플러그인 preset에 자동 전송되지 않는다.

## 실행 범위와 지속 상태

```bash
xxx run --root /absolute/project --json -- python3 edit_source.py
xxx status --root /absolute/project --json
```

`run`은 같은 공개 검사 엔진을 사용한다. doctor의 runtimeUsable을 확인한 뒤 코드 SHA를 저장하고,
자식 명령을 해당 root에서 실행하고, 바뀐 TypeScript/Python 파일만 검사한다. 자동 수정은 하지 않는다.
명령 인자·환경 변수·stdout/stderr는 증거에 저장하지 않는다. 일반 실행은 자식에게 터미널을 그대로 전달한다. `--json`에서는 자식 출력을 stderr로 전달하므로
`--json`의 stdout에는 최종 결과 객체 하나만 나온다.

`.xxx/runs/<runId>.json`에 RUNNING과 종료 상태를 원자적으로 저장한다. `status`는 최근 실행과
실행 이후 코드 변경(STALE)을 조회한다. 강제 종료로 끝 기록이 없으면 RUNNING이 남으므로 완료로
간주하지 않는다. 이 기록은 로컬 관측이며, 악의적 자식 프로세스의 조작을 방지하는 보안 감사 원장은 아니다.

- PASS: 변경된 지원 파일이 검사 통과. 전체 연구 코드의 정확성이나 구조 단순화 완료를 뜻하지 않는다.
- FAIL: 표 정렬 또는 보존상 거부가 발견됨(exit 1).
- TOOL_ERROR: preflight·실행 시작·snapshot·검사 오류(exit 2).
- CHILD_FAILED: 자식 종료가 실패함(exit 2); 검사 판정은 validation에 별도 보존.
- NO_CHANGES: 검사할 지원 코드 변경 없음(exit 0). 삭제만 한 경우도 deleted 목록과 함께 이 상태다.
- UNSUPPORTED: 변경된 코드에 공개 검사 미지원 언어가 있음(exit 2).
- NOT_INVOKED: 이 root에 실행 증거 없음. 설치됨/발견됨은 실행됨을 뜻하지 않는다.

범위는 root 아래이며 `.git`, `.xxx`, `node_modules`, `.venv`, `venv`, `__pycache__`, `dist`, `build`는
제외한다. runtime·scratchpad는 제외하지 않는다. 디렉터리 symlink는 따라가지 않는다. 파일 symlink의
대상 해시는 관측하되 변경된 symlink를 승인하지 않는다. `.ts/.tsx/.mts/.cts/.py`만 공개 검사를 지원하며
JS·Java·Go·Rust·C/C++·Swift·Kotlin·YAML·shell 변경은 UNSUPPORTED로 기록한다.
문서·바이너리·명시한 확장자 이외의 파일은 코드 검사 대상이 아니다.

이 실행기는 **명시 호출 경로**다. 호스트의 native hook 등록·trust·출력 수용과 에이전트의 skill 호출은
별도로 검증해야 한다. `nativeHookVerified=false`, `automaticFixPerformed=false`를 결과에 명시한다.
실행기 밖 변경을 막지 않으며 `status`의 SHA 대조로 뒤늦게 탐지한다. 따라서 설치만으로 항상 발동한다고
설명하지 않는다. 구조적 단순화는 에이전트의 skill 작업이고, format은 별도 승인 계약을 유지한다.
