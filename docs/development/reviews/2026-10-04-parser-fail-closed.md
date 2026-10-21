# REL2a — 파서 실패 시 쓰기 차단 구현·검증

2026-10-04. 구현·기계 검증 완료, 사용자 수락 대기. 사용자 지시로 별도 감사는 수행하지 않았다.

## 변경

[parse-check.ts](../../../product/engine/common/parse-check.ts)의 `compareParse`에서 파서 부재를
오류로 처리한다. `BOXBOX_REQUIRE_PARSERS=0`도 쓰기를 우회하지 못한다. 기존 공통 정렬 CLI가
파일을 쓰기 전에 이 함수를 호출하므로 검사 실패는 쓰기까지 도달하지 않는다.

- spawn 오류, timeout, signal, 출력 한도 초과, 종료 코드 부재와 해석 불가능한 비영 종료를 거절한다.
- 버전 probe는 최대 5초, 파싱은 기본·최대 60초, 출력 제한은 `maxBuffer=1_048_576`이다.
  테스트는 더 짧은 timeout만 지정할 수 있다.
- 도구 존재 여부를 캐시하지 않아 PATH·실행 파일 변경을 다시 확인한다.
- Python wrapper는 구문 오류를 출력하면서 정상 종료하므로 Python의 비영 종료는 모두 거절한다.
- 다른 compiler는 알려진 진단 종료 코드와 실제 진단이 있는 경우만 비교한다.
- `parserAvailable`의 로컬 선택적 테스트 skip과 CI의 `BOXBOX_REQUIRE_PARSERS=1` 계약은 유지한다.

rustfmt의 정상 formatting diff는 종료 1일 수 있으므로 단순히 모든 비영 종료를 거절하지 않는다.
빈 stderr, 임시 파일 diff 헤더, `-`/`+` 행을 확인한다. 출력 형식은
[rustfmt 공식 저장소의 실행 기록](https://github.com/rust-lang/rustfmt/issues/5882)을 참고했다.
현재 로컬에 rustfmt가 없어 해당 실제 도구 검증은 기존 skip으로 남으며, 빈 종료 1 거절은 가짜 실행 파일로 시험했다.

## 실제 CLI 전후 비교

격리한 PATH와 임시 Python fixture로 같은 `06_align-tables.ts --write --json` 명령을 실행했다.

| 상황 | 변경 전 | 변경 후 |
|---|---|---|
| python3 없음, REQUIRE=0 | 종료 0, 원본 수정 | 종료 1, 원본 byte 보존 |
| probe 성공 후 parser 종료 2 | 종료 0, 원본 수정 | 종료 1, 원본 byte 보존 |
| parser가 `error:` 출력 후 종료 2 | 별도 변경 전 측정 없음 | 종료 1, 원본 byte 보존 |
| 실제 Python parser | 기존 기능 | 종료 0, parse=ok, 수정 후 재실행 멱등 |

실패 시 현재 CLI는 예외를 stderr에 출력한다. JSON 오류 envelope 정규화까지 구현한 것은 아니다.
파서 비교는 기존 진단의 동일성을 검사하며 원본의 유효성·의미적 동등성을 증명하지 않는다.
파일별 검사/쓰기이므로 여러 대상 전체를 되돌리는 트랜잭션도 아니다.

## 검증

- [새 fault 테스트](../../../test/parser-fault.test.ts): **11 pass, 0 fail**, 25 assertions.
  파서 누락, probe timeout, 실행 도중 파일 소실, 실행 timeout, signal, 출력 초과,
  진단처럼 보이는 Python 비정상 종료, 빈 rustfmt 비영 종료, 실제 CLI 실패·성공을 확인한다.
- `bun run check`: 종료 0, **326 pass / 5 skip / 0 fail**, 331 tests / 34 files, 약 35초.
  타입 검사·설치 shell 문법 검사도 통과했다.
- 최종 테스트 파일 공백 정렬 후 전용 11개 테스트와 `tsc --noEmit`을 다시 실행해 통과했다.
- 전체 106개 TS import·정렬 검사: 기존 연구 파일 `scripts/eval.ts`만 실패.
  이번 두 파일은 import `changed=0`, 정렬 `misaligned=0`이다. 기존 연구 변경은 보존했다.
- `git diff --check` 통과. 이번 코드·테스트에 TODO, skip/only, 미구현 자리표시 없음.

5 skip은 기존 Rust 3건·Kotlin 2건이며 통과로 세지 않았다. REL2 전체 완료가 아니다.
TS 다중 pass 최초 원본 보존, 원자 교체, 보조 쓰기 inventory·동등 gate, 승인 DB 연결은 남아 있다.

## 실행 원본

- 구현 기록: `/tmp/boxbox-parser-fail-closed-notes.md`
- 변경 전 재현: `/tmp/boxbox-parser-checks/before.json`
- 변경 후 실제 CLI: `/tmp/boxbox-parser-checks/cli-smoke.py`, `after.json`
- 전체 검사: `/tmp/boxbox-parser-checks/check.log`
- 최종 전용 검사: `/tmp/boxbox-parser-checks/fault-final.log`
- 전체 자체 정렬: `/tmp/boxbox-parser-checks/selfcheck.json`, `selfcheck.log`

이는 저작·통합 과정의 기계 검증 기록이다. 별도 감사나 감사 통과 판정은 없다.

> Historical naming note (2026-10-12): this record predates the confirmed product name `boxbox` and npm package `boxbox`. Maintained links and examples use the current names; earlier placeholder-name findings are historical, not current naming blockers. Raw execution evidence remains unchanged.
