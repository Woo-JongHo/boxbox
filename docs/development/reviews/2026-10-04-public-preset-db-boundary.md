# 공개 preset DB 경계 검토

날짜: 2026-10-04  
검토자: Sol, 읽기 전용 독립 검토  
대상: 공개 CLI용 preset export gate와 연구·배포·사용자 DB의 분리  
판정 범위: 공개 preset 경계만 검토. 전체 저장소 release audit는 아니다.

## 검토에서 찾은 문제와 반영

1. **중첩 레코드 필드가 열려 있음:** 임의 provenance 값이 `asserts`나 `versions` 안에 포함될 수 있었다. 중첩 객체를 닫힌 allowlist로 검사하고 versions를 현재 schema와 정확히 일치시킨다.
2. **공개 문서 경로 우회:** `docs/public/` prefix만으로는 경로 traversal과 부모 symlink를 막지 못했다. 구성 요소별 정규화·symlink 거절·물리 경로 경계를 검사한다.
3. **Decision 승인 표현 오류:** Decision schema에는 status가 없는데 approved status를 요구한다고 문서에 적혀 있었다. 승인된 convention과 같은 ID의 Decision 증거를 연결하도록 문구를 고쳤다.
4. **JSON 중복 키 잔존:** parser는 마지막 값을 검증하지만 원본 JSONL을 그대로 복사하면 앞선 비공개 값이 남을 수 있었다. 검증된 레코드를 JSON으로 재직렬화해 hidden duplicate value를 제거한다.
5. **`example.rules` 타입 우회:** 배열이 아닌 문자열도 `.includes`로 규칙 링크를 만족할 수 있었다. 짧은 ID 배열과 convention ↔ example의 양방향 연결을 확인한다.
6. **승인 문서의 미승인 형제 절 동봉:** Decision hash는 한 절만 보호했으나 원본 문서 전체를 복사하고 있었다. hash가 검증한 승인 절만 `docs/public/decisions/<id>.md`에 추출하고, 배포 Decision ref를 추출본으로 바꾼다.

Sol은 각 수정 뒤 좁은 범위 재검토를 수행했다. 마지막 검토에서는 공개 문서 절 추출·Decision ref 재작성에 추가 finding이 없었다. Sol은 테스트·빌드·파일 수정을 하지 않았다.

## 기계 검증

- `bun test test/public-preset.test.ts test/public-artifact.test.ts`: **10 pass, 0 fail**, 119 assertions. 중복 키, 형제 절 제외, 참조 재작성, 추출 후 docHash, symlink, traversal, 규칙 배열을 확인했다.
- `bun run check`: **403 pass / 5 skip / 0 fail**, 45개 파일·408개 테스트. `tsc --noEmit`과 `bash -n install.sh` 통과. skip은 Rust 3건·Kotlin 2건이며 통과로 세지 않는다.
- `bun run pack:cli`: 성공. `boxbox@0.2.0`은 35,415 B 압축, 144,583 B 해제, 6개 파일이다. `tar -tzf dist/boxbox-0.2.0.tgz`에서도 README, package metadata, CLI bundle, 빈 recommended JSONL 세 개만 확인했다.

## 데이터 경계와 남은 한계

- 연구 Evidence는 `~/.cache/boxbox/corpus/`에 남는다. 관측 JSONL은 18,613행·11,207,375 B, 집계 signature는 175,183 B다. 저장소 checkout을 포함한 전체 cache는 715,920 KiB다. npm tarball에는 포함되지 않는다.
- 배포 preset JSONL은 세 파일 모두 비어 있어 실제 승인 규칙·예문이 아직 없다. 이를 승인 완료나 제품 동작 데이터로 간주하지 않는다.
- 설치 사용자의 DB는 `db init/status`가 `$XDG_CONFIG_HOME/boxbox` 또는 `~/.config/boxbox`에 별도 생성·조회한다. status는 본문을 출력하지 않는다.
- `synthetic` 값이 실제 원문을 복사했는지 자동 판별하지 못한다. 첫 preset 레코드마다 사람의 원문 대조와 릴리스별 artifact 검사 필요하다.
- `.claude-plugin/marketplace.json`의 `source: "./"`는 저장소 전체를 가리킨다. npm package allowlist가 이 플러그인 배포 경계를 해결하지 않는다.
- 사용자 DB 편집·가져오기·백업, 실제 호스트와 비macOS 설치, 제품명·라이선스·배포 채널, 전체 release audit, publish는 미완료다.

> Historical naming note (2026-10-12): this record predates the confirmed product name `boxbox` and npm package `boxbox`. Maintained links and examples use the current names; earlier placeholder-name findings are historical, not current naming blockers. Raw execution evidence remains unchanged.
