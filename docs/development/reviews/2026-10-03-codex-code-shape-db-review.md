# Codex 교차 검토 — 프로젝트 코드 모양 DB 아이디어 (2026-10-03)

대상: 린트 규칙이 적용된 프로젝트의 코드 모양(파일 → 함수·객체 단위, 단위는 파일에 FK, 번호·정보·문단별 개수)을 플러그인이 마련한 공간에 저장하는 아이디어
검토자: Codex CLI 0.158, gpt-6-astra, 추론 high, 읽기 전용 (`docs/design.md`, `docs/plan.md`, `docs/reviews/2026-09-30-codex-learning-db-review.md`, `references/readability-contract.md`와 대조)

## 배경 — 실사용 TypeScript 저장소에서 확인한 것 (2026-10-03)

- 파일 절 순서(§1 공개 타입 → §2 상수 → §3 공개 함수 → §4 내부 처리)를 TypeScript 7 AST로 최상위 문장 단위만 옮기는 도구로 19개 기능에 적용했다. 함수 본문·const·class·초기화 순서는 옮기지 않았고, 기능별 Codex 검토로 AST 동일성을 확인했다.
- 함수 문단(F1 가드 → F2 준비 → F3 처리 → F4 결과) 조사: 문장 4개 이상인 함수 366개 중 274개가 `G* D* G* D* B* R?`, 75개는 처리 뒤 선언이 끼어듦, 12개는 준비·가드가 번갈아 나오는 단계별 가드(정상 모양), 5개는 처리 중 가드. 중간 return은 0개.

## 결정

| # | Codex 의견 | 결정 |
|---|---|---|
| 1 | 관측한 모양은 Evidence(`.boxbox/cache/`, 재생성)다. "이 프로젝트는 이 순서를 따른다"는 사람이 승인한 Project Convention, 승인 이력은 Decision. 다수결로 규칙을 확정하지 않는다 | 수용 |
| 2 | 분포 이탈 ≠ 규칙 위반. 승인 전에는 "관측상 드문 모양" 보고만, REVIEW 위반·자동 수정 근거 금지. 미승인 모양을 GUIDE에 주입하지 않는다 | 수용 |
| 3 | 식별: 단위 id는 스캔 안에서만 유효. `parentUnitId`·문자 범위로 중첩·한 줄 여러 단위 구별. 이름(표시)·원문 해시(무효화)·모양 해시(집계) 분리. 이름 변경 추적은 미룸 | 수용 |
| 4 | 모양: 압축 문자열 대신 순서 있는 구간 목록(안정 문형 ID·개수·범위). `unknown`/`notApplicable`을 0과 구별. 숫자 절 번호를 규칙 영구 ID로 쓰지 않음. §·F 역할은 프로젝트 분류 | 수용 |
| 5 | 무효화: schemaVersion, 추출기·파서·언어 프로필 버전, 규칙·설정·preset 지문, 파일별 포매터 지문과 관측 단계(원본/포매터 후/BoxBox 후), 스캔 범위·성공·실패·미지원 수·완료 여부 | 수용 |
| 6 | 언어: TS의 단위 관측을 먼저 검증. 다른 언어는 기존에 확실히 추출하는 표 정보만. 지원 능력을 file/table/unit/paragraph별로 표시 | 수용 |
| 7 | 저장: 첫 실험은 JSONL 한 파일, SQLite는 실측 병목 뒤 재생성 색인으로. 최신 완료 스냅샷 + 비교 기준 하나만 유지, 크기·보존 상한 | 수용 |
| 8 | 자리: S5c의 수집 보조 실험(승인 적재의 선행조건 아님). S5a 조회 키에 모양을 끼우지 않음, S5d 게이트 유지, S5e(정렬 모양의 DB 이전)와 별개 | 수용 — Backlog에 등록, 활성 순서 유지 |

## 원문

**Evidence 수집기로는 채택할 가치가 큽니다. 다만 관측한 코드 모양을 곧바로 규칙·알람·GUIDE로 사용하는 부분은 바꿔야 합니다.** 또한 이번의 ‘프로젝트 모양 관측’과 S5e의 ‘정렬 규칙을 DB로 이전’은 서로 다른 작업입니다.

지정한 문서만 읽었으며 파일 수정·Linear·Obsidian 기록은 하지 않았습니다. 아래는 문서 간 설계 검토이며, 아이디어에 적힌 실측 수치는 재검증하지 않았습니다.

**1. 기존 설계와의 정합성**

| 대상 | 들어갈 위치와 판단 |
|---|---|
| 파일·함수·객체에서 추출한 모양과 개수 | **Evidence**. 프로젝트의 `.boxbox/cache/`에 두고 재생성하는 것이 맞습니다. 승인 데이터와 수명을 분리해야 합니다. |
| “이 프로젝트에서는 이 순서를 따른다”는 규칙 | 사람이 승인한 **Convention**, 적용 범위는 Project 층입니다. 수집기가 다수결로 확정하면 안 됩니다. |
| 채택·거절 이유와 승인 대상 | **Decision**. 대상 규칙·예문의 불변 버전과 문서 해시를 가리켜야 합니다. |
| 언어별 구문 추출 방법 | 엔진 또는 **Base**. 프로젝트에서 흔하다는 사실을 언어 공통 규칙으로 넣으면 안 됩니다. |

이는 세 레코드의 책임 및 Base/Project 구분과 일치합니다. Evidence는 별도의 규범 우선순위 층이 아니라, 규범을 제안하는 관측 자료입니다. [docs/design.md:118](/Users/jonghoPro/woo/00_project/98_BoxBox/docs/design.md:118), [docs/design.md:68](/Users/jonghoPro/woo/00_project/98_BoxBox/docs/design.md:68)

충돌하거나 경계를 명확히 해야 할 부분은 네 가지입니다.

- **분포 이탈 ≠ 규칙 위반.** 지배적 모양은 후보를 찾는 근거이지 승인 근거가 아닙니다. 승인 전에는 “관측상 드문 모양”으로 보고하고, REVIEW 위반·자동 수정의 근거로 쓰지 않아야 합니다. 승인된 경우에도 함수 순서 같은 판단 규칙은 `SUGGEST` 수준입니다. [docs/design.md:33](/Users/jonghoPro/woo/00_project/98_BoxBox/docs/design.md:33), [docs/design.md:194](/Users/jonghoPro/woo/00_project/98_BoxBox/docs/design.md:194), [docs/design.md:205](/Users/jonghoPro/woo/00_project/98_BoxBox/docs/design.md:205)
- **주변 단위의 관측 모양을 GUIDE에 직접 주입하는 것은 현재 계약과 충돌합니다.** GUIDE는 승인된 규칙만 렌더링하고, 승인 예문도 `after-better`만 사용합니다. 미승인 주변 모양은 검토용 Evidence로 제공하고, 작성 지침으로 승격하지 않아야 합니다. [code-shape-db-idea.md:32](/Users/jonghoPro/woo/00_project/99_www/.www/scratchpad/code-shape-db-idea.md:32), [docs/design.md:330](/Users/jonghoPro/woo/00_project/98_BoxBox/docs/design.md:330), [학습 DB 검토:13](/Users/jonghoPro/woo/00_project/98_BoxBox/docs/reviews/2026-09-30-codex-learning-db-review.md:13)
- **SQLite는 위치보다 도입 시점이 문제입니다.** `.boxbox/cache/shape.sqlite`는 승인 정본을 대체하지 않는 재생성 캐시라면 설계상 허용 가능한 후속 선택지입니다. 하지만 계획은 SQLite를 “나중에 캐시 색인으로만” 허용합니다. 또한 ‘첫 출시 단일 파일 JSONL’ 결정은 정확히는 **예문 저장 형식**에 관한 것이므로, 모든 Evidence의 SQLite 사용을 영구 금지한 것으로 해석하면 과합니다. [docs/plan.md:206](/Users/jonghoPro/woo/00_project/98_BoxBox/docs/plan.md:206), [학습 DB 검토:13](/Users/jonghoPro/woo/00_project/98_BoxBox/docs/reviews/2026-09-30-codex-learning-db-review.md:13)
- **플러그인 폴더 금지는 프로젝트 관측 데이터에 적용됩니다.** 배포용 읽기 전용 Preset DB는 원래 플러그인에 포함됩니다. 따라서 “플러그인에는 공간·스킬·유도만 있다”는 표현을 엔진·Base·Preset까지 없앤다는 뜻으로 쓰면 기존 구조와 충돌합니다. 프로젝트 데이터는 프로젝트 캐시에 두면 됩니다. [code-shape-db-idea.md:5](/Users/jonghoPro/woo/00_project/99_www/.www/scratchpad/code-shape-db-idea.md:5), [docs/plan.md:207](/Users/jonghoPro/woo/00_project/98_BoxBox/docs/plan.md:207), [docs/design.md:288](/Users/jonghoPro/woo/00_project/98_BoxBox/docs/design.md:288)

파일 절·함수 문단의 순서를 **관측**하는 것은 정합적입니다. 이를 자동 재배치로 확장하면 비공백 토큰 순서 보존 불변식에 어긋납니다. 기존 가독성 계약도 선언의 초기화·등록 의존성과 실행 순서를 보존하라고 요구합니다. [docs/design.md:28](/Users/jonghoPro/woo/00_project/98_BoxBox/docs/design.md:28), [readability-contract.md:20](/Users/jonghoPro/woo/00_project/98_BoxBox/skills/boxbox/references/readability-contract.md:20)

**2. 스키마 초안의 약점과 수정안**

**식별: 스냅샷 안의 주소와 변경 이력을 잇는 식별자를 분리해야 합니다.**

`ordinal`을 표시용으로 한 것은 좋습니다. 그러나 제안한 `(path, qualified_name, kind, occurrence)`는 이름 변경·파일 이동·앞쪽 동명 선언 삽입으로 바뀌며, `unit_hash`도 본문 수정으로 바뀝니다. 반대로 복제한 함수들은 같은 해시를 가질 수 있습니다. 또 설명에 있는 `occurrence`가 실제 `units` 필드에는 빠져 있습니다. [code-shape-db-idea.md:22](/Users/jonghoPro/woo/00_project/99_www/.www/scratchpad/code-shape-db-idea.md:22), [code-shape-db-idea.md:30](/Users/jonghoPro/woo/00_project/99_www/.www/scratchpad/code-shape-db-idea.md:30)

권고는 다음과 같습니다.

- 첫 버전의 `unitId`는 **스캔 안에서만 유효**하게 정의합니다.
- 중첩 함수·객체 메서드·익명 화살표를 구별할 `parentUnitId`, 구문상 위치, 문자 범위를 둡니다. 줄 번호만으로는 한 줄의 여러 단위를 구별하지 못합니다.
- 이름은 표시·탐색용, 원문 해시는 무효화용, 모양 해시는 분포 집계용으로 분리합니다.
- 스캔 간 이름 변경 추적은 후속 기능으로 미룹니다. 모호한 대응은 같은 단위라고 단정하지 않습니다.

기존 계약의 `name#occurrence`도 모호한 요청은 실패시키는 **조회 주소**이지, 변경을 견디는 영구 식별자가 아닙니다. [readability-contract.md:62](/Users/jonghoPro/woo/00_project/98_BoxBox/skills/boxbox/references/readability-contract.md:62)

**모양: 압축 방식과 집계 단위가 아직 정의되지 않았습니다.**

`GDBR`와 총개수만으로는 반복·중첩·전환 위치를 충분히 복원하기 어렵습니다. `interleaved`는 순서열에서 계산할 수 있는 중복 정보이므로 서로 어긋날 수도 있습니다. 특히 `guard`와 `return`은 겹칠 수 있고, `business`는 구문만으로 확정하기 어려운 역할입니다. 객체·인터페이스에는 함수용 네 개 카운트가 적용되지 않습니다. [code-shape-db-idea.md:24](/Users/jonghoPro/woo/00_project/99_www/.www/scratchpad/code-shape-db-idea.md:24)

**제안:** 함수·객체·타입을 구별하는 레코드를 쓰고, 순서가 있는 구간 목록에 안정적인 문형 ID·개수·범위를 저장하십시오. 문형과 역할은 분리하고, `unknown`과 `notApplicable`을 0과 구별해야 합니다. 중첩 함수의 문장을 부모 함수에 중복 집계할지도 명시해야 합니다. 숫자 절 번호는 규칙의 영구 ID로 쓰지 않는 편이 맞습니다. 기존 결정도 숫자 층보다 안정적인 ID를 요구합니다. [학습 DB 검토:11](/Users/jonghoPro/woo/00_project/98_BoxBox/docs/reviews/2026-09-30-codex-learning-db-review.md:11)

또한 §1~§4나 F1~F4는 특정 프로젝트의 역할 분류입니다. 없는 역할을 채우거나 모든 함수에 같은 뼈대를 강제하면 기존 계약과 충돌합니다. [readability-contract.md:20](/Users/jonghoPro/woo/00_project/98_BoxBox/skills/boxbox/references/readability-contract.md:20)

**재생성·무효화: `tool_version`, `rule_version`만으로는 부족합니다.**

초안에는 버전 칸이 있지만, 어떤 입력 변화가 어떤 관측을 무효화하는지 정의가 없습니다. 최소한 다음이 필요합니다.

- `schemaVersion`, 추출기·파서/언어 프로필·문법 분류 버전.
- 적용된 규칙·설정·Preset의 내용 지문.
- 파일별 포매터 명령·인자·버전·설정 지문과 관측 단계: 원본 / 포매터 후 / BoxBox 후.
- 스캔 대상·제외 조건, 성공·실패·미지원 파일 수, 스캔 완료 여부.

파일별 포매터 지문 변경으로 캐시를 무효화한다는 요구와 도구 버전별 재현성은 이미 명시돼 있습니다. [docs/design.md:104](/Users/jonghoPro/woo/00_project/98_BoxBox/docs/design.md:104), [docs/design.md:170](/Users/jonghoPro/woo/00_project/98_BoxBox/docs/design.md:170), [학습 DB 검토:10](/Users/jonghoPro/woo/00_project/98_BoxBox/docs/reviews/2026-09-30-codex-learning-db-review.md:10)

**설계상 한계:** `commit + worktree_digest`는 미커밋 상태를 식별할 수 있어도 그 내용을 복원하지는 못합니다. 원문을 저장하지 않는다면 “현재 소스로 재생성 가능”과 “과거 스캔을 정확히 재현 가능”을 구별해야 합니다. 관측 캐시 무효화와 승인 규칙의 재승인 필요 여부도 별도로 처리해야 합니다.

**언어 일반화: 공통 저장 형식이 공통 추출 능력을 뜻하지 않습니다.**

설계는 TS의 AST/LSP와 다른 언어의 줄 엔진을 구분합니다. Swift·Kotlin 추가 기록도 제한된 행 형태만 지원하고 컨테이너·클로저 등을 거절한다고 명시합니다. 따라서 아홉 언어의 줄 엔진에서 함수 경계·중첩·가드·결과 역할까지 이미 추출할 수 있다고 가정할 근거는 없습니다. [docs/design.md:86](/Users/jonghoPro/woo/00_project/98_BoxBox/docs/design.md:86), [docs/plan.md:197](/Users/jonghoPro/woo/00_project/98_BoxBox/docs/plan.md:197)

**제안:** `file`·`table`·`unit`·`paragraph`별 지원 능력을 표시하고, 미지원은 명시적으로 남기십시오. TS에서 단위 관측을 먼저 검증하고, 다른 언어는 기존에 확실히 추출하는 표 정보만 사용해야 합니다. Python이 제품 1차 범위라는 사실도 함수 모양 추출까지 지원한다는 뜻은 아닙니다. [docs/plan.md:248](/Users/jonghoPro/woo/00_project/98_BoxBox/docs/plan.md:248)

**비공개 코드·크기: 원문 미저장은 좋은 출발이지만 충분조건은 아닙니다.**

경로·`qualified_name`만으로도 내부 업무 용어가 노출될 수 있고, 해시를 익명화 보장으로 취급하면 안 됩니다. 첫 버전은 로컬·git 제외를 기본으로 하고, 외부 GUIDE나 예문 승격 때 별도의 최소화가 필요합니다. 기존 검토도 비공개 코드의 비밀정보 검사와 최소 재현 예문을 요구합니다. [code-shape-db-idea.md:31](/Users/jonghoPro/woo/00_project/99_www/.www/scratchpad/code-shape-db-idea.md:31), [학습 DB 검토:12](/Users/jonghoPro/woo/00_project/98_BoxBox/docs/reviews/2026-09-30-codex-learning-db-review.md:12)

**추측:** 모든 스캔에 파일·단위·순서열을 복제하면 저장량은 스캔 수에 비례해 커질 것입니다. 다만 실제 크기·조회 지연은 측정하지 않았으므로 SQLite가 필요하다고 단정할 수 없습니다. 최신 완료 스냅샷과 선택한 비교 기준 하나만 유지하고, 크기·보존 상한부터 두는 편을 권합니다.

**JSONL vs SQLite:** 첫 실험은 JSONL 한 파일에서 시작하십시오. SQLite는 부분 갱신·다중 조건 조회·동시 접근의 실측 병목이 생겼을 때 재생성 색인으로 추가하면 됩니다. 저장 엔진 선택과 REVIEW의 정확 키 조회 계약은 별개입니다. [docs/plan.md:205](/Users/jonghoPro/woo/00_project/98_BoxBox/docs/plan.md:205)

**3. 가치가 큰 쓰임과 최소 범위**

| 쓰임 | 판단 |
|---|---|
| LEARN에서 반복 모양·반례를 모아 승인 후보를 압축 | **가치 큼.** 빈도뿐 아니라 적용 범위·최근성·분류 불가·경쟁 모양을 함께 보여야 합니다. |
| 같은 설정·추출기·대상 집합에서 정리 전후 비교 | **가치 큼.** 파일 삭제·대상 변경을 개선으로 세지 않도록 분모를 고정해야 합니다. |
| 프로젝트 분포에서 드문 모양 탐색 | **보조 정보로 유용.** 승인 규칙 위반과 구분해야 합니다. |
| 주변 코드 모양을 그대로 GUIDE에 주입 | **현재는 부적합.** 승인된 규칙·예문을 고르는 보조 근거로 제한해야 합니다. |
| 전 언어 함수 추적, 이름 변경 연결, 상시 SQLite 누적 | **첫 단계로는 과잉.** 핵심 효용 검증 전에 비용과 오판 경로가 늘어납니다. |

빈도와 최근성의 충돌을 남기고, 대표 사례로 사람 검토를 압축하는 방향은 기존 Evidence·리뷰 퍼널과 맞습니다. 다만 고위험 함수 단위는 소수 대표만 보고 일괄 승인하면 안 됩니다. [docs/design.md:172](/Users/jonghoPro/woo/00_project/98_BoxBox/docs/design.md:172), [docs/design.md:253](/Users/jonghoPro/woo/00_project/98_BoxBox/docs/design.md:253)

아이디어의 `366개·274개·75개`는 출발점이지 일반화 증거는 아닙니다. 두 하위 집계의 합은 349개이므로 전체와의 관계, 중복 여부, 나머지 분류를 먼저 밝혀야 합니다. 이는 해당 메모의 숫자 대조이며 원자료 검증은 아닙니다. [code-shape-db-idea.md:12](/Users/jonghoPro/woo/00_project/99_www/.www/scratchpad/code-shape-db-idea.md:12)

**첫 단계 권고는 ‘TS의 제한된 함수 모양을 읽기 전용으로 수집하는 S5c 보조 실험’입니다.**

1. 명시한 프로젝트 범위에서 파일과 이름 있는 함수 선언만 수집합니다. 함수 본문 바로 아래 문장을 대상으로 하고, 중첩 제어 흐름·역할이 모호한 부분은 분류 불가로 남깁니다.
2. `.boxbox/cache/shape.jsonl`에 버전·입력 지문·스캔 범위·완료 상태와 관측 레코드를 저장합니다. 승인 상태나 자동 수정 권한은 넣지 않습니다.
3. 출력은 모양별 개수, 분류 가능 비율, 대표 위치, 반례로 제한합니다. 후보 생성까지만 하고 사람이 선택한 사례만 기존 S5b 경로로 넘깁니다.
4. 검증은 동일 입력의 관측 결과 결정성, 버전·설정 변경 시 무효화, 동명·중첩·한 줄 여러 단위의 구별, 부분 스캔을 전체로 오인하지 않는지에 집중합니다. 코드 순서나 기존 FIX 판정은 바뀌지 않아야 합니다.

계획에는 다음처럼 연결하는 것이 정확합니다.

| 단계 | 이번 아이디어의 관계 |
|---|---|
| **S5a** | 기존 정확 조회 키를 유지합니다. `GDBR`를 현재 `language/context/kind/axes` 키에 억지로 끼우지 않습니다. 문단 규칙 조회까지 필요해지면 별도 규칙 종류와 버전 계약이 필요합니다. |
| **S5b** | 승인된 대표 예문·반례·결정의 기존 저장 및 검증 경로를 재사용합니다. 전체 관측 스냅샷을 승인 예문으로 취급하지 않습니다. |
| **S5c** | **최소 실험의 자리입니다.** 후보를 채우는 수집 보조 단계로 붙이되, 기존 승인 적재 작업의 필수 선행조건으로 만들지는 않습니다. |
| **S5d** | 승인된 패턴만 FIX한다는 게이트를 유지합니다. 분포상 다수라는 사실로 수정 권한을 주지 않습니다. |
| **S5e** | 이번 실험과 구별합니다. S5e는 `KIND_AXES`·profile에 있는 분해·정렬 모양을 규범 데이터로 옮기는 작업입니다. 프로젝트에서 관측한 함수 모양은 이를 대체하지 않습니다. |

근거는 각 단계의 명시된 범위와 S5e의 “기존 golden 동일” 검증 조건입니다. [docs/plan.md:260](/Users/jonghoPro/woo/00_project/98_BoxBox/docs/plan.md:260), [docs/plan.md:261](/Users/jonghoPro/woo/00_project/98_BoxBox/docs/plan.md:261), [docs/plan.md:262](/Users/jonghoPro/woo/00_project/98_BoxBox/docs/plan.md:262), [docs/plan.md:263](/Users/jonghoPro/woo/00_project/98_BoxBox/docs/plan.md:263), [docs/plan.md:264](/Users/jonghoPro/woo/00_project/98_BoxBox/docs/plan.md:264)

채택 권고: 프로젝트 모양을 재생성 가능한 Evidence로 수집하는 TS·JSONL 최소 실험을 S5c에 붙인다.
바꿀 점: 관측과 규범, 스냅샷 식별과 변경 추적을 분리하고 버전·포매터 지문·미지원 상태·보존 한도를 명시한다.
보류할 점: SQLite, 전 언어 함수 분석, 이름 변경 추적, 미승인 모양의 GUIDE 주입, 분포 기반 자동 수정.
> Historical naming note (2026-10-12): this record predates the confirmed product name `boxbox` and npm package `boxbox`. Maintained links and examples use the current names; earlier placeholder-name findings are historical, not current naming blockers. Raw execution evidence remains unchanged.
