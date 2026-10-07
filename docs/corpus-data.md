# 실제 코퍼스 DB 현황

갱신: 2026-10-04 · DATA1 최초 적재

## 수집 범위

사용자 지시로 배포에 사용할 규칙·예문의 근거 축적을 우선했다. 공개 저장소 8개의 manifest 고정
commit을 실제 fetch했고 HEAD 일치를 확인했다. 원본 checkout의 tracked 변경은 모두 0건이다.

| 출처 | 언어 | 처리 파일 | 관측 표 | 상한 적용 |
|---|---|---:|---:|---|
| microsoft/vscode | typescript | 1,000 | 7,364 | 1,000파일 |
| prisma/prisma | typescript | 1,000 | 3,477 | 1,000파일 |
| trpc/trpc | typescript | 724 | 1,753 | 없음 |
| colinhacks/zod | typescript | 477 | 3,042 | 없음 |
| psf/requests | python | 37 | 48 | 없음 |
| fastapi/fastapi | python | 1,138 | 678 | 없음 |
| pydantic/pydantic | python | 452 | 424 | 없음 |
| django/django | python | 2,931 | 1,827 | 없음 |

총 **7,759파일**, 처리 실패 **0건**이다. 표가 검출된 파일은 2,955개(서로 다른 파일 내용 hash
2,817개)다. 나머지 4,804파일의 무검출을 스타일 적합이나 전체 구조 분류 성공으로 세지 않는다. 파일은 경로순으로 선택한다. VS Code·Prisma는 첫
1,000파일 표본이므로 전체 저장소 대표성이나 전체 품질을 뜻하지 않는다. 숨김 디렉터리,
node_modules, TypeScript 선언 파일·TSX는 제외한다. 나머지 소스도 이 탐색 조건 안에서만 전수다.

## 저장된 데이터

- 원시 표 관측: **18,613행 / 11,207,375 B (약 10.69 MiB)**.
- 진단 시그니처: **246유형**. 깊이가 다른 표를 구분한다.
- 실제 규칙 조회 키: **88개** — TypeScript 74, Python 14. 깊이를 키에 넣지 않는 기존 계약을 따른다.
- TypeScript 관측: 15,636건. Python 관측: 2,977건.
- 관측 상태: FIXABLE 18,465 / PASS 140 / REFUSE 8. 여기서 FIXABLE은 엔진의 편집 후보이며
  사람이 승인했거나 파일 전체 parser·고정점 검증까지 완료됐다는 뜻은 아니다.

2026-10-04 로컬 실측에서 `observations.jsonl`은 **18,613행 / 11,207,375 B**, `signatures.json`은
**175,183 B**였다. 해당 폴더 전체는 공개 저장소 checkout을 포함해 2026-10-06 재측정 기준
**715,452 KiB(약 699 MiB)**다. 앞의 JSONL 크기와 checkout을 포함한 cache 디렉터리 크기는 서로 다른 수치다.

원시 관측은 `~/.cache/xxx/corpus/observations.jsonl`, 집계는 같은 폴더 `signatures.json`이다.
원시 행마다 stable ID, 정확 키, 진단 signature, 상태·행·편집 수, 저장소·고정 commit·manifest의
라이선스 정보, 파일·행 범위·전체 파일 SHA-256을 넣었다. report의 JSONL hash와 행 수를 대조했다.
재실행은 동일 ID를 append하지 않고 새 스냅샷으로 교체한다.

배포 preset과 수집 DB는 별도다. 수집 결과를 사람 승인 없이 preset에 넣지 않았다.
후보·전후 비교 결과는 프로젝트 `.xxx/cache/corpus/`에 저장하며 제3자 원문은 git에 추가하지 않는다.

## 배포 데이터와 비공개 근거의 경계

공개 CLI 빌더는 명시된 파일만 복사한다. 현재는 CLI bundle·README·package metadata와 recommended preset의
JSONL 세 파일이다. `.xxx/cache/corpus/`, `.xxx/cache/shape.jsonl`, `~/.cache/xxx/corpus/` 및
`REVIEW.md`는 npm artifact에 복사하지 않는다. `.xxx/cache/`도 gitignore 대상이다.
미승인 후보 문서 `docs/candidates/initial-rules.md`는 CLI package allowlist에서 제외했다.
현재 preset JSONL 세 파일은 모두 빈 파일이므로 실제 규칙·사용자 예문은 배포본에 없다.

이 분리는 **연구 데이터** 경계다. npm artifact에는 143,179 B의 실행용 `dist/cli.js`가 들어간다.
현재 번들은 minify되지 않으며 설치자는 제품 실행 코드를 열어 볼 수 있다. DB 분리만으로 제품 구현의
기밀성이 보장되지는 않는다. 또 marketplace manifest의 `source: "./"`는 npm allowlist와 별개로
저장소 전체를 가리키므로 공개 전 패키지 경계를 고쳐야 한다.

자체 함수 Evidence에는 함수 표시 이름, 저장소 상대 파일 경로, 코드 hash, 구조 분류가 들어간다.
함수 본문 원문은 없지만 이름과 경로만으로 내부 구조를 드러낼 수 있으니 공개 asset으로 취급하지 않는다.
사용자 로컬 코퍼스를 `corpus/local.json`에 등록하면 관측 cache에도 경로·hash·구조 정보가 저장된다.
이 cache는 수집 머신에서만 다루고 release preset으로 복사하지 않는다.

approved preset을 채우기 전에는 별도 내보내기 단계를 둔다. 이 단계는 status가 `approved`인 convention과
그 convention에 연결된 Decision만 허용하고, 예문은 직접 작성한 짧은 synthetic 사례만 받는다. Decision에는 status 필드가 없으므로 승인 상태를 중복 기록하지 않는다. `own-code` 및 `public-corpus`
예문, 파일 경로·저장소 commit·source hash는 preset에 넣지 않는다. 표본은 관계만 남기도록 식별자·값을
새로 지어 쓴다. 사람은 예문이 실제 원문을 옮기지 않았는지 확인하고, `approvedBy`에는 개인 계정 대신
`maintainer` 같은 역할 이름을 쓴다. 빈도는 후보 정렬에만 쓰고 자동 승인하지 않는다.

공개 CLI 빌더는 `scripts/public-preset.ts`에서 배포 데이터 정책을 검사한다. convention과 example은
`approved`여야 한다. Decision 스키마에는 status가 없으며, 빌드는 각 Decision이 승인된 같은 ID의
convention·예문·결정 종류와 연결되고 익명 승인자·날짜·문서 hash를 갖는지 확인한다. 예문은 `synthetic`
출처와 허용된 SPDX 식별자만 받으며 원본 경로·commit·추가 provenance 필드와 설명 메모를 거부한다.
중첩 필드도 닫힌 allowlist로 검사한다. 예문은 각각 1,600자 이하이고 규칙 scope는
범용 glob만 허용한다. 결정 문서는 preset의 `docs/public/` 아래에서만 읽고, Decision hash가 검증한 승인
절만 별도 artifact 문서로 추출한다. 패키징 Decision 참조도 추출본을 가리켜 같은 원본 문서의 다른 절은
배포하지 않는다. 경로 탈출과 부모 symlink, 코드 fence·로컬 절대 경로·저장소 commit permalink가 든 승인
절은 거부한다. 검증은 artifact 삭제보다 먼저 실행되므로 입력이 정책을 어기면 이전 산출물도 지우지 않는다.

이 검사는 원문 코드를 synthetic이라고 잘못 표시했는지 의미 수준에서 판별하지 못하고 모든 개인정보도
찾아내지 못한다. preset은 현재 비어 있다. 첫 레코드를 넣기 전 사람의 원문 대조가 필요하며, 릴리스마다
최종 npm tarball의 파일 목록·문자열 scan도 해야 한다.

### 연구 DB · 플러그인 preset · 사용자 DB는 서로 다른 저장소다

| 저장소 | 위치 | 소유·용도 | 배포 정책 |
|---|---|---|---|
| 연구 Evidence DB | `~/.cache/xxx/corpus/`, 프로젝트 `.xxx/cache/corpus/`·`shape.jsonl` | 수집 원문·경로·hash·빈도와 미승인 후보. 배포 규칙을 조사하는 내부 근거 | 플러그인이나 npm artifact에 복사하지 않는다. 자동 승격하지 않는다. |
| 플러그인 preset DB | `presets/recommended/{conventions,examples,decisions}.jsonl` | 제작자가 승인한 범용 규칙. 플러그인과 함께 설치되는 읽기 전용 기본값 | 승인 규칙과 새로 작성한 synthetic 예문만 넣는다. 사용자·연구 Evidence를 넣지 않는다. |
| 사용자 전역 DB | `~/.config/xxx/{conventions,examples,decisions}.jsonl` | 플러그인 사용자가 소유하는 개인 규칙·예문. 사용자 장치에만 보관 | preset과 별개로 읽는다. 업로드·preset 동기화는 하지 않는다. |
| 프로젝트 DB | `<project>/.xxx/{conventions,examples,decisions}.jsonl` | 한 저장소에만 적용할 규칙. 팀이 원하면 직접 버전 관리 | 사용자 전역 DB와 분리하고 해당 프로젝트에서만 사용한다. |

플러그인 다운로드에는 **플러그인 preset**만 포함한다. 사용자 전역 DB와 프로젝트 DB는 별도 경로에
놓이며 preset 파일을 수정하지 않는다. 사용자가 자기 코드에서 만든 예문은 개인·프로젝트 DB에 둘 수
있지만, 배포 preset으로 옮길 때는 원문 예문을 복사하지 않고 일반 규칙으로 추상화한 뒤 새 synthetic
예문을 작성하고 사람 승인을 거친다. 각 저장소의 우선순위는 `Project → User → Preset → Base`이며,
Safety 규칙은 모든 층보다 우선한다.

현재 공개 CLI는 기본 설정 경로에서 사용자 전역 DB JSONL을 **읽고 조회 우선순위에 반영**한다.
`xxx db init`은 누락된 빈 DB만 만들고 기존 파일을 덮지 않는다. `xxx db status`는 각 파일의 행 수와
바이트 크기만 보고하며 본문은 출력하지 않는다. 새 사용자 DB 디렉터리와 파일에는 각각 0700·0600
권한을 준다. 편집·가져오기·내보내기·백업 명령은 아직 없다. 세 preset 파일은 현재 비어 있다.
따라서 preset 메타데이터 차단과 로컬 DB 초기화·현황은 구현됐고, 의미 수준의 원문 대조와 최종 artifact
누출 검사, 사용자 DB 추가 관리 경험은 배포 전에 완성해야 한다.

## 자체 함수 구조 DB

`.xxx/cache/shape.jsonl`을 엔진 TS 65파일로 확장했다. 이름 있는 함수 **311개**, 구조 hash
**154종**, 파일 정보·헤더 포함 **377 JSONL행 / 220,314 B**다. 이전 완료 스냅샷은 별도로 보존한다.
직속 문장 1,863개 중 1,247개가 현재 문형으로 분류됐다. 화살표 함수 등 미지원 단위 433개를
지원된 함수로 세지 않았다. 이 관측은 실행 순서를 바꾸는 승인 근거가 아니다.

## 재현 명령

```bash
bun scripts/corpus-fetch.ts
bun scripts/corpus-signatures.ts --max-files 1000 --max-python-files 10000
bun scripts/corpus-candidates.ts --limit 40 --reps 1
```

## 데이터로 확인한 우선순위

기존에 제시한 두 초기 규칙의 정확 키는 TS 23건 + Python 594건, 총 617건으로 관측의
**3.31%**였다. 이 두 규칙만으로 배포 범위를 충분히 덮는다고 볼 수 없다.

| 먼저 검토할 키 | 관측 수 |
|---|---:|
| TS Block / declaration-equals / equals→semicolon | 6,041 |
| TS ObjectLiteralExpression / registration / colon→value | 4,829 |
| Python table / key→colon→value→comma | 1,718 |
| TS InterfaceDeclaration / interface-members / colon→semicolon | 880 |

빈도는 검토 순서를 정하는 근거이며 규칙의 정당성·안전을 승인하는 근거가 아니다.
첫 40개 키의 대표 전후 40건은 실제 엔진과 재실행 검증을 통과했고 관측 18,353건(98.60%)을
포함하는 키였다. 이어 모든 88개 키에 대해 키당 최대 3개 예문으로 확대했다.

## 검증 상태

원시 JSONL hash 일치·18,613개 ID 유일성·집계 count 일치를 확인했다.
`bun run check` 종료 0: **393 pass / 5 skip / 0 fail**, 44개 파일·398개 테스트,
1,573 assertions, 125.62초. TypeScript·설치 shell 검사도 통과했다. 기존 Rust 3건·Kotlin 2건
skip은 통과로 세지 않는다. 전용 후보 테스트는 실제 TypeScript·Python 엔진의 성공과
출처 불일치 거절, source 다양성 선택을 검증한다.

자체 import·정렬은 127파일 중 기존 연구 파일 `scripts/eval.ts`만 실패했다. 이번 변경 파일은
모두 통과했고 연구 파일은 수정하지 않았다. 별도 감사·외부 AI 판정은 사용자 지시대로 실행하지 않았다.
로그: `/tmp/xxx-corpus-check.log`, `/tmp/xxx-corpus-selfcheck.json`, `/tmp/xxx-corpus-imports.log`.

## 확대된 대표 예문 결과

- 후보: **88개 / 45,444 B**. 모든 키를 포함하며 source별 빈도와 대표 evidence ID를 연결한다.
- 예문: **225개 / 280,323 B**. 64개 키는 3개, 9개 키는 2개, 15개 키는 1개 예문이다.
- 서로 다른 저장소의 대표를 포함한 키: **61개**.
- 기계 검증 통과: **213개**, 통과 예문이 있는 키는 **86개**.
- 보류: **12개**. 11개는 전체 파일 정렬·parser·고정점 검사는 통과했지만 줄바꿈 변화로
  원본 표의 전후 행 대응을 확정하지 못했다. 1개는 VS Code multilineModel.ts의 60초 실행 timeout이다.
- parser `ok`: 통과 213개 + 행 대응 보류 11개. timeout 1개는 `not-run`으로 분리했다.
- 원본 변경: **0개**. 실패를 다른 대표로 바꿔 숨기지 않았다.
- 사람 승인: **0개**. 기계 검증 결과와 사람의 가독성 판정은 별도다.

사람 검토용 `.xxx/cache/corpus/REVIEW.md`에는 빈도순 후보·고정 commit 출처·전후 코드·검증 상태를
기록했다. 100줄이 넘는 예문은 잘림을 표시하며 구조화 원문은 같은 폴더 `examples.jsonl`에 있다.
캐시의 `SUMMARY.md`와 `summary.json`에서 집계를 재확인할 수 있다.

전체 검사 후 추가한 parser 미실행 표시·검토 문서 회귀를 포함해 후보 전용 **6개 테스트**도
통과했다. 타입·diff 검사도 재확인했다. 테스트 성공과 실제 데이터의 12개 보류는 다른 수치다.

## 다음 데이터 작업

1. 빈도 상위 키의 실제 전후를 검토해 같은 역할 묶음인지·과도한 padding인지 판정한다.
2. 11개 행 대응 보류를 안전하게 매핑하고 1개 timeout을 재현해 예문·성능 회귀로 남긴다.
3. 채택할 규칙마다 적용 범위·긍정 예문·반례·Decision을 완성하고 실제 승인분만 preset으로 승격한다.
4. VS Code·Prisma의 미수집 구간과 새로운 저장소로 검증 표본을 넓힌다.

이번 적재는 배포 근거를 만드는 첫 코퍼스 구축이며, 18,613건 전체가 승인된 수정 규칙이라는 뜻은 아니다.
